import { NextFunction, Response } from 'express';
import prisma from '../db/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class DashboardController {
  public static async summary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const [totalEmployees, pendingEmployees, residentEmployees, totalBeds, occupiedBeds, openMaintenance, blocks] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { status: 'PENDING_ASSIGNMENT' } }),
        prisma.employee.count({ where: { status: 'RESIDENT' } }),
        prisma.bed.count(),
        prisma.bed.count({ where: { isOccupied: true } }),
        prisma.maintenanceLog.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.block.findMany({
          select: {
            id: true,
            name: true,
            genderPolicy: true,
            rooms: { select: { beds: { select: { isOccupied: true } } } },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalEmployees,
          pendingEmployees,
          residentEmployees,
          totalBeds,
          occupiedBeds,
          openMaintenance,
          blocks: blocks.map((block) => {
            const beds = block.rooms.flatMap((room) => room.beds);
            return { id: block.id, name: block.name, genderPolicy: block.genderPolicy, totalBeds: beds.length, occupiedBeds: beds.filter((bed) => bed.isOccupied).length };
          }),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
