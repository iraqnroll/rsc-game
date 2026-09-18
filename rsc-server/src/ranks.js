// Account ranks, as stored in rsc-data-server's `players.rank`.
//
// The game only ever tested `rank >= 3` (Player#isAdministrator). Moderator
// sits below it so staff can be given kick/goto/teleport without the power to
// spawn items. Set a rank with rsc-data-server's `npm run set-rank`.

const PLAYER = 0;
const MODERATOR = 2;
const ADMINISTRATOR = 3;

function rankName(rank) {
    if (rank >= ADMINISTRATOR) return 'administrator';
    if (rank >= MODERATOR) return 'moderator';
    return 'player';
}

module.exports = { PLAYER, MODERATOR, ADMINISTRATOR, rankName };
