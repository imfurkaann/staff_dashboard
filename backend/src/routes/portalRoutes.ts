import { Router } from 'express';
import { PortalController } from '../controllers/portalController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Authenticated route for staff members to access their own portal
router.use(authenticateToken);
router.use(authorizeRoles('STAFF'));

// GET /api/portal/me (Fetch staff room, roommates, inventories, and notifications)
router.get('/me', PortalController.getMyPortalData);
router.get('/push/public-key', PortalController.getPushPublicKey);
router.post('/push/subscribe', PortalController.subscribePush);
router.delete('/push/subscribe', PortalController.unsubscribePush);
router.post('/push/test', PortalController.testPush);

// PATCH /api/portal/notifications/read-all (Mark all notifications as read)
router.patch('/notifications/read-all', PortalController.markAllNotificationsRead);

// PATCH /api/portal/notifications/:recipientId/read (Mark single notification as read)
router.patch('/notifications/:recipientId/read', PortalController.markNotificationRead);

export default router;
