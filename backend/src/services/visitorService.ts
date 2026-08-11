import { Prisma, VisitorStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { normalizeIdentifier, normalizePhone as normalizePhoneValue } from '../utils/normalization';

const MAX_PAGE_SIZE = 100;
const MAX_VISITOR_COUNT = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISITOR_INPUT_FIELDS = new Set(['fullName', 'visitorCount', 'phone', 'company', 'hostEmployeeId', 'purpose', 'vehiclePlate', 'notes']);

export interface VisitorFilters {
  search?: string;
  visitorName?: string;
  company?: string;
  hostName?: string;
  purpose?: string;
  phone?: string;
  vehiclePlate?: string;
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  hostEmployeeId?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateVisitorInput {
  fullName?: string;
  visitorCount?: number;
  phone?: string;
  company?: string;
  hostEmployeeId?: string;
  purpose?: string;
  vehiclePlate?: string;
  notes?: string;
}

export type UpdateVisitorInput = CreateVisitorInput;

const visitorSelect = {
  id: true,
  fullName: true,
  visitorCount: true,
  phone: true,
  company: true,
  hostEmployeeId: true,
  hostEmployeeName: true,
  hostRoomLabel: true,
  purpose: true,
  vehiclePlate: true,
  entryTime: true,
  exitTime: true,
  status: true,
  notes: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  deletedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.VisitorSelect;

type VisitorRow = Prisma.VisitorGetPayload<{ select: typeof visitorSelect }>;

function normalizeUpper(value: unknown, maxLength: number, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError(`${fieldName} metin olmalıdır.`, 400);
  const normalized = value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new AppError(`${fieldName} en fazla ${maxLength} karakter olabilir.`, 400);
  return normalized;
}

function requireText(value: unknown, maxLength: number, fieldName: string): string {
  const normalized = normalizeUpper(value, maxLength, fieldName);
  if (!normalized || normalized.length < 2) throw new AppError(`${fieldName} zorunludur.`, 400);
  return normalized;
}

function normalizePhone(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError('Telefon numarası metin olmalıdır.', 400);
  return normalizePhoneValue(value);
}

function normalizeVehiclePlate(value: unknown): string | null {
  const plate = normalizeUpper(value, 20, 'Araç plakası');
  return normalizeIdentifier(plate);
}

function normalizeCount(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_VISITOR_COUNT) {
    throw new AppError(`Kişi sayısı 1-${MAX_VISITOR_COUNT} arasında tam sayı olmalıdır.`, 400);
  }
  return value;
}

function validateUuid(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) throw new AppError(`${fieldName} geçersiz.`, 400);
  return value.trim();
}

function assertVisitorPayload(input: unknown): asserts input is CreateVisitorInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Ziyaretçi bilgileri geçerli bir nesne olmalıdır.', 400);
  const unknownFields = Object.keys(input).filter((field) => !VISITOR_INPUT_FIELDS.has(field));
  if (unknownFields.length) throw new AppError(`Ziyaretçi kaydında desteklenmeyen alan: ${unknownFields[0]}.`, 400);
}

function validateRequestKey(value: unknown): string {
  const key = validateUuid(value, 'İstek anahtarı');
  if (!key) throw new AppError('Tekrarlı kayıtları önlemek için geçerli bir istek anahtarı gereklidir.', 400);
  return key;
}

function parseDateBoundary(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  if (!DATE_PATTERN.test(value)) throw new AppError('Tarih filtresi YYYY-MM-DD biçiminde olmalıdır.', 400);
  const suffix = endOfDay ? 'T23:59:59.999+03:00' : 'T00:00:00.000+03:00';
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime()) || date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) !== value) {
    throw new AppError('Tarih filtresi geçersiz.', 400);
  }
  return date;
}

function serializeVisitor(visitor: VisitorRow) { return visitor; }

