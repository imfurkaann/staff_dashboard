import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CalendarDays, Car, FileSpreadsheet, Filter, Phone, RotateCcw, Search, Target, UserCheck } from 'lucide-react';
import { User } from '../api/authApi';
import { Visitor, VisitorQuery, visitorApi } from '../api/visitorApi';
import { AddVisitorModal } from './AddVisitorModal';
import { DateRangePicker } from './DateRangePicker';
import { VisitorRecordsTable } from './VisitorRecordsTable';
import { VisitorExportModal, VisitorExportFilter } from './VisitorExportModal';
import { can } from '../security/accessControl';

interface Props { currentUser: User; onBack: () => void }

export const VisitorHistoryView: React.FC<Props> = ({ currentUser, onBack }) => {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [filters, setFilters] = useState({ visitorName: '', company: '', hostName: '', purpose: '', phone: '', vehiclePlate: '', dateStart: '', dateEnd: '', status: 'ALL' as NonNullable<VisitorQuery['status']> });
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canManageArchive = can(currentUser.role, 'VISITOR_ARCHIVE');
  const canExport = can(currentUser.role, 'VISITOR_EXPORT');
  const query = useMemo<VisitorQuery>(() => ({
    ...filters,
    page,
    pageSize: 25,
    sortBy: 'entryTime',
    sortOrder: 'desc',
    includeDeleted: filters.status === 'DELETED' || filters.status === 'WITH_DELETED',
  }), [filters, page]);

  const load = async () => {
    setLoading(true); setError(null);
    try { const result = await visitorApi.getVisitors(query); setVisitors(result.items); setPagination(result.pagination); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Geçmiş ziyaretçi kayıtları yüklenemedi.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = window.setTimeout(load, 300); return () => window.clearTimeout(timer); }, [query]);
  const update = (field: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [field]: value })); setPage(1); };
  const reset = () => { setFilters({ visitorName: '', company: '', hostName: '', purpose: '', phone: '', vehiclePlate: '', dateStart: '', dateEnd: '', status: 'ALL' }); setPage(1); };

  return <div className="space-y-5 animate-fadeIn">
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}

    <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center">
            <Filter className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Kayıt Filtreleme</h2>
            <p className="text-[10px] font-semibold text-slate-500">Her sütun için ayrı ayrı hızlı arama kriterleri belirleyin.</p>
          </div>
        </div>

        {/* Top Export Trigger Button */}
        {canExport && <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 text-xs font-extrabold transition-all shadow-xs cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rapor / Çıktı Al</span>
        </button>}
      </div>

      {/* Upper Row: Ziyaretçi Adı, Firma, Ziyaret Edilen, Telefon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Ziyaretçi Adı
          <span className="relative block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.visitorName}
              onChange={(event) => update('visitorName', event.target.value)}
              placeholder="Ziyaretçi adı..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>

        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Firma / Kurum
          <span className="relative block">
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.company}
              onChange={(event) => update('company', event.target.value)}
              placeholder="Firma adı..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>

        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Ziyaret Edilen Personel
          <span className="relative block">
            <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.hostName}
              onChange={(event) => update('hostName', event.target.value)}
              placeholder="Personel adı..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>

        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Telefon Numarası
          <span className="relative block">
            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="Telefon numarası..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>
      </div>

      {/* Lower Row: Ziyaret Amacı, Araç Plakası, Kayıt Durumu, Tarih Aralığı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Ziyaret Amacı
          <span className="relative block">
            <Target className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.purpose}
              onChange={(event) => update('purpose', event.target.value)}
              placeholder="Ziyaret sebebi..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>

        <label className="space-y-1 text-[11px] font-extrabold text-slate-600">
          Araç Plakası
          <span className="relative block">
            <Car className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.vehiclePlate}
              onChange={(event) => update('vehiclePlate', event.target.value)}
              placeholder="Plaka..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-800"
            />
          </span>
        </label>

        <div className="space-y-1">
          <span className="text-[11px] font-extrabold text-slate-600 block">Kayıt Durumu</span>
          <select
            value={filters.status}
            onChange={(event) => update('status', event.target.value as any)}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold cursor-pointer outline-none focus:bg-white focus:border-[#1e3a8a] text-slate-800"
          >
            <option value="ALL">Tüm Aktif Kayıtlar</option>
            <option value="INSIDE">İçeride</option>
            <option value="EXITED">Çıkış Yaptı</option>
            {canManageArchive && <option value="DELETED">Silinen Kayıtlar (Arşiv)</option>}
            {canManageArchive && <option value="WITH_DELETED">Tüm Kayıtlar (Silinenler Dahil)</option>}
          </select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-extrabold text-slate-600 block">Tarih Aralığı</span>
          <DateRangePicker
            fullWidth={true}
            startDate={filters.dateStart}
            endDate={filters.dateEnd}
            onChange={(start, end) => {
              setFilters((current) => ({ ...current, dateStart: start, dateEnd: end }));
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Control Action Bar */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
        {canExport && <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 text-xs font-extrabold transition-all shadow-xs cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rapor / Çıktı Al</span>
        </button>}

        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-extrabold transition-all cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Filtreleri Temizle</span>
        </button>
      </div>
    </section>

    <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{pagination.total} kayıt bulundu</span><span>Sayfa {pagination.page} / {Math.max(1, pagination.totalPages)}</span></div>
    <VisitorRecordsTable visitors={visitors} loading={loading} busyId={busyId} canManageArchive={canManageArchive} readOnly={true} />
    {pagination.totalPages > 1 && <div className="flex justify-end gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold disabled:opacity-40">Önceki</button><button disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold disabled:opacity-40">Sonraki</button></div>}
    <AddVisitorModal isOpen={Boolean(editing)} visitor={editing} onClose={() => setEditing(null)} onSuccess={load} />

    {/* Visitor Export Modal */}
    {canExport && <VisitorExportModal
      isOpen={isExportModalOpen}
      onClose={() => setIsExportModalOpen(false)}
      isExporting={isExporting}
      onExport={async (filter: VisitorExportFilter) => {
        setIsExporting(true);
        try {
          await visitorApi.exportExcel({
            ...query,
            status: filter.status as any,
            dateStart: filter.startDate || query.dateStart,
            dateEnd: filter.endDate || query.dateEnd,
          });
          setIsExportModalOpen(false);
        } catch (err: any) {
          setError(err.message || 'Ziyaretçi Excel dökümü alınırken bir hata oluştu.');
        } finally {
          setIsExporting(false);
        }
      }}
    />}
  </div>;
};
