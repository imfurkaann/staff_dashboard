import test from 'node:test';
import assert from 'node:assert/strict';
import { maskTcNo } from '../utils/crypto';
import { generateUniqueEasyPassword } from '../utils/credentialGenerator';
import { validatePassword } from '../security/passwordPolicy';

test('TC / pasaport değerinde yalnızca son dört karakter görünür', () => {
  assert.equal(maskTcNo('10293847561'), '*******7561');
  assert.equal(maskTcNo('AB1234567'), '*****4567');
});

test('geçici personel parolası okunabilir ve parola politikasıyla uyumludur', async () => {
  const password = await generateUniqueEasyPassword();
  assert.equal(validatePassword(password), password);
  assert.match(password, /^[A-Za-z]+!\d{4}Aa1$/);
});
