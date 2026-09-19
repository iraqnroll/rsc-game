// node --test test/  (npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { COMMANDS, runCommand, usage } = require('../src/commands');
const { PLAYER, MODERATOR, ADMINISTRATOR } = require('../src/ranks');

// Just enough of Player and World for the commands under test.
function fakeWorld() {
    const players = [];
    return {
        players,
        getPlayerByUsername: (name) => players.find((p) => p.username === name.toLowerCase())
    };
}

function fakePlayer(world, username, rank) {
    const player = {
        username,
        rank,
        world,
        x: 120,
        y: 648,
        messages: [],
        added: [],
        message(...lines) {
            this.messages.push(...lines.map(String));
        },
        inventory: {
            add(id, amount) {
                player.added.push([id, amount]);
            }
        },
        teleport(x, y) {
            player.x = x;
            player.y = y;
        },
        async logout() {
            player.loggedOut = true;
        }
    };
    world.players.push(player);
    return player;
}

test('a player without the rank gets nothing, not even a hint', async () => {
    const world = fakeWorld();
    const player = fakePlayer(world, 'bob', PLAYER);
    const result = await runCommand(player, 'give', ['bob', 'coins', '1000']);
    assert.equal(result.ran, false);
    assert.deepEqual(player.added, []);
    assert.deepEqual(player.messages, []);
});

test('a moderator cannot spawn items but can kick', async () => {
    const world = fakeWorld();
    const mod = fakePlayer(world, 'mod', MODERATOR);
    const bob = fakePlayer(world, 'bob', PLAYER);
    assert.equal((await runCommand(mod, 'item', ['coins'])).ran, false);
    assert.equal((await runCommand(mod, 'kick', ['bob'])).ran, true);
    assert.equal(bob.loggedOut, true);
});

test('give takes an item by name, underscores for spaces', async () => {
    const world = fakeWorld();
    const admin = fakePlayer(world, 'admin', ADMINISTRATOR);
    const bob = fakePlayer(world, 'bob', PLAYER);
    assert.equal((await runCommand(admin, 'give', ['bob', 'bronze_short_sword'])).ran, true);
    assert.equal((await runCommand(admin, 'give', ['bob', '10', '500'])).ran, true);
    assert.deepEqual(bob.added, [[66, 1], [10, 500]]);
    assert.equal(bob.messages[0], 'admin gave you 1 x Bronze Short Sword');
});

test('bad arguments say what is wrong and how to call it', async () => {
    const world = fakeWorld();
    const admin = fakePlayer(world, 'admin', ADMINISTRATOR);
    await runCommand(admin, 'give', ['ghost', 'coins']);
    assert.match(admin.messages[0], /ghost is not online/);
    assert.equal(admin.messages[1], '@yel@usage: ::give <player> <item> [amount]');

    admin.messages.length = 0;
    fakePlayer(world, 'bob', PLAYER);
    await runCommand(admin, 'give', ['bob', 'no_such_thing']);
    assert.match(admin.messages[0], /no item called "no such thing" -- try ::find item/);
});

test('help lists what your rank can use, and explains one command', async () => {
    const world = fakeWorld();
    const mod = fakePlayer(world, 'mod', MODERATOR);
    await runCommand(mod, 'help', []);
    const listing = mod.messages.join('\n');
    assert.match(listing, /moderator: coords kick goto teleport/);
    assert.doesNotMatch(listing, /give/);

    const admin = fakePlayer(world, 'admin', ADMINISTRATOR);
    await runCommand(admin, 'help', ['give']);
    assert.deepEqual(admin.messages.slice(0, 1), ['@yel@::give <player> <item> [amount]']);
    assert.match(admin.messages[2], /::give some_player coins 1000/);
});

test('find looks ids up by name', async () => {
    const world = fakeWorld();
    const admin = fakePlayer(world, 'admin', ADMINISTRATOR);
    await runCommand(admin, 'find', ['item', 'rune', 'scimitar']);
    assert.deepEqual(admin.messages, ['@whi@398: rune Scimitar']);
});

test('teleport by region name, or coordinates', async () => {
    const world = fakeWorld();
    const mod = fakePlayer(world, 'mod', MODERATOR);
    await runCommand(mod, 'teleport', ['10', '20']);
    assert.deepEqual([mod.x, mod.y], [10, 20]);
    await runCommand(mod, 'teleport', ['lumbridge']);
    assert.notDeepEqual([mod.x, mod.y], [10, 20]);
});

test('every command has help, and a usage that matches its arguments', () => {
    for (const [name, cmd] of Object.entries(COMMANDS)) {
        assert.ok(cmd.help, `${name} has no help`);
        assert.ok(cmd.rank >= MODERATOR, `${name} is open to players`);
        assert.ok(usage(name, cmd).startsWith(`::${name}`));
    }
});

test('bring and send move another player; players cannot', async () => {
    const world = fakeWorld();
    const mod = fakePlayer(world, 'mod', MODERATOR);
    const bob = fakePlayer(world, 'bob', PLAYER);
    mod.x = 300; mod.y = 400;
    assert.equal((await runCommand(mod, 'bring', ['bob'])).ran, true);
    assert.deepEqual([bob.x, bob.y], [300, 400]);
    assert.equal(bob.messages.at(-1), '@yel@mod brought you here.');
    await runCommand(mod, 'send', ['bob', '10', '20']);
    assert.deepEqual([bob.x, bob.y], [10, 20]);
    await runCommand(mod, 'send', ['bob', 'lumbridge']);
    assert.notDeepEqual([bob.x, bob.y], [10, 20]);
    assert.equal((await runCommand(bob, 'bring', ['mod'])).ran, false);
});
