import { Request, Response, NextFunction } from 'express';
import { SupportTicketService } from '../services/supportTicketService';
import { SupportTicketStatus } from '@prisma/client';
import {
  validateTicketCreateInput,
  validateTicketFilters,
  validateTicketId,
  validateTicketStatusInput,
} from '../security/ticketPolicy';

export class SupportTicketController {
  public static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const input = validateTicketCreateInput(req.body);

      const ticket = await SupportTicketService.createTicket({
        ...input,
        createdById: user.id,
        creatorName: user.fullName,
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
      const filters = validateTicketFilters(req.query);
      const result = await SupportTicketService.getTickets(filters);

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
        createdById: user.id,
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
      const id = validateTicketId(req.params.id);
      const { status, adminNote } = validateTicketStatusInput(req.body);

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
