import test from 'node:test';
import assert from 'node:assert/strict';
import { appRoles, hasPermission, permissionLabels, permissions, roleCatalog, rolePermissions } from '../security/permissions';
import { scopeEmployeeData, scopeMaintenanceData, scopeRoomData } from '../security/dataScope';

test('technical roles can process faults without receiving user administration access', () => {
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.MAINTENANCE_FULL_UPDATE), true);
  assert.equal(hasPermission('TECHNICIAN', permissions.MAINTENANCE_UPDATE), true);
  assert.equal(hasPermission('TECHNICIAN', permissions.MAINTENANCE_FULL_UPDATE), false);
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.USER_MANAGE), false);
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.STOCK_VIEW), true);
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.STOCK_MANAGE), false);
});

test('warehouse personnel workflows do not grant broad employee administration access', () => {
  assert.equal(hasPermission('WAREHOUSE_MANAGER', permissions.STOCK_MANAGE), true);
  assert.equal(hasPermission('WAREHOUSE_MANAGER', permissions.EMPLOYEE_VIEW), false);
  assert.equal(hasPermission('WAREHOUSE_MANAGER', permissions.EMPLOYEE_MANAGE), false);
});

test('housekeeping is limited to rooms and cleaning operations', () => {
  assert.equal(hasPermission('HOUSEKEEPING', permissions.ROOM_VIEW), true);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.CLEANING_MANAGE), true);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.EMPLOYEE_VIEW), false);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.STOCK_VIEW), false);
});

test('housing staff see the complete employee profile required for lodging operations', () => {
  assert.equal(hasPermission('HOUSING_STAFF', permissions.EMPLOYEE_MANAGE), true);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.ROOM_MANAGE), false);
  const employee = {
    id: 'e1', firstName: 'Ada', photoUrl: 'data:image/jpeg;base64,AAAA', tcNo: '12345678901', phone: '555', user: { username: 'ada' },
    inventories: [{ id: 'i1', itemName: 'Anahtar' }], disciplinaryNotes: [{ id: 'd1', content: 'Not' }], occupancies: [{ id: 'o1' }],
  };
  const scoped = scopeEmployeeData(employee, 'HOUSING_STAFF') as Record<string, unknown>;
  assert.equal(scoped.firstName, 'Ada');
  assert.equal(scoped.photoUrl, 'data:image/jpeg;base64,AAAA');
  assert.equal(scoped.tcNo, '12345678901');
  assert.equal(scoped.phone, '555');
  assert.deepEqual(scoped.user, { username: 'ada' });
  assert.deepEqual(scoped.inventories, [{ id: 'i1', itemName: 'Anahtar' }]);
  assert.deepEqual(scoped.disciplinaryNotes, [{ id: 'd1', content: 'Not' }]);
  assert.deepEqual(scoped.occupancies, [{ id: 'o1' }]);
});

test('housing staff have full operational visibility but no destructive or user-management permissions', () => {
  assert.equal(hasPermission('HOUSING_STAFF', permissions.EMPLOYEE_SENSITIVE_VIEW), true);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.EMPLOYEE_EXPORT), true);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.MAINTENANCE_DELETE), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.EMPLOYEE_DELETE), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.ROOM_DELETE), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.STOCK_DELETE), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.SHARED_ASSET_DELETE), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.VISITOR_EXPORT), false);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.USER_MANAGE), false);
});

test('room scoping hides occupants from technical and housekeeping roles', () => {
  const room = {
    id: 'r1',
    beds: [{ id: 'b1', bedLabel: 'A', isOccupied: true, currentEmployee: { id: 'e1', firstName: 'Ada', tcNo: '123' } }],
    maintenances: [{ id: 'm1' }],
    cleaningLogs: [{ id: 'c1' }],
    inventories: [{ id: 'i1' }],
  };
  const technician = scopeRoomData(room, 'TECHNICIAN');
  assert.deepEqual(technician.beds, [{ id: 'b1', bedLabel: 'A', isOccupied: true }]);
  assert.deepEqual(technician.inventories, []);
  assert.deepEqual(technician.cleaningLogs, []);
  const housekeeping = scopeRoomData(room, 'HOUSEKEEPING');
  assert.deepEqual(housekeeping.maintenances, []);
  assert.deepEqual(housekeeping.inventories, []);
});

test('room detail relations follow the existing module permissions', () => {
  const room = {
    id: 'r1',
    beds: [{ id: 'b1', bedLabel: 'A', isOccupied: true, currentEmployee: { id: 'e1', firstName: 'Ada', tcNo: '123' } }],
    maintenances: [{ id: 'm1' }],
    cleaningLogs: [{ id: 'c1' }],
    inventories: [{ id: 'i1' }],
  };
  const warehouse = scopeRoomData(room, 'WAREHOUSE_MANAGER');
  assert.deepEqual(warehouse.inventories, [{ id: 'i1' }]);
  assert.deepEqual(warehouse.maintenances, [{ id: 'm1' }]);
  assert.deepEqual(warehouse.cleaningLogs, []);

  const humanResources = scopeRoomData(room, 'HR_MANAGER');
  assert.equal(humanResources.beds[0].currentEmployee.tcNo, '123');
  assert.deepEqual(humanResources.inventories, []);
  assert.deepEqual(humanResources.maintenances, []);
  assert.deepEqual(humanResources.cleaningLogs, []);

  const security = scopeRoomData(room, 'SECURITY');
  assert.deepEqual(security.beds, [{ id: 'b1', bedLabel: 'A', isOccupied: true }]);
  assert.deepEqual(security.inventories, []);
  assert.deepEqual(security.maintenances, [{ id: 'm1' }]);
  assert.deepEqual(security.cleaningLogs, []);
});

test('retired maintenance service fields are hidden from every role', () => {
  const record = { id: 'm1', laborCost: 1500, partsCost: 500, serviceProvider: 'SERVİS A' };
  const technician = scopeMaintenanceData(record, 'TECHNICIAN') as Record<string, unknown>;
  assert.equal('laborCost' in technician, false);
  assert.equal('partsCost' in technician, false);
  assert.equal('serviceProvider' in technician, false);
  assert.equal('laborCost' in (scopeMaintenanceData(record, 'TECHNICAL_MANAGER') as Record<string, unknown>), false);
});

test('role catalog is exhaustive and exposes the enforced permission matrix', () => {
  assert.equal(roleCatalog.length, appRoles.length);
  for (const role of appRoles) {
    const catalog = roleCatalog.find((item) => item.role === role);
    assert.ok(catalog);
    assert.deepEqual(catalog.permissions.map((item) => item.permission), Array.from(rolePermissions[role]));
  }
  assert.deepEqual(Object.keys(permissionLabels).sort(), Object.values(permissions).sort());
  assert.equal(hasPermission('HR_MANAGER', permissions.ROOM_OCCUPANCY_EXPORT), true);
  assert.equal(hasPermission('HOUSING_STAFF', permissions.USER_MANAGE), false);
});
