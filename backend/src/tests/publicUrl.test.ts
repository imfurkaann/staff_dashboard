import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicAccess } from '../config/publicUrl';

test('HTTP IP deployment derives origins and usable cookies', () => {
  assert.deepEqual(resolvePublicAccess({ PUBLIC_URL: 'http://169.58.124.2:3335' }), {
    clientUrl: 'http://169.58.124.2:3335', allowedOrigins: ['http://169.58.124.2:3335'],
    secure: false, allowInsecureHttp: true,
  });
});

test('domain migration overrides stale legacy settings and normalizes origin', () => {
  assert.deepEqual(resolvePublicAccess({
    PUBLIC_URL: 'https://Portal.Example.com/', CLIENT_URL: 'http://old.example',
    CORS_ALLOWED_ORIGINS: 'http://old.example', COOKIE_SECURE: 'false', ALLOW_INSECURE_HTTP: 'true',
  }), {
    clientUrl: 'https://portal.example.com', allowedOrigins: ['https://portal.example.com'],
    secure: true, allowInsecureHttp: false,
  });
});

test('rejects invalid public origins instead of starting with a broken configuration', () => {
  for (const PUBLIC_URL of ['example.com', 'ftp://example.com', 'https://example.com/app',
    'https://user:pass@example.com', 'https://example.com?q=1', 'https://example.com/#app']) {
    assert.throws(() => resolvePublicAccess({ PUBLIC_URL }), /PUBLIC_URL/);
  }
});

test('legacy development configuration remains usable', () => {
  const access = resolvePublicAccess({ CLIENT_URL: 'http://localhost:5173' });
  assert.deepEqual(access.allowedOrigins, ['http://localhost:5173']);
  assert.equal(access.secure, false);
});
