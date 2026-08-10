import { Router } from 'express';
import { stockController } from '../controllers/stockController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();
router.use(authenticateToken, authorizeRoles('ADMIN', 'HOUSING_MANAGER'));

router.get('/', stockController.getOverview);
router.get('/export.xlsx', stockController.exportExcel);
router.post('/', stockController.createStockItem);
router.put('/:id', stockController.updateStockItem);
router.post('/:id/receive', stockController.receive);
router.post('/:id/reconcile-count', stockController.reconcileCount);
router.post('/:id/assign-room', stockController.assignRoom);
router.post('/assignments/:inventoryId/return', stockController.returnAssignment);
router.post('/assignments/:inventoryId/transfer', stockController.transferAssignment);
router.post('/assignments/:inventoryId/replace', stockController.replaceAssignment);
router.delete('/:id', stockController.deleteStockItem);

export default router;
