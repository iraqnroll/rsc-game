const NOTE_ID = 1291;

async function onInventoryCommand(player, item) {
    if (item.id !== NOTE_ID) {
        return false;
    }

    player.message('@que@The note seems to be written by Ivan in a rush :');
    player.message('@que@"Key to the gate is under the bed - Ivan"');

    return true;
}

module.exports = { onInventoryCommand };
