const BED_ID = 1199;
const GATE_KEY = 1292;
const QUEST_STAGE = 4;
const QUEST_COMPLETE = -1;

async function onGameObjectCommandTwo(player, gameObject) {
    if(gameObject.id !== BED_ID) {
        return false;
    }

    const { world } = player;

    player.message('@que@You start rummaging through the bed...');
    await world.sleepTicks(3);

    // -1 is the completed quest, which is still "past" the stage the key
    // belongs to -- comparing with >= alone would send a finished player down
    // the "Ivan is coming" branch.
    const questStage = player.questStages.groundskeepingTroubles;
    const searchable = questStage === QUEST_COMPLETE || questStage >= QUEST_STAGE;

    if (!searchable) {
        player.message("@que@...you hear Ivan's footsteps in the background...");
        player.message("@que@...you decide to stop the search to not get caught");
        return true;
    }

    if (player.inventory.has(GATE_KEY)) {
        player.message('@que@...there is nothing else under the bed');
        return true;
    }

    player.message('@que@...you find a brass key under the bed');
    player.inventory.add(GATE_KEY);

    return true;
}

module.exports = { onGameObjectCommandTwo };