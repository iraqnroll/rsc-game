const Utility = require('../utility');
const serverOpcodes = require('../opcodes/server');

// The quest list with its names, from the server (rsc-server/src/protocol.js):
//   u16 count, then per quest: u8 state (0 not started, 1 started,
//   2 complete), u8 flags (bit 0: members), u8 name length, name bytes.
module.exports = {
    [serverOpcodes.QUEST_LIST]: function (data) {
        const count = Utility.getUnsignedShort(data, 1);
        const quests = [];
        let offset = 3;

        for (let i = 0; i < count; i++) {
            const state = data[offset++] & 0xff;
            const flags = data[offset++] & 0xff;
            const length = data[offset++] & 0xff;
            let name = '';

            for (let j = 0; j < length; j++) {
                name += String.fromCharCode(data[offset++] & 0xff);
            }

            quests.push({ name, members: (flags & 1) === 1, state });
        }

        this.questList = quests;
    }
};
