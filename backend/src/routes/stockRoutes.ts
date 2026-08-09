import { Router } from 'express';
import { stockController } from '../controllers/stockController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Protect all stock routes with token authentication and RBAC (ADMIN and HOUSING_MANAGER only)
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'HOUSING_MANAGER'));

// GET /api/stock (List all stock items)
router.get('/', stockController.getStockItems);

// POST /api/stock (Create stock item)
router.post('/', stockController.createStockItem);

// PUT /api/stock/:id (Update stock quantity)
router.put('/:id', stockController.updateStockQuantity);

// DELETE /api/stock/:id (Delete stock item)
router.delete('/:id', stockController.deleteStockItem);

export default router;
