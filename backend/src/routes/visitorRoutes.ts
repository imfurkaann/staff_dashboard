import { Router } from 'express';
import { VisitorController } from '../controllers/visitorController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Protect all visitor routes with token authentication
router.use(authenticateToken);

// GET /api/visitors (List with filters)
router.get('/', VisitorController.getAll);

// GET /api/visitors/export.xlsx (Export the same filtered records)
router.get('/export.xlsx', VisitorController.exportExcel);

// GET /api/visitors/:id
router.get('/:id', VisitorController.getById);

// POST /api/visitors (Create visitor check-in)
router.post('/', VisitorController.create);

// PATCH /api/visitors/:id/checkout (Perform visitor check-out)
router.patch('/:id/checkout', VisitorController.checkOut);

// PATCH /api/visitors/:id/undo-checkout (Undo visitor check-out)
router.patch('/:id/undo-checkout', VisitorController.undoCheckOut);

// PATCH /api/visitors/:id/restore (Restore soft-deleted visitor record)
router.patch('/:id/restore', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), VisitorController.restore);

// PUT /api/visitors/:id (Update visitor record)
router.put('/:id', VisitorController.update);

// DELETE /api/visitors/:id (Soft Delete visitor record)
router.delete('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), VisitorController.remove);

export default router;
