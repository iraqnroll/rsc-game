// Argument types for :: commands.
//
// The client sends the line split on spaces, so a name with spaces is typed
// with underscores (`::give bob abyssal_whip`, `::teleport lumbridge`), and
// anything numeric is taken as an id. Every type returns
// `{ value }` or `{ error }`; the error names what was wrong and, where it
// helps, how to look the right value up.

const items = require('@2003scape/rsc-data/config/items');
const npcs = require('@2003scape/rsc-data/config/npcs');
const objects = require('@2003scape/rsc-data/config/objects');
const regions = require('@2003scape/rsc-data/regions');
const shops = require('@2003scape/rsc-data/shops');
const skillNames = require('@2003scape/rsc-data/skill-names');
const { QUESTS } = require('../quests');

const quests = QUESTS.map((q) => q.key);

const ENTITY_LISTS = ['players', 'npcs', 'gameObjects', 'wallObjects', 'groundItems'];

// "bronze_arrows" and "Bronze Arrows" are the same name.
const normalise = (text) => String(text).replace(/_/g, ' ').trim().toLowerCase();

function integer(raw, name) {
    if (raw === undefined || !/^-?\d+$/.test(raw)) {
        return { error: `${name} must be a whole number` };
    }
    return { value: Number(raw) };
}

// An id, or an exact name; the first match wins for names that repeat.
function byIdOrName(list, raw, what, findKind) {
    if (/^\d+$/.test(raw)) {
        const id = Number(raw);
        return list[id]
            ? { value: id }
            : { error: `no ${what} with id ${id} (0 to ${list.length - 1})` };
    }
    const wanted = normalise(raw);
    const id = list.findIndex((entry) => entry && normalise(entry.name) === wanted);
    return id >= 0
        ? { value: id }
        : { error: `no ${what} called "${wanted}" -- try ::find ${findKind} ${raw}` };
}

// Loose matches for ::find: every name containing the text, as [id, name].
function search(list, text) {
    const wanted = normalise(text);
    const out = [];
    list.forEach((entry, id) => {
        const name = typeof entry === 'string' ? entry : entry && entry.name;
        if (name && normalise(name).includes(wanted)) out.push([id, name]);
    });
    return out;
}

const TYPES = {
    int: (raw, name) => integer(raw, name),

    text: (raw, name) => (raw ? { value: raw } : { error: `${name} is missing` }),

    player: (raw, name, { world }) => {
        if (!raw) return { error: `${name} is missing` };
        const other = world.getPlayerByUsername(normalise(raw));
        return other ? { value: other } : { error: `${normalise(raw)} is not online` };
    },

    item: (raw) => (raw ? byIdOrName(items, raw, 'item', 'item') : { error: 'item is missing' }),

    npc: (raw) => (raw ? byIdOrName(npcs, raw, 'NPC', 'npc') : { error: 'npc is missing' }),

    skill: (raw) => {
        const skill = normalise(raw || '');
        return skillNames.includes(skill)
            ? { value: skill }
            : { error: `skill must be one of: ${skillNames.join(', ')}` };
    },

    quest: (raw) => {
        if (!raw) return { error: 'quest is missing' };
        if (/^\d+$/.test(raw)) {
            const id = Number(raw);
            return quests[id] !== undefined
                ? { value: quests[id] }
                : { error: `no quest ${id} (0 to ${quests.length - 1})` };
        }
        // Quest keys are camelCase ("cooksAssistant"); accept "cooks_assistant" too.
        const wanted = normalise(raw).replace(/[^a-z0-9]/g, '');
        const key = quests.find((q) => q.toLowerCase() === wanted);
        return key ? { value: key } : { error: `no quest "${raw}" -- try ::find quest ${raw}` };
    },

    region: (raw) => {
        const key = normalise(raw || '').replace(/ /g, '-');
        return regions[key]
            ? { value: key }
            : { error: `no region "${raw}" -- try ::find region ${raw || ''}`.trim() };
    },

    shop: (raw) => {
        const key = normalise(raw || '').replace(/ /g, '-');
        return shops[key] ? { value: key } : { error: `no shop "${raw}" -- try ::find shop ${raw || ''}`.trim() };
    },

    entityList: (raw) =>
        ENTITY_LISTS.includes(raw)
            ? { value: raw }
            : { error: `list must be one of: ${ENTITY_LISTS.join(', ')}` },

    json: (raw) => {
        try {
            return { value: JSON.parse(raw) };
        } catch (e) {
            return { error: `not valid JSON: ${e.message}` };
        }
    }
};

// What ::find can look through, and how to read each list.
const FINDABLE = {
    item: () => items,
    npc: () => npcs,
    object: () => objects,
    quest: () => QUESTS.map((q) => `${q.name} -- ${q.key}`),
    region: () => Object.keys(regions),
    shop: () => Object.keys(shops)
};

module.exports = { TYPES, FINDABLE, search, normalise };
