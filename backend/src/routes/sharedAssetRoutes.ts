import { Router } from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { SharedAssetController } from '../controllers/sharedAssetController';
import { permissions } from '../security/permissions';

const router = Router();

router.use(authenticateToken);

router.get('/', authorizePermissions(permissions.SHARED_ASSET_VIEW), SharedAssetController.getOverview);
router.post('/', authorizePermissions(permissions.SHARED_ASSET_MANAGE), SharedAssetController.createAsset);
router.post('/:id/check-out', authorizePermissions(permissions.SHARED_ASSET_MANAGE), SharedAssetController.checkOutAsset);
router.post('/:id/check-in', authorizePermissions(permissions.SHARED_ASSET_MANAGE), SharedAssetController.checkInAsset);
router.patch('/:id/status', authorizePermissions(permissions.SHARED_ASSET_MANAGE), SharedAssetController.updateStatus);
router.post('/:id/maintenance', authorizePermissions(permissions.SHARED_ASSET_MANAGE), SharedAssetController.addMaintenanceLog);

export default router;
