const SACK_POTATER = 1197;
const POTATO = 348;

async function onGameObjectCommandOne(player, gameObject) {
    if(gameObject.id !== SACK_POTATER) {
        return false;
    }

    player.message('You start rummaging through the sack');
    await player.world.sleepTicks(3);

    player.message('You find a potato');
    player.inventory.add(POTATO);

    return true;
}

module.exports = { onGameObjectCommandOne };
