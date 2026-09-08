import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createOccupancyWorkbook, createRoomDetailWorkbook, safeExcelCell } from '../services/roomExportService';

test('room exports escape spreadsheet formula-like values', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd']) {
    assert.equal(safeExcelCell(value), `'${value}`);
  }
  assert.equal(safeExcelCell('A BLOK'), 'A BLOK');
});

test('occupancy export groups residents by room without TC or registration number', async () => {
  const buffer = await createOccupancyWorkbook([{
    checkInDate: new Date('2026-01-02T09:00:00Z'), checkOutDate: null, employeeName: 'ALİ YILMAZ',
    employee: { firstName: 'Ali', lastName: 'Yılmaz', department: 'Ön Büro', title: 'Resepsiyonist', company: null },
    bed: { bedLabel: 'Yatak 1', room: { roomNumber: '101', block: { name: 'A Blok' } } },
  }], 'YÖNETİCİ');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const sheet = workbook.getWorksheet('Konaklayanlar Listesi')!;
  const values = sheet.getSheetValues().flat(Infinity).map(String);
  assert.ok(values.some((value) => value.includes('A BLOK - ODA 101')));
  assert.ok(values.includes('AD SOYAD'));
  assert.ok(values.includes('ALİ YILMAZ'));
  assert.ok(!values.some((value) => value.includes('TC')));
  assert.ok(!values.some((value) => value.includes('SİCİL')));
});

test('room detail export creates selected Turkish worksheets and includes solver', async () => {
  const buffer = await createRoomDetailWorkbook({
    roomNumber: '101', status: 'NEEDS_CLEANING', capacity: 2, block: { name: 'A Blok' },
    beds: [{ isOccupied: true }], occupancyHistory: [], inventories: [],
    maintenances: [{ status: 'CLOSED', priority: 'HIGH', category: 'Elektrik', description: 'Lamba', assignedTo: 'MEHMET USTA', createdAt: new Date(), resolvedAt: new Date() }],
    cleaningLogs: [{ status: 'NEEDS_CLEANING', requestedBy: 'AYŞE', cleanedBy: null, requestedAt: new Date(), cleanedAt: null }],
  }, ['maintenance', 'cleaning'], 'YÖNETİCİ');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Arıza Kayıtları', 'Temizlik Kayıtları']);
  const maintenanceValues = workbook.getWorksheet('Arıza Kayıtları')!.getSheetValues().flat(Infinity).map(String);
  assert.ok(maintenanceValues.includes('KAPALI'));
  assert.ok(maintenanceValues.includes('YÜKSEK'));
  assert.ok(maintenanceValues.includes('MEHMET USTA'));
  const cleaningValues = workbook.getWorksheet('Temizlik Kayıtları')!.getSheetValues().flat(Infinity).map(String);
  assert.ok(cleaningValues.includes('TEMİZLİK BEKLİYOR'));
  assert.ok(cleaningValues.some((value) => value.includes('ODA DURUMU: TEMİZLİK BEKLEYEN')));
});
