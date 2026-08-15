import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowDownToLine, ArrowRightLeft, Building2, Check, ChevronDown,
  ChevronRight, ClipboardCheck, Download, Edit3, Eye, Filter, History, MapPin, Package,
  Plus, RefreshCw, RotateCcw, Search, Send, ShieldAlert, Sparkles, Tag, Wrench, X,
} from 'lucide-react';
import { AssignmentStatus, MovementType, RoomAssignment, StockItem, StockMovement, StockMovementList, StockOverview, stockApi } from '../api/stockApi';
import { User } from '../api/authApi';
import { can } from '../security/accessControl';
import { generateUUID } from '../utils/cryptoHelpers';

type MainTab = 'stock' | 'rooms' | 'personnel' | 'movements';
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

const inputClass = 'w-full min-h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold text-slate-900 transition placeholder:normal-case';
const labelClass = 'block mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-700';
const primaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#1e3a8a] bg-[#1e3a8a] px-3 text-[11px] font-extrabold text-white shadow-xs transition-all hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-extrabold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-[#1e3a8a] disabled:opacity-50';

const StatusBadge = ({ status }: { status: AssignmentStatus }) => {
  const color = status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : ['MAINTENANCE_REQUIRED', 'REPLACEMENT_REQUIRED'].includes(status) ? 'bg-amber-50 text-amber-800 border-amber-200'
      : status === 'IN_SERVICE' ? 'bg-blue-50 text-blue-800 border-blue-200'
        : 'bg-rose-50 text-rose-800 border-rose-200';
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold whitespace-nowrap ${color}`}>{statusLabels[status]}</span>;
};

const PhysicalStatusPill = ({ status }: { status?: string }) => {
  const st = status || 'KULLANILABİLİR';
  const style = st === 'KULLANILABİLİR' ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : st === 'KULLANIMDA' ? 'bg-blue-50 text-blue-800 border-blue-300'
      : st === 'BAKIMDA' ? 'bg-amber-50 text-amber-800 border-amber-300'
        : 'bg-rose-50 text-rose-800 border-rose-300';
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-extrabold whitespace-nowrap ${style}`}>{st}</span>;
};

