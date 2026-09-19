const test = require('node:test');
const assert = require('node:assert/strict');
const LocalEntities = require('../src/model/local-entities');

// A player whose sends are recorded, in a world whose "next tick" jobs we run
// by hand -- which is how the lost appearances happened.
function setUp() {
    const jobs = [];
    const sent = [];
    const player = {
        world: { nextTick: (fn) => jobs.push(fn) },
        send: (message) => sent.push(message)
    };
    const local = new LocalEntities(player);
    const runNextTick = () => jobs.splice(0).forEach((fn) => fn());
    return { local, sent, runNextTick };
}

test('an appearance pushed after a send goes out with the next one', () => {
    const { local, sent, runNextTick } = setUp();
    const updates = local.characterUpdates;

    updates.playerAppearances.push({ username: 'alice' });
    local.sendRegionPlayerUpdate();
    // The next tick: a login's appearance lands (broadcastPlayerAppearance
    // queues it with world.nextTick), alongside whatever the send scheduled.
    updates.playerAppearances.push({ username: 'bob' });
    runNextTick();
    local.sendRegionPlayerUpdate();

    assert.deepEqual(sent.map((m) => m.appearances.map((a) => a.username)), [['alice'], ['bob']]);
});

test('what was sent is not emptied afterwards, even if the send is encoded late', () => {
    const { local, sent, runNextTick } = setUp();
    local.characterUpdates.playerAppearances.push({ username: 'alice' });
    local.sendRegionPlayerUpdate();
    runNextTick();
    assert.deepEqual(sent[0].appearances, [{ username: 'alice' }]);
});

test('NPC chat and hits are not lost either', () => {
    const { local, sent, runNextTick } = setUp();
    local.characterUpdates.npcChat.push({ message: 'one' });
    local.sendRegionNPCUpdates();
    local.characterUpdates.npcHits.push({ damage: 3 });
    runNextTick();
    local.sendRegionNPCUpdates();
    assert.deepEqual(sent.map((m) => [m.chats.length, m.hits.length]), [[1, 0], [0, 1]]);
});
