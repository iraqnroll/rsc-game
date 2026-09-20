const SACK_CABBAGE = 1196;
const CABBAGE = 18;

async function onGameObjectCommandOne(player, gameObject) {
    if(gameObject.id !== SACK_CABBAGE) {
        return false;
    }

    player.message('You start rummaging through the sack');
    await player.world.sleepTicks(3);

    player.message('You find a cabbage');
    player.inventory.add(CABBAGE);

    return true;
}

module.exports = { onGameObjectCommandOne };