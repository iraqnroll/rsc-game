const BUCKET_OF_SALT = 1290;
const EMPTY_BUCKET = 21;
const SACKS_OF_SALT = 1194;

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== SACKS_OF_SALT || item.id !== EMPTY_BUCKET) {
        return false;
    }

    const { world } = player;

    player.message("@que@You fill the bucket with salt");
    player.sendBubble(EMPTY_BUCKET);

    await world.sleepTicks(3);

    player.inventory.remove(EMPTY_BUCKET);
    player.inventory.add(BUCKET_OF_SALT);

    return true;
}

module.exports = { onUseWithGameObject };
