import { Router } from 'express';
import { roomController } from '../controllers/roomController';
import { authenticateToken, authorizeAnyPermission, authorizePermissions } from '../middleware/authMiddleware';
import { permissions } from '../security/permissions';
import { roomMutationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Require authentication and RBAC for all room management routes
router.use(authenticateToken);
router.use(authorizePermissions(permissions.ROOM_VIEW));
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

// GET /api/rooms - List rooms with optional filters
router.get('/', roomController.getRooms);

// GET /api/rooms/stats - Room & bed overall stats
router.get('/stats', roomController.getStats);

// GET /api/rooms/occupancy/export.xlsx - Export room occupancies
router.get('/occupancy/export.xlsx', authorizePermissions(permissions.ROOM_OCCUPANCY_EXPORT), roomController.exportOccupancyExcel);

// GET /api/rooms/inventories/export.xlsx - Export room inventories / fixtures
router.get('/inventories/export.xlsx', authorizeAnyPermission(permissions.ROOM_INVENTORY_MANAGE, permissions.STOCK_VIEW), roomController.exportRoomInventoryExcel);

// GET /api/rooms/blocks - List all blocks with room/bed capacity stats
router.get('/blocks', roomController.getBlocks);

// GET /api/rooms/:id - Full room detail (inventories, maintenance and occupancy history)
router.get('/:id', roomController.getRoomById);

// PATCH /api/rooms/:id/status - Update room status (READY, NEEDS_CLEANING, OUT_OF_ORDER)
router.patch('/:id/status', authorizeAnyPermission(permissions.ROOM_MANAGE, permissions.CLEANING_MANAGE), roomMutationRateLimiter, roomController.updateStatus);

// POST /api/rooms - Create new room
router.post('/', authorizePermissions(permissions.ROOM_MANAGE), roomMutationRateLimiter, roomController.createRoom);

// POST /api/rooms/blocks - Create new block
router.post('/blocks', authorizePermissions(permissions.ROOM_MANAGE), roomMutationRateLimiter, roomController.createBlock);

// POST /api/rooms/:id/maintenance - Create new maintenance/fault record
router.post('/:id/maintenance', authorizePermissions(permissions.MAINTENANCE_CREATE), roomMutationRateLimiter, roomController.createMaintenance);

// PATCH /api/rooms/maintenance/:maintenanceId - Update maintenance record
router.patch('/maintenance/:maintenanceId', authorizePermissions(permissions.MAINTENANCE_UPDATE), roomMutationRateLimiter, roomController.updateMaintenance);

// POST /api/rooms/:id/cleaning - Create new cleaning log
router.post('/:id/cleaning', authorizePermissions(permissions.CLEANING_MANAGE), roomMutationRateLimiter, roomController.createCleaningLog);

// PATCH /api/rooms/cleaning/:cleaningId - Update cleaning log
router.patch('/cleaning/:cleaningId', authorizePermissions(permissions.CLEANING_MANAGE), roomMutationRateLimiter, roomController.updateCleaningLog);

// DELETE /api/rooms/cleaning/:cleaningId - Delete cleaning log
router.delete('/cleaning/:cleaningId', authorizePermissions(permissions.CLEANING_DELETE), roomMutationRateLimiter, roomController.deleteCleaningLog);

// PUT /api/rooms/:id - Update room metadata (status uses the dedicated workflow above)
router.put('/:id', authorizePermissions(permissions.ROOM_MANAGE), roomMutationRateLimiter, roomController.updateRoom);

// DELETE /api/rooms/:id - Delete room safely
router.delete('/:id', authorizePermissions(permissions.ROOM_MANAGE), roomMutationRateLimiter, roomController.deleteRoom);

// POST /api/rooms/:id/inventories - Create room fixture/inventory
router.post('/:id/inventories', authorizePermissions(permissions.ROOM_INVENTORY_MANAGE), roomMutationRateLimiter, roomController.createRoomInventory);

export default router;
