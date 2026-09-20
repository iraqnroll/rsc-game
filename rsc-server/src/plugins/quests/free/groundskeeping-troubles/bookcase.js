const BOOKCASE = 1195;
const DESTINATION_X = 118;
const DESTINATION_Y = 643;

async function onGameObjectCommandTwo(player, gameObject) {
    if(gameObject.id !== BOOKCASE) {
        return false;
    }

    const { world } = player;

    player.message('@que@You notice that the bookcase hides a entrance to the backyard');
    player.message('@que@You squeeze past the bookcase...');

    await world.sleepTicks(1);

    player.teleport(DESTINATION_X, DESTINATION_Y);
    // teleport only moves the player two ticks later, and unlocks them there.
    await world.sleepTicks(2);

    player.message('@que@...and step out into the backyard');

    return true;
}

module.exports = { onGameObjectCommandTwo };