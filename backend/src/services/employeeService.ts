import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { encryptSensitiveData, hashSensitiveData, maskTcNo } from '../utils/crypto';
import { generateUniqueUsername, generateUniqueEasyPassword } from '../utils/credentialGenerator';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { boundedText, normalizeIdentifier, normalizeInventoryItemName, normalizePhone, normalizeUpper, strictBoolean } from '../utils/normalization';
import { syncSharedAssetPersonnelAssignment, syncSharedAssetReturn } from './sharedAssetSync';
import { AGE_GROUPS, canonicalChoice, EMERGENCY_RELATIONS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_TITLES, LANGUAGE_NATIONALITIES, SHIFT_TYPES } from '../utils/employeeDomain';
import { config } from '../config';
import { releasePersonnelStock, reservePersonnelStock } from '../utils/stockBalance';
import { validateEmployeeDepartmentFilter, validateEmployeeFilterStatus, validateEmployeeGenderFilter } from '../security/employeePolicy';
import { validatePassword } from '../security/passwordPolicy';

/**
 * Turkish Locale-aware Title Case Normalization
 * E.g. "usta cam" -> "Usta Cam", "USTA CAM" -> "Usta Cam"
 */
export function normalizeText(text?: string | null): string | null {
  return normalizeUpper(text);
}

const GENDERS = new Set(['Male', 'Female']);
const USER_ROLES = new Set<Role>(Object.values(Role));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string {
  const clean = email.trim().toLocaleLowerCase('en-US');
  if (clean.length > 254 || !EMAIL_PATTERN.test(clean)) throw new AppError('Geçerli bir e-posta adresi giriniz.', 400);
  return clean;
}

function validatePortalUsername(value: string): string {
  const username = value.trim().toLocaleLowerCase('en-US');
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new AppError('Kullanıcı adı 3-50 karakter olmalı ve yalnızca küçük harf, rakam, nokta, tire veya alt çizgi içermelidir.', 400);
  return username;
}

function validatePortalPassword(value: string): string {
  return validatePassword(value, 'Sistem kullanıcısı parolası');
}

async function setEmployeePortalAccountActive(
  tx: Prisma.TransactionClient,
  userId: string,
  isActive: boolean,
  actorUserId: string | undefined,
  action: string,
  notes: string,
): Promise<void> {
  const current = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!current || current.isActive === isActive) return;
  const updated = await tx.user.updateMany({ where: { id: userId, isActive: current.isActive }, data: { isActive } });
  if (updated.count !== 1) throw new AppError('Personel portal hesabı aynı anda başka bir işlemde değiştirildi.', 409);
  await tx.userAuditLog.create({ data: {
    targetUserId: userId,
    actorUserId: actorUserId || null,
    action,
    beforeRole: current.role,
    afterRole: current.role,
    notes,
  } });
}

function applyEmployeeSearch(where: any, search?: string): void {
  const query = search?.trim().replace(/\s+/g, ' ');
  if (!query) return;
  if (query.length > 100) throw new AppError('Arama metni en fazla 100 karakter olabilir.', 400);
  const fields = ['firstName', 'lastName', 'registrationNo', 'department', 'company', 'title', 'vehiclePlate', 'phone'];
  const sensitiveIdentifier = query.replace(/\s+/g, '');
  where.AND = where.AND || [];
  if (/^\d{11}$/.test(sensitiveIdentifier)) {
    where.AND.push({ OR: [
      ...fields.map((field) => ({ [field]: { contains: query, mode: 'insensitive' } })),
      { tcNoHash: hashSensitiveData(sensitiveIdentifier) },
    ] });
    return;
  }
  const terms = query.split(' ').slice(0, 8);
  for (const term of terms) {
    where.AND.push({ OR: fields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' } })) });
  }
}

/**
 * Validates profile photo URL / Base64 Data URI format and size
 */
export function validatePhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl || !photoUrl.trim()) return null;
  const trimmed = photoUrl.trim();
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { throw new AppError('Geçersiz fotoğraf adresi.', 400); }
    if (parsed.username || parsed.password) throw new AppError('Fotoğraf adresinde kullanıcı bilgisi bulunamaz.', 400);
    if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new AppError('Fotoğraf adresi HTTPS kullanmalıdır.', 400);
    if (trimmed.length > 2048) throw new AppError('Fotoğraf adresi çok uzun.', 400);
    return parsed.toString();
  }
  const base64HeaderRegex = /^data:image\/(jpeg|jpg|png|webp);base64,/;
  if (!base64HeaderRegex.test(trimmed)) {
    throw new AppError('Geçersiz profil fotoğrafı biçimi. Yalnızca JPEG, PNG veya WEBP resim formatları kabul edilir.', 400);
  }
  const encoded = trimmed.slice(trimmed.indexOf(',') + 1);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new AppError('Fotoğraf verisi geçerli Base64 biçiminde değildir.', 400);
  const byteLength = Buffer.byteLength(encoded, 'base64');
  if (byteLength > 1_500_000) {
    throw new AppError('Profil fotoğrafı boyutu çok yüksek. Lütfen 1.5 MB altında bir resim yükleyin.', 400);
  }
  return trimmed;
}

export interface SystemUserDTO {
  createAccount?: boolean;
  username?: string;
  email?: string;
  password?: string;
  role?: Role;
}

export interface CreateEmployeeDTO {
  firstName: string;             // Required
  lastName: string;              // Required
  gender: string;                // Required: Male / Female
  department: string;            // Required Dropdown
  title?: string;                // Optional Dropdown
  company?: string;              // Optional Hand-written (will be normalized)
  tcNo?: string;                 // TC Kimlik / Pasaport No
  registrationNo?: string;       // Sicil No
  phone?: string;                // Optional
  isSmoker?: boolean;            // Lojman Sigara Kullanımı
  hasSnoring?: boolean;          // Lojman Horlama Durumu
  vehiclePlate?: string;         // Optional Araç Plakası
  ageGroup?: string;             // Optional Yaş Grubu
  languageNationality?: string;  // Optional Konuşulan Dil / Uyruk
  emergencyContactName?: string; // Optional
  emergencyRelation?: string;    // Optional Dropdown
  emergencyContactPhone?: string;// Optional
  photoUrl?: string;             // Optional Base64/URL
  shiftType?: string;            // Vardiya Tipi
  bedId?: string;                // Optional immediate bed assignment
  createdById?: string;          // User ID who created the employee
  systemUser?: SystemUserDTO;    // System user account role & credentials
}

