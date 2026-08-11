import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, Clock, Filter, MessageSquareWarning,
  RefreshCw, Search, X, User, ArrowRight, CornerDownRight, MessageSquare, Edit3
} from 'lucide-react';
import { SupportTicket, SupportTicketStatus, ticketApi, connectTicketSocket, playChimeSound } from '../api/ticketApi';
import { User as UserType } from '../api/authApi';
import { can } from '../security/accessControl';

const TICKET_CATEGORIES = [
  'GÜRÜLTÜ / RAHATSIZLIK',
  'İNTERNET / İLETİŞİM',
  'EK EŞYA / MOBİLYA',
  'TEMİZLİK / ÇEVRE',
  'GENEL TALEPLER',
  'DİĞER',
] as const;

const formatDateTime = (isoString?: string | null): string => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23', timeZone: 'Europe/Istanbul',
    }).format(d).replace(' ', ' • ');
  } catch (e) {
    return isoString;
  }
};

const inputClass = 'w-full h-9 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-xs font-bold text-slate-900 transition';
const labelClass = 'block mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600';
const primaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#1e3a8a] bg-[#1e3a8a] px-4 text-xs font-extrabold text-white shadow-xs transition-all hover:bg-[#172554] disabled:opacity-50 cursor-pointer';

interface SupportTicketManagementViewProps {
  currentUser?: UserType | null;
}

