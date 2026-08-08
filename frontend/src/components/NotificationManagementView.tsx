import React, { useEffect, useState } from 'react';
import { notificationApi, SentNotification } from '../api/notificationApi';
import { employeeApi, Employee } from '../api/employeeApi';
import { roomApi } from '../api/roomApi';
import { User } from '../api/authApi';

interface NotificationManagementViewProps {
  currentUser: User;
}

export const NotificationManagementView: React.FC<NotificationManagementViewProps> = ({ currentUser }) => {
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [selectedDetailNotif, setSelectedDetailNotif] = useState<SentNotification | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [targetType, setTargetType] = useState<'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT'>('ALL');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Auxiliary Options State
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHistory = async (page = historyPage) => {
    try {
      setIsLoadingHistory(true);
      const data = await notificationApi.getSentNotifications(page);
      setHistory(data.items);
      setHistoryPagination(data.pagination);
      setHistoryPage(data.pagination.page);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const roomList = await roomApi.getRooms();
      if (roomList) {
        const uniqueBlocksMap = new Map<string, string>();
        roomList.forEach((r) => {
          if (r.block) {
            uniqueBlocksMap.set(r.block.id, r.block.name);
          }
        });
        setBlocks(Array.from(uniqueBlocksMap.entries()).map(([id, name]) => ({ id, name })));
      }

      const empData = await employeeApi.getEmployees();
      if (empData) {
        setEmployees(empData);
        const depts = Array.from(new Set(empData.map((e) => e.department).filter(Boolean)));
        setDepartments(depts as string[]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory(1);
    fetchOptions();
  }, []);

  const handleUserToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    let targetValue: string | undefined = undefined;

    if (targetType === 'BLOCK') {
      if (!selectedBlock) {
        setStatusMessage({ type: 'error', text: 'Lütfen bildirimin gönderileceği lojman bloğunu seçiniz.' });
        return;
      }
      targetValue = selectedBlock;
    } else if (targetType === 'DEPARTMENT') {
      if (!selectedDept) {
        setStatusMessage({ type: 'error', text: 'Lütfen bildirimin gönderileceği departmanı seçiniz.' });
        return;
      }
      targetValue = selectedDept;
    } else if (targetType === 'SPECIFIC_USERS') {
      if (selectedUserIds.length === 0) {
        setStatusMessage({ type: 'error', text: 'Lütfen en az 1 personel seçiniz.' });
        return;
      }
      targetValue = JSON.stringify(selectedUserIds);
    }

    try {
      setIsSending(true);
      setStatusMessage(null);

      const res = await notificationApi.sendNotification({
        title,
        message,
        priority,
        targetType,
        targetValue,
      });

      setStatusMessage({ type: 'success', text: res.message || 'Bildirim başarıyla gönderildi.' });
      setTitle('');
      setMessage('');
      setSelectedUserIds([]);
      fetchHistory(1);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Bildirim gönderilemedi.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu duyuru/bildirim kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await notificationApi.deleteNotification(id);
      fetchHistory(historyPage);
    } catch (err: any) {
      alert(err.message || 'Silme işlemi başarısız.');
    }
  };

  const filteredEmployeesForSelection = employees.filter((emp) => {
    if (!emp.userId) return false;
    const query = employeeSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      emp.firstName.toLowerCase().includes(query) ||
      emp.lastName.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-300 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bildirim & Duyuru Gönderimi</h1>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Sistemdeki aktif personele toplu, blok, departman veya özel personel hedefli duyuru gönderimi yapın.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT FORM (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-200">
            Yeni Bildirim / Duyuru Oluştur
          </h2>

          {statusMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-red-50 text-red-800 border-red-300'
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <form onSubmit={handleSendSubmit} className="space-y-4">
            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Öncelik Seviyesi</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('NORMAL')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    priority === 'NORMAL'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>📢 Normal Duyuru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('IMPORTANT')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    priority === 'IMPORTANT'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>⚠️ Önemli Duyuru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('URGENT')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    priority === 'URGENT'
                      ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>🚨 Acil Durum</span>
                </button>
              </div>
            </div>

            {/* Target Selector Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Hedef Kitle Seçimi</label>
              <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-2xl border border-slate-300 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTargetType('ALL')}
                  className={`py-2 rounded-xl transition ${targetType === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tüm Herkese
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('BLOCK')}
                  className={`py-2 rounded-xl transition ${targetType === 'BLOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Bloğa Özel
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('DEPARTMENT')}
                  className={`py-2 rounded-xl transition ${targetType === 'DEPARTMENT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Departmana
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('SPECIFIC_USERS')}
                  className={`py-2 rounded-xl transition ${targetType === 'SPECIFIC_USERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Özel Kişiler
                </button>
              </div>
            </div>

            {/* Target Value Conditionals */}
            {targetType === 'BLOCK' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hedef Blok Seçiniz</label>
                <select
                  value={selectedBlock}
                  onChange={(e) => setSelectedBlock(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1e3a8a]"
                >
                  <option value="">-- Blok Seçiniz --</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'DEPARTMENT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hedef Departman Seçiniz</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1e3a8a]"
                >
                  <option value="">-- Departman Seçiniz --</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'SPECIFIC_USERS' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Seçilen Personel Sayısı: <span className="font-bold text-[#1e3a8a]">{selectedUserIds.length}</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Personel ara..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-xl p-2 bg-slate-50 space-y-1">
                  {filteredEmployeesForSelection.map((emp) => {
                    const isSelected = selectedUserIds.includes(emp.userId!);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleUserToggle(emp.userId!)}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                          isSelected ? 'bg-[#1e3a8a] text-white font-bold' : 'hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        <div>
                          <span>{emp.firstName} {emp.lastName}</span>
                          <span className="ml-2 opacity-75 font-normal">({emp.department})</span>
                        </div>
                        {isSelected && <span>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Title & Message Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duyuru / Bildirim Başlığı</label>
              <input
                type="text"
                required
                placeholder="Örn: Lojman Elektrik Kesintisi Hakkında"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duyuru Detay Mesajı</label>
              <textarea
                rows={4}
                required
                placeholder="Bildirim detaylarını buraya yazınız..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1e3a8a] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 bg-[#1e3a8a] hover:bg-[#152a65] text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending ? 'Gönderiliyor...' : '🚀 Bildirimi Gönder'}
            </button>
          </form>
        </div>

        {/* RIGHT HISTORY TABLE (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Gönderilen Bildirim Geçmişi & Audit Log
            </h2>
            <span className="px-2.5 py-0.5 bg-[#1e3a8a]/10 text-[#1e3a8a] text-xs font-extrabold rounded-full border border-[#1e3a8a]/20">
              {historyPagination.total} Kayıt
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="text-center py-8 text-xs font-semibold text-slate-600">Yükleniyor...</div>
          ) : history.length > 0 ? (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {history.map((item) => {
                const isUrgent = item.priority === 'URGENT';
                const isImportant = item.priority === 'IMPORTANT';

                const targetLabel = item.targetType === 'ALL'
                  ? 'Tüm Personeller'
                  : item.targetType === 'BLOCK'
                  ? `Blok (${item.targetValue})`
                  : item.targetType === 'DEPARTMENT'
                  ? `Departman (${item.targetValue})`
                  : 'Belirli Personeller';

                const formattedDate = new Date(item.createdAt).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Istanbul',
                });

                return (
                  <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider mb-1 border ${
                            isUrgent
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : isImportant
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isUrgent ? 'ACİL' : isImportant ? 'ÖNEMLİ' : 'DUYURU'}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedDetailNotif(item)}
                          className="px-2.5 py-1 bg-[#1e3a8a]/10 hover:bg-[#1e3a8a]/20 text-[#1e3a8a] text-xs font-bold rounded-lg transition border border-[#1e3a8a]/20"
                        >
                          👁️ Detay Gör
                        </button>
                        {currentUser.role === 'ADMIN' && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold hover:underline px-1"
                            title="Bildirimi Aktif Listeden Kaldır"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 font-medium line-clamp-2">{item.message}</p>

                    <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-600 font-medium">
                      <div className="flex items-center justify-between">
                        <span>👤 <strong>Gönderen:</strong> {item.senderName || 'Sistem Yöneticisi'}</span>
                        <span className="text-slate-400">📅 {formattedDate}</span>
                      </div>
                      <div>
                        🎯 <strong>Hedef Kitle:</strong> {targetLabel} ({item.totalRecipients} Kişi)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic text-center py-8">Henüz gönderilmiş duyuru kaydı bulunmuyor.</p>
          )}
          {historyPagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-bold text-slate-600">
              <button type="button" disabled={historyPage <= 1 || isLoadingHistory} onClick={() => fetchHistory(historyPage - 1)} className="px-3 py-2 rounded-xl border border-slate-300 disabled:opacity-40">Önceki</button>
              <span>Sayfa {historyPage} / {historyPagination.totalPages}</span>
              <button type="button" disabled={historyPage >= historyPagination.totalPages || isLoadingHistory} onClick={() => fetchHistory(historyPage + 1)} className="px-3 py-2 rounded-xl border border-slate-300 disabled:opacity-40">Sonraki</button>
            </div>
          )}
        </div>
      </div>

      {/* Notification Full Audit Detail Modal */}
      {selectedDetailNotif && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-[#1e3a8a] bg-[#1e3a8a]/10 px-2.5 py-0.5 rounded-full border border-[#1e3a8a]/20 uppercase">
                  Bildirim Audit Log Kaydı
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedDetailNotif.title}</h3>
              </div>
              <button
                onClick={() => setSelectedDetailNotif(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 font-semibold text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Gönderen Yetkili</span>
                  <span className="text-slate-900 font-bold">{selectedDetailNotif.senderName || 'Sistem Yöneticisi'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Gönderim Zamanı</span>
                  <span className="text-slate-900 font-bold">
                    {new Date(selectedDetailNotif.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZone: 'Europe/Istanbul',
                    })}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">Duyuru / Bildirim Mesaj Metni</span>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-slate-800 text-xs font-medium whitespace-pre-wrap leading-relaxed">
                  {selectedDetailNotif.message}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  İletilen Alıcı Listesi ({selectedDetailNotif.totalRecipients} Kişi)
                </span>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl max-h-32 overflow-y-auto text-slate-700 font-medium text-[11px] leading-relaxed">
                  {selectedDetailNotif.recipientNames || `${selectedDetailNotif.totalRecipients} Personele İletildi`}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedDetailNotif(null)}
              className="w-full py-2.5 bg-[#1e3a8a] text-white text-xs font-bold rounded-xl hover:bg-[#152a65] transition shadow-sm"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
