import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowRightLeft, Building2, Check, ChevronDown,
  ChevronRight, ClipboardCheck, Download, Edit3, Filter, History, MapPin, Package,
  Plus, RefreshCw, RotateCcw, Search, Send, X,
  FileText, FileSpreadsheet, BarChart3, LayoutGrid, List, ShieldCheck
} from 'lucide-react';
import { AssignmentStatus, MovementType, RoomAssignment, StockDetailExportSection, StockItem, StockMovement, StockMovementList, StockOverview, stockApi } from '../api/stockApi';
import { employeeApi } from '../api/employeeApi';
import { User } from '../api/authApi';
import { can } from '../security/accessControl';
import { generateUUID } from '../utils/cryptoHelpers';
import { managementUrl } from '../utils/navigationUrl';
import { StockDetailExportModal } from './StockDetailExportModal';

type MainTab = 'quick' | 'stock' | 'rooms' | 'personnel' | 'movements';
type PassportSection = 'overview' | 'rooms' | 'coverage' | 'faults' | 'movements';
const warehouseTabs: MainTab[] = ['quick', 'stock', 'rooms', 'personnel', 'movements'];
const passportSections: PassportSection[] = ['overview', 'rooms', 'coverage', 'faults', 'movements'];
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
  IN_SERVICE: 'Arızalı / Bakım Bekliyor',
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

