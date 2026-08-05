import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, FileText, Loader2, Search, User, Wrench, X, AlertTriangle } from 'lucide-react';
import { CreateMaintenanceDTO, MaintenanceLog, MaintenancePriority, MaintenanceStatus, maintenanceApi } from '../api/maintenanceApi';
import { roomApi, Room } from '../api/roomApi';

interface AddMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  maintenance?: MaintenanceLog | null;
}

const categories = [
  'Elektrik & Aydınlatma',
  'Su & Tesisat',
  'İklimlendirme & Klima',
  'Mobilya & Ahşap',
  'Beyaz Eşya & Elektronik',
  'Kapı, Pencere & Kilit',
  'Temizlik & Hijyen',
  'Genel Bakım & Onarım',
];

export const AddMaintenanceModal: React.FC<AddMaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  maintenance,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState<string>('');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [roomPickerOpen, setRoomPickerOpen] = useState<boolean>(false);

  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM');
  const [status, setStatus] = useState<MaintenanceStatus>('OPEN');
  const [category, setCategory] = useState<string>(categories[0]);
  const [location, setLocation] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setRoomsLoading(true);

    roomApi
      .getRooms()
      .then((data) => setRooms(data))
      .catch(() => setError('Oda listesi yüklenemedi.'))
      .finally(() => setRoomsLoading(false));

    if (maintenance) {
      setRoomId(maintenance.roomId || maintenance.room?.id || '');
      setRoomSearch(
        maintenance.room
          ? `${maintenance.room.block.name} - Oda ${maintenance.room.roomNumber} (${maintenance.room.floor}. Kat)`
          : ''
      );
      setDescription(maintenance.description || '');
      setPriority(maintenance.priority || 'MEDIUM');
      setStatus(maintenance.status || 'OPEN');
      setCategory(maintenance.category || categories[0]);
      setLocation(maintenance.location || '');
      setAssignedTo(maintenance.assignedTo || '');
      setResolutionNote(maintenance.resolutionNote || '');
    } else {
      setRoomId('');
      setRoomSearch('');
      setDescription('');
      setPriority('MEDIUM');
      setStatus('OPEN');
      setCategory(categories[0]);
      setLocation('');
      setAssignedTo('');
      setResolutionNote('');
    }
  }, [isOpen, maintenance]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.toLocaleLowerCase('tr-TR').trim();
    return rooms
      .filter(
        (room) =>
          !query ||
          `${room.block.name} Oda ${room.roomNumber} ${room.floor}. Kat`
            .toLocaleLowerCase('tr-TR')
            .includes(query)
      )
      .slice(0, 20);
  }, [rooms, roomSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!description.trim()) {
      setError('Lütfen arıza açıklamasını girin.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (maintenance) {
        await maintenanceApi.updateMaintenance(maintenance.id, {
          description: description.trim(),
          priority,
          status,
          category,
          location: location.trim() || null,
          assignedTo: assignedTo.trim() || null,
          resolutionNote: resolutionNote.trim() || null,
        });
      } else {
        const payload: CreateMaintenanceDTO = {
          roomId: roomId || undefined,
          description: description.trim(),
          priority,
          category,
          location: location.trim() || undefined,
        };
        await maintenanceApi.createMaintenance(payload);
      }
      onSuccess();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kayıt işlemi gerçekleştirilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      onMouseDown={onClose}
    >
      <div
        className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-y-auto"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-5 border-b border-slate-200 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {maintenance ? 'Arıza Kaydını Düzenle' : 'Yeni Arıza Bildirimi'}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Teknik arıza bildirim detaylarını kaydedin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Arama Yapılabilir Oda Seçici */}
            <div className="relative sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">
              <label className="block">İlgili Blok / Oda Seçimi</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={roomSearch}
                  onFocus={() => setRoomPickerOpen(true)}
                  onChange={(e) => {
                    setRoomSearch(e.target.value);
                    setRoomId('');
                    setRoomPickerOpen(true);
                  }}
                  placeholder="Oda numarası veya blok adı arayın (Örn: A Blok / Oda 101)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold"
                />
              </div>

              {roomPickerOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomId('');
                      setRoomSearch('Genel / Oda Seçilmedi');
                      setRoomPickerOpen(false);
                    }}
                    className="w-full p-3 text-left hover:bg-blue-50 border-b border-slate-100 font-bold text-xs text-slate-600 cursor-pointer"
                  >
                    Genel / Oda Seçilmedi
                  </button>
                  {roomsLoading ? (
                    <p className="p-4 text-center text-xs text-slate-500 font-semibold">Odalar yükleniyor...</p>
                  ) : filteredRooms.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-500 font-semibold">Eşleşen oda bulunamadı.</p>
                  ) : (
                    filteredRooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => {
                          setRoomId(room.id);
                          setRoomSearch(`${room.block.name} - Oda ${room.roomNumber} (${room.floor}. Kat)`);
                          setRoomPickerOpen(false);
                        }}
                        className="w-full p-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0 cursor-pointer"
                      >
                        <span className="block text-xs font-extrabold text-slate-900">
                          {room.block.name} - Oda {room.roomNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {room.floor}. Kat · Kapasite: {room.capacity} Yatak
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Kategori */}
            <label className="space-y-1.5 text-xs font-extrabold text-slate-700">
              Arıza Kategorisi *
              <span className="relative block">
                <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            {/* Öncelik */}
            <label className="space-y-1.5 text-xs font-extrabold text-slate-700">
              Öncelik Derecesi *
              <span className="relative block">
                <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer"
                >
                  <option value="LOW">Düşük Öncelik</option>
                  <option value="MEDIUM">Orta Öncelik</option>
                  <option value="HIGH">Yüksek Öncelik</option>
                  <option value="URGENT">ACİL (Aksiyon Gerektirir)</option>
                </select>
              </span>
            </label>

            {/* Konum Detayı */}
            <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">
              Konum / Lokasyon Detayı
              <span className="relative block">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  maxLength={100}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Örn: Banyo Tavanı, Oda Kapısı, 2. Kat Koridor vb."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold"
                />
              </span>
            </label>

            {/* Arıza Açıklaması */}
            <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">
              Arıza Açıklaması & Sorun Detayı *
              <span className="relative block">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Sorunu ve belirtileri detaylı şekilde açıklayın..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold resize-none"
                />
              </span>
            </label>

            {/* Sadece Düzenleme Durumunda Ekstra Alanlar */}
            {maintenance && (
              <>
                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">
                  Arıza Durumu
                  <span className="relative block">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer"
                    >
                      <option value="OPEN">Açık (Yeni Bildirim)</option>
                      <option value="IN_PROGRESS">İşlemde (Teknisyen İlgileniyor)</option>
                      <option value="RESOLVED">Çözüldü (Tamir Edildi)</option>
                      <option value="CLOSED">Kapatıldı (Tamamlandı)</option>
                    </select>
                  </span>
                </label>

                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">
                  Çözümleyen Personel
                  <span className="relative block">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      maxLength={100}
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      placeholder="Örn: Lojman Yönetimi veya Mehmet Usta"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold"
                    />
                  </span>
                </label>

                <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">
                  Çözüm & Yapılan İşlem Notu
                  <span className="relative block">
                    <CheckCircle2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Tamirat sonrasında yapılan işlemler..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold resize-none"
                    />
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              İptal
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] text-xs font-bold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wrench className="w-4 h-4" />
              )}
              {maintenance ? 'Değişiklikleri Kaydet' : 'Arıza Kaydını Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
