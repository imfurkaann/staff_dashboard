import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  Search,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  CreateMaintenanceDTO,
  InventoryFaultStatus,
  MaintenanceLog,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
  maintenanceApi,
} from '../api/maintenanceApi';
import { roomApi, Room, RoomInventory } from '../api/roomApi';
import { generateUUID } from '../utils/cryptoHelpers';

interface AddMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  maintenance?: MaintenanceLog | null;
  initialRoomId?: string;
  initialRoomLabel?: string;
  canRetireInventory?: boolean;
  canManageServiceDetails?: boolean;
  currentUserRole?: string;
  currentUserFullName?: string;
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

const inventoryStatusOptions: Array<{ value: InventoryFaultStatus; label: string; help: string }> = [
  { value: 'MAINTENANCE_REQUIRED', label: 'Arızalı / Bakım Bekliyor', help: 'Demirbaş odada kalır ve bakım bekler.' },
  { value: 'DAMAGED', label: 'Kırık / Hasarlı', help: 'Hasarlı olarak işaretlenir, stok miktarı değişmez.' },
  { value: 'IN_SERVICE', label: 'Tamirde / Serviste', help: 'Serviste olarak izlenir, oda zimmeti devam eder.' },
  { value: 'REPLACEMENT_REQUIRED', label: 'Değişim Bekliyor', help: 'Depodan değişim planlanması gerektiğini gösterir.' },
  { value: 'LOST', label: 'Kayıp / Zayi', help: 'Zimmet kapatılır ve miktar toplam stoktan kalıcı olarak düşülür.' },
];

function inventoryLabel(item: RoomInventory): string {
  return `${item.assetTag ? `[${item.assetTag}] ` : ''}${item.itemName}${item.brand ? ` · ${item.brand}` : ''}${item.serialNo ? ` · S/N ${item.serialNo}` : ''} · ${item.quantity} adet`;
}

function requestErrorMessage(error: unknown): string {
  const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return apiMessage || (error instanceof Error ? error.message : 'Kayıt işlemi gerçekleştirilemedi.');
}

