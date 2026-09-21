// The logs the evil trees leave behind. The firemaking skill only knows plain
// logs, so lighting these is handled here -- the same way, but every burn
// counts towards the first errand.

const GameObject = require('../../../../model/game-object');
const GroundItem = require('../../../../model/ground-item');
const { rollSkillSuccess } = require('../../../../rolls');
const { EVIL_LOGS } = require('./dead-tree');

const ASHES_ID = 181;
const FIRE_ID = 97;
const TINDERBOX_ID = 166;

// same odds as plain logs: 25% at level 1, 100% at level 60
const ROLL = [64, 392];

async function onUseWithGroundItem(player, groundItem, item) {
    if (groundItem.id !== EVIL_LOGS || item.id !== TINDERBOX_ID) {
        return false;
    }

    const { world } = player;
    const { x, y } = groundItem;

    const indoors = !!world.landscape.getTileAtGameCoords(x, y).getTileDef()
        .indoors;

    if (indoors || world.gameObjects.getAtPoint(x, y).length) {
        player.message("@que@You can't light a fire here");
        return true;
    }

    player.sendBubble(TINDERBOX_ID);
    player.message('@que@You attempt to light the logs');
    await world.sleepTicks(2);

    // Someone else may have picked them up or lit them in the meantime.
    if (!world.groundItems.getAtPoint(x, y).includes(groundItem)) {
        return true;
    }

    const level = player.skills.firemaking.current;

    if (!rollSkillSuccess(ROLL[0], ROLL[1], level)) {
        player.message('@que@You fail to light a fire');
        return true;
    }

    player.message('@que@The logs hiss and writhe as they catch fire');
    world.removeEntity('groundItems', groundItem);

    const fire = new GameObject(world, { id: FIRE_ID, x, y, direction: 0 });

    world.setTimeout(() => {
        world.removeEntity('gameObjects', fire);
        const ashes = new GroundItem(world, { id: ASHES_ID, x, y });
        world.addEntity('groundItems', ashes);
    }, (Math.floor(Math.random() * 60) + 60) * 1000);

    world.addEntity('gameObjects', fire);
    player.addExperience('firemaking', 100 + level * 7);

    // The logs don't say which tree they came from, so Ivan goes by count.
    player.cache.evilLogsBurned = (player.cache.evilLogsBurned || 0) + 1;

    return true;
}

async function onUseWithInventory(player, item, targetItem) {
    if (
        !(item.id === EVIL_LOGS && targetItem.id === TINDERBOX_ID) &&
        !(item.id === TINDERBOX_ID && targetItem.id === EVIL_LOGS)
    ) {
        return false;
    }

    player.message(
        '@que@I think you should put the logs down before you light them!'
    );

    return true;
}

module.exports = { onUseWithGroundItem, onUseWithInventory };
