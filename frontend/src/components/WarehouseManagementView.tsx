import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowDownToLine, ArrowRightLeft, Building2,
  ChevronRight, ClipboardCheck, Download, Edit3, Eye, Filter, History, Package,
  Plus, RefreshCw, RotateCcw, Search, Send, X,
} from 'lucide-react';
import { AssignmentStatus, RoomAssignment, StockItem, StockOverview, stockApi } from '../api/stockApi';

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

const roomName = (assignment: RoomAssignment) => `${assignment.room.block.name} / Oda ${assignment.room.roomNumber}`;

const inputClass = 'w-full h-9 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-xs font-bold text-slate-900 transition placeholder:normal-case';
const labelClass = 'block mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600';
const primaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#1e3a8a] bg-[#1e3a8a] px-3 text-[11px] font-extrabold text-white shadow-xs transition-all hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-extrabold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-[#1e3a8a] disabled:opacity-50';

const StatusBadge = ({ status }: { status: AssignmentStatus }) => {
  const color = status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : ['MAINTENANCE_REQUIRED', 'REPLACEMENT_REQUIRED'].includes(status) ? 'bg-amber-50 text-amber-800 border-amber-200'
      : status === 'IN_SERVICE' ? 'bg-blue-50 text-blue-800 border-blue-200'
        : 'bg-rose-50 text-rose-800 border-rose-200';
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold whitespace-nowrap ${color}`}>{statusLabels[status]}</span>;
};

const ModalShell: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={onClose}>
    <div className={`max-h-[92vh] w-full overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-[#1e3a8a]">{icon}</div>
          <div><h3 className="text-sm font-black text-slate-900">{title}</h3><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{subtitle}</p></div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-white p-1.5 text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-200 hover:text-slate-900"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(92vh-74px)] overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

export const WarehouseManagementView: React.FC = () => {
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [tab, setTab] = useState<MainTab>('stock');
  const [modal, setModal] = useState<ModalState>(null);

  const [cardForm, setCardForm] = useState({ itemName: '', itemCode: '', category: 'ODA DEMİRBAŞI', unit: 'ADET', minimumStock: 5, totalStock: 0, isActive: true });
  const [receiveForm, setReceiveForm] = useState({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' });
  const [countForm, setCountForm] = useState({ countedAvailable: 0, notes: '' });
  const [assignForm, setAssignForm] = useState({ stockItemId: '', roomId: '', quantity: 1 });
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

  const categories = useMemo(() => Array.from(new Set((overview?.items || []).map((item) => item.category))).sort(), [overview]);
  const filteredItems = useMemo(() => (overview?.items || []).filter((item) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    const textMatches = !query || [item.itemName, item.itemCode, item.category].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
    const categoryMatches = category === 'ALL' || item.category === category;
    const stockMatches = stockFilter === 'ALL' || (stockFilter === 'CRITICAL' && item.availableStock <= item.minimumStock) || (stockFilter === 'ISSUE' && item.issueCount > 0) || (stockFilter === 'ACTIVE' && item.isActive) || (stockFilter === 'PASSIVE' && !item.isActive);
    return textMatches && categoryMatches && stockMatches;
  }), [overview, search, category, stockFilter]);

  const assignments = useMemo(() => filteredItems.flatMap((item) => item.roomInventories.map((assignment) => ({ item, assignment }))).filter(({ assignment }) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return !query || [assignment.itemName, assignment.serialNo, assignment.brand, roomName(assignment)].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
  }), [filteredItems, search]);

  const movements = useMemo(() => (overview?.movements || []).filter((movement) => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return !query || [movement.itemNameSnapshot, movement.stockItem.itemCode, movement.roomLabelSnapshot, movement.serialNo, movement.reason, movement.employee?.firstName, movement.employee?.lastName, movement.employee?.registrationNo].some((value) => value?.toLocaleLowerCase('tr-TR').includes(query));
  }), [overview, search]);

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
    setCardForm({ itemName: '', itemCode: '', category: 'ODA DEMİRBAŞI', unit: 'ADET', minimumStock: 5, totalStock: 0, isActive: true });
    setModal({ type: 'create' });
  };
  const openEdit = (item: StockItem) => {
    setCardForm({ itemName: item.itemName, itemCode: item.itemCode || '', category: item.category, unit: item.unit, minimumStock: item.minimumStock, totalStock: item.totalStock, isActive: item.isActive });
    setModal({ type: 'edit', item });
  };
  const openReceive = (item: StockItem) => { setReceiveForm({ quantity: 1, reason: 'SATIN ALMA / MAL KABUL', notes: '' }); setModal({ type: 'receive', item }); };
  const openCount = (item: StockItem) => { setCountForm({ countedAvailable: item.availableStock, notes: '' }); setModal({ type: 'count', item }); };
  const openAssign = (item?: StockItem) => {
    setAssignForm({ stockItemId: item?.id || '', roomId: '', quantity: 1 });
    setModal({ type: 'assign', item });
  };
  const openAssignment = (item: StockItem, assignment: RoomAssignment) => {
    setAssignmentForm({ action: 'TRANSFER', roomId: '', outcome: 'RETURNED', brand: '', serialNo: '', notes: assignment.notes || '' });
    setModal({ type: 'assignment', item, assignment });
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden animate-fadeIn">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => runAction(stockApi.exportExcel, 'Excel raporu indirildi.')} className={secondaryButton}><Download className="h-3.5 w-3.5" />Excel Raporu</button>
          <button type="button" onClick={() => openAssign()} className={secondaryButton}><Send className="h-3.5 w-3.5" />Odaya Zimmet</button>
          <button type="button" onClick={openCreate} className={primaryButton}><Plus className="h-3.5 w-3.5" />Yeni Stok Kartı</button>
      </div>

      {error && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><button onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}

      <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-xs">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Stok kodu, malzeme, oda, seri no veya hareket ara..." className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white" /></label>
          <div className="flex gap-2">
            <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 min-w-[155px] appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-7 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"><option value="ALL">Tüm Kategoriler</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="h-9 min-w-[135px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300"><option value="ALL">Tüm Durumlar</option><option value="CRITICAL">Kritik Stok</option><option value="ISSUE">Aksiyon Bekleyen</option><option value="ACTIVE">Aktif Kartlar</option><option value="PASSIVE">Pasif Kartlar</option></select>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-300 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 p-2">
          {([
            ['stock', 'Stok Kartları', `${filteredItems.length}`, Package],
            ['rooms', 'Aktif Oda Zimmetleri', `${assignments.length}`, Building2],
            ['personnel', 'Aktif Personel Zimmetleri', `${personnelAssignments.length}`, ClipboardCheck],
            ['movements', 'Hareket Geçmişi', `${movements.length}`, History],
          ] as Array<[MainTab, string, string, React.ElementType]>).map(([value, label, count, Icon]) => <button key={String(value)} onClick={() => setTab(value)} className={`inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[10px] font-extrabold transition ${tab === value ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-[#1e3a8a]'}`}><Icon className="h-3.5 w-3.5" />{label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${tab === value ? 'bg-white/20' : 'bg-slate-200'}`}>{count}</span></button>)}
        </div>

        {tab === 'stock' && <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600"><th className="px-3 py-2.5">Stok Kartı / Malzeme</th><th className="px-3 py-2.5">Kategori</th><th className="px-3 py-2.5 text-center">Toplam</th><th className="px-3 py-2.5 text-center">Depoda</th><th className="px-3 py-2.5 text-center">Odalarda</th><th className="px-3 py-2.5 text-center">Servis</th><th className="px-3 py-2.5 text-center">Aksiyon</th><th className="px-3 py-2.5 text-center">Stok Durumu</th><th className="px-3 py-2.5 text-right">İşlemler</th></tr></thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {loading ? <tr><td colSpan={9} className="p-10 text-center font-bold text-slate-500">Stok kayıtları yükleniyor...</td></tr> : filteredItems.length === 0 ? <tr><td colSpan={9} className="p-10 text-center"><Package className="mx-auto mb-2 h-9 w-9 text-slate-300" /><p className="font-extrabold text-slate-800">Kayıt bulunamadı</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Arama veya filtreleri değiştirin.</p></td></tr> : filteredItems.map((item) => {
              const critical = item.availableStock <= item.minimumStock;
              return <tr key={item.id} className="group transition hover:bg-blue-50/35">
                <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-[#1e3a8a]"><Package className="h-4 w-4" /></div><div><button onClick={() => setModal({ type: 'detail', item })} className="font-black text-slate-900 hover:text-[#1e3a8a]">{item.itemName}</button><p className="mt-0.5 text-[9px] font-bold text-slate-500">{item.itemCode || 'KOD TANIMSIZ'} · {item.unit}</p></div></div></td>
                <td className="px-3 py-2.5"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-extrabold text-slate-700">{item.category}</span></td>
                <td className="px-3 py-2.5 text-center font-black text-slate-800">{item.totalStock}</td><td className="px-3 py-2.5 text-center"><span className={`inline-flex min-w-[42px] justify-center rounded-lg border px-2 py-1 font-black ${critical ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{item.availableStock}</span></td>
                <td className="px-3 py-2.5 text-center font-extrabold text-violet-700">{item.usedInRooms}</td><td className="px-3 py-2.5 text-center font-extrabold text-blue-700">{item.serviceCount}</td><td className="px-3 py-2.5 text-center font-extrabold text-amber-700">{item.issueCount}</td>
                <td className="px-3 py-2.5 text-center">{!item.isActive ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-600">Pasif</span> : critical ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-700">Kritik · Min {item.minimumStock}</span> : <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">Yeterli Stok</span>}</td>
                <td className="px-3 py-2.5 text-right"><div className="inline-flex gap-1"><button onClick={() => openReceive(item)} className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 transition hover:bg-emerald-100" title="Depo girişi"><ArrowDownToLine className="h-3.5 w-3.5" /></button><button onClick={() => openCount(item)} className="rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-700 transition hover:bg-violet-100" title="Fiziksel sayım"><ClipboardCheck className="h-3.5 w-3.5" /></button><button disabled={!item.isActive || item.availableStock <= 0} onClick={() => openAssign(item)} className="rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-30" title="Odaya zimmet"><Send className="h-3.5 w-3.5" /></button><button onClick={() => setModal({ type: 'detail', item })} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" title="Kart detayı"><Eye className="h-3.5 w-3.5" /></button><button onClick={() => openEdit(item)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" title="Kartı düzenle"><Edit3 className="h-3.5 w-3.5" /></button></div></td>
              </tr>;
            })}
          </tbody></table></div>}

        {tab === 'rooms' && <div className="overflow-x-auto"><table className="w-full min-w-[1000px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600"><th className="px-3 py-2.5">Oda</th><th className="px-3 py-2.5">Zimmetli Ürün</th><th className="px-3 py-2.5 text-center">Adet</th><th className="px-3 py-2.5">Zimmet Tarihi</th><th className="px-3 py-2.5">Durum</th><th className="px-3 py-2.5">Not</th><th className="px-3 py-2.5 text-right">Süreç Yönetimi</th></tr></thead>
          <tbody className="divide-y divide-slate-200 text-xs">{assignments.length === 0 ? <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">Filtreye uygun aktif oda zimmeti bulunamadı.</td></tr> : assignments.map(({ item, assignment }) => <tr key={assignment.id} className="transition hover:bg-blue-50/35"><td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700"><Building2 className="h-4 w-4" /></div><div><p className="font-black text-slate-900">{assignment.room.block.name} · Oda {assignment.room.roomNumber}</p><p className="text-[9px] font-semibold text-slate-500">{assignment.room.floor}. Kat</p></div></div></td><td className="px-3 py-2.5"><p className="font-black text-slate-900">{item.itemName}</p><p className="text-[9px] font-bold text-slate-500">{item.itemCode || 'KODSUZ'} · {item.category}</p></td><td className="px-3 py-2.5 text-center font-black">{assignment.quantity}</td><td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{formatDateTime(assignment.installedAt)}</td><td className="px-3 py-2.5"><StatusBadge status={assignment.status} /></td><td className="max-w-[190px] truncate px-3 py-2.5 text-[10px] font-semibold text-slate-500" title={assignment.notes || ''}>{assignment.notes || '-'}</td><td className="px-3 py-2.5 text-right"><button onClick={() => openAssignment(item, assignment)} className={secondaryButton}><ClipboardCheck className="h-3.5 w-3.5" />İşlem Yap<ChevronRight className="h-3 w-3" /></button></td></tr>)}</tbody>
        </table></div>}

        {tab === 'personnel' && <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600"><th className="px-3 py-2.5">Personel</th><th className="px-3 py-2.5">Sicil / Departman</th><th className="px-3 py-2.5">Zimmetli Ürün</th><th className="px-3 py-2.5">Stok Kodu</th><th className="px-3 py-2.5">Zimmet Tarihi</th><th className="px-3 py-2.5">Durum</th></tr></thead>
          <tbody className="divide-y divide-slate-200 text-xs">{personnelAssignments.length === 0 ? <tr><td colSpan={6} className="p-10 text-center font-bold text-slate-500">Filtreye uygun aktif personel zimmeti bulunamadı.</td></tr> : personnelAssignments.map(({ item, assignment }) => <tr key={assignment.id} className="transition hover:bg-blue-50/35"><td className="px-3 py-2.5"><p className="font-black text-slate-900">{assignment.employee.firstName} {assignment.employee.lastName}</p></td><td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-700">{assignment.employee.registrationNo || 'Sicil yok'}</p><p className="text-[9px] font-semibold text-slate-500">{assignment.employee.department}</p></td><td className="px-3 py-2.5 font-black text-slate-900">{item.itemName}</td><td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{item.itemCode || 'KODSUZ'}</td><td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">{formatDateTime(assignment.assignedDate)}</td><td className="px-3 py-2.5"><span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold text-violet-800">Personelde</span></td></tr>)}</tbody>
        </table></div>}

        {tab === 'movements' && <div className="overflow-x-auto"><table className="w-full min-w-[1100px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-600"><th className="px-3 py-2.5">Tarih / Yetkili</th><th className="px-3 py-2.5">Stok Kartı</th><th className="px-3 py-2.5">Hareket</th><th className="px-3 py-2.5 text-center">Miktar</th><th className="px-3 py-2.5">Oda / Personel</th><th className="px-3 py-2.5">Seri No</th><th className="px-3 py-2.5">Neden / Açıklama</th></tr></thead>
          <tbody className="divide-y divide-slate-200 text-xs">{movements.length === 0 ? <tr><td colSpan={7} className="p-10 text-center font-bold text-slate-500">Hareket kaydı bulunamadı.</td></tr> : movements.map((movement) => {
            const target = movement.roomLabelSnapshot || (movement.employee ? `${movement.employee.firstName} ${movement.employee.lastName}${movement.employee.registrationNo ? ` · ${movement.employee.registrationNo}` : ''}` : '-');
            return <tr key={movement.id} className="transition hover:bg-blue-50/35"><td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-800">{formatDateTime(movement.createdAt)}</p><p className="text-[9px] font-semibold text-slate-500">{movement.createdBy?.fullName || 'Sistem'}</p></td><td className="px-3 py-2.5"><p className="font-black text-slate-900">{movement.itemNameSnapshot}</p><p className="text-[9px] font-bold text-slate-500">{movement.stockItem.itemCode || 'KODSUZ'}</p></td><td className="px-3 py-2.5"><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-800">{movementLabels[movement.type] || movement.type}</span></td><td className={`px-3 py-2.5 text-center font-black ${movement.quantity > 0 ? 'text-emerald-700' : movement.quantity < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.stockItem.unit}</td><td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">{target}</td><td className="px-3 py-2.5 text-[10px] font-semibold text-slate-600">{movement.serialNo || '-'}</td><td className="px-3 py-2.5"><p className="text-[10px] font-extrabold text-slate-700">{movement.reason || '-'}</p><p className="max-w-[260px] truncate text-[9px] font-semibold text-slate-500">{movement.notes || '-'}</p></td></tr>;
          })}</tbody>
        </table></div>}
      </div>

      {(modal?.type === 'create' || modal?.type === 'edit') && <ModalShell onClose={() => setModal(null)} icon={modal.type === 'create' ? <Plus className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />} title={modal.type === 'create' ? 'Yeni Stok Kartı Oluştur' : 'Stok Kartını Düzenle'} subtitle="Oda zimmetinde kullanılacak tüm tanımlayıcı bilgiler bu karttan gelir.">
        <form onSubmit={(event) => { event.preventDefault(); runAction(() => modal.type === 'create' ? stockApi.createStockItem(cardForm) : stockApi.updateStockItem(modal.item.id, cardForm), modal.type === 'create' ? 'Stok kartı oluşturuldu.' : 'Stok kartı güncellendi.'); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Malzeme / Demirbaş Adı *</span><input required maxLength={120} className={inputClass} value={cardForm.itemName} onChange={(e) => setCardForm({ ...cardForm, itemName: e.target.value })} placeholder="Örn: LED Televizyon" /></label><label><span className={labelClass}>Stok / Ürün Kodu</span><input maxLength={40} className={inputClass} value={cardForm.itemCode} onChange={(e) => setCardForm({ ...cardForm, itemCode: e.target.value })} placeholder="Örn: TV-LED-32" /></label><label><span className={labelClass}>Kategori *</span><select required className={inputClass} value={cardForm.category} onChange={(e) => setCardForm({ ...cardForm, category: e.target.value })}>{STOCK_CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className={labelClass}>Ölçü Birimi *</span><select className={inputClass} value={cardForm.unit} onChange={(e) => setCardForm({ ...cardForm, unit: e.target.value })}><option>ADET</option><option>TAKIM</option><option>PAKET</option><option>KOLİ</option><option>METRE</option><option>LİTRE</option></select></label><label className="sm:col-span-2"><span className={labelClass}>Kritik Stok Seviyesi *</span><input type="number" min={0} required className={inputClass} value={cardForm.minimumStock} onChange={(e) => setCardForm({ ...cardForm, minimumStock: Number(e.target.value) })} /></label>{modal.type === 'create' && <label className="sm:col-span-2"><span className={labelClass}>Açılış Stok Miktarı</span><input type="number" min={0} required className={inputClass} value={cardForm.totalStock} onChange={(e) => setCardForm({ ...cardForm, totalStock: Number(e.target.value) })} /><p className="mt-1 text-[9px] font-semibold text-slate-500">Bu miktar “Açılış Stoku” hareketi olarak denetim geçmişine yazılır.</p></label>}{modal.type === 'edit' && <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2"><input type="checkbox" checked={cardForm.isActive} onChange={(e) => setCardForm({ ...cardForm, isActive: e.target.checked })} /><span className="text-[10px] font-extrabold text-slate-700">Stok kartı aktif ve yeni işlemlere açık</span></label>}</div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy} type="submit" className={primaryButton}>{busy ? 'Kaydediliyor...' : modal.type === 'create' ? 'Kartı Oluştur' : 'Değişiklikleri Kaydet'}</button></div>
        </form>
      </ModalShell>}

      {modal?.type === 'receive' && <ModalShell onClose={() => setModal(null)} icon={<ArrowDownToLine className="h-4 w-4" />} title="Depo Girişi Kaydet" subtitle={`${modal.item.itemName} · Mevcut toplam ${modal.item.totalStock} ${modal.item.unit}`}>
        <form onSubmit={(event) => { event.preventDefault(); runAction(() => stockApi.receive(modal.item.id, receiveForm), 'Depo girişi kaydedildi.'); }} className="space-y-4"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-bold text-emerald-900">Giriş tamamlandığında toplam ve müsait stok artar; işlem hareket geçmişine eklenir.</div><div className="grid gap-3 sm:grid-cols-2"><label><span className={labelClass}>Giriş Miktarı *</span><input type="number" min={1} required className={inputClass} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: Number(e.target.value) })} /></label><label><span className={labelClass}>Giriş Nedeni *</span><select className={inputClass} value={receiveForm.reason} onChange={(e) => setReceiveForm({ ...receiveForm, reason: e.target.value })}><option>SATIN ALMA / MAL KABUL</option><option>BAĞIŞ / DEVİR</option><option>SAYIM FAZLASI</option><option>İADE GELEN YENİ ÜRÜN</option><option>DİĞER</option></select></label><label className="sm:col-span-2"><span className={labelClass}>Belge / Açıklama</span><textarea rows={3} className={`${inputClass} h-auto py-2`} value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} placeholder="Fatura, irsaliye veya teslim açıklaması..." /></label></div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy} className={primaryButton}>Girişi Kaydet</button></div></form>
      </ModalShell>}

      {modal?.type === 'count' && <ModalShell onClose={() => setModal(null)} icon={<ClipboardCheck className="h-4 w-4" />} title="Fiziksel Stok Sayımı" subtitle={`${modal.item.itemName} · Sistem müsait miktarı ${modal.item.availableStock} ${modal.item.unit}`}>
        <form onSubmit={(event) => { event.preventDefault(); runAction(() => stockApi.reconcileCount(modal.item.id, countForm), 'Sayım farkı kaydedildi.'); }} className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold text-violet-900">Yalnızca depoda fiziksel olarak bulunan müsait ürünleri sayın. Oda ve personel zimmetleri sistem tarafından ayrıca korunur.</div>
          <label><span className={labelClass}>Depoda Sayılan Miktar *</span><input type="number" min={0} required className={inputClass} value={countForm.countedAvailable} onChange={(event) => setCountForm({ ...countForm, countedAvailable: Number(event.target.value) })} /></label>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"><div><p className="text-[9px] font-extrabold uppercase text-slate-500">Sistem Miktarı</p><p className="mt-1 text-lg font-black text-slate-900">{modal.item.availableStock}</p></div><div><p className="text-[9px] font-extrabold uppercase text-slate-500">Sayım Farkı</p><p className={`mt-1 text-lg font-black ${countForm.countedAvailable - modal.item.availableStock < 0 ? 'text-rose-700' : countForm.countedAvailable - modal.item.availableStock > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{countForm.countedAvailable - modal.item.availableStock > 0 ? '+' : ''}{countForm.countedAvailable - modal.item.availableStock}</p></div></div>
          <label><span className={labelClass}>Sayım Açıklaması</span><textarea rows={3} className={`${inputClass} h-auto py-2`} value={countForm.notes} onChange={(event) => setCountForm({ ...countForm, notes: event.target.value })} placeholder="Sayım nedeni veya fark açıklaması..." /></label>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy} className={primaryButton}>{busy ? 'Kaydediliyor...' : 'Sayımı Mutabıklaştır'}</button></div>
        </form>
      </ModalShell>}

      {modal?.type === 'assign' && <ModalShell onClose={() => setModal(null)} icon={<Send className="h-4 w-4" />} title="Depodan Odaya Zimmet Gönder" subtitle="Yalnızca stok kartında tanımlı ve depoda müsait ürünler odaya gönderilebilir.">
        <form onSubmit={(event) => { event.preventDefault(); const selected = overview?.items.find((item) => item.id === assignForm.stockItemId); if (!selected) return; runAction(() => stockApi.assignRoom(selected.id, assignForm), 'Ürün odaya zimmetlendi.'); }} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className={labelClass}>Stok Kartı *</span><select required disabled={Boolean(modal.item)} className={inputClass} value={assignForm.stockItemId} onChange={(e) => setAssignForm({ ...assignForm, stockItemId: e.target.value })}><option value="">Malzeme seçin</option>{(overview?.items || []).filter((item) => item.isActive && item.availableStock > 0).map((item) => <option key={item.id} value={item.id}>{item.itemCode ? `${item.itemCode} · ` : ''}{item.itemName} — Müsait: {item.availableStock} {item.unit}</option>)}</select></label><label><span className={labelClass}>Hedef Oda *</span><select required className={inputClass} value={assignForm.roomId} onChange={(e) => setAssignForm({ ...assignForm, roomId: e.target.value })}><option value="">Blok / oda seçin</option>{(overview?.rooms || []).map((room) => <option key={room.id} value={room.id}>{room.block.name} · Oda {room.roomNumber} · {room.floor}. Kat</option>)}</select></label><label><span className={labelClass}>Miktar *</span><input type="number" min={1} max={overview?.items.find((item) => item.id === assignForm.stockItemId)?.availableStock || undefined} required className={inputClass} value={assignForm.quantity} onChange={(e) => setAssignForm({ ...assignForm, quantity: Number(e.target.value) })} /></label></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[10px] font-bold text-blue-900">Ürün adı, stok kodu, kategori ve birim bilgileri seçilen stok kartından otomatik alınır.</div><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || !assignForm.stockItemId || !assignForm.roomId} className={primaryButton}>{busy ? 'Gönderiliyor...' : 'Zimmeti Oluştur'}</button></div></form>
      </ModalShell>}

      {modal?.type === 'detail' && <ModalShell wide onClose={() => setModal(null)} icon={<Eye className="h-4 w-4" />} title="Stok Kartı Detayı" subtitle="Bakiye, aktif oda dağılımı ve son hareketler birlikte gösterilir.">
        {(() => { const item = overview?.items.find((entry) => entry.id === modal.item.id) || modal.item; const itemMovements = (overview?.movements || []).filter((movement) => movement.stockItemId === item.id); return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div><p className="text-[10px] font-extrabold text-[#1e3a8a]">{item.itemCode || 'KOD TANIMSIZ'}</p><h4 className="mt-0.5 text-lg font-black text-slate-900">{item.itemName}</h4><p className="mt-1 text-[10px] font-semibold text-slate-500">{item.category} · Birim: {item.unit}</p></div><div className="flex gap-2"><button onClick={() => openReceive(item)} className={secondaryButton}><ArrowDownToLine className="h-3.5 w-3.5" />Giriş</button><button onClick={() => openAssign(item)} disabled={item.availableStock <= 0} className={primaryButton}><Send className="h-3.5 w-3.5" />Odaya Gönder</button></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Toplam', item.totalStock], ['Depoda', item.availableStock], ['Odalarda', item.usedInRooms], ['Serviste', item.serviceCount], ['Aksiyon', item.issueCount]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-3 text-center"><p className="text-[9px] font-extrabold uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div>)}</div><div><h5 className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-800"><Building2 className="h-4 w-4 text-violet-700" />Aktif Oda Dağılımı ({item.roomInventories.length})</h5><div className="overflow-hidden rounded-2xl border border-slate-200">{item.roomInventories.length === 0 ? <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Bu stok kartına bağlı aktif oda zimmeti yok.</p> : item.roomInventories.map((assignment) => <button key={assignment.id} onClick={() => openAssignment(item, assignment)} className="flex w-full items-center justify-between gap-3 border-b border-slate-200 p-3 text-left transition last:border-0 hover:bg-blue-50"><div><p className="text-[10px] font-black text-slate-900">{roomName(assignment)} · {assignment.quantity} {item.unit}</p><p className="mt-0.5 text-[9px] font-semibold text-slate-500">{assignment.brand || 'Marka yok'} · {assignment.serialNo || 'Seri no yok'}</p></div><div className="flex items-center gap-2"><StatusBadge status={assignment.status} /><ChevronRight className="h-4 w-4 text-slate-400" /></div></button>)}</div></div><div><h5 className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-800"><History className="h-4 w-4 text-blue-700" />Son Hareketler</h5><div className="rounded-2xl border border-slate-200">{itemMovements.length === 0 ? <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Son hareket kaydı bulunamadı.</p> : itemMovements.slice(0, 8).map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5 last:border-0"><div><p className="text-[10px] font-extrabold text-slate-800">{movementLabels[movement.type]} · {movement.reason || '-'}</p><p className="text-[9px] font-semibold text-slate-500">{formatDateTime(movement.createdAt)} · {movement.roomLabelSnapshot || 'Depo'}</p></div><span className={`font-black ${movement.quantity > 0 ? 'text-emerald-700' : movement.quantity < 0 ? 'text-rose-700' : 'text-slate-500'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span></div>)}</div></div></div>; })()}
      </ModalShell>}

      {modal?.type === 'assignment' && <ModalShell onClose={() => setModal(null)} icon={<ClipboardCheck className="h-4 w-4" />} title="Oda Zimmet Sürecini Yönet" subtitle={`${roomName(modal.assignment)} · ${modal.item.itemName}`}>
        <form onSubmit={(event) => { event.preventDefault(); const { assignment } = modal; if (assignmentForm.action === 'TRANSFER') runAction(() => stockApi.transferAssignment(assignment.id, { roomId: assignmentForm.roomId, notes: assignmentForm.notes }), 'Zimmet yeni odaya transfer edildi.'); else if (assignmentForm.action === 'RETURN') runAction(() => stockApi.returnAssignment(assignment.id, { outcome: assignmentForm.outcome, notes: assignmentForm.notes }), 'Zimmet iade/düşüm işlemi tamamlandı.'); else runAction(() => stockApi.replaceAssignment(assignment.id, { brand: assignmentForm.brand, serialNo: assignmentForm.serialNo, notes: assignmentForm.notes }), 'Arızalı ürün sağlam ürünle değiştirildi.'); }} className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[10px]"><div><p className="font-bold text-slate-500">Marka / Model</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.brand || '-'}</p></div><div><p className="font-bold text-slate-500">Seri No</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.serialNo || '-'}</p></div><div><p className="font-bold text-slate-500">Miktar</p><p className="mt-0.5 font-black text-slate-800">{modal.assignment.quantity} {modal.item.unit}</p></div><div><p className="font-bold text-slate-500">Mevcut Durum</p><div className="mt-1"><StatusBadge status={modal.assignment.status} /></div></div></div><div><span className={labelClass}>Yapılacak İşlem *</span><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{([
          ['TRANSFER', 'Oda Transferi', ArrowRightLeft], ['RETURN', 'İade / Düşüm', RotateCcw], ['REPLACE', 'Ürün Değişimi', RefreshCw],
        ] as Array<[string, string, React.ElementType]>).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setAssignmentForm({ ...assignmentForm, action: value })} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[9px] font-extrabold transition ${assignmentForm.action === value ? 'border-blue-300 bg-blue-50 text-[#1e3a8a] ring-1 ring-blue-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon className="h-4 w-4" />{label}</button>)}</div></div>
          {assignmentForm.action === 'TRANSFER' && <label><span className={labelClass}>Hedef Oda *</span><select required className={inputClass} value={assignmentForm.roomId} onChange={(e) => setAssignmentForm({ ...assignmentForm, roomId: e.target.value })}><option value="">Yeni oda seçin</option>{(overview?.rooms || []).filter((room) => room.id !== modal.assignment.roomId).map((room) => <option key={room.id} value={room.id}>{room.block.name} · Oda {room.roomNumber} · {room.floor}. Kat</option>)}</select></label>}
          {assignmentForm.action === 'RETURN' && <label><span className={labelClass}>İade Sonucu *</span><select className={inputClass} value={assignmentForm.outcome} onChange={(e) => setAssignmentForm({ ...assignmentForm, outcome: e.target.value as typeof assignmentForm.outcome })}><option value="RETURNED">Sağlam İade — Depo Müsait Stoğuna Al</option><option value="RETIRED">Hurda / Kullanım Dışı — Toplam Stoktan Düş</option></select><p className="mt-1 text-[9px] font-semibold text-slate-500">Kayıp / zayi işlemleri demirbaş arıza kaydından yapılır.</p></label>}
          {assignmentForm.action === 'REPLACE' && <div className="space-y-3"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[9px] font-bold text-amber-900">Eski ürün hurda/düşüm kaydıyla kapatılır, depodaki sağlam üründen aynı miktarda yeni zimmet oluşturulur.</div><div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Yeni Marka / Model</span><input className={inputClass} value={assignmentForm.brand} onChange={(e) => setAssignmentForm({ ...assignmentForm, brand: e.target.value })} /></label><label><span className={labelClass}>Yeni Seri Numarası</span><input className={inputClass} value={assignmentForm.serialNo} onChange={(e) => setAssignmentForm({ ...assignmentForm, serialNo: e.target.value })} /></label></div></div>}
          <label><span className={labelClass}>İşlem Açıklaması *</span><textarea required rows={3} className={`${inputClass} h-auto py-2`} value={assignmentForm.notes} onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} placeholder="Transfer, iade veya değişim gerekçesini yazın..." /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button><button disabled={busy || (assignmentForm.action === 'TRANSFER' && !assignmentForm.roomId)} className={primaryButton}>{busy ? 'İşleniyor...' : 'İşlemi Onayla'}</button></div></form>
      </ModalShell>}
    </div>
  );
};
