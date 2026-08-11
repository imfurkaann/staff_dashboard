import { Request, Response, NextFunction } from 'express';
import { CreateEmployeeDTO, EmployeeService } from '../services/employeeService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { createEmployeeWorkbook } from '../services/employeeExportService';
import { AppError } from '../middleware/errorHandler';
import { formatIstanbulDate } from '../utils/dateTime';
import { scopeEmployeeData } from '../security/dataScope';
import { hasPermission, permissions } from '../security/permissions';
import { config } from '../config';
import { validateEmployeeDepartmentFilter, validateEmployeeFilterStatus, validateEmployeeGenderFilter, validateEmployeeId } from '../security/employeePolicy';

const singleQuery = (value: unknown, name: string): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${name} tek bir değer olmalıdır.`, 400);
  return value;
};
const requestBody = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('İstek gövdesi geçersiz.', 400);
  return value as Record<string, any>;
};

export class EmployeeController {
  public static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      validateEmployeeId(req.params.id);
      const deletedById = req.user?.id;
      await EmployeeService.deleteEmployee(req.params.id, deletedById);
      res.status(200).json({ success: true, message: 'Personel kaydı silindi.' });
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /api/employees
   */
  public static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const search = singleQuery(req.query.search, 'Arama filtresi');
      const status = validateEmployeeFilterStatus(singleQuery(req.query.status, 'Durum filtresi'));
      const department = validateEmployeeDepartmentFilter(singleQuery(req.query.department, 'Departman filtresi'));
      const gender = validateEmployeeGenderFilter(singleQuery(req.query.gender, 'Cinsiyet filtresi'));
      const startDate = singleQuery(req.query.startDate, 'Başlangıç tarihi');
      const endDate = singleQuery(req.query.endDate, 'Bitiş tarihi');

      const employees = scopeEmployeeData(await EmployeeService.getAllEmployees(search, status, department, gender, startDate, endDate, config.employee.listMaxRows), req.user?.role);

      res.status(200).json({
        success: true,
        data: employees,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees/export.xlsx
   */
  public static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const search = singleQuery(req.query.search, 'Arama filtresi');
      const status = validateEmployeeFilterStatus(singleQuery(req.query.status, 'Durum filtresi'));
      const department = validateEmployeeDepartmentFilter(singleQuery(req.query.department, 'Departman filtresi'));
      const gender = validateEmployeeGenderFilter(singleQuery(req.query.gender, 'Cinsiyet filtresi'));
      const startDate = singleQuery(req.query.startDate, 'Başlangıç tarihi');
      const endDate = singleQuery(req.query.endDate, 'Bitiş tarihi');

      const employees = await EmployeeService.getExportEmployees(search, status, department, gender, startDate, endDate, config.employee.exportMaxRows);
      const generatedBy = req.user?.fullName || 'Lojman Yönetimi';

      const buffer = await createEmployeeWorkbook(employees, generatedBy);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Personel_Listesi_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/employees
   */
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = requestBody(req.body) as unknown as CreateEmployeeDTO;
      const createdById = req.user?.id;
      if (!hasPermission(req.user?.role, permissions.USER_MANAGE) && body.systemUser) {
        throw new AppError('Yalnızca sistem yöneticisi yetkili hesap oluşturabilir.', 403);
      }
      if (body.systemUser?.createAccount && body.systemUser?.role && body.systemUser.role !== 'STAFF') throw new AppError('Personel portal hesabı yalnızca STAFF rolüyle oluşturulabilir.', 400);
      const employee = await EmployeeService.createEmployee({
        ...body,
        createdById,
      });

      res.status(201).json({
        success: true,
        message: 'Personel kaydı başarıyla oluşturuldu.',
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/employees/:id
   */
  public static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const body = requestBody(req.body);
      const createdById = req.user?.id;
      if (!hasPermission(req.user?.role, permissions.USER_MANAGE) && body.systemUser) {
        throw new AppError('Yalnızca sistem yöneticisi hesap yetkisini değiştirebilir.', 403);
      }
      if (body.systemUser?.role && body.systemUser.role !== 'STAFF') throw new AppError('Personel portal hesabı yalnızca STAFF rolünde olabilir.', 400);
      const employee = await EmployeeService.updateEmployee(id, {
        ...body,
        createdById,
      });

      res.status(200).json({
        success: true,
        message: 'Personel bilgileri güncellendi.',
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees/available-beds
   */
  public static async getAvailableBeds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const gender = singleQuery(req.query.gender, 'Cinsiyet filtresi');
      const beds = await EmployeeService.getAvailableBeds(gender);

      res.status(200).json({
        success: true,
        data: beds,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/employees/:id/inventories
   */
  public static async addInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const createdById = req.user?.id;
      const item = await EmployeeService.addInventoryItem(id, {
        ...req.body,
        createdById,
      });

      res.status(201).json({
        success: true,
        message: 'Zimmet/Eşya kaydı başarıyla eklendi.',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/employees/:id/disciplinary-notes
   */
  public static async addDisciplinaryNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const createdById = req.user?.id;
      const note = await EmployeeService.addDisciplinaryNote(id, {
        ...req.body,
        createdById,
      });

      res.status(201).json({
        success: true,
        message: 'Disiplin/Şikayet notu başarıyla eklendi.',
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/employees/inventories/:inventoryId
   */
  public static async updateInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { inventoryId } = req.params;
      validateEmployeeId(inventoryId, 'Zimmet kimliği');
      const item = await EmployeeService.updateInventoryItem(inventoryId, req.body);

      res.status(200).json({
        success: true,
        message: 'Zimmet/Eşya kaydı güncellendi.',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/employees/:id
   */
  public static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const employee = scopeEmployeeData(await EmployeeService.getEmployeeById(id), req.user?.role);

      res.status(200).json({
        success: true,
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/employees/inventories/:inventoryId/return
   */
  public static async returnInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { inventoryId } = req.params;
      validateEmployeeId(inventoryId, 'Zimmet kimliği');
      const returnedById = req.user?.id;
      const { status, notes } = req.body || {};
      const item = await EmployeeService.returnInventoryItem(inventoryId, returnedById, status, notes);

      res.status(200).json({
        success: true,
        message: status === 'TESLİM_ALINAMADI' ? 'Zimmet teslim alınamadı olarak kaydedildi.' : 'Zimmet/Eşya teslim alındı.',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/employees/disciplinary-notes/:noteId
   */
  public static async updateDisciplinaryNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { noteId } = req.params;
      validateEmployeeId(noteId, 'Disiplin notu kimliği');
      const note = await EmployeeService.updateDisciplinaryNote(noteId, req.body);

      res.status(200).json({
        success: true,
        message: 'Disiplin/Şikayet notu güncellendi.',
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/employees/disciplinary-notes/:noteId
   */
  public static async deleteDisciplinaryNote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { noteId } = req.params;
      validateEmployeeId(noteId, 'Disiplin notu kimliği');
      await EmployeeService.deleteDisciplinaryNote(noteId, req.user?.id);

      res.status(200).json({
        success: true,
        message: 'Disiplin/Şikayet notu silindi.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/employees/inventories/:inventoryId
   */
  public static async deleteInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { inventoryId } = req.params;
      validateEmployeeId(inventoryId, 'Zimmet kimliği');
      await EmployeeService.deleteInventoryItem(inventoryId, req.user?.id);

      res.status(200).json({
        success: true,
        message: 'Zimmet/Eşya kaydı silindi.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/employees/:id/checkout
   */
  public static async checkoutRoom(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const checkedOutById = req.user?.id;
      const employee = await EmployeeService.checkoutEmployeeFromRoom(id, checkedOutById);

      res.status(200).json({
        success: true,
        message: 'Personel odadan çıkış yaptı.',
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/employees/:id/generate-account
   */
  public static async generateAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      validateEmployeeId(id);
      const credentials = await EmployeeService.generateAccountForEmployee(id, req.user!.id);

      res.status(200).json({
        success: true,
        message: 'Personel için otomatik kullanıcı hesabı ve parola başarıyla oluşturuldu.',
        data: credentials,
      });
    } catch (error) {
      next(error);
    }
  }
}

