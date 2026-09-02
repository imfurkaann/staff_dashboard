import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowRightLeft, Building2, Check, ChevronDown,
  ChevronRight, ClipboardCheck, Download, Edit3, Filter, History, MapPin, Package,
  Plus, RefreshCw, RotateCcw, Search, Send, X,
  FileText, BarChart3, LayoutGrid, List, ShieldCheck
} from 'lucide-react';
import { AssignmentStatus, DeviceHistory, MovementType, RoomAssignment, StockItem, StockMovement, StockMovementList, StockOverview, stockApi } from '../api/stockApi';
import { employeeApi } from '../api/employeeApi';
import { User } from '../api/authApi';
import { can } from '../security/accessControl';
import { generateUUID } from '../utils/cryptoHelpers';

type MainTab = 'quick' | 'stock' | 'rooms' | 'personnel' | 'movements';
type ModalState =
  | { type: 'create' }
  | { type: 'edit'; item: StockItem }
  | { type: 'receive'; item: StockItem }
  | { type: 'count'; item: StockItem }
  | { type: 'assign'; item?: StockItem }
  | { type: 'detail'; item: StockItem }
  | { type: 'assignment'; assignment: RoomAssignment; item: StockItem }
  | null;

const statusLabels: Record<AssignmentStatus, string> = {
  HEALTHY: 'Sağlam / Kullanımda',
  MAINTENANCE_REQUIRED: 'Bakım Bekliyor',
  DAMAGED: 'Kırık / Hasarlı',
  LOST: 'Kayıp / Zayi',
  IN_SERVICE: 'Serviste / Tamirde',
  REPLACEMENT_REQUIRED: 'Değişim Bekliyor',
  RETIRED: 'İade / Düşüm',
};

const movementLabels: Record<string, string> = {
  OPENING: 'Açılış Stoku', RECEIPT: 'Depo Girişi', ADJUSTMENT: 'Sayım Düzeltme',
  ROOM_ASSIGNMENT: 'Odaya Zimmet', ROOM_RETURN: 'Odadan İade', ROOM_TRANSFER: 'Oda Transferi',
  STATUS_CHANGE: 'Durum Güncelleme', REPLACEMENT: 'Ürün Değişimi', RETIREMENT: 'Hurda / Kayıp Düşümü',
  PERSONNEL_ASSIGNMENT: 'Personele Zimmet', PERSONNEL_RETURN: 'Personelden İade',
};

const STOCK_CATEGORIES = [
  'GENEL',
  'ODA DEMİRBAŞI',
  'MOBİLYA',
  'YATAK & BAZA',
  'TEKSTİL & MEFRUŞAT',
  'ELEKTRONİK',
  'BEYAZ EŞYA',
  'ISITMA & SOĞUTMA',
  'AYDINLATMA & ELEKTRİK',
  'MUTFAK & YEMEKHANE',
  'BANYO & SIHHİ TESİSAT',
  'TEMİZLİK MALZEMESİ',
  'SARF MALZEMESİ',
  'TEKNİK BAKIM & YEDEK PARÇA',
  'ANAHTAR, KİLİT & GÜVENLİK',
  'İŞ SAĞLIĞI & GÜVENLİĞİ',
  'YANGIN & ACİL DURUM',
  'KIRTASİYE',
  'BAHÇE & PEYZAJ',
  'DİĞER',
] as const;

const formatDateTime = (value: string) => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul',
}).format(new Date(value));

const formatDateOnly = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium', timeZone: 'Europe/Istanbul',
}).format(new Date(value)) : '-';

const roomName = (assignment: RoomAssignment) => `${assignment.room.block.name} / Oda ${assignment.room.roomNumber}`;
const stockLocations = (item: StockItem) => {
  const roomQuantities = item.roomInventories.reduce((locations, assignment) => {
    const name = roomName(assignment);
    locations.set(name, (locations.get(name) || 0) + assignment.quantity);
    return locations;
  }, new Map<string, number>());
  const rooms = Array.from(roomQuantities, ([name, quantity]) => `${name}: ${quantity} ${item.unit}`);
  const parts = [...(item.availableStock > 0 ? [`Ana Depo: ${item.availableStock} ${item.unit}`] : []), ...rooms];
  return parts.length > 0 ? parts.join(' • ') : 'Stokta / zimmette ürün yok';
};
const hasOpenMaintenance = (assignment: RoomAssignment) => Boolean(assignment.maintenances?.some((record) => record.status === 'OPEN' || record.status === 'IN_PROGRESS'));

const inputClass = 'w-full min-h-10 px-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-1 focus:ring-blue-100 outline-none text-xs font-semibold text-slate-900 transition placeholder:text-slate-400';
const labelClass = 'block mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-700';
const primaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#1e3a8a] bg-[#1e3a8a] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
const secondaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 cursor-pointer';

// Clean Enterprise Status Badges (Monochrome Dot Indicators, No Emojis)
const StatusBadge = ({ status }: { status: AssignmentStatus }) => {
  const isHealthy = status === 'HEALTHY';
  const isWarning = ['MAINTENANCE_REQUIRED', 'REPLACEMENT_REQUIRED', 'IN_SERVICE'].includes(status);
  const color = isHealthy ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : isWarning ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-rose-50 text-rose-800 border-rose-200';
  const dotColor = isHealthy ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500';
  
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {statusLabels[status]}
    </span>
  );
};

const PhysicalStatusPill = ({ status }: { status?: string }) => {
  const st = status || 'KULLANILABİLİR';
  const isAvailable = st === 'KULLANILABİLİR';
  const isMaintenance = st === 'BAKIMDA';
  const style = isAvailable ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : st === 'KULLANIMDA' ? 'bg-blue-50 text-blue-800 border-blue-200'
    : isMaintenance ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-rose-50 text-rose-800 border-rose-200';
  const dotColor = isAvailable ? 'bg-emerald-500' : isMaintenance ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {st}
    </span>
  );
};

const ModalShell: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fadeIn" onMouseDown={onClose}>
    <div className={`max-h-[92vh] w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl ${wide ? 'max-w-6xl' : 'max-w-3xl'}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#1e3a8a] shadow-2xs">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-[11px] font-medium text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(90vh-60px)] overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

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
          placeholder="Konum arayın veya seçin..."
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[300] mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1 shadow-lg animate-fadeIn">
          {filtered.length === 0 ? (
            <div className="p-2.5 text-center text-[11px] font-medium text-slate-500">Eşleşen konum bulunamadı.</div>
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
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition cursor-pointer ${isSelected ? 'bg-blue-50 text-[#1e3a8a]' : 'text-slate-700 hover:bg-slate-100'}`}
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

