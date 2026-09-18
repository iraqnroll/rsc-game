// :: commands: one table of what each command takes, who may use it and what
// it does, so the game can check arguments and explain itself (::help).
//
// Each entry:
//   rank     lowest rank allowed (src/ranks.js)
//   args     [{ name, type, optional, rest }] -- types in ./args.js; `rest`
//            takes the remainder of the line
//   help     one line, shown by ::help <name>
//   example  what a real invocation looks like
//   run      (player, values) => ...; values in the order of `args`
//
// A player without the rank gets the same answer as for a command that does
// not exist, so ::help reveals nothing to someone who cannot use it.

const NPC = require('../model/npc');
const items = require('@2003scape/rsc-data/config/items');
const regions = require('@2003scape/rsc-data/regions');
const { MODERATOR, ADMINISTRATOR, rankName } = require('../ranks');
const { TYPES, FINDABLE, search } = require('./args');

const MAX_FIND = 8;

const COMMANDS = {
    /* ------------------------------------------------------------ everyone -- */

    help: {
        rank: MODERATOR,
        group: 'help',
        args: [{ name: 'command', type: 'text', optional: true }],
        help: 'list the commands you can use, or explain one',
        example: '::help give',
        run(player, [name]) {
            if (name) {
                const cmd = COMMANDS[name.replace(/^::/, '').toLowerCase()];
                if (!cmd || player.rank < cmd.rank) {
                    player.message(`@red@No command ::${name}`);
                    return;
                }
                const key = name.replace(/^::/, '').toLowerCase();
                player.message(`@yel@${usage(key, cmd)}`);
                player.message(`@whi@${cmd.help}`);
                if (cmd.example) player.message(`@whi@e.g. ${cmd.example}`);
                return;
            }
            player.message(`@yel@Commands for your rank (${rankName(player.rank)}):`);
            for (const group of GROUPS) {
                const names = Object.keys(COMMANDS).filter(
                    (key) => COMMANDS[key].group === group && player.rank >= COMMANDS[key].rank
                );
                if (names.length > 0) player.message(`@whi@${group}: ${names.join(' ')}`);
            }
            player.message('@whi@::help <command> for its arguments');
        }
    },

    find: {
        rank: MODERATOR,
        group: 'help',
        args: [
            { name: 'kind', type: 'text' },
            { name: 'text', type: 'text', rest: true }
        ],
        help: `look up ids by name; kind is ${Object.keys(FINDABLE).join(', ')}`,
        example: '::find item rune scimitar',
        run(player, [kind, text]) {
            const list = FINDABLE[kind.toLowerCase()];
            if (!list) {
                player.message(`@red@kind must be one of: ${Object.keys(FINDABLE).join(', ')}`);
                return;
            }
            const found = search(list(), text);
            if (found.length === 0) {
                player.message(`@red@no ${kind} matching "${text}"`);
                return;
            }
            for (const [id, name] of found.slice(0, MAX_FIND)) {
                player.message(`@whi@${id}: ${name}`);
            }
            if (found.length > MAX_FIND) {
                player.message(`@yel@...and ${found.length - MAX_FIND} more; be more specific`);
            }
        }
    },

    /* ----------------------------------------------------------- moderator -- */

    coords: {
        rank: MODERATOR,
        group: 'moderator',
        args: [],
        help: 'where you are standing, and which way you face',
        run(player) {
            player.message(`${player.x}, ${player.y}, facing=${player.direction}`);
        }
    },

    kick: {
        rank: MODERATOR,
        group: 'moderator',
        args: [{ name: 'player', type: 'player' }],
        help: 'save a player and log them out',
        example: '::kick some_player',
        async run(player, [other]) {
            await other.logout();
            player.message(`kicked ${other.username}`);
        }
    },

    goto: {
        rank: MODERATOR,
        group: 'moderator',
        args: [{ name: 'player', type: 'player' }],
        help: 'teleport to a player',
        example: '::goto some_player',
        run(player, [other]) {
            player.teleport(other.x, other.y, true);
        }
    },

    teleport: {
        rank: MODERATOR,
        group: 'moderator',
        args: [
            { name: 'x|region', type: 'text' },
            { name: 'y', type: 'int', optional: true }
        ],
        help: 'teleport to coordinates, or to a region by name (::find region)',
        example: '::teleport 120 648  or  ::teleport lumbridge',
        run(player, [where, y]) {
            if (/^\d+$/.test(where)) {
                if (y === undefined) {
                    player.message('@red@give both x and y, or a region name');
                    return;
                }
                player.teleport(Number(where), y, true);
                return;
            }
            const region = TYPES.region(where);
            if (region.error) {
                player.message(`@red@${region.error}`);
                return;
            }
            const { spawnX, spawnY } = regions[region.value];
            player.teleport(spawnX, spawnY, true);
        }
    },

    /* ------------------------------------------------------- administrator -- */

    give: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [
            { name: 'player', type: 'player' },
            { name: 'item', type: 'item' },
            { name: 'amount', type: 'int', optional: true }
        ],
        help: 'put an item in a player\'s inventory; item is an id or a name',
        example: '::give some_player coins 1000',
        run(player, [other, id, amount = 1]) {
            other.inventory.add(id, amount);
            other.message(`${player.username} gave you ${amount} x ${items[id].name}`);
            player.message(`gave ${other.username} ${amount} x ${items[id].name}`);
        }
    },

    item: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [
            { name: 'item', type: 'item' },
            { name: 'amount', type: 'int', optional: true }
        ],
        help: 'put an item in your own inventory',
        example: '::item bronze_short_sword  or  ::item 10 500',
        run(player, [id, amount = 1]) {
            player.inventory.add(id, amount);
        }
    },

    npc: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [{ name: 'npc', type: 'npc' }],
        help: 'spawn an NPC on your tile; it wanders 4 tiles and never respawns',
        example: '::npc chicken',
        run(player, [id]) {
            const { world } = player;
            const npc = new NPC(world, {
                id,
                x: player.x,
                y: player.y,
                minX: player.x - 4,
                maxX: player.x + 4,
                minY: player.y - 4,
                maxY: player.y + 4
            });
            delete npc.respawn;
            world.addEntity('npcs', npc);
        }
    },

    addexp: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [
            { name: 'skill', type: 'skill' },
            { name: 'experience', type: 'int' }
        ],
        help: 'give yourself experience in a skill, no fatigue',
        example: '::addexp woodcutting 5000',
        run(player, [skill, experience]) {
            // The server counts experience in quarter points.
            player.addExperience(skill, experience * 4, false);
        }
    },

    setqp: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [{ name: 'points', type: 'int' }],
        help: 'set your quest points',
        example: '::setqp 20',
        run(player, [points]) {
            player.questPoints = points;
        }
    },

    setquest: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [
            { name: 'quest', type: 'quest' },
            { name: 'stage', type: 'int' }
        ],
        help: 'set your stage in a quest; -1 is complete, 0 not started',
        example: '::setquest cooks_assistant -1',
        run(player, [quest, stage]) {
            player.questStages[quest] = stage;
        }
    },

    shop: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [{ name: 'shop', type: 'shop' }],
        help: 'open a shop by name (::find shop)',
        example: '::shop varrock-general',
        run(player, [shop]) {
            player.openShop(shop);
        }
    },

    bank: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [],
        help: 'open your bank anywhere',
        run(player) {
            player.bank.open();
        }
    },

    clearinventory: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [],
        help: 'empty your inventory',
        run(player) {
            player.inventory.items = [];
            player.inventory.sendAll();
        }
    },

    appearance: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [],
        help: 'open the character design screen',
        run(player) {
            player.sendAppearance();
        }
    },

    fatigue: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [],
        help: 'set your fatigue to half',
        run(player) {
            player.fatigue = 75000;
            player.sendFatigue();
        }
    },

    dmg: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [{ name: 'amount', type: 'int' }],
        help: 'damage yourself',
        example: '::dmg 5',
        run(player, [amount]) {
            player.damage(amount);
        }
    },

    droprandom: {
        rank: ADMINISTRATOR,
        group: 'administrator',
        args: [{ name: 'count', type: 'int' }],
        help: 'drop that many random free-to-play items around you',
        example: '::droprandom 10',
        run(player, [count]) {
            const { world } = player;
            for (let i = 0; i < count; i += 1) {
                const randomID = Math.floor(Math.random() * items.length);
                const item = items[randomID];
                if (!item || item.members) continue;
                if (item.stackable) {
                    world.addPlayerDrop(player, { id: randomID, amount: Math.floor(Math.random() * 10000) });
                } else {
                    world.addPlayerDrop(player, { id: randomID });
                }
            }
        }
    },

    /* --------------------------------------------------------------- debug -- */

    step: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [
            { name: 'dx', type: 'int' },
            { name: 'dy', type: 'int' }
        ],
        help: 'walk one step by (dx, dy) and say whether it was allowed',
        example: '::step 1 0',
        run(player, [dx, dy]) {
            player.message(player.canWalk(dx, dy).toString());
            player.walkTo(dx, dy);
        }
    },

    face: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [
            { name: 'dx', type: 'int' },
            { name: 'dy', type: 'int' }
        ],
        help: 'turn towards (dx, dy)',
        example: '::face 0 1',
        run(player, [dx, dy]) {
            player.faceDirection(dx, dy);
        }
    },

    sound: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [{ name: 'name', type: 'text' }],
        help: 'play a sound effect by name',
        example: '::sound opendoor',
        run(player, [name]) {
            player.sendSound(name);
        }
    },

    bubble: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [{ name: 'item', type: 'item' }],
        help: 'show an item in a thought bubble over your head',
        example: '::bubble 10',
        run(player, [id]) {
            player.sendBubble(id);
        }
    },

    say: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [{ name: 'lines', type: 'text', rest: true }],
        help: 'say something as dialogue',
        example: '::say hello there',
        async run(player, [text]) {
            await player.say(text);
        }
    },

    ask: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [],
        help: 'test the dialogue choice menu',
        async run(player) {
            const choice = await player.ask(['hey?', 'sup?', 'more', 'test', 'again'], true);
            player.message(`you chose ${choice}`);
        }
    },

    clearentities: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [],
        help: 'forget every entity your client knows about, so they are resent',
        run(player) {
            player.localEntities.clear();
        }
    },

    gotoentity: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [
            { name: 'list', type: 'entityList' },
            { name: 'index', type: 'int' }
        ],
        help: 'teleport to an entity by its server index',
        example: '::gotoentity npcs 12',
        run(player, [list, index]) {
            const entity = player.world[list].getByID(index);
            if (!entity) {
                player.message(`@red@no ${list} with index ${index}`);
                return;
            }
            player.teleport(entity.x, entity.y, true);
        }
    },

    chaseobj: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [{ name: 'index', type: 'int' }],
        help: 'walk to a game object by its server index',
        example: '::chaseobj 3',
        async run(player, [index]) {
            const object = player.world.gameObjects.getByID(index);
            if (!object) {
                player.message(`@red@no game object with index ${index}`);
                return;
            }
            await player.chase(object, false);
        }
    },

    npcchase: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [{ name: 'npc', type: 'npc' }],
        help: 'make the nearest NPC of this type you can see attack you',
        example: '::npcchase goblin',
        async run(player, [id]) {
            const npc = Array.from(player.localEntities.known.npcs).find((n) => n.id === id);
            if (!npc) {
                player.message('@red@no NPC of that type in view');
                return;
            }
            await npc.attack(player);
        }
    },

    npccoords: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [
            { name: 'x', type: 'int' },
            { name: 'y', type: 'int' }
        ],
        help: 'how many NPCs stand on a tile',
        example: '::npccoords 120 648',
        run(player, [x, y]) {
            player.message(player.world.npcs.getAtPoint(x, y).length);
        }
    },

    setcache: {
        rank: ADMINISTRATOR,
        group: 'debug',
        args: [
            { name: 'key', type: 'text' },
            { name: 'json', type: 'json', rest: true }
        ],
        help: 'set a value in your quest/plugin state cache',
        example: '::setcache talkedToHans true',
        run(player, [key, value]) {
            player.cache[key] = value;
        }
    }
};

