import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Calendar, FileSpreadsheet, Filter, History, Pencil, RefreshCw,
  RotateCcw, Search, Trash2, Users, Wrench, X,
} from 'lucide-react';
import { SharedAsset, SharedAssetLog, SharedAssetStatus, sharedAssetApi } from '../api/sharedAssetApi';
import { DateRangePicker } from './DateRangePicker';

interface Props {
  assets: SharedAsset[];
  onBack: () => void;
}

const buttonBase =
  'group relative inline-flex items-center justify-center h-7 px-2 rounded-lg border transition-all duration-300 ease-out shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase =
  'max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 text-[11px] font-extrabold whitespace-nowrap overflow-hidden';

const ASSET_CATEGORIES = [
  'TEMİZLİK & BAKIM MAKİNELERİ', 'EL ALETLERİ & TAMİR', 'BAHÇE & PEYZAJ',
  'ELEKTRİKLİ EV ALETLERİ', 'GÜVENLİK & İŞ SAĞLIĞI', 'MOBİLYA & MEFRUŞAT',
  'ELEKTRONİK & BİLİŞİM', 'ISITMA & SOĞUTMA', 'MUTFAK & SERVİS EKİPMANLARI',
  'ÖLÇÜM & TEST CİHAZLARI', 'MERDİVEN & İSKELE', 'TAŞIMA & DEPOLAMA',
  'GENEL EŞYALAR', 'GENEL', 'BEYAZ EŞYA', 'ODA DEMİRBAŞI',
];

