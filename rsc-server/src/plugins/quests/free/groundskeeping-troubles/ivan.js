//2026-09-19 Fuck you Ivan
const { axes } = require('@2003scape/rsc-data/skills/woodcutting');
const { EVIL_TREES } = require('./dead-tree');
const { BOWL_ID, SHRIMP_SOUP_ID } = require('./soup');
const {
    cleanedGravestoneCount,
    forgetCleanedGravestones,
    GRAVESTONES_CLEANED_REQUIRED
} = require('./gravestone');

const IVAN_ID = 5;
const BRONZE_AXE_ID = 87;
const TINDERBOX_ID = 166;
const BRONZE_SHORTSWORD_ID = 66;
const BRONZE_KITESHIELD_ID = 128;
const NOTE_ID = 1291;
const AXE_IDS = Object.keys(axes)
    .map(Number)
    .sort((a, b) => {
        if (axes[a] === axes[b]) {
            return 0;
        }

        return axes[a] > axes[b] ? -1 : 1;
    });
const SMALL_NET_ID = 376;
const BOWL_OF_WATER_ID = 342;
const RAW_SHRIMP_ID = 349;
const SHRIMP_REQUIRED = 3;
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
const I_GOT_SHRIMP = "I caught your shrimp";
const I_MADE_SOUP = "I made your soup";
const WHERE_DO_I_FISH = "Alright... Where do I fish?";


const QUEST_STAGE_ERRAND1 = 1;
const QUEST_STAGE_ERRAND2 = 2;
const QUEST_STAGE_ERRAND3 = 3;
const QUEST_STAGE_ERRAND4 = 4;
const QUEST_STAGE_FINAL = 5;
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

