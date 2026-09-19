// The landscape as rsc-path-finder needs to see it: the extent of the whole
// 204 world, whatever the loaded map actually covers.
//
// rsc-path-finder sizes its obstacle grid from the landscape's own region
// extent and stacks the planes `48 * (maxRegionY - minRegionY) + 80` tiles
// apart. The game's planes are 944 tiles apart, and the two agree only when
// the map spans region y 37..55 -- the shipped world. An editor project
// covers less, so the pathfinder put every upper-floor tile in the wrong
// place and every tile of plane 1 and above read as blocked (a map spanning
// y 37..51 stacked them 752 apart). The x axis has the same assumption:
// game x 0 must be region 48.
//
// Sectors the map does not have stay empty, which the pathfinder treats as
// blocked -- exactly what it did for them before.

const WORLD = { minRegionX: 48, maxRegionX: 58, minRegionY: 37, maxRegionY: 55, depth: 4 };

function pathfindingLandscape(landscape) {
    const minRegionX = WORLD.minRegionX;
    const maxRegionX = Math.max(WORLD.maxRegionX, landscape.maxRegionX || 0);
    const { minRegionY, maxRegionY, depth } = WORLD;

    const sectors = [];
    for (let x = minRegionX; x <= maxRegionX; x += 1) {
        sectors[x] = [];
        for (let y = minRegionY; y <= maxRegionY; y += 1) {
            sectors[x][y] = [];
            for (let z = 0; z < depth; z += 1) {
                const column = landscape.sectors[x];
                const row = column && column[y];
                sectors[x][y][z] = (row && row[z]) || null;
            }
        }
    }

    return { minRegionX, maxRegionX, minRegionY, maxRegionY, depth, sectors };
}

module.exports = { pathfindingLandscape, WORLD };