const faultPriorityLabels: Record<string, string> = { URGENT: 'Acil', HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
const FaultPriorityBadge = ({ priority = 'MEDIUM' }: { priority?: string }) => {
  const color = priority === 'URGENT' ? 'border-rose-300 bg-rose-100 text-rose-800' : priority === 'HIGH' ? 'border-orange-200 bg-orange-50 text-orange-800' : priority === 'LOW' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black ${color}`}>{faultPriorityLabels[priority] || priority}</span>;
};

const FaultStatusBadge = ({ status }: { status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }) => {
  const open = status === 'OPEN' || status === 'IN_PROGRESS';
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black ${open ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{open ? 'Açık' : 'Kapalı'}</span>;
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
  const [tab, setTabState] = useState<MainTab>(() => {
    const requested = new URLSearchParams(window.location.search).get('warehouseTab') as MainTab | null;
    return requested && warehouseTabs.includes(requested) ? requested : 'quick';
  });
  const [modal, setModal] = useState<ModalState>(null);
  const operationKeyRef = useRef('');

  // Enterprise UI States
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [passportModal, setPassportModal] = useState<StockItem | null>(null);
  const [passportSection, setPassportSection] = useState<PassportSection>('overview');
  const [passportSearch, setPassportSearch] = useState('');
  const [passportBlock, setPassportBlock] = useState('ALL');
  const [passportStatus, setPassportStatus] = useState<'ALL' | 'HEALTHY' | 'ISSUE'>('ALL');
  const [passportPage, setPassportPage] = useState(1);
  const [selectedRoomAssignmentId, setSelectedRoomAssignmentId] = useState<string | null>(null);
  const [deviceMovements, setDeviceMovements] = useState<StockMovement[]>([]);
  const [deviceMovementsLoading, setDeviceMovementsLoading] = useState(false);
  const passportReturnRef = useRef<{ itemId: string; section: PassportSection; tab: MainTab; roomInventoryId?: string } | null>(null);
  const [isExecutiveReportOpen, setIsExecutiveReportOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ item: StockItem; assignment?: RoomAssignment } | null>(null);
  const [detailExportLoading, setDetailExportLoading] = useState(false);
  const [detailExportError, setDetailExportError] = useState('');

  const [movementType, setMovementType] = useState<MovementType | 'ALL'>('ALL');
  const [movementDateStart, setMovementDateStart] = useState('');
  const [movementDateEnd, setMovementDateEnd] = useState('');
  const [movementStockItemId, setMovementStockItemId] = useState(() => new URLSearchParams(window.location.search).get('movementItemId') || '');
  const [movementPage, setMovementPage] = useState(1);
  const [movementResult, setMovementResult] = useState<StockMovementList>({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } });
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([]);
  const [detailMovementsLoading, setDetailMovementsLoading] = useState(false);
  const [standardForm, setStandardForm] = useState({ fixedQuantity: 0, quantityPerBed: 0, roomType: 'PERSONEL_ODASI' });
  const [cardForm, setCardForm] = useState({
    itemName: '',
    category: 'ODA DEMİRBAŞI',
    itemType: 'DEMİRBAŞ',
    unit: 'ADET',
    specifications: '',
    physicalStatus: 'KULLANILABİLİR',
    locationNote: '',
    totalStock: 1,
    isActive: true,
  });

  const [employeesList, setEmployeesList] = useState<Array<{ id: string; firstName: string; lastName: string; registrationNo?: string; department: string }>>([]);
  const [receiveForm, setReceiveForm] = useState({ quantity: 1, reason: 'DEPO GİRİŞİ', notes: '' });
  const [countForm, setCountForm] = useState({ countedAvailable: 0, notes: '' });
  const [assignForm, setAssignForm] = useState({ targetType: 'ROOM' as 'ROOM' | 'EMPLOYEE', stockItemId: '', roomId: '', employeeId: '', quantity: 1, brand: '', notes: '' });
  const [assignmentForm, setAssignmentForm] = useState({ action: 'TRANSFER', roomId: '', outcome: 'RETURNED' as 'RETURNED' | 'RETIRED', brand: '', notes: '' });

  const writeWarehouseUrl = (nextTab: MainTab, itemId?: string, section?: PassportSection, mode: 'push' | 'replace' = 'push', movementItemId?: string, roomInventoryId?: string) => {
    const url = managementUrl('warehouse', { warehouseTab: nextTab, stockItemId: itemId, stockSection: section, movementItemId, stockRoomInventoryId: roomInventoryId });
    const state = { tab: 'warehouse', warehouseTab: nextTab, ...(itemId ? { view: roomInventoryId ? 'stock-device-detail' : 'stock-passport', stockItemId: itemId, stockSection: section || 'overview' } : {}), ...(movementItemId ? { movementItemId } : {}), ...(roomInventoryId ? { stockRoomInventoryId: roomInventoryId } : {}), timestamp: Date.now() };
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](state, '', url.toString());
  };

  const navigateWarehouseTab = (nextTab: MainTab, mode: 'push' | 'replace' = 'push', movementItemId = '') => {
    setTabState(nextTab);
    setPassportModal(null);
    setSelectedRoomAssignmentId(null);
    setMovementStockItemId(nextTab === 'movements' ? movementItemId : '');
    setMovementPage(1);
    passportReturnRef.current = null;
    writeWarehouseUrl(nextTab, undefined, undefined, mode, nextTab === 'movements' ? movementItemId : undefined);
  };

  const openPassport = (item: StockItem, section: PassportSection = 'overview', mode: 'push' | 'replace' = 'push') => {
    setPassportModal(item);
    setSelectedRoomAssignmentId(null);
    setPassportSection(section);
    setPassportSearch('');
    setPassportBlock('ALL');
    setPassportStatus('ALL');
    setPassportPage(1);
    writeWarehouseUrl(tab, item.id, section, mode);
  };

  const openRoomAssignmentDetail = (assignment: RoomAssignment) => {
    if (!passportModal) return;
    setPassportSection('rooms');
    setSelectedRoomAssignmentId(assignment.id);
    writeWarehouseUrl(tab, passportModal.id, 'rooms', 'push', undefined, assignment.id);
  };

  const closeRoomAssignmentDetail = () => {
    setSelectedRoomAssignmentId(null);
    if (window.history.state?.view === 'stock-device-detail') window.history.back();
    else if (passportModal) writeWarehouseUrl(tab, passportModal.id, 'rooms', 'replace');
  };

  const closePassport = () => {
    setPassportModal(null);
    setSelectedRoomAssignmentId(null);
    if (window.history.state?.view === 'stock-passport') window.history.back();
    else writeWarehouseUrl(tab, undefined, undefined, 'replace');
  };

  const preparePassportAction = () => {
    if (!passportModal) return;
    passportReturnRef.current = { itemId: passportModal.id, section: passportSection, tab, roomInventoryId: selectedRoomAssignmentId || undefined };
    setPassportModal(null);
    writeWarehouseUrl(tab, undefined, undefined, 'replace');
  };

  const restorePassport = (source: StockOverview | null = overview) => {
    const target = passportReturnRef.current;
    if (!target || !source) return;
    const item = source.items.find((entry) => entry.id === target.itemId);
    passportReturnRef.current = null;
    if (item) {
      setTabState(target.tab);
      setPassportModal(item);
      setPassportSection(target.section);
      const roomInventoryId = target.roomInventoryId && item.roomInventories.some((assignment) => assignment.id === target.roomInventoryId) ? target.roomInventoryId : undefined;
      setSelectedRoomAssignmentId(roomInventoryId || null);
      setPassportSearch('');
      setPassportBlock('ALL');
      setPassportStatus('ALL');
      setPassportPage(1);
      writeWarehouseUrl(target.tab, item.id, target.section, 'replace', undefined, roomInventoryId);
    }
  };

  const closeModal = () => {
    setModal(null);
    restorePassport();
  };

  const loadOverview = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      const result = await stockApi.getOverview();
      setOverview(result);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stok verileri yüklenemedi.');
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!overview) return;
    const applyLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get('warehouseTab') as MainTab | null;
      const nextTab = requestedTab && warehouseTabs.includes(requestedTab) ? requestedTab : 'quick';
      const requestedSection = params.get('stockSection') as PassportSection | null;
      const nextSection = requestedSection && passportSections.includes(requestedSection) ? requestedSection : 'overview';
      const itemId = params.get('stockItemId');
      const movementItemId = nextTab === 'movements' ? params.get('movementItemId') || '' : '';
      const selectedItem = itemId ? overview.items.find((item) => item.id === itemId) || null : null;
      const requestedRoomInventoryId = params.get('stockRoomInventoryId');
      const roomInventoryId = selectedItem && requestedRoomInventoryId && selectedItem.roomInventories.some((assignment) => assignment.id === requestedRoomInventoryId) ? requestedRoomInventoryId : null;
      setTabState(nextTab);
      setPassportSection(nextSection);
      setPassportSearch('');
      setPassportBlock('ALL');
      setPassportStatus('ALL');
      setPassportPage(1);
      setMovementStockItemId(movementItemId);
      setMovementPage(1);
      setPassportModal(selectedItem);
      setSelectedRoomAssignmentId(roomInventoryId);
      const canonicalUrl = managementUrl('warehouse', { warehouseTab: nextTab, stockItemId: selectedItem?.id, stockSection: selectedItem ? nextSection : undefined, movementItemId, stockRoomInventoryId: roomInventoryId || undefined });
      if (canonicalUrl.toString() !== window.location.href) {
        window.history.replaceState({ tab: 'warehouse', warehouseTab: nextTab, ...(selectedItem ? { view: roomInventoryId ? 'stock-device-detail' : 'stock-passport', stockItemId: selectedItem.id, stockSection: nextSection } : {}), ...(movementItemId ? { movementItemId } : {}), ...(roomInventoryId ? { stockRoomInventoryId: roomInventoryId } : {}), timestamp: Date.now() }, '', canonicalUrl.toString());
      }
    };
    applyLocation();
    window.addEventListener('popstate', applyLocation);
    return () => window.removeEventListener('popstate', applyLocation);
  }, [overview]);

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

  useEffect(() => {
    if (!selectedRoomAssignmentId) { setDeviceMovements([]); return; }
    setDeviceMovementsLoading(true);
    stockApi.getMovements({ roomInventoryId: selectedRoomAssignmentId, page: 1, pageSize: 100 })
      .then((result) => setDeviceMovements(result.items))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Cihaz hareket geçmişi yüklenemedi.'))
      .finally(() => setDeviceMovementsLoading(false));
  }, [selectedRoomAssignmentId]);

  const filteredItems = useMemo(() => (overview?.items || []).filter((item) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const searchText = [item.itemName, item.itemCode, item.category, item.specifications, item.locationNote, stockLocations(item), ...item.roomInventories.map((inv) => `${inv.itemName} ${roomName(inv)}`)].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    const textMatches = !query || query.split(/\s+/).every((token) => searchText.includes(token));
    const categoryMatches = category === 'ALL' || item.category === category;
    const typeMatches = itemTypeFilter === 'ALL' || item.itemType === itemTypeFilter;
    const stockMatches = stockFilter === 'ALL'
      || (stockFilter === 'ISSUE' && item.issueCount > 0)
      || (stockFilter === 'ACTIVE' && item.isActive)
      || (stockFilter === 'PASSIVE' && !item.isActive);
    return textMatches && categoryMatches && typeMatches && stockMatches;
  }), [overview, search, category, itemTypeFilter, stockFilter]);

  const assignments = useMemo(() => filteredItems.flatMap((item) => item.roomInventories.map((assignment) => ({ item, assignment }))).filter(({ assignment }) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const searchText = [assignment.itemName, assignment.brand, roomName(assignment)].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    return !query || query.split(/\s+/).every((token) => searchText.includes(token));
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
      const refreshed = await loadOverview(true);
      restorePassport(refreshed);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };

  const openCreate = () => {
    operationKeyRef.current = generateUUID();
    setCardForm({
      itemName: '',
      category: 'ODA DEMİRBAŞI',
      itemType: 'DEMİRBAŞ',
      unit: 'ADET',
      specifications: '',
      physicalStatus: 'KULLANILABİLİR',
      locationNote: '',
      totalStock: 0,
      isActive: true,
    });
    setModal({ type: 'create' });
  };

  const openEdit = (item: StockItem) => {
    operationKeyRef.current = generateUUID();
    setCardForm({
      itemName: item.itemName,
      category: item.category || 'ODA DEMİRBAŞI',
      itemType: item.itemType || 'DEMİRBAŞ',
      unit: item.unit || 'ADET',
      specifications: item.specifications || '',
      physicalStatus: item.physicalStatus || 'KULLANILABİLİR',
      locationNote: item.locationNote || '',
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
    setReceiveForm({ quantity: 1, reason: 'DEPO GİRİŞİ', notes: '' });
    setModal({ type: 'receive', item: targetItem });
  };

  const openAssign = (item?: StockItem) => {
    operationKeyRef.current = generateUUID();
    if (employeesList.length === 0) {
      employeeApi.getEmployees('', 'RESIDENT').then((res) => setEmployeesList(res)).catch(() => {});
    }
    setAssignForm({ targetType: 'ROOM', stockItemId: item?.id || '', roomId: '', employeeId: '', quantity: 1, brand: '', notes: '' });
    setModal({ type: 'assign', item });
  };

  const openAssignment = (item: StockItem, assignment: RoomAssignment) => {
    operationKeyRef.current = generateUUID();
    setAssignmentForm({ action: hasOpenMaintenance(assignment) ? 'REPLACE' : 'TRANSFER', roomId: '', outcome: 'RETURNED', brand: assignment.brand || '', notes: '' });
    setModal({ type: 'assignment', item, assignment });
  };

  const handleDetailExport = async (sections: StockDetailExportSection[]) => {
    if (!exportTarget) return;
    try {
      setDetailExportLoading(true);
      setDetailExportError('');
      setError(null);
      await stockApi.exportDetailExcel(exportTarget.item.id, sections, exportTarget.assignment?.id);
      setExportTarget(null);
    } catch (caught) {
      setDetailExportError(caught instanceof Error ? caught.message : 'Excel raporu oluşturulamadı.');
    } finally {
      setDetailExportLoading(false);
    }
  };

  const stockDetailExportModal = exportTarget && (
    <StockDetailExportModal
      scope={exportTarget.assignment ? 'device' : 'stock'}
      title={exportTarget.assignment ? `${exportTarget.assignment.itemName} · ${roomName(exportTarget.assignment)}` : exportTarget.item.itemName}
      isExporting={detailExportLoading}
      exportError={detailExportError}
      onClose={() => { if (!detailExportLoading) { setExportTarget(null); setDetailExportError(''); } }}
      onExport={handleDetailExport}
    />
  );

  if (passportModal) {
    const faultHistory = passportModal.roomInventories
      .flatMap((assignment) => (assignment.maintenances || []).map((maintenance) => ({ assignment, maintenance })))
      .sort((a, b) => new Date(b.maintenance.createdAt).getTime() - new Date(a.maintenance.createdAt).getTime());
    const repeatedFaults = passportModal.roomInventories
      .map((assignment) => ({ assignment, faultCount: assignment.maintenances?.length || 0 }))
      .filter((entry) => entry.faultCount >= 2)
      .sort((a, b) => b.faultCount - a.faultCount);
    const normalizedPassportSearch = passportSearch.trim().toLocaleLowerCase('tr-TR');
    const roomBlocks = Array.from(new Set(passportModal.roomInventories.map((assignment) => assignment.room.block.name))).sort((a, b) => a.localeCompare(b, 'tr'));
    const filteredRoomAssignments = passportModal.roomInventories.filter((assignment) => {
      const searchable = `${roomName(assignment)} ${assignment.itemName} ${assignment.brand || ''}`.toLocaleLowerCase('tr-TR');
      return (!normalizedPassportSearch || normalizedPassportSearch.split(/\s+/).every((token) => searchable.includes(token)))
        && (passportBlock === 'ALL' || assignment.room.block.name === passportBlock)
        && (passportStatus === 'ALL' || (passportStatus === 'HEALTHY' ? assignment.status === 'HEALTHY' : assignment.status !== 'HEALTHY'));
    });
    const filteredMissingRooms = (passportModal.roomCoverage?.missingRooms || []).filter((room) =>
      !normalizedPassportSearch || `${room.blockName} oda ${room.roomNumber}`.toLocaleLowerCase('tr-TR').includes(normalizedPassportSearch));
    const filteredFaults = faultHistory.filter(({ assignment, maintenance }) =>
      !normalizedPassportSearch || `${assignment.itemName} ${roomName(assignment)} ${maintenance.description} ${maintenance.resolutionNote || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedPassportSearch));
    const filteredDetailMovements = detailMovements.filter((movement) =>
      !normalizedPassportSearch || `${movementLabels[movement.type] || movement.type} ${movement.roomLabelSnapshot || 'ana depo'} ${movement.reason || ''} ${movement.notes || ''}`.toLocaleLowerCase('tr-TR').includes(normalizedPassportSearch));
    const activeCollection = passportSection === 'rooms' ? filteredRoomAssignments
      : passportSection === 'coverage' ? filteredMissingRooms
        : passportSection === 'faults' ? filteredFaults
          : passportSection === 'movements' ? filteredDetailMovements : [];
    const pageSize = passportSection === 'rooms' ? 25 : 20;
    const totalPages = Math.max(1, Math.ceil(activeCollection.length / pageSize));
    const safePage = Math.min(passportPage, totalPages);
    const pageStart = (safePage - 1) * pageSize;
    const changePassportSection = (section: PassportSection) => {
      setPassportSection(section);
      setSelectedRoomAssignmentId(null);
      setPassportSearch('');
      setPassportBlock('ALL');
      setPassportStatus('ALL');
      setPassportPage(1);
      writeWarehouseUrl(tab, passportModal.id, section, 'replace');
    };
    const pageControls = activeCollection.length > pageSize && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-[11px] font-semibold text-slate-500">{pageStart + 1}-{Math.min(pageStart + pageSize, activeCollection.length)} / {activeCollection.length} kayıt</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={safePage === 1} onClick={() => setPassportPage((page) => Math.max(1, page - 1))} className={secondaryButton}>← Önceki</button>
          <span className="text-xs font-bold text-slate-700">{safePage} / {totalPages}</span>
          <button type="button" disabled={safePage === totalPages} onClick={() => setPassportPage((page) => Math.min(totalPages, page + 1))} className={secondaryButton}>Sonraki →</button>
        </div>
      </div>
    );

    const selectedAssignment = selectedRoomAssignmentId ? passportModal.roomInventories.find((assignment) => assignment.id === selectedRoomAssignmentId) : undefined;
    if (selectedAssignment) {
      const deviceFaults = [...(selectedAssignment.maintenances || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return (
        <div className="w-full space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <button type="button" onClick={closeRoomAssignmentDetail} className={secondaryButton}>← Oda Dağılımına Dön</button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a]">Cihaz Detay Sayfası</p>
                <h2 className="text-lg font-black text-slate-900">{selectedAssignment.itemName}</h2>
                <p className="text-xs font-semibold text-slate-500">{passportModal.itemName} · {roomName(selectedAssignment)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManageStock && <button type="button" onClick={() => { setDetailExportError(''); setExportTarget({ item: passportModal, assignment: selectedAssignment }); }} className={secondaryButton}><FileSpreadsheet className="h-3.5 w-3.5" /> Çıktı Al</button>}
              {canManageLifecycle && <button type="button" onClick={() => { const item = passportModal; preparePassportAction(); openAssignment(item, selectedAssignment); }} className={primaryButton}>Cihaz İşlemi Yap</button>}
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bulunduğu Yer</p><p className="mt-1 text-sm font-black text-slate-900">{roomName(selectedAssignment)}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{selectedAssignment.room.floor}. kat</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Odaya Veriliş Tarihi</p><p className="mt-1 text-sm font-black text-slate-900">{formatDateTime(selectedAssignment.installedAt)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Güncel Durum</p><div className="mt-2"><StatusBadge status={selectedAssignment.status} /></div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cihaz Bilgisi</p><p className="mt-1 text-sm font-black text-slate-900">{selectedAssignment.quantity} {passportModal.unit}</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{selectedAssignment.brand || 'Marka / model belirtilmedi'}</p></div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-black text-slate-900">Cihaz Hareket Geçmişi</h3><p className="mt-0.5 text-[11px] font-semibold text-slate-500">Yalnızca bu cihazın odaya veriliş, transfer ve durum değişiklikleri.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-white text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">İşlem</th><th className="px-4 py-3">Konum / Oda</th><th className="px-4 py-3 text-center">Miktar</th><th className="px-4 py-3">İşlemi Yapan</th><th className="px-4 py-3">Açıklama</th></tr></thead>
                <tbody className="divide-y divide-slate-200">{deviceMovementsLoading ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Cihaz geçmişi yükleniyor...</td></tr> : deviceMovements.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Bu cihaza ait hareket kaydı bulunmuyor.</td></tr> : deviceMovements.map((movement) => <tr key={movement.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(movement.createdAt)}</td><td className="px-4 py-3 font-black text-[#1e3a8a]">{movementLabels[movement.type] || movement.type}</td><td className="px-4 py-3 font-bold text-slate-800">{movement.roomLabelSnapshot || 'Ana Depo'}</td><td className="px-4 py-3 text-center font-black text-slate-900">{movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity} {movement.stockItem.unit}</td><td className="px-4 py-3 font-semibold text-slate-700">{movement.createdBy?.fullName || 'Sistem'}</td><td className="max-w-[300px] px-4 py-3 text-slate-600">{movement.notes || movement.reason || '-'}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-sm font-black text-slate-900">Cihaza Ait Arıza Geçmişi ({deviceFaults.length})</h3><p className="mt-0.5 text-[11px] font-semibold text-slate-500">Diğer odalardaki aynı ürünler bu tabloya dahil edilmez.</p></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="border-b border-slate-200 bg-white text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Arıza Açıklaması</th><th className="px-4 py-3">Öncelik</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Bildiren</th><th className="px-4 py-3">Kapatan</th><th className="px-4 py-3">Açılış Tarihi</th><th className="px-4 py-3">Kapanış Tarihi</th><th className="px-4 py-3">Kapanış Notu</th></tr></thead><tbody className="divide-y divide-slate-200">{deviceFaults.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-500">Bu cihaz için arıza kaydı bulunmuyor.</td></tr> : deviceFaults.map((fault) => <tr key={fault.id} className="hover:bg-slate-50"><td className="max-w-[280px] px-4 py-3"><p className="font-black text-slate-900">{fault.description}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{fault.title}</p></td><td className="px-4 py-3"><FaultPriorityBadge priority={fault.priority} /></td><td className="px-4 py-3"><FaultStatusBadge status={fault.status} /></td><td className="px-4 py-3 font-semibold text-slate-700">{fault.reportedBy || 'Sistem'}</td><td className="px-4 py-3 font-semibold text-slate-700">{fault.assignedTo || '-'}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(fault.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{fault.resolvedAt ? formatDateTime(fault.resolvedAt) : '-'}</td><td className="max-w-[260px] px-4 py-3 text-slate-600">{fault.resolutionNote || '-'}</td></tr>)}</tbody></table></div>
          </section>
          {stockDetailExportModal}
        </div>
      );
    }

    return (
      <div className="w-full space-y-4 animate-fadeIn">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={closePassport} className={secondaryButton}>← Stok Listesine Dön</button>
            <div>
              <h2 className="text-lg font-black text-slate-900">{passportModal.itemName}</h2>
              <p className="text-xs font-semibold text-slate-500">{passportModal.itemCode || 'KODSUZ'} · {passportModal.category} · Ürün Takip Sayfası</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canManageStock && <button type="button" onClick={() => { setDetailExportError(''); setExportTarget({ item: passportModal }); }} className={secondaryButton}><FileSpreadsheet className="h-3.5 w-3.5" /> Çıktı Al</button>}
            {canManageStock && <button type="button" onClick={() => { const item = passportModal; preparePassportAction(); openReceive(item); }} className={secondaryButton}>+ Depoya Ekle</button>}
            {canManageStock && <button type="button" onClick={() => { const item = passportModal; preparePassportAction(); openAssign(item); }} className={primaryButton}>Odaya / Personele Ver</button>}
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">{error}</div>}

        <nav className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs" aria-label="Ürün takip bölümleri">
          <div className="flex min-w-max gap-1">
            {([
              ['overview', 'Genel Bakış'],
              ['rooms', `Oda Dağılımı (${passportModal.roomInventories.length})`],
              ['coverage', `Eksik Odalar (${passportModal.roomCoverage?.missingRooms.length || 0})`],
              ['faults', `Arıza Geçmişi (${faultHistory.length})`],
              ['movements', 'Stok Hareketleri'],
            ] as Array<[PassportSection, string]>).map(([section, label]) => (
              <button key={section} type="button" onClick={() => changePassportSection(section)} className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${passportSection === section ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
        </nav>

        {passportSection === 'overview' && <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Toplam', passportModal.totalStock, 'text-slate-900'],
            ['Elde Kalan', passportModal.availableStock, 'text-emerald-700'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className={`mt-1 text-2xl font-black ${color}`}>{value} <span className="text-xs">{passportModal.unit}</span></p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h3 className="text-sm font-black text-slate-900">Hızlı Erişim</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">İncelemek istediğiniz bölüme geçin; uzun kayıtlar ayrı sayfalarda açılır.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {([
              ['rooms', Building2, 'Oda Dağılımı', 'Odalardaki cihazları ara ve yönet'],
              ['coverage', ClipboardCheck, 'Eksik Oda Kontrolü', 'Standart ve eksikleri incele'],
              ['faults', AlertTriangle, 'Arıza Geçmişi', 'Açılan ve kapanan kayıtları gör'],
              ['movements', History, 'Stok Hareketleri', 'Ürünün işlem geçmişini izle'],
            ] as const).map(([section, Icon, title, description]) => (
              <button key={section} type="button" onClick={() => changePassportSection(section)} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#1e3a8a] shadow-sm"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-900">{title}</span><span className="mt-0.5 block text-[10px] font-semibold text-slate-500">{description}</span></span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#1e3a8a]" />
              </button>
            ))}
          </div>
        </section>

        {repeatedFaults.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black text-rose-900"><AlertTriangle className="h-4 w-4" /> Tekrarlayan Arıza Uyarısı</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {repeatedFaults.map(({ assignment, faultCount }) => (
                <div key={assignment.id} className="rounded-lg border border-rose-200 bg-white p-3">
                  <p className="text-xs font-black text-slate-900">{assignment.itemName}</p>
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
                      <p className="text-[11px] font-black text-cyan-900">{asset.assetName}</p>
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
        </div>}

        {passportSection === 'rooms' && <div className="space-y-3">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="text-sm font-black text-slate-900">Oda Dağılımı ve Cihaz Durumu</h3><p className="text-[11px] font-semibold text-slate-500">Ürünleri oda ve ad bilgisine göre karşılaştırın.</p></div>
              <span className="text-xs font-bold text-slate-600">{filteredRoomAssignments.length} kayıt</span>
            </div>
            <div className="grid gap-2 border-b border-slate-200 p-3 md:grid-cols-[minmax(240px,1fr)_180px_180px]">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={passportSearch} onChange={(event) => { setPassportSearch(event.target.value); setPassportPage(1); }} className={`${inputClass} pl-9`} placeholder="Oda no veya cihaz adı ara..." /></label>
              <select value={passportBlock} onChange={(event) => { setPassportBlock(event.target.value); setPassportPage(1); }} className={inputClass}><option value="ALL">Tüm Bloklar</option>{roomBlocks.map((block) => <option key={block} value={block}>{block}</option>)}</select>
              <select value={passportStatus} onChange={(event) => { setPassportStatus(event.target.value as 'ALL' | 'HEALTHY' | 'ISSUE'); setPassportPage(1); }} className={inputClass}><option value="ALL">Tüm Durumlar</option><option value="HEALTHY">Sağlam</option><option value="ISSUE">Sorunlu</option></select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Oda</th><th className="px-3 py-2">Ürün Adı</th><th className="px-3 py-2">Adet</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Arıza</th><th className="px-3 py-2 text-right">İşlem</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRoomAssignments.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">Aramanıza uygun oda veya cihaz bulunamadı.</td></tr> : filteredRoomAssignments.slice(pageStart, pageStart + pageSize).map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">{roomName(assignment)}</td>
                      <td className="px-3 py-2.5 font-bold text-blue-900">{assignment.itemName}</td>
                      <td className="px-3 py-2.5 font-bold">{assignment.quantity}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={assignment.status} /></td>
                      <td className="px-3 py-2.5"><span className={`font-bold ${(assignment.maintenances?.length || 0) >= 2 ? 'text-rose-700' : 'text-slate-600'}`}>{assignment.maintenances?.length || 0}</span></td>
                      <td className="px-3 py-2.5 text-right"><div className="flex items-center justify-end gap-1.5"><button type="button" onClick={() => openRoomAssignmentDetail(assignment)} className="rounded-md border border-[#1e3a8a] bg-white px-2 py-1 text-[10px] font-bold text-[#1e3a8a] hover:bg-blue-50">Detay</button>{canManageLifecycle && <button type="button" onClick={() => { const item = passportModal; preparePassportAction(); openAssignment(item, assignment); }} className="rounded-md bg-[#1e3a8a] px-2 py-1 text-[10px] font-bold text-white">İşlem Yap</button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageControls}
          </section>
        </div>}

        {passportSection === 'coverage' && <section className="rounded-xl border border-slate-200 bg-white p-4">
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
                  <label className="relative mt-4 block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={passportSearch} onChange={(event) => { setPassportSearch(event.target.value); setPassportPage(1); }} className={`${inputClass} pl-9`} placeholder="Eksik odalarda ara..." /></label>
                  <div className="mt-3 space-y-1.5">{filteredMissingRooms.length === 0 ? <p className="rounded-lg bg-emerald-50 p-4 text-center text-xs font-semibold text-emerald-800">Eksik oda bulunmuyor.</p> : filteredMissingRooms.slice(pageStart, pageStart + pageSize).map((room) => <div key={room.roomId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs"><span className="font-bold text-slate-800">{room.blockName} / Oda {room.roomNumber}</span><span className="text-[11px] font-semibold text-slate-500">Olması gereken: {room.required} · Mevcut: {room.assigned}</span><span className="font-black text-rose-700">{room.missing} eksik</span></div>)}</div>
                  {pageControls}
                </div>
              )}
            </div>
          </section>}

        {passportSection === 'faults' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h3 className="text-sm font-black text-slate-900">Arıza Geçmişi</h3><p className="text-[11px] font-semibold text-slate-500">Cihaz adı, oda veya arıza açıklamasına göre arayın.</p></div><span className="text-xs font-bold text-slate-600">{filteredFaults.length} kayıt</span></div>
          <div className="border-b border-slate-200 p-3"><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={passportSearch} onChange={(event) => { setPassportSearch(event.target.value); setPassportPage(1); }} className={`${inputClass} pl-9`} placeholder="Oda, cihaz veya arıza açıklaması ara..." /></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Blok / Oda</th><th className="px-4 py-3">Cihaz</th><th className="px-4 py-3">Arıza Açıklaması</th><th className="px-4 py-3">Öncelik</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3">Bildiren</th><th className="px-4 py-3">Kapatan</th><th className="px-4 py-3">Açılış Tarihi</th><th className="px-4 py-3">Kapanış Tarihi</th><th className="px-4 py-3">Kapanış Notu</th></tr></thead><tbody className="divide-y divide-slate-200">{filteredFaults.length === 0 ? <tr><td colSpan={10} className="p-10 text-center font-semibold text-slate-500">Aramanıza uygun arıza kaydı bulunmuyor.</td></tr> : filteredFaults.slice(pageStart, pageStart + pageSize).map(({ assignment, maintenance }) => <tr key={maintenance.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3"><p className="font-black text-[#1e3a8a]">{assignment.room.block.name}</p><p className="mt-0.5 font-semibold text-slate-600">Oda {assignment.room.roomNumber} ({assignment.room.floor}. kat)</p></td><td className="max-w-[220px] px-4 py-3"><button type="button" onClick={() => openRoomAssignmentDetail(assignment)} className="text-left font-black text-slate-900 hover:text-[#1e3a8a] hover:underline">{assignment.itemName}</button><p className="mt-1 text-[10px] font-semibold text-slate-500">{assignment.brand || 'Marka belirtilmedi'}</p></td><td className="max-w-[280px] px-4 py-3"><p className="font-black text-slate-900">{maintenance.description}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{maintenance.title}</p></td><td className="px-4 py-3"><FaultPriorityBadge priority={maintenance.priority} /></td><td className="px-4 py-3"><FaultStatusBadge status={maintenance.status} /></td><td className="px-4 py-3 font-semibold text-slate-700">{maintenance.reportedBy || 'Sistem'}</td><td className="px-4 py-3 font-semibold text-slate-700">{maintenance.assignedTo || '-'}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(maintenance.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{maintenance.resolvedAt ? formatDateTime(maintenance.resolvedAt) : '-'}</td><td className="max-w-[260px] px-4 py-3 text-slate-600">{maintenance.resolutionNote || '-'}</td></tr>)}</tbody></table></div>
          {pageControls}
        </section>}

        {passportSection === 'movements' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h3 className="text-sm font-black text-slate-900">Stok Hareket Geçmişi</h3><p className="text-[11px] font-semibold text-slate-500">Depo girişleri, oda atamaları ve durum değişiklikleri.</p></div><button type="button" onClick={() => navigateWarehouseTab('movements', 'push', passportModal.id)} className={secondaryButton}>Gelişmiş Hareket Listesi →</button></div>
          <div className="border-b border-slate-200 p-3"><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={passportSearch} onChange={(event) => { setPassportSearch(event.target.value); setPassportPage(1); }} className={`${inputClass} pl-9`} placeholder="Hareket türü, oda veya açıklama ara..." /></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">İşlem Türü</th><th className="px-4 py-3">Ürün / Cihaz</th><th className="px-4 py-3">Konum / Oda</th><th className="px-4 py-3 text-center">Miktar</th><th className="px-4 py-3">İşlemi Yapan</th><th className="px-4 py-3">Gerekçe</th><th className="px-4 py-3">Açıklama</th></tr></thead><tbody className="divide-y divide-slate-200">{detailMovementsLoading ? <tr><td colSpan={8} className="p-10 text-center font-semibold text-slate-500">Geçmiş yükleniyor...</td></tr> : filteredDetailMovements.length === 0 ? <tr><td colSpan={8} className="p-10 text-center font-semibold text-slate-500">Aramanıza uygun stok hareketi bulunmuyor.</td></tr> : filteredDetailMovements.slice(pageStart, pageStart + pageSize).map((movement) => <tr key={movement.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(movement.createdAt)}</td><td className="px-4 py-3"><span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black text-[#1e3a8a]">{movementLabels[movement.type] || movement.type}</span></td><td className="max-w-[220px] px-4 py-3 font-black text-slate-900">{movement.itemNameSnapshot}</td><td className="px-4 py-3 font-bold text-slate-700">{movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}` : 'Ana Depo')}</td><td className={`px-4 py-3 text-center font-black ${movement.quantity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity} {movement.stockItem.unit}</td><td className="px-4 py-3 font-semibold text-slate-700">{movement.createdBy?.fullName || 'Sistem'}</td><td className="max-w-[220px] px-4 py-3 text-slate-600">{movement.reason || '-'}</td><td className="max-w-[260px] px-4 py-3 text-slate-600">{movement.notes || '-'}</td></tr>)}</tbody></table></div>
          {pageControls}
        </section>}
        {stockDetailExportModal}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
              onClick={() => navigateWarehouseTab('rooms')}
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
              placeholder="Oda No, Kod veya Ürün Adı ara..."
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
              <option value="ISSUE">Bakım / Arıza</option>
            </select>
          </div>
        </div>
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
              onClick={() => navigateWarehouseTab(value)}
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
                        <tr key={item.id} className="cursor-pointer hover:bg-blue-50/60" onClick={() => openPassport(item)}>
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
                            <button type="button" onClick={() => openPassport(item)} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1e3a8a] bg-white px-2 text-[11px] font-bold text-[#1e3a8a] hover:bg-blue-50">
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
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 grid grid-cols-2 gap-2 text-center">
                              <div>
                                <span className="text-[10px] font-bold text-slate-500 block">Depoda</span>
                                <span className="text-base font-bold text-emerald-700">
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

                          </div>

                          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => openPassport(item)}
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
                      <th className="px-2 py-2 text-right whitespace-nowrap">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      <tr><td colSpan={9} className="p-8 text-center font-semibold text-slate-500">Stok kayıtları yükleniyor...</td></tr>
                    ) : filteredItems.length === 0 ? (
                      <tr><td colSpan={9} className="p-8 text-center font-semibold text-slate-600">Kayıt bulunamadı.</td></tr>
                    ) : (
                      filteredItems.map((item, idx) => {
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
                            <td className="px-2 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button type="button" onClick={() => openPassport(item)} className="p-1 text-[#1e3a8a] hover:bg-blue-50 rounded cursor-pointer" title="Ürün Pasaportu"><FileText className="w-4 h-4" /></button>
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
                  <th className="px-2.5 py-2 border-r border-slate-200">Marka / Model</th>
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
                      <td className="px-2.5 py-2 border-r border-slate-200 text-[11px] text-slate-600">{assignment.brand || '-'}</td>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          onClose={closeModal}
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
                <span>2. Niteliği, Birimi ve Toplam Adet</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              </div>
            </div>

            {/* 3. FİZİKİ DURUM VE KONUM */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>3. Fiziki Durum ve Depo Konumu</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <button type="button" onClick={closeModal} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !cardForm.itemName.trim()} className={primaryButton}>
                {busy ? 'İşleniyor...' : modal?.type === 'create' ? 'Kartı Oluştur' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: RECEIVE GOODS */}
      {modal?.type === 'receive' && (
        <ModalShell onClose={closeModal} icon={<ArrowDownToLine className="h-4 w-4" />} title={`Depoya Giriş Yap: ${modal.item.itemName}`}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => stockApi.receive(modal.item.id, receiveForm, operationKeyRef.current), 'Depo girişi tamamlandı.'); }} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label><span className={labelClass}>Giriş Miktarı ({modal.item.unit}) *</span><input type="number" min={1} required className={inputClass} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })} /></label>
              <label><span className={labelClass}>Giriş Gerekçesi *</span><input className={inputClass} value={receiveForm.reason} onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })} /></label>
            </div>
            <label><span className={labelClass}>Not / Açıklama</span><textarea rows={2} className={`${inputClass} h-auto py-2`} value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Yönetimsel açıklama..." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={closeModal} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || receiveForm.quantity < 1} className={primaryButton}>{busy ? 'İşleniyor...' : 'Depoya Ekle'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: ASSIGN TO ROOM OR EMPLOYEE */}
      {modal?.type === 'assign' && (
        <ModalShell onClose={closeModal} icon={<Send className="h-4 w-4" />} title="Odaya veya Personele Zimmet Ver">
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
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label><span className={labelClass}>Miktar *</span><input type="number" min={1} required className={inputClass} value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: Number(e.target.value) })} /></label>
                  <label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignForm.brand} onChange={(e) => setAssignForm({ ...assignForm, brand: e.target.value })} placeholder="Marka" /></label>
                </div>
              );
            })()}

            <label><span className={labelClass}>Zimmet Açıklaması</span><input className={inputClass} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} placeholder="Not..." /></label>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={closeModal} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || (!assignForm.stockItemId && !modal.item?.id) || (assignForm.targetType === 'ROOM' ? !assignForm.roomId : !assignForm.employeeId)} className={primaryButton}>{busy ? 'İşleniyor...' : 'Zimmetle'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MODAL: ASSIGNMENT PROCESS (Transfer / Replacement / Return) */}
      {modal?.type === 'assignment' && (
        <ModalShell onClose={closeModal} icon={<ClipboardCheck className="h-4 w-4" />} title="Oda Zimmet Sürecini Yönet" subtitle={`${roomName(modal.assignment)} · ${modal.item.itemName}`}>
          <form onSubmit={(event) => { event.preventDefault(); const { assignment } = modal; if (assignmentForm.action === 'TRANSFER') runAction(() => stockApi.transferAssignment(assignment.id, { roomId: assignmentForm.roomId, notes: assignmentForm.notes }, operationKeyRef.current), 'Zimmet transfer edildi.'); else if (assignmentForm.action === 'RETURN') runAction(() => stockApi.returnAssignment(assignment.id, { outcome: assignmentForm.outcome, notes: assignmentForm.notes }, operationKeyRef.current), 'İade tamamlandı.'); else if (assignmentForm.action === 'IDENTITY') runAction(() => stockApi.updateAssignmentIdentity(assignment.id, { brand: assignmentForm.brand, notes: assignmentForm.notes }, operationKeyRef.current), 'Bilgiler güncellendi.'); else runAction(() => stockApi.replaceAssignment(assignment.id, { brand: assignmentForm.brand, notes: assignmentForm.notes }, operationKeyRef.current), 'Ürün değiştirildi.'); }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <div><p className="font-semibold text-slate-500">Marka / Model</p><p className="font-bold text-slate-800">{modal.assignment.brand || '-'}</p></div>
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
            {assignmentForm.action === 'IDENTITY' && <label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label>}
            {assignmentForm.action === 'REPLACE' && <label><span className={labelClass}>Yeni Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label>}
            <label><span className={labelClass}>İşlem Açıklaması *</span><textarea required rows={2} className={`${inputClass} h-auto py-2`} value={assignmentForm.notes} onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} placeholder="Açıklama yazın..." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={closeModal} className={secondaryButton}>Vazgeç</button><button disabled={busy || !assignmentForm.notes.trim()} className={primaryButton}>{busy ? 'İşleniyor...' : 'Onayla'}</button></div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
