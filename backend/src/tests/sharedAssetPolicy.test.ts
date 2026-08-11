import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedAssetBody, sharedAssetId, sharedAssetPage, sharedAssetQuery, sharedAssetStatus } from '../security/sharedAssetPolicy';

test('shared asset identifiers and bodies reject malformed input', () => {
  assert.equal(sharedAssetId('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
  assert.throws(() => sharedAssetId('asset-1'));
  assert.deepEqual(sharedAssetBody({ notes: 'ok' }), { notes: 'ok' });
  assert.throws(() => sharedAssetBody(null));
  assert.throws(() => sharedAssetBody([]));
});

test('shared asset filters require scalar values and strict paging', () => {
  assert.equal(sharedAssetQuery('CHECK_OUT', 'İşlem'), 'CHECK_OUT');
  assert.throws(() => sharedAssetQuery(['CHECK_OUT'], 'İşlem'));
  assert.equal(sharedAssetPage('2', 'Sayfa', 1), 2);
  assert.throws(() => sharedAssetPage('-1', 'Sayfa', 1));
  assert.equal(sharedAssetStatus('AVAILABLE'), 'AVAILABLE');
  assert.throws(() => sharedAssetStatus('BROKEN'));
});
