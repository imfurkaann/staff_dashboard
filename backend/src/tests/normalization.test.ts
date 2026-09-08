import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentifier, normalizeInventoryItemName, normalizeTitleCase, normalizeUpper } from '../utils/normalization';
import { parseIstanbulDateBoundary } from '../utils/dateTime';
import { canonicalChoice, canonicalShift, EMPLOYEE_DEPARTMENTS } from '../utils/employeeDomain';

test('Turkish text normalization is deterministic', () => {
  assert.equal(normalizeTitleCase('  fURKAN   ışık  '), 'Furkan Işık');
  assert.equal(normalizeUpper('furkan ışık'), 'FURKAN IŞIK');
  assert.equal(normalizeIdentifier(' 34 abc 123 '), '34ABC123');
});

test('known inventory spelling variants use one canonical name', () => {
  assert.equal(normalizeInventoryItemName('nevresim'), 'NEVRESİM');
  assert.equal(normalizeInventoryItemName('Nevrein'), 'NEVRESİM');
});

test('canonical choices ignore casing but preserve the official label', () => {
  assert.equal(canonicalChoice('bilgi işlem', EMPLOYEE_DEPARTMENTS, 'Departman', true), 'BİLGİ İŞLEM');
});

test('preset and manually selected shift ranges use one canonical format', () => {
  assert.equal(canonicalShift('13:00-21:00'), '13:00 - 21:00');
  assert.equal(canonicalShift('01:00 - 09:00'), '13:00 - 21:00');
  assert.equal(canonicalShift('Gece'), '00:00 - 08:00');
  assert.equal(canonicalShift('07:30 - 15:45'), '07:30 - 15:45');
  assert.throws(() => canonicalShift('08:00 - 08:00'), /aynı olamaz/);
  assert.throws(() => canonicalShift('25:00 - 09:00'), /geçerli bir aralık/);
});

test('Istanbul date boundaries map to the correct UTC instants', () => {
  assert.equal(parseIstanbulDateBoundary('2026-08-08', false)?.toISOString(), '2026-08-07T21:00:00.000Z');
  assert.equal(parseIstanbulDateBoundary('2026-08-08', true)?.toISOString(), '2026-08-08T20:59:59.999Z');
});
