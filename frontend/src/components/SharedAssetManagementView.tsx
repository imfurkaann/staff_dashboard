import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowRightLeft, Boxes, Building2, Check,
  ChevronDown, ChevronRight, ClipboardCheck, Download, Edit3, Eye, Filter, History,
  MapPin, Package, Pencil, Plus, RefreshCw, RotateCcw, Search, Send, ShieldAlert, Sparkles, Trash2,
  UserCheck, Users, Wrench, X, Layers, AlertCircle, HardHat, Hammer,
} from 'lucide-react';
import {
  SharedAsset, SharedAssetLog, SharedAssetOverview, SharedAssetStatus, sharedAssetApi,
} from '../api/sharedAssetApi';
import { stockApi, StockItem } from '../api/stockApi';
import { SharedAssetHistoryView } from './SharedAssetHistoryView';
import { generateUUID } from '../utils/cryptoHelpers';
import { managementUrl } from '../utils/navigationUrl';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { mergeById } from '../utils/pagination';

type ModalState =
  | { type: 'createAsset' }
  | { type: 'editLocation'; asset: SharedAsset }
  | { type: 'checkOut'; asset?: SharedAsset }
  | { type: 'checkIn'; asset: SharedAsset }
  | { type: 'detail'; asset: SharedAsset }
  | { type: 'maintenanceLog'; asset: SharedAsset }
  | { type: 'retire'; asset: SharedAsset }
  | { type: 'editLog' }
  | { type: 'deleteLog' }
  | { type: 'fullHistory' }
  | null;

const isCommonFacilityRoom = (room?: { roomType?: string | null } | null) => {
  if (!room || !room.roomType) return false;
  return room.roomType !== 'PERSONNEL_ODASI';
};

const isTodayIstanbul = (dateStr?: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const getIstanbulDateStr = (date: Date) => date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  return getIstanbulDateStr(d) === getIstanbulDateStr(new Date());
};

const buttonBase =
  'group relative inline-flex items-center justify-center h-7 px-2 rounded-lg border transition-all duration-300 ease-out shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase =
  'max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 text-[11px] font-extrabold whitespace-nowrap overflow-hidden';

const ASSET_CATEGORIES = [
  'TEMİZLİK & BAKIM MAKİNELERİ',
  'EL ALETLERİ & TAMİR',
  'BAHÇE & PEYZAJ',
  'ELEKTRİKLİ EV ALETLERİ',
  'GÜVENLİK & İŞ SAĞLIĞI',
  'MOBİLYA & MEFRUŞAT',
  'ELEKTRONİK & BİLİŞİM',
  'ISITMA & SOĞUTMA',
  'MUTFAK & SERVİS EKİPMANLARI',
  'ÖLÇÜM & TEST CİHAZLARI',
  'MERDİVEN & İSKELE',
  'TAŞIMA & DEPOLAMA',
  'GENEL EŞYALAR',
] as const;

const statusLabels: Record<SharedAssetStatus, string> = {
  AVAILABLE: 'Müsait / Depoda',
  LOANED: 'Kullanımda',
  MAINTENANCE: 'Bakımda / Arızalı',
  RETIRED: 'Hurda / Kullanım Dışı',
};

const logActionLabel = (action: string) => ({
  CREATED: 'Kayıt Oluşturuldu', CHECK_OUT: 'Zimmet / Teslim', CHECK_IN: 'İade Alındı',
  MAINTENANCE_START: 'Bakıma Alındı', MAINTENANCE_END: 'Bakım Tamamlandı',
  FAULT_REPORTED: 'Arıza Bildirildi', REPAIR_COMPLETED: 'Onarım Tamamlandı',
  STATUS_CHANGE: 'Durum / Bağlantı Değişti', SYNC_CORRECTION: 'Sistem Düzeltmesi',
}[action] || action);

const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul',
}).format(new Date(value)) : '-';

const formatDateOnly = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium', timeZone: 'Europe/Istanbul',
}).format(new Date(value)) : '-';

const inputClass = 'w-full min-h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold text-slate-900 transition placeholder:normal-case';
const labelClass = 'block mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600';
const primaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#1e3a8a] bg-[#1e3a8a] px-3 text-[11px] font-extrabold text-white shadow-xs transition-all hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-extrabold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-[#1e3a8a] disabled:opacity-50';

