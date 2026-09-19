const test = require('node:test');
const assert = require('node:assert/strict');
const animations = require('@2003scape/rsc-data/config/animations.json');
const { HALO_LAYER, haloAnimation, haloLayerValue, resetHalo } = require('../src/halo');
const Player = require('../src/model/player');

const chefshat = animations.findIndex((a) => a.name === 'chefshat');

test('the halo is layer 12, drawn as its animation + 1, only while the flag is set', () => {
    resetHalo();
    const config = { haloAnimation: 'chefshat' };
    assert.equal(HALO_LAYER, 12);
    assert.equal(haloAnimation(config), chefshat);
    assert.equal(haloLayerValue({ cache: { halo: true } }, config), chefshat + 1);
    assert.equal(haloLayerValue({ cache: {} }, config), 0);
});

test('with no such animation there is simply no halo', () => {
    resetHalo();
    assert.equal(haloAnimation({ haloAnimation: 'no-such-sprite-set' }), null);
    assert.equal(haloLayerValue({ cache: { halo: true } }, {}), 0);
    resetHalo();
});

test('setHalo changes the layer and shows everyone', () => {
    resetHalo();
    const broadcasts = [];
    const player = {
        cache: {},
        animations: new Array(13).fill(0),
        appearanceIndex: 4,
        world: { server: { config: { haloAnimation: 'chefshat' } } },
        broadcastPlayerAppearance: (self) => broadcasts.push(self)
    };
    Player.prototype.setHalo.call(player, true);
    assert.equal(player.cache.halo, true);
    assert.equal(player.animations[12], chefshat + 1);
    Player.prototype.setHalo.call(player, false);
    assert.equal('halo' in player.cache, false);
    assert.equal(player.animations[12], 0);
    assert.equal(player.appearanceIndex, 6, 'a new appearance each time, so clients redraw');
    assert.deepEqual(broadcasts, [true, true]);
    resetHalo();
});
