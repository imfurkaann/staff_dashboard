import { NextFunction, Response } from 'express';
import prisma from '../db/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { formatIstanbulDate, parseIstanbulDateBoundary } from '../utils/dateTime';
import { hasPermission, permissions } from '../security/permissions';

const countBy = <T extends string>(rows: Array<{ status: T; _count: number }>, status: T) =>
  rows.find((row) => row.status === status)?._count || 0;

export class DashboardController {
  public static async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const role = req.user?.role;
      const todayKey = formatIstanbulDate();
      const todayStart = parseIstanbulDateBoundary(todayKey, false)!;
      const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const monthStart = parseIstanbulDateBoundary(`${todayKey.slice(0, 7)}-01`, false)!;
      const trendStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      const overdueBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const maySeeEmployees = hasPermission(role, permissions.EMPLOYEE_VIEW);
      const maySeeMaintenance = hasPermission(role, permissions.MAINTENANCE_VIEW);
      const maySeeVisitors = hasPermission(role, permissions.VISITOR_VIEW);
      const maySeeTickets = hasPermission(role, permissions.TICKET_VIEW);
      const maySeeSharedAssets = hasPermission(role, permissions.SHARED_ASSET_VIEW);
      const maySeeNotifications = hasPermission(role, permissions.NOTIFICATION_VIEW);
      const maySeeCleaning = hasPermission(role, permissions.CLEANING_MANAGE);
      const maySeeUsers = hasPermission(role, permissions.USER_MANAGE);

