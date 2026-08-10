import { Router } from 'express';
import { PortalController } from '../controllers/portalController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';

const router = Router();

// Authenticated route for staff members to access their own portal
router.use(authenticateToken);
router.use(authorizePermissions(permissions.PORTAL_SELF));

// GET /api/portal/me (Fetch staff room, roommates, inventories, and notifications)
router.get('/me', PortalController.getMyPortalData);
router.get('/push/public-key', PortalController.getPushPublicKey);
router.post('/push/subscribe', PortalController.subscribePush);
router.delete('/push/subscribe', PortalController.unsubscribePush);
router.post('/push/test', PortalController.testPush);
export default router;
