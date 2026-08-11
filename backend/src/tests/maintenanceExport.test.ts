import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMaintenanceCell } from '../services/maintenanceExportService';

test('maintenance exports escape formula-like spreadsheet values', () => {
  assert.equal(safeMaintenanceCell('=HYPERLINK("https://example.invalid")'), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(safeMaintenanceCell('+SUM(1,2)'), "'+SUM(1,2)");
  assert.equal(safeMaintenanceCell('@cmd'), "'@cmd");
  assert.equal(safeMaintenanceCell('ELEKTRİK ARIZASI'), 'ELEKTRİK ARIZASI');
});
