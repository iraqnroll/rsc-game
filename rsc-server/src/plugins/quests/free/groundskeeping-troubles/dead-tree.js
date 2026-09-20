const EVIL_TREES = new Set([1190, 1191, 1192, 1193]);
const BUCKET_OF_SALT = 1290;
const TREESTUMP = 4;
const TREE_RESPAWN = 60 * 1000; // ms until the evil tree grows back

const { axes } = require('@2003scape/rsc-data/skills/woodcutting');
const AXE_IDS = Object.keys(axes)
    .map(Number)
    .sort((a, b) => {
        if (axes[a] === axes[b]) {
            return 0;
        }

        return axes[a] > axes[b] ? -1 : 1;
    });


// Both of the tree's options, approach and cut, end the same way: it lashes out.
async function lashOut(player, gameObject) {
    if (!EVIL_TREES.has(gameObject.id)) {
        return false;
    }

    const { world } = player;

    player.message('The tree seems to be possesed and lashes out at you');
    await world.sleepTicks(1);

    let damage = Math.floor(player.skills.hits.base * 0.2);

    if (player.skills.hits.current - damage <= 0) {
        damage = 0;
    }

    player.damage(damage);
    player.message('You are badly scratched by the evil tree');

    if (!player.cache.interractedWithEvilTree) {
        player.cache.interractedWithEvilTree = true;
    }

    return true;
}

async function onGameObjectCommandOne(player, gameObject) {
    return lashOut(player, gameObject);
}

async function onGameObjectCommandTwo(player, gameObject) {
    return lashOut(player, gameObject);
}

async function onUseWithGameObject(player, gameObject, item) {
    if (!EVIL_TREES.has(gameObject.id) || item.id !== BUCKET_OF_SALT) {
        return false;
    }

    const { world } = player;
    const axeID = AXE_IDS.find((id) => player.inventory.has(id));

    if (!player.cache.interractedWithEvilTree) {
        player.cache.interractedWithEvilTree = true;
    }

    player.inventory.remove(BUCKET_OF_SALT);
    player.message("@que@The tree squirms and calms down");

    if (axeID === undefined) {
        player.message("@que@I could cut it if I had an axe...");
        return true;
    }

    await world.sleepTicks(1);

    player.message("@que@You proceed to cut the tree with your axe");
    player.sendBubble(axeID);
    await world.sleepTicks(3);

    // Someone else may have felled it while we were swinging.
    const { x, y } = gameObject;
    if (world.gameObjects.getAtPoint(x, y)[0] !== gameObject) {
        return true;
    }

    const treeID = gameObject.id;
    const stump = world.replaceEntity("gameObjects", gameObject, TREESTUMP);
    world.setTimeout(() => world.replaceEntity("gameObjects", stump, treeID), TREE_RESPAWN);

    player.message("@que@The evil tree crashes to the ground");

    // Which evil trees this player has felled, by id -- each of the four has
    // its own, so a tree cut twice counts once.
    const felled = player.cache.evilTreesCut || [];
    if (!felled.includes(treeID)) {
        felled.push(treeID);
        player.cache.evilTreesCut = felled;
    }
    const left = EVIL_TREES.size - player.cache.evilTreesCut.length;
    await world.sleepTicks(1);

    player.message(`@que@ Only ${left} more to go...`);

    return true;
}

module.exports = { onGameObjectCommandOne, onGameObjectCommandTwo, onUseWithGameObject, EVIL_TREES };
