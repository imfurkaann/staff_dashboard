import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticateToken, authorizeAnyPermission, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';

const router = Router();

// Protect all employee routes with authenticateToken and RBAC
router.use(authenticateToken);

// GET /api/employees (List employees with search/filters)
router.get('/', authorizePermissions(permissions.EMPLOYEE_VIEW), EmployeeController.getAll);

// GET /api/employees/export.xlsx (Export filtered employees list)
router.get('/export.xlsx', authorizePermissions(permissions.EMPLOYEE_EXPORT), EmployeeController.exportExcel);

// GET /api/employees/available-beds (Get list of available beds for placement)
router.get('/available-beds', authorizeAnyPermission(permissions.EMPLOYEE_MANAGE, permissions.ROOM_MANAGE), EmployeeController.getAvailableBeds);

// GET /api/employees/:id (Get single employee details)
router.get('/:id', authorizePermissions(permissions.EMPLOYEE_VIEW), EmployeeController.getById);

// POST /api/employees (Create new employee)
router.post('/', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.create);

// POST /api/employees/:id/generate-account (Generate unique credentials for existing employee)
router.post('/:id/generate-account', authorizePermissions(permissions.USER_MANAGE), EmployeeController.generateAccount);

// PUT /api/employees/:id (Update employee profile)
router.put('/:id', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.update);

// PATCH /api/employees/:id/checkout (Check out employee from room)
router.patch('/:id/checkout', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.checkoutRoom);

router.delete('/:id', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.remove);

// POST /api/employees/:id/inventories (Add inventory or personal belonging item)
router.post('/:id/inventories', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.addInventory);

// PUT /api/employees/inventories/:inventoryId
router.put('/inventories/:inventoryId', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.updateInventory);

// PATCH /api/employees/inventories/:inventoryId/return
router.patch('/inventories/:inventoryId/return', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.returnInventory);

// DELETE /api/employees/inventories/:inventoryId
router.delete('/inventories/:inventoryId', authorizePermissions(permissions.EMPLOYEE_MANAGE), EmployeeController.deleteInventory);

// POST /api/employees/:id/disciplinary-notes (Add disciplinary or complaint note)
router.post('/:id/disciplinary-notes', authorizePermissions(permissions.EMPLOYEE_SENSITIVE_VIEW, permissions.EMPLOYEE_MANAGE), EmployeeController.addDisciplinaryNote);

// PUT /api/employees/disciplinary-notes/:noteId (Update disciplinary or complaint note)
router.put('/disciplinary-notes/:noteId', authorizePermissions(permissions.EMPLOYEE_SENSITIVE_VIEW, permissions.EMPLOYEE_MANAGE), EmployeeController.updateDisciplinaryNote);

// DELETE /api/employees/disciplinary-notes/:noteId (Delete disciplinary or complaint note)
router.delete('/disciplinary-notes/:noteId', authorizePermissions(permissions.EMPLOYEE_SENSITIVE_VIEW, permissions.EMPLOYEE_MANAGE), EmployeeController.deleteDisciplinaryNote);

export default router;