const CustomLocationSelector: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: string[];
}> = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return options;
    return options.filter((opt) => opt.toLocaleLowerCase('tr-TR').includes(q));
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className={`${inputClass} pl-9 pr-8`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder="Konum yazın veya seçin (Örn: Ana Depo, Yönetim Ofisi)..."
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[300] mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-300 bg-white p-1.5 shadow-2xl animate-fadeIn">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-[10px] font-bold text-slate-500">
              "{query}" kaydı listede yok. Yazdığınız isim yeni konum olarak kaydedilecektir.
            </div>
          ) : (
            filtered.map((opt) => {
              const isSelected = value === opt;

              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setQuery(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${isSelected ? 'bg-blue-100 text-[#1e3a8a]' : 'text-slate-700 hover:bg-blue-50 hover:text-[#1e3a8a]'}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
                    <span>{opt}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#1e3a8a]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  registrationNo?: string | null;
}

const CustomEmployeeSelector: React.FC<{
  employees: EmployeeOption[];
  selectedEmployeeId: string;
  customName: string;
  onChange: (data: { employeeId: string; customBorrowerName: string }) => void;
}> = ({ employees, selectedEmployeeId, customName, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      if (emp) return `${emp.firstName} ${emp.lastName}${emp.department ? ` (${emp.department})` : ''}`;
    }
    return customName || '';
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return employees;
    return employees.filter((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`.toLocaleLowerCase('tr-TR');
      const dept = (emp.department || '').toLocaleLowerCase('tr-TR');
      const reg = (emp.registrationNo || '').toLocaleLowerCase('tr-TR');
      return fullName.includes(q) || dept.includes(q) || reg.includes(q);
    });
  }, [employees, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className={`${inputClass} pl-9 pr-8`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange({ employeeId: '', customBorrowerName: val });
            setOpen(true);
          }}
          placeholder="Personel adı arayın veya isim yazın..."
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[300] mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-300 bg-white p-1.5 shadow-2xl animate-fadeIn">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-[10px] font-bold text-slate-500">
              "{query}" ismi listede bulunamadı. Yazdığınız isim verilen kişi olarak kaydedilecektir.
            </div>
          ) : (
            filtered.map((emp) => {
              const fullName = `${emp.firstName} ${emp.lastName}`;
              const label = `${fullName}${emp.department ? ` (${emp.department})` : ''}`;
              const isSelected = selectedEmployeeId === emp.id;

              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onChange({ employeeId: emp.id, customBorrowerName: '' });
                    setQuery(label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${isSelected ? 'bg-blue-100 text-[#1e3a8a]' : 'text-slate-700 hover:bg-blue-50 hover:text-[#1e3a8a]'}`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
                    <div>
                      <p className="font-extrabold text-slate-900">{fullName}</p>
                      <p className="text-[9px] font-semibold text-slate-500">{emp.department || 'Personel'} {emp.registrationNo ? `· Sicil: ${emp.registrationNo}` : ''}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#1e3a8a]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const AssetStatusBadge = ({ status }: { status: SharedAssetStatus }) => {
  const style = status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : status === 'LOANED' ? 'bg-blue-50 text-blue-800 border-blue-300'
      : status === 'MAINTENANCE' ? 'bg-amber-50 text-amber-800 border-amber-300'
        : 'bg-rose-50 text-rose-800 border-rose-300';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-extrabold whitespace-nowrap ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'AVAILABLE' ? 'bg-emerald-500' : status === 'LOANED' ? 'bg-blue-500' : status === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {statusLabels[status]}
    </span>
  );
};

const ModalShell: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={onClose}>
    <div className={`max-h-[94vh] w-full overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl ${wide ? 'max-w-7xl' : 'max-w-4xl'}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-[#1e3a8a]">{icon}</div>
          <div><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p></div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-white p-1.5 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-200 hover:text-slate-900"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(94vh-86px)] overflow-y-auto p-6">{children}</div>
    </div>
  </div>
);

export const SharedAssetManagementView: React.FC = () => {
  const [overview, setOverview] = useState<SharedAssetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modal, setModal] = useState<ModalState>(null);
  const operationKeyRef = useRef(generateUUID());
  const [history, setHistory] = useState<{ items: SharedAssetLog[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({ search: '', action: '', holderType: '', dateStart: '', dateEnd: '' });
  const historyRequestIdRef = useRef(0);
  const [todayLogs, setTodayLogs] = useState<SharedAssetLog[]>([]);
  const [detailLogs, setDetailLogs] = useState<SharedAssetLog[]>([]);
  const [retireNotes, setRetireNotes] = useState('');
  const [editLogForm, setEditLogForm] = useState({ logId: '', borrowerName: '', notes: '' });
  const [deleteLogTarget, setDeleteLogTarget] = useState({ logId: '', borrowerName: '', assetName: '' });

  const [editLocationText, setEditLocationText] = useState('');
  const [availableStockItems, setAvailableStockItems] = useState<StockItem[]>([]);
  const [createAssetForm, setCreateAssetForm] = useState({
    stockItemId: '',
    assetName: '',
    assetCode: '',
    category: 'ELEKTRİKLİ EV ALETLERİ',
    brandModel: '',
    locationNote: 'ANA DEPO',
    notes: '',
  });

  const [checkOutForm, setCheckOutForm] = useState({
    assetId: '',
    holderType: 'EMPLOYEE' as 'EMPLOYEE' | 'ROOM' | 'OTHER',
    employeeId: '',
    customBorrowerName: '',
    roomId: '',
    expectedReturnDate: '',
    notes: '',
  });

  const [checkInForm, setCheckInForm] = useState({
    locationNote: '',
    notes: '',
    newStatus: 'AVAILABLE' as SharedAssetStatus,
  });

  const [maintForm, setMaintForm] = useState({
    action: 'FAULT_REPORTED' as 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'FAULT_REPORTED' | 'REPAIR_COMPLETED',
    notes: '',
    newStatus: 'MAINTENANCE' as SharedAssetStatus,
  });

  const loadOverview = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      setOverview(await sharedAssetApi.getOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ortak eşya verileri yüklenemedi.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  // WebSocket real-time listener for Shared Assets
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | null = null;
    let isSubscribed = true;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/shared-assets`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'SHARED_ASSET_UPDATED' && isSubscribed) {
              loadOverview();
            }
          } catch {
            // Ignore non-json socket messages
          }
        };

        ws.onclose = () => {
          if (isSubscribed) {
            timer = window.setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // Fallback for offline/unsupported
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      if (timer) window.clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [loadOverview]);

  const loadHistory = useCallback(async (pageToFetch = 1) => {
    const requestId = ++historyRequestIdRef.current;
    try {
      if (pageToFetch === 1) setHistoryLoading(true);
      else setHistoryLoadingMore(true);
      setError(null);
      const result = await sharedAssetApi.getLogs({ ...historyFilters, page: pageToFetch, pageSize: 50 });
      if (requestId !== historyRequestIdRef.current) return;
      setHistory((current) => pageToFetch === 1
        ? result
        : { items: mergeById(current?.items || [], result.items), pagination: result.pagination });
    } catch (caught) {
      if (requestId === historyRequestIdRef.current) setError(caught instanceof Error ? caught.message : 'Ortak eşya geçmişi yüklenemedi.');
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    }
  }, [historyFilters]);

  useEffect(() => {
    if (modal?.type !== 'fullHistory') return;
    historyRequestIdRef.current += 1;
    setHistory(null);
    const timer = window.setTimeout(() => void loadHistory(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadHistory, modal?.type]);

  const historyHasMore = Boolean(history && history.pagination.page < history.pagination.totalPages);
  const loadMoreHistory = () => {
    if (!history || !historyHasMore || historyLoading || historyLoadingMore) return;
    void loadHistory(history.pagination.page + 1);
  };
  const historySentinelRef = useInfiniteScroll({
    hasMore: historyHasMore,
    isLoading: historyLoading || historyLoadingMore,
    onLoadMore: loadMoreHistory,
  });

  // "Bugünün Kayıtları" cihaz durumundan türetilmez. Teslim alma gerçekleşse
  // dahi aynı günün kullanım kaydı burada kalmalıdır.
  useEffect(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    let active = true;
    sharedAssetApi.getAllLogs({ dateStart: today, dateEnd: today })
      .then((items) => { if (active) setTodayLogs(items); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Bugünün kullanım kayıtları yüklenemedi.'); });
    return () => { active = false; };
  }, [overview?.assets]);

  useEffect(() => {
    if (modal?.type !== 'detail') { setDetailLogs([]); return; }
    let active = true;
    sharedAssetApi.getAllLogs({ assetId: modal.asset.id })
      .then((items) => { if (active) setDetailLogs(items); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Eşya geçmişi yüklenemedi.'); });
    return () => { active = false; };
  }, [modal]);

  const registeredLocations = useMemo(() => {
    const fromAssets = (overview?.assets || [])
      .map((item) => item.locationNote)
      .filter((note): note is string => Boolean(note && note.trim()));
    const fromRooms = (overview?.rooms || [])
      .map((r) => `${r.block.name} / Oda ${r.roomNumber}`);
    const defaults = ['ANA DEPO', 'TEKNİK SERVİS DEPOSU', 'KADEMET HİZMET BİNASI'];
    return Array.from(new Set([...defaults, ...fromAssets, ...fromRooms])).sort();
  }, [overview]);

  const loanRecords = useMemo(() => {
    const records: Array<{
      id: string;
      logId?: string;
      asset: SharedAsset;
      borrowerName: string;
      borrowedAt?: string | null;
      returnedAt?: string | null;
      notes?: string | null;
      isCurrentlyLoaned: boolean;
      isCommonRoom: boolean;
      status: SharedAssetStatus;
      locationDisplay: string;
    }> = [];

    const assets = overview?.assets || [];

    assets.forEach((asset) => {
      const isCommonRoom = isCommonFacilityRoom(asset.currentRoom) || (!!asset.locationNote && !['ANA DEPO', 'Ana Depo'].includes(asset.locationNote));
      const locationDisp = asset.currentRoom
        ? `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`
        : asset.locationNote || 'Ana Depo';

      if (asset.status === 'LOANED') {
        const borrower = asset.currentEmployee
          ? `${asset.currentEmployee.firstName} ${asset.currentEmployee.lastName}${asset.currentEmployee.department ? ` (${asset.currentEmployee.department})` : ''}`
          : asset.currentRoom
            ? `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`
            : 'Zimmetli Personel';

        records.push({
          id: asset.id,
          asset,
          borrowerName: borrower,
          borrowedAt: asset.borrowedAt,
          returnedAt: null,
          notes: asset.notes,
          isCurrentlyLoaned: true,
          isCommonRoom,
          status: 'LOANED',
          locationDisplay: locationDisp,
        });
      } else if (asset.status === 'MAINTENANCE') {
        records.push({
          id: asset.id,
          asset,
          borrowerName: '-',
          borrowedAt: null,
          returnedAt: null,
          notes: asset.notes,
          isCurrentlyLoaned: false,
          isCommonRoom: false,
          status: 'MAINTENANCE',
          locationDisplay: locationDisp,
        });
      } else {
        records.push({
          id: asset.id,
          asset,
          borrowerName: '-',
          borrowedAt: null,
          returnedAt: null,
          notes: asset.notes,
          isCurrentlyLoaned: false,
          isCommonRoom,
          status: 'AVAILABLE',
          locationDisplay: locationDisp,
        });
      }
    });

    // Sort: Active loans first (newest borrowedAt), then returned loans (newest returnedAt)
    records.sort((a, b) => {
      if (a.isCurrentlyLoaned !== b.isCurrentlyLoaned) {
        return a.isCurrentlyLoaned ? -1 : 1;
      }
      const timeA = new Date(a.returnedAt || a.borrowedAt || 0).getTime();
      const timeB = new Date(b.returnedAt || b.borrowedAt || 0).getTime();
      return timeB - timeA;
    });

    return records.filter((row) => {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      const textMatches = !q || [
        row.asset.assetName,
        row.asset.assetCode,
        row.asset.category,
        row.asset.brandModel,
        row.locationDisplay,
        row.borrowerName,
      ].some((val) => val?.toLocaleLowerCase('tr-TR').includes(q));

      const catMatches = categoryFilter === 'ALL' || row.asset.category === categoryFilter;
      const statMatches = statusFilter === 'ALL' || (statusFilter === 'LOANED' ? row.isCurrentlyLoaned : row.status === statusFilter);

      return textMatches && catMatches && statMatches;
    });
  }, [overview, search, categoryFilter, statusFilter]);

  const [statusTab, setStatusTab] = useState<'TODAY' | 'LOANED'>('TODAY');
  const [visibleAssetRecordCount, setVisibleAssetRecordCount] = useState(25);

  const { displayRecords, todayCount, loanedCount } = useMemo(() => {
    const assets = overview?.assets || [];
    // CHECK_OUT ve CHECK_IN denetim geçmişinde ayrı hareketlerdir; ancak kullanım
    // ekranında aynı teslim oturumunu tek satır olarak göstermeliyiz. Teslim alma
    // bugün, teslim verme önceki gün yapılmışsa yalnız CHECK_IN kaydı bulunabilir.
    const usageSessions = Array.from(todayLogs
      .filter((log) => log.action === 'CHECK_OUT' || log.action === 'CHECK_IN')
      .reduce((sessions, log) => {
        const sessionStart = log.borrowedAt || log.createdAt;
        const sessionKey = `${log.assetId}:${sessionStart}`;
        const existing = sessions.get(sessionKey);
        if (!existing || log.action === 'CHECK_OUT') sessions.set(sessionKey, log);
        return sessions;
      }, new Map<string, SharedAssetLog>()).values());

    const todayRecords = usageSessions.flatMap((log) => {
      // Geçmiş kaydındaki cihaz özeti sınırlı olabilir. Konum ve anlık durum için
      // her zaman ana cihaz listesindeki güncel kayıt önceliklidir.
      const asset = assets.find((item) => item.id === log.assetId) || log.asset;
      if (!asset) return [];
      const locationDisplay = asset.currentRoom
        ? `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`
        : asset.locationNote || 'Ana Depo';
      const isCurrentlyLoaned = log.action === 'CHECK_OUT' && !log.returnedAt && asset.status === 'LOANED';
      return [{
        id: log.id, logId: log.id, asset, borrowerName: log.borrowerName || '-',
        borrowedAt: log.borrowedAt, returnedAt: log.returnedAt, notes: log.notes,
        isCurrentlyLoaned, isCommonRoom: locationDisplay !== 'ANA DEPO',
        status: (log.statusTo || asset.status) as SharedAssetStatus, locationDisplay,
      }];
    }).filter((row) => {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      const matchesText = !q || [row.asset.assetName, row.asset.assetCode, row.borrowerName, row.locationDisplay]
        .some((value) => value?.toLocaleLowerCase('tr-TR').includes(q));
      return matchesText && (categoryFilter === 'ALL' || row.asset.category === categoryFilter);
    });
    const activeRecords = loanRecords.filter((row) => row.isCurrentlyLoaned);
    return {
      displayRecords: statusTab === 'TODAY' ? todayRecords : activeRecords,
      todayCount: todayRecords.length,
      loanedCount: activeRecords.length,
    };
  }, [overview?.assets, todayLogs, loanRecords, statusTab, search, categoryFilter]);
  useEffect(() => { setVisibleAssetRecordCount(25); }, [displayRecords]);
  const hasMoreAssetRecords = visibleAssetRecordCount < displayRecords.length;
  const loadMoreAssetRecords = () => {
    if (loading || !hasMoreAssetRecords) return;
    setVisibleAssetRecordCount((current) => Math.min(current + 25, displayRecords.length));
  };
  const assetRecordSentinelRef = useInfiniteScroll({ hasMore: hasMoreAssetRecords, isLoading: loading, onLoadMore: loadMoreAssetRecords });

  const runAction = async (action: () => Promise<unknown>, _message: string) => {
    try {
      setBusy(true); setError(null);
      await action();
      setModal(null);
      await loadOverview(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };

  const openCreateAsset = async () => {
    operationKeyRef.current = generateUUID();
    try {
      const items = await stockApi.getStockItems();
      setAvailableStockItems(items.filter((i) => i.isActive && ['ORTAK_EŞYA', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM'].includes(i.itemType || '')));
    } catch {
      // fallback
    }
    setCreateAssetForm({
      stockItemId: '',
      assetName: '',
      assetCode: '',
      category: 'ELEKTRİKLİ EV ALETLERİ',
      brandModel: '',
      locationNote: 'ANA DEPO',
      notes: '',
    });
    setModal({ type: 'createAsset' });
  };

  const openEditLocation = (asset: SharedAsset) => {
    operationKeyRef.current = generateUUID();
    setEditLocationText(asset.locationNote || 'A BLOK ÇAMAŞIRHANE ODASI');
    setModal({ type: 'editLocation', asset });
  };

  const openCheckOut = (asset?: SharedAsset) => {
    operationKeyRef.current = generateUUID();
    setCheckOutForm({
      assetId: asset?.id || '',
      holderType: 'EMPLOYEE',
      employeeId: '',
      customBorrowerName: '',
      roomId: '',
      expectedReturnDate: '',
      notes: '',
    });
    setModal({ type: 'checkOut', asset });
  };

  const openCheckIn = (asset: SharedAsset) => {
    operationKeyRef.current = generateUUID();
    setCheckInForm({
      locationNote: asset.locationNote || '',
      notes: '',
      newStatus: 'AVAILABLE',
    });
    setModal({ type: 'checkIn', asset });
  };

  const openMaintenanceLog = (asset: SharedAsset) => {
    operationKeyRef.current = generateUUID();
    setMaintForm({
      action: asset.status === 'MAINTENANCE' ? 'REPAIR_COMPLETED' : 'FAULT_REPORTED',
      notes: '',
      newStatus: asset.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE',
    });
    setModal({ type: 'maintenanceLog', asset });
  };

  const openRetire = (asset: SharedAsset) => {
    operationKeyRef.current = generateUUID();
    setRetireNotes('');
    setModal({ type: 'retire', asset });
  };

  const [viewMode, setViewMode] = useState<'list' | 'history'>('list');

  const switchViewMode = (nextMode: 'list' | 'history', skipPushState = false) => {
    setViewMode(nextMode);
    if (!skipPushState) {
      const url = managementUrl('shared-assets', nextMode === 'history' ? { subView: 'history' } : {});
      if (nextMode === 'history') {
        window.history.pushState({ tab: 'shared-assets', view: 'asset-history', timestamp: Date.now() }, '', url.toString());
      } else {
        window.history.pushState({ tab: 'shared-assets', view: 'list', timestamp: Date.now() }, '', url.toString());
      }
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (!state || state.view !== 'asset-history') {
        setViewMode('list');
      } else {
        setViewMode('history');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (viewMode === 'history') {
    return <SharedAssetHistoryView assets={overview?.assets || []} onBack={() => {
      if (window.history.state?.view === 'asset-history') {
        window.history.back();
      } else {
        switchViewMode('list');
      }
    }} />;
  }

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden animate-fadeIn">
      {/* Action Header & Compact Status Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Compact Status Tabs matching VisitorManagementView */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setStatusTab('TODAY')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              statusTab === 'TODAY' ? 'bg-[#1e3a8a] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Bugünün Kayıtları ({todayCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('LOANED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              statusTab === 'LOANED' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Kullanımda Olanlar ({loanedCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={() => openCreateAsset()} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-700 px-3 text-[11px] font-extrabold text-white shadow-xs transition-all hover:bg-emerald-800 cursor-pointer">
            <Plus className="h-3.5 w-3.5 text-white" /> + Yeni Ortak Eşya Tanımla
          </button>
          <button type="button" onClick={() => openCheckOut()} className={primaryButton}>
            <Send className="h-3.5 w-3.5 text-white" /> Ödünç Ver / Zimmetle
          </button>
          <button type="button" onClick={() => switchViewMode('history')} className={secondaryButton}>
            <History className="h-3.5 w-3.5 text-blue-700" /> Tüm İşlem Geçmişi
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-xs">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ekipman adı, marka/model, konum veya kime verildiğini ara..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 min-w-[170px] appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
              >
                <option value="ALL">Tüm Kategoriler ({ASSET_CATEGORIES.length})</option>
                {ASSET_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 min-w-[135px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="AVAILABLE">Teslim Alındı (Depoda / Ortak Alanda)</option>
              <option value="LOANED">Zimmetli (Kullanımda)</option>
              <option value="MAINTENANCE">Bakımda / Arızalı</option>
              <option value="RETIRED">Hurda / Kullanım Dışı</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Single Table Container */}
      <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-700 select-none">
                <th className="px-2 py-2.5 border-r border-slate-200 bg-slate-200/60 text-center w-7">#</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Eşya / Makine Adı</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap">Kategori</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap">Durum</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Kime Verildi</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap">Veriliş Tarihi & Saati</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 whitespace-nowrap">Teslim Alınma Tarihi</th>
                <th className="px-2.5 py-2.5 border-r border-slate-200 hidden md:table-cell whitespace-nowrap">Konum / Depo</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center font-bold text-slate-500">Zimmet ve ortak eşya kayıtları yükleniyor...</td></tr>
              ) : displayRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <Boxes className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="font-extrabold text-slate-800">{statusTab === 'TODAY' ? 'Bugün için kullanım kaydı bulunamadı' : 'Aktif kullanım kaydı bulunamadı'}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{statusTab === 'TODAY' ? 'Teslim alınan kullanımlar da bu sekmede gün boyunca görünür.' : 'Müsait cihazlar ortak kullanım cihazı listesinde konumlarıyla izlenir.'}</p>
                  </td>
                </tr>
              ) : (
                displayRecords.slice(0, visibleAssetRecordCount).map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => setModal({ type: 'detail', asset: row.asset })}
                    className={`group transition cursor-pointer hover:bg-blue-100/40 ${row.isCurrentlyLoaned ? 'bg-blue-50/20' : row.status === 'MAINTENANCE' ? 'bg-amber-50/20' : idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                  >
                    <td className="px-2 py-2 border-r border-slate-200 text-center text-[10px] font-extrabold text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      <span className="font-black text-slate-900 group-hover:text-[#1e3a8a] text-left block">
                        {row.asset.assetName}
                      </span>
                      {row.asset.brandModel && <span className="text-[9px] text-slate-500 font-semibold">{row.asset.brandModel}</span>}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-extrabold text-slate-600 whitespace-nowrap">
                      {row.asset.category}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 whitespace-nowrap">
                      {row.isCurrentlyLoaned ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-900 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Kullanımda
                        </span>
                      ) : row.returnedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Teslim Alındı
                        </span>
                      ) : row.isCommonRoom ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-900 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Ortak Alanda
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Depoda Müsait
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-800">
                      {(row.isCurrentlyLoaned || row.returnedAt) && row.borrowerName !== '-' ? (
                        <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          {row.borrowerName}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                      {(row.isCurrentlyLoaned || row.returnedAt) && row.borrowedAt ? (
                        formatDateTime(row.borrowedAt)
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                      {row.returnedAt ? (
                        formatDateTime(row.returnedAt)
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-extrabold text-slate-800 truncate max-w-[160px] hidden md:table-cell" title={row.locationDisplay}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{row.locationDisplay}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditLocation(row.asset);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-700 transition cursor-pointer"
                          title="Fiziksel Konumu Güncelle"
                        >
                          <Pencil className="w-3 h-3 text-[#1e3a8a]" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1.5 items-center justify-end">
                        {row.isCurrentlyLoaned ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCheckIn(row.asset); }}
                            className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600`}
                            title="Teslim Al / Depoya İade Et"
                          >
                            <RotateCcw className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                            <span className={labelBase}>Teslim Al</span>
                          </button>
                        ) : row.returnedAt && row.logId ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditLogForm({ logId: row.logId!, borrowerName: row.borrowerName, notes: row.notes || '' });
                                setModal({ type: 'editLog' });
                              }}
                              className={`${buttonBase} border-slate-300 bg-slate-50 text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600`}
                              title="Kaydı Düzenle"
                            >
                              <Pencil className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Düzenle</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteLogTarget({ logId: row.logId!, borrowerName: row.borrowerName, assetName: row.asset.assetName });
                                setModal({ type: 'deleteLog' });
                              }}
                              className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600`}
                              title="Kaydı Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Sil</span>
                            </button>
                          </>
                        ) : row.status === 'MAINTENANCE' ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openMaintenanceLog(row.asset); }}
                            className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white hover:border-amber-600`}
                            title="Bakımı Tamamla"
                          >
                            <Wrench className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                            <span className={labelBase}>Bakım Tamamla</span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div ref={assetRecordSentinelRef} role="status" aria-live="polite" className="flex min-h-12 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600">
          <span>{Math.min(visibleAssetRecordCount, displayRecords.length)} / {displayRecords.length} güncel backend kaydı gösteriliyor</span>
          {hasMoreAssetRecords ? <button type="button" onClick={loadMoreAssetRecords} className={secondaryButton}>Daha fazla cihaz göster</button> : displayRecords.length > 0 ? <span>Tüm cihaz kayıtları gösteriliyor.</span> : null}
        </div>
      </div>

      {/* Modal: Create New Shared Asset */}
      {modal?.type === 'createAsset' && (
        <ModalShell onClose={() => setModal(null)} icon={<Plus className="h-4 w-4 text-emerald-600" />} title="Yeni Ortak Eşya / Cihaz Kaydı Tanımla" subtitle="Depodaki stok kartına bağlı yeni bir ortak kullanım cihazı (çamaşır makinesi, süpürge, matkap vb.) tanımlayın.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!createAssetForm.stockItemId) {
                setError('Lütfen bağlı olduğu depodaki stok kartını seçin.');
                return;
              }
              runAction(
                () => sharedAssetApi.createAsset(createAssetForm, operationKeyRef.current),
                'Yeni ortak eşya başarıyla eklendi.'
              );
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-[11px] font-semibold text-emerald-950 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Ortak Eşya Tanımlama Kılavuzu:</span>
                Önce depoda kayıtlı olan stok kartını seçin. Cihazın ismi, kategorisi ve kodu otomatik doldurulacaktır. İsterseniz marka/model bilgisini özelleştirebilirsiniz.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Bağlı Depo Stok Kartı *</span>
                <select
                  required
                  className={inputClass}
                  value={createAssetForm.stockItemId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const found = availableStockItems.find((s) => s.id === selectedId);
                    setCreateAssetForm({
                      ...createAssetForm,
                      stockItemId: selectedId,
                      assetCode: '',
                      ...(found && {
                        assetName: found.itemName,
                        category: found.category || 'ELEKTRİKLİ EV ALETLERİ',
                        brandModel: found.specifications || '',
                        locationNote: found.locationNote || 'ANA DEPO',
                      }),
                    });
                  }}
                >
                  <option value="">Depodaki Stok Kartını Seçin (Örn: Çamaşır Makinesi, Elektrikli Süpürge...)</option>
                  {availableStockItems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.itemName} ({s.category}) · Stok Kodu: {s.itemCode || 'Yok'} · Toplam Stok: {s.totalStock} {s.unit} {s.itemType === 'ORTAK_EŞYA' ? ' (★ Ortak Kullanım Eşyası)' : ''}
                    </option>
                  ))}
                </select>
                {availableStockItems.length === 0 && (
                  <p className="mt-1 text-[10px] font-bold text-amber-700">
                    ⚠️ Depoda henüz "Ortak Eşya" tipinde stok kartı bulunamadı. Önce Depo Yönetimi sayfasından ortak kullanım cihazı stoğu açabilirsiniz.
                  </p>
                )}
              </label>

              {createAssetForm.stockItemId && (
                <div className="sm:col-span-2 p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700">
                  <div>
                    <span className="font-extrabold text-blue-950 block">📦 Stok Kartından Otomatik Alınan Bilgiler</span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      Kategori: <b className="text-slate-800">{createAssetForm.category}</b> · Marka/Model: <b className="text-slate-800">{createAssetForm.brandModel || 'Belirtilmedi'}</b> · Cihaz kodu: <b className="text-slate-800">Her cihaz için otomatik oluşturulur</b>
                    </span>
                  </div>
                  <span className="bg-blue-100 text-blue-900 font-extrabold text-[10px] px-2.5 py-1 rounded-md border border-blue-300 whitespace-nowrap">
                    Stok Kartına Bağlı
                  </span>
                </div>
              )}

              <label className="sm:col-span-2">
                <span className={labelClass}>Ortak Eşya / Cihaz Etiketi veya Adı *</span>
                <input
                  required
                  className={inputClass}
                  value={createAssetForm.assetName}
                  onChange={(e) => setCreateAssetForm({ ...createAssetForm, assetName: e.target.value })}
                  placeholder="Örn: Kadın Çamaşır Makinesi, Ortak Elektrikli Süpürge..."
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !createAssetForm.stockItemId || !createAssetForm.assetName.trim()} type="submit" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-700 px-3 text-[11px] font-extrabold text-white shadow-xs transition-all hover:bg-emerald-800 disabled:opacity-50">
                {busy ? 'Kaydediliyor...' : 'Ortak Eşyayı Tanımla ve Kaydet'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Edit Location */}
      {modal?.type === 'editLocation' && (
        <ModalShell onClose={() => setModal(null)} icon={<MapPin className="h-4 w-4 text-[#1e3a8a]" />} title="Fiziksel Konumu Güncelle" subtitle={modal.asset.assetName}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editLocationText.trim()) return;
              runAction(
                () => sharedAssetApi.updateStatus(modal.asset.id, { status: modal.asset.status, locationNote: editLocationText.trim() }, operationKeyRef.current),
                'Konum başarıyla güncellendi.'
              );
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-[11px] font-semibold text-blue-950">
              💡 Cihazın durduğu fiziksel mekanı veya bulunduğu odayı (örn: A BLOK ÇAMAŞIRHANE ODASI) güncelleyin.
            </div>
            <div>
              <span className={labelClass}>Fiziksel Konum / Bulunduğu Mekan *</span>
              <CustomLocationSelector
                value={editLocationText}
                onChange={(val) => setEditLocationText(val)}
                options={registeredLocations}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !editLocationText.trim()} type="submit" className={primaryButton}>
                {busy ? 'Güncelleniyor...' : 'Konumu Güncelle ve Kaydet'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Check Out / Loan Asset */}
      {modal?.type === 'checkOut' && (
        <ModalShell onClose={() => setModal(null)} icon={<Send className="h-4 w-4" />} title="Ortak Ekipmanı Ödünç Ver / Zimmetle" subtitle="Teslim edilecek odada konaklayan personeli seçin veya teslim alan kişinin adını yazın.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!checkOutForm.assetId) return;
              const hasEmployee = Boolean(checkOutForm.employeeId);
              const customName = checkOutForm.customBorrowerName.trim();
              if (!hasEmployee && !customName) {
                setError('Lütfen listeden odada konaklayan bir personel seçin veya teslim alan kişinin adını yazın.');
                return;
              }
              const finalHolderType: 'EMPLOYEE' | 'OTHER' = hasEmployee ? 'EMPLOYEE' : 'OTHER';
              const payload = {
                holderType: finalHolderType,
                employeeId: hasEmployee ? checkOutForm.employeeId : undefined,
                customBorrowerName: !hasEmployee ? customName : undefined,
                notes: checkOutForm.notes ? checkOutForm.notes.trim() : undefined,
              };
              runAction(
                () => sharedAssetApi.checkOutAsset(checkOutForm.assetId, payload, operationKeyRef.current),
                'Ekipman ödünç verildi.'
              );
            }}
            className="space-y-5"
          >
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-semibold leading-5 text-blue-950">
              Ortak eşya yalnızca odalarda aktif olarak konaklayan personellere zimmetlenebilir. Listede bulunmayan kişiler için ismi elle yazabilirsiniz.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Zimmetlenecek Ortak Eşya *</span>
                <select required disabled={Boolean(modal.asset)} className={inputClass} value={checkOutForm.assetId} onChange={(e) => setCheckOutForm({ ...checkOutForm, assetId: e.target.value })}>
                  <option value="">Ekipman seçin</option>
                  {(overview?.assets || []).filter((a) => a.status === 'AVAILABLE' || (a.status === 'LOANED' && isCommonFacilityRoom(a.currentRoom))).map((a) => {
                    const loc = a.currentRoom ? `${a.currentRoom.block.name} / Oda ${a.currentRoom.roomNumber}` : a.locationNote || 'Ana Depo';
                    return (
                      <option key={a.id} value={a.id}>{a.assetName} ({a.category}) · Konum: {loc}</option>
                    );
                  })}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Teslim Alan Personel / Kişi *</span>
                <CustomEmployeeSelector
                  employees={overview?.employees || []}
                  selectedEmployeeId={checkOutForm.employeeId}
                  customName={checkOutForm.customBorrowerName}
                  onChange={({ employeeId, customBorrowerName }) =>
                    setCheckOutForm({ ...checkOutForm, employeeId, customBorrowerName })
                  }
                />
                <span className="block text-[11px] font-semibold text-slate-500 mt-1">
                  Listeden odada konaklayan personeli seçebilir veya listede yoksa ismi doğrudan yazabilirsiniz.
                </span>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Teslim / Kullanım Açıklaması</span>
                <textarea rows={3} maxLength={1000} className={`${inputClass} h-auto py-3`} value={checkOutForm.notes} onChange={(e) => setCheckOutForm({ ...checkOutForm, notes: e.target.value })} placeholder="Kullanım amacı, teslimdeki fiziksel durum ve varsa aksesuarları yazın (İsteğe bağlı)." />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button
                disabled={busy || !checkOutForm.assetId || (!checkOutForm.employeeId && !checkOutForm.customBorrowerName.trim())}
                type="submit"
                className={primaryButton}
              >
                {busy ? 'İşleniyor...' : 'Zimmeti Onayla'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Check In / Return Asset */}
      {modal?.type === 'checkIn' && (
        <ModalShell onClose={() => setModal(null)} icon={<RotateCcw className="h-4 w-4" />} title="Ortak Ekipmanı Teslim Al / Depoya İade Et" subtitle={modal.asset.assetName}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.checkInAsset(modal.asset.id, checkInForm, operationKeyRef.current), 'Ekipman teslim alındı.'); }} className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-[10px] font-bold text-blue-900">
              💡 Ekipmanın sağlam veya bozuk/arızalı teslim alınıp alınmadığını seçin.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Fiziksel Kontrol / Teslim Durumu *</span>
                <select className={inputClass} value={checkInForm.newStatus} onChange={(e) => setCheckInForm({ ...checkInForm, newStatus: e.target.value as SharedAssetStatus })}>
                  <option value="AVAILABLE">✅ SAĞLAM TESLİM ALINDI — (Müsait / Depoya Koy)</option>
                  <option value="MAINTENANCE">⚠️ BOZUK / ARIZALI TESLİM ALINDI</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Teslim Açıklaması / Fiziksel Kontrol Notu <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span></span>
                <textarea maxLength={1000} rows={3} className={`${inputClass} h-auto py-3`} value={checkInForm.notes} onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })} placeholder="Varsa teslimdeki fiziksel durum, eksik aksesuarlar ve yapılan kontrolü yazabilirsiniz (İsteğe bağlı)..." />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy} type="submit" className={primaryButton}>{busy ? 'İşleniyor...' : 'Teslim Almayı Onayla'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Add Maintenance / Fault Record */}
      {modal?.type === 'maintenanceLog' && (
        <ModalShell onClose={() => setModal(null)} icon={<Wrench className="h-4 w-4" />} title="Bakım / Arıza Kaydı Oluştur" subtitle={modal.asset.assetName}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.addMaintenanceLog(modal.asset.id, { action: maintForm.action, notes: maintForm.notes }, operationKeyRef.current), 'Bakım kaydı eklendi.'); }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>İşlem Tipi *</span>
                <select required className={inputClass} value={maintForm.action} onChange={(e) => {
                  const act = e.target.value as any;
                  const newStat = act === 'REPAIR_COMPLETED' || act === 'MAINTENANCE_END' ? 'AVAILABLE' : 'MAINTENANCE';
                  setMaintForm({ ...maintForm, action: act, newStatus: newStat });
                }}>
                  <option value="FAULT_REPORTED">Arıza Bildirimi (Bozuk / Arızalı)</option>
                  <option value="MAINTENANCE_START">Periyodik Bakıma Alındı</option>
                  <option value="REPAIR_COMPLETED">Tamir / Onarım Tamamlandı (Sağlam - Müsait Yap)</option>
                  <option value="MAINTENANCE_END">Bakım Tamamlandı (Sağlam - Müsait Yap)</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Arıza Notu *</span>
                <textarea required minLength={5} maxLength={1000} rows={4} className={`${inputClass} h-auto py-3`} value={maintForm.notes} onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })} placeholder="Arızanın belirtisini ve yönetim notunu açıklayın." />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !maintForm.notes.trim()} type="submit" className={primaryButton}>{busy ? 'Kaydedildiği...' : 'Bakım Kaydını İşle'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Asset Detail */}
      {modal?.type === 'detail' && (
        <ModalShell wide onClose={() => setModal(null)} icon={<Eye className="h-4 w-4" />} title="Ortak Ekipman Detayı ve Geçmişi" subtitle={modal.asset.assetName}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h4 className="text-lg font-black text-slate-900">{modal.asset.assetName}</h4>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-600">{modal.asset.category} · Marka/Model: <span className="font-bold text-slate-800">{modal.asset.brandModel || 'Belirtilmemiş'}</span></p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">Konum:</span>
                  <span className="text-[10px] font-extrabold text-slate-800 bg-white border px-2 py-0.5 rounded">{modal.asset.locationNote || 'Ana Depo'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AssetStatusBadge status={modal.asset.status} />
                {modal.asset.status === 'LOANED' && (
                  <button onClick={() => openCheckIn(modal.asset)} className={primaryButton}><RotateCcw className="h-3.5 w-3.5" /> Teslim Al</button>
                )}
                {modal.asset.status === 'AVAILABLE' && (
                  <button onClick={() => openCheckOut(modal.asset)} className={primaryButton}><Send className="h-3.5 w-3.5" /> Ödünç Ver</button>
                )}
                <button onClick={() => openMaintenanceLog(modal.asset)} className={secondaryButton}><Wrench className="h-3.5 w-3.5 text-amber-600" /> Bakım / Arıza</button>
                {modal.asset.status === 'AVAILABLE' && <button onClick={() => openRetire(modal.asset)} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 text-[11px] font-extrabold text-rose-800 hover:bg-rose-100"><Archive className="h-3.5 w-3.5" /> Hurdaya Ayır</button>}
              </div>
            </div>

            {modal.asset.status === 'LOANED' && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-900">
                <p className="font-black text-sm">Aktif Zimmet Bilgisi</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div><span className="text-[10px] uppercase font-bold text-blue-700">Kullanıcı:</span><p className="text-slate-900">{modal.asset.currentEmployee ? `${modal.asset.currentEmployee.firstName} ${modal.asset.currentEmployee.lastName}` : modal.asset.currentRoom ? `${modal.asset.currentRoom.block.name} / Oda ${modal.asset.currentRoom.roomNumber}` : '-'}</p></div>
                  <div><span className="text-[10px] uppercase font-bold text-blue-700">Veriliş Tarihi:</span><p className="text-slate-900">{formatDateTime(modal.asset.borrowedAt)}</p></div>
                  <div><span className="text-[10px] uppercase font-bold text-blue-700">Tahmini İade:</span><p className="text-slate-900">{formatDateOnly(modal.asset.expectedReturnDate)}</p></div>
                </div>
              </div>
            )}

            <div>
              <h5 className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-800"><History className="h-4 w-4 text-blue-700" /> Ödünç & Bakım Geçmişi ({detailLogs.length})</h5>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                {detailLogs.length === 0 ? (
                  <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Henüz hareket kaydı yok.</p>
                ) : (
                  detailLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-0 hover:bg-slate-50">
                      <div>
                        <p className="text-[11px] font-extrabold text-slate-900">
                          {log.action === 'CHECK_OUT' ? 'Ödünç Verildi' : log.action === 'CHECK_IN' ? 'Teslim Alındı' : log.action === 'FAULT_REPORTED' ? 'Arıza Bildirildi' : log.action === 'REPAIR_COMPLETED' ? 'Tamir Edildi' : 'Durum Güncellendi'}
                          {log.borrowerName ? <span className="text-blue-900"> · {log.borrowerName}</span> : null}
                        </p>
                        <p className="text-[9px] font-semibold text-slate-500">{formatDateTime(log.createdAt)} · Yetkili: {log.createdBy?.fullName || 'Sistem'}</p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 max-w-[240px] truncate" title={log.notes || ''}>{log.notes || '-'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {modal?.type === 'retire' && (
        <ModalShell onClose={() => setModal(null)} icon={<Archive className="h-4 w-4" />} title="Ortak Eşyayı Hurdaya Ayır" subtitle={modal.asset.assetName}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.updateStatus(modal.asset.id, { status: 'RETIRED', notes: retireNotes }, operationKeyRef.current), 'Ortak eşya hurdaya ayrıldı.'); }} className="space-y-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-950">
              Bu işlem geri alınamaz. Eşya kullanım dışına çıkarılır, bağlı stok toplamı 1 adet azaltılır ve kalıcı hurda hareketi oluşturulur. Zimmetli eşya önce teslim alınmalıdır.
            </div>
            <label><span className={labelClass}>Hurda / Kullanım Dışı Gerekçesi *</span><textarea required minLength={5} maxLength={1000} rows={5} className={`${inputClass} h-auto py-3`} value={retireNotes} onChange={(e) => setRetireNotes(e.target.value)} placeholder="Arıza, ekonomik ömür, kayıp parça ve onarım değerlendirmesini açıklayın." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || retireNotes.trim().length < 5} type="submit" className="inline-flex h-9 items-center rounded-xl bg-rose-700 px-4 text-xs font-extrabold text-white disabled:opacity-50">{busy ? 'İşleniyor...' : 'Hurdaya Ayırmayı Onayla'}</button></div>
          </form>
        </ModalShell>
      )}

      {modal?.type === 'editLog' && (
        <ModalShell onClose={() => setModal(null)} icon={<Pencil className="h-4 w-4" />} title="İşlem Kaydını Düzenle" subtitle="Tamamlanan veya kaydedilen zimmet hareketini güncelleyin.">
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.updateLog(editLogForm.logId, { borrowerName: editLogForm.borrowerName, notes: editLogForm.notes }), 'İşlem kaydı güncellendi.'); }} className="space-y-4">
            <label className="block">
              <span className={labelClass}>Teslim Alan Personel / Zimmet Sahibi *</span>
              <input required className={inputClass} value={editLogForm.borrowerName} onChange={(e) => setEditLogForm({ ...editLogForm, borrowerName: e.target.value })} placeholder="Teslim alan kişinin adı" />
            </label>
            <label className="block">
              <span className={labelClass}>İşlem Notu / Açıklama</span>
              <textarea rows={3} maxLength={1000} className={`${inputClass} h-auto py-3`} value={editLogForm.notes} onChange={(e) => setEditLogForm({ ...editLogForm, notes: e.target.value })} placeholder="Varsa fiziki durum veya ek açıklamaları yazın..." />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !editLogForm.borrowerName.trim()} type="submit" className={primaryButton}>{busy ? 'İşleniyor...' : 'Güncellemeyi Kaydet'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal?.type === 'deleteLog' && (
        <ModalShell onClose={() => setModal(null)} icon={<Trash2 className="h-4 w-4" />} title="İşlem Kaydını Sil" subtitle={deleteLogTarget.assetName}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.deleteLog(deleteLogTarget.logId), 'İşlem kaydı silindi.'); }} className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold leading-6 text-rose-950">
              ⚠️ <span className="font-black text-rose-900">{deleteLogTarget.borrowerName}</span> adına ait bu işlem kaydını silmek istediğinizden emin misiniz? Bu işlem listeden kalıcı olarak kaldırılacaktır.
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy} type="submit" className="inline-flex h-9 items-center rounded-xl bg-rose-700 px-4 text-xs font-extrabold text-white disabled:opacity-50 hover:bg-rose-800 transition cursor-pointer">{busy ? 'İşleniyor...' : 'Evet, Kaydı Sil'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {modal?.type === 'fullHistory' && (
        <ModalShell wide onClose={() => setModal(null)} icon={<History className="h-4 w-4" />} title="Tüm Ortak Ekipman İşlem Geçmişi" subtitle="Filtreleri kullanarak geçmiş tüm iade, zimmet, arıza ve bakım hareketlerini sorgulayabilirsiniz.">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-500">
                Veritabanındaki toplam kayıt sayısı: <span className="font-extrabold text-slate-900">{history?.pagination.total || 0}</span>
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <input className={inputClass} value={historyFilters.search} onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })} placeholder="Kod, eşya, kişi, oda veya not ara..." />
              <select className={inputClass} value={historyFilters.action} onChange={(e) => setHistoryFilters({ ...historyFilters, action: e.target.value })}>
                <option value="">Tüm işlem türleri</option>
                <option value="CHECK_OUT">Zimmet / Teslim</option>
                <option value="CHECK_IN">İade</option>
                <option value="FAULT_REPORTED">Arıza</option>
                <option value="MAINTENANCE_START">Bakım başlangıcı</option>
                <option value="REPAIR_COMPLETED">Onarım</option>
                <option value="MAINTENANCE_END">Bakım bitişi</option>
                <option value="STATUS_CHANGE">Durum değişikliği</option>
              </select>
              <select className={inputClass} value={historyFilters.holderType} onChange={(e) => setHistoryFilters({ ...historyFilters, holderType: e.target.value })}>
                <option value="">Tüm zimmet hedefleri</option>
                <option value="EMPLOYEE">Personel</option>
                <option value="ROOM">Oda</option>
                <option value="OTHER">Harici kişi/kurum</option>
              </select>
              <input type="date" className={inputClass} value={historyFilters.dateStart} onChange={(e) => setHistoryFilters({ ...historyFilters, dateStart: e.target.value })} />
              <input type="date" className={inputClass} value={historyFilters.dateEnd} onChange={(e) => setHistoryFilters({ ...historyFilters, dateEnd: e.target.value })} />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Eşya</th>
                    <th className="px-4 py-3">İşlem</th>
                    <th className="px-4 py-3">Hedef</th>
                    <th className="px-4 py-3">Açıklama</th>
                    <th className="px-4 py-3">Yetkili</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <tr><td colSpan={6} className="p-6 text-center font-bold text-slate-500">Geçmiş yükleniyor...</td></tr>
                  ) : !history?.items.length ? (
                    <tr><td colSpan={6} className="p-6 text-center font-bold text-slate-500">Filtrelere uygun hareket bulunamadı.</td></tr>
                  ) : (
                    history.items.map((log) => (
                      <tr key={log.id} className="hover:bg-blue-50/40">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3"><p className="font-black text-slate-900">{log.assetNameSnapshot}</p><p className="text-[9px] font-mono text-slate-500">{log.assetCodeSnapshot}</p></td>
                        <td className="px-4 py-3 font-extrabold text-blue-900">{logActionLabel(log.action)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{log.borrowerName || '-'}</td>
                        <td className="max-w-[320px] px-4 py-3 text-slate-600"><span className="line-clamp-2" title={log.notes || ''}>{log.notes || '-'}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{log.createdBy?.fullName || 'Sistem'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {history && (
              <div ref={historySentinelRef} role="status" aria-live="polite" className="flex min-h-12 items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs font-bold text-slate-600">
                <span>{history.items.length} / {history.pagination.total} kayıt backend üzerinden yüklendi</span>
                {historyLoadingMore ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Daha fazla geçmiş yükleniyor...</span> : historyHasMore ? <button type="button" className={secondaryButton} onClick={loadMoreHistory}>Daha fazla yükle</button> : history.items.length > 0 ? <span>Tüm güncel kayıtlar yüklendi.</span> : null}
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
};
