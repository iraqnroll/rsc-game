const test = require('node:test');
const assert = require('node:assert/strict');
const Player = require('../src/model/player');
const { loadSkillLevels } = require('../src/skills');

// Stands in for Inventory and Bank, which serialize through toJSON.
class Inventory {
    constructor(items) {
        this.items = items;
    }

    toJSON() {
        return this.items.map(({ id }) => id);
    }
}

// A player one burn away from firemaking 2.
function makePlayer() {
    const sent = [];
    const saved = [];

    return {
        sent,
        saved,
        id: 7,
        rank: 0,
        x: 120,
        y: 640,
        questPoints: 0,
        combatStyle: 0,
        fatigue: 0,
        cameraAuto: true,
        oneMouseButton: false,
        soundOn: true,
        blockChat: 0,
        blockPrivateChat: 0,
        blockTrade: 0,
        blockDuel: 0,
        skulled: 0,
        friends: ['bob'],
        ignores: [],
        questStages: {},
        cache: {},
        inventory: new Inventory([{ id: 166 }]),
        bank: new Inventory([]),
        muteEndDate: 0,
        appearance: { hairColour: 1 },
        combatLevel: 3,
        skills: {
            firemaking: { current: 1, experience: 0, base: 1 },
            hits: { current: 10, experience: 4616, base: 10 }
        },
        world: {
            server: {
                config: { experienceRate: 1 },
                dataClient: {
                    sendAndReceive: async (message) => {
                        saved.push(message);
                        return {};
                    }
                }
            }
        },
        message: (...lines) => sent.push(...lines),
        sendStats: () => {},
        sendExperience: () => {},
        sendFatigue: () => {},
        sendSound: () => {},
        getCombatLevel: () => 3,
        broadcastPlayerAppearance: () => {}
    };
}

test('a save sends no base levels, and leaves the ones in memory alone', async () => {
    const player = makePlayer();

    await Player.prototype.save.call(player);

    const [message] = player.saved;

    assert.equal(message.handler, 'playerUpdate');
    assert.equal('base' in message.skills.firemaking, false);
    assert.equal(message.skills.firemaking.current, 1);
    assert.equal(message.skills.firemaking.experience, 0);

    assert.equal(player.skills.firemaking.base, 1, 'the live level survives');
    assert.equal(player.skills.hits.base, 10);

    assert.notEqual(
        message.skills.firemaking,
        player.skills.firemaking,
        'the saved skills are a copy, not the player own objects'
    );

    // Everything else has to reach the data server as it is: the arrays as
    // arrays, and the inventory and bank as something that can serialize.
    assert.deepEqual(message.friends, ['bob']);
    assert.equal(Array.isArray(message.friends), true);
    assert.equal(message.inventory, player.inventory);
    assert.equal(JSON.stringify(message.inventory), '[166]');
    assert.equal(message.hairColour, 1, 'the appearance is saved alongside');
});

test('levelling up after a save advances the level, it does not zero it', async () => {
    const player = makePlayer();

    await Player.prototype.save.call(player);

    // enough for firemaking 2 at the default rate
    Player.prototype.addExperience.call(player, 'firemaking', 400, false);

    assert.equal(player.skills.firemaking.base, 2);
    assert.equal(player.skills.firemaking.current, 2);
    assert.deepEqual(player.sent, ['@gre@You just advanced 1 firemaking level!']);
});

test('a skill saved without a current level comes back at its own level', () => {
    const skills = loadSkillLevels({
        firemaking: { current: null, experience: 400 },
        woodcutting: { current: NaN, experience: 0 },
        hits: { current: 7, experience: 4616 }
    });

    assert.deepEqual(skills.firemaking, {
        current: 2,
        experience: 400,
        base: 2
    });

    assert.equal(skills.woodcutting.current, 1);
    assert.equal(skills.hits.current, 7, 'a drained skill stays drained');
    assert.equal(skills.hits.base, 10);
});
