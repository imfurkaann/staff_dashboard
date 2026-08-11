import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { SupportTicketStatus } from '@prisma/client';
import { broadcastTicketEvent } from '../websocket/ticketSocket';

export class SupportTicketService {
  private static async generateNextTicketNo(): Promise<string> {
    const result = await prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('"SupportTicketNumber_seq"') AS value
    `;
    const nextNumber = result[0].value.toString().padStart(3, '0');
    return `TLP-${nextNumber}`;
  }

  public static async createTicket(data: {
    creatorName: string;
    category: string;
    subject: string;
    description: string;
    createdById?: string;
  }) {
    const ticketNo = await this.generateNextTicketNo();
    const employee = data.createdById ? await prisma.employee.findFirst({
      where: { userId: data.createdById, isDeleted: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        beds: {
          take: 1,
          select: { room: { select: { roomNumber: true, block: { select: { name: true } } } } },
        },
      },
    }) : null;
    const currentRoom = employee?.beds[0]?.room;

    const newTicket = await prisma.supportTicket.create({
      data: {
        ticketNo,
        employeeId: employee?.id || null,
        creatorName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : data.creatorName,
        roomNumber: currentRoom?.roomNumber || null,
        blockName: currentRoom?.block.name || null,
        category: data.category,
        subject: data.subject,
        description: data.description,
        status: SupportTicketStatus.OPEN,
        createdById: data.createdById || null,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        },
      },
    });

    broadcastTicketEvent('TICKET_CREATED', newTicket);

    return newTicket;
  }

  public static async getTickets(filters?: {
    status?: SupportTicketStatus;
    category?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.category) {
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
    let employeeId = params.employeeId;
    if (!employeeId && params.createdById) {
      const employee = await prisma.employee.findUnique({
        where: { userId: params.createdById },
        select: { id: true },
      });
      employeeId = employee?.id;
    }
    if (employeeId) OR.push({ employeeId });
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

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        adminNote: adminNote !== undefined ? adminNote : ticket.adminNote,
        resolvedAt: isResolvedOrRejected ? (ticket.resolvedAt || new Date()) : null,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        },
      },
    });

    broadcastTicketEvent('TICKET_UPDATED', updatedTicket);

    return updatedTicket;
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
