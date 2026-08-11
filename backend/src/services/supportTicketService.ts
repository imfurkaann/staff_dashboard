import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { SupportTicketStatus } from '@prisma/client';

export class SupportTicketService {
  private static async generateNextTicketNo(): Promise<string> {
    const latestTicket = await prisma.supportTicket.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { ticketNo: true },
    });

    let maxIndex = 0;
    if (latestTicket?.ticketNo) {
      const match = latestTicket.ticketNo.match(/^TLP-(\d+)$/);
      if (match) {
        maxIndex = parseInt(match[1], 10);
      }
    }

    const nextNumber = (maxIndex + 1).toString().padStart(3, '0');
    return `TLP-${nextNumber}`;
  }

  public static async createTicket(data: {
    employeeId?: string;
    creatorName: string;
    roomNumber?: string;
    blockName?: string;
    category: string;
    subject: string;
    description: string;
    createdById?: string;
  }) {
    if (!data.subject || !data.subject.trim()) {
      throw new AppError('Talep / Şikayet konusu gereklidir.', 400);
    }
    if (!data.description || !data.description.trim()) {
      throw new AppError('Talep / Şikayet detaylı açıklaması gereklidir.', 400);
    }

    const ticketNo = await this.generateNextTicketNo();

    return prisma.supportTicket.create({
      data: {
        ticketNo,
        employeeId: data.employeeId || null,
        creatorName: data.creatorName || 'Anonim Lojman Sakini',
        roomNumber: data.roomNumber || null,
        blockName: data.blockName || null,
        category: data.category || 'GENEL TALEPLER',
        subject: data.subject.trim(),
        description: data.description.trim(),
        status: SupportTicketStatus.OPEN,
        createdById: data.createdById || null,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        },
      },
    });
  }

  public static async getTickets(filters?: {
    status?: string;
    category?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status as SupportTicketStatus;
    }
    if (filters?.category && filters.category !== 'ALL') {
      where.category = filters.category;
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { ticketNo: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { creatorName: { contains: q, mode: 'insensitive' } },
        { roomNumber: { contains: q, mode: 'insensitive' } },
        { blockName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [tickets, stats] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
          },
          createdBy: {
            select: { id: true, fullName: true, role: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.getTicketStats(),
    ]);

    return { tickets, stats };
  }

  public static async getMyTickets(params: { employeeId?: string; createdById?: string }) {
    const OR: any[] = [];
    if (params.employeeId) OR.push({ employeeId: params.employeeId });
    if (params.createdById) OR.push({ createdById: params.createdById });

    if (OR.length === 0) return [];

    return prisma.supportTicket.findMany({
      where: { OR },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    adminNote?: string
  ) {
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Talep / Şikayet kaydı bulunamadı.', 404);
    }

    const isResolvedOrRejected = status === SupportTicketStatus.RESOLVED || status === SupportTicketStatus.REJECTED;

    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        adminNote: adminNote !== undefined ? adminNote : ticket.adminNote,
        resolvedAt: isResolvedOrRejected ? new Date() : (status === SupportTicketStatus.OPEN ? null : ticket.resolvedAt),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        },
      },
    });
  }

  public static async getTicketStats() {
    const grouped = await prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const stats = {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
    };

    for (const g of grouped) {
      const count = g._count.id;
      stats.total += count;
      if (g.status === SupportTicketStatus.OPEN) stats.open = count;
      if (g.status === SupportTicketStatus.IN_PROGRESS) stats.inProgress = count;
      if (g.status === SupportTicketStatus.RESOLVED) stats.resolved = count;
      if (g.status === SupportTicketStatus.REJECTED) stats.rejected = count;
    }

    return stats;
  }
}
