import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { SOCKET_EVENTS as E } from '@hackatec/shared';
import { registerSocketHandlers } from '../../server/dist/socket/index.js';
import { SessionStore } from '../../server/dist/socket/SessionStore.js';
import { RoomManager } from '../../server/dist/rooms/RoomManager.js';

// Isolated real server, with a short grace period for expiry checks.
const http = createServer();
const io = new Server(http);
const rooms = registerSocketHandlers(io, new RoomManager(), new SessionStore(1200));
const clients = [];
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${http.address().port}`;
function event(socket, name) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timeout: ${name}`)); }, 5000);
        function handler(data) { clearTimeout(timer); resolve(data); }
        socket.once(name, handler);
    });
}
async function until(predicate) {
    for (let i = 0; i < 150; i++) {
        if (predicate()) return;
        await delay(30);
    }
    assert.fail('Condition did not become true');
}
async function client(token) {
    const socket = connect(url, { autoConnect: false, reconnection: false, transports: ['websocket'], auth: { sessionToken: token } });
    clients.push(socket);
    const ready = event(socket, E.CONNECTION_READY);
    socket.connect();
    return { socket, ready: await ready };
}
async function join(socket, roomId = 'recovery') {
    const state = event(socket, E.ROOM_STATE);
    socket.emit(E.ROOM_JOIN, { roomId, playerName: 'Tester', profileId: 'recovery-test-profile' });
    return state;
}
try {
    const a = await client();
    const first = await join(a.socket);
    const b = await client();
    await join(b.socket);
    const outside = await client();
    await join(outside.socket, 'isolated');
    let leaked = false;
    outside.socket.on(E.PLAYER_LEFT, data => { if (data.playerId === first.selfId) leaked = true; });
    outside.socket.on(E.PLAYER_MOVED, data => { if (data.player.id === first.selfId) leaked = true; });
    let duplicateJoins = 0;
    b.socket.on(E.PLAYER_JOINED, () => duplicateJoins++);
    const player = rooms.getPlayer(first.selfId);
    Object.assign(player, { x: 100, y: 190, hp: 60, kills: 4, deaths: 2 });
    a.socket.io.engine.close();
    await until(() => player.connected === false);
    assert.equal(rooms.getPlayers('recovery').length, 2);
    const resumed = await client(a.ready.sessionToken);
    assert.equal(resumed.ready.recovered, true);
    const second = await join(resumed.socket);
    assert.equal(second.selfId, first.selfId);
    assert.notEqual(resumed.socket.id, first.selfId);
    assert.deepEqual(second.map, first.map);
    const self = second.players.find(p => p.id === first.selfId);
    assert.deepEqual([self.x, self.y, self.hp, self.kills, self.deaths], [100, 190, 60, 4, 2]);
    assert.equal(duplicateJoins, 0);
    assert.equal(JSON.stringify(second).includes(a.ready.sessionToken), false);
    const duplicate = await client(a.ready.sessionToken);
    assert.equal(duplicate.ready.recovered, false);
    duplicate.socket.disconnect();
    assert.equal(rooms.getPlayer(first.selfId), player);

    // A disconnected character remains vulnerable; death and respawn survive recovery.
    // Remove random obstacles only in this isolated test arena for a deterministic shot.
    rooms.getMap('recovery').obstacles.length = 0;
    const attacker = rooms.getPlayer(b.socket.id);
    Object.assign(attacker, { x: 100, y: 190 });
    Object.assign(player, { x: 218, y: 190, hp: 20 });
    resumed.socket.io.engine.close();
    await until(() => player.connected === false);
    b.socket.emit(E.PLAYER_SHOOT, { weapon: 'pistol', angle: 0 });
    await until(() => player.alive === false);
    const dead = await client(a.ready.sessionToken);
    const deadState = await join(dead.socket);
    assert.equal(deadState.players.find(p => p.id === first.selfId).alive, false);
    assert.equal(player.deaths, 3);
    await until(() => player.alive === true);
    assert.equal(player.hp, 100);
    assert.equal(player.kills, 4);
    assert.equal(leaked, false);

    // Explicit leave invalidates the credential immediately.
    dead.socket.disconnect();
    await until(() => !rooms.getPlayer(first.selfId));
    const fresh = await client(a.ready.sessionToken);
    assert.equal(fresh.ready.recovered, false);
    const freshState = await join(fresh.socket, 'expiry');
    fresh.socket.io.engine.close();
    await until(() => rooms.getPlayer(freshState.selfId)?.connected === false);
    assert.equal(rooms.hasRoom('expiry'), true);
    await until(() => !rooms.hasRoom('expiry'));
    const expired = await client(fresh.ready.sessionToken);
    assert.equal(expired.ready.recovered, false);
    assert.notEqual((await join(expired.socket, 'expiry')).selfId, freshState.selfId);
    console.log('PASS: transport recovery, private credentials, stable state/map, no duplicate joins, isolation, offline damage, death/respawn, explicit leave and expiry.');
} finally {
    clients.forEach(socket => socket.disconnect());
    await new Promise(resolve => io.close(resolve));
}
