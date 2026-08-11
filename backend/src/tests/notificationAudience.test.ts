import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActiveResidentStaffWhere } from '../security/notificationAudience';

test('notification audience always requires an active staff account and an occupied bed', () => {
  assert.deepEqual(buildActiveResidentStaffWhere(), {
    isActive: true,
    role: 'STAFF',
    employee: {
      is: {
        isDeleted: false,
        beds: { some: { isOccupied: true } },
      },
    },
  });
});

test('specific notification targets are intersected with the resident audience', () => {
  const userIds = ['resident-user', 'non-resident-user'];
  assert.deepEqual(buildActiveResidentStaffWhere(userIds), {
    id: { in: userIds },
    isActive: true,
    role: 'STAFF',
    employee: {
      is: {
        isDeleted: false,
        beds: { some: { isOccupied: true } },
      },
    },
  });
});
