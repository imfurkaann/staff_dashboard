import test from 'node:test';
import assert from 'node:assert/strict';
import { canReceiveTicketEvent } from '../websocket/ticketSocket';

test('ticket viewers receive all events', () => {
  assert.equal(canReceiveTicketEvent({ userId: 'manager', canViewAll: true }, { createdById: 'someone-else' }), true);
});

test('staff only receive events belonging to their user or employee record', () => {
  const staff = { userId: 'user-1', employeeId: 'employee-1', canViewAll: false };
  assert.equal(canReceiveTicketEvent(staff, { createdById: 'user-1' }), true);
  assert.equal(canReceiveTicketEvent(staff, { employeeId: 'employee-1' }), true);
  assert.equal(canReceiveTicketEvent(staff, { createdById: 'user-2', employeeId: 'employee-2' }), false);
});
