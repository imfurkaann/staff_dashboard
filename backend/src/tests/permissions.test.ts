import test from 'node:test';
import assert from 'node:assert/strict';
import { appRoles, hasPermission, permissionLabels, permissions, roleCatalog, rolePermissions } from '../security/permissions';
import { scopeEmployeeData, scopeMaintenanceData, scopeRoomData } from '../security/dataScope';

test('technical roles can process faults without receiving user administration access', () => {
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.MAINTENANCE_FULL_UPDATE), true);
  assert.equal(hasPermission('TECHNICIAN', permissions.MAINTENANCE_UPDATE), true);
  assert.equal(hasPermission('TECHNICIAN', permissions.MAINTENANCE_FULL_UPDATE), false);
  assert.equal(hasPermission('TECHNICAL_MANAGER', permissions.USER_MANAGE), false);
});

test('housekeeping is limited to rooms and cleaning operations', () => {
  assert.equal(hasPermission('HOUSEKEEPING', permissions.ROOM_VIEW), true);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.CLEANING_MANAGE), true);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.EMPLOYEE_VIEW), false);
  assert.equal(hasPermission('HOUSEKEEPING', permissions.STOCK_VIEW), false);
});

test('housing staff operational responses do not expose employee private fields', () => {
  const employee = { id: 'e1', firstName: 'Ada', tcNo: '12345678901', phone: '555', user: { username: 'ada' } };
  const scoped = scopeEmployeeData(employee, 'HOUSING_STAFF') as Record<string, unknown>;
  assert.equal(scoped.firstName, 'Ada');
  assert.equal('tcNo' in scoped, false);
  assert.equal('phone' in scoped, false);
  assert.equal('user' in scoped, false);
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
  assert.deepEqual(technician.cleaningLogs, []);
  const housekeeping = scopeRoomData(room, 'HOUSEKEEPING');
  assert.deepEqual(housekeeping.maintenances, []);
  assert.deepEqual(housekeeping.inventories, []);
});

test('maintenance financial values require full-update permission', () => {
  const record = { id: 'm1', laborCost: 1500, partsCost: 500, serviceProvider: 'SERVİS A' };
  const technician = scopeMaintenanceData(record, 'TECHNICIAN') as Record<string, unknown>;
  assert.equal('laborCost' in technician, false);
  assert.equal('partsCost' in technician, false);
  assert.equal(technician.serviceProvider, 'SERVİS A');
  assert.equal((scopeMaintenanceData(record, 'TECHNICAL_MANAGER') as typeof record).laborCost, 1500);
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
