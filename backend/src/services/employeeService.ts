import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { encryptSensitiveData, hashSensitiveData, maskTcNo } from '../utils/crypto';
import { generateUniqueUsername, generateUniqueEasyPassword } from '../utils/credentialGenerator';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { boundedText, normalizeIdentifier, normalizeInventoryItemName, normalizePhone, normalizeUpper, strictBoolean } from '../utils/normalization';
import { AGE_GROUPS, canonicalChoice, EMERGENCY_RELATIONS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_TITLES, LANGUAGE_NATIONALITIES, SHIFT_TYPES } from '../utils/employeeDomain';
import { config } from '../config';

/**
 * Turkish Locale-aware Title Case Normalization
 * E.g. "usta cam" -> "Usta Cam", "USTA CAM" -> "Usta Cam"
 */
export function normalizeText(text?: string | null): string | null {
  return normalizeUpper(text);
}

const GENDERS = new Set(['Male', 'Female']);
const USER_ROLES = new Set<Role>([Role.ADMIN, Role.HOUSING_MANAGER, Role.SECURITY, Role.STAFF]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): string {
  const clean = email.trim().toLocaleLowerCase('en-US');
  if (clean.length > 254 || !EMAIL_PATTERN.test(clean)) throw new AppError('Geçerli bir e-posta adresi giriniz.', 400);
  return clean;
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
      const now = new Date();
      if (employee.beds.length > 0) {
        await tx.bed.updateMany({
          where: { currentEmployeeId: employeeId },
          data: { currentEmployeeId: null, isOccupied: false },
        });
        await tx.occupancyLog.updateMany({
          where: { employeeId, checkOutDate: null },
          data: { checkOutDate: now, checkedOutById: deletedById || null },
        });
      }
      // Also close active inventories assigned to deleted employee
      await tx.inventoryItem.updateMany({
        where: { employeeId, returnedDate: null },
        data: {
          status: 'TAM_İADE_ALINDI',
          returnedDate: now,
          returnedById: deletedById || null,
        },
      });
      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: false },
        });
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
          orderBy: { createdAt: 'desc' },
        },
        disciplinaryNotes: {
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
  public static async getAllEmployees(search?: string, status?: string, department?: string, gender?: string, startDate?: string, endDate?: string) {
    const where: any = { isDeleted: false };

    if (status && status !== 'ALL') {
      if (['PENDING_ASSIGNMENT', 'RESIDENT', 'ON_LEAVE', 'CHECKED_OUT'].includes(status)) {
        where.status = status;
      }
    }

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (gender && gender !== 'ALL') {
      if (['Male', 'Female'].includes(gender)) {
        where.gender = gender;
      }
    }

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
    });

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
    let accountCreateData: { username: string; email: string; passwordHash: string; fullName: string; role: Role } | null = null;

    if (data.systemUser?.createAccount !== false) {
      let targetUsername = data.systemUser?.username?.trim().toLowerCase();
      let targetEmail = data.systemUser?.email ? validateEmail(data.systemUser.email) : undefined;
      let targetPassword = data.systemUser?.password;
      let targetRole = data.systemUser?.role && USER_ROLES.has(data.systemUser.role)
        ? data.systemUser.role
        : Role.STAFF;

      if (!targetUsername) {
        targetUsername = await generateUniqueUsername(normalizedFirstName, normalizedLastName);
      }
      if (!targetPassword) {
        targetPassword = await generateUniqueEasyPassword();
      }
      if (targetPassword.length < 10 || !/[A-ZÇĞİÖŞÜ]/.test(targetPassword) || !/\d/.test(targetPassword)) {
        throw new AppError('Sistem kullanıcısı şifresi en az 10 karakter, bir büyük harf ve bir rakam içermelidir.', 400);
      }
      if (!/^[a-z0-9._-]{3,50}$/.test(targetUsername)) throw new AppError('Kullanıcı adı 3-50 karakter olmalı ve yalnızca küçük harf, rakam, nokta, tire veya alt çizgi içermelidir.', 400);
      if (!targetEmail) {
        targetEmail = `${targetUsername}@lojman.local`;
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ username: targetUsername }, { email: targetEmail }] },
      });
      if (existingUser) {
        targetEmail = `${targetUsername}.${Date.now().toString().slice(-4)}@lojman.local`;
      }

      const passwordHash = await bcrypt.hash(targetPassword, config.security.saltRounds);
      accountCreateData = {
        username: targetUsername,
        email: targetEmail,
        passwordHash,
        fullName: `${normalizedFirstName} ${normalizedLastName}`,
        role: targetRole,
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
    });
  }

  /**
   * Update Employee details
   */
  public static async updateEmployee(employeeId: string, data: Partial<CreateEmployeeDTO>) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new AppError('Personel bulunamadı.', 404);

    const updateData: any = {};
    let pendingUserUpdate: Record<string, unknown> | null = null;
    let pendingUserCreate: { username: string; email: string; passwordHash: string; fullName: string; role: Role; isActive: boolean } | null = null;
    if (data.firstName !== undefined) updateData.firstName = boundedText(data.firstName, 'Personel adı', 80, { required: true, minLength: 2, casing: 'upper' });
    if (data.lastName !== undefined) updateData.lastName = boundedText(data.lastName, 'Personel soyadı', 80, { required: true, minLength: 2, casing: 'upper' });
    if (data.gender !== undefined) {
      if (!GENDERS.has(data.gender)) throw new AppError('Geçerli bir cinsiyet seçilmelidir.', 400);
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
        if (employee.userId) {
          const updateUserData: any = {};
          if (data.systemUser.username) updateUserData.username = data.systemUser.username.trim().toLowerCase();
          if (data.systemUser.email) updateUserData.email = validateEmail(data.systemUser.email);
          if (data.systemUser.role) updateUserData.role = data.systemUser.role;
          if (data.systemUser.password && data.systemUser.password.trim().length >= 10 && /[A-ZÇĞİÖŞÜ]/.test(data.systemUser.password) && /\d/.test(data.systemUser.password)) {
            updateUserData.passwordHash = await bcrypt.hash(data.systemUser.password.trim(), config.security.saltRounds);
          } else if (data.systemUser.password) {
            throw new AppError('Sistem kullanıcısı şifresi en az 10 karakter, bir büyük harf ve bir rakam içermelidir.', 400);
          }
          if (Object.keys(updateUserData).length > 0) {
            pendingUserUpdate = { ...(pendingUserUpdate || {}), ...updateUserData };
          }
        } else {
          const { username, email, password, role } = data.systemUser;
          if (!username || !username.trim()) throw new AppError('Sistem kullanıcısı için kullanıcı adı zorunludur.', 400);
          if (!email || !email.trim()) throw new AppError('Sistem kullanıcısı için e-posta adresi zorunludur.', 400);
          if (!password || password.length < 10 || !/[A-ZÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) throw new AppError('Sistem kullanıcısı şifresi en az 10 karakter, bir büyük harf ve bir rakam içermelidir.', 400);

          const cleanUsername = username.trim().toLowerCase();
          const cleanEmail = validateEmail(email);
          const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] },
          });
          if (existingUser) throw new AppError('Girilen kullanıcı adı veya e-posta adresi sistemde zaten kayıtlı.', 409);

          const passwordHash = await bcrypt.hash(password, config.security.saltRounds);
          const userRole = role && USER_ROLES.has(role) ? role : Role.STAFF;

          const targetFirstName = data.firstName ? normalizeText(data.firstName) : employee.firstName;
          const targetLastName = data.lastName ? normalizeText(data.lastName)?.toLocaleUpperCase('tr-TR') : employee.lastName;

          pendingUserCreate = {
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            fullName: `${targetFirstName} ${targetLastName}`,
            role: userRole,
            isActive: true,
          };
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      if (pendingUserUpdate && employee.userId) {
        await tx.user.update({ where: { id: employee.userId }, data: pendingUserUpdate });
      }
      if (pendingUserCreate) {
        const newUser = await tx.user.create({ data: pendingUserCreate });
        updateData.userId = newUser.id;
      }
      // If bedId is provided, handle bed assignment
      if (data.bedId) {
        const bed = await tx.bed.findUnique({
          where: { id: data.bedId },
          include: { room: { include: { block: true } } },
        });

        if (!bed) throw new AppError('Seçilen yatak bulunamadı.', 404);
        if (bed.isOccupied && bed.currentEmployeeId !== employeeId) {
          throw new AppError('Seçilen yatak başka bir personel tarafından dolu.', 400);
        }

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
          inventories: { orderBy: { createdAt: 'desc' } },
          disciplinaryNotes: { orderBy: { createdAt: 'desc' } },
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
    });
  }

  /**
   * Add Zimmet veya Şahsi Eşya Beyan Kaydı
   */
  public static async addInventoryItem(employeeId: string, data: { itemName: string; itemCode?: string; category?: string; serialNo?: string; photoUrl?: string; notes?: string; createdById?: string }) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId, isDeleted: false } });
    if (!employee) throw new AppError('Personel bulunamadı.', 404);
    const rawItemName = boundedText(data.itemName, 'Eşya adı', 120, { required: true, casing: 'upper' })!;
    const itemName = normalizeInventoryItemName(rawItemName)!;
    const category = data.category || 'LOJMAN_ZİMMETİ';
    if (!['LOJMAN_ZİMMETİ', 'ŞAHSİ_EŞYA'].includes(category)) throw new AppError('Geçersiz eşya kategorisi.', 400);

    return prisma.inventoryItem.create({
      data: {
        employeeId,
        itemName,
        itemCode: boundedText(data.itemCode, 'Eşya kodu', 80, { casing: 'upper' }),
        category,
        serialNo: boundedText(data.serialNo, 'Seri numarası', 120, { casing: 'upper' }),
        photoUrl: validatePhotoUrl(data.photoUrl),
        status: category === 'ŞAHSİ_EŞYA' ? 'ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK' : 'TESLİM_EDİLDİ',
        notes: boundedText(data.notes, 'Eşya notu', 1000, { casing: 'upper' }),
        createdById: data.createdById || null,
      },
    });
  }

  /**
   * Update Inventory or Personal Belonging Item
   */
  public static async updateInventoryItem(inventoryId: string, data: { itemName?: string; serialNo?: string; notes?: string }) {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: inventoryId }, select: { id: true } });
    if (!existing) throw new AppError('Zimmet/Eşya kaydı bulunamadı.', 404);
    return prisma.inventoryItem.update({
      where: { id: inventoryId },
      data: {
        ...(data.itemName !== undefined && { itemName: normalizeInventoryItemName(boundedText(data.itemName, 'Eşya adı', 120, { required: true, casing: 'upper' }))! }),
        ...(data.serialNo !== undefined && { serialNo: boundedText(data.serialNo, 'Seri numarası', 120, { casing: 'upper' }) }),
        ...(data.notes !== undefined && { notes: boundedText(data.notes, 'Eşya notu', 1000, { casing: 'upper' }) }),
      },
    });
  }

  /**
   * Return / Receive back Inventory Item (Teslim Al / İade Al veya Teslim Alınamadı Kaydı)
   */
  public static async returnInventoryItem(inventoryId: string, returnedById?: string, status?: string, notes?: string) {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: inventoryId } });
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
    return prisma.inventoryItem.update({
      where: { id: inventoryId },
      data: dataToUpdate,
    });
  }

  /**
   * Delete Inventory Item
   */
  public static async deleteInventoryItem(inventoryId: string) {
    return prisma.inventoryItem.delete({
      where: { id: inventoryId },
    });
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
    const note = await prisma.disciplinaryNote.findUnique({ where: { id: noteId } });
    if (!note) throw new AppError('Disiplin notu bulunamadı.', 404);

    return prisma.disciplinaryNote.update({
      where: { id: noteId },
      data: {
        ...(data.title !== undefined && { title: boundedText(data.title, 'Not başlığı', 150, { required: true, casing: 'upper' })! }),
        ...(data.content !== undefined && { content: boundedText(data.content, 'Not açıklaması', 3000, { required: true, casing: 'upper' })! }),
      },
    });
  }

  /**
   * Delete Disiplin / Şikayet Notu
   */
  public static async deleteDisciplinaryNote(noteId: string) {
    const note = await prisma.disciplinaryNote.findUnique({ where: { id: noteId } });
    if (!note) throw new AppError('Disiplin notu bulunamadı.', 404);

    return prisma.disciplinaryNote.delete({
      where: { id: noteId },
    });
  }

  /**
   * Get available unoccupied beds compatible with gender and room occupation policy
   */
  public static async getAvailableBeds(gender?: string) {
    if (gender && !GENDERS.has(gender)) throw new AppError('Geçersiz cinsiyet filtresi.', 400);
    const where: any = {
      isOccupied: false,
      room: {
        status: 'READY',
      },
    };

    if (gender) {
      where.room = {
        status: 'READY',
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

    if (gender) {
      return availableBeds.filter((bed) => {
        const roomOccupants = bed.room.beds;
        const hasOppositeGender = roomOccupants.some(
          (b) => b.currentEmployee && b.currentEmployee.gender !== gender
        );
        return !hasOppositeGender;
      });
    }

    return availableBeds;
  }

  /**
   * Get all employee details including encrypted TC number for Excel export
   */
  public static async getExportEmployees(search?: string, status?: string, department?: string, gender?: string, startDate?: string, endDate?: string) {
    const where: any = { isDeleted: false };

    if (status && status !== 'ALL') {
      if (['PENDING_ASSIGNMENT', 'RESIDENT', 'ON_LEAVE', 'CHECKED_OUT'].includes(status)) {
        where.status = status;
      }
    }

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (gender && gender !== 'ALL') {
      if (['Male', 'Female'].includes(gender)) {
        where.gender = gender;
      }
    }

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

    return prisma.employee.findMany({
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
    });
  }

  /**
   * Checkout employee from their assigned room/bed
   */
  public static async checkoutEmployeeFromRoom(employeeId: string, checkedOutById?: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { beds: true },
      });
      if (!employee) throw new AppError('Personel bulunamadı.', 404);

      const hasBed = employee.beds && employee.beds.length > 0;
      if (!hasBed) {
        throw new AppError('Personel zaten herhangi bir odaya yerleştirilmemiş.', 400);
      }

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
        await tx.user.update({
          where: { id: employee.userId },
          data: { isActive: false },
        });
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
          inventories: { orderBy: { createdAt: 'desc' } },
          disciplinaryNotes: { orderBy: { createdAt: 'desc' } },
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
    });
  }

  /**
   * Generates a unique username and easy password for an existing employee who has no user account
   */
  public static async generateAccountForEmployee(employeeId: string) {
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

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        fullName: `${employee.firstName} ${employee.lastName}`,
        role: Role.STAFF,
        isActive: true,
      },
    });

    await prisma.employee.update({
      where: { id: employeeId },
      data: { userId: newUser.id },
    });

    return {
      username,
      password,
      role: Role.STAFF,
    };
  }
}

