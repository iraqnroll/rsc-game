const FUNNY_WALL = 214;

// RSC Editor shows world tiles, which count sectors from 0. Game coordinates
// drop the unpopulated regions and stack planes 944 apart:
//   x = wx - 2304,  y = wy - 1776 + plane * 944
// Editor world tile 2424, 2419 on plane 0:
const DESTINATION_X = 120;
const DESTINATION_Y = 643;

async function onWallObjectCommandTwo(player, wallObject) {
    if (wallObject.id !== FUNNY_WALL) {
        return false;
    }

    const { world } = player;

    player.message('@que@You push against the wall...');
    await world.sleepTicks(1);

    player.teleport(DESTINATION_X, DESTINATION_Y);
    // teleport only moves the player two ticks later, and unlocks them there.
    await world.sleepTicks(2);

    player.message('@que@...and the wall swings shut behind you');

    return true;
}

module.exports = { onWallObjectCommandTwo };
