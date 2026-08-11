import { Router } from 'express';
import { VisitorController } from '../controllers/visitorController';
import { authenticateToken, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';
import { visitorCreateRateLimiter, visitorMutationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Protect all visitor routes with token authentication and RBAC
router.use(authenticateToken);
router.use(authorizePermissions(permissions.VISITOR_VIEW));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// GET /api/visitors (List with filters)
router.get('/', VisitorController.getAll);

// GET /api/visitors/export.xlsx (Export the same filtered records)
router.get('/export.xlsx', authorizePermissions(permissions.VISITOR_EXPORT), VisitorController.exportExcel);

// GET /api/visitors/host-candidates (Minimal current-resident data for the optional host picker)
router.get('/host-candidates', authorizePermissions(permissions.VISITOR_MANAGE), VisitorController.getHostCandidates);

// GET /api/visitors/:id
router.get('/:id', VisitorController.getById);

// POST /api/visitors (Create visitor check-in)
router.post('/', authorizePermissions(permissions.VISITOR_MANAGE), visitorCreateRateLimiter, VisitorController.create);

// PATCH /api/visitors/:id/checkout (Perform visitor check-out)
router.patch('/:id/checkout', authorizePermissions(permissions.VISITOR_MANAGE), visitorMutationRateLimiter, VisitorController.checkOut);

// PATCH /api/visitors/:id/undo-checkout (Undo visitor check-out)
router.patch('/:id/undo-checkout', authorizePermissions(permissions.VISITOR_MANAGE), visitorMutationRateLimiter, VisitorController.undoCheckOut);

// PATCH /api/visitors/:id/restore (Restore soft-deleted visitor record)
router.patch('/:id/restore', authorizePermissions(permissions.VISITOR_ARCHIVE), visitorMutationRateLimiter, VisitorController.restore);

// PUT /api/visitors/:id (Update visitor record)
router.put('/:id', authorizePermissions(permissions.VISITOR_MANAGE), visitorMutationRateLimiter, VisitorController.update);

// DELETE /api/visitors/:id (Soft Delete visitor record)
router.delete('/:id', authorizePermissions(permissions.VISITOR_ARCHIVE), visitorMutationRateLimiter, VisitorController.remove);

export default router;
