// What the control socket can ask a running world to do. Plain functions of
// the Server, so they are testable without a socket.
//
// The socket's owner has the power of an administrator over every player on
// this world; that is why it is a unix socket (see control-server.js) and why
// the editor, its only client, audits every call.

const { rankName } = require('../ranks');

// rsc-socket's encoder writes `seconds * 50`, and the 204 client multiplies
// what it receives by 32 before counting it down at 50 a second -- so the
// clock read 32 times too long. Divide here rather than patch a dependency.
function sendCountdown(player, seconds) {
    player.send({ type: 'systemUpdate', seconds: seconds / 32 });
}

class Control {
    constructor(server) {
        this.server = server;
        this.startedAt = Date.now();
        this.shutdown = null;
    }

    get world() {
        return this.server.world;
    }

    // EntityList#getAll is a generator; everything here wants an array.
    online() {
        return Array.from(this.world.players.getAll());
    }

    status() {
        const { config } = this.server;
        const memory = process.memoryUsage();
        return {
            worldId: config.worldID,
            members: !!config.members,
            version: config.version,
            startedAt: new Date(this.startedAt).toISOString(),
            uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
            players: this.world.players.length,
            capacity: this.world.playerCapacity,
            memoryMB: Math.round(memory.rss / 1024 / 1024),
            shutdown: this.shutdown
                ? { at: new Date(this.shutdown.at).toISOString(), reason: this.shutdown.reason }
                : null
        };
    }

    players() {
        return this.online().map((p) => ({
            username: p.username,
            rank: p.rank,
            rankName: rankName(p.rank),
            x: p.x,
            y: p.y,
            combatLevel: p.combatLevel,
            ip: p.socket && typeof p.socket.getIPAddress === 'function' ? p.socket.getIPAddress() : null,
            loggedInAt: p.sessionStart ? new Date(p.sessionStart).toISOString() : null
        }));
    }

    broadcast({ message }) {
        if (typeof message !== 'string' || !message.trim()) {
            throw new Error('message is empty');
        }
        const text = message.trim().slice(0, 200);
        const players = this.online();
        for (const p of players) p.message(`@yel@${text}`);
        return { sent: players.length };
    }

    async kick({ username }) {
        const player = this.world.getPlayerByUsername(String(username || ''));
        if (!player) throw new Error(`${username} is not online`);
        await player.logout();
        return { kicked: player.username };
    }

    async saveAll() {
        const players = this.online();
        await Promise.all(players.map((p) => p.save()));
        return { saved: players.length };
    }

    // Count down on every client, save and log everyone out at zero, then
    // exit; systemd (Restart=always) brings the world back up. With
    // `stop: false` it only counts down, for a caller that stops the world
    // itself -- Publish, which must not have it restart on the old cache.
    shutdownIn({ seconds, reason, stop = true }) {
        const secs = Math.max(0, Math.min(3600, Math.floor(Number(seconds) || 0)));
        if (this.shutdown) clearTimeout(this.shutdown.timer);

        const at = Date.now() + secs * 1000;
        const text = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 120) : '';
        for (const p of this.online()) {
            if (secs > 0) sendCountdown(p, secs);
            if (text) p.message(`@yel@${text}`);
        }
        this.shutdown = {
            at,
            reason: text,
            timer: stop ? setTimeout(() => this.stop(), secs * 1000) : null
        };
        return { at: new Date(at).toISOString() };
    }

    cancelShutdown() {
        if (!this.shutdown) return { cancelled: false };
        clearTimeout(this.shutdown.timer);
        this.shutdown = null;
        for (const p of this.online()) {
            sendCountdown(p, 0);
            p.message('@yel@The update has been cancelled.');
        }
        return { cancelled: true };
    }

    // Log everyone out (which saves them) and exit. Also what SIGTERM does.
    async stop(exit = (code) => process.exit(code)) {
        if (this.stopping) return this.stopping;
        this.stopping = (async () => {
            const players = this.online();
            await Promise.allSettled(players.map((p) => p.logout()));
            if (this.onStop) await this.onStop();
            exit(0);
        })();
        return this.stopping;
    }
}

// The commands the socket accepts, and how to call each.
const COMMANDS = {
    status: (c) => c.status(),
    players: (c) => c.players(),
    broadcast: (c, args) => c.broadcast(args),
    kick: (c, args) => c.kick(args),
    saveAll: (c) => c.saveAll(),
    shutdown: (c, args) => c.shutdownIn(args),
    cancelShutdown: (c) => c.cancelShutdown()
};

module.exports = { Control, COMMANDS, sendCountdown };
