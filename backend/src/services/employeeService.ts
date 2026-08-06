import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { encryptSensitiveData, hashSensitiveData, maskTcNo } from '../utils/crypto';

/**
 * Turkish Locale-aware Title Case Normalization
 * E.g. "usta cam" -> "Usta Cam", "USTA CAM" -> "Usta Cam"
 */
export function normalizeText(text?: string | null): string | null {
  if (!text || !text.trim()) return null;
  
  return text
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR');
    })
    .join(' ');
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
}

export class EmployeeService {
  public static async deleteEmployee(employeeId: string, deletedById?: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { beds: { select: { id: true } } },
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
   * Get list of employees with optional search & filters
   */
  public static async getAllEmployees(search?: string, status?: string, department?: string) {
    const where: any = { isDeleted: false };

    if (status && status !== 'ALL') {
      if (!['PENDING_ASSIGNMENT', 'RESIDENT', 'ON_LEAVE', 'CHECKED_OUT'].includes(status)) {
        throw new AppError('Geçersiz personel durum filtresi.', 400);
      }
      where.status = status;
    }

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (search && search.trim() !== '') {
      const query = search.trim();
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { registrationNo: { contains: query, mode: 'insensitive' } },
        { department: { contains: query, mode: 'insensitive' } },
        { company: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { vehiclePlate: { contains: query, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
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
      orderBy: { createdAt: 'desc' },
    });

    return employees.map(emp => {
      const latestOccupancy = emp.occupancies && emp.occupancies.length > 0 ? emp.occupancies[0] : null;
      const { tcNo, tcNoHash: _tcNoHash, ...safeEmployee } = emp;
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
    if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
      throw new AppError('Personel Adı ve Soyadı zorunludur.', 400);
    }

    if (!gender || (gender !== 'Male' && gender !== 'Female')) {
      throw new AppError('Geçerli bir cinsiyet (Erkek / Kadın) seçilmelidir.', 400);
    }

    if (!department || !department.trim()) {
      throw new AppError('Departman seçimi zorunludur.', 400);
    }

    const cleanTc = tcNo ? tcNo.trim() : '';
    const cleanRegNo = registrationNo ? registrationNo.trim().toUpperCase() : '';

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

    // Normalization
    const normalizedFirstName = normalizeText(firstName)!;
    const normalizedLastName = normalizeText(lastName)!.toLocaleUpperCase('tr-TR');
    const normalizedCompany = normalizeText(company);
    const normalizedEmergencyName = normalizeText(emergencyContactName);
    const normalizedPlate = vehiclePlate ? vehiclePlate.trim().toUpperCase() : null;
    const cleanPhone = phone ? phone.trim() : null;

    // Encrypt TC before saving
    const encryptedTc = cleanTc !== '' ? encryptSensitiveData(cleanTc) : null;

    // Determine initial status
    const initialStatus = bedId ? 'RESIDENT' : 'PENDING_ASSIGNMENT';
    const now = new Date(); // Exact DateTime timestamp

    // Transaction to create employee and optional bed placement with exact timestamps
    return prisma.$transaction(async (tx) => {
      // 1. Create Employee
      const newEmployee = await tx.employee.create({
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          gender,
          department: department.trim(),
          title: title?.trim() || null,
          company: normalizedCompany,
          tcNo: encryptedTc,
          tcNoHash: cleanTc !== '' ? hashSensitiveData(cleanTc) : null,
          registrationNo: cleanRegNo !== '' ? cleanRegNo : null,
          phone: cleanPhone,
          isSmoker: isSmoker || false,
          hasSnoring: hasSnoring || false,
          vehiclePlate: normalizedPlate,
          ageGroup: ageGroup || '26-40 Yaş (Orta Yaş)',
          languageNationality: languageNationality || 'Türkçe (T.C.)',
          emergencyContactName: normalizedEmergencyName,
          emergencyRelation: emergencyRelation || null,
          emergencyContactPhone: emergencyContactPhone?.trim() || null,
          photoUrl: photoUrl || null,
          shiftType: shiftType || 'Gündüz',
          status: initialStatus,
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

        // Verify gender compatibility with Block policy
        if (bed.room.block.genderPolicy !== 'Mixed') {
          const isGenderMatch = 
            (gender === 'Male' && bed.room.block.genderPolicy === 'Male') ||
            (gender === 'Female' && bed.room.block.genderPolicy === 'Female');

          if (!isGenderMatch) {
            throw new AppError(
              `Personel cinsiyeti (${gender === 'Male' ? 'Erkek' : 'Kadın'}) seçilen lojman bloğu politikasıyla (${bed.room.block.name}) uyusmuyor.`,
              400
            );
          }
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
            employeeDepartment: newEmployee.department,
            employeeTitle: newEmployee.title,
            employeeCompany: newEmployee.company,
            bedId: bed.id,
            checkInDate: now,
            transferReason: 'İlk Kayıtta Doğrudan Yerleştirme',
            createdById: createdById || null,
          },
        });
      }

      const created = await tx.employee.findUnique({
        where: { id: newEmployee.id },
        include: {
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
    if (data.firstName) updateData.firstName = normalizeText(data.firstName);
    if (data.lastName) updateData.lastName = normalizeText(data.lastName)?.toLocaleUpperCase('tr-TR');
    if (data.gender) updateData.gender = data.gender;
    if (data.department) updateData.department = data.department.trim();
    if (data.title !== undefined) updateData.title = data.title?.trim() || null;
    if (data.company !== undefined) updateData.company = normalizeText(data.company);
    if (data.registrationNo !== undefined) {
      const registrationNo = data.registrationNo?.trim().toUpperCase() || null;
      if (registrationNo) {
        const duplicate = await prisma.employee.findFirst({ where: { registrationNo, NOT: { id: employeeId } }, select: { id: true } });
        if (duplicate) throw new AppError('Bu sicil numarası başka bir personelde kayıtlı.', 409);
      }
      updateData.registrationNo = registrationNo;
    }
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.isSmoker !== undefined) updateData.isSmoker = Boolean(data.isSmoker);
    if (data.hasSnoring !== undefined) updateData.hasSnoring = Boolean(data.hasSnoring);
    if (data.vehiclePlate !== undefined) updateData.vehiclePlate = data.vehiclePlate?.trim().toUpperCase() || null;
    if (data.ageGroup) updateData.ageGroup = data.ageGroup;
    if (data.languageNationality) updateData.languageNationality = data.languageNationality;
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = normalizeText(data.emergencyContactName);
    if (data.emergencyRelation !== undefined) updateData.emergencyRelation = data.emergencyRelation || null;
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = data.emergencyContactPhone?.trim() || null;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl || null;
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

    return prisma.$transaction(async (tx) => {
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

        if (bed.room.status !== 'READY') throw new AppError('Hazır durumda olmayan bir odaya personel atanamaz.', 400);
        if (bed.room.block.genderPolicy !== 'Mixed') {
          const targetGender = data.gender || employee.gender;
          if (bed.room.block.genderPolicy !== targetGender) throw new AppError('Personel cinsiyeti seçilen blok politikasıyla uyuşmuyor.', 400);
        }

        const now = new Date();
        await tx.occupancyLog.updateMany({
          where: { employeeId, checkOutDate: null },
          data: { checkOutDate: now },
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
            employeeDepartment: data.department?.trim() || employee.department,
            employeeTitle: data.title === undefined ? employee.title : data.title?.trim() || null,
            employeeCompany: data.company === undefined ? employee.company : normalizeText(data.company),
            bedId: data.bedId,
            checkInDate: now,
            transferReason: 'Personele Oda & Yatak Ataması Yapıldı',
          },
        });
      }

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: updateData,
        include: {
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
    if (!data.itemName?.trim()) throw new AppError('Eşya adı zorunludur.', 400);

    return prisma.inventoryItem.create({
      data: {
        employeeId,
        itemName: data.itemName.trim(),
        itemCode: data.itemCode?.trim() || null,
        category: data.category || 'LOJMAN_ZİMMETİ',
        serialNo: data.serialNo?.trim() || null,
        photoUrl: data.photoUrl || null,
        status: data.category === 'ŞAHSİ_EŞYA' ? 'ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK' : 'TESLİM_EDİLDİ',
        notes: data.notes?.trim() || null,
        createdById: data.createdById || null,
      },
    });
  }

  /**
   * Update Inventory or Personal Belonging Item
   */
  public static async updateInventoryItem(inventoryId: string, data: { itemName?: string; serialNo?: string; notes?: string }) {
    return prisma.inventoryItem.update({
      where: { id: inventoryId },
      data: {
        ...(data.itemName && { itemName: data.itemName.trim() }),
        ...(data.serialNo !== undefined && { serialNo: data.serialNo.trim() || null }),
        ...(data.notes !== undefined && { notes: data.notes.trim() || null }),
      },
    });
  }

  /**
   * Return / Receive back Inventory Item (Teslim Al / İade Al)
   */
  public static async returnInventoryItem(inventoryId: string) {
    return prisma.inventoryItem.update({
      where: { id: inventoryId },
      data: {
        status: 'TAM_İADE_ALINDI',
        returnedDate: new Date(),
      },
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
    if (!data.title?.trim() || !data.content?.trim()) throw new AppError('Not başlığı ve açıklaması zorunludur.', 400);

    return prisma.disciplinaryNote.create({
      data: {
        employeeId,
        title: data.title.trim(),
        content: data.content.trim(),
        reportedBy: data.reportedBy?.trim() || 'Lojman Amirliği',
        status: 'GÖRÜŞÜLDÜ',
        createdById: data.createdById || null,
      },
    });
  }

  /**
   * Get available unoccupied beds compatible with gender
   */
  public static async getAvailableBeds(gender?: string) {
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

    return prisma.bed.findMany({
      where,
      include: {
        room: {
          include: {
            block: true,
          },
        },
      },
      orderBy: [
        { room: { block: { name: 'asc' } } },
        { room: { roomNumber: 'asc' } },
        { bedLabel: 'asc' },
      ],
    });
  }

  /**
   * Get all employee details including encrypted TC number for Excel export
   */
  public static async getExportEmployees(search?: string, status?: string, department?: string, gender?: string) {
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

    if (search && search.trim() !== '') {
      const query = search.trim();
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { registrationNo: { contains: query, mode: 'insensitive' } },
        { department: { contains: query, mode: 'insensitive' } },
        { company: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { vehiclePlate: { contains: query, mode: 'insensitive' } },
      ];
    }

    return prisma.employee.findMany({
      where,
      include: {
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

      // 3. Update employee status to PENDING_ASSIGNMENT & record checkout user
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { 
          status: 'PENDING_ASSIGNMENT',
          checkedOutById: checkedOutById || null,
          checkedOutAt: now,
        },
        include: {
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
}