export const SharedAssetHistoryView: React.FC<Props> = ({ assets, onBack }) => {
  const [history, setHistory] = useState<{ items: SharedAssetLog[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editLogForm, setEditLogForm] = useState<{ logId: string; borrowerName: string; notes: string } | null>(null);
  const [deleteLogTarget, setDeleteLogTarget] = useState<{ logId: string; borrowerName: string; assetName: string } | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    action: '',
    holderType: '',
    category: 'ALL',
    dateStart: '',
    dateEnd: '',
    page: 1,
  });

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await sharedAssetApi.getLogs({
        search: filters.search,
        action: filters.action,
        holderType: filters.holderType,
        dateStart: filters.dateStart,
        dateEnd: filters.dateEnd,
        page: filters.page,
        pageSize: 25,
      });
      setHistory(res);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem geçmişi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadHistory, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const filteredItems = useMemo(() => {
    if (!history?.items) return [];
    if (filters.category === 'ALL') return history.items;
    return history.items.filter((log) => {
      const match = assets.find((a) => a.id === log.assetId || a.assetCode === log.assetCodeSnapshot);
      return match?.category === filters.category;
    });
  }, [history, assets, filters.category]);

  const runAction = async (actionFn: () => Promise<unknown>, successMsg: string) => {
    try {
      setBusy(true);
      setError(null);
      await actionFn();
      setEditLogForm(null);
      setDeleteLogTarget(null);
      await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem sırasında bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-full space-y-4 animate-fadeIn">
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 font-extrabold">✕</button>
        </div>
      )}

      {/* Filter Section */}
      <section className="rounded-3xl border border-slate-300 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Filter className="h-4 w-4 text-[#1e3a8a]" />
          <h3 className="text-xs font-black text-slate-900">Geçmiş Kayıt Filtreleri</h3>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              placeholder="Ekipman adı, kişi, konum veya Seri No ara..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
          >
            <option value="ALL">Tüm Kategoriler</option>
            {ASSET_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Action/Status Dropdown */}
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-extrabold text-slate-700 outline-none hover:border-blue-300"
          >
            <option value="">Tüm İşlem Tipleri</option>
            <option value="CHECK_OUT">Zimmet Verildi (Kullanımda)</option>
            <option value="CHECK_IN">Teslim Alındı (Tamamlandı)</option>
            <option value="FAULT_REPORTED">Arıza / Bakım</option>
          </select>

          {/* Custom DateRangePicker Component */}
          <div className="lg:col-span-2">
            <DateRangePicker
              startDate={filters.dateStart}
              endDate={filters.dateEnd}
              onChange={(start, end) => setFilters({ ...filters, dateStart: start, dateEnd: end, page: 1 })}
              buttonClassName="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-300"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setFilters({ search: '', action: '', holderType: '', category: 'ALL', dateStart: '', dateEnd: '', page: 1 })}
            className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      </section>

      {/* Main Full History Table matching User Screenshot */}
      <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                <th className="px-3 py-3 w-10 text-center border-r border-slate-200">#</th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[200px]">EŞYA / MAKİNE ADI</th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[120px]">KATEGORİ</th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[100px]">DURUM</th>
                <th className="px-3 py-3 border-r border-slate-200 min-w-[180px]">KİME VERİLDİ</th>
                <th className="px-2.5 py-3 border-r border-slate-200 whitespace-nowrap">VERİLİŞ TARİHİ & SAATİ</th>
                <th className="px-2.5 py-3 border-r border-slate-200 whitespace-nowrap">TESLİM ALINMA TARİHİ</th>
                <th className="px-2.5 py-3 border-r border-slate-200 min-w-[160px]">KONUM / DEPO</th>
                <th className="px-3 py-3 text-right whitespace-nowrap w-24">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs font-bold text-slate-500">
                    İşlem geçmişi kayıtları yükleniyor...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs font-bold text-slate-500">
                    Arama kriterlerine uygun işlem geçmişi kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredItems.map((log, idx) => {
                  const matchingAsset = assets.find((a) => a.id === log.assetId || a.assetCode === log.assetCodeSnapshot);
                  const cat = matchingAsset?.category || 'BEYAZ EŞYA';
                  const brandDesc = matchingAsset?.brandModel || log.assetNameSnapshot;
                  const locNote = matchingAsset?.locationNote || 'A BLOK / ODA ÇAMAŞIRHANE';
                  const isReturned = Boolean(log.returnedAt || log.action === 'CHECK_IN');
                  const isCurrentlyActive = log.action === 'CHECK_OUT' && !log.returnedAt;

                  return (
                    <tr key={log.id} className="hover:bg-blue-50/40 transition">
                      <td className="px-3 py-2 text-center border-r border-slate-200 font-extrabold text-slate-400">
                        {((history?.pagination.page || 1) - 1) * (history?.pagination.pageSize || 25) + idx + 1}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-900">
                        <div className="font-extrabold text-slate-900">{log.assetNameSnapshot}</div>
                        {brandDesc && <div className="text-[10px] font-medium text-slate-500 truncate max-w-[240px]">{brandDesc}</div>}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">{cat}</span>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Teslim Alındı
                          </span>
                        ) : isCurrentlyActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-800 border border-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Kullanımda
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700 border border-slate-200">
                            {log.action}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-r border-slate-200 font-bold text-slate-800">
                        <span className="font-extrabold text-blue-900 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          {log.borrowerName || 'Personel'}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                        {formatDateTime(log.borrowedAt || log.createdAt)}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-700 whitespace-nowrap">
                        {formatDateTime(log.returnedAt)}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-[10px] font-semibold text-slate-600 truncate max-w-[160px]" title={locNote}>
                        {locNote}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1.5 items-center justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditLogForm({ logId: log.id, borrowerName: log.borrowerName || '', notes: log.notes || '' });
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
                              setDeleteLogTarget({ logId: log.id, borrowerName: log.borrowerName || '', assetName: log.assetNameSnapshot });
                            }}
                            className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600`}
                            title="Kaydı Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                            <span className={labelBase}>Sil</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {history && history.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
            <div>
              Toplam <span className="font-extrabold text-blue-900">{history.pagination.total}</span> geçmiş kaydı (Sayfa {history.pagination.page} / {history.pagination.totalPages})
            </div>
            <div className="flex gap-2">
              <button
                disabled={history.pagination.page <= 1}
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-extrabold text-slate-700 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                Önceki Sayfa
              </button>
              <button
                disabled={history.pagination.page >= history.pagination.totalPages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-extrabold text-slate-700 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
              >
                Sonraki Sayfa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Log Modal */}
      {editLogForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={() => setEditLogForm(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-300 bg-white p-6 shadow-2xl space-y-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-blue-700" /> İşlem Kaydını Düzenle
              </h3>
              <button onClick={() => setEditLogForm(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.updateLog(editLogForm.logId, { borrowerName: editLogForm.borrowerName, notes: editLogForm.notes }), 'İşlem kaydı güncellendi.'); }} className="space-y-4">
              <label className="block">
                <span className="block text-xs font-bold text-slate-700 mb-1">Teslim Alan Personel / Zimmet Sahibi *</span>
                <input required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white" value={editLogForm.borrowerName} onChange={(e) => setEditLogForm({ ...editLogForm, borrowerName: e.target.value })} placeholder="Teslim alan kişinin adı" />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-700 mb-1">İşlem Notu / Açıklama</span>
                <textarea rows={3} maxLength={1000} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white" value={editLogForm.notes} onChange={(e) => setEditLogForm({ ...editLogForm, notes: e.target.value })} placeholder="Varsa fiziki durum veya ek açıklamaları yazın..." />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setEditLogForm(null)} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Vazgeç</button>
                <button disabled={busy || !editLogForm.borrowerName.trim()} type="submit" className="rounded-xl bg-[#1e3a8a] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 hover:bg-blue-900">{busy ? 'İşleniyor...' : 'Güncellemeyi Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Log Modal */}
      {deleteLogTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={() => setDeleteLogTarget(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-300 bg-white p-6 shadow-2xl space-y-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-rose-900 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" /> İşlem Kaydını Sil
              </h3>
              <button onClick={() => setDeleteLogTarget(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); runAction(() => sharedAssetApi.deleteLog(deleteLogTarget.logId), 'İşlem kaydı silindi.'); }} className="space-y-4">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold leading-6 text-rose-950">
                ⚠️ <span className="font-black text-rose-900">{deleteLogTarget.borrowerName}</span> adına ait bu işlem kaydını silmek istediğinizden emin misiniz? Bu işlem listeden kalıcı olarak kaldırılacaktır.
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setDeleteLogTarget(null)} className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">Vazgeç</button>
                <button disabled={busy} type="submit" className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 hover:bg-rose-800">{busy ? 'İşleniyor...' : 'Evet, Kaydı Sil'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
