const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Landscape } = require('@2003scape/rsc-landscape');
const { PathFinder } = require('@2003scape/rsc-path-finder');
const { pathfindingLandscape } = require('../src/model/pathfinding-landscape');

const DATA = path.join(__dirname, '../node_modules/@2003scape/rsc-data');
const config = {
    objects: require(`${DATA}/config/objects.json`),
    wallObjects: require(`${DATA}/config/wall-objects.json`),
    tiles: require(`${DATA}/config/tiles.json`)
};

function load() {
    const land = new Landscape();
    land.loadJag(
        fs.readFileSync(`${DATA}/landscape/land63.jag`),
        fs.readFileSync(`${DATA}/landscape/maps63.jag`)
    );
    land.parseArchives();
    return land;
}

// Blocked tiles in the first floor of sector 50/50 (Lumbridge castle's).
function blocked(pathFinder) {
    let n = 0;
    for (let x = 96; x < 144; x++) {
        for (let y = 944 + 624; y < 944 + 672; y++) if (pathFinder.isTileBlocked(x, y)) n++;
    }
    return n;
}

test('an upper floor is walkable in a map that covers less than the whole world', (t) => {
    const land = load();
    if (!land.sectors[50] || !land.sectors[50][50] || !land.sectors[50][50][1]) {
        t.skip('the installed map has no sector 1/50/50');
        return;
    }
    const whole = blocked(new PathFinder(config, pathfindingLandscape(land)));
    assert.ok(whole < 48 * 48, 'some of the floor is walkable');

    // The same sectors, in a map whose extent stops at region y 51 -- as an
    // editor project that never reached further south does.
    const smaller = Object.assign(Object.create(Object.getPrototypeOf(land)), land, { maxRegionY: 51 });
    assert.equal(blocked(new PathFinder(config, smaller)), 48 * 48, 'rsc-path-finder on its own blocks the whole floor');
    assert.equal(blocked(new PathFinder(config, pathfindingLandscape(smaller))), whole);
});
