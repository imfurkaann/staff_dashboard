import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../middleware/errorHandler';
import {
  validateTicketCreateInput,
  validateTicketFilters,
  validateTicketId,
  validateTicketStatusInput,
} from '../security/ticketPolicy';

function expectBadRequest(run: () => unknown, message: RegExp) {
  assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 400 && message.test(error.message));
}

test('ticket creation trims valid input and only accepts known categories', () => {
  assert.deepEqual(validateTicketCreateInput({
    category: 'GENEL TALEPLER', subject: '  İnternet sorunu  ', description: '  Bağlantı kesiliyor.  ',
  }), {
    category: 'GENEL TALEPLER', subject: 'İnternet sorunu', description: 'Bağlantı kesiliyor.',
  });
  expectBadRequest(() => validateTicketCreateInput({ category: 'SAHTE', subject: 'x', description: 'y' }), /kategori/i);
});

test('ticket creation rejects empty, non-string and oversized content', () => {
  expectBadRequest(() => validateTicketCreateInput({ category: 'DİĞER', subject: [], description: 'x' }), /konusu/i);
  expectBadRequest(() => validateTicketCreateInput({ category: 'DİĞER', subject: 'x'.repeat(201), description: 'y' }), /200/);
  expectBadRequest(() => validateTicketCreateInput({ category: 'DİĞER', subject: 'x', description: 'y'.repeat(5001) }), /5000/);
});

test('status changes reject unknown statuses and require a rejection reason', () => {
  assert.deepEqual(validateTicketStatusInput({ status: 'RESOLVED', adminNote: '  Tamamlandı  ' }), {
    status: 'RESOLVED', adminNote: 'Tamamlandı',
  });
  expectBadRequest(() => validateTicketStatusInput({ status: 'DELETED' }), /durumu/i);
  expectBadRequest(() => validateTicketStatusInput({ status: 'REJECTED', adminNote: ' ' }), /notu/i);
  assert.deepEqual(validateTicketStatusInput({ status: 'OPEN', adminNote: ' ' }), { status: 'OPEN', adminNote: '' });
});

test('ticket filters and identifiers reject malformed requests', () => {
  assert.deepEqual(validateTicketFilters({ status: 'ALL', category: 'DİĞER', search: '  TLP-1 ' }), {
    status: undefined, category: 'DİĞER', search: 'TLP-1',
  });
  expectBadRequest(() => validateTicketFilters({ status: 'INVALID' }), /filtresi/i);
  assert.equal(validateTicketId('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
  expectBadRequest(() => validateTicketId('../all'), /kimliği/i);
});
