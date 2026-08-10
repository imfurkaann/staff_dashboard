import { Router } from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { userManagementController } from '../controllers/userManagementController';
import { permissions } from '../security/permissions';

const router = Router();
router.use(authenticateToken, authorizePermissions(permissions.USER_MANAGE));
router.get('/', userManagementController.list);
router.post('/', userManagementController.create);
router.patch('/:id', userManagementController.update);
router.post('/:id/reset-password', userManagementController.resetPassword);

export default router;
