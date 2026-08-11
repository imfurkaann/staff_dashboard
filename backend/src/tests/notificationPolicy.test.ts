import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import {
  validateIdempotencyKey,
  validateNotificationId,
  validateNotificationQuery,
  validateNotificationSendInput,
} from '../security/notificationPolicy';

function expectBadRequest(run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 400 && message.test(error.message));
}

test('notification input is canonical and ALL cannot persist a forged target', () => {
  assert.deepEqual(validateNotificationSendInput({
    title: '  Su kesintisi ', message: '  Saat 10:00 ile 12:00 arası  ', targetType: 'ALL', targetValue: '["forged"]',
  }), {
    title: 'SU KESİNTİSİ', message: 'SAAT 10:00 İLE 12:00 ARASI', priority: 'NORMAL', targetType: 'ALL', targetValues: [], targetValue: null,
  });
});

test('notification target lists reject malformed JSON, objects and invalid user identifiers', () => {
  expectBadRequest(() => validateNotificationSendInput({ title: 'x', message: 'y', targetType: 'BLOCK', targetValue: '[broken' }), /JSON/i);
  expectBadRequest(() => validateNotificationSendInput({ title: 'x', message: 'y', targetType: 'DEPARTMENT', targetValue: '{"name":"IT"}' }), /dizi/i);
  expectBadRequest(() => validateNotificationSendInput({ title: 'x', message: 'y', targetType: 'SPECIFIC_USERS', targetValue: '["../admin"]' }), /kimliği/i);
});

test('notification target lists are deduplicated and stored canonically', () => {
  assert.deepEqual(validateNotificationSendInput({
    title: 'x', message: 'y', priority: 'URGENT', targetType: 'BLOCK', targetValue: '[" A BLOK ","A BLOK"]',
  }).targetValues, ['A BLOK']);
});

test('notification filters validate enums, paging and Istanbul end-of-day', () => {
  const query = validateNotificationQuery({ page: '2', pageSize: '25', dateStart: '2026-08-11', dateEnd: '2026-08-11' });
  assert.equal(query.dateStart?.toISOString(), '2026-08-10T21:00:00.000Z');
  assert.equal(query.dateEnd?.toISOString(), '2026-08-11T20:59:59.999Z');
  expectBadRequest(() => validateNotificationQuery({ priority: 'CRITICAL' }), /öncelik/i);
  expectBadRequest(() => validateNotificationQuery({ page: ['1', '2'] }), /tek bir/i);
  expectBadRequest(() => validateNotificationQuery({ dateStart: '2026-08-12', dateEnd: '2026-08-11' }), /sonra/i);
  assert.equal(validateNotificationQuery({ targetType: 'ALL' }).targetType, 'ALL');
  assert.equal(validateNotificationQuery({ targetType: 'ANY' }).targetType, undefined);
});

test('notification and idempotency identifiers require UUID values', () => {
  const uuid = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(validateNotificationId(uuid), uuid);
  assert.equal(validateIdempotencyKey(uuid), uuid);
  expectBadRequest(() => validateNotificationId('../all'), /geçersiz/i);
  expectBadRequest(() => validateIdempotencyKey('retry-1'), /UUID/i);
});
