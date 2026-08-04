export const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  appName: import.meta.env.VITE_APP_NAME || 'LojmanYönetim',
  appSubtitle: import.meta.env.VITE_APP_SUBTITLE || 'Personel Konaklama & Lojman Portalı',
  copyrightText: import.meta.env.VITE_COPYRIGHT_TEXT || '© 2026 Personel Lojman Yönetim Sistemi. Tüm hakları saklıdır.',
  showDemoAccounts: import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true',
};
