import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrismaWriteArgs, writeNormalizationPolicy } from '../db/writeNormalization';

test('central policy normalizes human-entered fields on create and update', () => {
  const args = { data: { title: '  su arızası ', description: ' musluk Akıtıyor ', assignedTo: ' furkan çelik ' } };
  normalizePrismaWriteArgs('MaintenanceLog', 'create', args);
  assert.deepEqual(args.data, { title: 'SU ARIZASI', description: 'MUSLUK AKITIYOR', assignedTo: 'FURKAN ÇELİK' });
});

test('central policy normalizes notification content and Turkish characters', () => {
  const args = { data: { title: 'duyuru', message: 'ışıklar sönecek' } };
  normalizePrismaWriteArgs('Notification', 'update', args);
  assert.deepEqual(args.data, { title: 'DUYURU', message: 'IŞIKLAR SÖNECEK' });
});

test('central policy preserves case-sensitive and technical fields', () => {
  const args = { data: { endpoint: 'https://Push.Example/AaBb', p256dh: 'AaBbCc', auth: 'XyZ' } };
  normalizePrismaWriteArgs('PushSubscription', 'upsert', { create: args.data, update: args.data });
  assert.equal(args.data.endpoint, 'https://Push.Example/AaBb');
  assert.equal(args.data.p256dh, 'AaBbCc');
  assert.equal(args.data.auth, 'XyZ');
});

test('central policy keeps routing values and enums outside uppercase conversion', () => {
  assert.equal(writeNormalizationPolicy.Notification.targetValue, undefined);
  assert.equal(writeNormalizationPolicy.Employee.photoUrl, undefined);
  assert.equal(writeNormalizationPolicy.InventoryItem.status, undefined);
});
