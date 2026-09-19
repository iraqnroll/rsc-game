// Account administration, for RSC Editor's Player page by way of a world's
// control socket (rsc-server/src/admin). Only an authenticated world can
// reach these, like every other handler.
//
// Units follow what the rest of the code already stores: ban_end_date in
// SECONDS (see queryHandler.getPlayerBanEnd), mute_end_date in MILLISECONDS
// (Player#isMuted compares it with Date.now()), -1 meaning "for good" and 0
// "not banned / muted" for both.

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { promisify } = require('util');

const bcryptHash = promisify(bcrypt.hash);

const RANKS = [0, 2, 3];

function account(db, username) {
    return db
        .prepare(
            'SELECT `id`, `username`, `rank`, `creation_date`, `creation_ip`, ' +
                '`login_date`, `login_ip`, `ban_end_date`, `mute_end_date`, ' +
                '`world`, `quest_points` FROM `players` WHERE `username` = ?'
        )
        .get(username);
}

function reply(socket, token, body) {
    socket.sendMessage({ token, ...body });
}

async function run(handler, token, work) {
    try {
        reply(handler.socket, token, { ok: true, ...(await work()) });
    } catch (e) {
        reply(handler.socket, token, { ok: false, error: e.message });
    }
}

function find(queryHandler, username) {
    const row = account(queryHandler.database, String(username || '').toLowerCase());
    if (!row) throw new Error(`no account called ${username}`);
    return row;
}

const seconds = (value) => (value ? new Date(value * 1000).toISOString() : null);

async function adminPlayerInfo({ token, username }) {
    await run(this, token, () => {
        const queryHandler = this.server.queryHandler;
        const row = find(queryHandler, username);
        const player = queryHandler.getPlayer(row.username);
        return {
            account: {
                username: row.username,
                rank: row.rank,
                createdAt: seconds(row.creation_date),
                createdFrom: row.creation_ip,
                lastLoginAt: seconds(row.login_date),
                lastLoginFrom: row.login_ip,
                world: this.server.getPlayerWorld(row.username) || 0,
                questPoints: row.quest_points,
                bannedUntil:
                    row.ban_end_date === -1
                        ? 'forever'
                        : row.ban_end_date * 1000 > Date.now()
                        ? new Date(row.ban_end_date * 1000).toISOString()
                        : null,
                mutedUntil:
                    row.mute_end_date === -1
                        ? 'forever'
                        : row.mute_end_date > Date.now()
                        ? new Date(row.mute_end_date).toISOString()
                        : null,
                skills: player.skills
            }
        };
    });
}

async function adminSetRank({ token, username, rank }) {
    await run(this, token, () => {
        if (!RANKS.includes(rank)) throw new Error('rank must be 0, 2 or 3');
        const row = find(this.server.queryHandler, username);
        this.server.queryHandler.database
            .prepare('UPDATE `players` SET `rank` = ? WHERE `id` = ?')
            .run(rank, row.id);
        return { username: row.username, rank };
    });
}

// until: epoch milliseconds, -1 for good, 0 to lift.
async function adminSetBan({ token, username, until }) {
    await run(this, token, () => {
        const row = find(this.server.queryHandler, username);
        const stored = until === -1 ? -1 : Math.max(0, Math.floor(Number(until) / 1000));
        this.server.queryHandler.database
            .prepare('UPDATE `players` SET `ban_end_date` = ? WHERE `id` = ?')
            .run(stored, row.id);
        return { username: row.username };
    });
}

async function adminSetMute({ token, username, until }) {
    await run(this, token, () => {
        const row = find(this.server.queryHandler, username);
        const stored = until === -1 ? -1 : Math.max(0, Math.floor(Number(until)));
        this.server.queryHandler.database
            .prepare('UPDATE `players` SET `mute_end_date` = ? WHERE `id` = ?')
            .run(stored, row.id);
        return { username: row.username };
    });
}

// A new password nobody has seen but the admin who asked; returned once.
async function adminResetPassword({ token, username }) {
    await run(this, token, async () => {
        const row = find(this.server.queryHandler, username);
        // Letters and digits only, and nothing that reads as another
        // character (0/O, 1/l/I): it will be read out or typed by hand.
        const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
        const bytes = crypto.randomBytes(12);
        const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
        const hash = await bcryptHash(password, this.server.config.passwordHashRounds);
        this.server.queryHandler.setPlayerPassword(row.username, hash);
        return { username: row.username, password };
    });
}

module.exports = {
    adminPlayerInfo,
    adminSetRank,
    adminSetBan,
    adminSetMute,
    adminResetPassword
};
