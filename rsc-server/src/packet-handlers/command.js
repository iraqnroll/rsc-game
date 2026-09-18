// :: commands. What each one does, who may use it and what it takes is in
// src/commands; in game, ::help lists them and ::help <name> explains one.

const log = require('bole')('command');
const { runCommand } = require('../commands');
const { eventsOf } = require('../admin/events');

async function command({ player }, { command, args }) {
    const result = await runCommand(player, command, args);

    // Every attempt is logged, allowed or not: a player probing for admin
    // commands is worth knowing about.
    eventsOf(player).emit('command', player.username, {
        command,
        args,
        rank: player.rank,
        ran: result.ran,
        reason: result.reason
    });

    log.info({
        player: player.username,
        rank: player.rank,
        command,
        args,
        ran: result.ran,
        reason: result.reason
    });
}

module.exports = { command };
