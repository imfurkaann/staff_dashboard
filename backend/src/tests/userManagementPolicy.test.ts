import test from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { isPasswordChangeRoute } from '../middleware/authMiddleware';
import { validatePassword } from '../security/passwordPolicy';
import {
  assertAccountRoleLink,
  assertSelfUpdateAllowed,
  parseUserListFilters,
  validateUserId,
} from '../security/userManagementPolicy';

const badRequest = (run: () => unknown, statusCode = 400) => assert.throws(
  run,
  (error: unknown) => error instanceof AppError && error.statusCode === statusCode,
);

test('management passwords use one strong bcrypt-safe policy', () => {
  assert.equal(validatePassword('Guvenli!Parola2026'), 'Guvenli!Parola2026');
  badRequest(() => validatePassword('shortA1!'));
  badRequest(() => validatePassword('BUYUKHARF123!'));
  badRequest(() => validatePassword('küçükharf123!'));
  badRequest(() => validatePassword(`Aa1!${'ş'.repeat(40)}`));
});

test('user filters are bounded and reject multi-value query input', () => {
  assert.deepEqual(parseUserListFilters({ role: 'ADMIN', status: 'ACTIVE', page: '2', pageSize: '50' }), {
    search: undefined,
    role: Role.ADMIN,
    isActive: true,
    page: 2,
    pageSize: 50,
  });
  badRequest(() => parseUserListFilters({ role: ['ADMIN', 'STAFF'] }));
  badRequest(() => parseUserListFilters({ status: 'DELETED' }));
  badRequest(() => parseUserListFilters({ pageSize: '1000' }));
});

test('employee account and self-protection role boundaries fail closed', () => {
  assert.doesNotThrow(() => assertAccountRoleLink(true, Role.STAFF, Role.STAFF));
  badRequest(() => assertAccountRoleLink(true, Role.STAFF, Role.ADMIN), 409);
  badRequest(() => assertAccountRoleLink(false, Role.HOUSING_STAFF, Role.STAFF), 409);
  badRequest(() => assertSelfUpdateAllowed('same', 'same', Role.ADMIN, Role.HOUSING_MANAGER, true), 409);
  badRequest(() => assertSelfUpdateAllowed('same', 'same', Role.ADMIN, Role.ADMIN, false), 409);
});

test('user identifiers require UUID values', () => {
  assert.equal(validateUserId('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
  badRequest(() => validateUserId('../admin'));
});

test('temporary-password sessions can only inspect the session and change password', () => {
  assert.equal(isPasswordChangeRoute('/api/auth', '/me'), true);
  assert.equal(isPasswordChangeRoute('/api/auth', '/change-password'), true);
  assert.equal(isPasswordChangeRoute('/api/users', '/'), false);
  assert.equal(isPasswordChangeRoute('/api/tickets', '/my-tickets'), false);
  assert.equal(isPasswordChangeRoute('/api/auth', '/login'), false);
});
