import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createStockDetailWorkbook, safeStockCell } from '../services/stockExportService';

test('stock exports escape formula-like spreadsheet values', () => {
  assert.equal(safeStockCell('=HYPERLINK("https://example.invalid")'), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(safeStockCell('+SUM(1,2)'), "'+SUM(1,2)");
  assert.equal(safeStockCell('@cmd'), "'@cmd");
  assert.equal(safeStockCell('KLİMA'), 'KLİMA');
});

const baseItem = {
  id: 'stock-1', itemName: 'ONVO TELEVİZYON', itemCode: 'DMR-002', category: 'ODA DEMİRBAŞI', itemType: 'DEMİRBAŞ',
  totalStock: 5, availableStock: 1, unit: 'ADET', physicalStatus: 'KULLANILABİLİR', locationNote: 'A RAFI', specifications: '43 INÇ',
};

test('detail stock export creates only the requested worksheets and escapes cells', async () => {
  const buffer = await createStockDetailWorkbook({
    item: baseItem, device: null,
    roomAssignments: [{ itemName: '=TEHLİKELİ', brand: 'ONVO', quantity: 1, status: 'HEALTHY', installedAt: new Date('2026-01-01T10:00:00Z'), notes: '-', room: { roomNumber: '218', floor: 2, block: { name: 'A BLOK' } } }],
    coverage: [{ blockName: 'A BLOK', roomNumber: '220', floor: 2, capacity: 2, required: 1, assigned: 0, missing: 1 }], faults: [], movements: [],
  }, ['rooms', 'coverage'], 'Yönetici');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Oda Dağılımı', 'Eksik Odalar']);
  assert.equal(workbook.getWorksheet('Oda Dağılımı')?.getCell('D6').value, "'=TEHLİKELİ");
  assert.equal(workbook.getWorksheet('Eksik Odalar')?.getCell('G6').value, 1);
});

test('device export keeps device information, faults and movements in separate worksheets', async () => {
  const device = { id: 'device-1', itemName: '218 NOLU ODA - ONVO TELEVİZYON 1', brand: 'ONVO', quantity: 1, status: 'HEALTHY', installedAt: new Date('2026-01-01T10:00:00Z'), notes: '-', room: { roomNumber: '218', floor: 2, block: { name: 'A BLOK' } } };
  const buffer = await createStockDetailWorkbook({
    item: baseItem, device, roomAssignments: [], coverage: [],
    faults: [{ status: 'CLOSED', priority: 'MEDIUM', description: 'EKRAN ARIZASI', reportedBy: 'Yönetici', assignedTo: 'Yönetici', createdAt: new Date('2026-02-01T10:00:00Z'), resolvedAt: new Date('2026-02-02T10:00:00Z'), resolutionNote: 'KAPATILDI', room: device.room, roomInventory: device }],
    movements: [{ type: 'ROOM_ASSIGNMENT', itemNameSnapshot: device.itemName, roomLabelSnapshot: 'A BLOK / ODA 218', quantity: -1, reason: 'ODAYA ZİMMET', notes: '-', createdAt: new Date('2026-01-01T10:00:00Z'), createdBy: { fullName: 'Yönetici' }, employee: null, maintenance: null }],
  }, ['summary', 'faults', 'movements'], 'Yönetici');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Cihaz Bilgileri', 'Arıza Kayıtları', 'Cihaz Hareketleri']);
  assert.equal(workbook.getWorksheet('Cihaz Bilgileri')?.getCell('B6').value, device.itemName);
  assert.equal(workbook.getWorksheet('Arıza Kayıtları')?.getCell('G6').value, 'EKRAN ARIZASI');
  assert.equal(workbook.getWorksheet('Cihaz Hareketleri')?.getCell('D6').value, 'A BLOK / ODA 218');
});
