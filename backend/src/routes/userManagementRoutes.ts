import { Router } from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { userManagementController } from '../controllers/userManagementController';
import { permissions } from '../security/permissions';
import { passwordResetRateLimiter, userManagementMutationRateLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(authenticateToken, authorizePermissions(permissions.USER_MANAGE));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/', userManagementController.list);
router.get('/roles', userManagementController.roles);
router.get('/:id', userManagementController.get);
router.post('/', userManagementMutationRateLimiter, userManagementController.create);
router.patch('/:id', userManagementMutationRateLimiter, userManagementController.update);
router.post('/:id/reset-password', passwordResetRateLimiter, userManagementController.resetPassword);

export default router;
