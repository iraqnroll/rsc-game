const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { Control } = require('../src/admin/control');
const { ControlServer } = require('../src/admin/control-server');

function fakeServer(names) {
    const players = names.map((username, i) => ({
        username,
        rank: i === 0 ? 3 : 0,
        x: 120 + i,
        y: 648,
        combatLevel: 3,
        socket: { getIPAddress: () => `10.0.0.${i + 1}` },
        sessionStart: Date.parse('2026-09-18T12:00:00Z'),
        messages: [],
        sent: [],
        saved: 0,
        loggedOut: false,
        message(text) {
            this.messages.push(text);
        },
        send(msg) {
            this.sent.push(msg);
        },
        async save() {
            this.saved += 1;
        },
        async logout() {
            this.loggedOut = true;
            this.saved += 1;
            const at = players.indexOf(this);
            if (at >= 0) players.splice(at, 1);
        }
    }));
    const list = {
        // A generator, like EntityList#getAll -- an array here hid a bug.
        *getAll() {
            yield* [...players];
        },
        get length() {
            return players.length;
        }
    };
    return {
        players,
        config: { worldID: 1, members: false, version: 204 },
        world: {
            players: list,
            playerCapacity: 1250,
            getPlayerByUsername: (n) => players.find((p) => p.username === n.toLowerCase())
        }
    };
}

test('status and players describe the world', () => {
    const server = fakeServer(['admin', 'bob']);
    const control = new Control(server);
    assert.deepEqual(
        { ...control.status(), startedAt: 'x', uptimeSeconds: 0, memoryMB: 0 },
        { worldId: 1, members: false, version: 204, startedAt: 'x', uptimeSeconds: 0, players: 2, capacity: 1250, memoryMB: 0, shutdown: null }
    );
    assert.deepEqual(control.players()[1], {
        username: 'bob', rank: 0, rankName: 'player', x: 121, y: 648, combatLevel: 3,
        ip: '10.0.0.2', loggedInAt: '2026-09-18T12:00:00.000Z'
    });
});

test('broadcast reaches everyone; kick logs one player out', async () => {
    const server = fakeServer(['admin', 'bob']);
    const control = new Control(server);
    assert.deepEqual(control.broadcast({ message: ' Double XP this weekend ' }), { sent: 2 });
    assert.deepEqual(server.players[1].messages, ['@yel@Double XP this weekend']);
    assert.throws(() => control.broadcast({ message: '  ' }), /empty/);

    const bob = server.players[1];
    assert.deepEqual(await control.kick({ username: 'Bob' }), { kicked: 'bob' });
    assert.equal(bob.loggedOut, true);
    await assert.rejects(control.kick({ username: 'ghost' }), /not online/);
});

test('a shutdown counts down on every client, then saves everyone and exits', async () => {
    const server = fakeServer(['admin', 'bob']);
    const control = new Control(server);
    const everyone = [...server.players];
    let exited = null;
    control.stop = ((stop) => () => stop.call(control, (code) => (exited = code)))(Control.prototype.stop);

    control.shutdownIn({ seconds: 0.05 * 20, reason: 'Update' });
    // The client shows seconds * 50 * 32 / 50: send seconds / 32 so it reads right.
    assert.deepEqual(everyone[1].sent[0], { type: 'systemUpdate', seconds: 1 / 32 });
    assert.equal(everyone[1].messages[0], '@yel@Update');
    assert.ok(control.status().shutdown);

    await new Promise((r) => setTimeout(r, 1100));
    await control.stopping;
    assert.equal(exited, 0);
    assert.ok(everyone.every((p) => p.loggedOut && p.saved === 1));
});

test('a cancelled shutdown clears the clock and does not stop', () => {
    const server = fakeServer(['bob']);
    const control = new Control(server);
    control.shutdownIn({ seconds: 60 });
    assert.deepEqual(control.cancelShutdown(), { cancelled: true });
    assert.deepEqual(server.players[0].sent.at(-1), { type: 'systemUpdate', seconds: 0 });
    assert.equal(control.status().shutdown, null);
});

test('the socket answers one JSON line per request', async () => {
    const server = fakeServer(['admin']);
    const socketPath = path.join(os.tmpdir(), `rsc-control-${process.pid}.sock`);
    const control = new ControlServer(new Control(server), { path: socketPath });
    await control.listen();
    try {
        const conn = net.createConnection(socketPath);
        conn.setEncoding('utf8');
        const lines = [];
        conn.on('data', (d) => lines.push(...d.split('\n').filter(Boolean)));
        conn.write('{"id":1,"cmd":"players"}\n{"id":2,"cmd":"nope"}\nnot json\n');
        await new Promise((r) => setTimeout(r, 100));
        // Requests run concurrently, so replies may come in any order; the id says which is which.
        const replies = lines.map((l) => JSON.parse(l));
        const byId = (id) => replies.find((r) => r.id === id);
        assert.equal(replies.length, 3);
        assert.equal(byId(1).result[0].username, 'admin');
        assert.deepEqual(byId(2), { id: 2, ok: false, error: 'unknown command nope' });
        assert.deepEqual(byId(null), { id: null, ok: false, error: 'not JSON' });

        control.publish({ type: 'login', player: 'admin' });
        await new Promise((r) => setTimeout(r, 50));
        assert.deepEqual(JSON.parse(lines.at(-1)), { event: { type: 'login', player: 'admin' } });
        conn.destroy();
    } finally {
        await control.close();
    }
});

test('a countdown without stop leaves stopping to the caller', async () => {
    const server = fakeServer(['bob']);
    const control = new Control(server);
    let stopped = false;
    control.stop = () => (stopped = true);
    control.shutdownIn({ seconds: 0, reason: 'Publishing', stop: false });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(stopped, false);
    assert.equal(server.players[0].messages[0], '@yel@Publishing');
});
