import { Router } from 'express';
import { roomController } from '../controllers/roomController';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

// Require authentication and RBAC for all room management routes
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'));

// GET /api/rooms - List rooms with optional filters
router.get('/', roomController.getRooms);

// GET /api/rooms/stats - Room & bed overall stats
router.get('/stats', roomController.getStats);

// GET /api/rooms/occupancy/export.xlsx - Export room occupancies
router.get('/occupancy/export.xlsx', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.exportOccupancyExcel);

// GET /api/rooms/inventories/export.xlsx - Export room inventories / fixtures
router.get('/inventories/export.xlsx', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.exportRoomInventoryExcel);

// GET /api/rooms/blocks - List all blocks with room/bed capacity stats
router.get('/blocks', roomController.getBlocks);

// GET /api/rooms/:id - Full room detail (inventories, maintenance and occupancy history)
router.get('/:id', roomController.getRoomById);

// PATCH /api/rooms/:id/status - Update room status (READY, NEEDS_CLEANING, OUT_OF_ORDER)
router.patch('/:id/status', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.updateStatus);

// POST /api/rooms - Create new room
router.post('/', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.createRoom);

// POST /api/rooms/blocks - Create new block
router.post('/blocks', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.createBlock);

// POST /api/rooms/:id/maintenance - Create new maintenance/fault record
router.post('/:id/maintenance', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.createMaintenance);

// PATCH /api/rooms/maintenance/:maintenanceId - Update maintenance record
router.patch('/maintenance/:maintenanceId', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.updateMaintenance);

// DELETE /api/rooms/maintenance/:maintenanceId - Delete maintenance record
router.delete('/maintenance/:maintenanceId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.deleteMaintenance);

// POST /api/rooms/:id/cleaning - Create new cleaning log
router.post('/:id/cleaning', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.createCleaningLog);

// PATCH /api/rooms/cleaning/:cleaningId - Update cleaning log
router.patch('/cleaning/:cleaningId', authorizeRoles('ADMIN', 'HOUSING_MANAGER', 'SECURITY'), roomController.updateCleaningLog);

// DELETE /api/rooms/cleaning/:cleaningId - Delete cleaning log
router.delete('/cleaning/:cleaningId', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.deleteCleaningLog);

// PUT /api/rooms/:id - Update room details (number, floor, capacity, status)
router.put('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.updateRoom);

// DELETE /api/rooms/:id - Delete room safely
router.delete('/:id', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.deleteRoom);

// POST /api/rooms/:id/inventories - Create room fixture/inventory
router.post('/:id/inventories', authorizeRoles('ADMIN', 'HOUSING_MANAGER'), roomController.createRoomInventory);

export default router;
