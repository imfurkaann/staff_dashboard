const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const dist = path.resolve(__dirname, '../backend/dist');
let user = { id: 'former-manager', role: 'HOUSING_MANAGER', isActive: true, passwordHash: 'original', mustChangePassword: false };
let reads = 0;
let connection;
class FakeWSS extends EventEmitter {
  clients = new Set();
  handleUpgrade(request, socket, head, callback) {
    connection = new EventEmitter();
    Object.assign(connection, { readyState: 1, messages: [], send(value) { this.messages.push(value); } });
    this.clients.add(connection);
    callback(connection);
  }
  close() {}
}
const moduleObject = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(dist, 'websocket/ticketSocket.js'), 'utf8'), {
  exports: moduleObject.exports, module: moduleObject, URL, Date, console,
  setInterval: () => ({ unref() {} }), clearInterval() {},
  require(name) {
    if (name === 'ws') return { WebSocketServer: FakeWSS, WebSocket: { OPEN: 1 } };
    if (name === 'jsonwebtoken') return { verify: () => ({ id: user.id, pwd: 'original' }) };
    if (name === '../db/prisma') return { user: { findUnique: async () => { reads++; return { ...user }; } } };
    if (name === '../config') return { config: { cookie: { name: 'session' }, jwt: { secret: 'unused' }, cors: { allowedOrigins: ['https://review.invalid'] }, nodeEnv: 'production' } };
    if (name === '../services/authService') return { AuthService: { passwordVersion: value => value } };
    if (name === '../security/permissions') return require(path.join(dist, 'security/permissions.js'));
    return require(name);
  },
});
(async () => {
  const server = new EventEmitter();
  moduleObject.exports.initTicketWebSocket(server);
  await server.listeners('upgrade')[0]({ url: '/ws/tickets', headers: { cookie: 'session=valid', origin: 'https://review.invalid' } }, { destroyed: false }, Buffer.alloc(0));
  assert.equal(connection.canViewAll, true);
  user = { ...user, isActive: false, role: 'STAFF', passwordHash: 'reset' };
  moduleObject.exports.broadcastTicketEvent('TICKET_CREATED', { createdById: 'another-user', description: 'PRIVATE TEST TICKET' });
  assert.equal(connection.messages.length, 1);
  assert.equal(reads, 1);
  console.log('REPRODUCED: disabled former manager still receives another user\'s ticket on an existing socket');
  server.emit('close');
})().catch(error => { console.error(error); process.exitCode = 1; });
