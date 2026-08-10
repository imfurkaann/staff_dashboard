import { Router } from 'express';
import { stockController } from '../controllers/stockController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';

const router = Router();
router.use(authenticateToken);

router.get('/', authorizePermissions(permissions.STOCK_VIEW), stockController.getOverview);
router.get('/next-code', authorizePermissions(permissions.STOCK_MANAGE), stockController.getNextItemCode);
router.get('/export.xlsx', authorizePermissions(permissions.STOCK_MANAGE), stockController.exportExcel);
router.post('/', authorizePermissions(permissions.STOCK_MANAGE), stockController.createStockItem);
router.put('/:id', authorizePermissions(permissions.STOCK_MANAGE), stockController.updateStockItem);
router.post('/:id/receive', authorizePermissions(permissions.STOCK_MANAGE), stockController.receive);
router.post('/:id/reconcile-count', authorizePermissions(permissions.STOCK_MANAGE), stockController.reconcileCount);
router.post('/:id/assign-room', authorizePermissions(permissions.STOCK_MANAGE), stockController.assignRoom);
router.post('/:id/assign-rooms', authorizePermissions(permissions.STOCK_MANAGE), stockController.assignRooms);
router.post('/assignments/:inventoryId/return', authorizePermissions(permissions.STOCK_DEVICE_LIFECYCLE), stockController.returnAssignment);
router.post('/assignments/:inventoryId/transfer', authorizePermissions(permissions.STOCK_DEVICE_LIFECYCLE), stockController.transferAssignment);
router.patch('/assignments/:inventoryId/identity', authorizePermissions(permissions.STOCK_DEVICE_LIFECYCLE), stockController.updateAssignmentIdentity);
router.post('/assignments/:inventoryId/replace', authorizePermissions(permissions.STOCK_DEVICE_LIFECYCLE), stockController.replaceAssignment);
router.delete('/:id', authorizePermissions(permissions.STOCK_MANAGE), stockController.deleteStockItem);

export default router;
