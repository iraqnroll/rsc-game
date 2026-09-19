// The halo: a thirteenth appearance layer, drawn over everything else, that
// every new player starts with and one quest takes away.
//
// Why a layer of its own and not part of the head: players pick one of
// several heads, the head layer is tinted with the hair colour, and a full
// helm replaces it -- a halo baked into heads would need a copy of every
// head, take the hair colour, and vanish under a helmet. Layers 0-11 all
// belong to equipment; layer 12 belongs to nothing else, and the client draws
// it last (rsc-client: npcAnimationArray, GameCharacter.equippedItem).
//
// Whether a player has it is a flag in their saved state, `cache.halo`. New
// accounts get it on their first login. The quest that removes it calls
// `player.setHalo(false)`; `::halo` sets it by hand while testing.
//
// What it looks like is an animation definition -- a sprite set uploaded in
// RSC Editor's Assets screen -- found by name: config.haloAnimation, or
// "halo". The appearance message sends each layer as one byte, so its index
// must be 255 or less. No such definition: no halo, and a warning at start.

const log = require('bole')('halo');
const animations = require('@2003scape/rsc-data/config/animations');

const HALO_LAYER = 12;

let resolved;

function haloAnimation(config = {}) {
    if (resolved !== undefined) return resolved;
    const wanted = config.haloAnimation === undefined ? 'halo' : config.haloAnimation;
    let index =
        typeof wanted === 'number'
            ? wanted
            : animations.findIndex((a) => a && a.name.toLowerCase() === String(wanted).toLowerCase());
    if (index < 0 || !animations[index]) {
        log.warn(`no animation called "${wanted}": players get no halo until one is added (RSC Editor, Assets)`);
        index = null;
    } else if (index > 255) {
        log.warn(`the halo animation is number ${index}; the appearance message holds 255 at most, so there is no halo`);
        index = null;
    }
    resolved = index;
    return resolved;
}

// For tests: forget the lookup.
function resetHalo() {
    resolved = undefined;
}

// The layer value for a player: the animation's index + 1 (0 draws nothing),
// as the client reads every layer.
function haloLayerValue(player, config) {
    const animation = haloAnimation(config);
    return player.cache && player.cache.halo && animation !== null ? animation + 1 : 0;
}

module.exports = { HALO_LAYER, haloAnimation, haloLayerValue, resetHalo };
