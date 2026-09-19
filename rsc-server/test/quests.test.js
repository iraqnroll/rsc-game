const test = require('node:test');
const assert = require('node:assert/strict');
const PacketBuffer = require('@2003scape/rsc-socket/src/packet-buffer');
const serverOpcodes = require('@2003scape/rsc-socket/src/opcodes/server.json');
const serverEncoders = require('@2003scape/rsc-socket/src/server/encoders');
const { QUEST_LIST } = require('../src/protocol');
const { QUESTS, check, questListFor, questState, watchQuestStages, COMPLETE, IN_PROGRESS, NOT_STARTED } = require('../src/quests');
// The 204 client's own handler for the message, from this repository.
const clientHandlers = require('../../rsc-client/src/packet-handlers/quest-list');
const clientOpcodes = require('../../rsc-client/src/opcodes/server.json');

// A list of our own, so these tests do not depend on what data/quests.json
// holds at the moment.
const SAMPLE = [
    { key: 'cooksAssistant', name: "Cook's assistant", members: false },
    { key: 'demonSlayer', name: 'Demon slayer', members: false },
    { key: 'legendsQuest', name: "Legend's Quest", members: true }
];

test('data/quests.json is a valid list', () => {
    assert.ok(QUESTS.length > 0);
    assert.doesNotThrow(() => check(QUESTS));
});

test('a stage is not started, started or done', () => {
    assert.equal(questState(undefined), NOT_STARTED);
    assert.equal(questState(0), NOT_STARTED);
    assert.equal(questState(3), IN_PROGRESS);
    assert.equal(questState(-1), COMPLETE);
    const list = questListFor({ cooksAssistant: -1, demonSlayer: 2 }, SAMPLE);
    assert.deepEqual(list.map((q) => q.state), [COMPLETE, IN_PROGRESS, NOT_STARTED]);
});

test('server and client agree on the message, names included', () => {
    assert.equal(serverOpcodes.questList, QUEST_LIST);
    assert.equal(clientOpcodes.QUEST_LIST, QUEST_LIST, 'rsc-client/src/opcodes/server.json uses the same number');

    const quests = questListFor({ cooksAssistant: -1, demonSlayer: 2, legendsQuest: 5 }, SAMPLE);
    const packet = new PacketBuffer(QUEST_LIST, Buffer.alloc(5000));
    serverEncoders.questList(packet, { quests });
    // What the client's handler is given: the opcode, then the body.
    const data = new Int8Array([QUEST_LIST, ...packet.buffer.slice(0, packet.offset)]);

    const client = {};
    clientHandlers[QUEST_LIST].call(client, data, data.length);
    assert.deepEqual(client.questList, quests);
    assert.equal(client.questList.at(-1).name, "Legend's Quest");
    assert.equal(client.questList.at(-1).members, true);
});

test('a quest that moves on resends the list once per tick', async () => {
    let sent = 0;
    const stages = watchQuestStages({ cooksAssistant: 1 }, () => sent++);
    stages.cooksAssistant = 2;
    stages.demonSlayer = 1;
    stages.cooksAssistant = 2; // no change
    await new Promise((r) => process.nextTick(r));
    assert.equal(sent, 1);
    assert.equal(JSON.stringify(stages), '{"cooksAssistant":2,"demonSlayer":1}', 'saves as before');
});

test('a bad quest list is refused with the reason', () => {
    assert.throws(() => check([{ key: 'a', name: 'A', members: false }, { key: 'a', name: 'B', members: false }]), /listed twice/);
    assert.throws(() => check([{ key: 'x', name: 'Café', members: false }]), /plain ASCII/);
    const many = Array.from({ length: 70 }, (_, i) => ({ key: `q${i}`, name: 'x'.repeat(80), members: false }));
    assert.throws(() => check(many), /over the \d+ one packet can carry/);
});
