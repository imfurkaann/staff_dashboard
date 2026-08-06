import { Router } from 'express';
import { maintenanceController } from '../controllers/maintenanceController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Require authentication for all maintenance routes
router.use(authenticateToken);

// GET /api/maintenance - List all maintenance records with filters & summary
router.get('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), maintenanceController.getMaintenances);

// GET /api/maintenance/export.xlsx - Export maintenance records to Excel
router.get('/export.xlsx', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), maintenanceController.exportExcel);

// POST /api/maintenance - Create a new maintenance record
router.post('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), maintenanceController.createMaintenance);

// PATCH /api/maintenance/:id - Update an existing maintenance record
router.patch('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), maintenanceController.updateMaintenance);

// DELETE /api/maintenance/:id - Delete a maintenance record
router.delete('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), maintenanceController.deleteMaintenance);

export default router;