async function shrimpRant(player, ivan) {
    await ivan.say(
        "That pond, by the way. You know what's in it besides shrimp ?",
        "Everyone the parish couldn't afford a plot for",
        "Council said it was 'a temporary measure'. Thirty years ago",
        "I raised it at every meeting until they stopped inviting me",
        "So no, I don't swim in it, and yes, I still eat the shrimp",
        "A man has to eat something"
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

// A bowl, if they have not got one already -- filled or empty.
async function handBowl(player, ivan) {
    const { inventory } = player;

    if (inventory.has(BOWL_ID) || inventory.has(BOWL_OF_WATER_ID) || inventory.has(SHRIMP_SOUP_ID)) {
        return;
    }

    inventory.add(BOWL_ID);
    player.message("@que@Ivan hands you a bowl");
    await player.world.sleepTicks(2);

    await ivan.say("And don't chip it");
}

async function lastStage(player, ivan) {
    const options = [I_MADE_SOUP, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch (choice) {
        case I_MADE_SOUP: {
            const { inventory, world } = player;

            if (!inventory.has(SHRIMP_SOUP_ID)) {
                const short = [];

                if (!inventory.has(POTATO_ID, POTATO_REQUIRED)) {
                    short.push(`${POTATO_REQUIRED} potatoes`);
                }

                if (!inventory.has(CABBAGE_ID, CABBAGE_REQUIRED)) {
                    short.push(`${CABBAGE_REQUIRED} cabbages`);
                }

                if (!inventory.has(RAW_SHRIMP_ID, SHRIMP_REQUIRED)) {
                    short.push(`${SHRIMP_REQUIRED} shrimp`);
                }

                await ivan.say(
                    "That's not soup, that's an empty pair of hands",
                    short.length
                        ? `You're still short of ${short.join(', ')}`
                        : "Put it all on a range with a bowl of water"
                );

                await handBowl(player, ivan);
                break;
            }

            inventory.remove(SHRIMP_SOUP_ID);
            player.message("@que@You hand the soup over to Ivan");

            await ivan.say(
                "Well, well... you actually managed it",
                "Hot food. In this place. I'd forgotten"
            );

            await vegetableRant(player, ivan);

            await ivan.say(
                "...that's it, then",
                "That's... hm",
                "No, that's the lot. I can't think of another thing for you"
            );

            player.message("@que@Ivan looks genuinely annoyed about it");
            await world.sleepTicks(2);

            player.message("@que@I am sick and tired of this guy...");
            await world.sleepTicks(2);

            if (inventory.has(NOTE_ID)) {
                player.message(
                    "@que@...maybe I should take a closer look at that note the ghost dropped..."
                );
            } else {
                // They never got it off a ghost, or lost it since. Disturbing
                // another grave brings them back up (see gravestone.js).
                player.message(
                    "@que@...those ghosts by the gravestones seemed to be guarding something..."
                );
            }

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

// Errand three: the shrimp. Ivan has not had a hot meal in a while and has
// decided, loudly, that this is the player's problem.
async function thirdStageStarted(player, ivan) {
    const options = [WHERE_DO_I_FISH, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch (choice) {
        case WHERE_DO_I_FISH:
            await ivan.say(
                `There's a pond right here in the graveyard, catch me ${SHRIMP_REQUIRED} shrimp`,
                "Don't tell me you've never held a net before"
            );

            await handNet(player, ivan);
            break;
        case ENOUGH:
            await ivan.say(
                "Fine. I'll have another cold supper, then",
                "And you'll have another cold century"
            );
    }
}

// A net, if they have not got one. Fishing spot 193's Net option wants the
// small net and no bait, so this is the whole kit.
async function handNet(player, ivan) {
    if (player.inventory.has(SMALL_NET_ID)) {
        return;
    }

    player.inventory.add(SMALL_NET_ID);
    player.message("@que@Ivan hands you a net");
    await player.world.sleepTicks(2);

    await ivan.say("And bring the net back. That's parish property");
}

async function thirdStage(player, ivan) {
    const options = [I_GOT_SHRIMP, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch (choice) {
        case I_GOT_SHRIMP: {
            const { inventory } = player;

            if (!inventory.has(RAW_SHRIMP_ID, SHRIMP_REQUIRED)) {
                await ivan.say(
                    "That's not a soup, that's a garnish",
                    `${SHRIMP_REQUIRED} shrimp. The pond is right there`
                );

                // in case they turned the errand down at first, or lost the net
                await handNet(player, ivan);
                break;
            }

            player.message("@que@Ivan peers into your net");

            await ivan.say(
                "Hah ! You actually caught them",
                "I'd nearly resigned myself to bread again",
                "Hold onto them, they're no use to me raw"
            );

            await shrimpRant(player, ivan);

            player.questStages.groundskeepingTroubles = QUEST_STAGE_ERRAND4;

            await lastStageStarted(player, ivan);
            break;
        }
        case ENOUGH:
            await ivan.say(
                "Suit yourself",
                "The pond isn't going anywhere, and neither are you"
            );
    }
}

async function lastStageStarted(player, ivan) {
    const options = [WHAT_DO_YOU_NEED, ENOUGH];
    const choice = options[await player.ask(options, true)];

    switch(choice) {
        case WHAT_DO_YOU_NEED:
            await ivan.say(
                "I can't throw shrimp in boiling water and call it a soup",
                `Fetch ${POTATO_REQUIRED} potatoes and ${CABBAGE_REQUIRED} cabbages from the sacks in the backyard`,
                "you can find it to the east of the house",
                "you can access it by searching the bookcase to the right"
            );

            await player.say("And then you'll cook it ?");

            await ivan.say(
                "Do I look like I'm cooking ? You'll cook it",
                "Fill a bowl at the fountain, then put the lot on a range",
                "Bring me the soup when it's soup"
            );

            await handBowl(player, ivan);
            break;
        case ENOUGH:
            await ivan.say(
                "Then good luck pal",
                "I suggest you make one of the gravestones a cozy bed for yourself",
                "because you'll be staying here for a while, hahaha"
            );
    }
}

// Ivan knows full well what comes up out of those graves when they're
// disturbed. He calls this a cleaning kit.
async function handCleaningKit(player, ivan) {
    const { inventory, world } = player;
    const needsSword = !inventory.has(BRONZE_SHORTSWORD_ID);
    const needsShield = !inventory.has(BRONZE_KITESHIELD_ID);

    if (!needsSword && !needsShield) {
        return;
    }

    await ivan.say(
        "Oh, and you'll want these",
        "...for the cleaning"
    );

    if (needsSword) {
        inventory.add(BRONZE_SHORTSWORD_ID);
        player.message("@que@Ivan hands you a bronze shortsword");
        await world.sleepTicks(2);
    }

    if (needsShield) {
        inventory.add(BRONZE_KITESHIELD_ID);
        player.message("@que@Ivan hands you a bronze kiteshield");
        await world.sleepTicks(2);
    }

    await player.say("A sword ? To clean gravestones ?");

    await ivan.say(
        "For the moss. Very stubborn moss round here",
        "And the shield is for... splashes",
        "Don't ask so many questions, just keep them on you"
    );

    player.message("@que@Ivan avoids looking you in the eye");
}

async function secondStage(player, ivan) {
    const options = [];
    // How many different graves they have scrubbed; nothing is recorded
    // until the first one, so this is 0 for a player who has not touched one.
    const cleaned = cleanedGravestoneCount(player);

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

        // in case they turned the errand down at first, or lost the kit
        await handCleaningKit(player, ivan);
    } else {
        await ivan.say("Wow, you really did scrub them, good job");
        await gravestoneRant(player, ivan);

        await ivan.say(
            "...hmm...what else do I need...",
            "You know what I haven't had in months ? A hot meal",
            "A proper bowl of soup, that's what I want",
            "And you're going to fish me the shrimp for it"
        );

        player.questStages.groundskeepingTroubles = QUEST_STAGE_ERRAND3;
        forgetCleanedGravestones(player);

        await thirdStageStarted(player, ivan);
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

            await handCleaningKit(player, ivan);
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
        "see if you can do something about those ugly dead trees",
        "don't forget to burn the logs...",
        "...they might...cause some problems later on if you don't..."
    );

    const hasAxe = AXE_IDS.some((id) => player.inventory.has(id));
    const hasTinderbox = player.inventory.has(TINDERBOX_ID);

    if (!hasAxe) {
        player.inventory.add(BRONZE_AXE_ID);
        player.message("@que@Ivan hands you a bronze axe");
        await player.world.sleepTicks(2);
    }

    if (!hasTinderbox) {
        player.inventory.add(TINDERBOX_ID);
        player.message("@que@Ivan hands you a tinderbox");
        await player.world.sleepTicks(2);
    }

    await ivan.say(
        "And don't think about slacking off",
        "I'll be keeping an eye on you and those trees"
    );
}

// All four trees are down, but their logs haven't all gone on a fire yet.
async function unburntLogs(player, ivan, burned) {
    const left = EVIL_TREES.size - burned;

    await ivan.say("They're down, I'll give you that");

    if (burned === 0) {
        await ivan.say(
            "and then you just left the logs lying about, did you ?",
            "Not a single one burnt. Not one !",
            "Those aren't firewood, they're the same trees in smaller pieces",
            "Leave them overnight and they'll be scratching at my door again"
        );
    } else {
        await ivan.say(
            "and you've even burnt some of the logs, how thorough",
            "Pity you stopped halfway",
            left === 1
                ? "There's still one lot of them left unburnt"
                : `There's still ${left} lots of them left unburnt`
        );
    }

    await player.say("Does it really matter what happens to the logs ?");

    await ivan.say(
        "Does it matter...",
        "Old Alexander thought it didn't matter either",
        "He stacked them by the shed to dry, the fool",
        "Next morning the shed was gone and so was his dog",
        "Burn them. All of them. Then come back to me"
    );

    if (!player.inventory.has(TINDERBOX_ID)) {
        player.inventory.add(TINDERBOX_ID);
        player.message("@que@Ivan grudgingly hands you another tinderbox");
        await player.world.sleepTicks(2);
        await ivan.say("And try not to lose this one");
    }
}

async function firstStage(player, ivan) {
    const felled = player.cache.evilTreesCut || [];
    const burned = player.cache.evilLogsBurned || 0;

    // Only offered once the player has had a go at one of the trees.
    const options = [CHOPPED_TREES];
    if (player.cache.interractedWithEvilTree) {
        options.push(TREES_ATTACKED);
    }

    // ask() gives the index into options, which shifts when one is left out,
    // so go by the text.
    const choice = options[await player.ask(options, true)];

    if (choice === CHOPPED_TREES) {
        if (felled.length === EVIL_TREES.size && burned >= EVIL_TREES.size) {
            await ivan.say("Well I'll be damned... they're really gone");
            await treeRant(player, ivan);
            // done: move the quest on and clean up
            player.questStages.groundskeepingTroubles = QUEST_STAGE_ERRAND2;
            delete player.cache.evilTreesCut;
            delete player.cache.evilLogsBurned;
            delete player.cache.interractedWithEvilTree;

            await secondStageStarted(player, ivan);
        } else if (felled.length === EVIL_TREES.size) {
            await unburntLogs(player, ivan, burned);
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
        await thirdStage(player, npc);
    } else if (questStage == QUEST_STAGE_ERRAND4) {
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
