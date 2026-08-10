import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowRightLeft, Boxes, Building2, Check,
  ChevronDown, ChevronRight, ClipboardCheck, Download, Edit3, Eye, Filter, History,
  MapPin, Package, Plus, RefreshCw, RotateCcw, Search, Send, ShieldAlert, Sparkles,
  UserCheck, Users, Wrench, X, Layers, Clock, AlertCircle, HardHat, Hammer, ShieldCheck,
} from 'lucide-react';
import {
  SharedAsset, SharedAssetLog, SharedAssetOverview, SharedAssetStatus, sharedAssetApi,
} from '../api/sharedAssetApi';

type ModalState =
  | { type: 'checkOut'; asset?: SharedAsset }
  | { type: 'checkIn'; asset: SharedAsset }
  | { type: 'detail'; asset: SharedAsset }
  | { type: 'maintenanceLog'; asset: SharedAsset }
  | null;

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
  LOANED: 'Zimmetli / Kullanımda',
  MAINTENANCE: 'Bakımda / Arızalı',
  RETIRED: 'Hurda / Kullanım Dışı',
};

const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul',
}).format(new Date(value)) : '-';

const formatDateOnly = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium', timeZone: 'Europe/Istanbul',
}).format(new Date(value)) : '-';

const inputClass = 'w-full h-9 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-xs font-bold text-slate-900 transition placeholder:normal-case';
const labelClass = 'block mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600';
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
          placeholder="Konum yazın veya seçin (Örn: Ana Depo, Teknik Servis Deposu)..."
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

const WarrantyBadge = ({ dateStr }: { dateStr?: string | null }) => {
  if (!dateStr) return <span className="text-[10px] text-slate-400 font-semibold">-</span>;
  const warrantyDate = new Date(dateStr);
  const now = new Date();
  const isExpired = warrantyDate < now;
  const daysDiff = Math.ceil((warrantyDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-800" title={`Garanti ${formatDateOnly(dateStr)} tarihinde bitti.`}>
        <AlertTriangle className="h-3 w-3 text-rose-600" /> Bitti ({formatDateOnly(dateStr)})
      </span>
    );
  }

  if (daysDiff <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-800" title={`Garanti bitimine ${daysDiff} gün kaldı.`}>
        <Clock className="h-3 w-3 text-amber-600" /> {daysDiff} Gün Kaldı
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800">
      <ShieldCheck className="h-3 w-3 text-emerald-600" /> {formatDateOnly(dateStr)}
    </span>
  );
};

const ModalShell: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, subtitle, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={onClose}>
    <div className={`max-h-[92vh] w-full overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`} onMouseDown={(event) => event.stopPropagation()}>
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