const GROUPS = ['help', 'moderator', 'administrator', 'debug'];

function usage(name, cmd) {
    const parts = cmd.args.map((a) => (a.optional ? `[${a.name}]` : `<${a.name}>`));
    return ['::' + name, ...parts].join(' ');
}

// words -> the values `run` takes, or the first problem.
function parseArgs(cmd, words, player) {
    const values = [];
    for (let i = 0; i < cmd.args.length; i += 1) {
        const spec = cmd.args[i];
        const raw = spec.rest ? (words.slice(i).join(' ') || undefined) : words[i];
        if (raw === undefined && spec.optional) {
            values.push(undefined);
            continue;
        }
        const type = TYPES[spec.type];
        const parsed = type(raw, spec.name, player);
        if (parsed.error) return { error: parsed.error };
        values.push(parsed.value);
    }
    return { values };
}

async function runCommand(player, name, words) {
    const key = String(name || '').toLowerCase();
    const cmd = Object.prototype.hasOwnProperty.call(COMMANDS, key) ? COMMANDS[key] : null;

    // Players below the rank see what a nonexistent command gets.
    if (!cmd || !(player.rank >= cmd.rank)) {
        if (player.rank >= MODERATOR) player.message(`@red@No command ::${name} -- ::help lists them`);
        return { ran: false, reason: cmd ? 'rank' : 'unknown' };
    }

    const parsed = parseArgs(cmd, words.filter((w) => w !== ''), player);
    if (parsed.error) {
        player.message(`@red@${parsed.error}`);
        player.message(`@yel@usage: ${usage(key, cmd)}`);
        return { ran: false, reason: 'arguments' };
    }

    try {
        await cmd.run(player, parsed.values);
        return { ran: true };
    } catch (e) {
        player.message(`@red@::${key} failed: ${e.message}`);
        return { ran: false, reason: 'error', error: e };
    }
}

module.exports = { COMMANDS, runCommand, usage, parseArgs };
