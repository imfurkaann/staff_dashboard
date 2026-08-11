import { Request, Response, NextFunction } from 'express';
import { SupportTicketService } from '../services/supportTicketService';
import { SupportTicketStatus } from '@prisma/client';

export class SupportTicketController {
  public static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const {
        employeeId,
        creatorName,
        roomNumber,
        blockName,
        category,
        subject,
        description,
      } = req.body;

      const ticket = await SupportTicketService.createTicket({
        employeeId,
        creatorName: creatorName || user?.fullName,
        roomNumber,
        blockName,
        category,
        subject,
        description,
        createdById: user?.userId || user?.id,
      });

      res.status(201).json({
        success: true,
        message: 'Talep / Şikayetiniz başarıyla oluşturuldu.',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, category, search } = req.query;

      const result = await SupportTicketService.getTickets({
        status: status as string,
        category: category as string,
        search: search as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;

      const tickets = await SupportTicketService.getMyTickets({
        employeeId: user?.employeeId,
        createdById: user?.userId || user?.id,
      });

      res.json({
        success: true,
        data: tickets,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateTicketStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, adminNote } = req.body;

      const updated = await SupportTicketService.updateTicketStatus(
        id,
        status as SupportTicketStatus,
        adminNote
      );

      res.json({
        success: true,
        message: 'Talep / Şikayet durumu güncellendi.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}
