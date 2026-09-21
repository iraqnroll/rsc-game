const Item = require('../../model/item');

const BUCKET_ID = 21;
// 1189 is the graveyard fountain, the only water in Bucktooth Ridge -- the
// gravestones of Groundskeeping Troubles need a bucket of it.
const SOURCE_IDS = new Set([26, 48, 86, 1130, 1189]);
const WELL_IDS = new Set([2, 466, 814]);

async function onUseWithGameObject(player, gameObject, item) {
    const refilledID = Item.getFullWater(item.id);

    // && binds tighter than ||, so the old single condition only bailed out
    // for a well used with something other than a bucket: every other object
    // in the game filled a bucket with water, including ones a quest wanted
    // to handle itself.
    const isSource = SOURCE_IDS.has(gameObject.id);
    const isWell = WELL_IDS.has(gameObject.id) && item.id === BUCKET_ID;

    if (typeof refilledID === 'undefined' || (!isSource && !isWell)) {
        return false;
    }

    const { world } = player;

    player.sendBubble(item.id);
    player.sendSound('filljug');
    await world.sleepTicks(2);

    player.inventory.remove(item.id);
    player.inventory.add(refilledID);

    player.message(
        `You fill the ${item.definition.name.toLowerCase()} from the ` +
            gameObject.definition.name.toLowerCase()
    );

    return true;
}

module.exports = { onUseWithGameObject };
