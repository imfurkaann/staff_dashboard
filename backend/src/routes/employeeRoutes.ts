import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Protect all employee routes with authenticateToken and RBAC
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'));

// GET /api/employees (List employees with search/filters)
router.get('/', EmployeeController.getAll);

// GET /api/employees/export.xlsx (Export filtered employees list)
router.get('/export.xlsx', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.exportExcel);

// GET /api/employees/available-beds (Get list of available beds for placement)
router.get('/available-beds', EmployeeController.getAvailableBeds);

// GET /api/employees/:id (Get single employee details)
router.get('/:id', EmployeeController.getById);

// POST /api/employees (Create new employee)
router.post('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.create);

// POST /api/employees/:id/generate-account (Generate unique credentials for existing employee)
router.post('/:id/generate-account', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.generateAccount);

// PUT /api/employees/:id (Update employee profile)
router.put('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.update);

// PATCH /api/employees/:id/checkout (Check out employee from room)
router.patch('/:id/checkout', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.checkoutRoom);

router.delete('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.remove);

// POST /api/employees/:id/inventories (Add inventory or personal belonging item)
router.post('/:id/inventories', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.addInventory);

// PUT /api/employees/inventories/:inventoryId
router.put('/inventories/:inventoryId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.updateInventory);

// PATCH /api/employees/inventories/:inventoryId/return
router.patch('/inventories/:inventoryId/return', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.returnInventory);

// DELETE /api/employees/inventories/:inventoryId
router.delete('/inventories/:inventoryId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.deleteInventory);

// POST /api/employees/:id/disciplinary-notes (Add disciplinary or complaint note)
router.post('/:id/disciplinary-notes', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.addDisciplinaryNote);

// PUT /api/employees/disciplinary-notes/:noteId (Update disciplinary or complaint note)
router.put('/disciplinary-notes/:noteId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.updateDisciplinaryNote);

// DELETE /api/employees/disciplinary-notes/:noteId (Delete disciplinary or complaint note)
router.delete('/disciplinary-notes/:noteId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.deleteDisciplinaryNote);

export default router;

