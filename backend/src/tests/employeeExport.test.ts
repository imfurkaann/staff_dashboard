import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEmployeeExcelCell } from '../services/employeeExportService';

test('personel Excel hücrelerinde formül çalıştırılmasını engeller', () => {
  assert.equal(safeEmployeeExcelCell('=HYPERLINK("https://example.invalid")'), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(safeEmployeeExcelCell('  +SUM(1,2)'), "'  +SUM(1,2)");
  assert.equal(safeEmployeeExcelCell('-1+2'), "'-1+2");
  assert.equal(safeEmployeeExcelCell('@cmd'), "'@cmd");
});

test('normal personel metinlerini değiştirmez', () => {
  assert.equal(safeEmployeeExcelCell('AHMET YILMAZ'), 'AHMET YILMAZ');
  assert.equal(safeEmployeeExcelCell('A-101'), 'A-101');
  assert.equal(safeEmployeeExcelCell(null), '');
});