export const SharedAssetManagementView: React.FC = () => {
  const [overview, setOverview] = useState<SharedAssetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modal, setModal] = useState<ModalState>(null);

  const [checkOutForm, setCheckOutForm] = useState({
    assetId: '',
    employeeId: '',
    customBorrowerName: '',
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

  const registeredLocations = useMemo(() => {
    return Array.from(
      new Set(
        (overview?.assets || [])
          .map((item) => item.locationNote)
          .filter((note): note is string => Boolean(note && note.trim()))
      )
    ).sort();
  }, [overview]);

  const loanRecords = useMemo(() => {
    const records: Array<{
      id: string;
      asset: SharedAsset;
      borrowerName: string;
      borrowedAt?: string | null;
      returnedAt?: string | null;
      isCurrentlyLoaned: boolean;
      status: SharedAssetStatus;
    }> = [];

    const assets = overview?.assets || [];

    assets.forEach((asset) => {
      // 1. Active loan row if item is currently LOANED
      if (asset.status === 'LOANED') {
        const lastCheckOut = asset.logs.find((l) => l.action === 'CHECK_OUT');
        const borrower = asset.currentEmployee
          ? `${asset.currentEmployee.firstName} ${asset.currentEmployee.lastName}${asset.currentEmployee.department ? ` (${asset.currentEmployee.department})` : ''}`
          : asset.currentRoom
          ? `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`
          : lastCheckOut?.borrowerName || 'Zimmetli';

        records.push({
          id: `active-${asset.id}`,
          asset,
          borrowerName: borrower,
          borrowedAt: asset.borrowedAt || lastCheckOut?.createdAt,
          returnedAt: null,
          isCurrentlyLoaned: true,
          status: asset.status,
        });
      }

      // 2. Past returned loan records from logs
      const checkOutLogs = asset.logs.filter((l) => l.action === 'CHECK_OUT' && l.borrowerName);
      checkOutLogs.forEach((log) => {
        if (asset.status === 'LOANED' && asset.borrowedAt && Math.abs(new Date(log.createdAt).getTime() - new Date(asset.borrowedAt).getTime()) < 5000) {
          return;
        }

        records.push({
          id: `log-${log.id}`,
          asset,
          borrowerName: log.borrowerName || '-',
          borrowedAt: log.borrowedAt || log.createdAt,
          returnedAt: log.returnedAt || log.createdAt,
          isCurrentlyLoaned: false,
          status: 'AVAILABLE',
        });
      });

      // 3. Master asset entry if available and no past check-out logs
      if (asset.status !== 'LOANED' && checkOutLogs.length === 0) {
        records.push({
          id: `master-${asset.id}`,
          asset,
          borrowerName: '-',
          borrowedAt: null,
          returnedAt: null,
          isCurrentlyLoaned: false,
          status: asset.status,
        });
      }
    });

    return records.filter((row) => {
      const q = search.trim().toLocaleLowerCase('tr-TR');
      const textMatches = !q || [
        row.asset.assetName,
        row.asset.category,
        row.asset.brandModel,
        row.asset.locationNote,
        row.borrowerName,
      ].some((val) => val?.toLocaleLowerCase('tr-TR').includes(q));

      const catMatches = categoryFilter === 'ALL' || row.asset.category === categoryFilter;
      const statMatches = statusFilter === 'ALL' || (statusFilter === 'LOANED' ? row.isCurrentlyLoaned : statusFilter === 'AVAILABLE' ? !row.isCurrentlyLoaned : row.status === statusFilter);

      return textMatches && catMatches && statMatches;
    });
  }, [overview, search, categoryFilter, statusFilter]);

  const runAction = async (action: () => Promise<unknown>, _message: string) => {
    try {
      setBusy(true); setError(null);
      await action();
      setModal(null);
      await loadOverview(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(false); }
  };

  const openCheckOut = (asset?: SharedAsset) => {
    setCheckOutForm({
      assetId: asset?.id || '',
      employeeId: '',
      customBorrowerName: '',
    });
    setModal({ type: 'checkOut', asset });
  };

  const openCheckIn = (asset: SharedAsset) => {
    setCheckInForm({
      locationNote: asset.locationNote || '',
      notes: '',
      newStatus: 'AVAILABLE',
    });
    setModal({ type: 'checkIn', asset });
  };

  const openMaintenanceLog = (asset: SharedAsset) => {
    setMaintForm({
      action: asset.status === 'MAINTENANCE' ? 'REPAIR_COMPLETED' : 'FAULT_REPORTED',
      notes: '',
      newStatus: asset.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE',
    });
    setModal({ type: 'maintenanceLog', asset });
  };

  return (
    <div className="w-full max-w-full space-y-3 overflow-hidden animate-fadeIn">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <p className="text-[11px] font-bold text-slate-500">
          💡 Yeni ortak kullanım ekipmanı/makinesi eklemek için <span className="font-extrabold text-[#1e3a8a]">Depo & Stok Yönetimi</span> sayfasından Malzeme Tipi = <span className="font-mono font-extrabold text-blue-900 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">ORTAK KULLANIM EKİPMANI</span> olan stok kartı ekleyebilirsiniz.
        </p>
        <button type="button" onClick={() => openCheckOut()} className={primaryButton}>
          <Send className="h-3.5 w-3.5 text-white" /> Ödünç Ver / Zimmetle
        </button>
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
              <option value="AVAILABLE">Teslim Alındı (Depoda)</option>
              <option value="LOANED">Zimmetli (Kullanımda)</option>
              <option value="MAINTENANCE">Bakımda / Arızalı</option>
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
              ) : loanRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <Boxes className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="font-extrabold text-slate-800">Kayıtlı zimmet veya ortak eşya hareketi bulunamadı</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Arama veya filtre kriterlerini değiştirin ya da yeni zimmet oluşturun.</p>
                  </td>
                </tr>
              ) : (
                loanRecords.map((row, idx) => (
                  <tr key={row.id} className={`group transition hover:bg-blue-50/40 ${row.isCurrentlyLoaned ? 'bg-blue-50/20' : row.status === 'MAINTENANCE' ? 'bg-amber-50/20' : idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-2 py-2 border-r border-slate-200 text-center text-[10px] font-extrabold text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      <button onClick={() => setModal({ type: 'detail', asset: row.asset })} className="font-black text-slate-900 hover:text-[#1e3a8a] text-left block">
                        {row.asset.assetName}
                      </button>
                      {row.asset.brandModel && <span className="text-[9px] text-slate-500 font-semibold">{row.asset.brandModel}</span>}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-extrabold text-slate-600 whitespace-nowrap">
                      {row.asset.category}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 whitespace-nowrap">
                      {row.isCurrentlyLoaned ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[9px] font-extrabold text-blue-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> Zimmetli / Kullanımda
                        </span>
                      ) : row.returnedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Teslim Alındı (Depoda)
                        </span>
                      ) : (
                        <AssetStatusBadge status={row.status} />
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-800">
                      {row.borrowerName !== '-' ? (
                        <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          {row.borrowerName}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">Depoda (Müsait)</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                      {formatDateTime(row.borrowedAt)}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                      {formatDateTime(row.returnedAt)}
                    </td>
                    <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-600 truncate max-w-[120px] hidden md:table-cell" title={row.asset.locationNote || ''}>
                      {row.asset.locationNote || '-'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        {row.isCurrentlyLoaned ? (
                          <button onClick={() => openCheckIn(row.asset)} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700 transition hover:bg-emerald-100 flex items-center gap-1" title="Teslim Al / İade Et">
                            <RotateCcw className="h-3 w-3" /> Teslim Al
                          </button>
                        ) : row.asset.status === 'AVAILABLE' ? (
                          <button onClick={() => openCheckOut(row.asset)} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700 transition hover:bg-blue-100 flex items-center gap-1" title="Ödünç Ver">
                            <Send className="h-3 w-3" /> Ödünç Ver
                          </button>
                        ) : null}
                        <button onClick={() => openMaintenanceLog(row.asset)} className="rounded-md border border-amber-200 bg-amber-50 p-1 text-amber-800 transition hover:bg-amber-100" title="Bakım / Arıza Kaydı Ekle">
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setModal({ type: 'detail', asset: row.asset })} className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" title="Detay & Geçmiş">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Check Out / Loan Asset */}
      {modal?.type === 'checkOut' && (
        <ModalShell onClose={() => setModal(null)} icon={<Send className="h-4 w-4" />} title="Ortak Ekipmanı Ödünç Ver / Zimmetle" subtitle="Ekipmanı teslim alan personeli seçin veya isim yazın.">
          <form onSubmit={(e) => { e.preventDefault(); if (!checkOutForm.assetId) return; runAction(() => sharedAssetApi.checkOutAsset(checkOutForm.assetId, checkOutForm), 'Ekipman ödünç verildi.'); }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Zimmetlenecek Ortak Eşya *</span>
                <select required disabled={Boolean(modal.asset)} className={inputClass} value={checkOutForm.assetId} onChange={(e) => setCheckOutForm({ ...checkOutForm, assetId: e.target.value })}>
                  <option value="">Ekipman seçin</option>
                  {(overview?.assets || []).filter((a) => a.status === 'AVAILABLE').map((a) => (
                    <option key={a.id} value={a.id}>{a.assetName} ({a.category})</option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Personele Zimmet Veriliyor * (Kayıtlı personellerden arayın veya yeni kişi yazın)</span>
                <CustomEmployeeSelector
                  employees={overview?.employees || []}
                  selectedEmployeeId={checkOutForm.employeeId}
                  customName={checkOutForm.customBorrowerName}
                  onChange={({ employeeId, customBorrowerName }) => setCheckOutForm({ ...checkOutForm, employeeId, customBorrowerName })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(null)} className={secondaryButton}>Vazgeç</button>
              <button disabled={busy || !checkOutForm.assetId || (!checkOutForm.employeeId && !checkOutForm.customBorrowerName.trim())} type="submit" className={primaryButton}>{busy ? 'İşleniyor...' : 'Zimmeti Onayla'}</button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Modal: Check In / Return Asset */}
      {modal?.type === 'checkIn' && (
        <ModalShell onClose={() => setModal(null)} icon={<RotateCcw className="h-4 w-4" />} title="Ortak Ekipmanı Teslim Al / Depoya İade Et" subtitle={modal.asset.assetName}>
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.checkInAsset(modal.asset.id, checkInForm), 'Ekipman teslim alındı.'); }} className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-[10px] font-bold text-blue-900">
              💡 Ekipmanın sağlam veya bozuk/arızalı teslim alınıp alınmadığını seçin.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Fiziksel Kontrol / Teslim Durumu *</span>
                <select className={inputClass} value={checkInForm.newStatus} onChange={(e) => setCheckInForm({ ...checkInForm, newStatus: e.target.value as SharedAssetStatus })}>
                  <option value="AVAILABLE">✅ SAĞLAM TESLİM ALINDI — (Müsait / Depoya Koy)</option>
                  <option value="MAINTENANCE">⚠️ BOZUK / ARIZALI TESLİM ALINDI — (Bakıma / Servise Gönder)</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Teslim Açıklaması / Fiziksel Kontrol Notu</span>
                <textarea rows={3} className={`${inputClass} h-auto py-2`} value={checkInForm.notes} onChange={(e) => setCheckInForm({ ...checkInForm, notes: e.target.value })} placeholder="Sağlam teslim alındı, çalışır durumda veya çizik/arızası var vb." />
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
          <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.addMaintenanceLog(modal.asset.id, maintForm), 'Bakım kaydı eklendi.'); }} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>İşlem Tipi *</span>
                <select required className={inputClass} value={maintForm.action} onChange={(e) => {
                  const act = e.target.value as any;
                  const newStat = act === 'REPAIR_COMPLETED' || act === 'MAINTENANCE_END' ? 'AVAILABLE' : 'MAINTENANCE';
                  setMaintForm({ ...maintForm, action: act, newStatus: newStat });
                }}>
                  <option value="FAULT_REPORTED">Arıza Bildirimi (Bozuk - Servise Gönderildi)</option>
                  <option value="MAINTENANCE_START">Periyodik Bakıma Alındı</option>
                  <option value="REPAIR_COMPLETED">Tamir / Onarım Tamamlandı (Sağlam - Müsait Yap)</option>
                  <option value="MAINTENANCE_END">Bakım Tamamlandı (Sağlam - Müsait Yap)</option>
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className={labelClass}>Bakım / Arıza Notu & Servis Açıklaması *</span>
                <textarea required rows={3} className={`${inputClass} h-auto py-2`} value={maintForm.notes} onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })} placeholder="Değişen parça, servis açıklaması, arıza sebebi vb..." />
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
                  <span className="text-[10px] font-bold text-slate-500">Garanti:</span>
                  <WarrantyBadge dateStr={modal.asset.warrantyEndDate} />
                  <span className="text-[10px] font-bold text-slate-500 ml-2">Konum:</span>
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
              <h5 className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-800"><History className="h-4 w-4 text-blue-700" /> Ödünç & Bakım Geçmişi ({modal.asset.logs.length})</h5>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                {modal.asset.logs.length === 0 ? (
                  <p className="p-5 text-center text-[10px] font-semibold text-slate-500">Henüz hareket kaydı yok.</p>
                ) : (
                  modal.asset.logs.map((log) => (
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
    </div>
  );
};
