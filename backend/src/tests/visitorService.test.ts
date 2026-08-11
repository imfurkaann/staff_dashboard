import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import { VisitorService } from '../services/visitorService';

function expectBadRequest(run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 400 && message.test(error.message));
}

test('visitor filters reject unknown states, malformed IDs and reversed dates', () => {
  expectBadRequest(() => VisitorService.buildWhere({ status: 'UNKNOWN' }), /durum/i);
  expectBadRequest(() => VisitorService.buildWhere({ hostEmployeeId: '../employee' }), /personel/i);
  expectBadRequest(() => VisitorService.buildWhere({ dateStart: '2026-08-12', dateEnd: '2026-08-11' }), /sonra/i);
});

test('visitor date filters use Istanbul day boundaries', () => {
  const where = VisitorService.buildWhere({ dateStart: '2026-08-11', dateEnd: '2026-08-11' });
  assert.deepEqual(where.entryTime, {
    gte: new Date('2026-08-10T21:00:00.000Z'),
    lte: new Date('2026-08-11T20:59:59.999Z'),
  });
});

test('visitor listing rejects unsupported sort fields before querying the database', async () => {
  await assert.rejects(
    VisitorService.getAllVisitors({ sortBy: 'requestKey' }),
    (error: unknown) => error instanceof AppError && error.statusCode === 400 && /sıralama/i.test(error.message),
  );
});
