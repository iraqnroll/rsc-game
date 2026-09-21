// Ivan's soup: the one thing in the quest the player makes rather than fetches.
//
// Everything is gathered by hand -- shrimp from the pond, vegetables from the
// backyard sacks, a bowl filled at the graveyard fountain -- and then cooked on
// a range, which is where the errand is actually finished. The stock cooking
// plugin only looks at items in its own `uncooked` table, so using a bowl of
// water on a range falls through to this without either handler fighting the
// other.
//
// The soup is this world's own definition (RSC Editor), item 1294.

const BOWL_ID = 341;
const BOWL_OF_WATER_ID = 342;
const SHRIMP_SOUP_ID = 1294;

const RAW_SHRIMP_ID = 349;
const SHRIMP_REQUIRED = 3;
const POTATO_ID = 348;
const POTATO_REQUIRED = 3;
const CABBAGE_ID = 18;
const CABBAGE_REQUIRED = 3;

// A fire will not do: a bowl of soup wants a range, which is also the excuse to
// send the player back indoors past Ivan.
const RANGE_IDS = new Set([11, 491, 119]);

const QUEST_STAGE_ERRAND4 = 4;

/** What the player is still short of, in the order Ivan lists them. */
function missing(inventory) {
    const short = [];

    if (!inventory.has(POTATO_ID, POTATO_REQUIRED)) {
        short.push(`${POTATO_REQUIRED} potatoes`);
    }

    if (!inventory.has(CABBAGE_ID, CABBAGE_REQUIRED)) {
        short.push(`${CABBAGE_REQUIRED} cabbages`);
    }

    if (!inventory.has(RAW_SHRIMP_ID, SHRIMP_REQUIRED)) {
        short.push(`${SHRIMP_REQUIRED} shrimp`);
    }

    return short;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (item.id !== BOWL_OF_WATER_ID || !RANGE_IDS.has(gameObject.id)) {
        return false;
    }

    // Outside the errand this is just a bowl of water and a range, which the
    // rest of the game is welcome to answer for.
    if (player.questStages.groundskeepingTroubles !== QUEST_STAGE_ERRAND4) {
        return false;
    }

    const { inventory, world } = player;
    const short = missing(inventory);

    if (short.length) {
        player.message(`@que@You still need ${short.join(', ')}`);
        return true;
    }

    player.message('@que@You tip the vegetables and the shrimp into the bowl...');
    player.sendBubble(BOWL_OF_WATER_ID);
    await world.sleepTicks(3);

    inventory.remove(POTATO_ID, POTATO_REQUIRED);
    inventory.remove(CABBAGE_ID, CABBAGE_REQUIRED);
    inventory.remove(RAW_SHRIMP_ID, SHRIMP_REQUIRED);
    inventory.remove(BOWL_OF_WATER_ID);
    inventory.add(SHRIMP_SOUP_ID);

    player.message('@que@...and leave it on the range until it smells like supper');
    player.message('@que@You make a bowl of shrimp soup');

    return true;
}

// An empty bowl on the fountain is handled by the stock water sources; this is
// only here to say something useful when someone tries the pond instead.
module.exports = { onUseWithGameObject, BOWL_ID, SHRIMP_SOUP_ID, SHRIMP_REQUIRED };
