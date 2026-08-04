import { Router } from 'express';
import { roomController } from '../controllers/roomController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Require authentication for all room routes
router.use(authenticateToken);

// GET /api/rooms - List rooms with optional filters
router.get('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.getRooms);

// GET /api/rooms/stats - Room & bed overall stats
router.get('/stats', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.getStats);

// GET /api/rooms/blocks - List all blocks with room/bed capacity stats
router.get('/blocks', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.getBlocks);

// GET /api/rooms/:id - Full room detail (inventories, maintenance and occupancy history)
router.get('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.getRoomById);

// PATCH /api/rooms/:id/status - Update room status (READY, NEEDS_CLEANING, OUT_OF_ORDER)
router.patch('/:id/status', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.updateStatus);

// POST /api/rooms - Create new room
router.post('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.createRoom);

// POST /api/rooms/blocks - Create new block
router.post('/blocks', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.createBlock);

// POST /api/rooms/:id/maintenance - Create new maintenance/fault record
router.post('/:id/maintenance', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.createMaintenance);

// PATCH /api/rooms/maintenance/:maintenanceId - Update maintenance record
router.patch('/maintenance/:maintenanceId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.updateMaintenance);

// DELETE /api/rooms/maintenance/:maintenanceId - Delete maintenance record
router.delete('/maintenance/:maintenanceId', authorizeRoles('ADMIN'), roomController.deleteMaintenance);

// PATCH /api/rooms/inventories/:inventoryId - Persist room fixture status/notes
router.patch('/inventories/:inventoryId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.updateInventory);

export default router;
