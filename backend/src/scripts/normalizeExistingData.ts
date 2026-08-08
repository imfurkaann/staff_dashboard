import prisma from '../db/prisma';
import { AGE_GROUPS, canonicalChoice, EMERGENCY_RELATIONS, EMPLOYEE_DEPARTMENTS, EMPLOYEE_TITLES, LANGUAGE_NATIONALITIES, SHIFT_TYPES } from '../utils/employeeDomain';
import { normalizeIdentifier, normalizeInventoryItemName, normalizePhone, normalizeUpper } from '../utils/normalization';

const applyChanges = process.argv.includes('--apply');

async function main() {
  const [users, employees, visitors, blocks, rooms, roomInventories, beds, occupancyLogs, inventoryItems, disciplinaryNotes, maintenances, cleaningLogs, notifications] = await Promise.all([
    prisma.user.findMany(),
    prisma.employee.findMany(),
    prisma.visitor.findMany(),
    prisma.block.findMany(),
    prisma.room.findMany(),
    prisma.roomInventory.findMany(),
    prisma.bed.findMany(),
    prisma.occupancyLog.findMany(),
    prisma.inventoryItem.findMany(),
    prisma.disciplinaryNote.findMany(),
    prisma.maintenanceLog.findMany(),
    prisma.roomCleaningLog.findMany(),
    prisma.notification.findMany(),
  ]);

  const normalizedUserKeys = new Set<string>();
  for (const user of users) {
    const username = user.username.trim().toLocaleLowerCase('en-US');
    const email = user.email.trim().toLocaleLowerCase('en-US');
    for (const key of [`u:${username}`, `e:${email}`]) {
      if (normalizedUserKeys.has(key)) throw new Error(`Kullanıcı adı/e-posta normalizasyon çakışması: ${key.slice(2)}`);
      normalizedUserKeys.add(key);
    }
    if (applyChanges) await prisma.user.update({ where: { id: user.id }, data: { username, email, fullName: normalizeUpper(user.fullName) || user.fullName } });
  }

  const warnings: string[] = [];
  for (const employee of employees) {
    const safeChoice = (value: string | null, choices: readonly string[], field: string) => {
      try { return canonicalChoice(value, choices, field); }
      catch { warnings.push(`${employee.id}: ${field} değeri standart liste dışında (${value})`); return value; }
    };
    const data = {
      firstName: normalizeUpper(employee.firstName) || employee.firstName,
      lastName: normalizeUpper(employee.lastName) || employee.lastName,
      registrationNo: normalizeIdentifier(employee.registrationNo),
      department: safeChoice(employee.department, EMPLOYEE_DEPARTMENTS, 'Departman') || employee.department,
      title: safeChoice(employee.title, EMPLOYEE_TITLES, 'Unvan'),
      company: normalizeUpper(employee.company),
      phone: employee.phone ? normalizePhone(employee.phone) : null,
      vehiclePlate: normalizeIdentifier(employee.vehiclePlate),
      ageGroup: safeChoice(employee.ageGroup, AGE_GROUPS, 'Yaş grubu'),
      languageNationality: safeChoice(employee.languageNationality, LANGUAGE_NATIONALITIES, 'Dil / uyruk'),
      emergencyContactName: normalizeUpper(employee.emergencyContactName),
      emergencyRelation: safeChoice(employee.emergencyRelation, EMERGENCY_RELATIONS, 'Yakınlık derecesi'),
      emergencyContactPhone: employee.emergencyContactPhone ? normalizePhone(employee.emergencyContactPhone, 'Acil durum telefonu') : null,
      shiftType: safeChoice(employee.shiftType, SHIFT_TYPES, 'Vardiya tipi'),
    };
    if (applyChanges) await prisma.employee.update({ where: { id: employee.id }, data });
  }

  for (const visitor of visitors) {
    if (applyChanges) await prisma.visitor.update({ where: { id: visitor.id }, data: {
      fullName: normalizeUpper(visitor.fullName) || visitor.fullName,
      company: normalizeUpper(visitor.company), hostEmployeeName: normalizeUpper(visitor.hostEmployeeName), hostRoomLabel: normalizeUpper(visitor.hostRoomLabel),
      purpose: normalizeUpper(visitor.purpose), vehiclePlate: normalizeIdentifier(visitor.vehiclePlate),
      notes: normalizeUpper(visitor.notes), phone: visitor.phone ? normalizePhone(visitor.phone) : null,
    } });
  }
  for (const block of blocks) if (applyChanges) await prisma.block.update({ where: { id: block.id }, data: { name: normalizeUpper(block.name) || block.name } });
  for (const room of rooms) if (applyChanges) await prisma.room.update({ where: { id: room.id }, data: { roomNumber: normalizeUpper(room.roomNumber) || room.roomNumber } });
  for (const item of roomInventories) if (applyChanges) await prisma.roomInventory.update({ where: { id: item.id }, data: {
    itemName: normalizeUpper(item.itemName) || item.itemName, location: normalizeUpper(item.location) || item.location, notes: normalizeUpper(item.notes),
  } });
  for (const bed of beds) if (applyChanges) await prisma.bed.update({ where: { id: bed.id }, data: { bedLabel: normalizeUpper(bed.bedLabel) || bed.bedLabel } });
  for (const log of occupancyLogs) if (applyChanges) await prisma.occupancyLog.update({ where: { id: log.id }, data: {
    employeeName: normalizeUpper(log.employeeName) || log.employeeName,
    employeeDepartment: normalizeUpper(log.employeeDepartment), employeeTitle: normalizeUpper(log.employeeTitle),
    employeeCompany: normalizeUpper(log.employeeCompany), transferReason: normalizeUpper(log.transferReason),
  } });
  for (const item of inventoryItems) if (applyChanges) await prisma.inventoryItem.update({ where: { id: item.id }, data: {
    itemName: normalizeInventoryItemName(item.itemName) || item.itemName, itemCode: normalizeIdentifier(item.itemCode),
    serialNo: normalizeUpper(item.serialNo), notes: normalizeUpper(item.notes),
  } });
  for (const note of disciplinaryNotes) if (applyChanges) await prisma.disciplinaryNote.update({ where: { id: note.id }, data: {
    title: normalizeUpper(note.title) || note.title, content: normalizeUpper(note.content) || note.content,
    reportedBy: normalizeUpper(note.reportedBy) || note.reportedBy,
  } });
  for (const maintenance of maintenances) if (applyChanges) await prisma.maintenanceLog.update({ where: { id: maintenance.id }, data: {
    title: normalizeUpper(maintenance.title) || maintenance.title, description: normalizeUpper(maintenance.description) || maintenance.description,
    category: normalizeUpper(maintenance.category), location: normalizeUpper(maintenance.location),
    reportedBy: normalizeUpper(maintenance.reportedBy) || maintenance.reportedBy,
    assignedTo: normalizeUpper(maintenance.assignedTo), resolutionNote: normalizeUpper(maintenance.resolutionNote),
  } });
  for (const log of cleaningLogs) if (applyChanges) await prisma.roomCleaningLog.update({ where: { id: log.id }, data: {
    requestedBy: normalizeUpper(log.requestedBy) || log.requestedBy, cleanedBy: normalizeUpper(log.cleanedBy), notes: normalizeUpper(log.notes),
  } });
  for (const notification of notifications) if (applyChanges) await prisma.notification.update({ where: { id: notification.id }, data: {
    title: normalizeUpper(notification.title) || notification.title,
    message: normalizeUpper(notification.message) || notification.message,
  } });

  console.log(JSON.stringify({ mode: applyChanges ? 'applied' : 'dry-run', users: users.length, employees: employees.length, visitors: visitors.length, blocks: blocks.length, rooms: rooms.length, beds: beds.length, occupancyLogs: occupancyLogs.length, personnelInventories: inventoryItems.length, roomInventories: roomInventories.length, disciplinaryNotes: disciplinaryNotes.length, maintenances: maintenances.length, cleaningLogs: cleaningLogs.length, notifications: notifications.length, warnings }, null, 2));
}

main().finally(() => prisma.$disconnect());
