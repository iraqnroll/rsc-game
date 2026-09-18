// Game events for RSC Editor's audit: logins, chat, private messages, drops,
// pickups, deaths, commands.
//
// Nothing may be lost because the editor was restarting, so an event is
// written to a spool file (config.eventSpool, one JSON line each) before
// anything else, and stays there until the editor says it has stored it:
//
//   editor: eventsSince { seq }  -> the next events after `seq`, in order
//   editor: ackEvents { seq }    -> "stored up to here"; they are dropped
//
// Events are also pushed live over the control socket, but only as a nudge
// to come and fetch -- the editor always reads through eventsSince, in
// order, so an ack can never skip an event it has not seen.
//
// `seq` is time-based (ms * 1000 + a counter), so it keeps increasing across
// restarts without storing a counter anywhere.

const fs = require('fs');
const log = require('bole')('events');

// A world that cannot reach the editor for a long time keeps this many, then
// drops the oldest; it says so in its log.
const MAX_PENDING = 200000;

class EventLog {
    constructor({ spool = null, worldId = 1 } = {}) {
        this.spool = spool;
        this.worldId = worldId;
        this.pending = [];
        this.lastSeq = 0;
        this.listeners = [];
        this.load();
    }

    load() {
        if (!this.spool || !fs.existsSync(this.spool)) return;
        const lines = fs.readFileSync(this.spool, 'utf8').split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const event = JSON.parse(line);
                this.pending.push(event);
                this.lastSeq = Math.max(this.lastSeq, event.seq);
            } catch (e) {
                // a line cut short by a crash; the rest are fine
            }
        }
        log.info(`${this.pending.length} events waiting for the editor`);
    }

    nextSeq() {
        this.lastSeq = Math.max(Date.now() * 1000, this.lastSeq + 1);
        return this.lastSeq;
    }

    // type: 'login', 'chat', ...; player: a username or null; other: the other
    // party (a PM's recipient, a killer); details: anything else.
    emit(type, player = null, details = {}, other = null) {
        const event = {
            seq: this.nextSeq(),
            at: new Date().toISOString(),
            type,
            player,
            other,
            details
        };

        if (this.spool) {
            try {
                fs.appendFileSync(this.spool, `${JSON.stringify(event)}\n`);
            } catch (e) {
                log.error(e, 'could not write the event spool');
            }
        }

        this.pending.push(event);
        if (this.pending.length > MAX_PENDING) {
            const dropped = this.pending.length - MAX_PENDING;
            this.pending.splice(0, dropped);
            log.warn(`the editor has not collected events for a long time; dropped the ${dropped} oldest`);
        }

        for (const listener of this.listeners) listener(event);
        return event;
    }

    since(seq = 0, limit = 1000) {
        const out = [];
        for (const event of this.pending) {
            if (event.seq > seq) {
                out.push(event);
                if (out.length >= limit) break;
            }
        }
        return out;
    }

    ack(seq) {
        const before = this.pending.length;
        this.pending = this.pending.filter((e) => e.seq > seq);
        if (this.pending.length !== before) this.rewrite();
        return { remaining: this.pending.length };
    }

    // Replace the spool with what is still pending, by rename so a crash
    // leaves either the old file or the new one.
    rewrite() {
        if (!this.spool) return;
        const tmp = `${this.spool}.tmp`;
        const body = this.pending.map((e) => JSON.stringify(e)).join('\n');
        fs.writeFileSync(tmp, body ? `${body}\n` : '');
        fs.renameSync(tmp, this.spool);
    }

    onEvent(listener) {
        this.listeners.push(listener);
    }
}

// The server's log, or a stand-in that does nothing: plugins and tests run
// without one.
function eventsOf(entity) {
    const server = entity && entity.world && entity.world.server;
    return (server && server.events) || NO_EVENTS;
}

const NO_EVENTS = { emit() {} };

module.exports = { EventLog, eventsOf, MAX_PENDING };
