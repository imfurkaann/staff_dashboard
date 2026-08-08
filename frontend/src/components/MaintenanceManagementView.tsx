import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Filter,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { User as AuthUser } from '../api/authApi';
import {
  MaintenanceLog,
  MaintenancePriority,
  MaintenanceQueryFilters,
  MaintenanceStatus,
  MaintenanceSummaryStats,
  maintenanceApi,
} from '../api/maintenanceApi';
import { roomApi, BlockSummary } from '../api/roomApi';
import { AddMaintenanceModal } from './AddMaintenanceModal';
import { DateRangePicker } from './DateRangePicker';
import { MaintenanceDetailModal } from './MaintenanceDetailModal';
import { MaintenanceReportModal, MaintenanceReportCriteria } from './MaintenanceReportModal';

const buttonBase =
  'group relative inline-flex items-center justify-center h-7 px-2 rounded-lg border transition-all duration-300 ease-out shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase =
  'max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 text-[11px] font-extrabold whitespace-nowrap overflow-hidden';

const categoryOptions = [
  'Elektrik & Aydınlatma',
  'Su & Tesisat',
  'İklimlendirme & Klima',
  'Mobilya & Ahşap',
  'Beyaz Eşya & Elektronik',
  'Kapı, Pencere & Kilit',
  'Temizlik & Hijyen',
  'Genel Bakım & Onarım',
];

interface MaintenanceManagementViewProps {
  currentUser: AuthUser;
}

