const { eventsOf } = require('../admin/events');

async function chat({ player }, { message }) {
    if (player.canChat()) {
        player.lastChat = Date.now();
        player.broadcastChat(message);
        eventsOf(player).emit('chat', player.username, { message, x: player.x, y: player.y });
    }
}

module.exports = { chat };