      const [
        roomGroups, totalBeds, occupiedBeds, blocks, employeeGroups, departments,
        maintenanceGroups, urgentMaintenance, resolvedThisMonth, recentMaintenance, maintenanceTrend,
        visitorsInside, visitorsToday, overdueVisitors, visitorTrend, ticketGroups, recentTickets, ticketTrend,
        sharedAssetGroups, sharedUsesToday, cleaningGroups, cleanedToday, recentNotifications, activeUsers, occupancyTrend,
        checkInsToday, checkOutsToday, attentionRooms, overdueSharedAssets, cleaningTasks,
      ] = await Promise.all([
        prisma.room.groupBy({ by: ['status'], _count: true }),
        prisma.bed.count(),
        prisma.bed.count({ where: { isOccupied: true } }),
        prisma.block.findMany({
          select: { id: true, name: true, genderPolicy: true, rooms: { select: { status: true, beds: { select: { isOccupied: true } } } } },
          orderBy: { name: 'asc' },
        }),
        maySeeEmployees ? prisma.employee.groupBy({ by: ['status'], where: { isDeleted: false }, _count: true }) : Promise.resolve([]),
        maySeeEmployees ? prisma.employee.groupBy({ by: ['department'], where: { isDeleted: false, status: 'RESIDENT' }, _count: true, orderBy: { _count: { department: 'desc' } }, take: 6 }) : Promise.resolve([]),
        maySeeMaintenance ? prisma.maintenanceLog.groupBy({ by: ['status'], _count: true }) : Promise.resolve([]),
        maySeeMaintenance ? prisma.maintenanceLog.count({ where: { priority: 'URGENT', status: { in: ['OPEN', 'IN_PROGRESS'] } } }) : Promise.resolve(0),
        maySeeMaintenance ? prisma.maintenanceLog.count({ where: { resolvedAt: { gte: monthStart }, status: { in: ['RESOLVED', 'CLOSED'] } } }) : Promise.resolve(0),
        maySeeMaintenance ? prisma.maintenanceLog.findMany({
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true, title: true, priority: true, status: true, createdAt: true, room: { select: { roomNumber: true, block: { select: { name: true } } } } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], take: 5,
        }) : Promise.resolve([]),
        maySeeMaintenance ? prisma.maintenanceLog.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }) : Promise.resolve([]),
        maySeeVisitors ? prisma.visitor.count({ where: { isDeleted: false, status: 'INSIDE' } }) : Promise.resolve(0),
        maySeeVisitors ? prisma.visitor.count({ where: { isDeleted: false, entryTime: { gte: todayStart, lt: tomorrowStart } } }) : Promise.resolve(0),
        maySeeVisitors ? prisma.visitor.count({ where: { isDeleted: false, status: 'INSIDE', entryTime: { lt: overdueBoundary } } }) : Promise.resolve(0),
        maySeeVisitors ? prisma.visitor.findMany({ where: { isDeleted: false, entryTime: { gte: trendStart } }, select: { entryTime: true } }) : Promise.resolve([]),
        maySeeTickets ? prisma.supportTicket.groupBy({ by: ['status'], _count: true }) : Promise.resolve([]),
        maySeeTickets ? prisma.supportTicket.findMany({ select: { id: true, ticketNo: true, subject: true, category: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 4 }) : Promise.resolve([]),
        maySeeTickets ? prisma.supportTicket.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }) : Promise.resolve([]),
        maySeeSharedAssets ? prisma.sharedAsset.groupBy({ by: ['status'], _count: true }) : Promise.resolve([]),
        maySeeSharedAssets ? prisma.sharedAssetLog.count({ where: { action: 'CHECK_OUT', createdAt: { gte: todayStart, lt: tomorrowStart } } }) : Promise.resolve(0),
        maySeeCleaning ? prisma.roomCleaningLog.groupBy({ by: ['status'], where: { isDeleted: false }, _count: true }) : Promise.resolve([]),
        maySeeCleaning ? prisma.roomCleaningLog.count({ where: { isDeleted: false, status: 'CLEANED', cleanedAt: { gte: todayStart, lt: tomorrowStart } } }) : Promise.resolve(0),
        maySeeNotifications ? prisma.notification.findMany({ where: { isDeleted: false }, select: { id: true, title: true, priority: true, targetType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 4 }) : Promise.resolve([]),
        maySeeUsers ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),
        prisma.occupancyLog.findMany({ where: { checkInDate: { gte: trendStart } }, select: { checkInDate: true } }),
        prisma.occupancyLog.count({ where: { checkInDate: { gte: todayStart, lt: tomorrowStart } } }),
        prisma.occupancyLog.count({ where: { checkOutDate: { gte: todayStart, lt: tomorrowStart } } }),
        prisma.room.findMany({
          where: { status: { in: ['NEEDS_CLEANING', 'OUT_OF_ORDER'] } },
          select: { id: true, roomNumber: true, status: true, block: { select: { name: true } } },
          orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }], take: 6,
        }),
        maySeeSharedAssets ? prisma.sharedAsset.count({ where: { status: 'LOANED', expectedReturnDate: { lt: new Date() } } }) : Promise.resolve(0),
        maySeeCleaning ? prisma.roomCleaningLog.findMany({
          where: { isDeleted: false, status: { in: ['NEEDS_CLEANING', 'IN_PROGRESS'] } },
          select: { id: true, status: true, requestedAt: true, cleanedBy: true, room: { select: { roomNumber: true, block: { select: { name: true } } } } },
          orderBy: { requestedAt: 'asc' }, take: 6,
        }) : Promise.resolve([]),
      ]);

      const roomCount = roomGroups.reduce((sum, row) => sum + row._count, 0);
      const totalEmployees = employeeGroups.reduce((sum, row) => sum + row._count, 0);
      const dayKeys = Array.from({ length: 7 }, (_, index) => formatIstanbulDate(new Date(trendStart.getTime() + index * 24 * 60 * 60 * 1000)));
      const countDates = (dates: Date[]) => dayKeys.map((date) => dates.filter((item) => formatIstanbulDate(item) === date).length);
      const occupancyCounts = countDates(occupancyTrend.map((row) => row.checkInDate));
      const maintenanceCounts = countDates(maintenanceTrend.map((row) => row.createdAt));
      const visitorCounts = countDates(visitorTrend.map((row) => row.entryTime));
      const ticketCounts = countDates(ticketTrend.map((row) => row.createdAt));

      res.json({ success: true, data: {
        generatedAt: new Date(),
        rooms: {
          total: roomCount, ready: countBy(roomGroups, 'READY'), needsCleaning: countBy(roomGroups, 'NEEDS_CLEANING'), outOfOrder: countBy(roomGroups, 'OUT_OF_ORDER'),
          attention: attentionRooms.map((room) => ({ id: room.id, roomLabel: `${room.block.name} / Oda ${room.roomNumber}`, status: room.status })),
        },
        occupancy: { totalBeds, occupiedBeds, availableBeds: Math.max(0, totalBeds - occupiedBeds), checkInsToday, checkOutsToday },
        blocks: blocks.map((block) => {
          const beds = block.rooms.flatMap((room) => room.beds);
          return { id: block.id, name: block.name, genderPolicy: block.genderPolicy, roomCount: block.rooms.length, totalBeds: beds.length, occupiedBeds: beds.filter((bed) => bed.isOccupied).length, attentionRooms: block.rooms.filter((room) => room.status !== 'READY').length };
        }),
        activity: dayKeys.map((date, index) => ({ date, occupancy: occupancyCounts[index], maintenance: maySeeMaintenance ? maintenanceCounts[index] : 0, visitors: maySeeVisitors ? visitorCounts[index] : 0, tickets: maySeeTickets ? ticketCounts[index] : 0 })),
        employees: maySeeEmployees ? { total: totalEmployees, resident: countBy(employeeGroups, 'RESIDENT'), pending: countBy(employeeGroups, 'PENDING_ASSIGNMENT'), onLeave: countBy(employeeGroups, 'ON_LEAVE'), checkedOut: countBy(employeeGroups, 'CHECKED_OUT'), departments: departments.map((row) => ({ name: row.department, count: row._count })) } : null,
        maintenance: maySeeMaintenance ? { open: countBy(maintenanceGroups, 'OPEN'), inProgress: countBy(maintenanceGroups, 'IN_PROGRESS'), resolved: countBy(maintenanceGroups, 'RESOLVED'), closed: countBy(maintenanceGroups, 'CLOSED'), urgent: urgentMaintenance, resolvedThisMonth, recent: recentMaintenance.map((item) => ({ ...item, roomLabel: `${item.room.block.name} / Oda ${item.room.roomNumber}` })) } : null,
        visitors: maySeeVisitors ? { inside: visitorsInside, todayEntries: visitorsToday, overdue: overdueVisitors } : null,
        tickets: maySeeTickets ? { open: countBy(ticketGroups, 'OPEN'), inProgress: countBy(ticketGroups, 'IN_PROGRESS'), resolved: countBy(ticketGroups, 'RESOLVED'), rejected: countBy(ticketGroups, 'REJECTED'), recent: recentTickets } : null,
        sharedAssets: maySeeSharedAssets ? { total: sharedAssetGroups.reduce((sum, row) => sum + row._count, 0), available: countBy(sharedAssetGroups, 'AVAILABLE'), loaned: countBy(sharedAssetGroups, 'LOANED'), maintenance: countBy(sharedAssetGroups, 'MAINTENANCE'), usesToday: sharedUsesToday, overdue: overdueSharedAssets } : null,
        cleaning: maySeeCleaning ? {
          waiting: countBy(cleaningGroups, 'NEEDS_CLEANING'), inProgress: countBy(cleaningGroups, 'IN_PROGRESS'), cleanedToday,
          tasks: cleaningTasks.map((task) => ({ id: task.id, roomLabel: `${task.room.block.name} / Oda ${task.room.roomNumber}`, status: task.status, requestedAt: task.requestedAt, cleanedBy: task.cleanedBy })),
        } : null,
        notifications: maySeeNotifications ? { recent: recentNotifications } : null,
        users: maySeeUsers ? { active: activeUsers } : null,
      } });
    } catch (error) { next(error); }
  }
}
