// Server messages this game adds to the 204 protocol, registered into
// rsc-socket's own tables at startup -- its opcode map and encoders are
// plain objects shared by every socket, so nothing in node_modules is
// patched. Each opcode must be one the 204 client does not use; the client
// side is rsc-client/src/packet-handlers/quest-list.js and
// rsc-client/src/opcodes/server.json.

const serverOpcodes = require('@2003scape/rsc-socket/src/opcodes/server.json');
const serverEncoders = require('@2003scape/rsc-socket/src/server/encoders');

function register(type, opcode, encode) {
    for (const [name, id] of Object.entries(serverOpcodes)) {
        if (id === opcode && name !== type) {
            throw new Error(`opcode ${opcode} is already ${name}`);
        }
    }
    serverOpcodes[type] = opcode;
    serverEncoders[type] = encode;
}

// The quest list, names included (src/quests.js). Replaces playerQuestList
// (opcode 5), which sent only a completed flag per quest, in an order the
// client had hard-coded.
//   u16 count, then per quest: u8 state (0 not started, 1 started,
//   2 complete), u8 flags (bit 0: members), u8 name length, name bytes.
const QUEST_LIST = 250;

register('questList', QUEST_LIST, (packet, { quests }) => {
    packet.writeShort(quests.length);
    for (const quest of quests) {
        packet.writeByte(quest.state);
        packet.writeByte(quest.members ? 1 : 0);
        packet.writeByte(quest.name.length);
        packet.writeString(quest.name);
    }
});

module.exports = { register, QUEST_LIST };