export class EmployeeService {
  public static async deleteEmployee(employeeId: string, deletedById?: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { beds: { select: { id: true, roomId: true } } },
      });
      if (!employee || employee.isDeleted) throw new AppError('Personel bulunamadı.', 404);
      const insideVisitors = await tx.visitor.count({ where: { hostEmployeeId: employeeId, status: 'INSIDE', isDeleted: false } });
      if (insideVisitors > 0) throw new AppError(`Personelin içeride görünen ${insideVisitors} ziyaretçisi bulunuyor. Personeli silmeden önce ziyaretçi çıkışlarını tamamlayın.`, 409);
      const now = new Date();
      if (employee.beds.length > 0) {
        await tx.bed.updateMany({
          where: { currentEmployeeId: employeeId },
          data: { currentEmployeeId: null, isOccupied: false },
        });
      }
      await tx.occupancyLog.updateMany({
        where: { employeeId, checkOutDate: null },
        data: { checkOutDate: now, checkedOutById: deletedById || null },
      });
      // Also close active inventories assigned to deleted employee and return their stock
      const activeStockInventories = await tx.inventoryItem.findMany({
        where: { employeeId, isDeleted: false, returnedDate: null, stockItemId: { not: null } },
      });
      if (activeStockInventories.length > 0) {
        throw new AppError(`Personelin ${activeStockInventories.length} aktif stok zimmeti bulunuyor. Personeli silmeden önce zimmetleri teslim alın veya kayıp/zayi olarak kapatın.`, 409);
      }
      await tx.inventoryItem.updateMany({
        where: { employeeId, isDeleted: false, returnedDate: null },
        data: {
          status: 'TAM_İADE_ALINDI',
          returnedDate: now,
          returnedById: deletedById || null,
        },
      });
      if (employee.userId) {
        await setEmployeePortalAccountActive(tx, employee.userId, false, deletedById, 'EMPLOYEE_PORTAL_ACCOUNT_DEACTIVATED', 'PERSONEL ARŞİVLENDİĞİ İÇİN PORTAL HESABI KAPATILDI');
      }
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedById: deletedById || null,
          status: 'CHECKED_OUT',
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2034') throw new AppError('Personel, ziyaretçi veya zimmet aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    });
  }

  /**
   * Get single employee by ID with full relations
   */
  public static async getEmployeeById(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, isDeleted: false },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        beds: {
          include: {
            room: {
              include: {
                block: true,
              },
            },
          },
        },
        inventories: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        disciplinaryNotes: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        occupancies: {
          orderBy: { checkInDate: 'desc' },
          include: {
            bed: {
              include: {
                room: {
                  include: {
                    block: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) throw new AppError('Personel bulunamadı.', 404);

    const latestOccupancy = employee.occupancies && employee.occupancies.length > 0 ? employee.occupancies[0] : null;
    const { tcNo, tcNoHash: _tcNoHash, ...safeEmployee } = employee;
    return {
      ...safeEmployee,
      tcNoMasked: maskTcNo(tcNo),
      checkInDate: latestOccupancy ? latestOccupancy.checkInDate : null,
      checkOutDate: latestOccupancy ? latestOccupancy.checkOutDate : null,
    };
  }
  /**
   * Get list of employees with optional search & filters
   */
  public static async getAllEmployees(search?: string, status?: string, department?: string, gender?: string, startDate?: string, endDate?: string, maxRows = 5000) {
    const validatedStatus = validateEmployeeFilterStatus(status);
    const validatedDepartment = validateEmployeeDepartmentFilter(department);
    const validatedGender = validateEmployeeGenderFilter(gender);
    const where: any = { isDeleted: false };

    if (validatedStatus !== 'ALL') where.status = validatedStatus;

    if (validatedDepartment !== 'ALL') where.department = validatedDepartment;

    if (validatedGender !== 'ALL') where.gender = validatedGender;

    if (startDate || endDate) {
      const start = parseIstanbulDateBoundary(startDate, false);
      const end = parseIstanbulDateBoundary(endDate, true);
      assertDateRange(start, end);
      const dateFilter: any = { ...(start && { gte: start }), ...(end && { lte: end }) };

      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { createdAt: dateFilter },
          { occupancies: { some: { checkInDate: dateFilter } } },
        ],
      });
    }

    applyEmployeeSearch(where, search);

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true, tcNo: true, registrationNo: true, firstName: true, lastName: true, gender: true,
        department: true, title: true, company: true, phone: true, isSmoker: true,
        hasSnoring: true, vehiclePlate: true, photoUrl: true, shiftType: true, status: true,
        createdAt: true, updatedAt: true, userId: true,
        beds: {
          select: {
            id: true, bedLabel: true, isOccupied: true,
            room: {
              select: {
                id: true, roomNumber: true, floor: true,
                block: { select: { id: true, name: true, genderPolicy: true } },
              },
            },
          },
        },
        occupancies: {
          orderBy: { checkInDate: 'desc' },
          take: 1,
          select: { checkInDate: true, checkOutDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: maxRows + 1,
    });

    if (employees.length > maxRows) throw new AppError(`Personel listesi ${maxRows.toLocaleString('tr-TR')} kayıt sınırını aşıyor. Arama veya filtre kullanın.`, 413);

    return employees.map(emp => {
      const latestOccupancy = emp.occupancies && emp.occupancies.length > 0 ? emp.occupancies[0] : null;
      const { tcNo, ...safeEmployee } = emp;
      return {
        ...safeEmployee,
        tcNoMasked: maskTcNo(tcNo),
        checkInDate: latestOccupancy ? latestOccupancy.checkInDate : null,
        checkOutDate: latestOccupancy ? latestOccupancy.checkOutDate : null,
      };
    });
  }

  /**
   * Create new employee with exact registration, check-in, and check-out timestamps
   */
  public static async createEmployee(data: CreateEmployeeDTO) {
    const { 
      firstName, 
      lastName, 
      gender, 
      department,
      title,
      company,
      tcNo,
      registrationNo,
      phone,
      isSmoker,
      hasSnoring,
      vehiclePlate,
      ageGroup,
      languageNationality,
      emergencyContactName,
      emergencyRelation,
      emergencyContactPhone,
      photoUrl,
      shiftType,
      bedId,
      createdById
    } = data;

    // 1. Temel Zorunlu Alan Kontrolleri
    const normalizedFirstName = boundedText(firstName, 'Personel adı', 80, { required: true, minLength: 2, casing: 'upper' })!;
    const normalizedLastName = boundedText(lastName, 'Personel soyadı', 80, { required: true, minLength: 2, casing: 'upper' })!;

    if (!GENDERS.has(gender)) {
      throw new AppError('Geçerli bir cinsiyet (Erkek / Kadın) seçilmelidir.', 400);
    }

    const normalizedDepartment = canonicalChoice(department, EMPLOYEE_DEPARTMENTS, 'Departman', true)!;

    const cleanTc = tcNo ? tcNo.trim().replace(/\s+/g, '') : '';
    const cleanRegNo = normalizeIdentifier(registrationNo) || '';
    if (cleanTc && !/^[A-Z0-9]{5,20}$/i.test(cleanTc)) throw new AppError('TC/Pasaport numarası 5-20 harf veya rakamdan oluşmalıdır.', 400);

    if (!cleanTc && !cleanRegNo) {
      throw new AppError('Mükerrer personel kaydını engellemek için lütfen TC Kimlik No veya Sicil No bilgilerinden en az birini giriniz.', 400);
    }

    // 2. TC Kimlik No ile Mükerrer Kontrolü
    if (cleanTc !== '') {
      const existingTcMatch = await prisma.employee.findUnique({
        where: { tcNoHash: hashSensitiveData(cleanTc) },
        select: { id: true, firstName: true, lastName: true },
      });

      if (existingTcMatch) {
        throw new AppError(
          `'${cleanTc}' TC Numarasına sahip bir personel (${existingTcMatch.firstName} ${existingTcMatch.lastName}) zaten sistemde var! İkinci kez eklenemez.`,
          400
        );
      }
    }

    // 3. Sicil No ile Mükerrer Kontrolü
    if (cleanRegNo !== '') {
      const existingReg = await prisma.employee.findFirst({
        where: { registrationNo: cleanRegNo },
      });

      if (existingReg) {
        throw new AppError(
          `'${cleanRegNo}' Sicil Numarasına sahip bir personel (${existingReg.firstName} ${existingReg.lastName}) zaten sistemde var! İkinci kez eklenemez.`,
          400
        );
      }
    }

    const normalizedCompany = boundedText(company, 'Şirket', 120, { casing: 'upper' });
    const normalizedEmergencyName = boundedText(emergencyContactName, 'Acil durum yakını', 120, { casing: 'upper' });
    const normalizedPlate = normalizeIdentifier(vehiclePlate);
    const cleanPhone = normalizePhone(phone);
    const cleanEmergencyPhone = normalizePhone(emergencyContactPhone, 'Acil durum telefonu');
    const normalizedTitle = canonicalChoice(title, EMPLOYEE_TITLES, 'Unvan');
    const normalizedAgeGroup = canonicalChoice(ageGroup, AGE_GROUPS, 'Yaş grubu');
    const normalizedLanguage = canonicalChoice(languageNationality, LANGUAGE_NATIONALITIES, 'Dil / uyruk');
    const normalizedRelation = canonicalChoice(emergencyRelation, EMERGENCY_RELATIONS, 'Yakınlık derecesi');
    const normalizedShift = canonicalChoice(shiftType, SHIFT_TYPES, 'Vardiya tipi');

    // Encrypt TC before saving
    const encryptedTc = cleanTc !== '' ? encryptSensitiveData(cleanTc) : null;

    // System User Account creation (Auto-generated unique credentials for every employee)
    let createdUserId: string | null = null;
    let generatedAccountInfo: { username: string; password: string } | null = null;
    let accountCreateData: { username: string; email: string; passwordHash: string; fullName: string; role: Role; mustChangePassword: boolean } | null = null;

    if (data.systemUser?.createAccount === true) {
      let targetUsername = data.systemUser?.username?.trim().toLowerCase();
      let targetEmail = data.systemUser?.email ? validateEmail(data.systemUser.email) : undefined;
      let targetPassword = data.systemUser?.password;
      if (data.systemUser.role && data.systemUser.role !== Role.STAFF) throw new AppError('Personel portal hesabı yalnızca STAFF rolüyle oluşturulabilir.', 400);
      const targetRole = Role.STAFF;

      if (!targetUsername) {
        targetUsername = await generateUniqueUsername(normalizedFirstName, normalizedLastName);
      }
      if (!targetPassword) {
        targetPassword = await generateUniqueEasyPassword();
      }
      targetPassword = validatePortalPassword(targetPassword);
      targetUsername = validatePortalUsername(targetUsername);
      if (!targetEmail) {
        targetEmail = `${targetUsername}@lojman.local`;
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username: targetUsername }, { email: targetEmail }] },
      });
      if (existingUser) {
        if (existingUser.username === targetUsername) {
          throw new AppError(`'${targetUsername}' kullanıcı adı sistemde başka bir personel tarafından zaten kullanılmaktadır. Her kullanıcı adı tek olmalıdır.`, 400);
        }
        targetEmail = `${targetUsername}.${Date.now().toString().slice(-4)}@lojman.local`;
      }

      const passwordHash = await bcrypt.hash(targetPassword, config.security.saltRounds);
      accountCreateData = {
        username: targetUsername,
        email: targetEmail,
        passwordHash,
        fullName: `${normalizedFirstName} ${normalizedLastName}`,
        role: targetRole,
        mustChangePassword: true,
      };
      generatedAccountInfo = {
        username: targetUsername,
        password: targetPassword,
      };
    }

    // Determine initial status
    const initialStatus = bedId ? 'RESIDENT' : 'PENDING_ASSIGNMENT';
    const now = new Date(); // Exact DateTime timestamp

    // Transaction to create employee and optional bed placement with exact timestamps
    return prisma.$transaction(async (tx) => {
      if (accountCreateData) {
        const newUser = await tx.user.create({ data: { ...accountCreateData, isActive: true } });
        createdUserId = newUser.id;
        await tx.userAuditLog.create({ data: { targetUserId: newUser.id, actorUserId: createdById || null, action: 'EMPLOYEE_PORTAL_ACCOUNT_CREATED', afterRole: Role.STAFF, notes: 'PERSONEL KAYDIYLA BAĞLI PORTAL HESABI OLUŞTURULDU' } });
      }

      // 1. Create Employee
      const newEmployee = await tx.employee.create({
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          gender,
          department: normalizedDepartment,
          title: normalizedTitle,
          company: normalizedCompany,
          tcNo: encryptedTc,
          tcNoHash: cleanTc !== '' ? hashSensitiveData(cleanTc) : null,
          registrationNo: cleanRegNo !== '' ? cleanRegNo : null,
          phone: cleanPhone,
          isSmoker: isSmoker === undefined ? false : strictBoolean(isSmoker, 'Sigara kullanımı'),
          hasSnoring: hasSnoring === undefined ? false : strictBoolean(hasSnoring, 'Horlama durumu'),
          vehiclePlate: normalizedPlate,
          ageGroup: normalizedAgeGroup || '26-40 Yaş (Orta Yaş)',
          languageNationality: normalizedLanguage || 'Türkçe (T.C.)',
          emergencyContactName: normalizedEmergencyName,
          emergencyRelation: normalizedRelation,
          emergencyContactPhone: cleanEmergencyPhone,
          photoUrl: validatePhotoUrl(photoUrl),
          shiftType: normalizedShift || 'Gündüz',
          status: initialStatus,
          userId: createdUserId,
          createdById: createdById || null,
          createdAt: now,
        },
      });

      // 2. If immediate Bed Assignment requested
      if (bedId) {
        const bed = await tx.bed.findUnique({
          where: { id: bedId },
          include: {
            room: {
              include: { block: true },
            },
          },
        });

        if (!bed) {
          throw new AppError('Seçilen yatak bulunamadı.', 404);
        }

        if (bed.isOccupied) {
          throw new AppError('Seçilen yatak zaten dolu.', 400);
        }

        if (bed.room.roomType !== 'PERSONEL_ODASI') throw new AppError('Hizmet alanlarına personel yerleştirilemez.', 400);

        if (bed.room.status !== 'READY') {
          throw new AppError(
            `Seçilen oda hazır durumda değil (${bed.room.status === 'NEEDS_CLEANING' ? 'Temizlik Bekliyor' : 'Arızalı/Bakımda'}). Yalnızca hazır durumdaki odalara personel yerleştirilebilir.`,
            400
          );
        }

        // Verify gender compatibility with Block policy
        if (bed.room.block.genderPolicy !== 'Mixed' && bed.room.block.genderPolicy !== gender) {
          throw new AppError(
            `Personel cinsiyeti (${gender === 'Male' ? 'Erkek' : 'Kadın'}), seçilen lojman bloğu politikasıyla (${bed.room.block.name}) uyuşmuyor.`,
            400
          );
        }

        // Check for conflicting gender in the same room
        const otherBedsInRoom = await tx.bed.findMany({
          where: { roomId: bed.roomId, isOccupied: true, NOT: { currentEmployeeId: newEmployee.id } },
          include: { currentEmployee: { select: { gender: true, firstName: true, lastName: true } } },
        });

        const conflictingOccupant = otherBedsInRoom.find(
          (b) => b.currentEmployee && b.currentEmployee.gender !== gender
        );

        if (conflictingOccupant) {
          throw new AppError(
            `Seçilen odada (${bed.room.block.name} Oda ${bed.room.roomNumber}) halen ${conflictingOccupant.currentEmployee?.gender === 'Male' ? 'Erkek' : 'Kadın'} bir personel (${conflictingOccupant.currentEmployee?.firstName} ${conflictingOccupant.currentEmployee?.lastName}) ikamet etmektedir. Aynı odaya karşı cinsiyette personel yerleştirilemez.`,
            400
          );
        }

        // Verify room capacity limit
        const occupiedCountInRoom = otherBedsInRoom.length;
        if (occupiedCountInRoom >= bed.room.capacity) {
          throw new AppError(
            `Seçilen oda (${bed.room.block.name} Oda ${bed.room.roomNumber}) maksimum ${bed.room.capacity} kişilik doluluğa ulaşmıştır. Yeni personel yerleştirilemez.`,
            400
          );
        }

        // Claim the bed atomically to prevent concurrent double assignment.
        const claimedBed = await tx.bed.updateMany({
          where: { id: bedId, isOccupied: false, currentEmployeeId: null },
          data: {
            isOccupied: true,
            currentEmployeeId: newEmployee.id,
          },
        });
        if (claimedBed.count !== 1) throw new AppError('Seçilen yatak başka bir işlem tarafından dolduruldu. Lütfen yeniden seçim yapın.', 409);

        // Log Occupancy with exact Date + Time and creator ID
        await tx.occupancyLog.create({
          data: {
            employeeId: newEmployee.id,
            employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`,
            employeeDepartment: newEmployee.department.toLocaleUpperCase('tr-TR'),
            employeeTitle: newEmployee.title?.toLocaleUpperCase('tr-TR') || null,
            employeeCompany: newEmployee.company?.toLocaleUpperCase('tr-TR') || null,
            bedId: bed.id,
            checkInDate: now,
            transferReason: 'İLK KAYITTA DOĞRUDAN YERLEŞTİRME',
            createdById: createdById || null,
          },
        });

      }
      const created = await tx.employee.findUnique({
        where: { id: newEmployee.id },
        include: {
          user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
          beds: {
            include: {
              room: {
                include: { block: true },
              },
            },
          },
          occupancies: {
            orderBy: { checkInDate: 'desc' },
            include: {
              bed: {
                include: {
                  room: {
                    include: {
                      block: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const latestOccupancy = created?.occupancies && created.occupancies.length > 0 ? created.occupancies[0] : null;
      if (!created) throw new AppError('Personel kaydı oluşturulamadı.', 500);
      const { tcNo: storedTcNo, tcNoHash: _tcNoHash, ...safeEmployee } = created;

      return {
        ...safeEmployee,
        tcNoMasked: maskTcNo(storedTcNo),
        checkInDate: latestOccupancy ? latestOccupancy.checkInDate : null,
        checkOutDate: latestOccupancy ? latestOccupancy.checkOutDate : null,
        generatedAccountInfo,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('TC/Pasaport, sicil, kullanıcı adı veya e-posta bilgisi başka bir kayıtta kullanılıyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Personel veya yatak aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    });
  }

  /**
   * Update Employee details
   */
  public static async updateEmployee(employeeId: string, data: Partial<CreateEmployeeDTO>) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, isDeleted: false } });
    if (!employee) throw new AppError('Personel bulunamadı.', 404);

    const updateData: any = {};
    let pendingUserUpdate: Record<string, unknown> | null = null;
    let pendingUserCreate: { username: string; email: string; passwordHash: string; fullName: string; role: Role; isActive: boolean; mustChangePassword: boolean } | null = null;
    if (data.firstName !== undefined) updateData.firstName = boundedText(data.firstName, 'Personel adı', 80, { required: true, minLength: 2, casing: 'upper' });
    if (data.lastName !== undefined) updateData.lastName = boundedText(data.lastName, 'Personel soyadı', 80, { required: true, minLength: 2, casing: 'upper' });
    if (data.gender !== undefined) {
      if (!GENDERS.has(data.gender)) throw new AppError('Geçerli bir cinsiyet seçilmelidir.', 400);
      if (data.gender !== employee.gender) {
        const currentBed = await prisma.bed.findFirst({
          where: { currentEmployeeId: employeeId, isOccupied: true },
          include: {
            room: {
              include: {
                block: true,
                beds: { where: { isOccupied: true, currentEmployeeId: { not: employeeId } }, include: { currentEmployee: { select: { gender: true } } } },
              },
            },
          },
        });
        if (currentBed) {
          const policy = currentBed.room.block.genderPolicy;
          if ((policy !== 'Mixed' && policy !== data.gender) || currentBed.room.beds.some((bed) => bed.currentEmployee?.gender !== data.gender)) {
            throw new AppError('Personelin cinsiyeti mevcut blok veya oda yerleşim politikasıyla uyuşmuyor. Önce uygun bir odaya transfer edin.', 409);
          }
        }
      }
      updateData.gender = data.gender;
    }
    if (data.department !== undefined) updateData.department = canonicalChoice(data.department, EMPLOYEE_DEPARTMENTS, 'Departman', true);
    if (data.title !== undefined) updateData.title = canonicalChoice(data.title, EMPLOYEE_TITLES, 'Unvan');
    if (data.company !== undefined) updateData.company = boundedText(data.company, 'Şirket', 120, { casing: 'upper' });
    if (data.registrationNo !== undefined) {
      const registrationNo = normalizeIdentifier(data.registrationNo);
      if (registrationNo) {
        const duplicate = await prisma.employee.findFirst({ where: { registrationNo, NOT: { id: employeeId } }, select: { id: true } });
        if (duplicate) throw new AppError('Bu sicil numarası başka bir personelde kayıtlı.', 409);
      }
      updateData.registrationNo = registrationNo;
    }
    if (data.phone !== undefined) updateData.phone = normalizePhone(data.phone);
    if (data.isSmoker !== undefined) updateData.isSmoker = strictBoolean(data.isSmoker, 'Sigara kullanımı');
    if (data.hasSnoring !== undefined) updateData.hasSnoring = strictBoolean(data.hasSnoring, 'Horlama durumu');
    if (data.vehiclePlate !== undefined) updateData.vehiclePlate = normalizeIdentifier(data.vehiclePlate);
    if (data.ageGroup !== undefined) updateData.ageGroup = canonicalChoice(data.ageGroup, AGE_GROUPS, 'Yaş grubu');
    if (data.languageNationality !== undefined) updateData.languageNationality = canonicalChoice(data.languageNationality, LANGUAGE_NATIONALITIES, 'Dil / uyruk');
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = boundedText(data.emergencyContactName, 'Acil durum yakını', 120, { casing: 'upper' });
    if (data.emergencyRelation !== undefined) updateData.emergencyRelation = canonicalChoice(data.emergencyRelation, EMERGENCY_RELATIONS, 'Yakınlık derecesi');
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = normalizePhone(data.emergencyContactPhone, 'Acil durum telefonu');
    if (data.shiftType !== undefined) updateData.shiftType = canonicalChoice(data.shiftType, SHIFT_TYPES, 'Vardiya tipi');
    if (data.photoUrl !== undefined) updateData.photoUrl = validatePhotoUrl(data.photoUrl);
    if (data.tcNo && data.tcNo.trim() !== '') {
      const cleanTc = data.tcNo.trim();
      const duplicate = await prisma.employee.findFirst({
        where: { tcNoHash: hashSensitiveData(cleanTc), NOT: { id: employeeId } },
        select: { id: true },
      });
      if (duplicate) throw new AppError('Bu TC/Pasaport numarası başka bir personelde kayıtlı.', 409);
      updateData.tcNo = encryptSensitiveData(cleanTc);
      updateData.tcNoHash = hashSensitiveData(cleanTc);
    }
    if (employee.userId && (data.firstName !== undefined || data.lastName !== undefined)) {
      pendingUserUpdate = {
        fullName: `${updateData.firstName || employee.firstName} ${updateData.lastName || employee.lastName}`,
      };
    }

    // System User Account Update / Creation
    if (data.systemUser) {
      if (data.systemUser.createAccount) {
        if (data.systemUser.role && data.systemUser.role !== Role.STAFF) throw new AppError('Personel portal hesabı yalnızca STAFF rolünde olabilir.', 400);
        if (employee.userId) {
          const updateUserData: any = {};
          if (data.systemUser.username) {
            const newUsername = validatePortalUsername(data.systemUser.username);
            const duplicate = await prisma.user.findFirst({
              where: { username: newUsername, NOT: { id: employee.userId } },
            });
            if (duplicate) {
              throw new AppError(`'${newUsername}' kullanıcı adı sistemde başka bir personel tarafından zaten kullanılmaktadır. Her kullanıcı adı tek olmalıdır.`, 400);
            }
            updateUserData.username = newUsername;
          }
          if (data.systemUser.email) {
            const newEmail = validateEmail(data.systemUser.email);
            const duplicate = await prisma.user.findFirst({
              where: { email: newEmail, NOT: { id: employee.userId } },
            });
            if (duplicate) {
              throw new AppError(`'${newEmail}' e-posta adresi zaten başka bir kullanıcı hesabı tarafından kullanılmaktadır.`, 400);
            }
            updateUserData.email = newEmail;
          }
          if (data.systemUser.role) {
            updateUserData.role = Role.STAFF;
          }
          if (data.systemUser.password) {
            updateUserData.passwordHash = await bcrypt.hash(validatePortalPassword(data.systemUser.password.trim()), config.security.saltRounds);
            updateUserData.mustChangePassword = true;
          }
          if (Object.keys(updateUserData).length > 0) {
            pendingUserUpdate = { ...(pendingUserUpdate || {}), ...updateUserData };
          }
        } else {
          const { username, email, password, role } = data.systemUser;
          if (!username || !username.trim()) throw new AppError('Sistem kullanıcısı için kullanıcı adı zorunludur.', 400);
          if (!email || !email.trim()) throw new AppError('Sistem kullanıcısı için e-posta adresi zorunludur.', 400);
          if (!password) throw new AppError('Sistem kullanıcısı için parola zorunludur.', 400);

          const cleanUsername = validatePortalUsername(username);
          const cleanEmail = validateEmail(email);
          const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] },
          });
          if (existingUser) throw new AppError('Girilen kullanıcı adı veya e-posta adresi sistemde zaten kayıtlı.', 409);

          const passwordHash = await bcrypt.hash(validatePortalPassword(password), config.security.saltRounds);
          const userRole = Role.STAFF;

          const targetFirstName = data.firstName ? normalizeText(data.firstName) : employee.firstName;
          const targetLastName = data.lastName ? normalizeText(data.lastName)?.toLocaleUpperCase('tr-TR') : employee.lastName;

          pendingUserCreate = {
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            fullName: `${targetFirstName} ${targetLastName}`,
            role: userRole,
            isActive: employee.status !== 'CHECKED_OUT' || Boolean(data.bedId),
            mustChangePassword: true,
          };
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      if (pendingUserUpdate && employee.userId) {
        await tx.user.update({ where: { id: employee.userId }, data: pendingUserUpdate });
        await tx.userAuditLog.create({ data: { targetUserId: employee.userId, actorUserId: data.createdById || null, action: 'EMPLOYEE_PORTAL_ACCOUNT_UPDATED', beforeRole: Role.STAFF, afterRole: Role.STAFF, notes: 'PERSONEL PROFİLİNDEN PORTAL HESABI GÜNCELLENDİ' } });
      }
      if (pendingUserCreate) {
        const newUser = await tx.user.create({ data: pendingUserCreate });
        updateData.userId = newUser.id;
        await tx.userAuditLog.create({ data: { targetUserId: newUser.id, actorUserId: data.createdById || null, action: 'EMPLOYEE_PORTAL_ACCOUNT_CREATED', afterRole: Role.STAFF, notes: 'MEVCUT PERSONELE PORTAL HESABI BAĞLANDI' } });
      }
      // If bedId is provided, handle bed assignment
      if (data.bedId) {
        const bed = await tx.bed.findUnique({
          where: { id: data.bedId },
          include: { room: { include: { block: true } } },
        });

        if (!bed) throw new AppError('Seçilen yatak bulunamadı.', 404);
        if (bed.currentEmployeeId === employeeId) {
          throw new AppError('Personel zaten seçilen yatakta konaklıyor. Aynı yatağa yeniden atama yapılamaz.', 409);
        }
        if (bed.isOccupied && bed.currentEmployeeId !== employeeId) {
          throw new AppError('Seçilen yatak başka bir personel tarafından dolu.', 400);
        }
        if (bed.room.roomType !== 'PERSONEL_ODASI') throw new AppError('Hizmet alanlarına personel yerleştirilemez.', 400);

        if (bed.room.status !== 'READY') {
          throw new AppError(
            `Seçilen oda hazır durumda değil (${bed.room.status === 'NEEDS_CLEANING' ? 'Temizlik Bekliyor' : 'Arızalı/Bakımda'}). Yalnızca hazır durumdaki odalara personel ataması yapılabilir.`,
            400
          );
        }

        const targetGender = data.gender || employee.gender;
        if (bed.room.block.genderPolicy !== 'Mixed' && bed.room.block.genderPolicy !== targetGender) {
          throw new AppError(
            `Personel cinsiyeti (${targetGender === 'Male' ? 'Erkek' : 'Kadın'}), seçilen lojman bloğu politikasıyla (${bed.room.block.name}) uyuşmuyor.`,
            400
          );
        }

        // Check for conflicting gender in the same room
        const otherBedsInRoom = await tx.bed.findMany({
          where: { roomId: bed.roomId, isOccupied: true, NOT: { currentEmployeeId: employeeId } },
          include: { currentEmployee: { select: { gender: true, firstName: true, lastName: true } } },
        });

        const conflictingOccupant = otherBedsInRoom.find(
          (b) => b.currentEmployee && b.currentEmployee.gender !== targetGender
        );

        if (conflictingOccupant) {
          throw new AppError(
            `Seçilen odada (${bed.room.block.name} Oda ${bed.room.roomNumber}) halen ${conflictingOccupant.currentEmployee?.gender === 'Male' ? 'Erkek' : 'Kadın'} bir personel (${conflictingOccupant.currentEmployee?.firstName} ${conflictingOccupant.currentEmployee?.lastName}) ikamet etmektedir. Aynı odaya karşı cinsiyette personel yerleştirilemez.`,
            400
          );
        }

        // Verify room capacity limit
        const occupiedCountInRoom = otherBedsInRoom.length;
        if (occupiedCountInRoom >= bed.room.capacity) {
          throw new AppError(
            `Seçilen oda (${bed.room.block.name} Oda ${bed.room.roomNumber}) maksimum ${bed.room.capacity} kişilik doluluğa ulaşmıştır. Yeni personel yerleştirilemez.`,
            400
          );
        }

        const now = new Date();
        await tx.occupancyLog.updateMany({
          where: { employeeId, checkOutDate: null },
          data: { checkOutDate: now, checkedOutById: data.createdById || null },
        });

        // Free previous bed if assigned
        await tx.bed.updateMany({
          where: { currentEmployeeId: employeeId },
          data: { isOccupied: false, currentEmployeeId: null },
        });

        // Assign new bed
        const claimedBed = await tx.bed.updateMany({
          where: { id: data.bedId, isOccupied: false, currentEmployeeId: null },
          data: { isOccupied: true, currentEmployeeId: employeeId },
        });
        if (claimedBed.count !== 1) throw new AppError('Seçilen yatak başka bir işlem tarafından dolduruldu. Lütfen yeniden seçim yapın.', 409);

        // Update status to RESIDENT
        updateData.status = 'RESIDENT';
        updateData.checkedOutById = null;
        if (employee.userId) {
          await setEmployeePortalAccountActive(tx, employee.userId, true, data.createdById, 'EMPLOYEE_PORTAL_ACCOUNT_REACTIVATED', 'PERSONEL YENİDEN YERLEŞTİRİLDİĞİ İÇİN PORTAL HESABI AÇILDI');
        }

        // Log Occupancy
        await tx.occupancyLog.create({
          data: {
            employeeId,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeDepartment: (data.department?.trim() || employee.department).toLocaleUpperCase('tr-TR'),
            employeeTitle: (data.title === undefined ? employee.title : data.title?.trim() || null)?.toLocaleUpperCase('tr-TR') || null,
            employeeCompany: data.company === undefined ? employee.company : normalizeText(data.company),
            bedId: data.bedId,
            checkInDate: now,
            transferReason: 'PERSONELE ODA & YATAK ATAMASI YAPILDI',
            createdById: data.createdById || null,
          },
        });

      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
          beds: {
            include: {
              room: {
                include: { block: true },
              },
            },
          },
          inventories: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
          disciplinaryNotes: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
          occupancies: {
            orderBy: { checkInDate: 'desc' },
            include: {
              bed: {
                include: {
                  room: {
                    include: {
                      block: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const latestOccupancy = updated.occupancies && updated.occupancies.length > 0 ? updated.occupancies[0] : null;
      const { tcNo: storedTcNo, tcNoHash: _tcNoHash, ...safeEmployee } = updated;

      return {
        ...safeEmployee,
        tcNoMasked: maskTcNo(storedTcNo),
        checkInDate: latestOccupancy ? latestOccupancy.checkInDate : null,
        checkOutDate: latestOccupancy ? latestOccupancy.checkOutDate : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Personel, yatak, kullanıcı adı veya e-posta bilgisi başka bir işlemde kullanıldı.', 409);
      if (error?.code === 'P2034') throw new AppError('Personel veya yatak aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    });
  }

  /**
   * Add Zimmet veya Şahsi Eşya Beyan Kaydı
   */
  public static async addInventoryItem(employeeId: string, data: { itemName: string; itemCode?: string; category?: string; serialNo?: string; photoUrl?: string; notes?: string; createdById?: string; stockItemId?: string }) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId, isDeleted: false } });
    if (!employee) throw new AppError('Personel bulunamadı.', 404);
    const category = data.category || 'LOJMAN_ZİMMETİ';
    const cleanSerial = normalizeIdentifier(data.serialNo);
    if (!['LOJMAN_ZİMMETİ', 'ŞAHSİ_EŞYA'].includes(category)) throw new AppError('Geçersiz eşya kategorisi.', 400);
    if (category === 'LOJMAN_ZİMMETİ' && !data.stockItemId) throw new AppError('Lojman zimmeti için depo stok kartı seçilmelidir.', 400);

    if (category === 'LOJMAN_ZİMMETİ' && data.stockItemId) {
      try {
        return await prisma.$transaction(async (tx) => {
        const stockItem = await tx.stockItem.findUnique({ where: { id: data.stockItemId } });
        if (!stockItem || !stockItem.isActive) throw new AppError('Seçilen aktif stok kalemi bulunamadı.', 404);
        if (stockItem.itemType !== 'SARF_MALZEME' && !cleanSerial) throw new AppError('Demirbaş zimmeti için cihazın üretici seri numarası zorunludur.', 400);
        if (cleanSerial) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`INVENTORY_SERIAL:${cleanSerial}`}))`;
          const [personnelDuplicate, roomDuplicate] = await Promise.all([
            tx.inventoryItem.findFirst({ where: { serialNo: cleanSerial, returnedDate: null, isDeleted: false }, select: { id: true } }),
            tx.roomInventory.findFirst({ where: { serialNo: cleanSerial, returnedAt: null }, select: { id: true } }),
          ]);
          if (personnelDuplicate || roomDuplicate) throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
        }
        if (stockItem.totalStock - stockItem.usedStock - stockItem.usedInRooms <= 0) {
          throw new AppError(`Depoda yeterli miktarda "${stockItem.itemName}" kalmamıştır.`, 400);
        }
        await reservePersonnelStock(tx, stockItem.id);
        const created = await tx.inventoryItem.create({
          data: {
            employeeId,
            itemName: stockItem.itemName,
            itemCode: stockItem.itemCode,
            category,
            serialNo: cleanSerial,
            photoUrl: validatePhotoUrl(data.photoUrl),
            status: 'TESLİM_EDİLDİ',
            notes: data.notes ? boundedText(data.notes, 'Eşya notu', 1000, { casing: 'upper' }) : null,
            createdById: data.createdById || null,
            stockItemId: stockItem.id,
          },
        });
        const sharedAssetId = await syncSharedAssetPersonnelAssignment(tx, stockItem.id, created.id, employee.id, created.assignedDate, data.createdById);
        await tx.stockMovement.create({ data: {
          stockItemId: stockItem.id, employeeId, personnelInventoryId: created.id,
          sharedAssetId,
          type: 'PERSONNEL_ASSIGNMENT', quantity: -1, itemNameSnapshot: stockItem.itemName,
          reason: 'PERSONELE ZİMMET', notes: created.notes, createdById: data.createdById,
        } });
        return created;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error: any) {
        if (error instanceof AppError) throw error;
        if (error?.code === 'P2002') throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
        if (error?.code === 'P2034') throw new AppError('Zimmet veya stok aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
        throw error;
      }
    }

    const rawItemName = boundedText(data.itemName, 'Eşya adı', 120, { required: true, casing: 'upper' })!;
    const itemName = normalizeInventoryItemName(rawItemName)!;

    try {
      return await prisma.$transaction(async (tx) => {
        if (cleanSerial) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`INVENTORY_SERIAL:${cleanSerial}`}))`;
          const [personnelDuplicate, roomDuplicate] = await Promise.all([
            tx.inventoryItem.findFirst({ where: { serialNo: cleanSerial, returnedDate: null, isDeleted: false }, select: { id: true } }),
            tx.roomInventory.findFirst({ where: { serialNo: cleanSerial, returnedAt: null }, select: { id: true } }),
          ]);
          if (personnelDuplicate || roomDuplicate) throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
        }
        return tx.inventoryItem.create({ data: {
        employeeId,
        itemName,
        itemCode: boundedText(data.itemCode, 'Eşya kodu', 80, { casing: 'upper' }),
        category,
        serialNo: cleanSerial,
        photoUrl: validatePhotoUrl(data.photoUrl),
        status: category === 'ŞAHSİ_EŞYA' ? 'ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK' : 'TESLİM_EDİLDİ',
        notes: boundedText(data.notes, 'Eşya notu', 1000, { casing: 'upper' }),
        createdById: data.createdById || null,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Eşya kaydı aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    }
  }

  /**
   * Update Inventory or Personal Belonging Item
   */
  public static async updateInventoryItem(inventoryId: string, data: { itemName?: string; serialNo?: string; notes?: string }) {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: inventoryId, isDeleted: false }, select: { id: true, stockItemId: true, returnedDate: true, updatedAt: true } });
    if (!existing) throw new AppError('Zimmet/Eşya kaydı bulunamadı.', 404);
    if (existing.returnedDate) throw new AppError('Kapatılmış zimmet veya eşya kaydı değiştirilemez.', 409);
    const cleanSerial = data.serialNo === undefined ? undefined : normalizeIdentifier(data.serialNo);
    try {
      return await prisma.$transaction(async (tx) => {
        if (cleanSerial) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`INVENTORY_SERIAL:${cleanSerial}`}))`;
          const [personnelDuplicate, roomDuplicate] = await Promise.all([
            tx.inventoryItem.findFirst({ where: { id: { not: inventoryId }, serialNo: cleanSerial, returnedDate: null, isDeleted: false }, select: { id: true } }),
            tx.roomInventory.findFirst({ where: { serialNo: cleanSerial, returnedAt: null }, select: { id: true } }),
          ]);
          if (personnelDuplicate || roomDuplicate) throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
        }
        const changed = await tx.inventoryItem.updateMany({
          where: { id: inventoryId, isDeleted: false, returnedDate: null, updatedAt: existing.updatedAt },
          data: {
            ...(data.itemName !== undefined && !existing.stockItemId && { itemName: normalizeInventoryItemName(boundedText(data.itemName, 'Eşya adı', 120, { required: true, casing: 'upper' }))! }),
            ...(data.serialNo !== undefined && { serialNo: cleanSerial }),
            ...(data.notes !== undefined && { notes: boundedText(data.notes, 'Eşya notu', 1000, { casing: 'upper' }) }),
          },
        });
        if (changed.count !== 1) throw new AppError('Zimmet kaydı başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.', 409);
        return tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryId } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Bu seri numarası başka bir aktif zimmette kullanılıyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Zimmet kaydı aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    }
  }

  /**
   * Return / Receive back Inventory Item (Teslim Al / İade Al veya Teslim Alınamadı Kaydı)
   */
  public static async returnInventoryItem(inventoryId: string, returnedById?: string, status?: string, notes?: string) {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: inventoryId, isDeleted: false } });
    if (!existing) throw new AppError('Zimmet/Eşya kaydı bulunamadı.', 404);
    if (existing.returnedDate) throw new AppError('Bu zimmet daha önce kapatılmış.', 409);
    const finalStatus = status || 'TAM_İADE_ALINDI';
    if (!['TAM_İADE_ALINDI', 'TESLİM_ALINAMADI'].includes(finalStatus)) throw new AppError('Geçersiz iade durumu.', 400);
    const dataToUpdate: any = {
      status: finalStatus,
      returnedDate: new Date(),
      returnedById: returnedById || null,
    };
    if (notes !== undefined) dataToUpdate.notes = boundedText(notes, 'İade notu', 1000, { casing: 'upper' });

    if (existing.stockItemId) {
      return prisma.$transaction(async (tx) => {
        const isLost = finalStatus === 'TESLİM_ALINAMADI';
        await releasePersonnelStock(tx, existing.stockItemId!, isLost);
        const changed = await tx.inventoryItem.updateMany({ where: { id: inventoryId, isDeleted: false, returnedDate: null, updatedAt: existing.updatedAt }, data: dataToUpdate });
        if (changed.count !== 1) throw new AppError('Zimmet başka bir işlemde kapatıldı. Sayfayı yenileyin.', 409);
        const updated = await tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryId } });
        const stockItem = await tx.stockItem.findUniqueOrThrow({ where: { id: existing.stockItemId! } });
        const sharedAssetId = await syncSharedAssetReturn(tx, stockItem.id, 'EMPLOYEE', existing.id, isLost ? 'RETIRED' : 'AVAILABLE', dataToUpdate.notes || finalStatus, returnedById);
        await tx.stockMovement.create({ data: {
          stockItemId: stockItem.id, employeeId: existing.employeeId, personnelInventoryId: existing.id,
          sharedAssetId,
          type: isLost ? 'RETIREMENT' : 'PERSONNEL_RETURN', quantity: isLost ? -1 : 1,
          itemNameSnapshot: existing.itemName, reason: finalStatus,
          notes: dataToUpdate.notes || null, createdById: returnedById,
        } });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
        if (error instanceof AppError) throw error;
        if (error?.code === 'P2034') throw new AppError('Zimmet veya stok aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
        throw error;
      });
    }

    const changed = await prisma.inventoryItem.updateMany({ where: { id: inventoryId, isDeleted: false, returnedDate: null, updatedAt: existing.updatedAt }, data: dataToUpdate });
    if (changed.count !== 1) throw new AppError('Eşya kaydı başka bir işlemde kapatıldı. Sayfayı yenileyin.', 409);
    return prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryId } });
  }

  /**
   * Delete Inventory Item
   */
  public static async deleteInventoryItem(inventoryId: string, deletedById?: string) {
    const existing = await prisma.inventoryItem.findFirst({ where: { id: inventoryId, isDeleted: false } });
    if (!existing) throw new AppError('Zimmet/Eşya kaydı bulunamadı.', 404);

    if (existing.stockItemId) throw new AppError('Stok bağlantılı zimmet kayıtları denetim geçmişini korumak için silinemez.', 409);

    const archived = await prisma.inventoryItem.updateMany({ where: { id: inventoryId, isDeleted: false, updatedAt: existing.updatedAt }, data: { isDeleted: true, deletedAt: new Date(), deletedById: deletedById || null } });
    if (archived.count !== 1) throw new AppError('Eşya kaydı başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.', 409);
    return { archived: true };
  }

  /**
   * Add Disiplin / Şikayet Notu
   */
  public static async addDisciplinaryNote(employeeId: string, data: { title: string; content: string; reportedBy?: string; createdById?: string }) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId, isDeleted: false } });
    if (!employee) throw new AppError('Personel bulunamadı.', 404);
    const title = boundedText(data.title, 'Not başlığı', 150, { required: true, casing: 'upper' })!;
    const content = boundedText(data.content, 'Not açıklaması', 3000, { required: true, casing: 'upper' })!;

    return prisma.disciplinaryNote.create({
      data: {
        employeeId,
        title,
        content,
        reportedBy: boundedText(data.reportedBy, 'Bildiren', 120, { casing: 'upper' }) || 'LOJMAN AMİRLİĞİ',
        status: 'GÖRÜŞÜLDÜ',
        createdById: data.createdById || null,
      },
    });
  }

  /**
   * Update Disiplin / Şikayet Notu
   */
  public static async updateDisciplinaryNote(noteId: string, data: { title?: string; content?: string }) {
    const note = await prisma.disciplinaryNote.findFirst({ where: { id: noteId, isDeleted: false } });
    if (!note) throw new AppError('Disiplin notu bulunamadı.', 404);

    const changed = await prisma.disciplinaryNote.updateMany({
      where: { id: noteId, isDeleted: false, updatedAt: note.updatedAt },
      data: {
        ...(data.title !== undefined && { title: boundedText(data.title, 'Not başlığı', 150, { required: true, casing: 'upper' })! }),
        ...(data.content !== undefined && { content: boundedText(data.content, 'Not açıklaması', 3000, { required: true, casing: 'upper' })! }),
      },
    });
    if (changed.count !== 1) throw new AppError('Disiplin notu başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.', 409);
    return prisma.disciplinaryNote.findUniqueOrThrow({ where: { id: noteId } });
  }

  /**
   * Delete Disiplin / Şikayet Notu
   */
  public static async deleteDisciplinaryNote(noteId: string, deletedById?: string) {
    const note = await prisma.disciplinaryNote.findFirst({ where: { id: noteId, isDeleted: false } });
    if (!note) throw new AppError('Disiplin notu bulunamadı.', 404);

    const archived = await prisma.disciplinaryNote.updateMany({ where: { id: noteId, isDeleted: false, updatedAt: note.updatedAt }, data: { isDeleted: true, deletedAt: new Date(), deletedById: deletedById || null } });
    if (archived.count !== 1) throw new AppError('Disiplin notu başka bir kullanıcı tarafından güncellendi. Sayfayı yenileyin.', 409);
    return { archived: true };
  }

  /**
   * Get available unoccupied beds compatible with gender and room occupation policy
   */
  public static async getAvailableBeds(gender?: string) {
    if (gender && !GENDERS.has(gender)) throw new AppError('Geçersiz cinsiyet filtresi.', 400);
    const where: any = {
      isOccupied: false,
      currentEmployeeId: null,
      room: {
        status: 'READY',
        roomType: 'PERSONEL_ODASI',
      },
    };

    if (gender) {
      where.room = {
        status: 'READY',
        roomType: 'PERSONEL_ODASI',
        block: {
          OR: [
            { genderPolicy: gender },
            { genderPolicy: 'Mixed' },
          ],
        },
      };
    }

    const availableBeds = await prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            block: true,
            beds: {
              where: { isOccupied: true },
              include: {
                currentEmployee: { select: { gender: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { room: { block: { name: 'asc' } } },
        { room: { roomNumber: 'asc' } },
        { bedLabel: 'asc' },
      ],
    });

    return availableBeds.filter((bed) => {
      if (bed.room.beds.length >= bed.room.capacity) return false;
      if (!gender) return true;
      const roomOccupants = bed.room.beds;
      const hasOppositeGender = roomOccupants.some(
        (b) => b.currentEmployee && b.currentEmployee.gender !== gender
      );
      return !hasOppositeGender;
    });
  }

  /**
   * Get all employee details including encrypted TC number for Excel export
   */
  public static async getExportEmployees(search?: string, status?: string, department?: string, gender?: string, startDate?: string, endDate?: string, maxRows = 10000) {
    const validatedStatus = validateEmployeeFilterStatus(status);
    const validatedDepartment = validateEmployeeDepartmentFilter(department);
    const validatedGender = validateEmployeeGenderFilter(gender);
    const where: any = { isDeleted: false };

    if (validatedStatus !== 'ALL') where.status = validatedStatus;

    if (validatedDepartment !== 'ALL') where.department = validatedDepartment;

    if (validatedGender !== 'ALL') where.gender = validatedGender;

    if (startDate || endDate) {
      const start = parseIstanbulDateBoundary(startDate, false);
      const end = parseIstanbulDateBoundary(endDate, true);
      assertDateRange(start, end);
      const dateFilter: any = { ...(start && { gte: start }), ...(end && { lte: end }) };

      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { createdAt: dateFilter },
          { occupancies: { some: { checkInDate: dateFilter } } },
        ],
      });
    }

    applyEmployeeSearch(where, search);

    const rows = await prisma.employee.findMany({
      where,
      include: {
        createdBy: {
          select: {
            fullName: true,
            username: true,
          },
        },
        checkedOutBy: {
          select: {
            fullName: true,
            username: true,
          },
        },
        beds: {
          include: {
            room: {
              include: {
                block: true,
              },
            },
          },
        },
        occupancies: {
          orderBy: { checkInDate: 'desc' },
          include: {
            createdBy: {
              select: { fullName: true, username: true },
            },
            checkedOutBy: {
              select: { fullName: true, username: true },
            },
            bed: {
              include: {
                room: {
                  include: {
                    block: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: maxRows + 1,
    });
    if (rows.length > maxRows) throw new AppError(`Personel raporu ${maxRows.toLocaleString('tr-TR')} kayıt sınırını aşıyor. Filtreyi veya tarih aralığını daraltın.`, 413);
    return rows;
  }

  /**
   * Checkout employee from their assigned room/bed
   */
  public static async checkoutEmployeeFromRoom(employeeId: string, checkedOutById?: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, isDeleted: false },
        include: { beds: true },
      });
      if (!employee) throw new AppError('Personel bulunamadı.', 404);

      const hasBed = employee.beds && employee.beds.length > 0;
      if (!hasBed) {
        throw new AppError('Personel zaten herhangi bir odaya yerleştirilmemiş.', 400);
      }
      const activeStockInventories = await tx.inventoryItem.count({ where: { employeeId, isDeleted: false, returnedDate: null, stockItemId: { not: null } } });
      if (activeStockInventories > 0) throw new AppError(`Personelin ${activeStockInventories} aktif stok zimmeti bulunuyor. Oda çıkışından önce zimmetleri teslim alın veya teslim alınamadı olarak kapatın.`, 409);
      const insideVisitors = await tx.visitor.count({ where: { hostEmployeeId: employeeId, status: 'INSIDE', isDeleted: false } });
      if (insideVisitors > 0) throw new AppError(`Personelin içeride görünen ${insideVisitors} ziyaretçisi bulunuyor. Oda çıkışından önce ziyaretçi çıkışlarını tamamlayın.`, 409);
      const openOccupancies = await tx.occupancyLog.count({ where: { employeeId, checkOutDate: null } });
      if (openOccupancies !== 1) throw new AppError('Personelin yatak kaydı ile açık konaklama geçmişi uyuşmuyor. İşlem durduruldu; sistem yöneticisi veri bütünlüğünü kontrol etmelidir.', 409);

      const now = new Date();

      // 1. Close active occupancy logs
      await tx.occupancyLog.updateMany({
        where: { employeeId, checkOutDate: null },
        data: { 
          checkOutDate: now,
          checkedOutById: checkedOutById || null,
        },
      });

      // 2. Free all beds assigned to this employee
      await tx.bed.updateMany({
        where: { currentEmployeeId: employeeId },
        data: { isOccupied: false, currentEmployeeId: null },
      });

      // 3. Update employee status to CHECKED_OUT & record checkout user
      if (employee.userId) {
        await setEmployeePortalAccountActive(tx, employee.userId, false, checkedOutById, 'EMPLOYEE_PORTAL_ACCOUNT_DEACTIVATED', 'ODA ÇIKIŞI NEDENİYLE PORTAL HESABI KAPATILDI');
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { 
          status: 'CHECKED_OUT',
          checkedOutById: checkedOutById || null,
        },
        include: {
          user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
          beds: {
            include: {
              room: {
                include: { block: true },
              },
            },
          },
          inventories: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
          disciplinaryNotes: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
          occupancies: {
            orderBy: { checkInDate: 'desc' },
            include: {
              bed: {
                include: {
                  room: {
                    include: {
                      block: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const latestOccupancy = updated.occupancies && updated.occupancies.length > 0 ? updated.occupancies[0] : null;
      const { tcNo: storedTcNo, tcNoHash: _tcNoHash, ...safeEmployee } = updated;

      return {
        ...safeEmployee,
        tcNoMasked: maskTcNo(storedTcNo),
        checkInDate: latestOccupancy ? latestOccupancy.checkInDate : null,
        checkOutDate: latestOccupancy ? latestOccupancy.checkOutDate : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2034') throw new AppError('Personel çıkışı aynı anda başka bir işlemle çakıştı. Sayfayı yenileyip tekrar deneyin.', 409);
      throw error;
    });
  }

  /**
   * Generates a unique username and easy password for an existing employee who has no user account
   */
  public static async generateAccountForEmployee(employeeId: string, actorUserId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId, isDeleted: false },
      include: { user: true },
    });

    if (!employee) throw new AppError('Personel bulunamadı.', 404);
    if (employee.userId || employee.user) {
      throw new AppError('Bu personelin zaten tanımlı bir kullanıcı hesabı var.', 400);
    }

    const username = await generateUniqueUsername(employee.firstName, employee.lastName);
    const password = await generateUniqueEasyPassword();
    const email = `${username}@lojman.local`;
    const passwordHash = await bcrypt.hash(password, config.security.saltRounds);

    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.employee.findFirst({ where: { id: employeeId, isDeleted: false }, select: { id: true, userId: true, updatedAt: true } });
        if (!current) throw new AppError('Personel bulunamadı.', 404);
        if (current.userId) throw new AppError('Bu personelin zaten tanımlı bir kullanıcı hesabı var.', 409);
        const newUser = await tx.user.create({ data: {
          username, email, passwordHash, fullName: `${employee.firstName} ${employee.lastName}`, role: Role.STAFF, isActive: employee.status !== 'CHECKED_OUT', mustChangePassword: true,
        } });
        const linked = await tx.employee.updateMany({ where: { id: employeeId, isDeleted: false, userId: null, updatedAt: current.updatedAt }, data: { userId: newUser.id } });
        if (linked.count !== 1) throw new AppError('Personel hesabı aynı anda başka bir işlemde değiştirildi. Sayfayı yenileyin.', 409);
        await tx.userAuditLog.create({ data: { targetUserId: newUser.id, actorUserId, action: 'EMPLOYEE_PORTAL_ACCOUNT_GENERATED', afterRole: Role.STAFF, notes: 'PERSONEL DETAYINDAN TEK KULLANIMLIK PAROLA ÜRETİLDİ' } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Kullanıcı adı veya e-posta başka bir hesapta kullanılıyor. İşlemi yeniden deneyin.', 409);
      if (error?.code === 'P2034') throw new AppError('Personel hesabı aynı anda değiştirildi. İşlemi yeniden deneyin.', 409);
      throw error;
    }

    return {
      username,
      password,
      role: Role.STAFF,
    };
  }
}

