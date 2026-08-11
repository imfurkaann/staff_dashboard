import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import {
  normalizeRoomType, validateCleaningStatus, validateInventoryExportFilter,
  validateOccupancyExportFilter, validateRoomCapacity, validateRoomFloor,
} from '../security/roomPolicy';

function badRequest(run: () => unknown) {
  assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 400);
}

test('room types and capacities preserve personnel-room invariants', () => {
  assert.equal(normalizeRoomType(' personel_odası '), 'PERSONEL_ODASI');
  assert.equal(validateRoomCapacity(2, 'PERSONEL_ODASI'), 2);
  assert.equal(validateRoomCapacity(0, 'DEPO'), 0);
  badRequest(() => validateRoomCapacity(0, 'PERSONEL_ODASI'));
  badRequest(() => validateRoomCapacity(2, 'DEPO'));
  badRequest(() => normalizeRoomType('SERVER_EXEC'));
});

test('room floor, cleaning and export filters reject malformed values', () => {
  assert.equal(validateRoomFloor(0), 0);
  assert.equal(validateCleaningStatus('CLEANED'), 'CLEANED');
  assert.equal(validateOccupancyExportFilter('ACTIVE'), 'ACTIVE');
  assert.equal(validateInventoryExportFilter('NEEDS_ATTENTION'), 'NEEDS_ATTENTION');
  badRequest(() => validateRoomFloor(1.5));
  badRequest(() => validateCleaningStatus('DELETED'));
  badRequest(() => validateOccupancyExportFilter('../all'));
  badRequest(() => validateInventoryExportFilter('UNKNOWN'));
});
