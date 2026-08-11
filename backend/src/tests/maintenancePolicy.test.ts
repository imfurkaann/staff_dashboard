import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import { assertClosedMaintenanceEditable, assertMaintenanceTransition, validateMaintenanceId } from '../security/maintenancePolicy';

test('maintenance identifiers require UUID values', () => {
  assert.equal(validateMaintenanceId('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
  assert.throws(() => validateMaintenanceId('../fault'), (error: unknown) => error instanceof AppError && error.statusCode === 400);
});

test('only full-update actors may reopen resolved maintenance', () => {
  assert.throws(() => assertMaintenanceTransition('RESOLVED', 'OPEN', false), (error: unknown) => error instanceof AppError && error.statusCode === 403);
  assert.doesNotThrow(() => assertMaintenanceTransition('RESOLVED', 'OPEN', true));
  assert.doesNotThrow(() => assertMaintenanceTransition('RESOLVED', 'CLOSED', false));
});

test('closed maintenance is immutable for operational users', () => {
  assert.throws(() => assertClosedMaintenanceEditable('CLOSED', false), (error: unknown) => error instanceof AppError && error.statusCode === 403);
  assert.doesNotThrow(() => assertClosedMaintenanceEditable('CLOSED', true));
});
