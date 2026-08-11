import { Prisma } from '@prisma/client';

/**
 * Notifications are exclusively for personnel currently assigned to an occupied bed.
 * Keeping this filter centralized prevents individual target types from bypassing
 * the residency rule.
 */
export function buildActiveResidentStaffWhere(userIds?: string[]): Prisma.UserWhereInput {
  return {
    ...(userIds ? { id: { in: userIds } } : {}),
    isActive: true,
    role: 'STAFF',
    employee: {
      is: {
        isDeleted: false,
        beds: { some: { isOccupied: true } },
      },
    },
  };
}
