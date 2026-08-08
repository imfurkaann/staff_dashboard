import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), DashboardController.summary);
export default router;

