/** PUBLIC_URL is authoritative; legacy variables remain supported outside Docker. */
export function resolvePublicAccess(env: NodeJS.ProcessEnv) {
  if (env.PUBLIC_URL?.trim()) {
    const value = env.PUBLIC_URL.trim();
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('PUBLIC_URL geçerli bir HTTP/HTTPS adresi olmalıdır.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('PUBLIC_URL yalnızca protokol, IP/domain ve isteğe bağlı port içermelidir.');
    }
    const secure = url.protocol === 'https:';
    return {
      clientUrl: url.origin,
      allowedOrigins: [url.origin],
      allowInsecureHttp: !secure,
      secure,
    };
  }
  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  return {
    clientUrl,
    allowedOrigins: (env.CORS_ALLOWED_ORIGINS || clientUrl).split(',').map(origin => origin.trim()).filter(Boolean),
    allowInsecureHttp: env.ALLOW_INSECURE_HTTP === 'true',
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
  };
}
