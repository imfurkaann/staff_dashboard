type ManagementDetail = {
  empId?: string;
  roomId?: string;
  ticketId?: string;
  subView?: 'history';
};

const managementDetailKeys = ['empId', 'roomId', 'ticketId', 'subView', 'portalTab', 'portalModal'];

/** Produces a canonical management URL with no details belonging to another page. */
export function managementUrl(tab: string, detail: ManagementDetail = {}): URL {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  for (const key of managementDetailKeys) url.searchParams.delete(key);

  if (tab === 'employees' && detail.empId) url.searchParams.set('empId', detail.empId);
  if (tab === 'rooms' && detail.roomId) url.searchParams.set('roomId', detail.roomId);
  if (tab === 'tickets' && detail.ticketId) url.searchParams.set('ticketId', detail.ticketId);
  if ((tab === 'visitors' || tab === 'shared-assets') && detail.subView === 'history') url.searchParams.set('subView', 'history');
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
