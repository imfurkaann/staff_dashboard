// Review probes: run real compiled services with in-memory database doubles.
// No database connection or production writes. These assert observed defects.
const assert = require('node:assert/strict');
const path = require('node:path');
const dist = path.resolve(__dirname, '../backend/dist');
let db;
const proxy = new Proxy({}, { get: (_, key) => key === '$transaction' ? async fn => fn(db) : db[key] });
const prismaPath = require.resolve(path.join(dist, 'db/prisma.js'));
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { __esModule: true, default: proxy } };
const { SharedAssetService } = require(path.join(dist, 'services/sharedAssetService.js'));
const { StockService } = require(path.join(dist, 'services/stockService.js'));
const { EmployeeService } = require(path.join(dist, 'services/employeeService.js'));
const { maintenanceService } = require(path.join(dist, 'services/maintenanceService.js'));

async function run(name, fn) { await fn(); console.log(`REPRODUCED: ${name}`); }
(async () => {
  await run('retired asset location edit deducts stock a second time', async () => {
    const asset = { id: 'asset', stockItemId: 'stock', status: 'AVAILABLE', locationNote: 'DEPO', updatedAt: new Date(), assetName: 'TEST' };
    const stock = { totalStock: 3, physicalStatus: 'KULLANILABİLİR' };
    db = {
      sharedAsset: { findUnique: async () => ({ ...asset }), updateMany: async ({ data }) => { Object.assign(asset, data); return { count: 1 }; }, findUniqueOrThrow: async () => ({ ...asset }) },
      sharedAssetLog: { create: async () => ({}) }, stockMovement: { create: async () => ({}) },
      $executeRaw: async () => { stock.totalStock--; stock.physicalStatus = 'HURDA'; return 1; },
    };
    await SharedAssetService.updateAssetStatus('asset', { status: 'RETIRED', notes: 'test retirement' });
    assert.equal(stock.totalStock, 2);
    await SharedAssetService.updateAssetStatus('asset', { status: 'RETIRED', notes: 'test location edit', locationNote: 'HURDA DEPOSU' });
    assert.equal(stock.totalStock, 1);
    assert.equal(stock.physicalStatus, 'HURDA');
  });
  await run('ORTAK_EŞYA physical count ignores allocated devices', async () => {
    const stock = { id: 'stock', itemType: 'ORTAK_EŞYA', isActive: true, itemName: 'TEST', totalStock: 2, usedStock: 0, usedInRooms: 0 };
    db = {
      $queryRaw: async () => [],
      stockItem: { findUnique: async () => ({ ...stock }), update: async ({ data }) => Object.assign(stock, data) },
      stockMovement: { create: async () => ({}) },
      sharedAsset: { count: async () => 2 },
    };
    await StockService.reconcilePhysicalCount('stock', { countedAvailable: 0, notes: 'Depoda serbest cihaz yok' });
    assert.equal(stock.totalStock, 0);
  });
  await run('maintenance resolution marks an unclean room READY', async () => {
    const room = { id: 'room', status: 'OUT_OF_ORDER' };
    const fault = { id: 'fault', type: 'GENERAL', status: 'OPEN', roomId: room.id, roomInventory: null, room, updatedAt: new Date(), assignedTo: 'TEST' };
    let cleaningReads = 0;
    db = {
      maintenanceLog: { findUnique: async () => fault, updateMany: async ({ data }) => { Object.assign(fault, data); return { count: 1 }; }, count: async () => 0, findUniqueOrThrow: async () => fault },
      maintenanceEvent: { create: async () => ({}) },
      room: { findUnique: async () => room, update: async ({ data }) => Object.assign(room, data) },
      roomCleaningLog: { count: async () => { cleaningReads++; return 1; } },
    };
    await maintenanceService.updateMaintenance('fault', { status: 'RESOLVED', resolutionNote: 'Test repair', performedBy: 'TEST', canFullUpdate: true });
    assert.equal(room.status, 'READY');
    assert.equal(cleaningReads, 0);
  });
  await run('employee checkout does not inspect outstanding shared device loans', async () => {
    const employee = { id: 'employee', firstName: 'TEST', lastName: 'USER', status: 'RESIDENT', userId: null, beds: [{ id: 'bed' }], occupancies: [], tcNo: null };
    const loan = { id: 'asset', status: 'LOANED', currentEmployeeId: employee.id };
    let loanReads = 0;
    db = {
      employee: { findFirst: async () => employee, update: async ({ data }) => Object.assign(employee, data) },
      inventoryItem: { count: async () => 0 }, visitor: { count: async () => 0 },
      occupancyLog: { count: async () => 1, updateMany: async () => ({ count: 1 }) },
      bed: { updateMany: async () => ({ count: 1 }) },
      sharedAsset: { count: async () => { loanReads++; return 1; } },
    };
    await EmployeeService.checkoutEmployeeFromRoom(employee.id);
    assert.equal(employee.status, 'CHECKED_OUT');
    assert.equal(loan.status, 'LOANED');
    assert.equal(loanReads, 0);
  });
  await run('deleting resolved replacement maintenance deletes stock ledger entry', async () => {
    const fault = { id: 'fault', type: 'ROOM_INVENTORY', roomId: 'room', inventoryStatus: 'DAMAGED', roomInventoryId: 'old', roomInventory: { id: 'old', status: 'RETIRED', returnedAt: new Date() } };
    let deletedMovementFilter;
    db = {
      maintenanceLog: { findUnique: async () => fault, findFirst: async () => null, delete: async () => fault, count: async () => 0 },
      maintenanceEvent: { deleteMany: async () => ({ count: 1 }) },
      stockMovement: { deleteMany: async ({ where }) => { deletedMovementFilter = where; return { count: 1 }; } },
      room: { findUnique: async () => ({ id: 'room', status: 'READY' }) },
    };
    await maintenanceService.deleteMaintenance('fault', 'actor');
    assert.deepEqual(deletedMovementFilter, { maintenanceId: 'fault' });
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
