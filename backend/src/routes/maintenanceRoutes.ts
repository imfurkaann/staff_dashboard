import { Router } from 'express';
import { maintenanceController } from '../controllers/maintenanceController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';
import { roomMutationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Require authentication for all maintenance routes
router.use(authenticateToken);
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// GET /api/maintenance - List all maintenance records with filters & summary
router.get('/', authorizePermissions(permissions.MAINTENANCE_VIEW), maintenanceController.getMaintenances);

// GET /api/maintenance/export.xlsx - Export maintenance records to Excel
router.get('/export.xlsx', authorizePermissions(permissions.MAINTENANCE_EXPORT), maintenanceController.exportExcel);

// POST /api/maintenance - Create a new maintenance record
router.post('/', authorizePermissions(permissions.MAINTENANCE_CREATE), roomMutationRateLimiter, maintenanceController.createMaintenance);

// PATCH /api/maintenance/:id - Update an existing maintenance record
router.patch('/:id', authorizePermissions(permissions.MAINTENANCE_UPDATE), roomMutationRateLimiter, maintenanceController.updateMaintenance);

export default router;