async function resolveHost(hostEmployeeId: unknown) {
  const id = validateUuid(hostEmployeeId, 'Ziyaret edilen personel');
  if (!id) return null;
  const employee = await prisma.employee.findFirst({
    where: { id, isDeleted: false, beds: { some: { isOccupied: true } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      beds: { where: { isOccupied: true }, take: 1, select: { bedLabel: true, room: { select: { roomNumber: true, block: { select: { name: true } } } } } },
    },
  });
  if (!employee) throw new AppError('Ziyaret edilen personel şu anda lojmanda konaklamıyor.', 400);
  const bed = employee.beds[0];
  return {
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`.toLocaleUpperCase('tr-TR'),
    roomLabel: bed ? `${bed.room.block.name} / ODA ${bed.room.roomNumber} / ${bed.bedLabel}`.toLocaleUpperCase('tr-TR') : null,
  };
}

export class VisitorService {
  public static buildWhere(filters: VisitorFilters): Prisma.VisitorWhereInput {
    const where: Prisma.VisitorWhereInput = {};
    if (filters.status && !['ALL', 'INSIDE', 'EXITED', 'DELETED', 'WITH_DELETED'].includes(filters.status)) {
      throw new AppError('Geçersiz ziyaretçi durum filtresi.', 400);
    }
    if (filters.status === 'DELETED') {
      where.isDeleted = true;
    } else if (filters.status === 'WITH_DELETED') {
      where.isDeleted = undefined;
    } else {
      where.isDeleted = filters.includeDeleted ? undefined : false;
      if (filters.status === 'INSIDE' || filters.status === 'EXITED') where.status = filters.status;
    }
    const hostEmployeeId = validateUuid(filters.hostEmployeeId, 'Personel filtresi');
    if (hostEmployeeId) where.hostEmployeeId = hostEmployeeId;
    const rawQuery = filters.search?.trim();
    if (rawQuery) {
      if (rawQuery.length > 100) throw new AppError('Arama metni en fazla 100 karakter olabilir.', 400);
      const query = rawQuery.toLocaleUpperCase('tr-TR');
      where.OR = ['fullName', 'company', 'hostEmployeeName', 'vehiclePlate', 'phone', 'purpose'].map((field) => ({
        [field]: { contains: query, mode: 'insensitive' },
      })) as Prisma.VisitorWhereInput[];
    }
    const fieldFilters: Array<[keyof VisitorFilters, 'fullName' | 'company' | 'hostEmployeeName' | 'purpose' | 'phone' | 'vehiclePlate']> = [
      ['visitorName', 'fullName'], ['company', 'company'], ['hostName', 'hostEmployeeName'], ['purpose', 'purpose'], ['phone', 'phone'], ['vehiclePlate', 'vehiclePlate'],
    ];
    const andFilters: Prisma.VisitorWhereInput[] = [];
    fieldFilters.forEach(([filterKey, field]) => {
      const value = typeof filters[filterKey] === 'string' ? String(filters[filterKey]).trim() : '';
      if (value) {
        if (value.length > 100) throw new AppError('Filtre metni en fazla 100 karakter olabilir.', 400);
        andFilters.push({ [field]: { contains: value.toLocaleUpperCase('tr-TR'), mode: 'insensitive' } });
      }
    });
    if (andFilters.length) where.AND = andFilters;
    const dateStart = parseDateBoundary(filters.dateStart, false);
    const dateEnd = parseDateBoundary(filters.dateEnd, true);
    if (dateStart && dateEnd && dateStart > dateEnd) throw new AppError('Başlangıç tarihi bitiş tarihinden sonra olamaz.', 400);
    if (dateStart || dateEnd) where.entryTime = { ...(dateStart && { gte: dateStart }), ...(dateEnd && { lte: dateEnd }) };
    return where;
  }

  public static async getAllVisitors(filters: VisitorFilters) {
    const where = this.buildWhere(filters);
    const page = Number.isInteger(filters.page) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const requestedPageSize = Number.isInteger(filters.pageSize) ? Number(filters.pageSize) : 25;
    const pageSize = Math.min(Math.max(requestedPageSize, 1), MAX_PAGE_SIZE);
    if (filters.sortBy && !['entryTime', 'exitTime', 'fullName', 'company'].includes(filters.sortBy)) throw new AppError('Geçersiz sıralama alanı.', 400);
    if (filters.sortOrder && !['asc', 'desc'].includes(filters.sortOrder)) throw new AppError('Geçersiz sıralama yönü.', 400);
    const sortBy = filters.sortBy || 'entryTime';
    const sortOrder: Prisma.SortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    const todayStart = parseDateBoundary(todayStr, false);
    const todayEnd = parseDateBoundary(todayStr, true);

    const overdueThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [rows, total, insideSum, overdueInsideSum, todayExitedSum, todayDeletedCount] = await prisma.$transaction([
      prisma.visitor.findMany({ where, select: visitorSelect, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.visitor.count({ where }),
      prisma.visitor.aggregate({
        where: { status: VisitorStatus.INSIDE, isDeleted: false },
        _sum: { visitorCount: true },
      }),
      prisma.visitor.aggregate({
        where: { status: VisitorStatus.INSIDE, isDeleted: false, entryTime: { lt: overdueThreshold } },
        _sum: { visitorCount: true },
      }),
      prisma.visitor.aggregate({
        where: {
          status: VisitorStatus.EXITED,
          isDeleted: false,
          OR: [
            { exitTime: { gte: todayStart, lte: todayEnd } },
            { exitTime: null, entryTime: { gte: todayStart, lte: todayEnd } },
          ],
        },
        _sum: { visitorCount: true },
      }),
      prisma.visitor.count({
        where: { isDeleted: true, entryTime: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    const summary = {
      inside: insideSum._sum?.visitorCount || 0,
      overdueInside: overdueInsideSum._sum?.visitorCount || 0,
      exited: todayExitedSum._sum?.visitorCount || 0,
      deleted: todayDeletedCount,
    };
    return { items: rows.map(serializeVisitor), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, summary };
  }

  public static async getVisitorById(id: string, includeDeleted = false) {
    validateUuid(id, 'Ziyaretçi kaydı');
    const visitor = await prisma.visitor.findFirst({ where: { id, ...(includeDeleted ? {} : { isDeleted: false }) }, select: visitorSelect });
    if (!visitor) throw new AppError('Ziyaretçi kaydı bulunamadı.', 404);
    return serializeVisitor(visitor);
  }

  public static async getHostCandidates() {
    const employees = await prisma.employee.findMany({
      where: { isDeleted: false, beds: { some: { isOccupied: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true, firstName: true, lastName: true, department: true,
        beds: { where: { isOccupied: true }, take: 1, select: { bedLabel: true, room: { select: { roomNumber: true, block: { select: { name: true } } } } } },
      },
    });
    return employees.map((employee) => {
      const bed = employee.beds[0];
      return {
        id: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        roomLabel: bed ? `${bed.room.block.name} / ODA ${bed.room.roomNumber} / ${bed.bedLabel}` : null,
      };
    });
  }

  public static async createVisitor(input: CreateVisitorInput, userId: string, rawRequestKey: unknown): Promise<VisitorRow> {
    assertVisitorPayload(input);
    const requestKey = validateRequestKey(rawRequestKey);
    const normalized = {
      fullName: requireText(input.fullName, 120, 'Ziyaretçi adı soyadı'),
      visitorCount: normalizeCount(input.visitorCount),
      phone: normalizePhone(input.phone),
      company: normalizeUpper(input.company, 120, 'Firma / kurum'),
      hostEmployeeId: validateUuid(input.hostEmployeeId, 'Ziyaret edilen personel') || null,
      purpose: requireText(input.purpose, 200, 'Ziyaret amacı'),
      vehiclePlate: normalizeVehiclePlate(input.vehiclePlate),
      notes: normalizeUpper(input.notes, 1000, 'Notlar'),
    };

    const existing = await prisma.visitor.findUnique({ where: { requestKey }, select: visitorSelect });
    if (existing) {
      const sameRequest = existing.createdBy?.id === userId &&
        existing.fullName === normalized.fullName && existing.visitorCount === normalized.visitorCount &&
        existing.phone === normalized.phone && existing.company === normalized.company &&
        existing.hostEmployeeId === normalized.hostEmployeeId && existing.purpose === normalized.purpose &&
        existing.vehiclePlate === normalized.vehiclePlate && existing.notes === normalized.notes;
      if (!sameRequest) throw new AppError('Bu istek anahtarı farklı bir ziyaretçi kaydı için daha önce kullanılmış.', 409);
      return serializeVisitor(existing);
    }

    const host = await resolveHost(normalized.hostEmployeeId);
    const duplicateSignals: Prisma.VisitorWhereInput[] = [];
    if (normalized.phone) duplicateSignals.push({ fullName: normalized.fullName, phone: normalized.phone });
    if (normalized.vehiclePlate) duplicateSignals.push({ fullName: normalized.fullName, vehiclePlate: normalized.vehiclePlate });
    if (duplicateSignals.length) {
      const activeDuplicate = await prisma.visitor.findFirst({
        where: { status: VisitorStatus.INSIDE, isDeleted: false, OR: duplicateSignals },
        select: { id: true },
      });
      if (activeDuplicate) throw new AppError('Bu ziyaretçi için açık bir giriş kaydı zaten bulunuyor. Önce mevcut kaydın çıkışını yapın.', 409);
    }
    try {
      const visitor = await prisma.visitor.create({
        data: {
          requestKey,
          ...normalized,
          hostEmployeeId: host?.id || null,
          hostEmployeeName: host?.name || null,
          hostRoomLabel: host?.roomLabel || null,
          createdById: userId,
          updatedById: userId,
        },
        select: visitorSelect,
      });
      return serializeVisitor(visitor);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.createVisitor(input, userId, requestKey);
      }
      throw error;
    }
  }

  public static async updateVisitor(id: string, input: UpdateVisitorInput, userId: string) {
    assertVisitorPayload(input);
    await this.getVisitorById(id);
    const data: Prisma.VisitorUpdateInput = { updatedBy: { connect: { id: userId } } };
    if (input.fullName !== undefined) data.fullName = requireText(input.fullName, 120, 'Ziyaretçi adı soyadı');
    if (input.visitorCount !== undefined) data.visitorCount = normalizeCount(input.visitorCount);
    if (input.phone !== undefined) data.phone = normalizePhone(input.phone);
    if (input.company !== undefined) data.company = normalizeUpper(input.company, 120, 'Firma / kurum');
    if (Object.prototype.hasOwnProperty.call(input, 'hostEmployeeId')) {
      const host = await resolveHost(input.hostEmployeeId);
      if (host) {
        data.hostEmployee = { connect: { id: host.id } };
        data.hostEmployeeName = host.name;
        data.hostRoomLabel = host.roomLabel;
      } else {
        data.hostEmployee = { disconnect: true };
        data.hostEmployeeName = null;
        data.hostRoomLabel = null;
      }
    }
    if (input.purpose !== undefined) data.purpose = requireText(input.purpose, 200, 'Ziyaret amacı');
    if (input.vehiclePlate !== undefined) data.vehiclePlate = normalizeVehiclePlate(input.vehiclePlate);
    if (input.notes !== undefined) data.notes = normalizeUpper(input.notes, 1000, 'Notlar');
    const visitor = await prisma.visitor.update({ where: { id }, data, select: visitorSelect });
    return serializeVisitor(visitor);
  }

  public static async checkOutVisitor(id: string, userId: string) {
    validateUuid(id, 'Ziyaretçi kaydı');
    const result = await prisma.visitor.updateMany({
      where: { id, isDeleted: false, status: VisitorStatus.INSIDE },
      data: { status: VisitorStatus.EXITED, exitTime: new Date(), updatedById: userId },
    });
    if (result.count === 0) throw new AppError('Kayıt bulunamadı veya ziyaretçi zaten çıkış yapmış.', 409);
    return this.getVisitorById(id);
  }

  public static async undoCheckOutVisitor(id: string, userId: string) {
    validateUuid(id, 'Ziyaretçi kaydı');
    const undoThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const result = await prisma.visitor.updateMany({
      where: { id, isDeleted: false, status: VisitorStatus.EXITED, exitTime: { gte: undoThreshold } },
      data: { status: VisitorStatus.INSIDE, exitTime: null, updatedById: userId },
    });
    if (result.count === 0) throw new AppError('Kayıt bulunamadı, ziyaretçi zaten içeride veya 30 dakikalık geri alma süresi doldu. Yeni giriş kaydı oluşturun.', 409);
    return this.getVisitorById(id);
  }

  public static async deleteVisitor(id: string, userId: string) {
    validateUuid(id, 'Ziyaretçi kaydı');
    const existing = await prisma.visitor.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) throw new AppError('Ziyaretçi kaydı bulunamadı veya daha önce silinmiş.', 404);

    const isInside = existing.status === VisitorStatus.INSIDE;
    await prisma.visitor.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: userId,
        updatedById: userId,
        ...(isInside ? { status: VisitorStatus.EXITED, exitTime: new Date() } : {}),
      },
    });
  }

  public static async restoreVisitor(id: string, userId: string) {
    validateUuid(id, 'Ziyaretçi kaydı');
    const result = await prisma.visitor.updateMany({
      where: { id, isDeleted: true },
      data: { isDeleted: false, deletedAt: null, deletedById: null, updatedById: userId },
    });
    if (result.count === 0) throw new AppError('Silinmiş ziyaretçi kaydı bulunamadı.', 404);
    return this.getVisitorById(id);
  }

  public static async getExportRows(filters: VisitorFilters, maxRows: number) {
    const where = this.buildWhere(filters);
    const total = await prisma.visitor.count({ where });
    if (total > maxRows) throw new AppError(`Excel çıktısı en fazla ${maxRows} kayıt içerebilir. Filtreleri daraltın.`, 413);
    const rows = await prisma.visitor.findMany({ where, select: visitorSelect, orderBy: { entryTime: 'desc' }, take: maxRows });
    return rows.map(serializeVisitor);
  }
}
