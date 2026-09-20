//2026-09-19 Fuck you Ivan
const { axes } = require('@2003scape/rsc-data/skills/woodcutting');
const { EVIL_TREES } = require('./dead-tree');

const IVAN_ID = 5;
const BRONZE_AXE_ID = 87;
const AXE_IDS = Object.keys(axes)
    .map(Number)
    .sort((a, b) => {
        if (axes[a] === axes[b]) {
            return 0;
        }

        return axes[a] > axes[b] ? -1 : 1;
    });

const QUEST_STAGE_ERRAND1 = 1;

async function firstStageStarted(player, ivan) {
    await ivan.say(
        "You think you can just give me a little sob story and leave ?",
        "Before I let you leave you'll have to do something for me !",
        "The cemetary is in a pretty bad shape at the moment",
        "see if you can do something about those ugly dead trees"
    );

    const hasAxe = AXE_IDS.some((id) => player.inventory.has(id));

    if (!hasAxe) {
        player.inventory.add(BRONZE_AXE_ID);
        player.message("@que@Ivan hands you a bronze axe");
        await player.world.sleepTicks(2);
    }

    await ivan.say(
        "And don't think about slacking off",
        "I'll be keeping an eye on you and those trees"
    );
}

const CHOPPED_TREES = "I chopped up those trees you asked";
const TREES_ATTACKED = "Those trees attacked me!";

async function firstStage(player, ivan) {
    const felled = player.cache.evilTreesCut || [];

    // Only offered once the player has had a go at one of the trees.
    const options = [CHOPPED_TREES];
    if (player.cache.interractedWithEvilTree) {
        options.push(TREES_ATTACKED);
    }

    // ask() gives the index into options, which shifts when one is left out,
    // so go by the text.
    const choice = options[await player.ask(options, true)];

    if (choice === CHOPPED_TREES) {
        if (felled.length === EVIL_TREES.size) { // all four
            await ivan.say("Well I'll be damned... they're really gone");
            // done: move the quest on and clean up
            player.questStages.groundskeepingTroubles = 2;
            delete player.cache.evilTreesCut;
            delete player.cache.interractedWithEvilTree;
        } else {
            await ivan.say(
                "Don't lie to me, I can see them from here",
                `You've only dealt with ${felled.length} of them`
            );
        }
    } else if (choice === TREES_ATTACKED) {
        await ivan.say(
            "Attacked you? Don't be ridiculous, trees don't...",
            "...well, maybe those ones do",
            "Try using some salt on them"
        );
    }
}

async function preQuestStart(player, ivan) {
    await ivan.say('Who are you..? What are you doing here?');

    const choice = await player.ask(
        [
            "I woke up in a graveyard, I'm not entirely sure what happened...",
            "I don't know. I'm lost. Where am i?"
        ],
        true
    );

    switch (choice) {
        case 0: //Quest-initiation dialogue
            await ivan.say(
                "Oh god.. not another one...",
                "This is getting really annoying, I can't keep up with you people!"
            );

            await player.say("I'm not sure I follow...");

            await ivan.say(
                "Sorry to say this, but you're probably dead !",
                "For years now this graveyard has been getting visitors from the beyond",
                "and it's always the same story - woke up in the graveyard, doesn't remember a thing",
                "I have a feeling Kosmolit is behind all of this, not sure how..."
            );

            await player.say("Dead ? I can't be dead, I'm talking to you !");

            await ivan.say(
                "Sorry to break it to you bud, look at that shiny thing on top of your head",
                "Only dead people have that",
                "If you're not dead, you're not alive either..."
            );

            await player.say("Oh god... What should I do ?!");

            await ivan.say(
                "Well... I heard of one way...",
                "Rumours have it that you have to find your soul",
                "Take my words with a grain of salt though, I'm not an expert on this",
                "so either do that or stay in this graveyard, I don't really care...",
                "...as long as you leave me alone and stay out of my way..."
            );

            const questStartChoice = await player.ask([
                "I want to find my soul ! How do I get out of here ?",
                "Fine... I'll just hang around with you..."
            ],true);

            switch(questStartChoice) {
                case 0:
                    player.questStages.groundskeepingTroubles = 1;
                    await firstStageStarted(player, ivan);
                    break;
                case 1:
                    player.message("@que@Ivan walks away while silently mumbling curses at you...");
                    break;
            }

            break;
        case 1: //Regular response
            await ivan.say("You are in Bucktooth Ridge's graveyard, I'm the groundskeeper");
            break;
    }
}

async function onTalkToNPC(player, npc) {
    if (npc.id !== IVAN_ID) {
        return false;
    }

    const questStage = player.questStages.groundskeepingTroubles;
    player.engage(npc);

    if (!questStage) {
        await preQuestStart(player, npc);
    } else if (questStage == QUEST_STAGE_ERRAND1) {
        await firstStage(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
