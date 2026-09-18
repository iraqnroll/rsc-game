// The world's control socket: a unix socket (never a network port) that RSC
// Editor connects to, to see the world and act on it.
//
// One JSON object per line, both ways:
//   -> { "id": 1, "cmd": "kick", "args": { "username": "bob" } }
//   <- { "id": 1, "ok": true, "result": { "kicked": "bob" } }
//   <- { "id": 1, "ok": false, "error": "bob is not online" }
// and, unasked, { "event": { ... } } lines (game events, see events.js).
//
// Access is the file's permissions: config.adminSocketMode (default 0660), so
// only this server's user and group -- the editor's user is put in that
// group by deploy/game/install.sh -- can connect.

const fs = require('fs');
const net = require('net');
const log = require('bole')('control');
const { COMMANDS } = require('./control');

const MAX_LINE = 64 * 1024;

class ControlServer {
    constructor(control, { path, mode = 0o660 }) {
        this.control = control;
        this.path = path;
        this.mode = mode;
        this.connections = new Set();
    }

    listen() {
        // A socket file left by a crash makes listen() fail with EADDRINUSE.
        try {
            fs.unlinkSync(this.path);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        this.server = net.createServer((conn) => this.accept(conn));
        return new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.path, () => {
                fs.chmodSync(this.path, this.mode);
                log.info(`control socket on ${this.path}`);
                resolve();
            });
        });
    }

    accept(conn) {
        this.connections.add(conn);
        let buffer = '';
        conn.setEncoding('utf8');
        conn.on('data', (chunk) => {
            buffer += chunk;
            if (buffer.length > MAX_LINE && !buffer.includes('\n')) {
                conn.destroy();
                return;
            }
            let newline;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (line) this.handle(conn, line);
            }
        });
        conn.on('close', () => this.connections.delete(conn));
        conn.on('error', (e) => log.warn(e.message));
    }

    async handle(conn, line) {
        let request;
        try {
            request = JSON.parse(line);
        } catch (e) {
            this.send(conn, { id: null, ok: false, error: 'not JSON' });
            return;
        }
        const { id = null, cmd, args = {} } = request;
        const run = Object.prototype.hasOwnProperty.call(COMMANDS, cmd) ? COMMANDS[cmd] : null;
        if (!run) {
            this.send(conn, { id, ok: false, error: `unknown command ${cmd}` });
            return;
        }
        try {
            const result = await run(this.control, args);
            this.send(conn, { id, ok: true, result });
            if (cmd !== 'status' && cmd !== 'players') log.info({ cmd, args }, 'control');
        } catch (e) {
            this.send(conn, { id, ok: false, error: e.message });
        }
    }

    send(conn, message) {
        if (!conn.destroyed) conn.write(`${JSON.stringify(message)}\n`);
    }

    // To every connected client; stage 2's game events go through here.
    publish(event) {
        for (const conn of this.connections) this.send(conn, { event });
    }

    close() {
        for (const conn of this.connections) conn.destroy();
        return new Promise((resolve) => {
            if (!this.server) return resolve();
            this.server.close(() => {
                try {
                    fs.unlinkSync(this.path);
                } catch (e) {
                    // already gone
                }
                resolve();
            });
        });
    }
}

module.exports = { ControlServer };