const ModalShell: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={onClose}>
    <div className={`max-h-[94vh] w-full overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl ${wide ? 'max-w-7xl' : 'max-w-4xl'}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-[#1e3a8a]">{icon}</div>
          <div><h3 className="text-lg font-black text-slate-900">{title}</h3><p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{subtitle}</p></div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-white p-1.5 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-200 hover:text-slate-900"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(92vh-74px)] overflow-y-auto p-5">{children}</div>
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

  useEffect(() => {
    setQuery(value);
  }, [value]);

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
          placeholder="Konum arayın veya seçin (Örn: Ana Depo, A-Blok / Oda 101)..."
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
              "{query}" ile eşleşen kayıtlı konum bulunamadı. Yazmaya devam edebilirsiniz.
            </div>
          ) : (
            filtered.map((opt) => {
              const isRoom = opt.includes('Oda');
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
  const [tab, setTab] = useState<MainTab>('stock');
  const [modal, setModal] = useState<ModalState>(null);
  const operationKeyRef = useRef('');
  const [movementType, setMovementType] = useState<MovementType | 'ALL'>('ALL');
  const [movementDateStart, setMovementDateStart] = useState('');
  const [movementDateEnd, setMovementDateEnd] = useState('');
  const [movementStockItemId, setMovementStockItemId] = useState('');
  const [movementPage, setMovementPage] = useState(1);
  const [movementResult, setMovementResult] = useState<StockMovementList>({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } });
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([]);
  const [detailMovementsLoading, setDetailMovementsLoading] = useState(false);

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

  const [receiveForm, setReceiveForm] = useState({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' });
  const [countForm, setCountForm] = useState({ countedAvailable: 0, notes: '' });
  const [assignForm, setAssignForm] = useState({ stockItemId: '', roomId: '', roomIds: [] as string[], quantity: 1, mode: 'SINGLE' as 'SINGLE' | 'SELECTED' | 'ALL', roomSearch: '', brand: '', serialNo: '', notes: '' });
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

  const categories = useMemo(() => Array.from(new Set((overview?.items || []).map((item) => item.category))).sort(), [overview]);

  const filteredItems = useMemo(() => (overview?.items || []).filter((item) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const textMatches = !query || [item.itemName, item.itemCode, item.category, item.specifications, item.locationNote, stockLocations(item)].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
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

  const movements = movementResult.items;

  const registeredLocations = useMemo(() => {
    return Array.from(
      new Set(
        (overview?.items || [])
          .map((item) => item.locationNote)
          .filter((note): note is string => Boolean(note && note.trim()))
      )
    ).sort();
  }, [overview]);

  const personnelAssignments = useMemo(() => filteredItems.flatMap((item) => item.inventories.map((assignment) => ({ item, assignment }))).filter(({ assignment }) => {
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
      category: item.category,
      itemType: item.itemType || 'DEMİRBAŞ',
      unit: item.unit,
      specifications: item.specifications || '',
      physicalStatus: item.physicalStatus || 'KULLANILABİLİR',
      warrantyEndDate: item.warrantyEndDate ? item.warrantyEndDate.split('T')[0] : '',
      locationNote: item.locationNote || '',
      minimumStock: item.minimumStock,
      totalStock: item.totalStock,
      isActive: item.isActive,
    });
    setModal({ type: 'edit', item });
  };

  const openReceive = (item: StockItem) => { operationKeyRef.current = generateUUID(); setReceiveForm({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' }); setModal({ type: 'receive', item }); };
  const openCount = (item: StockItem) => { operationKeyRef.current = generateUUID(); setCountForm({ countedAvailable: item.availableStock, notes: '' }); setModal({ type: 'count', item }); };
  const openAssign = (item?: StockItem) => {
    operationKeyRef.current = generateUUID();
    setAssignForm({ stockItemId: item?.id || '', roomId: '', roomIds: [], quantity: 1, mode: 'SINGLE', roomSearch: '', brand: '', serialNo: '', notes: '' });
    setModal({ type: 'assign', item });
  };
  const openAssignment = (item: StockItem, assignment: RoomAssignment) => {
    operationKeyRef.current = generateUUID();
    setAssignmentForm({ action: !assignment.serialNo && item.itemType !== 'SARF_MALZEME' ? 'IDENTITY' : assignment.maintenances?.length ? 'REPLACE' : 'TRANSFER', roomId: '', outcome: 'RETURNED', brand: assignment.brand || '', serialNo: assignment.serialNo || '', notes: '' });
    setModal({ type: 'assignment', item, assignment });
  };
  const openDetail = (item: StockItem) => {
    setDetailMovements([]);
    setDetailMovementsLoading(true);
    setModal({ type: 'detail', item });
    stockApi.getMovements({ stockItemId: item.id, page: 1, pageSize: 20 })
      .then((result) => setDetailMovements(result.items))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Ürün geçmişi yüklenemedi.'))
      .finally(() => setDetailMovementsLoading(false));
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden animate-fadeIn">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#1e3a8a]" /> Depo ve Stok Yönetimi (Excel Grid)
          </h2>
          <p className="text-[11px] font-semibold text-slate-500">
            Malzeme kodları, depodaki yedekler, zimmet miktarları ve garanti durumlarının canlı takibi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageStock && <button type="button" onClick={() => runAction(stockApi.exportExcel, 'Excel raporu indirildi.')} className={secondaryButton}>
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Excel İndir (.xlsx)
          </button>}
          {canManageStock && <button type="button" onClick={() => openAssign()} className={secondaryButton}>
            <Send className="h-3.5 w-3.5 text-blue-600" /> Odaya Zimmetle
          </button>}
          {canManageStock && <button type="button" onClick={openCreate} className={primaryButton}>
            <Plus className="h-3.5 w-3.5" /> Yeni Stok Ekle
          </button>}
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
              onChange={(event) => { setSearch(event.target.value); setMovementPage(1); }}
              placeholder="Malzeme kodu, adı, özellik, detay veya konum ara..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-9 min-w-[150px] appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
              >
                <option value="ALL">Tüm Kategoriler</option>
                {STOCK_CATEGORIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <select
              value={itemTypeFilter}
              onChange={(event) => setItemTypeFilter(event.target.value)}
              className="h-9 min-w-[125px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
            >
              <option value="ALL">Tüm Tipler</option>
              <option value="DEMİRBAŞ">Demirbaş</option>
              <option value="SARF_MALZEME">Sarf Malzeme</option>
            </select>
            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="h-9 min-w-[135px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="CRITICAL">⚠️ Kritik Stok</option>
              <option value="ISSUE">🔧 Bakım / Arıza</option>
              <option value="ACTIVE">Aktif Kartlar</option>
              <option value="PASSIVE">Pasif Kartlar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Excel Grid Main Tabs */}
      <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 p-2">
          {([
            ['stock', 'Excel Stok Grid Tablosu', `${filteredItems.length}`, Package],
            ['rooms', 'Aktif Oda Zimmetleri', `${assignments.length}`, Building2],
            ['personnel', 'Aktif Personel Zimmetleri', `${personnelAssignments.length}`, ClipboardCheck],
            ['movements', 'Hareket Geçmişi', `${movementResult.pagination.total}`, History],
          ] as Array<[MainTab, string, string, React.ElementType]>).map(([value, label, count, Icon]) => (
            <button
              key={String(value)}
              onClick={() => setTab(value)}
              className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[10px] font-extrabold transition ${tab === value ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#1e3a8a]'}`}
            >
              <Icon className="h-3.5 w-3.5" />{label}
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${tab === value ? 'bg-white/20' : 'bg-slate-200'}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Excel Grid Table View */}
        {tab === 'stock' && (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-700 select-none">
                  <th className="px-1.5 py-2 border-r border-slate-200 bg-slate-200/60 text-center w-7">#</th>
                  <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Kod</th>
                  <th className="px-2.5 py-2 border-r border-slate-200">Malzeme Adı</th>
                  <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Kategori</th>
                  <th className="px-1.5 py-2 border-r border-slate-200 text-center whitespace-nowrap">Tip</th>
                  <th className="px-2 py-2 border-r border-slate-200 hidden md:table-cell">Özellik / Detay</th>
                  <th className="px-1.5 py-2 border-r border-slate-200 text-center bg-blue-50/70 text-blue-900 whitespace-nowrap" title="Henüz kimseye veya odaya zimmetlenmemiş, ana depoda bulunan miktar">Ana Depoda</th>
                  <th className="px-1.5 py-2 border-r border-slate-200 text-center whitespace-nowrap" title="Odalara veya personele zimmetlenmiş toplam miktar">Toplam Zimmetli</th>
                  <th className="px-1.5 py-2 border-r border-slate-200 text-center font-black whitespace-nowrap" title="Ana depodaki ve zimmetteki tüm ürünler">Toplam Envanter</th>
                  <th className="px-1 py-2 border-r border-slate-200 text-center whitespace-nowrap">Birim</th>
                  <th className="px-2 py-2 border-r border-slate-200 whitespace-nowrap">Durum</th>
                  <th className="px-1.5 py-2 border-r border-slate-200 text-center hidden lg:table-cell whitespace-nowrap">Kritik Stok</th>
                  <th className="px-2 py-2 border-r border-slate-200 hidden lg:table-cell whitespace-nowrap">Garanti</th>
                  <th className="px-2 py-2 border-r border-slate-200 hidden xl:table-cell whitespace-nowrap">Miktar Dağılımı / Konumlar</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={15} className="p-8 text-center font-bold text-slate-500">Stok kayıtları yükleniyor...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-8 text-center">
                      <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="font-extrabold text-slate-800">Kayıt bulunamadı</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Arama veya filtre kriterlerini değiştirin.</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                    const critical = item.availableStock <= item.minimumStock;
                    const usedTotal = item.usedStock + item.usedInRooms;
                    const warrantyExpiringSoon = item.warrantyEndDate && (new Date(item.warrantyEndDate).getTime() - new Date().getTime() < 30 * 86400000);

                    return (
                      <tr key={item.id} className={`group transition hover:bg-blue-50/40 ${!item.isActive ? 'opacity-60 bg-slate-50' : critical ? 'bg-amber-50/25' : idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                        {/* Index */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center text-[10px] font-extrabold text-slate-400">{idx + 1}</td>
                        {/* Item Code */}
                        <td className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                          <span className="font-black text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-tight">
                            {item.itemCode || 'KODSUZ'}
                          </span>
                        </td>
                        {/* Item Name */}
                        <td className="px-2.5 py-1.5 border-r border-slate-200 max-w-[180px] truncate" title={item.itemName}>
                          <button onClick={() => openDetail(item)} className="font-black text-slate-900 hover:text-[#1e3a8a] text-left truncate w-full">
                            {item.itemName}
                          </button>
                        </td>
                        {/* Category */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-[10px] font-extrabold text-slate-600 whitespace-nowrap">
                          {item.category}
                        </td>
                        {/* Item Type */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center whitespace-nowrap">
                          <span className={`inline-flex rounded border px-1 py-0.5 text-[8px] font-black uppercase ${item.itemType === 'SARF_MALZEME' ? 'border-purple-200 bg-purple-50 text-purple-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>
                            {item.itemType === 'SARF_MALZEME' ? 'Sarf' : 'Demirbaş'}
                          </span>
                        </td>
                        {/* Specifications */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-[10px] font-semibold text-slate-600 truncate max-w-[130px] hidden md:table-cell" title={item.specifications || ''}>
                          {item.specifications || '-'}
                        </td>
                        {/* Warehouse Available Stock */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center bg-blue-50/30 whitespace-nowrap">
                          <span className={`inline-flex min-w-[30px] justify-center rounded border px-1.5 py-0.5 font-black text-[11px] ${critical ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
                            {item.availableStock}
                          </span>
                        </td>
                        {/* Used Stock */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center font-bold text-violet-700 text-[11px] whitespace-nowrap">
                          {usedTotal}
                        </td>
                        {/* Total Stock */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center font-black text-slate-900 bg-slate-50/50 text-[11px] whitespace-nowrap">
                          {item.totalStock}
                        </td>
                        {/* Unit */}
                        <td className="px-1 py-1.5 border-r border-slate-200 text-center text-[9px] font-extrabold text-slate-500 whitespace-nowrap">
                          {item.unit}
                        </td>
                        {/* Physical Status */}
                        <td className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                          <PhysicalStatusPill status={item.physicalStatus} />
                        </td>
                        {/* Minimum Stock Level */}
                        <td className="px-1.5 py-1.5 border-r border-slate-200 text-center hidden lg:table-cell whitespace-nowrap">
                          {critical ? (
                            <span className="inline-flex items-center gap-0.5 rounded border border-rose-300 bg-rose-100 px-1 py-0.5 text-[8px] font-black text-rose-800">
                              <AlertTriangle className="h-2.5 w-2.5" /> Min {item.minimumStock}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-500">Min {item.minimumStock}</span>
                          )}
                        </td>
                        {/* Warranty Expiration */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-[9px] font-semibold hidden lg:table-cell whitespace-nowrap">
                          {item.warrantyEndDate ? (
                            <span className={`inline-flex items-center gap-1 ${warrantyExpiringSoon ? 'font-black text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded' : 'text-slate-700'}`}>
                              {formatDateOnly(item.warrantyEndDate)}
                            </span>
                          ) : '-'}
                        </td>
                        {/* Location / Note */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-[9px] font-semibold text-slate-600 truncate max-w-[160px] hidden xl:table-cell" title={stockLocations(item)}>
                          {stockLocations(item)}
                        </td>
                        {/* Actions */}
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <div className="inline-flex gap-0.5">
                            {canManageStock && <button onClick={() => openReceive(item)} className="rounded border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 transition hover:bg-emerald-100" title="Depo Girişi Ekle">
                              <ArrowDownToLine className="h-3 w-3" />
                            </button>}
                            {canManageStock && <button onClick={() => openCount(item)} className="rounded border border-violet-200 bg-violet-50 p-1 text-violet-700 transition hover:bg-violet-100" title="Fiziksel Sayım">
                              <ClipboardCheck className="h-3 w-3" />
                            </button>}
                            {canManageStock && <button disabled={!item.isActive || item.availableStock <= 0} onClick={() => openAssign(item)} className="rounded border border-blue-200 bg-blue-50 p-1 text-blue-700 transition hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed" title="Odaya Zimmetle">
                              <Send className="h-3 w-3" />
                            </button>}
                            <button onClick={() => openDetail(item)} className="rounded border border-slate-200 bg-white p-1 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" title="Detay">
                              <Eye className="h-3 w-3" />
                            </button>
                            {canManageStock && <button onClick={() => openEdit(item)} className="rounded border border-slate-200 bg-white p-1 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" title="Düzenle">
                              <Edit3 className="h-3 w-3" />
                            </button>}
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

        {/* Tab 2: Room Assignments */}
        {tab === 'rooms' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5">Oda</th>
                  <th className="px-3 py-2.5">Zimmetli Ürün</th>
                  <th className="px-3 py-2.5 text-center">Adet</th>
                  <th className="px-3 py-2.5">Zimmet Tarihi</th>
                  <th className="px-3 py-2.5">Durum</th>
                  <th className="px-3 py-2.5">Not</th>
                  <th className="px-3 py-2.5 text-right">Süreç Yönetimi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assignments.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">Filtreye uygun aktif oda zimmeti bulunamadı.</td></tr>
                ) : (
                  assignments.map(({ item, assignment }) => (
                    <tr key={assignment.id} className="transition hover:bg-blue-50/35">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{assignment.room.block.name} · Oda {assignment.room.roomNumber}</p>
                            <p className="text-[9px] font-semibold text-slate-500">{assignment.room.floor}. Kat</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-black text-slate-900">{item.itemName}</p>
                        <p className="text-[9px] font-bold text-slate-500">{item.itemCode || 'KODSUZ'} · {item.category}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black">{assignment.quantity}</td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{formatDateTime(assignment.installedAt)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={assignment.status} /></td>
                      <td className="max-w-[190px] truncate px-3 py-2.5 text-[10px] font-semibold text-slate-500" title={assignment.notes || ''}>{assignment.notes || '-'}</td>
                      <td className="px-3 py-2.5 text-right">
                        {canManageLifecycle && <button onClick={() => openAssignment(item, assignment)} className={secondaryButton}>
                          <ClipboardCheck className="h-3.5 w-3.5" /> İşlem Yap <ChevronRight className="h-3 w-3" />
                        </button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Personnel Assignments */}
        {tab === 'personnel' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5">Personel</th>
                  <th className="px-3 py-2.5">Sicil / Departman</th>
                  <th className="px-3 py-2.5">Zimmetli Ürün</th>
                  <th className="px-3 py-2.5">Stok Kodu</th>
                  <th className="px-3 py-2.5">Zimmet Tarihi</th>
                  <th className="px-3 py-2.5">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {personnelAssignments.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center font-bold text-slate-500">Filtreye uygun aktif personel zimmeti bulunamadı.</td></tr>
                ) : (
                  personnelAssignments.map(({ item, assignment }) => (
                    <tr key={assignment.id} className="transition hover:bg-blue-50/35">
                      <td className="px-3 py-2.5"><p className="font-black text-slate-900">{assignment.employee.firstName} {assignment.employee.lastName}</p></td>
                      <td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-700">{assignment.employee.registrationNo || 'Sicil yok'}</p><p className="text-[9px] font-semibold text-slate-500">{assignment.employee.department}</p></td>
                      <td className="px-3 py-2.5 font-black text-slate-900">{item.itemName}</td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{item.itemCode || 'KODSUZ'}</td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{formatDateTime(assignment.assignedDate)}</td>
                      <td className="px-3 py-2.5"><span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold text-violet-800">Personelde</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Movement History */}
        {tab === 'movements' && (
          <div>
            <div className="grid gap-2 border-b border-slate-200 bg-blue-50/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label><span className={labelClass}>Ürün</span><select value={movementStockItemId} onChange={(e) => { setMovementStockItemId(e.target.value); setMovementPage(1); }} className={inputClass}><option value="">Tüm stok kartları</option>{(overview?.items || []).map((item) => <option key={item.id} value={item.id}>{item.itemCode || 'KODSUZ'} · {item.itemName}</option>)}</select></label>
              <label><span className={labelClass}>Hareket Türü</span><select value={movementType} onChange={(e) => { setMovementType(e.target.value as MovementType | 'ALL'); setMovementPage(1); }} className={inputClass}><option value="ALL">Tüm hareketler</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className={labelClass}>Başlangıç Tarihi</span><input type="date" value={movementDateStart} onChange={(e) => { setMovementDateStart(e.target.value); setMovementPage(1); }} className={inputClass} /></label>
              <label><span className={labelClass}>Bitiş Tarihi</span><input type="date" value={movementDateEnd} onChange={(e) => { setMovementDateEnd(e.target.value); setMovementPage(1); }} className={inputClass} /></label>
              <div className="flex items-end"><button type="button" onClick={() => { setMovementStockItemId(''); setMovementType('ALL'); setMovementDateStart(''); setMovementDateEnd(''); setMovementPage(1); }} className={`${secondaryButton} min-h-11 w-full`}>Filtreleri Temizle</button></div>
            </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-2.5">Tarih / Yetkili</th>
                  <th className="px-3 py-2.5">Stok Kartı</th>
                  <th className="px-3 py-2.5">Hareket</th>
                  <th className="px-3 py-2.5 text-center">Miktar</th>
                  <th className="px-3 py-2.5">Oda / Personel</th>
                  <th className="px-3 py-2.5">Seri No</th>
                  <th className="px-3 py-2.5">Neden / Açıklama</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movementsLoading ? (
                  <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">Hareket geçmişi yükleniyor...</td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">Seçilen filtrelere uygun hareket kaydı bulunamadı.</td></tr>
                ) : (
                  movements.map((movement) => {
                    const target = movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}${movement.employee.registrationNo ? ` · ${movement.employee.registrationNo}` : ''}` : '-');
                    return (
                      <tr key={movement.id} className="transition hover:bg-blue-50/35">
                        <td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-800">{formatDateTime(movement.createdAt)}</p><p className="text-[9px] font-semibold text-slate-500">{movement.createdBy?.fullName || 'Sistem'}</p></td>
                        <td className="px-3 py-2.5"><p className="font-black text-slate-900">{movement.itemNameSnapshot}</p><p className="text-[9px] font-bold text-slate-500">{movement.stockItem.itemCode || 'KODSUZ'}</p></td>
                        <td className="px-3 py-2.5"><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-800">{movementLabels[movement.type] || movement.type}</span></td>
                        <td className={`px-3 py-2.5 text-center font-black ${movement.quantity > 0 ? 'text-emerald-700' : movement.quantity < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.stockItem.unit}</td>
                        <td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">{target}</td>
                        <td className="px-3 py-2.5 text-[10px] font-semibold text-slate-600">{movement.serialNo || '-'}</td>
                        <td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-700">{movement.reason || '-'}</p><p className="max-w-[260px] truncate text-[9px] font-semibold text-slate-500">{movement.notes || '-'}</p></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600"><span>Toplam {movementResult.pagination.total} kayıt · Sayfa {movementResult.pagination.page}/{movementResult.pagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={movementPage <= 1 || movementsLoading} onClick={() => setMovementPage((value) => Math.max(1, value - 1))} className={secondaryButton}>Önceki</button><button type="button" disabled={movementPage >= movementResult.pagination.totalPages || movementsLoading} onClick={() => setMovementPage((value) => value + 1)} className={secondaryButton}>Sonraki</button></div></div>
          </div>
        )}
      </div>

      {/* Modal: Create & Edit Stock Item */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <ModalShell
          onClose={() => setModal(null)}
          icon={modal.type === 'create' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          title={modal.type === 'create' ? 'Yeni Stok Kartı ve Malzeme Ekle' : 'Stok Kartını Düzenle'}
          subtitle="Malzeme adı, detay, stok miktarı ve durumunu tanımlayın. Malzeme kodu arka planda otomatik oluşturulur."
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runAction(
                () => modal.type === 'create'
                  ? stockApi.createStockItem(cardForm, operationKeyRef.current)
                  : stockApi.updateStockItem(modal.item.id, cardForm, operationKeyRef.current),
                modal.type === 'create' ? 'Stok kartı oluşturuldu.' : 'Stok kartı güncellendi.'
              );
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-semibold leading-relaxed text-blue-950"><strong className="block text-sm">Stok kartı kalıcı ürün kimliğidir.</strong>{modal.type === 'create' ? 'Başlangıç miktarı otomatik açılış hareketi oluşturur. Demirbaşlar oda veya personele gönderilirken tekil seri numarasıyla izlenir.' : 'Hareket geçmişi bulunan kartlarda ürün adı, kodu ve tipi değiştirilemez. Yapılan her kart değişikliği önceki ve sonraki değerlerle hareket geçmişine kaydedilir.'}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Category */}
              <label className="sm:col-span-2">
                <span className={labelClass}>Kategori *</span>
                <select
                  required
                  className={inputClass}
                  value={cardForm.category}
                  onChange={(e) => setCardForm({ ...cardForm, category: e.target.value })}
                >
                  {STOCK_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>

              {/* Item Name */}
              <label className="sm:col-span-2">
                <span className={labelClass}>Malzeme / Ürün Adı *</span>
                <input
                  required
                  maxLength={120}
                  className={inputClass}
                  value={cardForm.itemName}
                  onChange={(e) => setCardForm({ ...cardForm, itemName: e.target.value })}
                  placeholder="Örn: Çift Kişilik Yatak, Salon Kliması, Banyo Musluğu"
                />
              </label>

              {/* Item Type (Demirbaş / Sarf Malzeme) */}
              <label>
                <span className={labelClass}>Malzeme Tipi *</span>
                <select
                  required
                  className={inputClass}
                  value={cardForm.itemType}
                  onChange={(e) => setCardForm({ ...cardForm, itemType: e.target.value })}
                >
                  <option value="DEMİRBAŞ">DEMİRBAŞ (Demirbaş Eşya)</option>
                  <option value="SARF_MALZEME">SARF MALZEME (Tüketilebilir)</option>
                  <option value="ORTAK_EKİPMAN">ORTAK KULLANIM EKİPMANI (Ödünç Verilen Makine / Alet / Eşya)</option>
                </select>
              </label>

              {/* Unit */}
              <label>
                <span className={labelClass}>Ölçü Birimi *</span>
                <select
                  className={inputClass}
                  value={cardForm.unit}
                  onChange={(e) => setCardForm({ ...cardForm, unit: e.target.value })}
                >
                  <option>ADET</option>
                  <option>TAKIM</option>
                  <option>PAKET</option>
                  <option>KOLİ</option>
                  <option>METRE</option>
                  <option>LİTRE</option>
                  <option>SET</option>
                </select>
              </label>

              {/* Specifications / Detail */}
              <label className="sm:col-span-2">
                <span className={labelClass}>Özellik / Teknik Detay</span>
                <input
                  maxLength={500}
                  className={inputClass}
                  value={cardForm.specifications}
                  onChange={(e) => setCardForm({ ...cardForm, specifications: e.target.value })}
                  placeholder="Örn: 160x200 cm, 12.000 BTU, Bordo Renk"
                />
              </label>

              {/* Physical Status */}
              <label>
                <span className={labelClass}>Fiziksel Durum *</span>
                <select
                  className={inputClass}
                  value={cardForm.physicalStatus}
                  onChange={(e) => setCardForm({ ...cardForm, physicalStatus: e.target.value })}
                >
                  <option value="KULLANILABİLİR">Kullanılabilir / Sıfır</option>
                  <option value="KULLANIMDA">Kullanımda</option>
                  <option value="BAKIMDA">Bakımda / Tamirde</option>
                  <option value="HURDA">Hurda / Ayrılacak</option>
                </select>
              </label>

              {/* Warranty Expiration Date */}
              <label>
                <span className={labelClass}>Garanti Bitiş Tarihi</span>
                <input
                  type="date"
                  className={inputClass}
                  value={cardForm.warrantyEndDate}
                  onChange={(e) => setCardForm({ ...cardForm, warrantyEndDate: e.target.value })}
                />
              </label>

              {/* Location Note (Custom Design Dropdown & Autocomplete) */}
              <label className="sm:col-span-2">
                <span className={labelClass}>Bulunduğu Konum / Depo / Oda (Kayıtlı Konumlardan Seçin)</span>
                <CustomLocationSelector
                  value={cardForm.locationNote}
                  onChange={(val) => setCardForm({ ...cardForm, locationNote: val })}
                  options={registeredLocations}
                />
              </label>

              {/* Minimum Stock */}
              <label>
                <span className={labelClass}>Kritik Stok Seviyesi *</span>
                <input
                  type="number"
                  min={0}
                  required
                  className={inputClass}
                  value={cardForm.minimumStock}
                  onChange={(e) => setCardForm({ ...cardForm, minimumStock: Number(e.target.value) })}
                />
              </label>

              {/* Warehouse Quantity (Initial Total Stock) */}
              {modal.type === 'create' && (
                <label>
                  <span className={labelClass}>Depodaki Başlangıç Miktarı (Yedek) *</span>
                  <input
                    type="number"
                    min={0}
                    required
                    className={inputClass}
                    value={cardForm.totalStock}
                    onChange={(e) => setCardForm({ ...cardForm, totalStock: Number(e.target.value) })}
                  />
                </label>
              )}

              {modal.type === 'edit' && (
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={cardForm.isActive}
                    onChange={(e) => setCardForm({ ...cardForm, isActive: e.target.checked })}
                  />
                  <span className="text-[10px] font-extrabold text-slate-700">Stok kartı aktif ve yeni işlemlere açık</span>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy} type="submit" className={primaryButton}>
                {busy ? 'Kaydediliyor...' : modal.type === 'create' ? 'Kartı ve Stok Miktarını Oluştur' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Receive Stock */}
      {modal?.type === 'receive' && (
        <ModalShell onClose={() => setModal(null)} icon={<ArrowDownToLine className="h-4 w-4" />} title="Depo Girişi Kaydet" subtitle={`${modal.item.itemName} · Mevcut depodaki yedek ${modal.item.availableStock} ${modal.item.unit}`}>
          <form onSubmit={(event) => { event.preventDefault(); runAction(() => stockApi.receive(modal.item.id, receiveForm, operationKeyRef.current), 'Depo girişi kaydedildi.'); }} className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-bold text-emerald-900">Giriş tamamlandığında depodaki yedek miktar ve toplam miktar artar.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className={labelClass}>Giriş Miktarı *</span><input type="number" min={1} required className={inputClass} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })} /></label>
              <label><span className={labelClass}>Giriş Nedeni *</span><select className={inputClass} value={receiveForm.reason} onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })}><option>SATIN ALMA / MAL KABUL</option><option>BAĞIŞ / DEVİR</option><option>SAYIM FAZLASI</option><option>İADE GELEN YENİ ÜRÜN</option><option>DİĞER</option></select></label>
              <label className="sm:col-span-2"><span className={labelClass}>Belge / Açıklama</span><textarea rows={3} className={`${inputClass} h-auto py-2`} value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Fatura, irsaliye veya teslim açıklaması..." /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy} className={primaryButton}>Girişi Kaydet</button></div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Count Reconciliation */}
      {modal?.type === 'count' && (
        <ModalShell onClose={() => setModal(null)} icon={<ClipboardCheck className="h-4 w-4" />} title="Fiziksel Stok Sayımı" subtitle={`${modal.item.itemName} · Sistemdeki yedek miktar ${modal.item.availableStock} ${modal.item.unit}`}>
          <form onSubmit={(event) => { event.preventDefault(); runAction(() => stockApi.reconcileCount(modal.item.id, countForm, operationKeyRef.current), 'Sayım farkı kaydedildi.'); }} className="space-y-4">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold text-violet-900">Yalnızca depoda fiziksel olarak bulunan müsait yedek ürünleri sayın. Zimmetli olanlar sistem tarafından korunur.</div>
            <label><span className={labelClass}>Depoda Sayılan Miktar *</span><input type="number" min={0} required className={inputClass} value={countForm.countedAvailable} onChange={(event) => setCountForm({ ...countForm, countedAvailable: Number(event.target.value) })} /></label>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <div><p className="text-[9px] font-extrabold uppercase text-slate-500">Sistem Miktarı</p><p className="mt-1 text-lg font-black text-slate-900">{modal.item.availableStock}</p></div>
              <div><p className="text-[9px] font-extrabold uppercase text-slate-500">Sayım Farkı</p><p className={`mt-1 text-lg font-black ${countForm.countedAvailable - modal.item.availableStock < 0 ? 'text-rose-700' : countForm.countedAvailable - modal.item.availableStock > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{countForm.countedAvailable - modal.item.availableStock > 0 ? '+' : ''}{countForm.countedAvailable - modal.item.availableStock}</p></div>
            </div>
            <label><span className={labelClass}>Sayım Açıklaması {countForm.countedAvailable !== modal.item.availableStock ? '*' : ''}</span><textarea required={countForm.countedAvailable !== modal.item.availableStock} maxLength={1000} rows={4} className={`${inputClass} h-auto py-3`} value={countForm.notes} onChange={(event) => setCountForm({ ...countForm, notes: event.target.value })} placeholder="Farkın nedeni, sayımı yapan ekip ve kontrol bilgisini yazın..." /><span className="mt-1.5 block text-[11px] font-semibold text-slate-600">Sayım farkı varsa açıklama zorunludur ve değişiklik hareket geçmişinde saklanır.</span></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || (countForm.countedAvailable !== modal.item.availableStock && !countForm.notes.trim())} className={primaryButton}>{busy ? 'Kaydediliyor...' : 'Sayımı Mutabıklaştır'}</button></div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Room Assignment */}
      {modal?.type === 'assign' && (
        <ModalShell wide onClose={() => setModal(null)} icon={<Send className="h-4 w-4" />} title="Merkezi Oda Dağıtımı" subtitle="Tek odaya, seçili odalara veya tüm odalara tek işlemle zimmetleyin.">
          {(() => {
            const selectedItem = overview?.items.find((item) => item.id === assignForm.stockItemId);
            const allRooms = overview?.rooms || [];
            const targetRoomIds = assignForm.mode === 'SINGLE' ? (assignForm.roomId ? [assignForm.roomId] : []) : assignForm.mode === 'ALL' ? allRooms.map((room) => room.id) : assignForm.roomIds;
            const requiredStock = targetRoomIds.length * assignForm.quantity;
            const filteredRooms = allRooms.filter((room) => `${room.block.name} ${room.roomNumber} ${room.floor}`.toLocaleLowerCase('tr-TR').includes(assignForm.roomSearch.toLocaleLowerCase('tr-TR')));
            const submitAssignment = () => {
              if (!selectedItem || targetRoomIds.length === 0) return Promise.resolve();
              return assignForm.mode === 'SINGLE'
                ? stockApi.assignRoom(selectedItem.id, { roomId: targetRoomIds[0], quantity: assignForm.quantity, brand: assignForm.brand, serialNo: assignForm.serialNo, notes: assignForm.notes }, operationKeyRef.current)
                : stockApi.assignRooms(selectedItem.id, { roomIds: targetRoomIds, quantityPerRoom: assignForm.quantity, brand: assignForm.brand, notes: assignForm.notes }, operationKeyRef.current);
            };
            return <form onSubmit={(event) => { event.preventDefault(); runAction(submitAssignment, 'Oda zimmetleri oluşturuldu.'); }} className="space-y-4">
              <label><span className={labelClass}>Stok / Malzeme *</span><select required disabled={Boolean(modal.item)} className={inputClass} value={assignForm.stockItemId} onChange={(e) => setAssignForm({ ...assignForm, stockItemId: e.target.value, mode: 'SINGLE', roomId: '', roomIds: [], quantity: 1, serialNo: '' })}><option value="">Malzeme seçin</option>{(overview?.items || []).filter((item) => item.isActive && item.availableStock > 0).map((item) => <option key={item.id} value={item.id}>{item.itemCode ? `${item.itemCode} · ` : ''}{item.itemName} — Depo: {item.availableStock} {item.unit}</option>)}</select></label>
              <div className="grid grid-cols-3 gap-2">{([['SINGLE', 'Tek Oda'], ['SELECTED', 'Belirli Odalar'], ['ALL', `Tüm Odalar (${allRooms.length})`]] as const).map(([mode, label]) => { const disabled = mode !== 'SINGLE' && Boolean(selectedItem && selectedItem.itemType !== 'SARF_MALZEME'); return <button key={mode} type="button" disabled={disabled} title={disabled ? 'Demirbaşlar benzersiz seri numarasıyla tek tek gönderilir.' : undefined} onClick={() => setAssignForm({ ...assignForm, mode, roomId: '', roomIds: [] })} className={`rounded-xl border p-2.5 text-[10px] font-extrabold disabled:cursor-not-allowed disabled:opacity-40 ${assignForm.mode === mode ? 'border-blue-700 bg-blue-50 text-blue-900 ring-1 ring-blue-700' : 'border-slate-300 bg-white text-slate-600'}`}>{label}</button>; })}</div>
              {assignForm.mode === 'SINGLE' ? <label><span className={labelClass}>Hedef Oda *</span><select required className={inputClass} value={assignForm.roomId} onChange={(e) => setAssignForm({ ...assignForm, roomId: e.target.value })}><option value="">Blok / oda seçin</option>{allRooms.map((room) => <option key={room.id} value={room.id}>{room.block.name} · {room.roomType && room.roomType !== 'PERSONEL_ODASI' ? room.roomNumber : `Oda ${room.roomNumber}`} · {room.floor}. Kat</option>)}</select></label> : assignForm.mode === 'SELECTED' ? <div className="overflow-hidden rounded-2xl border border-slate-300"><div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-2"><Search className="h-3.5 w-3.5 text-slate-400"/><input value={assignForm.roomSearch} onChange={(e) => setAssignForm({ ...assignForm, roomSearch: e.target.value })} placeholder="Blok veya oda ara..." className="w-full bg-transparent text-xs font-bold outline-none"/><button type="button" onClick={() => setAssignForm({ ...assignForm, roomIds: filteredRooms.map((room) => room.id) })} className="whitespace-nowrap text-[9px] font-extrabold text-blue-800">Görünenleri Seç</button></div><div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2">{filteredRooms.map((room) => { const checked = assignForm.roomIds.includes(room.id); return <label key={room.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-[10px] font-bold ${checked ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}><input type="checkbox" checked={checked} onChange={() => setAssignForm({ ...assignForm, roomIds: checked ? assignForm.roomIds.filter((id) => id !== room.id) : [...assignForm.roomIds, room.id] })}/><span>{room.block.name} · {room.roomType && room.roomType !== 'PERSONEL_ODASI' ? room.roomNumber : `Oda ${room.roomNumber}`} · {room.floor}. Kat</span></label>; })}</div></div> : <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[10px] font-bold text-blue-900">Sistemdeki {allRooms.length} odanın tamamı hedeflenecek.</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label><span className={labelClass}>Oda Başına Miktar *</span><input required type="number" min={1} max={selectedItem?.itemType === 'SARF_MALZEME' ? undefined : 1} className={inputClass} value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: Number(e.target.value) })}/><span className="mt-1 block text-[9px] text-slate-500">Demirbaşlar cihaz bazında 1 adet zimmetlenir.</span></label><label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignForm.brand} onChange={(e) => setAssignForm({ ...assignForm, brand: e.target.value })}/></label>{assignForm.mode === 'SINGLE' ? <label><span className={labelClass}>Üretici Seri Numarası {selectedItem?.itemType !== 'SARF_MALZEME' && '*'}</span><input required={selectedItem?.itemType !== 'SARF_MALZEME'} className={inputClass} value={assignForm.serialNo} onChange={(e) => setAssignForm({ ...assignForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} placeholder="Cihaz üzerindeki S/N"/></label> : <label><span className={labelClass}>Dağıtım Notu</span><input className={inputClass} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}/></label>}</div>
              {assignForm.mode === 'SINGLE' && <label><span className={labelClass}>Dağıtım Notu</span><input className={inputClass} value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}/></label>}
              <div className={`rounded-xl border p-3 text-[10px] font-bold ${selectedItem && requiredStock > selectedItem.availableStock ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{targetRoomIds.length} oda × {assignForm.quantity} = <strong>{requiredStock} {selectedItem?.unit || 'adet'}</strong> dağıtılacak. Depoda <strong>{selectedItem?.availableStock ?? 0}</strong> mevcut. {selectedItem && requiredStock > selectedItem.availableStock && `Eksik stok: ${requiredStock - selectedItem.availableStock}.`}</div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || !selectedItem || targetRoomIds.length === 0 || requiredStock > selectedItem.availableStock || (selectedItem.itemType !== 'SARF_MALZEME' && !assignForm.serialNo.trim())} className={primaryButton}>{busy ? 'Dağıtılıyor...' : `${targetRoomIds.length} Odaya Zimmetle`}</button></div>
            </form>;
          })()}
        </ModalShell>
      )}

      {/* Modal: Item Detail */}
      {modal?.type === 'detail' && (
        <ModalShell wide onClose={() => setModal(null)} icon={<Eye className="h-4 w-4" />} title="Malzeme ve Stok Kartı Detayı" subtitle="Tüm teknik veriler, miktar dağılımı ve zimmet kayıtları.">
          {(() => {
            const item = overview?.items.find((entry) => entry.id === modal.item.id) || modal.item;
            const itemMovements = detailMovements;
            const available = item.availableStock;
            const usedTotal = item.usedStock + item.usedInRooms;

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded">
                        {item.itemCode || 'KODSUZ'}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">
                        {item.category}
                      </span>
                    </div>
                    <h4 className="mt-1 text-lg font-black text-slate-900">{item.itemName}</h4>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      Özellik: <span className="font-bold text-slate-800">{item.specifications || 'Belirtilmemiş'}</span> · Konumlar: <span className="font-bold text-slate-800">{stockLocations(item)}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canManageStock && <button onClick={() => openReceive(item)} className={secondaryButton}><ArrowDownToLine className="h-3.5 w-3.5" /> Giriş</button>}
                    {canManageStock && <button onClick={() => openAssign(item)} disabled={item.availableStock <= 0} className={primaryButton}><Send className="h-3.5 w-3.5" /> Odaya Gönder</button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-blue-800">Ana Depoda Kalan</p>
                    <p className="mt-1 text-xl font-black text-blue-950">{available}</p>
                  </div>
                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-violet-800">Oda + Personel Zimmetli</p>
                    <p className="mt-1 text-xl font-black text-violet-950">{usedTotal}</p>
                  </div>
                  <div className="rounded-xl border border-slate-300 bg-slate-100 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-slate-600">Toplam Envanter</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{item.totalStock}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-amber-800">Garanti Bitiş</p>
                    <p className="mt-1 text-xs font-black text-amber-950">{formatDateOnly(item.warrantyEndDate)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase text-emerald-800">Fiziksel Durum</p>
                    <div className="mt-1"><PhysicalStatusPill status={item.physicalStatus} /></div>
                  </div>
                </div>

                <div>
                  <h5 className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-800">
                    <Building2 className="h-4 w-4 text-violet-700" /> Aktif Oda Dağılımı ({item.roomInventories.reduce((sum, assignment) => sum + assignment.quantity, 0)} {item.unit})
                  </h5>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    {item.roomInventories.length === 0 ? (
                      <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Bu stok kartına bağlı aktif oda zimmeti yok.</p>
                    ) : (
                      item.roomInventories.map((assignment) => (
                        <button key={assignment.id} onClick={() => canManageLifecycle && openAssignment(item, assignment)} className={`flex w-full items-center justify-between gap-3 border-b border-slate-200 p-3 text-left transition last:border-0 ${canManageLifecycle ? 'hover:bg-blue-50' : 'cursor-default'}`}>
                          <div>
                            <p className="text-[10px] font-black text-slate-900">{roomName(assignment)} · {assignment.quantity} {item.unit}</p>
                            <p className="mt-0.5 text-[9px] font-semibold text-slate-500">{assignment.assetTag ? `Demirbaş: ${assignment.assetTag} · ` : ''}{assignment.brand || 'Marka yok'} · {assignment.serialNo ? `S/N ${assignment.serialNo}` : 'Seri no yok'}</p>
                          </div>
                          <div className="flex items-center gap-2"><StatusBadge status={assignment.status} /><ChevronRight className="h-4 w-4 text-slate-400" /></div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2"><h5 className="flex items-center gap-2 text-sm font-black text-slate-800"><History className="h-4 w-4 text-blue-700" /> Ürünün Son 20 Hareketi</h5><button type="button" onClick={() => { setMovementStockItemId(item.id); setMovementPage(1); setTab('movements'); setModal(null); }} className={secondaryButton}>Tüm Geçmişi Filtrele</button></div>
                  <div className="rounded-2xl border border-slate-200">
                    {detailMovementsLoading ? (
                      <p className="p-5 text-center text-xs font-semibold text-slate-500">Ürün hareket geçmişi yükleniyor...</p>
                    ) : itemMovements.length === 0 ? (
                      <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Son hareket kaydı bulunamadı.</p>
                    ) : (
                      itemMovements.map((movement) => (
                        <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5 last:border-0">
                          <div>
                            <p className="text-[10px] font-extrabold text-slate-800">{movementLabels[movement.type]} · {movement.reason || '-'}</p>
                            <p className="text-[9px] font-semibold text-slate-500">{formatDateTime(movement.createdAt)} · {movement.roomLabelSnapshot || 'Depo'}</p>
                          </div>
                          <span className={`font-black ${movement.quantity > 0 ? 'text-emerald-700' : movement.quantity < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </ModalShell>
      )}

      {/* Modal: Process Assignment */}
      {modal?.type === 'assignment' && (
        <ModalShell onClose={() => setModal(null)} icon={<ClipboardCheck className="h-4 w-4" />} title="Oda Zimmet Sürecini Yönet" subtitle={`${roomName(modal.assignment)} · ${modal.item.itemName}`}>
          {modal.assignment.maintenances && modal.assignment.maintenances.length > 0 && <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[10px] font-bold text-amber-900">Bu cihazın açık arıza süreci bulunuyor. İade ve transfer kapalıdır; cihaz değişimi arıza kaydını otomatik sonuçlandırır.</div>}
          <form onSubmit={(event) => { event.preventDefault(); const { assignment } = modal; if (assignmentForm.action === 'TRANSFER') runAction(() => stockApi.transferAssignment(assignment.id, { roomId: assignmentForm.roomId, notes: assignmentForm.notes }, operationKeyRef.current), 'Zimmet yeni odaya transfer edildi.'); else if (assignmentForm.action === 'RETURN') runAction(() => stockApi.returnAssignment(assignment.id, { outcome: assignmentForm.outcome, notes: assignmentForm.notes }, operationKeyRef.current), 'Zimmet iade/düşüm işlemi tamamlandı.'); else if (assignmentForm.action === 'IDENTITY') runAction(() => stockApi.updateAssignmentIdentity(assignment.id, { brand: assignmentForm.brand, serialNo: assignmentForm.serialNo, notes: assignmentForm.notes }, operationKeyRef.current), 'Cihaz kimlik bilgileri güncellendi.'); else runAction(() => stockApi.replaceAssignment(assignment.id, { brand: assignmentForm.brand, serialNo: assignmentForm.serialNo, notes: assignmentForm.notes }, operationKeyRef.current), 'Arızalı ürün sağlam ürünle değiştirildi.'); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[10px]">
              <div><p className="font-bold text-slate-500">Marka / Model</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.brand || '-'}</p></div>
              <div><p className="font-bold text-slate-500">Seri No</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.serialNo || '-'}</p></div>
              <div><p className="font-bold text-slate-500">Miktar</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.quantity} {modal.item.unit}</p></div>
              <div><p className="font-bold text-slate-500">Mevcut Durum</p><div className="mt-1"><StatusBadge status={modal.assignment.status} /></div></div>
            </div>
            <div>
              <span className={labelClass}>Yapılacak İşlem *</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['TRANSFER', 'Oda Transferi', ArrowRightLeft], ['RETURN', 'İade / Düşüm', RotateCcw], ['IDENTITY', 'Kimlik Bilgisi', Edit3], ['REPLACE', 'Ürün Değişimi', RefreshCw],
                ] as Array<[string, string, React.ElementType]>).map(([value, label, Icon]) => {
                  const hasFault = Boolean(modal.assignment.maintenances?.length);
                  const disabled = value === 'IDENTITY' ? false : value === 'REPLACE' ? !hasFault : hasFault;
                  return <button key={value} type="button" disabled={disabled} title={disabled ? (hasFault ? 'Önce açık arıza sürecini sonuçlandırın.' : 'Değişim için önce Arıza Yönetimi sayfasından arıza açın.') : undefined} onClick={() => setAssignmentForm({ ...assignmentForm, action: value })} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[9px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${assignmentForm.action === value ? 'border-blue-300 bg-blue-50 text-[#1e3a8a] ring-1 ring-blue-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>;
                })}
              </div>
            </div>
            {assignmentForm.action === 'TRANSFER' && <label><span className={labelClass}>Hedef Oda *</span><select required className={inputClass} value={assignmentForm.roomId} onChange={(e) => setAssignmentForm({ ...assignmentForm, roomId: e.target.value })}><option value="">Yeni oda seçin</option>{(overview?.rooms || []).filter((room) => room.id !== modal.assignment.roomId).map((room) => <option key={room.id} value={room.id}>{room.block.name} · Oda {room.roomNumber} · {room.floor}. Kat</option>)}</select></label>}
            {assignmentForm.action === 'RETURN' && <label><span className={labelClass}>İade Sonucu *</span><select className={inputClass} value={assignmentForm.outcome} onChange={(e) => setAssignmentForm({ ...assignmentForm, outcome: e.target.value as typeof assignmentForm.outcome })}><option value="RETURNED">Sağlam İade — Depo Müsait Stoğuna Al</option><option value="RETIRED">Hurda / Kullanım Dışı — Toplam Stoktan Düş</option></select><p className="mt-1 text-[9px] font-semibold text-slate-500">Kayıp / zayi işlemleri demirbaş arıza kaydından yapılır.</p></label>}
            {assignmentForm.action === 'IDENTITY' && <div className="space-y-3"><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[9px] font-bold text-blue-900">Üretici seri numarası cihazın kalıcı kimliğidir. Değişiklik önceki değerlerle birlikte hareket geçmişine kaydedilir.</div><div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label><label><span className={labelClass}>Üretici Seri Numarası {modal.item.itemType !== 'SARF_MALZEME' ? '*' : ''}</span><input required={modal.item.itemType !== 'SARF_MALZEME'} className={inputClass} value={assignmentForm.serialNo} onChange={(e) => setAssignmentForm({ ...assignmentForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} /></label></div></div>}
            {assignmentForm.action === 'REPLACE' && <div className="space-y-3"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] font-bold text-amber-900">Eski ürün hurda/düşüm kaydıyla kapatılır, depodaki sağlam üründen aynı miktarda yeni zimmet oluşturulur. Yeni cihazın seri numarası zorunludur.</div>{modal.item.availableStock < modal.assignment.quantity && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-[10px] font-extrabold text-rose-800">Değişim yapılamaz: depoda {modal.assignment.quantity} {modal.item.unit} sağlam ürün gerekiyor, yalnızca {modal.item.availableStock} {modal.item.unit} mevcut.</div>}<div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Yeni Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label><label><span className={labelClass}>Yeni Seri Numarası *</span><input required className={inputClass} value={assignmentForm.serialNo} onChange={(e) => setAssignmentForm({ ...assignmentForm, serialNo: e.target.value.toLocaleUpperCase('tr-TR') })} /></label></div></div>}
            <label><span className={labelClass}>İşlem Açıklaması *</span><textarea required rows={3} className={`${inputClass} h-auto py-2`} value={assignmentForm.notes} onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} placeholder="Transfer, iade veya değişim gerekçesini yazın..." /></label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || !assignmentForm.notes.trim() || (assignmentForm.action === 'TRANSFER' && !assignmentForm.roomId) || (assignmentForm.action === 'IDENTITY' && modal.item.itemType !== 'SARF_MALZEME' && !assignmentForm.serialNo.trim()) || (assignmentForm.action === 'REPLACE' && (!assignmentForm.serialNo.trim() || modal.item.availableStock < modal.assignment.quantity))} className={primaryButton}>{busy ? 'İşleniyor...' : 'İşlemi Onayla'}</button></div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
