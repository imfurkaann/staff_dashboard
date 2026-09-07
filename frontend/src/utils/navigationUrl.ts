type ManagementDetail = {
  empId?: string;
  roomId?: string;
  ticketId?: string;
  subView?: 'history';
  warehouseTab?: 'quick' | 'stock' | 'rooms' | 'personnel' | 'movements';
  stockItemId?: string;
  stockSection?: 'overview' | 'rooms' | 'coverage' | 'faults' | 'movements';
  movementItemId?: string;
  stockRoomInventoryId?: string;
};

const managementDetailKeys = ['empId', 'roomId', 'ticketId', 'subView', 'warehouseTab', 'stockItemId', 'stockSection', 'movementItemId', 'stockRoomInventoryId', 'portalTab', 'portalModal'];
const warehouseTabs: NonNullable<ManagementDetail['warehouseTab']>[] = ['quick', 'stock', 'rooms', 'personnel', 'movements'];
const stockSections: NonNullable<ManagementDetail['stockSection']>[] = ['overview', 'rooms', 'coverage', 'faults', 'movements'];

const validWarehouseTab = (value: string | null): NonNullable<ManagementDetail['warehouseTab']> =>
  value && warehouseTabs.includes(value as NonNullable<ManagementDetail['warehouseTab']>) ? value as NonNullable<ManagementDetail['warehouseTab']> : 'quick';
const validStockSection = (value: string | null): ManagementDetail['stockSection'] =>
  value && stockSections.includes(value as NonNullable<ManagementDetail['stockSection']>) ? value as NonNullable<ManagementDetail['stockSection']> : undefined;

/** Produces a canonical management URL with no details belonging to another page. */
export function managementUrl(tab: string, detail: ManagementDetail = {}): URL {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  for (const key of managementDetailKeys) url.searchParams.delete(key);

  if (tab === 'employees' && detail.empId) url.searchParams.set('empId', detail.empId);
  if (tab === 'rooms' && detail.roomId) url.searchParams.set('roomId', detail.roomId);
  if (tab === 'tickets' && detail.ticketId) url.searchParams.set('ticketId', detail.ticketId);
  if ((tab === 'visitors' || tab === 'shared-assets') && detail.subView === 'history') url.searchParams.set('subView', 'history');
  if (tab === 'warehouse') {
    url.searchParams.set('warehouseTab', detail.warehouseTab || 'quick');
    if (detail.stockItemId) url.searchParams.set('stockItemId', detail.stockItemId);
    if (detail.stockItemId && detail.stockSection) url.searchParams.set('stockSection', detail.stockSection);
    if (detail.stockItemId && detail.stockRoomInventoryId) url.searchParams.set('stockRoomInventoryId', detail.stockRoomInventoryId);
    if (detail.warehouseTab === 'movements' && detail.movementItemId) url.searchParams.set('movementItemId', detail.movementItemId);
  }
  return url;
}

/** Keeps only the valid detail parameter for a directly opened management page. */
export function canonicalManagementUrl(tab: string): URL {
  const current = new URL(window.location.href);
  return managementUrl(tab, {
    empId: tab === 'employees' ? current.searchParams.get('empId') || undefined : undefined,
    roomId: tab === 'rooms' ? current.searchParams.get('roomId') || undefined : undefined,
    ticketId: tab === 'tickets' ? current.searchParams.get('ticketId') || undefined : undefined,
    subView: (tab === 'visitors' || tab === 'shared-assets') && current.searchParams.get('subView') === 'history' ? 'history' : undefined,
    warehouseTab: tab === 'warehouse' ? validWarehouseTab(current.searchParams.get('warehouseTab')) : undefined,
    stockItemId: tab === 'warehouse' ? current.searchParams.get('stockItemId') || undefined : undefined,
    stockSection: tab === 'warehouse' ? validStockSection(current.searchParams.get('stockSection')) : undefined,
    movementItemId: tab === 'warehouse' && current.searchParams.get('warehouseTab') === 'movements' ? current.searchParams.get('movementItemId') || undefined : undefined,
    stockRoomInventoryId: tab === 'warehouse' ? current.searchParams.get('stockRoomInventoryId') || undefined : undefined,
  });
}

/** Staff portal has its own compact URL namespace. */
export function portalUrl(portalTab: string, portalModal?: 'ticket'): URL {
  const url = new URL(window.location.href);
  for (const key of managementDetailKeys) url.searchParams.delete(key);
  url.searchParams.delete('tab');
  url.searchParams.set('portalTab', portalTab);
  if (portalModal === 'ticket') url.searchParams.set('portalModal', 'ticket');
  return url;
}
