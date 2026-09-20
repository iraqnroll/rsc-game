const BUCKET_OF_WATER = 50;
const EMPTY_BUCKET = 21;
const GRAVESTONES = new Set([12, 13, 213]);

async function onUseWithGameObject(player, gameObject, item) {
    if (!GRAVESTONES.has(gameObject.id) || item.id !== BUCKET_OF_WATER) {
        return false;
    }

    const { world } = player;

    player.message("@que@You wash the gravestone with water and begin to scrub it");
    player.sendBubble(BUCKET_OF_WATER);

    await world.sleepTicks(10);

    player.inventory.remove(BUCKET_OF_WATER);
    player.inventory.add(EMPTY_BUCKET);

    // The cache starts out empty, so the first scrub has nothing to add to.
    player.cache.cleanedGravestones = (player.cache.cleanedGravestones || 0) + 1;

    return true;
}

module.exports = { onUseWithGameObject };