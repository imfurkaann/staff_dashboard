import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, History, Plus, Search, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { User } from '../api/authApi';
import { Visitor, VisitorQuery, visitorApi } from '../api/visitorApi';
import { AddVisitorModal } from './AddVisitorModal';
import { VisitorHistoryView } from './VisitorHistoryView';
import { VisitorRecordsTable } from './VisitorRecordsTable';
import { can } from '../security/accessControl';

interface Props { currentUser: User }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());

export const VisitorManagementView: React.FC<Props> = ({ currentUser }) => {
  const [view, setView] = useState<'list' | 'history'>('list');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'INSIDE' | 'EXITED' | 'DELETED'>('ALL');
  const [summary, setSummary] = useState<{ inside: number; overdueInside?: number; exited: number; deleted?: number }>({ inside: 0, overdueInside: 0, exited: 0, deleted: 0 });
  const [editing, setEditing] = useState<Visitor | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const canManage = can(currentUser.role, 'VISITOR_MANAGE');
  const canManageArchive = can(currentUser.role, 'VISITOR_ARCHIVE');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const baseQuery = useMemo<VisitorQuery>(() => {
    const isInsideTab = status === 'INSIDE';
    return {
      search: search.trim() || undefined,
      status,
      // 'INSIDE' tab shows all visitors inside, others default to today unless search is active
      ...(!isInsideTab && !search.trim() ? { dateStart: today(), dateEnd: today() } : {}),
      pageSize: 25,
      sortBy: 'entryTime',
      sortOrder: 'desc',
    };
  }, [search, status]);

  const load = async (isInitial = false, pageToFetch = 1) => {
    const requestId = ++requestIdRef.current;
    if (pageToFetch === 1) {
      if (isInitial) setIsInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const result = await visitorApi.getVisitors({ ...baseQuery, page: pageToFetch });
      if (requestId !== requestIdRef.current) return;
      if (pageToFetch === 1) {
        setVisitors(result.items);
      } else {
        setVisitors((prev) => [...prev, ...result.items]);
      }
      setPage(pageToFetch);
      setHasMore(result.pagination.page < result.pagination.totalPages);
      setSummary(result.summary);
    } catch (caught) {
      if (requestId === requestIdRef.current) setError(caught instanceof Error ? caught.message : 'Ziyaretçi kayıtları yüklenemedi.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  const loadMore = () => {
    if (!hasMore || isLoadingMore) return;
    load(false, page + 1);
  };

  // Immediate fetch on status filter change, debounced 250ms fetch on search input typing
  useEffect(() => {
    if (view !== 'list') return;
    const isFirstTime = visitors.length === 0;
    const delay = search ? 250 : 0;
    const timer = window.setTimeout(() => load(isFirstTime, 1), delay);
    return () => window.clearTimeout(timer);
  }, [baseQuery, view]);

  const run = async (visitor: Visitor, action: () => Promise<unknown>, message: string) => {
    setBusyId(visitor.id);
    setError(null);
    try {
      await action();
      setNotice(message);
      await load(false, 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusyId(null);
    }
  };

  if (view === 'history') return <VisitorHistoryView currentUser={currentUser} onBack={() => setView('list')} />;

  return (
    <div className="space-y-4 animate-fadeIn w-full max-w-full overflow-hidden">
      {/* Action Buttons Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Compact Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          {canManageArchive && <button
            type="button"
            onClick={() => setStatus('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              status === 'ALL' ? 'bg-[#1e3a8a] text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Bugünkü Kayıtlar
          </button>}
          {canManage && <button
            type="button"
            onClick={() => setStatus('INSIDE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              status === 'INSIDE' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Şu An İçeride ({summary.inside})
          </button>}
          <button
            type="button"
            onClick={() => setStatus('EXITED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              status === 'EXITED' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Çıkış Yapanlar ({summary.exited})
          </button>
          <button
            type="button"
            onClick={() => setStatus('DELETED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              status === 'DELETED' ? 'bg-rose-700 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Silinen Kayıtlar {summary.deleted !== undefined ? `(${summary.deleted})` : ''}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setView('history')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white border border-violet-200 hover:border-violet-600 font-extrabold text-xs transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            <span>Geçmiş Kayıtlar</span>
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#172554] border border-[#1e3a8a] font-extrabold text-xs transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Ziyaretçi</span>
          </button>
        </div>
      </div>

    {notice && <div className="flex justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800"><span>{notice}</span><button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button></div>}
    {error && <div className="flex justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800"><span>{error}</span><button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
    {(summary.overdueInside || 0) > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-extrabold text-amber-900">Dikkat: {summary.overdueInside} ziyaretçi 24 saati aşkın süredir içeride görünüyor. Çıkış kayıtlarını kontrol edin.</div>}

    {/* Search Input Bar */}
    <div className="rounded-2xl border border-slate-300 bg-white p-3 shadow-xs">
      <label className="relative block">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ziyaretçi, telefon, firma, personel, amaç veya plaka ara..." className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 placeholder-slate-400" />
      </label>
    </div>

    <VisitorRecordsTable
      visitors={visitors}
      loading={isInitialLoading}
      busyId={busyId}
      canManageArchive={canManageArchive}
      readOnly={!canManage && !canManageArchive}
      hasMore={hasMore}
      loadingMore={isLoadingMore}
      onLoadMore={loadMore}
      onCheckOut={canManage ? (visitor) => run(visitor, () => visitorApi.checkOutVisitor(visitor.id), 'Ziyaretçi çıkışı kaydedildi.') : undefined}
      onUndoCheckOut={canManage ? (visitor) => run(visitor, () => visitorApi.undoCheckOutVisitor(visitor.id), 'Çıkış işlemi geri alındı.') : undefined}
      onEdit={canManage ? (visitor) => setEditing(visitor) : undefined}
      onDelete={setDeleteTarget}
      onRestore={(visitor) => run(visitor, () => visitorApi.restoreVisitor(visitor.id), 'Kayıt geri yüklendi.')}
    />
    <AddVisitorModal isOpen={editing !== undefined} visitor={editing || null} onClose={() => setEditing(undefined)} onSuccess={() => { setNotice(editing ? 'Ziyaretçi kaydı güncellendi.' : 'Ziyaretçi girişi kaydedildi.'); load(false, 1); }} />
    {deleteTarget && <div className="fixed inset-0 z-[350] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => setDeleteTarget(null)}><div className="w-full max-w-sm rounded-3xl bg-white border border-slate-300 p-6 shadow-2xl text-center" onMouseDown={(event) => event.stopPropagation()}><div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div><h3 className="mt-3 font-extrabold text-slate-950">Ziyaretçi Kaydını Sil</h3><p className="mt-1 text-xs font-semibold text-slate-600"><strong>{deleteTarget.fullName}</strong> kaydı denetim geçmişi korunarak arşivlenecektir.</p><div className="flex justify-center gap-2 mt-5"><button onClick={() => setDeleteTarget(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">Vazgeç</button><button onClick={() => { const target = deleteTarget; setDeleteTarget(null); run(target, () => visitorApi.deleteVisitor(target.id), 'Kayıt arşivlendi.'); }} className="px-4 py-2.5 rounded-xl bg-rose-600 text-xs font-bold text-white">Evet, Sil</button></div></div></div>}
    </div>
  );
};
