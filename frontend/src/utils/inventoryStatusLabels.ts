export const inventoryStatusLabels: Record<string, string> = {
  HEALTHY: 'Sağlam & Çalışır',
  MAINTENANCE_REQUIRED: 'Arızalı / Bakım Bekliyor',
  DAMAGED: 'Kırık / Hasarlı',
  LOST: 'Kayıp / Zayi',
  IN_SERVICE: 'Tamirde / Serviste',
  REPLACEMENT_REQUIRED: 'Değişim Bekliyor',
  RETIRED: 'İade Edildi / Düşüm Yapıldı',
};

export function getInventoryStatusLabel(status?: string | null): string {
  if (!status) return '-';
  return inventoryStatusLabels[status] || status;
}