export const MaintenanceManagementView: React.FC<MaintenanceManagementViewProps> = ({ currentUser }) => {
  const [maintenances, setMaintenances] = useState<MaintenanceLog[]>([]);
  const [summary, setSummary] = useState<MaintenanceSummaryStats>({
    totalCount: 0,
    openCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    urgentCount: 0,
  });

  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<MaintenancePriority | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<MaintenanceStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingLog, setEditingLog] = useState<MaintenanceLog | null | undefined>(undefined);
  const [detailTarget, setDetailTarget] = useState<MaintenanceLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLog | null>(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const handleGenerateReport = async (criteria: MaintenanceReportCriteria) => {
    setIsExporting(true);
    setIsReportModalOpen(false);
    setError(null);
    try {
      await maintenanceApi.exportExcel({
        status: criteria.status,
        priority: criteria.priority,
        category: criteria.category,
        blockId: criteria.blockId || undefined,
        dateStart: criteria.dateStart || undefined,
        dateEnd: criteria.dateEnd || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Excel arıza dökümü alınırken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  const canManage = currentUser.role === 'ADMIN' || currentUser.role === 'HOUSING_MANAGER';

  // Load blocks on mount
  useEffect(() => {
    roomApi.getBlocks().then(setBlocks).catch(() => {});
  }, []);

  const queryFilters = useMemo<MaintenanceQueryFilters>(() => {
    return {
      status: selectedStatus,
      priority: selectedPriority,
      category: selectedCategory,
      blockId: selectedBlockId || undefined,
      search: search.trim() || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      pageSize: 25,
    };
  }, [selectedStatus, selectedPriority, selectedCategory, selectedBlockId, search, dateStart, dateEnd]);

  const loadData = async (isInitial = false, pageToFetch = 1) => {
    if (pageToFetch === 1) {
      if (isInitial) setIsInitialLoading(true);
      setIsFetching(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const result = await maintenanceApi.getMaintenances({
        ...queryFilters,
        page: pageToFetch,
      });

      if (pageToFetch === 1) {
        setMaintenances(result.items);
      } else {
        setMaintenances((prev) => [...prev, ...result.items]);
      }

      setPage(pageToFetch);
      setHasMore(result.pagination.page < result.pagination.totalPages);
      setSummary(result.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Arıza kayıtları yüklenemedi.');
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
      setIsLoadingMore(false);
    }
  };

  // Immediate fetch on status/filter change, debounced 250ms fetch on search input typing
  useEffect(() => {
    const isFirst = maintenances.length === 0;
    const delay = search ? 250 : 0;
    const timer = window.setTimeout(() => loadData(isFirst, 1), delay);
    return () => window.clearTimeout(timer);
  }, [queryFilters]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && hasMore && !isLoadingMore && !isFetching) {
          loadData(false, page + 1);
        }
      },
      { threshold: 0.2 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoadingMore, isFetching, page, queryFilters]);

  const handleQuickStatusChange = async (log: MaintenanceLog, newStatus: MaintenanceStatus) => {
    setBusyId(log.id);
    setError(null);
    try {
      const solverName = log.assignedTo || currentUser.fullName || 'Lojman Yönetimi';
      await maintenanceApi.updateMaintenance(log.id, {
        status: newStatus,
        assignedTo: newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? solverName : null,
        resolutionNote: newStatus === 'RESOLVED' || newStatus === 'CLOSED' ? 'Hızlı işlem ile çözüldü olarak işaretlendi.' : null,
      });
      await loadData(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem gerçekleştirilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusyId(target.id);
    setError(null);
    try {
      await maintenanceApi.deleteMaintenance(target.id);
      await loadData(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Silme işlemi gerçekleştirilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPriorityBadge = (p: MaintenancePriority) => {
    switch (p) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-700 shrink-0" />
            ACİL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
            Yüksek
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-blue-50 text-[#1e3a8a] border border-blue-200">
            Orta
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Düşük
          </span>
        );
    }
  };

  const renderStatusBadge = (s: MaintenanceStatus) => {
    switch (s) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
            Açık Bildirim
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-blue-50 text-[#1e3a8a] border border-blue-200">
            <Wrench className="w-3 h-3 text-[#1e3a8a] shrink-0" />
            İşlemde (Teknik)
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Çözüldü
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Kapatıldı
          </span>
        );
    }
  };

  return (
    <div className="maintenance-management-page space-y-4 animate-fadeIn w-full max-w-full">
      {/* Action Buttons & Status Filter Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === 'ALL'
                ? 'bg-[#1e3a8a] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Tüm Bildirimler ({summary.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('OPEN')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === 'OPEN'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Açık Bildirimler ({summary.openCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('IN_PROGRESS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === 'IN_PROGRESS'
                ? 'bg-[#1e3a8a] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            İşlemde Olanlar ({summary.inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('RESOLVED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedStatus === 'RESOLVED'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Çözülenler ({summary.resolvedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs transition-all cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Rapor / Çıktı Al</span>
          </button>
          <button
            type="button"
            onClick={() => setEditingLog(null)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#172554] border border-[#1e3a8a] font-extrabold text-xs transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Arıza Bildirimi</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Arıza İstatistikleri">
        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold text-slate-700">Açık Arızalar</span>
            <Clock className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.openCount}</p>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold text-slate-700">İşlemdeki Arızalar</span>
            <Wrench className="w-4.5 h-4.5 text-[#1e3a8a]" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.inProgressCount}</p>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold text-slate-700">Çözülen Arızalar</span>
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.resolvedCount}</p>
        </div>

        <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-xs font-bold text-slate-700">Acil & Yüksek Öncelik</span>
            <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">{summary.urgentCount}</p>
        </div>
      </section>

      {/* Error Notifications */}
      {error && (
        <div className="flex justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls Bar (Search, Block, Priority, Category, Date Range) */}
      <div className="relative z-40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-xs items-center">
        {/* Search */}
        <div className="lg:col-span-3">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Oda, blok, açıklama veya kişi ara..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 placeholder-slate-400"
            />
          </label>
        </div>

        {/* Block Filter */}
        <div className="lg:col-span-2">
          <label className="relative block">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 cursor-pointer appearance-none"
            >
              <option value="">Tüm Bloklar</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Category Filter */}
        <div className="lg:col-span-2">
          <label className="relative block">
            <Wrench className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 cursor-pointer appearance-none"
            >
              <option value="ALL">Tüm Kategoriler</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Priority Filter */}
        <div className="lg:col-span-2">
          <label className="relative block">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as MaintenancePriority | 'ALL')}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 cursor-pointer appearance-none"
            >
              <option value="ALL">Tüm Öncelikler</option>
              <option value="URGENT">ACİL Öncelik</option>
              <option value="HIGH">Yüksek Öncelik</option>
              <option value="MEDIUM">Orta Öncelik</option>
              <option value="LOW">Düşük Öncelik</option>
            </select>
          </label>
        </div>

        {/* Date Range Picker */}
        <div className="lg:col-span-3">
          <DateRangePicker
            startDate={dateStart}
            endDate={dateEnd}
            onChange={(start, end) => {
              setDateStart(start);
              setDateEnd(end);
            }}
            fullWidth
            placeholder="Kayıt Tarih Aralığı Seçin"
          />
        </div>
      </div>

      {/* Main Table / Mobile List Section */}
      <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-xs">
        {isInitialLoading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin mb-3" />
            Arıza kayıtları yükleniyor...
          </div>
        ) : maintenances.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-extrabold text-slate-800">Kayıt Bulunamadı</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Seçilen filtrelere uygun arıza kaydı bulunmuyor.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">Blok / Oda</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Arıza Açıklaması</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Öncelik</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Durum</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Bildiren Kişi</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Çözümleyen Personel</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Açılış Tarihi</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Kapanış Tarihi</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-bold text-slate-900">
                  {maintenances.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setDetailTarget(log)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Location / Room */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.room ? (
                          <div>
                            <span className="font-black text-[#1e3a8a] text-sm block truncate max-w-[130px]" title={log.room.block.name}>
                              {log.room.block.name}
                            </span>
                            <span className="text-xs font-bold text-slate-600 block truncate max-w-[130px]">
                              Oda {log.room.roomNumber} ({log.room.floor}. Kat)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Genel / Belirtilmemiş</span>
                        )}
                      </td>

                      {/* Description & Category */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <p className="font-extrabold text-slate-950 truncate max-w-[260px]" title={log.description}>
                          {log.description}
                        </p>
                        {log.category && (
                          <span className="inline-block text-[10px] font-bold text-[#1e3a8a] bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5 mt-1">
                            {log.category}
                          </span>
                        )}
                        {log.resolutionNote && (
                          <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 mt-1 truncate max-w-[260px]" title={`Çözüm Notu: ${log.resolutionNote}`}>
                            Çözüm Notu: {log.resolutionNote}
                          </p>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderPriorityBadge(log.priority)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(log.status)}
                      </td>

                      {/* Bildiren Kişi */}
                      <td className="py-3.5 px-4 whitespace-nowrap max-w-[140px]">
                        <span className="font-extrabold text-slate-800 block truncate max-w-[130px]" title={log.reportedBy && log.reportedBy !== 'Sistem Kullanıcısı' ? log.reportedBy : currentUser.fullName}>
                          {log.reportedBy && log.reportedBy !== 'Sistem Kullanıcısı' ? log.reportedBy : currentUser.fullName}
                        </span>
                      </td>

                      {/* Çözümleyen Personel */}
                      <td className="py-3.5 px-4 whitespace-nowrap max-w-[150px]">
                        {log.assignedTo ? (
                          <span className="font-extrabold text-slate-800 block truncate max-w-[140px]" title={log.assignedTo}>{log.assignedTo}</span>
                        ) : log.status === 'RESOLVED' || log.status === 'CLOSED' ? (
                          <span className="font-extrabold text-slate-800 block truncate max-w-[140px]" title={currentUser.fullName}>{currentUser.fullName}</span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 italic">Henüz Çözülmedi</span>
                        )}
                      </td>

                      {/* Açılış Tarihi */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-slate-600">
                        {formatDate(log.createdAt)}
                      </td>

                      {/* Kapanış Tarihi */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-slate-600">
                        {log.resolvedAt ? formatDate(log.resolvedAt) : <span className="text-slate-400">-</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {log.status === 'RESOLVED' || log.status === 'CLOSED' ? (
                            <button
                              type="button"
                              disabled={busyId === log.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusChange(log, 'OPEN');
                              }}
                              className={`${buttonBase} bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80 hover:border-amber-600`}
                              title="Çözümü geri al (Tekrar açık yap)"
                            >
                              <RotateCcw className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Geri Al</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === log.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusChange(log, 'RESOLVED');
                              }}
                              className={`${buttonBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80 hover:border-emerald-600`}
                              title="Çözüldü yap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Çözüldü Yap</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingLog(log);
                            }}
                            className={`${buttonBase} bg-blue-50 text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white border-blue-200/80 hover:border-[#1e3a8a]`}
                            title="Düzenle"
                          >
                            <FilePenLine className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                            <span className={labelBase}>Düzenle</span>
                          </button>

                          {canManage && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(log);
                              }}
                              className={`${buttonBase} bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-200/80 hover:border-rose-600`}
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Sil</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Grid View */}
            <div className="lg:hidden divide-y divide-slate-200">
              {maintenances.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setDetailTarget(log)}
                  className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {log.room ? (
                        <span className="font-extrabold text-[#1e3a8a] text-sm block">
                          {log.room.block.name} - Oda {log.room.roomNumber}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-500">Genel Lokasyon</span>
                      )}
                      <h3 className="font-extrabold text-slate-900 text-xs mt-1">{log.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderPriorityBadge(log.priority)}
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {log.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1">
                    <div>{renderStatusBadge(log.status)}</div>
                  </div>

                  <div className="text-[11px] space-y-1 pt-2 border-t border-slate-100 text-slate-700">
                    <p><strong>Bildiren Kişi:</strong> {log.reportedBy && log.reportedBy !== 'Sistem Kullanıcısı' ? log.reportedBy : currentUser.fullName}</p>
                    <p><strong>Çözümleyen Personel:</strong> {log.assignedTo || (log.status === 'RESOLVED' || log.status === 'CLOSED' ? currentUser.fullName : 'Henüz Çözülmedi')}</p>
                    <p><strong>Açılış Tarihi:</strong> {formatDate(log.createdAt)}</p>
                    {log.resolvedAt && <p><strong>Kapanış Tarihi:</strong> {formatDate(log.resolvedAt)}</p>}
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    {log.status === 'RESOLVED' || log.status === 'CLOSED' ? (
                      <button
                        type="button"
                        disabled={busyId === log.id}
                        onClick={() => handleQuickStatusChange(log, 'OPEN')}
                        className={`${buttonBase} bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80 hover:border-amber-600`}
                        title="Çözümü geri al (Tekrar açık yap)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                        <span className={labelBase}>Geri Al</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === log.id}
                        onClick={() => handleQuickStatusChange(log, 'RESOLVED')}
                        className={`${buttonBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80 hover:border-emerald-600`}
                        title="Çözüldü yap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                        <span className={labelBase}>Çözüldü Yap</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingLog(log)}
                      className={`${buttonBase} bg-blue-50 text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white border-blue-200/80 hover:border-[#1e3a8a]`}
                      title="Düzenle"
                    >
                      <FilePenLine className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                      <span className={labelBase}>Düzenle</span>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(log)}
                        className={`${buttonBase} bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-200/80 hover:border-rose-600`}
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                        <span className={labelBase}>Sil</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite Scroll Sentinel & Loading Indicator */}
            <div ref={sentinelRef} className="py-4 text-center">
              {isLoadingMore && (
                <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
                  <div className="w-4 h-4 border-2 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin" />
                  Daha fazla arıza kaydı yükleniyor...
                </div>
              )}
              {!hasMore && maintenances.length > 0 && (
                <p className="text-[11px] font-semibold text-slate-400">
                  Tüm arıza kayıtları gösteriliyor ({maintenances.length} / {summary.totalCount})
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <MaintenanceDetailModal
        isOpen={!!detailTarget}
        log={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={(logToEdit) => setEditingLog(logToEdit)}
        onStatusChange={handleQuickStatusChange}
        currentUserFullName={currentUser.fullName}
      />

      {/* Add / Edit Modal */}
      <AddMaintenanceModal
        isOpen={editingLog !== undefined}
        maintenance={editingLog || null}
        onClose={() => setEditingLog(undefined)}
        onSuccess={() => {
          loadData(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[350] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-slate-300 p-6 shadow-2xl text-center"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="mt-3 font-extrabold text-slate-950">Arıza Kaydını Sil</h3>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              <strong>"{deleteTarget.title}"</strong> arıza kaydı kalıcı olarak silinecektir.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Report Modal */}
      <MaintenanceReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        blocks={blocks}
        onGenerateReport={handleGenerateReport}
        isExporting={isExporting}
      />
    </div>
  );
};
