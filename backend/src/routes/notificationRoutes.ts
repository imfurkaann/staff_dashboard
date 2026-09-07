import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';
import { notificationSendRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Require authentication and ADMIN/HOUSING_MANAGER role for managing notification sending
router.use(authenticateToken);
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// GET /api/notifications (List sent notifications history & statistics)
router.get('/', authorizePermissions(permissions.NOTIFICATION_VIEW), NotificationController.getAllSent);
router.get('/:id', authorizePermissions(permissions.NOTIFICATION_VIEW), NotificationController.getDetail);

// POST /api/notifications/send (Send notification to targeted audience)
router.post('/send', authorizePermissions(permissions.NOTIFICATION_MANAGE), notificationSendRateLimiter, NotificationController.send);

// DELETE /api/notifications/:id (Delete notification)
router.delete('/:id', authorizePermissions(permissions.NOTIFICATION_DELETE), NotificationController.remove);

export default router;