export const SupportTicketManagementView: React.FC<SupportTicketManagementViewProps> = ({ currentUser }) => {
  const canManage = currentUser ? can(currentUser.role, 'TICKET_MANAGE') : true;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Selected Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // Update Form
  const [updateStatus, setUpdateStatus] = useState<SupportTicketStatus>('OPEN');
  const [updateNote, setUpdateNote] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ticketApi.getTickets({
        status: statusFilter,
        category: categoryFilter,
        search,
      });
      setTickets(res.tickets || []);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Talep listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const cleanupSocket = connectTicketSocket((event) => {
      if (event.type === 'TICKET_CREATED') {
        playChimeSound();
        setTickets((prev) => [event.data, ...prev.filter((t) => t.id !== event.data.id)]);
      } else if (event.type === 'TICKET_UPDATED') {
        setTickets((prev) =>
          prev.map((t) => (t.id === event.data.id ? { ...t, ...event.data } : t))
        );
      }
    });

    return () => {
      cleanupSocket();
    };
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openTicketDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setUpdateStatus(ticket.status);
    setUpdateNote(ticket.adminNote || '');
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      setBusy(true);
      await ticketApi.updateTicketStatus(selectedTicket.id, {
        status: updateStatus,
        adminNote: updateNote.trim(),
      });
      setSelectedTicket(null);
      await loadData();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Durum güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const getStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-xl border border-amber-200 bg-amber-50 text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />🟡 İncelemede</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-xl border border-blue-200 bg-blue-50 text-blue-800"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />🔵 İşleme Alındı</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800"><Check className="w-3 h-3" />🟢 Çözüldü</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-xl border border-rose-200 bg-rose-50 text-rose-800"><X className="w-3 h-3" />🔴 Reddedildi</span>;
      default:
        return <span className="px-2.5 py-1 text-[10px] font-bold rounded-xl border border-slate-200 bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden animate-fadeIn">
      {/* Header Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-[#1e3a8a]" />
            Sakin Talep & Şikayet Yönetimi
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Lojman sakinlerinden gelen gürültü, İnternet, temizlik, eşya vb. konuları buradan inceleyebilir ve yanıtlayabilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={loadData} disabled={loading} className="p-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer" title="Listeyi Yenile">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bilet No (Örn: TLP-001), sakinin adı, konu veya açıklama ara..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-[#1e3a8a] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 min-w-[130px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300 cursor-pointer"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="OPEN">🟡 İncelemede</option>
              <option value="IN_PROGRESS">🔵 İşleme Alındı</option>
              <option value="RESOLVED">🟢 Çözüldü</option>
              <option value="REJECTED">🔴 Reddedildi</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 min-w-[160px] rounded-xl border border-slate-300 bg-white px-3 text-[10px] font-extrabold text-slate-700 outline-none hover:border-blue-300 cursor-pointer"
            >
              <option value="ALL">Tüm Kategoriler ({TICKET_CATEGORIES.length})</option>
              {TICKET_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </form>
      </div>

      {/* Main Single Table Container */}
      <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-700 select-none">
                <th className="px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">Bilet No</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Talep Eden Sakin / Oda</th>
                <th className="px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">Kategori</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Konu & Detay</th>
                <th className="px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">Durum</th>
                <th className="px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">Tarih</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center font-bold text-slate-500">Talep ve şikayet kayıtları yükleniyor...</td></tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <MessageSquareWarning className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="font-extrabold text-slate-800">Kayıtlı talep veya şikayet bulunamadı</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Arama veya filtre kriterlerini değiştirin.</p>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket, idx) => {
                  const isDone = ticket.status === 'RESOLVED' || ticket.status === 'REJECTED';
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => openTicketDetail(ticket)}
                      className={`group transition cursor-pointer hover:bg-blue-100/40 ${ticket.status === 'OPEN' ? 'bg-amber-50/20' : ticket.status === 'IN_PROGRESS' ? 'bg-blue-50/20' : idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                    >
                      <td className="px-3 py-3 border-r border-slate-200 whitespace-nowrap font-mono font-black text-[#1e3a8a]">
                        {ticket.ticketNo}
                      </td>

                      <td className="px-3 py-3 border-r border-slate-200 font-bold text-slate-900">
                        <div className="font-black text-slate-900">{ticket.creatorName}</div>
                        {(ticket.blockName || ticket.roomNumber) && (
                          <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                            📍 {ticket.blockName ? `${ticket.blockName} ` : ''}{ticket.roomNumber ? `/ Oda ${ticket.roomNumber}` : ''}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 border-r border-slate-200 whitespace-nowrap">
                        <span className="inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {ticket.category}
                        </span>
                      </td>

                      <td className="px-3 py-3 border-r border-slate-200 max-w-[280px]">
                        <div className="font-extrabold text-slate-900 group-hover:text-[#1e3a8a] truncate">
                          {ticket.subject}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                          {ticket.description}
                        </div>
                      </td>

                      <td className="px-3 py-3 border-r border-slate-200 whitespace-nowrap">
                        {getStatusBadge(ticket.status)}
                      </td>

                      <td className="px-3 py-3 border-r border-slate-200 text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                        {formatDateTime(ticket.createdAt)}
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openTicketDetail(ticket); }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ml-auto ${
                            isDone
                              ? 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'
                              : 'border-slate-300 bg-white hover:border-[#1e3a8a] hover:bg-blue-50 hover:text-[#1e3a8a] text-slate-700'
                          }`}
                        >
                          {isDone ? <Edit3 className="w-3.5 h-3.5 text-slate-600" /> : null}
                          <span>{isDone ? 'Düzenle' : 'İncele & Yanıtla'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ticket Detail & Status Update */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setSelectedTicket(null)}>
          <div className="w-full max-w-xl rounded-3xl border border-slate-300 bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <span className="font-mono font-black text-xs text-[#1e3a8a] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{selectedTicket.ticketNo}</span>
                <h3 className="font-black text-slate-900 text-base mt-1">{selectedTicket.subject}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTicket(null)} className="p-1 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <span className="text-xs font-semibold text-slate-500">Tarih: {formatDateTime(selectedTicket.createdAt)}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#1e3a8a]" />
                  <span>{selectedTicket.creatorName}</span>
                  {(selectedTicket.blockName || selectedTicket.roomNumber) && (
                    <span className="text-slate-500 font-semibold">({selectedTicket.blockName ? `${selectedTicket.blockName} ` : ''}{selectedTicket.roomNumber ? `/ Oda ${selectedTicket.roomNumber}` : ''})</span>
                  )}
                </div>
                <div className="text-xs font-bold text-[#1e3a8a] uppercase bg-blue-100/60 inline-block px-2.5 py-0.5 rounded-md border border-blue-200">
                  Kategori: {selectedTicket.category}
                </div>
                <div className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed mt-2 pt-2 border-t border-slate-200">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Status Update & Management Response Form */}
              {canManage ? (
                <form onSubmit={handleStatusUpdate} className="space-y-4 pt-2 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Yönetim Aksiyonu & Yanıtı</h4>

                  <div>
                    <label className={labelClass}>Durumu Değiştir *</label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value as SupportTicketStatus)}
                      className={inputClass}
                    >
                      <option value="OPEN">🟡 İncelemede (Yeni / Beklemede)</option>
                      <option value="IN_PROGRESS">🔵 İşleme Alındı (İşlem Yapılıyor)</option>
                      <option value="RESOLVED">🟢 Çözüldü (İşlem Tamamlandı)</option>
                      <option value="REJECTED">🔴 Reddedildi / İptal</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Yönetim Yanıtı / Açıklama Notu (Sakine Gösterilir)</label>
                    <textarea
                      rows={3}
                      value={updateNote}
                      onChange={(e) => setUpdateNote(e.target.value)}
                      placeholder="Örn: Teknik ekibimiz saat 14:00'te oda kontrolüne gidecektir / Talebiniz yerine getirilmiştir."
                      className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] focus:ring-2 focus:ring-blue-100 outline-none text-xs font-semibold text-slate-900 transition"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setSelectedTicket(null)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition">
                      Kapat
                    </button>
                    <button type="submit" disabled={busy} className={primaryButton}>
                      <Check className="w-4 h-4 text-white" />
                      <span>{busy ? 'Kaydediliyor...' : 'Durumu Güncelle'}</span>
                    </button>
                  </div>
                </form>
              ) : selectedTicket.adminNote ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-900 block">Yönetim Yanıtı:</span>
                  <p className="text-xs font-bold text-slate-900">{selectedTicket.adminNote}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
