const NPC = require('../../../../model/npc');

const BUCKET_OF_WATER = 50;
const EMPTY_BUCKET = 21;
const GRAVESTONES = new Set([12, 13, 213]);
const GHOST_ID = 794;
const NOTE_ID = 1291;

// Ivan's count; ivan.js takes it from here so the two cannot drift.
const GRAVESTONES_CLEANED_REQUIRED = 5;

const QUEST_STAGE_ERRAND2 = 2;
const QUEST_STAGE_FINAL = 5;
const QUEST_COMPLETE = -1;

// how far the ghost wanders from the grave it rose out of
const GHOST_RANGE = 4;
// ticks (~5 minutes) until an unbeaten ghost sinks back into its grave
const GHOST_TICKS = 470;
// a ghost mid-fight when its time is up gets this much longer, again and again
const GHOST_FIGHT_TICKS = 16;
// the note turns up on one of the first this-many ghosts the player puts down
const MAX_GHOSTS_FOR_NOTE = 3;

// Ivan's "cleaning kit" is for these. Keyed by ghost, so a ghost knows who
// disturbed it and a player has at most one after them at a time.
const ghostOwners = new Map();

// The graves a player has scrubbed, kept as "x,y" in their cache. A plain
// count let them scrub one gravestone five times over and call the errand
// done, so the places are what is remembered now.
function gravestoneKey(gameObject) {
    return `${gameObject.x},${gameObject.y}`;
}

function cleanedGravestones(player) {
    const cleaned = player.cache.cleanedGravestones;

    if (Array.isArray(cleaned)) {
        return cleaned;
    }

    // A save from when this was a count. Their progress stands, but which
    // graves it was is lost, so those are stand-ins for graves not named.
    if (typeof cleaned === 'number' && cleaned > 0) {
        player.cache.cleanedGravestones = Array.from(
            { length: cleaned },
            (_, i) => `scrubbed-${i}`
        );
    } else {
        player.cache.cleanedGravestones = [];
    }

    return player.cache.cleanedGravestones;
}

function cleanedGravestoneCount(player) {
    return cleanedGravestones(player).length;
}

function forgetCleanedGravestones(player) {
    delete player.cache.cleanedGravestones;
}

function hasGhost(player) {
    for (const ownerID of ghostOwners.values()) {
        if (ownerID === player.id) {
            return true;
        }
    }

    return false;
}

// Ghosts only rise for someone who has been sent to scrub the gravestones and
// doesn't have the note yet. Past the errand they keep rising until it turns
// up, so a player who lost or never got the note is not stuck.
function disturbsGhosts(player) {
    const stage = player.questStages.groundskeepingTroubles;

    // Out of the graveyard for good: the dead can rest.
    if (stage === QUEST_COMPLETE) {
        return false;
    }

    return (
        stage >= QUEST_STAGE_ERRAND2 &&
        stage <= QUEST_STAGE_FINAL &&
        !player.inventory.has(NOTE_ID) &&
        !hasGhost(player)
    );
}

async function raiseGhost(player, gravestone) {
    const { world } = player;
    const { x, y } = gravestone;

    const ghost = new NPC(world, {
        id: GHOST_ID,
        x: player.x,
        y: player.y,
        minX: x - GHOST_RANGE,
        maxX: x + GHOST_RANGE,
        minY: y - GHOST_RANGE,
        maxY: y + GHOST_RANGE
    });

    // it belongs to this one scrub, not to the graveyard
    delete ghost.respawn;
    ghostOwners.set(ghost, player.id);

    const sink = () => {
        if (!ghostOwners.has(ghost)) {
            return;
        }

        if (ghost.opponent) {
            world.setTickTimeout(sink, GHOST_FIGHT_TICKS);
            return;
        }

        ghostOwners.delete(ghost);
        ghost.retreat();
        world.removeEntity('npcs', ghost);
    };

    world.setTickTimeout(sink, GHOST_TICKS);

    world.addEntity('npcs', ghost);

    player.message('@que@The ground beneath the gravestone begins to shake...');
    await world.sleepTicks(1);
    player.message('@que@A ghost rises from the grave, and it does not look pleased');

    await ghost.attack(player);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (!GRAVESTONES.has(gameObject.id) || item.id !== BUCKET_OF_WATER) {
        return false;
    }

    const { world } = player;
    const cleaned = cleanedGravestones(player);
    const key = gravestoneKey(gameObject);

    // Their water is worth more on a grave that still needs it.
    if (cleaned.includes(key)) {
        player.message('@que@This one is already scrubbed clean');
        return true;
    }

    player.message("@que@You wash the gravestone with water and begin to scrub it");
    player.sendBubble(BUCKET_OF_WATER);

    await world.sleepTicks(10);

    player.inventory.remove(BUCKET_OF_WATER);
    player.inventory.add(EMPTY_BUCKET);

    // Scrubbing takes a while, and they may have spent it on this same grave.
    if (cleaned.includes(key)) {
        player.message('@que@This one is already scrubbed clean');
        return true;
    }

    cleaned.push(key);

    const left = GRAVESTONES_CLEANED_REQUIRED - cleaned.length;

    if (left === 0) {
        player.message('@que@That is the last of them - Ivan can hardly complain now');
    } else if (left === 1) {
        player.message('@que@Only one more gravestone to go...');
    } else if (left > 0) {
        player.message(`@que@Only ${left} more gravestones to go...`);
    }

    if (disturbsGhosts(player)) {
        await raiseGhost(player, gameObject);
    }

    return true;
}

async function onNPCDeath(player, npc) {
    if (npc.id !== GHOST_ID || !ghostOwners.has(npc)) {
        return false;
    }

    const ownerID = ghostOwners.get(npc);
    ghostOwners.delete(npc);

    // Someone else finishing off your ghost doesn't get your note.
    if (!player || player.id !== ownerID || player.inventory.has(NOTE_ID)) {
        return false;
    }

    // Which ghost has the note is decided when the first one goes down, and
    // decided again if it's ever needed a second time.
    if (!player.cache.ghostsUntilNote) {
        player.cache.ghostsUntilNote =
            Math.floor(Math.random() * MAX_GHOSTS_FOR_NOTE) + 1;
    }

    player.cache.ghostsUntilNote -= 1;

    if (player.cache.ghostsUntilNote === 0) {
        delete player.cache.ghostsUntilNote;
        player.world.addPlayerDrop(player, NOTE_ID, npc.x, npc.y);
        player.message('@que@As the ghost fades away, a crumpled note falls to the ground');
    }

    // die as normal
    return false;
}

module.exports = {
    onUseWithGameObject,
    onNPCDeath,
    cleanedGravestoneCount,
    forgetCleanedGravestones,
    GRAVESTONES_CLEANED_REQUIRED
};