const SearchableRoomSelect: React.FC<{
  value: string;
  onChange: (roomId: string) => void;
  rooms: Array<{ id: string; roomNumber: string; block: { name: string } }>;
}> = ({ value, onChange, rooms }) => {
  const [open, setOpen] = useState(false);
  const selectedRoom = rooms.find((r) => r.id === value);
  const [query, setQuery] = useState(selectedRoom ? `${selectedRoom.block.name} · Oda ${selectedRoom.roomNumber}` : '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const matched = rooms.find((r) => r.id === value);
    setQuery(matched ? `${matched.block.name} · Oda ${matched.roomNumber}` : '');
  }, [value, rooms]);

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
    if (!q) return rooms;
    return rooms.filter((r) =>
      `${r.block.name} oda ${r.roomNumber}`.toLocaleLowerCase('tr-TR').includes(q) ||
      r.roomNumber.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [rooms, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className={`${inputClass} pl-9 pr-8`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) onChange('');
            setOpen(true);
          }}
          placeholder="Oda no veya blok ara (Örn: A-101, Oda 204)..."
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[300] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1 shadow-xl animate-fadeIn">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs font-semibold text-slate-500">Aramanıza uygun oda bulunamadı.</div>
          ) : (
            filtered.map((room) => {
              const label = `${room.block.name} · Oda ${room.roomNumber}`;
              const isSelected = value === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    onChange(room.id);
                    setQuery(label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition cursor-pointer ${
                    isSelected ? 'bg-blue-50 text-[#1e3a8a]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
                    <span>{label}</span>
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

const SearchableEmployeeSelect: React.FC<{
  value: string;
  onChange: (empId: string) => void;
  employees: Array<{ id: string; firstName: string; lastName: string; registrationNo?: string; department: string }>;
}> = ({ value, onChange, employees }) => {
  const [open, setOpen] = useState(false);
  const selectedEmp = employees.find((e) => e.id === value);
  const [query, setQuery] = useState(selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}${selectedEmp.registrationNo ? ` (${selectedEmp.registrationNo})` : ''}` : '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const matched = employees.find((e) => e.id === value);
    setQuery(matched ? `${matched.firstName} ${matched.lastName}${matched.registrationNo ? ` (${matched.registrationNo})` : ''}` : '');
  }, [value, employees]);

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
    if (!q) return employees;
    return employees.filter((emp) =>
      `${emp.firstName} ${emp.lastName} ${emp.registrationNo || ''} ${emp.department}`.toLocaleLowerCase('tr-TR').includes(q)
    );
  }, [employees, query]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <ClipboardCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className={`${inputClass} pl-9 pr-8`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) onChange('');
            setOpen(true);
          }}
          placeholder="Personel adı, sicil no veya departman yazın..."
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-[300] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1 shadow-xl animate-fadeIn">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs font-semibold text-slate-500">Aramanıza uygun personel bulunamadı.</div>
          ) : (
            filtered.map((emp) => {
              const label = `${emp.firstName} ${emp.lastName}${emp.registrationNo ? ` (${emp.registrationNo})` : ''} · ${emp.department}`;
              const isSelected = value === emp.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onChange(emp.id);
                    setQuery(`${emp.firstName} ${emp.lastName}${emp.registrationNo ? ` (${emp.registrationNo})` : ''}`);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition cursor-pointer ${
                    isSelected ? 'bg-blue-50 text-[#1e3a8a]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-[#1e3a8a] shrink-0" />
                    <span>{label}</span>
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

export const WarehouseManagementView: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const canManageStock = can(currentUser.role, 'STOCK_MANAGE');
  const canManageLifecycle = can(currentUser.role, 'STOCK_DEVICE_LIFECYCLE');
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [tab, setTab] = useState<MainTab>('quick');
  const [modal, setModal] = useState<ModalState>(null);
  const operationKeyRef = useRef('');

  // Enterprise UI States
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [passportModal, setPassportModal] = useState<StockItem | null>(null);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState(false);

  const [movementType, setMovementType] = useState<MovementType | 'ALL'>('ALL');
  const [movementDateStart, setMovementDateStart] = useState('');
  const [movementDateEnd, setMovementDateEnd] = useState('');
  const [movementStockItemId, setMovementStockItemId] = useState('');
  const [movementPage, setMovementPage] = useState(1);
  const [movementResult, setMovementResult] = useState<StockMovementList>({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } });
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([]);
  const [detailMovementsLoading, setDetailMovementsLoading] = useState(false);
  const [standardForm, setStandardForm] = useState({ fixedQuantity: 0, quantityPerBed: 0, roomType: 'PERSONEL_ODASI' });
  const [serialLookup, setSerialLookup] = useState('');
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistory | null>(null);
  const [deviceLookupLoading, setDeviceLookupLoading] = useState(false);

  const [cardForm, setCardForm] = useState({
    itemName: '',
    itemCode: '',
    category: 'ODA DEMİRBAŞI',
    itemType: 'DEMİRBAŞ',
    unit: 'ADET',
    specifications: '',
    physicalStatus: 'KULLANILABİLİR',
    warrantyEndDate: '',
    locationNote: '',
    minimumStock: 1,
    totalStock: 1,
    isActive: true,
  });

  const [employeesList, setEmployeesList] = useState<Array<{ id: string; firstName: string; lastName: string; registrationNo?: string; department: string }>>([]);
  const [receiveForm, setReceiveForm] = useState({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' });
  const [countForm, setCountForm] = useState({ countedAvailable: 0, notes: '' });
  const [assignForm, setAssignForm] = useState({ targetType: 'ROOM' as 'ROOM' | 'EMPLOYEE', stockItemId: '', roomId: '', employeeId: '', quantity: 1, brand: '', serialNo: '', notes: '' });
  const [assignmentForm, setAssignmentForm] = useState({ action: 'TRANSFER', roomId: '', outcome: 'RETURNED' as 'RETURNED' | 'RETIRED', brand: '', serialNo: '', notes: '' });

  const loadOverview = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      setOverview(await stockApi.getOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stok verileri yüklenemedi.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (tab !== 'movements') return;
    const timer = window.setTimeout(() => {
      setMovementsLoading(true);
      stockApi.getMovements({ search, stockItemId: movementStockItemId || undefined, type: movementType, dateStart: movementDateStart || undefined, dateEnd: movementDateEnd || undefined, page: movementPage, pageSize: 50 })
        .then(setMovementResult)
        .catch((caught) => setError(caught instanceof Error ? caught.message : 'Hareket geçmişi yüklenemedi.'))
        .finally(() => setMovementsLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [tab, search, movementStockItemId, movementType, movementDateStart, movementDateEnd, movementPage]);

  useEffect(() => {
    if (!passportModal) { setDetailMovements([]); return; }
    setStandardForm({
      fixedQuantity: passportModal.roomStandard?.fixedQuantity || 0,
      quantityPerBed: passportModal.roomStandard?.quantityPerBed || 0,
      roomType: passportModal.roomStandard?.roomType || 'PERSONEL_ODASI',
    });
    setDetailMovementsLoading(true);
    stockApi.getMovements({ stockItemId: passportModal.id, page: 1, pageSize: 100 })
      .then((result) => setDetailMovements(result.items))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Ürün geçmişi yüklenemedi.'))
      .finally(() => setDetailMovementsLoading(false));
  }, [passportModal?.id]);

  const filteredItems = useMemo(() => (overview?.items || []).filter((item) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const textMatches = !query || [item.itemName, item.itemCode, item.category, item.specifications, item.locationNote, stockLocations(item)].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query)) || item.roomInventories.some((inv) => inv.serialNo?.toLocaleLowerCase('tr-TR').includes(query) || inv.room.roomNumber.includes(query));
    const categoryMatches = category === 'ALL' || item.category === category;
    const typeMatches = itemTypeFilter === 'ALL' || item.itemType === itemTypeFilter;
    const stockMatches = stockFilter === 'ALL'
      || (stockFilter === 'CRITICAL' && item.availableStock <= item.minimumStock)
      || (stockFilter === 'ISSUE' && item.issueCount > 0)
      || (stockFilter === 'ACTIVE' && item.isActive)
      || (stockFilter === 'PASSIVE' && !item.isActive);
    return textMatches && categoryMatches && typeMatches && stockMatches;
  }), [overview, search, category, itemTypeFilter, stockFilter]);

  const assignments = useMemo(() => filteredItems.flatMap((item) => item.roomInventories.map((assignment) => ({ item, assignment }))).filter(({ assignment }) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return !query || [assignment.itemName, assignment.serialNo, assignment.brand, roomName(assignment)].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
  }), [filteredItems, search]);

  const personnelAssignments = useMemo(() => filteredItems.flatMap((item) => item.inventories.filter((i: any) => i.category !== 'ORTAK_EŞYA').map((assignment) => ({ item, assignment }))).filter(({ assignment }) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const employeeName = `${assignment.employee.firstName} ${assignment.employee.lastName}`;
    return !query || [assignment.itemName, assignment.itemCode, employeeName, assignment.employee.registrationNo, assignment.employee.department].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
  }), [filteredItems, search]);

  const runAction = async (action: () => Promise<unknown>, _message: string) => {
    try {
      setBusy(true); setError(null);
      await action();
      setModal(null);
      await loadOverview(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };

  const openCreate = () => {
    operationKeyRef.current = generateUUID();
    setCardForm({
      itemName: '',
      itemCode: '',
      category: 'ODA DEMİRBAŞI',
      itemType: 'DEMİRBAŞ',
      unit: 'ADET',
      specifications: '',
      physicalStatus: 'KULLANILABİLİR',
      warrantyEndDate: '',
      locationNote: '',
      minimumStock: 5,
      totalStock: 0,
      isActive: true,
    });
    setModal({ type: 'create' });
  };

  const openEdit = (item: StockItem) => {
    operationKeyRef.current = generateUUID();
    setCardForm({
      itemName: item.itemName,
      itemCode: item.itemCode || '',
      category: item.category || 'ODA DEMİRBAŞI',
      itemType: item.itemType || 'DEMİRBAŞ',
      unit: item.unit || 'ADET',
      specifications: item.specifications || '',
      physicalStatus: item.physicalStatus || 'KULLANILABİLİR',
      warrantyEndDate: item.warrantyEndDate ? new Date(item.warrantyEndDate).toISOString().slice(0, 10) : '',
      locationNote: item.locationNote || '',
      minimumStock: item.minimumStock ?? 5,
      totalStock: item.totalStock ?? 0,
      isActive: item.isActive ?? true,
    });
    setModal({ type: 'edit', item });
  };

  const openReceive = (item?: StockItem) => {
    operationKeyRef.current = generateUUID();
    const targetItem = item || filteredItems[0];
    if (!targetItem) {
      openCreate();
      return;
    }
    setReceiveForm({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' });
    setModal({ type: 'receive', item: targetItem });
  };

  const openAssign = (item?: StockItem) => {
    operationKeyRef.current = generateUUID();
    if (employeesList.length === 0) {
      employeeApi.getEmployees('', 'RESIDENT').then((res) => setEmployeesList(res)).catch(() => {});
    }
    setAssignForm({ targetType: 'ROOM', stockItemId: item?.id || '', roomId: '', employeeId: '', quantity: 1, brand: '', serialNo: '', notes: '' });
    setModal({ type: 'assign', item });
  };

  const openAssignment = (item: StockItem, assignment: RoomAssignment) => {
    operationKeyRef.current = generateUUID();
    setAssignmentForm({ action: !assignment.serialNo && item.itemType !== 'SARF_MALZEME' ? 'IDENTITY' : hasOpenMaintenance(assignment) ? 'REPLACE' : 'TRANSFER', roomId: '', outcome: 'RETURNED', brand: assignment.brand || '', serialNo: assignment.serialNo || '', notes: '' });
    setModal({ type: 'assignment', item, assignment });
  };

  const lookupDevice = async () => {
    if (!serialLookup.trim()) { setError('Lütfen cihazın seri numarasını yazın.'); return; }
    try {
      setDeviceLookupLoading(true); setError(null);
      setDeviceHistory(await stockApi.getDeviceHistory(serialLookup.trim()));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Cihaz geçmişi yüklenemedi.'); }
    finally { setDeviceLookupLoading(false); }
  };

  if (deviceHistory) {
    const allFaults = deviceHistory.assignments.flatMap((assignment) => (assignment.maintenances || []).map((maintenance) => ({ assignment, maintenance }))).sort((a, b) => new Date(b.maintenance.createdAt).getTime() - new Date(a.maintenance.createdAt).getTime());
    const activeAssignment = deviceHistory.assignments.find((assignment) => !assignment.returnedAt);
    const sharedAsset = deviceHistory.sharedAssets.find((asset) => asset.status !== 'RETIRED');
    return (
      <div className="w-full space-y-4 animate-fadeIn">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3"><button type="button" onClick={() => setDeviceHistory(null)} className={secondaryButton}>← Stok Listesine Dön</button><div><h2 className="text-lg font-black text-slate-900">Seri No: {deviceHistory.serialNo}</h2><p className="text-xs font-semibold text-slate-500">Tekil cihaz yaşam ve arıza geçmişi</p></div></div>
          <span className={`rounded-lg px-3 py-2 text-xs font-black ${activeAssignment || sharedAsset ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{activeAssignment ? `${roomName(activeAssignment)} konumunda` : sharedAsset ? `${sharedAsset.locationNote || 'Ortak kullanım alanı'} · ${sharedAsset.status === 'LOANED' ? 'Kullanımda' : 'Müsait'}` : 'Aktif konum kaydı yok'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Oda Geçmişi</p><p className="mt-1 text-2xl font-black text-slate-900">{deviceHistory.summary.assignmentCount}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Toplam Arıza</p><p className={`mt-1 text-2xl font-black ${deviceHistory.summary.faultCount >= 2 ? 'text-rose-700' : 'text-slate-900'}`}>{deviceHistory.summary.faultCount}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Stok Hareketi</p><p className="mt-1 text-2xl font-black text-blue-900">{deviceHistory.movements.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Risk</p><p className={`mt-1 text-sm font-black ${deviceHistory.summary.faultCount >= 2 ? 'text-rose-700' : 'text-emerald-700'}`}>{deviceHistory.summary.faultCount >= 2 ? 'Tekrarlayan arıza' : 'Normal'}</p></div></div>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-black text-slate-900">Oda ve Konum Geçmişi</h3><div className="mt-3 space-y-2">{deviceHistory.assignments.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">Oda kaydı bulunamadı.</p> : deviceHistory.assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-xs font-bold text-slate-900">{roomName(assignment)}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Giriş: {formatDateTime(assignment.installedAt)} · {assignment.returnedAt ? `Çıkış: ${formatDateTime(assignment.returnedAt)}` : 'Halen burada'}</p></div><StatusBadge status={assignment.status} /></div>)}</div></section>
          <section className={`rounded-xl border bg-white p-4 ${deviceHistory.summary.faultCount >= 2 ? 'border-rose-300' : 'border-slate-200'}`}><h3 className="text-sm font-black text-slate-900">Arıza ve Onarım Geçmişi ({allFaults.length})</h3><div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">{allFaults.length === 0 ? <p className="rounded-lg bg-emerald-50 p-4 text-center text-xs font-semibold text-emerald-800">Bu seri numarası için arıza kaydı yok.</p> : allFaults.map(({ assignment, maintenance }) => <div key={maintenance.id} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-2"><p className="text-xs font-black text-slate-900">{maintenance.title} · {roomName(assignment)}</p><span className="text-[10px] font-semibold text-slate-500">{formatDateTime(maintenance.createdAt)}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-600">{maintenance.description}</p><p className="mt-1 text-[10px] font-bold text-blue-800">{maintenance.status === 'OPEN' || maintenance.status === 'IN_PROGRESS' ? 'Devam ediyor' : `Çözüldü${maintenance.resolutionNote ? ` · ${maintenance.resolutionNote}` : ''}`}</p></div>)}</div></section>
        </div>
        <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-black text-slate-900">Tüm Stok Hareketleri</h3><div className="mt-3 overflow-x-auto"><table className="min-w-[720px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Tarih</th><th className="px-3 py-2">İşlem</th><th className="px-3 py-2">Konum</th><th className="px-3 py-2">Açıklama</th></tr></thead><tbody className="divide-y divide-slate-200">{deviceHistory.movements.map((movement) => <tr key={movement.id}><td className="px-3 py-2">{formatDateTime(movement.createdAt)}</td><td className="px-3 py-2 font-bold text-blue-900">{movementLabels[movement.type]}</td><td className="px-3 py-2">{movement.roomLabelSnapshot || 'Ana Depo'}</td><td className="px-3 py-2 text-slate-600">{movement.notes || movement.reason || '-'}</td></tr>)}</tbody></table></div></section>
      </div>
    );
  }

  if (passportModal) {
    const faultHistory = passportModal.roomInventories
      .flatMap((assignment) => (assignment.maintenances || []).map((maintenance) => ({ assignment, maintenance })))
      .sort((a, b) => new Date(b.maintenance.createdAt).getTime() - new Date(a.maintenance.createdAt).getTime());
    const repeatedFaults = passportModal.roomInventories
      .map((assignment) => ({ assignment, faultCount: assignment.maintenances?.length || 0 }))
      .filter((entry) => entry.faultCount >= 2)
      .sort((a, b) => b.faultCount - a.faultCount);
    const healthyCount = passportModal.roomInventories.filter((assignment) => assignment.status === 'HEALTHY').reduce((sum, assignment) => sum + assignment.quantity, 0);
    const problemCount = passportModal.roomInventories.filter((assignment) => assignment.status !== 'HEALTHY').reduce((sum, assignment) => sum + assignment.quantity, 0);

    return (
      <div className="w-full space-y-4 animate-fadeIn">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPassportModal(null)} className={secondaryButton}>← Stok Listesine Dön</button>
            <div>
              <h2 className="text-lg font-black text-slate-900">{passportModal.itemName}</h2>
              <p className="text-xs font-semibold text-slate-500">{passportModal.itemCode || 'KODSUZ'} · {passportModal.category} · Ürün Takip Sayfası</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canManageStock && <button type="button" onClick={() => { const item = passportModal; setPassportModal(null); openReceive(item); }} className={secondaryButton}>+ Depoya Ekle</button>}
            {canManageStock && <button type="button" onClick={() => { const item = passportModal; setPassportModal(null); openAssign(item); }} className={primaryButton}>Odaya / Personele Ver</button>}
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
          {[
            ['Toplam', passportModal.totalStock, 'text-slate-900'],
            ['Ana Depoda', passportModal.availableStock, 'text-emerald-700'],
            ['Odalarda', passportModal.usedInRooms, 'text-blue-800'],
            ['Personelde', passportModal.usedStock, 'text-violet-800'],
            ['Ortak Eşya Kaydı', passportModal.sharedAssetsInLocations, 'text-cyan-800'],
            ['Sağlam', healthyCount, 'text-emerald-700'],
            ['Sorunlu', problemCount, problemCount ? 'text-rose-700' : 'text-slate-500'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className={`mt-1 text-xl font-black ${color}`}>{value} <span className="text-xs">{passportModal.unit}</span></p>
            </div>
          ))}
        </div>

        {repeatedFaults.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-rose-900"><AlertTriangle className="h-4 w-4" /> Tekrarlayan Arıza Uyarısı</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {repeatedFaults.map(({ assignment, faultCount }) => (
                <div key={assignment.id} className="rounded-lg border border-rose-200 bg-white p-3">
                  <p className="text-xs font-black text-slate-900">{assignment.serialNo ? `S/N ${assignment.serialNo}` : assignment.assetTag || 'Seri numarası girilmemiş'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">{roomName(assignment)} · {faultCount} arıza kaydı</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {passportModal.sharedAssets.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-cyan-200 bg-white">
            <div className="border-b border-cyan-100 bg-cyan-50/70 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900">Ortak Kullanım Konumları</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-600">Çamaşırhane gibi alanlar zimmetli oda değildir; cihazın sabit kullanım konumudur.</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {passportModal.sharedAssets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] font-black text-cyan-900">{asset.serialNo ? `S/N ${asset.serialNo}` : asset.assetCode}</p>
                      <p className="mt-1 text-xs font-black text-slate-900">{asset.locationNote || 'Ana Depo'}</p>
                      {asset.brandModel && <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{asset.brandModel}</p>}
                    </div>
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${asset.status === 'LOANED' ? 'bg-amber-100 text-amber-900' : asset.status === 'MAINTENANCE' ? 'bg-rose-100 text-rose-900' : asset.status === 'RETIRED' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-900'}`}>
                      {asset.status === 'LOANED' ? 'Kullanımda' : asset.status === 'MAINTENANCE' ? 'Bakımda' : asset.status === 'RETIRED' ? 'Hurda' : 'Müsait'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="text-sm font-black text-slate-900">Oda Dağılımı ve Cihaz Durumu</h3><p className="text-[11px] font-semibold text-slate-500">Seri numarasına tıklamadan tüm cihazları karşılaştırın.</p></div>
              <span className="text-xs font-bold text-slate-600">{passportModal.roomInventories.length} kayıt</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Oda</th><th className="px-3 py-2">Seri No / Etiket</th><th className="px-3 py-2">Adet</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Arıza</th><th className="px-3 py-2 text-right">İşlem</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {passportModal.roomInventories.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Bu üründen odalarda bulunmuyor.</td></tr> : passportModal.roomInventories.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">{roomName(assignment)}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{assignment.serialNo || assignment.assetTag || '-'}</td>
                      <td className="px-3 py-2.5 font-bold">{assignment.quantity}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={assignment.status} /></td>
                      <td className="px-3 py-2.5"><span className={`font-bold ${(assignment.maintenances?.length || 0) >= 2 ? 'text-rose-700' : 'text-slate-600'}`}>{assignment.maintenances?.length || 0}</span></td>
                      <td className="px-3 py-2.5 text-right">{canManageLifecycle && <button type="button" onClick={() => { const item = passportModal; setPassportModal(null); openAssignment(item, assignment); }} className="rounded-md bg-[#1e3a8a] px-2 py-1 text-[10px] font-bold text-white">İşlem Yap</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900">Oda Eksik Kontrolü</h3>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">Örn. her odada 1 klima veya yatak kapasitesi kadar baza.</p>
            {canManageStock && passportModal.itemType !== 'SARF_MALZEME' && (
              <form className="mt-3 space-y-3" onSubmit={async (event) => {
                event.preventDefault();
                try {
                  setBusy(true); setError(null);
                  await stockApi.setRoomStandard(passportModal.id, standardForm);
                  const refreshed = await stockApi.getOverview();
                  setOverview(refreshed);
                  setPassportModal(refreshed.items.find((item) => item.id === passportModal.id) || null);
                } catch (caught) { setError(caught instanceof Error ? caught.message : 'Oda standardı kaydedilemedi.'); }
                finally { setBusy(false); }
              }}>
                <div className="grid grid-cols-2 gap-2">
                  <label><span className={labelClass}>Her Odaya Sabit</span><input type="number" min={0} className={inputClass} value={standardForm.fixedQuantity} onChange={(e) => setStandardForm({ ...standardForm, fixedQuantity: Number(e.target.value) })} /></label>
                  <label><span className={labelClass}>Yatak Başına</span><input type="number" min={0} className={inputClass} value={standardForm.quantityPerBed} onChange={(e) => setStandardForm({ ...standardForm, quantityPerBed: Number(e.target.value) })} /></label>
                </div>
                <button disabled={busy} className={primaryButton}>{busy ? 'Kaydediliyor...' : 'Standardı Kaydet'}</button>
              </form>
            )}
            <div className="mt-4 border-t border-slate-200 pt-3">
              {!passportModal.roomCoverage ? <p className="rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-500">Henüz oda standardı tanımlanmadı.</p> : (
                <div>
                  <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-blue-50 p-2"><p className="text-[10px] font-bold text-blue-700">Kapsanan Oda</p><p className="font-black text-blue-900">{passportModal.roomCoverage.totalRooms}</p></div><div className="rounded-lg bg-emerald-50 p-2"><p className="text-[10px] font-bold text-emerald-700">Tam</p><p className="font-black text-emerald-900">{passportModal.roomCoverage.completeRooms}</p></div><div className="rounded-lg bg-rose-50 p-2"><p className="text-[10px] font-bold text-rose-700">Eksik Adet</p><p className="font-black text-rose-900">{passportModal.roomCoverage.missingTotal}</p></div></div>
                  <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">{passportModal.roomCoverage.missingRooms.map((room) => <div key={room.roomId} className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs"><span className="font-bold text-slate-800">{room.blockName} / Oda {room.roomNumber}</span><span className="font-black text-rose-700">{room.missing} eksik</span></div>)}</div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-black text-slate-900">Arıza Geçmişi ({faultHistory.length})</h3><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{faultHistory.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">Arıza kaydı bulunmuyor.</p> : faultHistory.map(({ assignment, maintenance }) => <div key={maintenance.id} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-2"><p className="text-xs font-bold text-slate-900">{assignment.serialNo ? `S/N ${assignment.serialNo}` : assignment.itemName} · {roomName(assignment)}</p><span className="text-[10px] font-semibold text-slate-500">{formatDateTime(maintenance.createdAt)}</span></div><p className="mt-1 text-[11px] font-semibold text-slate-600">{maintenance.description}</p><p className="mt-1 text-[10px] font-bold text-blue-800">{maintenance.status === 'OPEN' || maintenance.status === 'IN_PROGRESS' ? 'Devam ediyor' : `Çözüldü${maintenance.resolutionNote ? `: ${maintenance.resolutionNote}` : ''}`}</p></div>)}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">Stok Hareket Geçmişi</h3><button type="button" onClick={() => { setMovementStockItemId(passportModal.id); setMovementPage(1); setPassportModal(null); setTab('movements'); }} className="text-xs font-bold text-blue-800">Tümünü Aç →</button></div><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{detailMovementsLoading ? <p className="p-4 text-center text-xs text-slate-500">Geçmiş yükleniyor...</p> : detailMovements.slice(0, 20).map((movement) => <div key={movement.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-xs font-bold text-slate-900">{movementLabels[movement.type] || movement.type}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{movement.roomLabelSnapshot || 'Ana Depo'} · {movement.serialNo ? `S/N ${movement.serialNo}` : 'Seri no yok'}</p></div><span className="whitespace-nowrap text-[10px] font-semibold text-slate-500">{formatDateTime(movement.createdAt)}</span></div>)}</div></section>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden animate-fadeIn">
      {/* Enterprise Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#1e3a8a]" /> Envanter ve Stok Yönetimi
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Depo stok kontrolü, demirbaş takibi ve oda zimmet yönetimi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExecutiveReportOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
          >
            <BarChart3 className="h-3.5 w-3.5 text-[#1e3a8a]" />
            <span>Yönetici Özet Raporu</span>
          </button>

          {canManageStock && (
            <button
              type="button"
              onClick={() => runAction(stockApi.exportExcel, 'Excel raporu indirildi.')}
              className={secondaryButton}
            >
              <Download className="h-3.5 w-3.5 text-slate-600" /> Excel İndir
            </button>
          )}

          {canManageStock && (
            <button type="button" onClick={openCreate} className={primaryButton}>
              <Plus className="h-3.5 w-3.5" /> Yeni Stok Kartı
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4 cursor-pointer" /></button>
        </div>
      )}

      {/* Sleek Enterprise Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Kayıtlı Malzeme</span>
          <span className="text-xl font-bold text-slate-900 mt-0.5 block">{overview?.summary.totalRegistered || 0}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Depodaki Miktar</span>
          <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{overview?.summary.available || 0}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Odalarda Zimmetli</span>
          <span className="text-xl font-bold text-blue-900 mt-0.5 block">{overview?.summary.inRooms || 0}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Kritik Stok Uyarısı</span>
          <span className="text-xl font-bold text-amber-700 mt-0.5 block">{overview?.summary.criticalCards || 0}</span>
        </div>
      </div>

      {/* Enterprise Toolbar (Quick Action Buttons & Smart Search) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            {canManageStock && (
              <button
                type="button"
                onClick={() => openReceive()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                <ArrowDownToLine className="h-3.5 w-3.5 text-[#1e3a8a]" />
                <span>Mal Kabul / Depo Girişi</span>
              </button>
            )}

            {canManageStock && (
              <button
                type="button"
                onClick={() => openAssign()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              >
                <Send className="h-3.5 w-3.5 text-emerald-700" />
                <span>Odaya Zimmetle</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTab('rooms')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-amber-700" />
              <span>Birebir Ürün Değişimi</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-[#1e3a8a] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Görsel Kartlar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                viewMode === 'table' ? 'bg-[#1e3a8a] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tablo Görünümü</span>
            </button>
          </div>
        </div>

        {/* Search Input & Category Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setMovementPage(1); }}
              placeholder="Seri No, Oda No, Kod veya Ürün Adı ara..."
              className={inputClass + ' pl-9'}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={itemTypeFilter}
              onChange={(event) => setItemTypeFilter(event.target.value)}
              className="h-10 min-w-[150px] appearance-none rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-400 cursor-pointer"
            >
              <option value="ALL">Tüm Stok Niteliği</option>
              <option value="DEMİRBAŞ">Sabit Demirbaşlar</option>
              <option value="ORTAK_EŞYA">Ortak Kullanım Eşyaları</option>
              <option value="SARF_MALZEME">Sarf Malzemeler</option>
            </select>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 min-w-[140px] appearance-none rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-400 cursor-pointer"
            >
              <option value="ALL">Tüm Kategoriler</option>
              {STOCK_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
            </select>

            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="h-10 min-w-[130px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-400 cursor-pointer"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="CRITICAL">Kritik Stok</option>
              <option value="ISSUE">Bakım / Arıza</option>
            </select>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); lookupDevice(); }} className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-blue-950">Seri numarasıyla cihaz bul</p>
            <p className="text-[10px] font-semibold text-blue-800">Aktif veya geçmiş kayıtlardaki klima, makine ve cihazları arar.</p>
          </div>
          <input value={serialLookup} onChange={(event) => setSerialLookup(event.target.value.toLocaleUpperCase('tr-TR'))} className="h-9 min-w-[240px] rounded-lg border border-blue-200 bg-white px-3 font-mono text-xs font-bold outline-none focus:border-blue-700" placeholder="Örn. SN556499" />
          <button disabled={deviceLookupLoading || !serialLookup.trim()} className={primaryButton}>{deviceLookupLoading ? 'Aranıyor...' : 'Cihazı Bul'}</button>
        </form>
      </div>

      {/* MAIN DATA SECTION */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 p-2">
          {([
            ['quick', 'Hızlı Stok Takibi', `${filteredItems.length}`, LayoutGrid],
            ['stock', 'Stok & Demirbaş Kataloğu', `${filteredItems.length}`, Package],
            ['rooms', 'Aktif Oda Zimmetleri', `${assignments.length}`, Building2],
            ['personnel', 'Aktif Personel Zimmetleri', `${personnelAssignments.length}`, ClipboardCheck],
            ['movements', 'İşlem Geçmişi & Loglar', `${movementResult.pagination.total}`, History],
          ] as Array<[MainTab, string, string, React.ElementType]>).map(([value, label, count, Icon]) => (
            <button
              key={String(value)}
              onClick={() => setTab(value)}
              className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition cursor-pointer ${tab === value ? 'bg-[#1e3a8a] text-white shadow-2xs' : 'text-slate-600 hover:bg-white hover:text-[#1e3a8a]'}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${tab === value ? 'bg-white/20' : 'bg-slate-200'}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Günlük kullanım için sade ekran: ürünün nerede olduğu ve fiziksel durumu tek satırda. */}
        {tab === 'quick' && (
          <div className="p-4">
            {loading ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-500">Stok özeti yükleniyor...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-xs font-semibold text-slate-500">Aramanıza uygun ürün bulunamadı.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="px-3 py-2.5">Ürün</th>
                      <th className="px-3 py-2.5 text-center">Depoda</th>
                      <th className="px-3 py-2.5 text-center">Odalarda</th>
                      <th className="px-3 py-2.5 text-center">Personelde</th>
                      <th className="px-3 py-2.5 text-center">Ortak Kullanım</th>
                      <th className="px-3 py-2.5 text-center">Sağlam</th>
                      <th className="px-3 py-2.5 text-center">Kontrol Gerekli</th>
                      <th className="px-3 py-2.5">En Son Konum / İşlem</th>
                      <th className="px-3 py-2.5 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredItems.map((item) => {
                      const healthy = item.roomInventories.filter((assignment) => assignment.status === 'HEALTHY').reduce((sum, assignment) => sum + assignment.quantity, 0);
                      const needsAttention = item.roomInventories.filter((assignment) => assignment.status !== 'HEALTHY').reduce((sum, assignment) => sum + assignment.quantity, 0);
                      const sharedCount = item.sharedAssets?.filter((asset) => asset.status !== 'RETIRED').length || 0;
                      const latestRoom = item.roomInventories[0]
                        ? roomName(item.roomInventories[0])
                        : item.sharedAssets?.find((asset) => asset.status !== 'RETIRED')?.locationNote || item.locationNote || 'Ana Depo';
                      return (
                        <tr key={item.id} className="cursor-pointer hover:bg-blue-50/60" onClick={() => setPassportModal(item)}>
                          <td className="px-3 py-3">
                            <p className="font-bold text-slate-900">{item.itemName}</p>
                            <p className="mt-0.5 font-mono text-[10px] font-semibold text-[#1e3a8a]">{item.itemCode || 'KODSUZ'} · {item.itemType || 'DEMİRBAŞ'}</p>
                          </td>
                          <td className="px-3 py-3 text-center font-black text-emerald-700">{item.availableStock} {item.unit}</td>
                          <td className="px-3 py-3 text-center font-black text-slate-800">{item.usedInRooms} {item.unit}</td>
                          <td className="px-3 py-3 text-center font-black text-slate-800">{item.usedStock} {item.unit}</td>
                          <td className="px-3 py-3 text-center font-black text-blue-800">{sharedCount || '-'}{sharedCount ? ` ${item.unit}` : ''}</td>
                          <td className="px-3 py-3 text-center"><span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-800">{healthy} {item.unit}</span></td>
                          <td className="px-3 py-3 text-center">{needsAttention > 0 ? <span className="inline-flex rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-800">{needsAttention} {item.unit}</span> : <span className="font-semibold text-slate-400">Yok</span>}</td>
                          <td className="max-w-[240px] px-3 py-3 font-semibold text-slate-600">{latestRoom}</td>
                          <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => setPassportModal(item)} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1e3a8a] bg-white px-2 text-[11px] font-bold text-[#1e3a8a] hover:bg-blue-50">
                              İncele <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: STOCK CATALOG */}
        {tab === 'stock' && (
          <div>
            {viewMode === 'cards' ? (
              <div className="p-4">
                {loading ? (
                  <div className="p-12 text-center text-xs font-semibold text-slate-500">Kayıtlar yükleniyor...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-12 text-center text-xs font-semibold text-slate-500">Eşleşen stok kaydı bulunamadı.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {filteredItems.map((item) => {
                      const critical = item.availableStock <= item.minimumStock;
                      const usedTotal = item.usedStock + item.usedInRooms;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition shadow-2xs hover:border-slate-300 hover:shadow-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-mono font-bold text-[#1e3a8a] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {item.itemCode || 'KODSUZ'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {item.category}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                              {item.itemName}
                            </h4>

                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <PhysicalStatusPill status={item.physicalStatus} />
                              {item.warrantyEndDate && (
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Garanti: {formatDateOnly(item.warrantyEndDate)}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 grid grid-cols-2 gap-2 text-center">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 block">Depoda</span>
                                <span className={`text-base font-bold ${critical ? 'text-rose-700' : 'text-emerald-700'}`}>
                                  {item.availableStock} {item.unit}
                                </span>
                              </div>
                              <div className="border-l border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 block">Zimmette</span>
                                <span className="text-base font-bold text-slate-900">
                                  {usedTotal} {item.unit}
                                </span>
                              </div>
                            </div>

                            {critical && (
                              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-1.5 text-[10px] font-bold text-amber-900 flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                <span>Kritik stok seviyesi (Min: {item.minimumStock} {item.unit})</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPassportModal(item)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#1e3a8a]" />
                              <span>Pasaport</span>
                            </button>

                            <div className="flex items-center gap-1">
                              {canManageStock && (
                                <button
                                  type="button"
                                  onClick={() => openReceive(item)}
                                  className="h-7 px-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer"
                                >
                                  + Depo
                                </button>
                              )}
                              {canManageStock && (
                                <button
                                  type="button"
                                  onClick={() => openAssign(item)}
                                  className="h-7 px-2 rounded-md bg-[#1e3a8a] text-white hover:bg-[#172554] text-[11px] font-bold transition cursor-pointer"
                                >
                                  Zimmetle
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 select-none">
                      <th className="px-2 py-2 border-r border-slate-200 text-center w-8">#</th>
                      <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Kod</th>
                      <th className="px-3 py-2 border-r border-slate-200">Malzeme Adı</th>
                      <th className="px-2.5 py-2 border-r border-slate-200 whitespace-nowrap">Kategori</th>
                      <th className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap">Depoda</th>
                      <th className="px-2 py-2 border-r border-slate-200 text-center whitespace-nowrap">Zimmetli</th>
                      <th className="px-2 py-2 border-r border-slate-200 text-center font-bold whitespace-nowrap">Toplam</th>
                      <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Durum</th>
                      <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Garanti</th>
                      <th className="px-2 py-2 text-right whitespace-nowrap">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr><td colSpan={10} className="p-8 text-center font-semibold text-slate-500">Stok kayıtları yükleniyor...</td></tr>
                    ) : filteredItems.length === 0 ? (
                      <tr><td colSpan={10} className="p-8 text-center font-semibold text-slate-600">Kayıt bulunamadı.</td></tr>
                    ) : (
                      filteredItems.map((item, idx) => {
                        const critical = item.availableStock <= item.minimumStock;
                        const usedTotal = item.usedStock + item.usedInRooms;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="px-2 py-2 text-center text-[11px] font-semibold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                            <td className="px-2 py-2 border-r border-slate-200 font-mono font-bold text-blue-900 text-[11px]">{item.itemCode || '-'}</td>
                            <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{item.itemName}</td>
                            <td className="px-2.5 py-2 border-r border-slate-200 text-slate-600 font-semibold">{item.category}</td>
                            <td className="px-2 py-2 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/20">{item.availableStock} {item.unit}</td>
                            <td className="px-2 py-2 border-r border-slate-200 text-center font-semibold text-slate-800">{usedTotal} {item.unit}</td>
                            <td className="px-2 py-2 border-r border-slate-200 text-center font-bold text-slate-900">{item.totalStock} {item.unit}</td>
                            <td className="px-2 py-2 border-r border-slate-200"><PhysicalStatusPill status={item.physicalStatus} /></td>
                            <td className="px-2 py-2 border-r border-slate-200 font-medium text-slate-600">{formatDateOnly(item.warrantyEndDate)}</td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button type="button" onClick={() => setPassportModal(item)} className="p-1 text-[#1e3a8a] hover:bg-blue-50 rounded cursor-pointer" title="Ürün Pasaportu"><FileText className="w-4 h-4" /></button>
                                {canManageStock && <button type="button" onClick={() => openEdit(item)} className="p-1 text-amber-700 hover:bg-amber-50 rounded cursor-pointer" title="Stok Kartını Düzenle"><Edit3 className="w-4 h-4" /></button>}
                                {canManageStock && <button type="button" onClick={() => openReceive(item)} className="p-1 text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title="Depoya Ekle"><ArrowDownToLine className="w-4 h-4" /></button>}
                                {canManageStock && <button type="button" onClick={() => openAssign(item)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer" title="Zimmetle"><Send className="w-4 h-4" /></button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROOM INVENTORY */}
        {tab === 'rooms' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 select-none">
                  <th className="px-2 py-2 border-r border-slate-200 text-center w-8">#</th>
                  <th className="px-3 py-2 border-r border-slate-200">Bulunduğu Oda</th>
                  <th className="px-3 py-2 border-r border-slate-200">Eşya / Demirbaş</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Marka / Seri No</th>
                  <th className="px-2 py-2 border-r border-slate-200 text-center">Miktar</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Durum</th>
                  <th className="px-2.5 py-2 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assignments.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center font-semibold text-slate-500">Aktif oda zimmeti bulunamadı.</td></tr>
                ) : (
                  assignments.map(({ item, assignment }, idx) => (
                    <tr key={assignment.id} className="hover:bg-slate-50 transition">
                      <td className="px-2 py-2 text-center text-[11px] font-semibold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{roomName(assignment)}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-semibold text-slate-800">{assignment.itemName}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 font-mono text-[11px] text-slate-600">{assignment.brand || '-'} {assignment.serialNo ? `(S/N: ${assignment.serialNo})` : ''}</td>
                      <td className="px-2 py-2 border-r border-slate-200 text-center font-bold text-slate-900">{assignment.quantity} {item.unit}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200"><StatusBadge status={assignment.status} /></td>
                      <td className="px-2.5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openAssignment(item, assignment)}
                          className="px-2.5 py-1 bg-[#1e3a8a] text-white rounded text-xs font-bold hover:bg-[#172554] transition cursor-pointer"
                        >
                          İşlem Yap
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: PERSONNEL INVENTORY */}
        {tab === 'personnel' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 select-none">
                  <th className="px-2 py-2 border-r border-slate-200 text-center w-8">#</th>
                  <th className="px-3 py-2 border-r border-slate-200">Zimmetli Personel</th>
                  <th className="px-3 py-2 border-r border-slate-200">Malzeme Adı</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Sicil / Departman</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Veriliş Tarihi</th>
                  <th className="px-2.5 py-2 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {personnelAssignments.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center font-semibold text-slate-500">Aktif personel zimmeti bulunamadı.</td></tr>
                ) : (
                  personnelAssignments.map(({ assignment }, idx) => (
                    <tr key={assignment.id} className="hover:bg-slate-50 transition">
                      <td className="px-2 py-2 text-center text-[11px] font-semibold text-slate-400 border-r border-slate-200">{idx + 1}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{assignment.employee.firstName} {assignment.employee.lastName}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-semibold text-slate-800">{assignment.itemName}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-600 font-medium">{assignment.employee.department} {assignment.employee.registrationNo ? `(${assignment.employee.registrationNo})` : ''}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-600 font-medium">{formatDateOnly(assignment.assignedDate)}</td>
                      <td className="px-2.5 py-2 text-right"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">Zimmetli</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: MOVEMENT LOGS */}
        {tab === 'movements' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600 select-none">
                  <th className="px-2.5 py-2 border-r border-slate-200">Tarih</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">İşlem Türü</th>
                  <th className="px-3 py-2 border-r border-slate-200">Ürün Adı</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Konum / Oda</th>
                  <th className="px-2 py-2 border-r border-slate-200 text-center">Miktar</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">İşlemi Yapan</th>
                  <th className="px-2.5 py-2">Açıklama</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movementsLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center font-semibold text-slate-500">Loglar yükleniyor...</td></tr>
                ) : movementResult.items.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center font-semibold text-slate-500">Hareket kaydı bulunamadı.</td></tr>
                ) : (
                  movementResult.items.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-2.5 py-2 border-r border-slate-200 text-[11px] font-medium text-slate-600 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 font-bold text-[#1e3a8a]">{movementLabels[m.type] || m.type}</td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">{m.itemNameSnapshot}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-700 font-medium">{m.roomLabelSnapshot || 'Ana Depo'}</td>
                      <td className="px-2 py-2 border-r border-slate-200 text-center font-bold">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-700 font-medium">{m.createdBy?.fullName || 'Sistem'}</td>
                      <td className="px-2.5 py-2 text-slate-600 font-medium">{m.notes || m.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXECUTIVE REPORT SUMMARY MODAL */}
      {isExecutiveReportOpen && (
        <ModalShell
          title="Yönetici Özet Raporu"
          subtitle="Tesis genelindeki envanter ve stok harcama durumu"
          icon={<BarChart3 className="h-4 w-4 text-[#1e3a8a]" />}
          onClose={() => setIsExecutiveReportOpen(false)}
          wide
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-500">Kayıtlı Ürün Çeşidi</span>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{overview?.summary.totalRegistered || 0}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-500">Depodaki Miktar</span>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">{overview?.summary.available || 0}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-500">Odalarda Zimmetli</span>
                <p className="text-xl font-bold text-blue-900 mt-0.5">{overview?.summary.inRooms || 0}</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-500">Kritik Stok Uyarısı</span>
                <p className="text-xl font-bold text-amber-700 mt-0.5">{overview?.summary.criticalCards || 0}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Depoda Sipariş Verilmesi Gereken Ürünler (Kritik Seviye)
              </h4>

              <div className="space-y-1.5">
                {(overview?.items || [])
                  .filter((item) => item.availableStock <= item.minimumStock)
                  .map((item) => (
                    <div key={item.id} className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{item.itemName}</span>
                        <span className="text-[10px] text-slate-500 font-medium ml-1.5">({item.category})</span>
                      </div>
                      <span className="font-bold text-amber-900">
                        Depoda: {item.availableStock} {item.unit} (Minimum: {item.minimumStock})
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => runAction(stockApi.exportExcel, 'Excel indirildi.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Excel Raporu İndir (.xlsx)
              </button>
              <button type="button" onClick={() => setIsExecutiveReportOpen(false)} className={secondaryButton}>Kapat</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* MODAL: CREATE OR EDIT STOCK ITEM */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <ModalShell
          onClose={() => setModal(null)}
          icon={modal.type === 'create' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          title={modal.type === 'create' ? 'Yeni Stok Kartı Tanımla' : `Stok Kartını Düzenle: ${modal.item.itemName}`}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal.type === 'create') {
                runAction(() => stockApi.createStockItem(cardForm, operationKeyRef.current), 'Stok kartı oluşturuldu.');
              } else {
                runAction(() => stockApi.updateStockItem(modal.item.id, cardForm, operationKeyRef.current), 'Stok kartı güncellendi.');
              }
            }}
            className="space-y-4"
          >
            {/* 1. ÜRÜN TEMEL BİLGİLERİ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>1. Temel Malzeme & Kategori Bilgileri</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="sm:col-span-2">
                  <span className={labelClass}>Malzeme / Cihaz Adı *</span>
                  <input required className={inputClass} value={cardForm.itemName} onChange={(e) => setCardForm({ ...cardForm, itemName: e.target.value })} placeholder="Örn: Vestel 32 LED TV, Çarşaf Seti..." />
                </label>
                <label>
                  <span className={labelClass}>Stok Kodu / Barkod</span>
                  <input className={inputClass} value={cardForm.itemCode} onChange={(e) => setCardForm({ ...cardForm, itemCode: e.target.value.toLocaleUpperCase('tr-TR') })} placeholder="Boş ise otomatik üretilir" />
                </label>
                <label>
                  <span className={labelClass}>Stok Kategorisi *</span>
                  <select className={inputClass} value={cardForm.category} onChange={(e) => setCardForm({ ...cardForm, category: e.target.value })}>
                    {STOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* 2. NİTELİK, MİKTAR VEYA BİRİM AYARLARI */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>2. Niteliği, Birimi ve Stok Seviyeleri</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label>
                  <span className={labelClass}>Ürün Niteliği *</span>
                  <select className={inputClass} value={cardForm.itemType} onChange={(e) => setCardForm({ ...cardForm, itemType: e.target.value })}>
                    <option value="DEMİRBAŞ">DEMİRBAŞ (Sabit Oda / Personel Zimmeti)</option>
                    <option value="ORTAK_EŞYA">ORTAK EŞYA (Ortak Kullanım Cihazı / Tesis Eşyası)</option>
                    <option value="SARF_MALZEME">SARF MALZEME (Tüketilen Sarf Malzemeler)</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Ölçü Birimi *</span>
                  <select className={inputClass} value={cardForm.unit} onChange={(e) => setCardForm({ ...cardForm, unit: e.target.value })}>
                    {['ADET', 'TAKIM', 'PAKET', 'KOLİ', 'METRE', 'LİTRE', 'SET', 'KİLOGRAM', 'RULO'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Açılış Stok Miktarı</span>
                  <input type="number" min={0} disabled={modal?.type === 'edit'} className={inputClass} value={cardForm.totalStock} onChange={(e) => setCardForm({ ...cardForm, totalStock: Number(e.target.value) })} />
                </label>
                <label>
                  <span className={labelClass}>Min. Stok Uyarısı Eşiği</span>
                  <input type="number" min={0} className={inputClass} value={cardForm.minimumStock} onChange={(e) => setCardForm({ ...cardForm, minimumStock: Number(e.target.value) })} />
                </label>
              </div>
            </div>

            {/* 3. FİZİKİ DURUM, KONUM VE GARANTİ */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>3. Fiziki Durum, Depo Konumu ve Garanti</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label>
                  <span className={labelClass}>Fiziki Sağlık Durumu</span>
                  <select className={inputClass} value={cardForm.physicalStatus} onChange={(e) => setCardForm({ ...cardForm, physicalStatus: e.target.value })}>
                    <option value="KULLANILABİLİR">KULLANILABİLİR (Sağlam / İyi)</option>
                    <option value="BAKIMDA">BAKIMDA (Bakım / Arızalı)</option>
                    <option value="HURDA">HURDA (Kullanım Dışı)</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Depodaki Raf / Konum Notu</span>
                  <input className={inputClass} value={cardForm.locationNote} onChange={(e) => setCardForm({ ...cardForm, locationNote: e.target.value })} placeholder="Örn: Depo A2 Rafı, Çamaşırhane Depo" />
                </label>
                <label>
                  <span className={labelClass}>Garanti Bitiş Tarihi</span>
                  <input type="date" className={inputClass} value={cardForm.warrantyEndDate} onChange={(e) => setCardForm({ ...cardForm, warrantyEndDate: e.target.value })} />
                </label>
              </div>
            </div>

            {/* 4. TEKNİK ÖZELLİKLER & AÇIKLAMA */}
            <div>
              <label>
                <span className={labelClass}>Teknik Özellikler / Ölçü / Detaylar</span>
                <textarea rows={2} className={`${inputClass} h-auto py-2`} value={cardForm.specifications} onChange={(e) => setCardForm({ ...cardForm, specifications: e.target.value })} placeholder="Örn: 160x200cm Pamuklu Nevresim, 12000 BTU Inverter A++..." />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !cardForm.itemName.trim()} className={primaryButton}>
                {busy ? 'İşleniyor...' : modal?.type === 'create' ? 'Kartı Oluştur' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: RECEIVE GOODS */}
      {modal?.type === 'receive' && (
        <ModalShell onClose={() => setModal(null)} icon={<ArrowDownToLine className="h-4 w-4" />} title={`Depoya Giriş Yap: ${modal.item.itemName}`}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => stockApi.receive(modal.item.id, receiveForm, operationKeyRef.current), 'Depo girişi tamamlandı.'); }} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label><span className={labelClass}>Giriş Miktarı ({modal.item.unit}) *</span><input type="number" min={1} required className={inputClass} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })} /></label>
              <label><span className={labelClass}>Giriş Gerekçesi *</span><input className={inputClass} value={receiveForm.reason} onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })} /></label>
            </div>
            <label><span className={labelClass}>Not / Açıklama</span><textarea rows={2} className={`${inputClass} h-auto py-2`} value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Açıklama veya fatura no..." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || receiveForm.quantity < 1} className={primaryButton}>{busy ? 'İşleniyor...' : 'Depoya Ekle'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: ASSIGN TO ROOM OR EMPLOYEE */}
      {modal?.type === 'assign' && (
        <ModalShell onClose={() => setModal(null)} icon={<Send className="h-4 w-4" />} title="Odaya veya Personele Zimmet Ver">
          <form onSubmit={(e) => {
            e.preventDefault();
            const itemId = assignForm.stockItemId || modal.item?.id;
            if (!itemId) return;
            const selectedItem = (overview?.items || []).find((i) => i.id === itemId);

            if (assignForm.targetType === 'EMPLOYEE') {
              if (!assignForm.employeeId) return;
              runAction(
                () => employeeApi.addInventoryItem(assignForm.employeeId, {
                  stockItemId: itemId,
                  itemName: selectedItem?.itemName || 'Zimmet Malzemesi',
                  category: 'LOJMAN_ZİMMETİ',
                  serialNo: assignForm.serialNo || undefined,
                  notes: assignForm.notes || undefined,
                }),
                'Personele zimmet verildi.'
              );
            } else {
              if (!assignForm.roomId) return;
              runAction(
                () => stockApi.assignRoom(itemId, {
                  roomId: assignForm.roomId,
                  quantity: assignForm.quantity,
                  brand: assignForm.brand,
                  serialNo: assignForm.serialNo,
                  notes: assignForm.notes,
                }, operationKeyRef.current),
                'Odaya zimmet oluşturuldu.'
              );
            }
          }} className="space-y-3.5">
            <div>
              <span className={labelClass}>Zimmet Hedefi *</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignForm({ ...assignForm, targetType: 'ROOM' })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    assignForm.targetType === 'ROOM' ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Odaya Zimmetle</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (employeesList.length === 0) {
                      employeeApi.getEmployees('', 'RESIDENT').then((res) => setEmployeesList(res)).catch(() => {});
                    }
                    setAssignForm({ ...assignForm, targetType: 'EMPLOYEE' });
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    assignForm.targetType === 'EMPLOYEE' ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Personele Zimmetle</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className={labelClass}>Ürün *</span>
                <select required className={inputClass} value={assignForm.stockItemId || modal.item?.id || ''} onChange={(e) => setAssignForm({ ...assignForm, stockItemId: e.target.value })}>
                  <option value="">Ürün seçin</option>
                  {(overview?.items || []).filter((i) => i.availableStock > 0).map((i) => <option key={i.id} value={i.id}>{i.itemName} (Depoda: {i.availableStock} {i.unit})</option>)}
                </select>
              </label>

              {assignForm.targetType === 'ROOM' ? (
                <div>
                  <span className={labelClass}>Hedef Oda (Arayarak Seçin) *</span>
                  <SearchableRoomSelect
                    value={assignForm.roomId}
                    onChange={(roomId) => setAssignForm({ ...assignForm, roomId })}
                    rooms={overview?.rooms || []}
                  />
                </div>
              ) : (
                <div>
                  <span className={labelClass}>Hedef Personel (Arayarak Seçin) *</span>
                  <SearchableEmployeeSelect
                    value={assignForm.employeeId}
                    onChange={(employeeId) => setAssignForm({ ...assignForm, employeeId })}
                    employees={employeesList}
                  />
                </div>
              )}
            </div>

            {(() => {
              const selectedItem = (overview?.items || []).find((i) => i.id === (assignForm.stockItemId || modal.item?.id));
              const isSarf = selectedItem?.itemType === 'SARF_MALZEME' || ['SARF MALZEMESİ', 'TEKSTİL & MEFRUŞAT', 'TEMİZLİK MALZEMESİ', 'KIRTASİYE'].includes(selectedItem?.category || '');

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label><span className={labelClass}>Miktar *</span><input type="number" min={1} required className={inputClass} value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: Number(e.target.value) })} /></label>
                  <label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignForm.brand} onChange={(e) => setAssignForm({ ...assignForm, brand: e.target.value })} placeholder="Marka" /></label>
                  <label>
                    <span className={labelClass}>Seri No {isSarf ? '(Opsiyonel)' : ''}</span>
                    <input className={inputClass} value={assignForm.serialNo} onChange={(e) => setAssignForm({ ...assignForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} placeholder={isSarf ? 'Sarf malzemede seri no gerekmez' : 'Seri No'} />
                  </label>
                </div>
              );
            })()}

            <label><span className={labelClass}>Zimmet Açıklaması</span><input className={inputClass} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} placeholder="Not..." /></label>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || (!assignForm.stockItemId && !modal.item?.id) || (assignForm.targetType === 'ROOM' ? !assignForm.roomId : !assignForm.employeeId)} className={primaryButton}>{busy ? 'İşleniyor...' : 'Zimmetle'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: ASSIGNMENT PROCESS (Transfer / Replacement / Return) */}
      {modal?.type === 'assignment' && (
        <ModalShell onClose={() => setModal(null)} icon={<ClipboardCheck className="h-4 w-4" />} title="Oda Zimmet Sürecini Yönet" subtitle={`${roomName(modal.assignment)} · ${modal.item.itemName}`}>
          <form onSubmit={(event) => { event.preventDefault(); const { assignment } = modal; if (assignmentForm.action === 'TRANSFER') runAction(() => stockApi.transferAssignment(assignment.id, { roomId: assignmentForm.roomId, notes: assignmentForm.notes }, operationKeyRef.current), 'Zimmet transfer edildi.'); else if (assignmentForm.action === 'RETURN') runAction(() => stockApi.returnAssignment(assignment.id, { outcome: assignmentForm.outcome, notes: assignmentForm.notes }, operationKeyRef.current), 'İade tamamlandı.'); else if (assignmentForm.action === 'IDENTITY') runAction(() => stockApi.updateAssignmentIdentity(assignment.id, { brand: assignmentForm.brand, serialNo: assignmentForm.serialNo, notes: assignmentForm.notes }, operationKeyRef.current), 'Bilgiler güncellendi.'); else runAction(() => stockApi.replaceAssignment(assignment.id, { brand: assignmentForm.brand, serialNo: assignmentForm.serialNo, notes: assignmentForm.notes }, operationKeyRef.current), 'Ürün değiştirildi.'); }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <div><p className="font-semibold text-slate-500">Marka / Model</p><p className="font-bold text-slate-800">{modal.assignment.brand || '-'}</p></div>
              <div><p className="font-semibold text-slate-500">Seri No</p><p className="font-bold text-slate-800">{modal.assignment.serialNo || '-'}</p></div>
              <div><p className="font-semibold text-slate-500">Miktar</p><p className="font-bold text-slate-800">{modal.assignment.quantity} {modal.item.unit}</p></div>
              <div><p className="font-semibold text-slate-500">Durum</p><div className="mt-0.5"><StatusBadge status={modal.assignment.status} /></div></div>
            </div>
            <div>
              <span className={labelClass}>Yapılacak İşlem *</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['TRANSFER', 'Oda Transferi', ArrowRightLeft], ['RETURN', 'İade / Düşüm', RotateCcw], ['IDENTITY', 'Kimlik Bilgisi', Edit3], ['REPLACE', 'Ürün Değişimi', RefreshCw],
                ] as Array<[string, string, React.ElementType]>).map(([value, label, Icon]) => {
                  const hasFault = hasOpenMaintenance(modal.assignment);
                  const disabled = value === 'IDENTITY' ? false : value === 'REPLACE' ? !hasFault : hasFault;
                  return <button key={value} type="button" disabled={disabled} onClick={() => setAssignmentForm({ ...assignmentForm, action: value })} className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${assignmentForm.action === value ? 'border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>;
                })}
              </div>
            </div>
            {assignmentForm.action === 'TRANSFER' && <label><span className={labelClass}>Hedef Oda *</span><select required className={inputClass} value={assignmentForm.roomId} onChange={(e) => setAssignmentForm({ ...assignmentForm, roomId: e.target.value })}><option value="">Yeni oda seçin</option>{(overview?.rooms || []).filter((room) => room.id !== modal.assignment.roomId).map((room) => <option key={room.id} value={room.id}>{room.block.name} · Oda {room.roomNumber}</option>)}</select></label>}
            {assignmentForm.action === 'RETURN' && <label><span className={labelClass}>İade Sonucu *</span><select className={inputClass} value={assignmentForm.outcome} onChange={(e) => setAssignmentForm({ ...assignmentForm, outcome: e.target.value as typeof assignmentForm.outcome })}><option value="RETURNED">Sağlam İade — Depo Stoğuna Al</option><option value="RETIRED">Hurda / Kullanım Dışı — Stoktan Düş</option></select></label>}
            {assignmentForm.action === 'IDENTITY' && <div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label><label><span className={labelClass}>Seri Numarası</span><input className={inputClass} value={assignmentForm.serialNo} onChange={(e) => setAssignmentForm({ ...assignmentForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} /></label></div>}
            {assignmentForm.action === 'REPLACE' && <div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Yeni Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label><label><span className={labelClass}>Yeni Seri Numarası {modal.item.itemType !== 'SARF_MALZEME' ? '*' : '(Opsiyonel)'}</span><input required={modal.item.itemType !== 'SARF_MALZEME'} className={inputClass} value={assignmentForm.serialNo} onChange={(e) => setAssignmentForm({ ...assignmentForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} placeholder={modal.item.itemType === 'SARF_MALZEME' ? 'Sarf malzemelerde seri no gerekmez' : 'Seri No'} /></label></div>}
            <label><span className={labelClass}>İşlem Açıklaması *</span><textarea required rows={2} className={`${inputClass} h-auto py-2`} value={assignmentForm.notes} onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} placeholder="Açıklama yazın..." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || !assignmentForm.notes.trim()} className={primaryButton}>{busy ? 'İşleniyor...' : 'Onayla'}</button></div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
