// The quest list: one place that says which quests exist, what they are
// called and whether they are members-only -- data/quests.json. The client
// used to carry its own copy of the names, in a fixed order the server had
// to match; now the server sends the list (protocol.js, questList) and the
// client draws whatever it is given. Add a quest here and it appears.
//
// `key` is what the quest's plugin reads and writes in player.questStages
// (a stage number; -1 is done), so it must not change once players have
// progress under it. `name` is shown as is.

const QUESTS = require('../data/quests.json');

// rsc-socket's BUFFER_SIZE, less room for the packet's own header.
const MAX_PACKET = 4990;

const NOT_STARTED = 0;
const IN_PROGRESS = 1;
const COMPLETE = 2;

// The client's font is printable ASCII, and the packet gives a name one byte
// of length.
function check(quests) {
    const seen = new Set();
    quests.forEach((q, i) => {
        if (!q || typeof q.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(q.key)) {
            throw new Error(`data/quests.json entry ${i}: key must be letters and digits`);
        }
        if (seen.has(q.key)) throw new Error(`data/quests.json: ${q.key} is listed twice`);
        seen.add(q.key);
        if (typeof q.name !== 'string' || !/^[\x20-\x7e]{1,80}$/.test(q.name)) {
            throw new Error(`data/quests.json ${q.key}: name must be 1 to 80 plain ASCII characters`);
        }
        if (typeof q.members !== 'boolean') throw new Error(`data/quests.json ${q.key}: members must be true or false`);
    });
    // The whole list is one packet, and rsc-socket builds packets in a
    // 5000-byte buffer: 2 bytes of count, then 3 + the name per quest.
    const size = 2 + quests.reduce((n, q) => n + 3 + q.name.length, 0);
    if (size > MAX_PACKET) {
        throw new Error(`data/quests.json: the quest list is ${size} bytes, over the ${MAX_PACKET} one packet can carry -- shorten names or split the list`);
    }
    return quests;
}

check(QUESTS);

const BY_KEY = new Map(QUESTS.map((q) => [q.key, q]));

function questState(stage) {
    if (stage === -1) return COMPLETE;
    if (typeof stage === 'number' && stage > 0) return IN_PROGRESS;
    return NOT_STARTED;
}

// What one player's quest list looks like, in the order it is shown.
function questListFor(questStages = {}, quests = QUESTS) {
    return quests.map((q) => ({ name: q.name, members: q.members, state: questState(questStages[q.key]) }));
}

// questStages that tell the player's client whenever a quest moves on.
// Quest plugins set stages directly (`player.questStages.cooksAssistant = 2`),
// so this is the one place that sees every change; several changes in one
// tick send one list.
function watchQuestStages(stages, onChange) {
    let pending = false;
    const changed = () => {
        if (pending) return;
        pending = true;
        process.nextTick(() => {
            pending = false;
            onChange();
        });
    };
    return new Proxy(stages || {}, {
        set(target, key, value) {
            const before = target[key];
            target[key] = value;
            if (before !== value) changed();
            return true;
        },
        deleteProperty(target, key) {
            const had = key in target;
            delete target[key];
            if (had) changed();
            return true;
        }
    });
}

module.exports = {
    QUESTS,
    BY_KEY,
    NOT_STARTED,
    IN_PROGRESS,
    COMPLETE,
    check,
    MAX_PACKET,
    questState,
    questListFor,
    watchQuestStages
};
