// What the control socket can ask a running world to do. Plain functions of
// the Server, so they are testable without a socket.
//
// The socket's owner has the power of an administrator over every player on
// this world; that is why it is a unix socket (see control-server.js) and why
// the editor, its only client, audits every call.

const { rankName, PLAYER, MODERATOR, ADMINISTRATOR } = require('../ranks');
const { experienceToLevel } = require('../skills');
const { destination } = require('../teleport');
const { eventsOf } = require('./events');

// Actions taken through the socket appear in the world's own event log too.
function adminEvent(control, action, details, target = null) {
    eventsOf({ world: control.world }).emit('admin', null, { action, ...details }, target);
}

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
        adminEvent(this, 'broadcast', { message: text, sent: players.length });
        return { sent: players.length };
    }

    async kick({ username }) {
        const player = this.world.getPlayerByUsername(String(username || ''));
        if (!player) throw new Error(`${username} is not online`);
        adminEvent(this, 'kick', {}, player.username);
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
        adminEvent(this, stop ? 'restart' : 'countdown', { seconds: secs, reason: text });
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

    /* ------------------------------------------------------- accounts -- */

    // Ask the data server; it owns accounts, online or not.
    async data(handler, args) {
        const reply = await this.server.dataClient.sendAndReceive({ handler, ...args });
        if (!reply) throw new Error('the data server is not connected');
        if (!reply.ok) throw new Error(reply.error || `${handler} failed`);
        return reply;
    }

    onlinePlayer(username) {
        return this.world.getPlayerByUsername(String(username || '').toLowerCase());
    }

    // An account as stored, with what is true right now for a player who is
    // on: rank and mutes live on the Player and are saved at logout, so the
    // running value wins.
    async playerInfo({ username }) {
        const { account } = await this.data('adminPlayerInfo', { username });
        const player = this.onlinePlayer(account.username);
        const skills = {};
        for (const [name, s] of Object.entries(account.skills || {})) {
            skills[name] = { level: experienceToLevel(s.experience), current: s.current, experience: s.experience };
        }
        if (player) {
            for (const [name, s] of Object.entries(player.skills)) {
                skills[name] = { level: s.base, current: s.current, experience: s.experience };
            }
        }
        const muted = (end) => (end === -1 ? 'forever' : end > Date.now() ? new Date(end).toISOString() : null);
        return {
            ...account,
            rank: player ? player.rank : account.rank,
            rankName: rankName(player ? player.rank : account.rank),
            mutedUntil: player ? muted(player.muteEndDate) : account.mutedUntil,
            skills,
            online: player
                ? {
                      x: player.x,
                      y: player.y,
                      combatLevel: player.combatLevel,
                      ip: player.socket && player.socket.getIPAddress ? player.socket.getIPAddress() : null,
                      loggedInAt: player.sessionStart ? new Date(player.sessionStart).toISOString() : null
                  }
                : null
        };
    }

    async setRank({ username, rank }) {
        if (![PLAYER, MODERATOR, ADMINISTRATOR].includes(rank)) throw new Error('rank must be 0, 2 or 3');
        const { username: name } = await this.data('adminSetRank', { username, rank });
        const player = this.onlinePlayer(name);
        if (player) {
            player.rank = rank;
            player.message(`@yel@You are now a${rank === ADMINISTRATOR ? 'n' : ''} ${rankName(rank)}.`);
        }
        adminEvent(this, 'rank', { rank }, name);
        return { username: name, rank };
    }

    // minutes: how long, or -1 for good; 0 lifts it.
    async mute({ username, minutes, reason = '' }) {
        const until = untilFor(minutes);
        const { username: name } = await this.data('adminSetMute', { username, until });
        const player = this.onlinePlayer(name);
        if (player) {
            player.muteEndDate = until;
            player.message(
                until === 0
                    ? '@yel@You can talk again.'
                    : `@red@You have been muted ${forHowLong(minutes)}.${reason ? ` Reason: ${reason}` : ''}`
            );
        }
        adminEvent(this, until === 0 ? 'unmute' : 'mute', { minutes, reason }, name);
        return { username: name, until: untilText(until) };
    }

    async ban({ username, minutes, reason = '' }) {
        const until = untilFor(minutes);
        const { username: name } = await this.data('adminSetBan', { username, until });
        const player = this.onlinePlayer(name);
        adminEvent(this, until === 0 ? 'unban' : 'ban', { minutes, reason }, name);
        if (player && until !== 0) {
            player.message(`@red@You have been banned ${forHowLong(minutes)}.${reason ? ` Reason: ${reason}` : ''}`);
            await player.logout();
        }
        return { username: name, until: untilText(until), kicked: !!(player && until !== 0) };
    }

    // Move an online player: to coordinates, or a region by name.
    teleport({ username, x, y, region, reason = '' }) {
        const player = this.onlinePlayer(username);
        if (!player) throw new Error(`${username} is not online`);
        const to = destination({ x, y, region });
        if (to.error) throw new Error(to.error);
        player.teleport(to.x, to.y, true);
        player.message(`@yel@A moderator moved you.${reason ? ` (${reason})` : ''}`);
        adminEvent(this, 'teleport', { x: to.x, y: to.y, region: to.region }, player.username);
        return { username: player.username, x: to.x, y: to.y };
    }

    async resetPassword({ username }) {
        const reply = await this.data('adminResetPassword', { username });
        adminEvent(this, 'password-reset', {}, reply.username);
        return { username: reply.username, password: reply.password };
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

function untilFor(minutes) {
    if (minutes === -1) return -1;
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 0 || m > 60 * 24 * 365 * 10) throw new Error('minutes must be -1 (for good), 0 (lift) or up to ten years');
    return m === 0 ? 0 : Date.now() + Math.round(m * 60000);
}

function untilText(until) {
    return until === -1 ? 'forever' : until === 0 ? null : new Date(until).toISOString();
}

function forHowLong(minutes) {
    if (minutes === -1) return 'permanently';
    if (minutes % 1440 === 0) return `for ${minutes / 1440} day${minutes === 1440 ? '' : 's'}`;
    if (minutes % 60 === 0) return `for ${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
    return `for ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// The commands the socket accepts, and how to call each.
const COMMANDS = {
    status: (c) => c.status(),
    players: (c) => c.players(),
    broadcast: (c, args) => c.broadcast(args),
    kick: (c, args) => c.kick(args),
    saveAll: (c) => c.saveAll(),
    shutdown: (c, args) => c.shutdownIn(args),
    cancelShutdown: (c) => c.cancelShutdown(),
    eventsSince: (c, { seq = 0, limit = 1000 } = {}) => ({
        events: c.server.events.since(Number(seq) || 0, Math.min(Number(limit) || 1000, 5000))
    }),
    ackEvents: (c, { seq }) => c.server.events.ack(Number(seq) || 0),
    playerInfo: (c, args) => c.playerInfo(args),
    setRank: (c, args) => c.setRank(args),
    mute: (c, args) => c.mute(args),
    ban: (c, args) => c.ban(args),
    resetPassword: (c, args) => c.resetPassword(args),
    teleport: (c, args) => c.teleport(args)
};

module.exports = { Control, COMMANDS, sendCountdown };
