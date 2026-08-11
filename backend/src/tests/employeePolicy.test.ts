import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import { validateEmployeeDepartmentFilter, validateEmployeeFilterStatus, validateEmployeeGenderFilter, validateEmployeeId } from '../security/employeePolicy';

const bad = (run: () => unknown) => assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 400);

test('employee filters reject unknown and multi-value inputs', () => {
  assert.equal(validateEmployeeFilterStatus('RESIDENT'), 'RESIDENT');
  assert.equal(validateEmployeeGenderFilter('Female'), 'Female');
  assert.equal(validateEmployeeDepartmentFilter('Teknik Servis / Bakım'), 'Teknik Servis / Bakım');
  bad(() => validateEmployeeFilterStatus('FORGED'));
  bad(() => validateEmployeeGenderFilter(['Male', 'Female']));
  bad(() => validateEmployeeDepartmentFilter('../all'));
});

test('employee identifiers require UUID values', () => {
  assert.equal(validateEmployeeId('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
  bad(() => validateEmployeeId('not-an-id'));
});
