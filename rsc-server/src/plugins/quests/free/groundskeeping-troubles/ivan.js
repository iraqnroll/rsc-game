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
const GRAVESTONES_CLEANED_REQUIRED = 5;
const CABBAGE_ID = 18;
const CABBAGE_REQUIRED = 3;
const POTATO_ID = 348;
const POTATO_REQUIRED = 3;


const CHOPPED_TREES = "I chopped up those trees you asked";
const TREES_ATTACKED = "Those trees attacked me!";
const FRUSTRATION = "Are you kidding me ? That's not my job!";
const ACCEPTANCE = "Alright, but this is the last errand I'll do";
const COMPLETION = "Alright, I cleaned the gravestones...";
const IS_IT_ENOUGH = "I cleaned some of the gravestones, is it enough ?"
const WHAT_DO_YOU_NEED = "Alright... What do you need?";
const ENOUGH = "I had enough with your little errands, I'm done!";
const I_GOT_SOME = "I got some veggies for you";


const QUEST_STAGE_ERRAND1 = 1;
const QUEST_STAGE_ERRAND2 = 2;
const QUEST_STAGE_ERRAND3 = 3;
const QUEST_STAGE_FINAL = 4;
const QUEST_COMPLETE = -1;

// Ivan cannot take a compliment or give one. Every finished errand sets him
// off on whoever he blames for the job existing in the first place; the player
// is only ever an audience.
async function treeRant(player, ivan) {
    await ivan.say(
        "You know who planted those trees ? Old Alexander",
        "The groundskeeper before me, dead for over ten years, still ruining my week",
        "'They'll give the place some character, Ivan' he said...",
        "Character...",
        "They even tried to eat a funeral congregation once !",
        "I go to his grave every spring just to tell him what I think of him",
        "...anyway. Well done, I suppose"
    );
}

async function gravestoneRant(player, ivan) {
    await ivan.say(
        "See, this is what I tell the mourners",
        "They turn up with their lilies and their sniffling",
        "and not one of them has ever brought a brush",
        "maybe they think the graveyard cleans itself...",
        "...one widow even had the nerve to call the place unkempt",
        "Unkempt ! Her husband's the one leaking into my floor from outside",
        "I hope she's listening. She's over there as well, right next to him"
    );
}

async function vegetableRant(player, ivan) {
    await ivan.say(
        "Grew those myself. Had to, after the business with the grocer",
        "Fifteen years I bought his cabbages. Fifteen !",
        "Then he says my money smells of graveyard",
        "So I told him exactly where his stock ends up...",
        "...in the ground, same as everyone, and I'd be waiting...",
        "He crossed the road to avoid me until the day he moved in",
        "That big gravestone in the graveyard. I give him a wave every morning"
    );
}

// Ivan is done handing out errands, and the player is off looking for the note
// and the key. He has nothing left to offer either way.
async function deadEnd(player, ivan) {
    await ivan.say(
        "What are you still doing here ?",
        "I've got no more errands for you",
        "Go bother someone else for a change"
    );
}

async function questOver(player, ivan) {
    await ivan.say(
        "So you found your way out after all",
        "Don't go telling everyone how you managed it"
    );
}

