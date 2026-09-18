const BrowserSocket = require('./browser-socket');

const DataClient = process.browser
    ? require('./browser-data-client')
    : require('./data-client');

const RSCSocket = require('@2003scape/rsc-socket');
const World = require('./model/world');
const log = require('bole')('server');
const net = require('net');
const packetHandlers = require('./packet-handlers');
const toBuffer = process.browser ? require('typedarray-to-buffer') : undefined;
const ws = require('ws');

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// The client address a local reverse proxy vouches for, or undefined. Only a
// connection from this machine may set it -- anyone else could claim any
// address they liked. deploy/game/rsc-game.caddy sends it as X-Real-IP.
function forwardedIP(request) {
    if (!request || !LOOPBACK.has(request.socket.remoteAddress)) {
        return undefined;
    }

    const header = request.headers['x-real-ip'];

    if (typeof header !== 'string' || !/^[0-9a-fA-F.:]{3,45}$/.test(header)) {
        return undefined;
    }

    return header.replace(/^::ffff:/, '');
}

class Server {
    constructor(config) {
        this.config = config;
        this.isBrowser = !!process.browser;

        this.world = new World(this);

        if (!process.browser) {
            const { EventLog } = require('./admin/events');
            this.events = new EventLog({ spool: config.eventSpool, worldId: config.worldID });
        }
        this.dataClient = new DataClient(this);

        this.incomingMessages = new Map();
        this.outgoingMessages = [];

        if (process.browser) {
            this.browserSockets = {};
        }
    }

    loadPacketHandlers() {
        this.handlers = {};

        for (const file of Object.keys(packetHandlers)) {
            const handlers = packetHandlers[file];

            for (const handlerName of Object.keys(handlers)) {
                this.handlers[handlerName] = handlers[handlerName];
            }
        }
    }

    // `realIP`: the player's address as the proxy in front saw it (see
    // bindWebSocket). Without it every player behind Caddy is 127.0.0.1, and
    // the data server's players-per-IP limit lets only one of them log in.
    handleConnection(socket, realIP) {
        socket = new RSCSocket(socket);

        if (realIP) {
            socket.getIPAddress = () => realIP;
        }
        socket.setTimeout(5000);
        socket.server = this;

        this.incomingMessages.set(socket, []);

        socket.on('error', (err) => log.error(err));
        socket.on('timeout', () => socket.close());

        socket.on('message', async (message) => {
            if (
                !socket.player &&
                !/register|login|session|closeConnection/.test(message.type)
            ) {
                log.warn(`${socket} sending ${message.type} before login`);
                socket.close();
                return;
            }

            const queue = this.incomingMessages.get(socket);
            //const messagesSent = queue.length;

            log.debug(`incoming message from ${socket}`, message);
            queue.push(message);

            if (queue.length >= 10) {
                queue.shift();
            }
        });

        socket.on('close', async () => {
            if (socket.player) {
                if (socket.player.loggedIn) {
                    await socket.player.logout();
                }

                delete socket.player;
                delete socket.server;
            }

            socket.removeAllListeners();
            this.incomingMessages.delete(this);
            log.info(`${socket} disconnected`);
        });

        log.info(`${socket} connected`);
    }

    bindTCP() {
        this.tcpServer = new net.Server();

        this.tcpServer.on('error', (err) => log.error(err));

        this.tcpServer.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        return new Promise((resolve, reject) => {
            this.tcpServer.once('error', reject);

            this.tcpServer.once('listening', () => {
                this.tcpServer.removeListener('error', reject);
                log.info(`listening for TCP connections on port ${port}`);
                resolve();
            });

            const port = this.config.tcpPort;
            this.tcpServer.listen({ port });
        });
    }

    bindWebSocket() {
        const port = this.config.websocketPort;

        this.websocketServer = new ws.Server({ port });
        this.websocketServer.on('error', (err) => log.error(err));

        this.websocketServer.on('connection', (socket, request) => {
            this.handleConnection(socket, forwardedIP(request));
        });

        log.info(`listening for websocket connections on port ${port}`);
    }

    // RSC Editor's way in; see src/admin. Off unless the config names a path.
    async bindControl() {
        const { Control } = require('./admin/control');
        const { ControlServer } = require('./admin/control-server');

        this.control = new Control(this);

        if (this.config.adminSocket) {
            this.controlServer = new ControlServer(this.control, {
                path: this.config.adminSocket,
                mode: this.config.adminSocketMode
                    ? parseInt(this.config.adminSocketMode, 8)
                    : 0o660
            });
            await this.controlServer.listen();
            this.control.onStop = () => this.controlServer.close();
            // A nudge: the editor fetches in order with eventsSince.
            this.events.onEvent((event) => this.controlServer.publish(event));
        }
    }

    bindWebWorker() {
        addEventListener('message', (e) => {
            switch (e.data.type) {
                case 'connect': {
                    const browserSocket = new BrowserSocket(e.data.id);
                    this.browserSockets[browserSocket.id] = browserSocket;
                    this.handleConnection(browserSocket);
                    break;
                }
                case 'disconnect': {
                    const browserSocket = this.browserSockets[e.data.id];
                    browserSocket.emit('close', false);
                    delete this.browserSockets[browserSocket.id];
                    break;
                }
                case 'data': {
                    const browserSocket = this.browserSockets[e.data.id];
                    browserSocket.emit('data', toBuffer(e.data.data));
                    break;
                }
            }
        });
    }

    readMessages() {
        for (const [socket, queue] of this.incomingMessages) {
            for (const message of queue) {
                const handler = this.handlers[message.type];

                if (!handler) {
                    log.warn(`${socket} no handler for type ${message.type}`);
                    continue;
                }

                handler(socket, message).catch((e) => {
                    log.error(e, socket.toString());
                });
            }

            queue.length = 0;
        }
    }

    sendMessages() {
        while (this.outgoingMessages.length) {
            const { socket, message } = this.outgoingMessages.shift();
            socket.sendMessage(message);
        }
    }

    async init() {
        try {
            await this.dataClient.init();

            await this.world.loadData();
            this.world.tick();

            this.loadPacketHandlers();

            if (this.isBrowser) {
                this.bindWebWorker();
                postMessage({ type: 'ready' });
            } else {
                await this.bindTCP();
                this.bindWebSocket();
                await this.bindControl();
            }
        } catch (e) {
            console.error(e);
            log.error(e);
            process.exit(1);
        }
    }
}

module.exports = Server;
module.exports.forwardedIP = forwardedIP;
