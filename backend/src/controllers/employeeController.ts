import { Request, Response, NextFunction } from 'express';
import { EmployeeService } from '../services/employeeService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class EmployeeController {
  public static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await EmployeeService.deleteEmployee(req.params.id);
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

      const employees = await EmployeeService.getAllEmployees(search, status, department);

      res.status(200).json({
        success: true,
        data: employees,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/employees
   */
  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employee = await EmployeeService.createEmployee(req.body);

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
      const employee = await EmployeeService.updateEmployee(id, req.body);

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
      const item = await EmployeeService.addInventoryItem(id, req.body);

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
      const note = await EmployeeService.addDisciplinaryNote(id, req.body);

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
   * PATCH /api/employees/inventories/:inventoryId/return
   */
  public static async returnInventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { inventoryId } = req.params;
      const item = await EmployeeService.returnInventoryItem(inventoryId);

      res.status(200).json({
        success: true,
        message: 'Zimmet/Eşya teslim alındı.',
        data: item,
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
}
