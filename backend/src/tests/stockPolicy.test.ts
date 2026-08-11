import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import { stockPositivePage, stockRequestBody, stockSingleQuery, validateStockId } from '../security/stockPolicy';

test('stock identifiers and request bodies reject malformed input', () => {
  assert.equal(validateStockId('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
  assert.throws(() => validateStockId('../stock'), (error: unknown) => error instanceof AppError && error.statusCode === 400);
  assert.throws(() => stockRequestBody(null), (error: unknown) => error instanceof AppError && error.statusCode === 400);
  assert.throws(() => stockRequestBody([]), (error: unknown) => error instanceof AppError && error.statusCode === 400);
});

test('stock filters accept one value and strict positive pagination', () => {
  assert.equal(stockSingleQuery('RECEIPT', 'Hareket'), 'RECEIPT');
  assert.throws(() => stockSingleQuery(['RECEIPT'], 'Hareket'), (error: unknown) => error instanceof AppError && error.statusCode === 400);
  assert.equal(stockPositivePage('25', 'Sayfa boyutu', 50), 25);
  assert.throws(() => stockPositivePage('2x', 'Sayfa', 1), (error: unknown) => error instanceof AppError && error.statusCode === 400);
});
