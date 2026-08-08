import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Require authentication and ADMIN/HOUSING_MANAGER role for managing notification sending
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'HOUSING_MANAGER'));

// GET /api/notifications (List sent notifications history & statistics)
router.get('/', NotificationController.getAllSent);

// POST /api/notifications/send (Send notification to targeted audience)
router.post('/send', NotificationController.send);

// DELETE /api/notifications/:id (Delete notification)
router.delete('/:id', NotificationController.remove);

export default router;
