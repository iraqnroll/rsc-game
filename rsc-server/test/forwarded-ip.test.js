const test = require('node:test');
const assert = require('node:assert/strict');
const { forwardedIP } = require('../src/server');

const request = (remoteAddress, realIP) => ({
    socket: { remoteAddress },
    headers: realIP === undefined ? {} : { 'x-real-ip': realIP }
});

test('the proxy on this machine says who the player is', () => {
    assert.equal(forwardedIP(request('127.0.0.1', '203.0.113.7')), '203.0.113.7');
    assert.equal(forwardedIP(request('::1', '2001:db8::1')), '2001:db8::1');
    assert.equal(forwardedIP(request('::ffff:127.0.0.1', '::ffff:198.51.100.2')), '198.51.100.2');
});

test('nobody else can claim an address', () => {
    assert.equal(forwardedIP(request('192.168.0.50', '1.2.3.4')), undefined);
    assert.equal(forwardedIP(request('127.0.0.1')), undefined);
    assert.equal(forwardedIP(request('127.0.0.1', 'not an ip; drop table')), undefined);
});
