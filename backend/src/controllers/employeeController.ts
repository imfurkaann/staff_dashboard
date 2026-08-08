import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employeeService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { createEmployeeWorkbook } from '../services/employeeExportService';

export class EmployeeController {
  public static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
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
      const search = req.query.search as string;
      const status = req.query.status as string;
      const department = req.query.department as string;
      const gender = req.query.gender as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const employees = await EmployeeService.getAllEmployees(search, status, department, gender, startDate, endDate);

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
      const search = req.query.search as string;
      const status = req.query.status as string;
      const department = req.query.department as string;
      const gender = req.query.gender as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const employees = await EmployeeService.getExportEmployees(search, status, department, gender, startDate, endDate);
      const generatedBy = req.user?.fullName || 'Lojman Yönetimi';

      const buffer = await createEmployeeWorkbook(employees, generatedBy);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Personel_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const createdById = req.user?.id;
      const employee = await EmployeeService.createEmployee({
        ...req.body,
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
      const createdById = req.user?.id;
      const employee = await EmployeeService.updateEmployee(id, {
        ...req.body,
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
      const gender = req.query.gender as string;
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
      const employee = await EmployeeService.getEmployeeById(id);

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
      await EmployeeService.deleteDisciplinaryNote(noteId);

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
      await EmployeeService.deleteInventoryItem(inventoryId);

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
      const credentials = await EmployeeService.generateAccountForEmployee(id);

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

