// Where a staff teleport goes: coordinates, or a region by name. Shared by
// ::teleport, ::send and the control socket's teleport, so the game and RSC
// Editor's Player page read a destination the same way.

const regions = require('@2003scape/rsc-data/regions');

// The game's coordinate space: 2304 tiles across, and four planes of 944
// rows stacked (World#planeElevation).
const MAX_X = 2303;
const MAX_Y = 944 * 4 - 1;

// "lumbridge", "port sarim", "port_sarim" -> the rsc-data key.
const regionKey = (name) => String(name).trim().toLowerCase().replace(/[_\s]+/g, '-');

// { x, y } or { error }.
function destination({ x, y, region } = {}) {
    if (region !== undefined && region !== null && region !== '') {
        const key = regionKey(region);
        const found = regions[key];
        if (!found || found.spawnX === undefined) {
            return { error: `no region "${region}" -- ::find region lists them` };
        }
        return { x: found.spawnX, y: found.spawnY, region: key };
    }
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isInteger(nx) || !Number.isInteger(ny)) {
        return { error: 'give x and y as whole numbers, or a region name' };
    }
    if (nx < 0 || nx > MAX_X || ny < 0 || ny > MAX_Y) {
        return { error: `x must be 0 to ${MAX_X} and y 0 to ${MAX_Y}` };
    }
    return { x: nx, y: ny };
}

module.exports = { destination, regionKey, MAX_X, MAX_Y };
