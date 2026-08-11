import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStockCell } from '../services/stockExportService';

test('stock exports escape formula-like spreadsheet values', () => {
  assert.equal(safeStockCell('=HYPERLINK("https://example.invalid")'), "'=HYPERLINK(\"https://example.invalid\")");
  assert.equal(safeStockCell('+SUM(1,2)'), "'+SUM(1,2)");
  assert.equal(safeStockCell('@cmd'), "'@cmd");
  assert.equal(safeStockCell('KLİMA'), 'KLİMA');
});