async function lastStage(player, ivan) {
    const options = [I_GOT_SOME, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch(choice) {
        case I_GOT_SOME: {
            const { inventory, world } = player;

            // has() counts whole items for anything unstackable, which both
            // of these are, so this is "three of each" rather than "any".
            const shortOnCabbage = !inventory.has(CABBAGE_ID, CABBAGE_REQUIRED);
            const shortOnPotato = !inventory.has(POTATO_ID, POTATO_REQUIRED);

            if (shortOnCabbage || shortOnPotato) {
                await ivan.say(
                    "Is that all ? Can't you count ?",
                    `I asked for ${CABBAGE_REQUIRED} cabbages and ${POTATO_REQUIRED} potatoes`,
                    "Get back to those sacks and fetch the rest"
                );
                break;
            }

            inventory.remove(CABBAGE_ID, CABBAGE_REQUIRED);
            inventory.remove(POTATO_ID, POTATO_REQUIRED);
            player.message("@que@You hand the vegetables over to Ivan");

            await ivan.say(
                "Well, well... you actually managed it",
                "That'll do for tonight's stew"
            );

            await vegetableRant(player, ivan);

            player.message("@que@I am sick and tired of this guy...");
            await world.sleepTicks(2);
            player.message(
                "@que@...maybe I should check out that note he left in the backyard..."
            );

            player.questStages.groundskeepingTroubles = QUEST_STAGE_FINAL;
            break;
        }
        case ENOUGH:
            await ivan.say(
                "Suit yourself",
                "The sacks aren't going anywhere, and neither are you"
            );
    }
}

async function lastStageStarted(player, ivan) {
    const options = [WHAT_DO_YOU_NEED, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch(choice) {
        case WHAT_DO_YOU_NEED:
            await ivan.say(
                "Fetch me 3 potatoes and 3 cabbages from the sacks in the backyard",
                "you can find it to the east of the house",
                "you can access it by searching the bookcase to the right"
            );
            break;
        case ENOUGH:
            await ivan.say(
                "Then good luck pal",
                "I suggest you make one of the gravestones a cozy bed for yourself",
                "because you'll be staying here for a while, hahaha"
            );
    }
}

async function secondStage(player, ivan) {
    const options = [];
    // Nothing sets this until the first gravestone is scrubbed, and
    // `undefined < 5` is false -- which would offer "I cleaned them all" to a
    // player who has not touched one.
    const cleaned = player.cache.cleanedGravestones || 0;

    if (cleaned < GRAVESTONES_CLEANED_REQUIRED) {
        options.push(IS_IT_ENOUGH);
    } else {
        options.push(COMPLETION);
    }

    const choice = options[await player.ask(options, true)];

    if(choice === IS_IT_ENOUGH) {
        await ivan.say(
            "Yeah right... What do you think this is ? A vacation ?",
            "Clean those gravestones, and make them shiny"
        );
    } else {
        await ivan.say("Wow, you really did scrub them, good job");
        await gravestoneRant(player, ivan);

        await ivan.say(
            "...hmm...what else do I need...",
            "Well, I do need to get some food from the backyard...",
            "But it's too cold outside, you do it!"
        );

        player.questStages.groundskeepingTroubles = QUEST_STAGE_ERRAND3;
        delete player.cache.cleanedGravestones;

        await lastStageStarted(player, ivan);
    }
}

async function secondStageStarted(player, ivan) {
    await ivan.say(
        "You're not done yet though, the gravestones are dirty and mossy",
        "I need them washed and scrubbed"
    );

    const options = [FRUSTRATION, ACCEPTANCE];
    const choice = options[await player.ask(options, true)];

    switch(choice) {
        case ACCEPTANCE:
            await ivan.say(
                "Sure buddy, just scrub the gravestones",
                "Remember, I'll be watching you"
            );
            break;
        case FRUSTRATION:
            await ivan.say(
                "Well have fun spending the rest of eternity",
                "in this graveyard pal!"
            );
            break;
    }
}

async function firstStageStarted(player, ivan) {
    await ivan.say(
        "You think you can just give me a little sob story and leave ?",
        "Before I let you leave you'll have to do something for me",
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
            await treeRant(player, ivan);
            // done: move the quest on and clean up
            player.questStages.groundskeepingTroubles = QUEST_STAGE_ERRAND2;
            delete player.cache.evilTreesCut;
            delete player.cache.interractedWithEvilTree;

            await secondStageStarted(player, ivan);
        } else {
            await ivan.say(
                "Don't lie to me, I can see them from here",
                felled.length === 0
                    ? "You haven't laid a finger on a single one"
                    : `You've only dealt with ${felled.length} of them`
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
                "and it's always the same story - woke up in the graveyard with no memory",
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
                "either do that or stay in this graveyard, I don't really care...",
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
    } else if (questStage == QUEST_STAGE_ERRAND2) {
        await secondStage(player, npc);
    } else if (questStage == QUEST_STAGE_ERRAND3) {
        await lastStage(player, npc);
    } else if (questStage == QUEST_STAGE_FINAL) {
        await deadEnd(player, npc);
    } else if (questStage == QUEST_COMPLETE) {
        await questOver(player, npc);
    }

    player.disengage();
    return true;
}

module.exports = { onTalkToNPC };
