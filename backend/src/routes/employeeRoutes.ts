import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Protect all employee routes with authenticateToken
router.use(authenticateToken);

// GET /api/employees (List employees with search/filters)
router.get('/', EmployeeController.getAll);

// POST /api/employees (Create new employee)
router.post('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.create);

// PUT /api/employees/:id (Update employee profile)
router.put('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.update);

router.delete('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), EmployeeController.remove);

// GET /api/employees/available-beds (Get list of available beds for placement)
router.get('/available-beds', EmployeeController.getAvailableBeds);

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

export default router;
