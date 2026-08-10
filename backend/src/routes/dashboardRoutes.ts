import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';

const router = Router();
router.get('/', authenticateToken, authorizePermissions(permissions.DASHBOARD_VIEW), DashboardController.summary);
export default router;

