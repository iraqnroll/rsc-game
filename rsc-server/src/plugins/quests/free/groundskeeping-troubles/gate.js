const GATE_ID = 1198;
const GATE_KEY = 1292;

const QUEST_STAGE_FINAL = 4;
const QUEST_COMPLETE = -1;

const DESTINATION_X = 113;
const DESTINATION_Y = 649;

/**
 * The tile on the other side of the gate from where the player is standing.
 *
 * The gate's object type blocks, so there is no walking through it -- going
 * through is a teleport past it. Working that out from the gate's own position
 * rather than hardcoding a pair of tiles is what makes one handler serve both
 * directions: step one tile further along whichever axis the player approached
 * on. Math.sign is 0 when they line up with the gate on that axis, which is
 * exactly the "straight through" case.
 */
function farSideOf(player, gate) {
    return {
        x: gate.x + Math.sign(gate.x - player.x),
        y: gate.y + Math.sign(gate.y - player.y)
    };
}

async function onGameObjectCommandTwo(player, gameObject) {
    if (gameObject.id !== GATE_ID) {
        return false;
    }

    const { world } = player;

    // Before the quest is done the key is the only way through, so this falls
    // back to the locked message rather than to "nothing interesting happens".
    if (player.questStages.groundskeepingTroubles !== QUEST_COMPLETE) {
        player.message('@que@The gate is locked');
        return true;
    }

    const { x, y } = farSideOf(player, gameObject);

    player.message('@que@You swing the gate open...');
    player.sendSound('opendoor');
    await world.sleepTicks(1);

    player.teleport(x, y);
    // teleport only moves the player two ticks later, and unlocks them there.
    await world.sleepTicks(2);

    player.message('@que@...and pull it shut behind you');
    player.sendSound('closedoor');

    return true;
}

async function onUseWithGameObject(player, gameObject, item) {
    if (gameObject.id !== GATE_ID || item.id !== GATE_KEY) {
        return false;
    }

    const { world } = player;

    player.message("@que@You attempt to unlock the gate...");
    await world.sleepTicks(2);

    player.message("@que@You can hear a loud click in the gate lock");
    player.teleport(DESTINATION_X, DESTINATION_Y);

    if (player.questStages.groundskeepingTroubles === QUEST_STAGE_FINAL) {
        player.message(
                '@que@Well done you have completed the Groundskeeping Troubles Quest!'
            );

        player.questStages.groundskeepingTroubles = QUEST_COMPLETE;
        player.addQuestPoints(1);
        player.message('@gre@You haved gained 1 quest points!');

        player.addExperience(
            'woodcutting',
            player.skills.woodcutting.base * 60 + 500,
            false
        );
    }

    return true;
}

module.exports = { onGameObjectCommandTwo, onUseWithGameObject };