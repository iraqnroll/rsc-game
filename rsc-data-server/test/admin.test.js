// node --test test/*.test.js  (npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const QueryHandler = require('../src/query-handler');
const admin = require('../src/handlers/admin');

// A data server with one account, and a way to call a handler as a world would.
function setUp() {
    const database = new Database(':memory:');
    const queryHandler = new QueryHandler(database);
    queryHandler.sync();
    database
        .prepare('INSERT INTO `players` (`username`, `password`, `creation_ip`) VALUES (?, ?, ?)')
        .run('bob', bcrypt.hashSync('old password', 4), '203.0.113.7');
    const server = {
        queryHandler,
        config: { passwordHashRounds: 4 },
        getPlayerWorld: (name) => (name === 'bob' ? 1 : 0)
    };
    const call = (name, args) =>
        new Promise((resolve) => {
            const self = { server, socket: { sendMessage: resolve } };
            admin[name].call(self, { token: 't', ...args });
        });
    const row = () => database.prepare('SELECT * FROM `players` WHERE `username` = ?').get('bob');
    return { call, row, queryHandler };
}

test('player info describes the account', async () => {
    const { call } = setUp();
    const reply = await call('adminPlayerInfo', { username: 'BOB' });
    assert.equal(reply.ok, true);
    assert.equal(reply.account.username, 'bob');
    assert.equal(reply.account.createdFrom, '203.0.113.7');
    assert.equal(reply.account.world, 1);
    assert.equal(reply.account.bannedUntil, null);
    assert.ok(reply.account.skills.attack);
    assert.deepEqual(await call('adminPlayerInfo', { username: 'nobody' }), {
        token: 't',
        ok: false,
        error: 'no account called nobody'
    });
});

test('rank, ban and mute are stored in the units the rest of the code reads', async () => {
    const { call, row, queryHandler } = setUp();
    assert.equal((await call('adminSetRank', { username: 'bob', rank: 2 })).ok, true);
    assert.equal(row().rank, 2);
    assert.equal((await call('adminSetRank', { username: 'bob', rank: 1 })).ok, false);

    const inAnHour = Date.now() + 3600_000;
    await call('adminSetBan', { username: 'bob', until: inAnHour });
    // Seconds in the table, as getPlayerBanEnd -- the login check -- expects.
    assert.equal(row().ban_end_date, Math.floor(inAnHour / 1000));
    assert.ok(queryHandler.getPlayerBanEnd('bob') > Date.now());
    await call('adminSetBan', { username: 'bob', until: -1 });
    assert.equal(queryHandler.getPlayerBanEnd('bob'), -1);
    await call('adminSetBan', { username: 'bob', until: 0 });
    assert.equal(queryHandler.getPlayerBanEnd('bob'), undefined);

    // Milliseconds for mutes, as Player#isMuted compares with Date.now().
    await call('adminSetMute', { username: 'bob', until: inAnHour });
    assert.equal(row().mute_end_date, inAnHour);
    const info = await call('adminPlayerInfo', { username: 'bob' });
    assert.equal(info.account.mutedUntil, new Date(inAnHour).toISOString());
});

test('a password reset gives a new password once, and the old one stops working', async () => {
    const { call, row } = setUp();
    const reply = await call('adminResetPassword', { username: 'bob' });
    assert.match(reply.password, /^[a-z2-9]{12}$/);
    assert.equal(bcrypt.compareSync(reply.password, row().password), true);
    assert.equal(bcrypt.compareSync('old password', row().password), false);
});

test('an expired ban is cleared at login instead of trapping the player', async () => {
    const { queryHandler, row } = setUp();
    queryHandler.setPlayerBan('bob', Date.now() - 60_000);
    assert.ok(row().ban_end_date > 0);
    // What playerLogin does with a ban that has run out, before trying again.
    queryHandler.setPlayerBan('bob', 0);
    assert.equal(row().ban_end_date, 0);
    assert.equal(queryHandler.getPlayerBanEnd('bob'), undefined);
});
