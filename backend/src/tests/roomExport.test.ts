import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExcelCell } from '../services/roomExportService';

test('room exports escape spreadsheet formula-like values', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd']) {
    assert.equal(safeExcelCell(value), `'${value}`);
  }
  assert.equal(safeExcelCell('A BLOK'), 'A BLOK');
});
