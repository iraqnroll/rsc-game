#!/usr/bin/env node
// Set an account's rank: 0 player, 2 moderator, 3 administrator.
//
//   npm run set-rank -- <username> <rank> [config.json]
//   node src/set-rank.js some_player 3 /etc/rsc-game/data-server.json
//
// Run it while that player is LOGGED OUT: the game saves `rank` back on
// logout, so a change made while they are online is overwritten when they
// leave. Takes effect at their next login.

const fs = require('fs');
const Database = require('better-sqlite3');

const [username, rankArg, configFile = './config.json'] = process.argv.slice(2);
const RANKS = { 0: 'player', 2: 'moderator', 3: 'administrator' };

if (!username || !/^\d+$/.test(rankArg || '')) {
    console.error('usage: set-rank <username> <rank> [config.json]');
    console.error('ranks: 0 player, 2 moderator, 3 administrator');
    process.exit(1);
}
const rank = Number(rankArg);
if (!(rank in RANKS)) {
    console.error(`rank must be one of ${Object.keys(RANKS).join(', ')}`);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const db = new Database(config.sqliteFile, { fileMustExist: true });
// Names are typed with underscores for spaces in commands; accept that here too.
const name = username.replace(/_/g, ' ');
const result = db.prepare('UPDATE `players` SET `rank` = ? WHERE `username` = ?').run(rank, name);
db.close();

if (result.changes === 0) {
    console.error(`no account called "${name}"`);
    process.exit(1);
}
console.log(`${name} is now ${RANKS[rank]} (rank ${rank}); it applies at their next login`);
