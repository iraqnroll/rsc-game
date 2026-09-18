const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventLog, eventsOf } = require('../src/admin/events');
const { Control, COMMANDS } = require('../src/admin/control');

const tmpSpool = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rsc-events-')), 'world-1.jsonl');

test('events are numbered in order and kept until acknowledged', () => {
    const log = new EventLog({ spool: tmpSpool() });
    const a = log.emit('login', 'bob', { ip: '1.2.3.4' });
    const b = log.emit('chat', 'bob', { message: 'hi' });
    const c = log.emit('pm', 'bob', { message: 'psst' }, 'alice');
    assert.ok(a.seq < b.seq && b.seq < c.seq);
    assert.deepEqual(log.since(0).map((e) => e.type), ['login', 'chat', 'pm']);
    assert.deepEqual(log.since(a.seq, 1).map((e) => e.type), ['chat']);

    assert.deepEqual(log.ack(b.seq), { remaining: 1 });
    assert.deepEqual(log.since(0).map((e) => e.type), ['pm']);
    assert.equal(c.other, 'alice');
});

test('a restart finds what the editor had not collected, and numbers after it', () => {
    const spool = tmpSpool();
    const first = new EventLog({ spool });
    const kept = first.emit('login', 'bob');
    first.emit('chat', 'bob', { message: 'one' });
    first.ack(kept.seq);

    // Simulate a crash mid-write: a torn last line.
    fs.appendFileSync(spool, '{"seq": 12');
    const second = new EventLog({ spool });
    assert.deepEqual(second.since(0).map((e) => e.details.message), ['one']);
    const next = second.emit('logout', 'bob');
    assert.ok(next.seq > second.since(0)[0].seq);
});

test('a world with no editor attached keeps working', () => {
    const log = new EventLog();
    log.emit('chat', 'bob', { message: 'no spool' });
    assert.equal(log.since(0).length, 1);
    assert.doesNotThrow(() => eventsOf({}).emit('chat', 'bob'));
    assert.doesNotThrow(() => eventsOf(null).emit('chat', 'bob'));
});

test('the socket serves events in order and drops them on ack', () => {
    const events = new EventLog({ spool: tmpSpool() });
    const control = new Control({ events, world: { players: { *getAll() {}, length: 0 } }, config: {} });
    const one = events.emit('login', 'bob');
    events.emit('logout', 'bob');
    assert.deepEqual(COMMANDS.eventsSince(control, { seq: 0 }).events.map((e) => e.type), ['login', 'logout']);
    COMMANDS.ackEvents(control, { seq: one.seq });
    assert.deepEqual(COMMANDS.eventsSince(control, { seq: 0 }).events.map((e) => e.type), ['logout']);
});