export const AddMaintenanceModal: React.FC<AddMaintenanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  maintenance,
  initialRoomId,
  initialRoomLabel,
  canRetireInventory = true,
  canManageServiceDetails = true,
  currentUserRole,
  currentUserFullName = 'Teknik Personel',
}) => {
  const requestKeyRef = useRef('');
  const [faultType, setFaultType] = useState<MaintenanceType | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomInventories, setRoomInventories] = useState<RoomInventory[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [inventoriesLoading, setInventoriesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [roomInventoryId, setRoomInventoryId] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState<InventoryFaultStatus>('MAINTENANCE_REQUIRED');
  const [lostConfirmed, setLostConfirmed] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('MEDIUM');
  const [status, setStatus] = useState<MaintenanceStatus>('OPEN');
  const [category, setCategory] = useState(categories[0]);
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [serviceReference, setServiceReference] = useState('');
  const [laborCost, setLaborCost] = useState(0);
  const [partsCost, setPartsCost] = useState(0);
  const [warrantyCovered, setWarrantyCovered] = useState(false);
  const [sentToServiceAt, setSentToServiceAt] = useState('');
  const [returnedFromServiceAt, setReturnedFromServiceAt] = useState('');

  const fixedRoom = Boolean(initialRoomId && !maintenance);

  useEffect(() => {
    if (!isOpen) return;
    if (!maintenance) requestKeyRef.current = generateUUID();
    setError(null);
    setRoomsLoading(true);
    roomApi.getRooms().then(setRooms).catch(() => setError('Oda listesi yüklenemedi.')).finally(() => setRoomsLoading(false));

    if (maintenance) {
      setFaultType(maintenance.type || 'GENERAL');
      setRoomId(maintenance.roomId || maintenance.room?.id || '');
      setRoomSearch(maintenance.room ? `${maintenance.room.block.name} - Oda ${maintenance.room.roomNumber} (${maintenance.room.floor}. Kat)` : '');
      setRoomInventoryId(maintenance.roomInventoryId || '');
      setInventoryStatus((maintenance.inventoryStatus as InventoryFaultStatus) || 'MAINTENANCE_REQUIRED');
      setLostConfirmed(false);
      setDescription(maintenance.description || '');
      setPriority(maintenance.priority || 'MEDIUM');
      setStatus(maintenance.status || 'OPEN');
      setCategory(maintenance.category || categories[0]);
      const isTech = currentUserRole === 'TECHNICIAN' || currentUserRole === 'TECHNICAL_MANAGER';
      setAssignedTo(isTech ? (maintenance.assignedTo || currentUserFullName) : (maintenance.assignedTo || ''));
      setResolutionNote(maintenance.resolutionNote || '');
      setServiceProvider(maintenance.serviceProvider || ''); setServiceReference(maintenance.serviceReference || '');
      setLaborCost(maintenance.laborCost || 0); setPartsCost(maintenance.partsCost || 0); setWarrantyCovered(Boolean(maintenance.warrantyCovered));
      setSentToServiceAt(maintenance.sentToServiceAt?.slice(0, 16) || ''); setReturnedFromServiceAt(maintenance.returnedFromServiceAt?.slice(0, 16) || '');
    } else {
      const isTech = currentUserRole === 'TECHNICIAN' || currentUserRole === 'TECHNICAL_MANAGER';
      setFaultType(null);
      setRoomId(initialRoomId || '');
      setRoomSearch(initialRoomLabel || '');
      setRoomInventoryId('');
      setInventoryStatus('MAINTENANCE_REQUIRED');
      setLostConfirmed(false);
      setDescription('');
      setPriority('MEDIUM');
      setStatus('OPEN');
      setCategory(categories[0]);
      setLocation('');
      setAssignedTo(isTech ? currentUserFullName : '');
      setResolutionNote('');
      setServiceProvider(''); setServiceReference(''); setLaborCost(0); setPartsCost(0); setWarrantyCovered(false); setSentToServiceAt(''); setReturnedFromServiceAt('');
    }
  }, [isOpen, maintenance, initialRoomId, initialRoomLabel, currentUserRole, currentUserFullName]);

  useEffect(() => {
    if (!isOpen || faultType !== 'ROOM_INVENTORY' || !roomId || maintenance) {
      if (!maintenance) setRoomInventories([]);
      return;
    }
    let active = true;
    setInventoriesLoading(true);
    setRoomInventoryId('');
    roomApi.getRoomById(roomId)
      .then((room) => {
        if (active) setRoomInventories((room.inventories || []).filter((item) => !item.returnedAt && item.status !== 'RETIRED' && item.status !== 'LOST'));
      })
      .catch(() => active && setError('Odadaki demirbaşlar yüklenemedi.'))
      .finally(() => active && setInventoriesLoading(false));
    return () => { active = false; };
  }, [isOpen, faultType, roomId, maintenance]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.toLocaleLowerCase('tr-TR').trim();
    return rooms.filter((room) => !query || `${room.block.name} Oda ${room.roomNumber} ${room.floor}. Kat`.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 20);
  }, [rooms, roomSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roomId) return setError('Lütfen arızanın bulunduğu odayı seçin.');
    if (!description.trim()) return setError('Lütfen arıza durumuna uygun açıklamayı girin.');
    if (faultType === 'ROOM_INVENTORY' && !roomInventoryId) return setError('Lütfen odadaki demirbaşlardan birini seçin.');
    if (faultType === 'ROOM_INVENTORY' && inventoryStatus === 'LOST' && !lostConfirmed) return setError('Kayıp / zayi stok düşümünü onaylamalısınız.');

    setSubmitting(true);
    setError(null);
    try {
      if (maintenance) {
        await maintenanceApi.updateMaintenance(maintenance.id, {
          description: description.trim(), priority, status, category,
          location: location.trim() || null,
          assignedTo: assignedTo.trim() || null,
          resolutionNote: resolutionNote.trim() || null,
          ...(maintenance.type === 'ROOM_INVENTORY' && status !== 'RESOLVED' && status !== 'CLOSED' ? { inventoryStatus } : {}),
          ...(canManageServiceDetails ? {
            serviceProvider: serviceProvider.trim() || null,
            serviceReference: serviceReference.trim() || null,
            laborCost, partsCost, warrantyCovered,
            sentToServiceAt: sentToServiceAt || null,
            returnedFromServiceAt: returnedFromServiceAt || null,
          } : {}),
        });
      } else {
        const payload: CreateMaintenanceDTO = {
          roomId,
          type: faultType || 'GENERAL',
          description: description.trim(),
          priority,
          ...(faultType === 'ROOM_INVENTORY'
            ? { roomInventoryId, inventoryStatus, category: 'Demirbaş Arızası' }
            : { category, location: location.trim() || undefined }),
        };
        await maintenanceApi.createMaintenance(payload, requestKeyRef.current);
      }
      onSuccess();
      onClose();
    } catch (caught) {
      setError(requestErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInventory = roomInventories.find((item) => item.id === roomInventoryId);
  const allowedInventoryStatusOptions = (canRetireInventory ? inventoryStatusOptions : inventoryStatusOptions.filter((item) => item.value !== 'LOST'))
    .filter((item) => !maintenance || item.value !== 'LOST');
  const statusHelp = allowedInventoryStatusOptions.find((item) => item.value === inventoryStatus)?.help;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print" onMouseDown={onClose}>
      <div className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-20 bg-white flex items-center justify-between p-5 border-b border-slate-200 rounded-t-3xl">
          <div className="flex items-center gap-3">
            {!maintenance && faultType && <button type="button" onClick={() => setFaultType(null)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"><ArrowLeft className="w-4 h-4" /></button>}
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center">{faultType === 'ROOM_INVENTORY' ? <Package className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}</span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{maintenance ? 'Arıza Kaydını Düzenle' : faultType ? (faultType === 'ROOM_INVENTORY' ? 'Demirbaş Arızası' : 'Genel Oda Arızası') : 'Arıza Türünü Seçin'}</h3>
              <p className="text-xs font-semibold text-slate-500">{faultType === 'ROOM_INVENTORY' ? 'Demirbaş, durum ve açıklama stok kayıtlarıyla birlikte işlenir.' : 'Oda ve arıza bilgilerini eksiksiz kaydedin.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {!maintenance && !faultType ? (
          <div className="p-6 grid sm:grid-cols-2 gap-4">
            <button type="button" onClick={() => setFaultType('ROOM_INVENTORY')} className="text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-[#1e3a8a] hover:bg-blue-50 transition-colors group">
              <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><Package className="w-6 h-6" /></span>
              <strong className="block mt-4 text-sm text-slate-950">Demirbaş Arızası</strong>
              <span className="block mt-1 text-xs font-semibold text-slate-600">Odadaki kayıtlı demirbaşı seçin; durum, zimmet ve stok otomatik güncellensin.</span>
            </button>
            <button type="button" onClick={() => setFaultType('GENERAL')} className="text-left p-5 rounded-2xl border-2 border-slate-200 hover:border-[#1e3a8a] hover:bg-blue-50 transition-colors">
              <span className="w-12 h-12 rounded-2xl bg-blue-100 text-[#1e3a8a] flex items-center justify-center"><Building2 className="w-6 h-6" /></span>
              <strong className="block mt-4 text-sm text-slate-950">Genel Oda Arızası</strong>
              <span className="block mt-1 text-xs font-semibold text-slate-600">Elektrik, tesisat, kapı, pencere ve diğer oda sorunlarını mevcut form ile bildirin.</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
            {maintenance?.type === 'ROOM_INVENTORY' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                <strong className="block">Bağlı demirbaş: {maintenance.inventoryAssetTagSnapshot ? `[${maintenance.inventoryAssetTagSnapshot}] ` : ''}{maintenance.inventoryItemNameSnapshot}</strong>
                <span>{maintenance.inventoryBrandSnapshot || 'Marka yok'} · {maintenance.inventorySerialNoSnapshot ? `S/N ${maintenance.inventorySerialNoSnapshot}` : 'Seri no yok'} · Kayıt anındaki durum: {inventoryStatusOptions.find((item) => item.value === maintenance.inventoryStatus)?.label || maintenance.inventoryStatus}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">
                <label className="block">İlgili Blok / Oda *</label>
                <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={roomSearch} disabled={Boolean(maintenance) || fixedRoom} onFocus={() => setRoomPickerOpen(true)} onChange={(e) => { setRoomSearch(e.target.value); setRoomId(''); setRoomInventoryId(''); setRoomPickerOpen(true); }} placeholder="Oda numarası veya blok adı arayın" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 disabled:bg-slate-100 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold" /></div>
                {roomPickerOpen && !maintenance && !fixedRoom && <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-xl">{roomsLoading ? <p className="p-4 text-center text-xs text-slate-500">Odalar yükleniyor...</p> : filteredRooms.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">Eşleşen oda bulunamadı.</p> : filteredRooms.map((room) => <button key={room.id} type="button" onClick={() => { setRoomId(room.id); setRoomSearch(`${room.block.name} - Oda ${room.roomNumber} (${room.floor}. Kat)`); setRoomPickerOpen(false); }} className="w-full p-3 text-left hover:bg-blue-50 border-b border-slate-100"><span className="block text-xs font-extrabold">{room.block.name} - Oda {room.roomNumber}</span><span className="text-[10px] text-slate-500">{room.floor}. Kat · Kapasite: {room.capacity}</span></button>)}</div>}
              </div>

              {faultType === 'ROOM_INVENTORY' && !maintenance && <>
                <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Odadaki Demirbaş *<select value={roomInventoryId} onChange={(e) => setRoomInventoryId(e.target.value)} disabled={!roomId || inventoriesLoading} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none"><option value="">{!roomId ? 'Önce oda seçin' : inventoriesLoading ? 'Demirbaşlar yükleniyor...' : 'Demirbaş seçin'}</option>{roomInventories.map((item) => <option key={item.id} value={item.id}>{inventoryLabel(item)}</option>)}</select>{roomId && !inventoriesLoading && roomInventories.length === 0 && <span className="block text-rose-700">Bu odada arıza kaydı açılabilecek aktif demirbaş yok.</span>}</label>
                <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Demirbaş Durumu *<select value={inventoryStatus} onChange={(e) => { setInventoryStatus(e.target.value as InventoryFaultStatus); setLostConfirmed(false); }} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none">{allowedInventoryStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className={`block font-semibold ${inventoryStatus === 'LOST' ? 'text-rose-700' : 'text-slate-500'}`}>{statusHelp}</span></label>
                {inventoryStatus === 'LOST' && selectedInventory && <label className="sm:col-span-2 flex gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 cursor-pointer"><input type="checkbox" checked={lostConfirmed} onChange={(e) => setLostConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" /><AlertTriangle className="w-4 h-4 shrink-0" /><span>{selectedInventory.quantity} adet {selectedInventory.itemName} oda zimmetinden kapatılacak ve toplam stoktan kalıcı olarak düşülecek. Bu işlemi onaylıyorum.</span></label>}
              </>}

              {faultType === 'GENERAL' && <>
                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Arıza Kategorisi *<select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Konum / Alan<input maxLength={100} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Örn: Banyo tavanı" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none" /></label>
              </>}

              <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Öncelik Derecesi *<select value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none"><option value="LOW">Düşük</option><option value="MEDIUM">Orta</option><option value="HIGH">Yüksek</option><option value="URGENT">Acil</option></select></label>
              <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Arıza Açıklaması *<span className="relative block"><FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><textarea required rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={faultType === 'ROOM_INVENTORY' ? 'Seçilen demirbaş durumunun nedenini ve tespit detaylarını yazın...' : 'Sorunu ve belirtileri detaylı şekilde açıklayın...'} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none text-xs font-bold resize-none" /></span></label>

              {maintenance && <>
                {maintenance.type === 'ROOM_INVENTORY' && status !== 'RESOLVED' && status !== 'CLOSED' && <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Güncel Demirbaş Durumu<select value={inventoryStatus} onChange={(e) => setInventoryStatus(e.target.value as InventoryFaultStatus)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50">{allowedInventoryStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span className="block font-semibold text-slate-500">Durum değişikliği stok hareket geçmişine kaydedilir.</span></label>}
                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Arıza Durumu<select value={status} onChange={(e) => setStatus(e.target.value as MaintenanceStatus)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50"><option value="OPEN">Açık</option><option value="IN_PROGRESS">İşlemde</option><option value="RESOLVED">Çözüldü</option><option value="CLOSED">Kapatıldı</option></select></label>
                <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Çözümleyen Personel<span className="relative block"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input maxLength={100} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50" /></span></label>
                <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Çözüm / Yapılan İşlem Notu <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span><textarea rows={2} maxLength={1000} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="Yapılan kontrolü, onarımı veya sonucu yazabilirsiniz (İsteğe bağlı)..." className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 resize-none" /></label>
                {maintenance.type === 'ROOM_INVENTORY' && canManageServiceDetails && <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <p className="sm:col-span-2 text-xs font-black text-blue-950">Servis, Garanti ve Maliyet Bilgileri</p>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Servis Firması<input maxLength={150} value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Servis / İş Emri No<input maxLength={100} value={serviceReference} onChange={(e) => setServiceReference(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Servise Gönderilme<input type="datetime-local" value={sentToServiceAt} onChange={(e) => setSentToServiceAt(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Servisten Dönüş<input type="datetime-local" value={returnedFromServiceAt} onChange={(e) => setReturnedFromServiceAt(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">İşçilik Maliyeti (₺)<input type="number" min={0} step="0.01" value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Parça Maliyeti (₺)<input type="number" min={0} step="0.01" value={partsCost} onChange={(e) => setPartsCost(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white" /></label>
                  <label className="sm:col-span-2 flex items-center gap-2 text-xs font-extrabold text-slate-700"><input type="checkbox" checked={warrantyCovered} onChange={(e) => setWarrantyCovered(e.target.checked)} className="h-4 w-4" /> İşlem garanti kapsamında gerçekleştirildi</label>
                  <div className="sm:col-span-2 rounded-xl bg-white p-3 text-xs font-bold text-slate-700">Toplam servis maliyeti: <strong>{(laborCost + partsCost).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</strong></div>
                </div>}
              </>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">İptal</button><button disabled={submitting} type="submit" className="px-5 py-2.5 rounded-xl bg-[#1e3a8a] text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : maintenance ? <CheckCircle2 className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}{maintenance ? 'Değişiklikleri Kaydet' : 'Arıza Kaydını Oluştur'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
};
