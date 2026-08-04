import React, { useState, useEffect } from 'react';
import {
  BedDouble,
  Building2,
  Layers,
  Printer,
  UserCheck,
  UserX,
  Briefcase,
  Phone,
  Cigarette,
  CigaretteOff,
  Moon,
  Wrench,
  Package,
  History,
  Plus,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  Loader2,
  FileText,
  User as UserIcon,
  Search,
  Edit,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Room, RoomBed, RoomInventoryStatus, RoomMaintenance, RoomStatusType, RoomCleaningLog, roomApi } from '../api/roomApi';

interface RoomDetailViewProps {
  room: Room;
  onBack: () => void;
  onRoomUpdated?: (updatedRoom: Room) => void;
  onNavigateToEmployee?: (employeeId: string) => void;
}

type RoomTabType = 'overview' | 'inventory' | 'maintenance' | 'cleaning' | 'history';
type RoomPrintType = 'maintenance' | 'history' | 'inventory' | 'all';

export const RoomDetailView: React.FC<RoomDetailViewProps> = ({
  room,
  onBack,
  onRoomUpdated,
  onNavigateToEmployee,
}) => {
  const [currentRoom, setCurrentRoom] = useState<Room>(room);
  const [activeTab, setActiveTab] = useState<RoomTabType>(() => {
    const savedTab = localStorage.getItem('staff_app_room_detail_tab') as RoomTabType;
    return ['overview', 'inventory', 'maintenance', 'history'].includes(savedTab) ? savedTab : 'overview';
  });
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [updatingInventoryId, setUpdatingInventoryId] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<RoomPrintType>('all');

  // Cleaning Log Modal & Action State
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [cleaningSubmitting, setCleaningSubmitting] = useState(false);
  const [cleaningError, setCleaningError] = useState<string | null>(null);
  const [updatingCleaningId, setUpdatingCleaningId] = useState<string | null>(null);
  const [cleaningToDelete, setCleaningToDelete] = useState<RoomCleaningLog | null>(null);
  const [cleaningToEdit, setCleaningToEdit] = useState<RoomCleaningLog | null>(null);
  const [selectedCleaningNote, setSelectedCleaningNote] = useState<{ title: string; content: string } | null>(null);
  const [cleaningForm, setCleaningForm] = useState({
    requestedBy: 'Lojman Yönetimi',
    notes: '',
  });

  // Maintenance Report Modal State
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [updatingMaintenanceId, setUpdatingMaintenanceId] = useState<string | null>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<RoomMaintenance | null>(null);
  const [maintenanceToEdit, setMaintenanceToEdit] = useState<RoomMaintenance | null>(null);
  const [editMaintenanceForm, setEditMaintenanceForm] = useState({ category: '', description: '', priority: 'MEDIUM', location: '', assignedTo: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({
    category: '',
    description: '',
    priority: 'MEDIUM',
    location: '',
  });

  const maintenanceCategories = [
    { value: 'Elektrik / Aydınlatma', label: 'Elektrik / Aydınlatma' },
    { value: 'Tesisat / Su Arızası', label: 'Tesisat / Su Arızası' },
    { value: 'İklimlendirme / Klima', label: 'İklimlendirme / Klima' },
    { value: 'Mobilya / Donatı', label: 'Mobilya / Donatı' },
    { value: 'Elektronik Cihaz', label: 'Elektronik Cihaz' },
    { value: 'Kapı / Kilit / Cam', label: 'Kapı / Kilit / Cam' },
    { value: 'Banyo / WC', label: 'Banyo / WC' },
    { value: 'Temizlik / Hijyen', label: 'Temizlik / Hijyen' },
    { value: 'Güvenlik / Yangın', label: 'Güvenlik / Yangın' },
    { value: 'Diğer / Genel', label: 'Diğer / Genel' },
  ];

  const handleMaintenanceSubmit = async () => {
    if (!maintenanceForm.description.trim() || !maintenanceForm.category) {
      setMaintenanceError('Lütfen arıza kategorisi ve detaylı açıklamayı eksiksiz doldurun.');
      return;
    }

    setMaintenanceSubmitting(true);
    setMaintenanceError(null);
    try {
      const created = await roomApi.createMaintenance(currentRoom.id, {
        title: maintenanceForm.category,
        description: maintenanceForm.description.trim(),
        priority: maintenanceForm.priority,
        category: maintenanceForm.category,
        location: maintenanceForm.location.trim() || undefined,
      });
      const updatedRoom = { ...currentRoom, maintenances: [created, ...(currentRoom.maintenances || [])] };
      setCurrentRoom(updatedRoom);
      if (onRoomUpdated) onRoomUpdated(updatedRoom);

      setShowMaintenanceModal(false);
      setMaintenanceForm({ category: '', description: '', priority: 'MEDIUM', location: '' });
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || err?.message || 'Arıza kaydı oluşturulamadı.');
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const replaceMaintenance = (updated: RoomMaintenance) => {
    const updatedRoom = {
      ...currentRoom,
      maintenances: (currentRoom.maintenances || []).map((item) => item.id === updated.id ? updated : item),
    };
    setCurrentRoom(updatedRoom);
    if (onRoomUpdated) onRoomUpdated(updatedRoom);
  };

  const openMaintenanceEdit = (maintenance: RoomMaintenance) => {
    setMaintenanceError(null);
    setEditMaintenanceForm({ category: maintenance.category || maintenance.title, description: maintenance.description || '', priority: maintenance.priority || 'MEDIUM', location: maintenance.location || '', assignedTo: maintenance.assignedTo || '' });
    setMaintenanceToEdit(maintenance);
  };

  const handleEditMaintenance = async () => {
    if (!maintenanceToEdit || !editMaintenanceForm.category.trim() || !editMaintenanceForm.description.trim()) return;
    setUpdatingMaintenanceId(maintenanceToEdit.id);
    setMaintenanceError(null);
    try {
      const updated = await roomApi.updateMaintenance(maintenanceToEdit.id, {
        title: editMaintenanceForm.category, category: editMaintenanceForm.category,
        description: editMaintenanceForm.description, priority: editMaintenanceForm.priority,
        location: editMaintenanceForm.location || null, assignedTo: editMaintenanceForm.assignedTo || null,
      });
      replaceMaintenance(updated);
      setMaintenanceToEdit(null);
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || 'Arıza kaydı güncellenemedi.');
    } finally { setUpdatingMaintenanceId(null); }
  };

  const handleResolveMaintenance = async (maintenance: RoomMaintenance) => {
    setUpdatingMaintenanceId(maintenance.id);
    setMaintenanceError(null);
    try {
      const updated = await roomApi.updateMaintenance(maintenance.id, { status: 'RESOLVED' });
      replaceMaintenance(updated);
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || 'Arıza çözüldü olarak kaydedilemedi.');
    } finally { setUpdatingMaintenanceId(null); }
  };

  const handleUndoResolveMaintenance = async (maintenance: RoomMaintenance) => {
    setUpdatingMaintenanceId(maintenance.id);
    setMaintenanceError(null);
    try {
      const updated = await roomApi.updateMaintenance(maintenance.id, { status: 'OPEN', resolutionNote: null });
      replaceMaintenance(updated);
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || 'Çözüldü işlemi geri alınamadı.');
    } finally { setUpdatingMaintenanceId(null); }
  };

  const handleDeleteMaintenance = async () => {
    if (!maintenanceToDelete) return;
    setUpdatingMaintenanceId(maintenanceToDelete.id);
    setMaintenanceError(null);
    try {
      await roomApi.deleteMaintenance(maintenanceToDelete.id);
      const updatedRoom = {
        ...currentRoom,
        maintenances: (currentRoom.maintenances || []).filter((item) => item.id !== maintenanceToDelete.id),
      };
      setCurrentRoom(updatedRoom);
      if (onRoomUpdated) onRoomUpdated(updatedRoom);
      setMaintenanceToDelete(null);
    } catch (err: any) {
      setMaintenanceError(err?.response?.data?.message || 'Arıza kaydı silinemedi. Bu işlem yalnızca yönetici yetkisiyle yapılabilir.');
    } finally {
      setUpdatingMaintenanceId(null);
    }
  };

  const handleInventoryStatusChange = async (invId: string, newStatus: RoomInventoryStatus) => {
    setUpdatingInventoryId(invId);
    setRoomError(null);
    try {
      const updated = await roomApi.updateInventory(invId, { status: newStatus });
      const updatedRoom = { ...currentRoom, inventories: (currentRoom.inventories || []).map((item) => item.id === updated.id ? updated : item) };
      setCurrentRoom(updatedRoom);
      if (onRoomUpdated) onRoomUpdated(updatedRoom);
    } catch (err: any) {
      setRoomError(err?.response?.data?.message || err?.message || 'Zimmet durumu güncellenemedi.');
    } finally { setUpdatingInventoryId(null); }
  };

  const handleSelectEmployee = (empId: string) => {
    localStorage.setItem('staff_app_active_emp_id', empId);
    localStorage.setItem('staff_app_active_tab', 'employees');
    if (onNavigateToEmployee) {
      onNavigateToEmployee(empId);
    }
  };

  const handleTabChange = (tab: RoomTabType) => {
    setActiveTab(tab);
    localStorage.setItem('staff_app_room_detail_tab', tab);
  };

  // Status Change Handler
  const handleStatusChange = async (newStatus: RoomStatusType) => {
    setRoomError(null);
    try {
      const updated = await roomApi.updateRoomStatus(currentRoom.id, newStatus);
      setCurrentRoom(updated);
      if (onRoomUpdated) onRoomUpdated(updated);
    } catch (err: any) {
      setRoomError(err?.response?.data?.message || err?.message || 'Oda durumu güncellenemedi.');
    }
  };

  // Cleaning Log Handlers
  const handleCleaningSubmit = async () => {
    setCleaningSubmitting(true);
    setCleaningError(null);
    try {
      let updated: Room;
      if (cleaningToEdit) {
        updated = await roomApi.updateCleaningLog(cleaningToEdit.id, {
          requestedBy: cleaningForm.requestedBy || 'Lojman Yönetimi',
          notes: cleaningForm.notes.trim() || undefined,
        });
      } else {
        updated = await roomApi.createCleaningLog(currentRoom.id, {
          requestedBy: cleaningForm.requestedBy || 'Lojman Yönetimi',
          notes: cleaningForm.notes.trim() || undefined,
          status: 'NEEDS_CLEANING',
        });
      }
      setCurrentRoom(updated);
      if (onRoomUpdated) onRoomUpdated(updated);
      setShowCleaningModal(false);
      setCleaningToEdit(null);
      setCleaningForm({
        requestedBy: 'Lojman Yönetimi',
        notes: '',
      });
    } catch (err: any) {
      setCleaningError(err.response?.data?.message || 'Temizlik kaydı işlenirken bir hata oluştu.');
    } finally {
      setCleaningSubmitting(false);
    }
  };

  const handleQuickMarkCleaned = async (log: RoomCleaningLog) => {
    setUpdatingCleaningId(log.id);
    try {
      const updated = await roomApi.updateCleaningLog(log.id, {
        status: 'CLEANED',
        cleanedBy: 'Lojman Yönetimi',
        notes: log.notes ? `${log.notes} (Temizlendi olarak işaretlendi)` : 'Oda temizlendi ve hazır hale getirildi.',
      });
      setCurrentRoom(updated);
      if (onRoomUpdated) onRoomUpdated(updated);
    } catch (err: any) {
      setRoomError(err.response?.data?.message || 'Temizlik durumu güncellenirken hata oluştu.');
    } finally {
      setUpdatingCleaningId(null);
    }
  };

  const handleQuickStartCleaning = async (log: RoomCleaningLog) => {
    setUpdatingCleaningId(log.id);
    try {
      const updated = await roomApi.updateCleaningLog(log.id, {
        status: 'IN_PROGRESS',
        notes: log.notes ? `${log.notes} (Temizliğe başlandı)` : 'Temizlik işlemi başlatıldı.',
      });
      setCurrentRoom(updated);
      if (onRoomUpdated) onRoomUpdated(updated);
    } catch (err: any) {
      setRoomError(err.response?.data?.message || 'Temizlik durumu güncellenirken hata oluştu.');
    } finally {
      setUpdatingCleaningId(null);
    }
  };

  const handleDeleteCleaningSubmit = async () => {
    if (!cleaningToDelete) return;
    setUpdatingCleaningId(cleaningToDelete.id);
    try {
      const updated = await roomApi.deleteCleaningLog(cleaningToDelete.id);
      setCurrentRoom(updated);
      if (onRoomUpdated) onRoomUpdated(updated);
      setCleaningToDelete(null);
    } catch (err: any) {
      setRoomError(err.response?.data?.message || 'Temizlik kaydı silinirken bir hata oluştu.');
    } finally {
      setUpdatingCleaningId(null);
    }
  };

  // Calculations
  const occupiedBeds = currentRoom.beds ? currentRoom.beds.filter((b) => b.isOccupied) : [];
  const occupiedCount = occupiedBeds.length;
  const vacantCount = currentRoom.capacity - occupiedCount;
  const occupancyRate =
    currentRoom.capacity > 0 ? Math.round((occupiedCount / currentRoom.capacity) * 100) : 0;

  // Print Handler
  const handlePrint = (type: RoomPrintType) => {
    setPrintType(type);
    setShowPrintModal(false);
    const originalTitle = document.title;
    const printNames: Record<RoomPrintType, string> = { maintenance: 'Arıza Dökümü', history: 'Konaklama Geçmişi', inventory: 'Oda Zimmetleri', all: 'Genel Oda Dökümü' };
    document.title = `Oda-${currentRoom.roomNumber}-${printNames[type]}`;
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.setTimeout(() => window.print(), 100);
  };

  const roomInventories = currentRoom.inventories || [];
  const roomOccupancyHistory = currentRoom.occupancyHistory || [];
  const inventoryStatusLabels: Record<RoomInventoryStatus, string> = { HEALTHY: '🟢 Sağlam & Çalışır', MAINTENANCE_REQUIRED: '🟡 Arızalı / Bakım Bekliyor', DAMAGED: '🔴 Kırık / Hasarlı', LOST: '❓ Kayıp / Zayi', IN_SERVICE: '🛠️ Tamirde / Serviste', REPLACEMENT_REQUIRED: '🔄 Değişim Bekliyor', RETIRED: '⚪ İade Edildi / Düşüm Yapıldı' };

  const roomMaintenances = currentRoom.maintenances || [];
  const openMaintenances = roomMaintenances.filter((m) => m.status !== 'RESOLVED' && m.status !== 'CLOSED' && !m.resolvedAt);
  const resolvedMaintenances = roomMaintenances.filter((m) => m.status === 'RESOLVED' || m.status === 'CLOSED' || !!m.resolvedAt);

  // Cleaning logs for room
  const roomCleaningLogs = currentRoom.cleaningLogs || [];
  const roomResidents = (currentRoom.beds || [])
    .filter((b) => b.isOccupied && b.currentEmployee)
    .map((b) => ({
      id: b.currentEmployee!.id,
      name: `${b.currentEmployee!.firstName} ${b.currentEmployee!.lastName} (${b.bedLabel})`,
      cleanName: `${b.currentEmployee!.firstName} ${b.currentEmployee!.lastName}`,
    }));
  const formatDuration = (startStr?: string | null, endStr?: string | null) => {
    if (!startStr || !endStr) return null;
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '0 dk';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} dk`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} sa ${mins > 0 ? `${mins} dk` : ''}`;
  };
  const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
  const printTitle: Record<RoomPrintType, string> = { maintenance: 'ODA ARIZA VE BAKIM DÖKÜMÜ', history: 'ODA KONAKLAMA GEÇMİŞİ DÖKÜMÜ', inventory: 'ODA ZİMMET VE DEMİRBAŞ DÖKÜMÜ', all: 'GENEL ODA DETAY DÖKÜMÜ' };

  return (
    <div className="room-detail-page space-y-6 w-full">
      <div className="official-print-document hidden print:block text-black font-sans text-[9px] leading-tight">
        <header className="border-b-2 border-slate-900 pb-3 mb-3 flex items-start justify-between">
          <div><p className="font-black text-[13px] tracking-wide">DOSINIA RESORT LOJMAN YÖNETİMİ</p><h1 className="font-black text-[15px] mt-1">{printTitle[printType]}</h1><p className="mt-1 text-slate-600">Kurumsal oda kayıt ve takip belgesi</p></div>
          <div className="text-right"><p className="font-black text-[18px]">ODA {currentRoom.roomNumber}</p><p>{currentRoom.block?.name} BLOĞU</p><p className="mt-1">Döküm: {new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
        </header>
        <section className="mb-3"><h2 className="print-section-title">1. ODA GENEL BİLGİLERİ</h2><table className="print-table"><tbody><tr><th>Oda / Blok</th><td>{currentRoom.roomNumber} / {currentRoom.block?.name}</td><th>Kapasite</th><td>{currentRoom.capacity} Kişi</td></tr><tr><th>Doluluk</th><td>{occupiedCount} Dolu / {vacantCount} Boş</td><th>Oda Durumu</th><td>{currentRoom.status}</td></tr></tbody></table></section>
        {(printType === 'inventory' || printType === 'all') && <section className="mb-3"><h2 className="print-section-title">2. ODA ZİMMET VE DEMİRBAŞLARI</h2><table className="print-table"><thead><tr><th>Demirbaş</th><th>Konum</th><th>Adet</th><th>Tesis Tarihi</th><th>Durum</th></tr></thead><tbody>{roomInventories.map((item) => <tr key={item.id}><td>{item.itemName}</td><td>{item.location}</td><td>{item.quantity}</td><td>{formatDateTime(item.installedAt)}</td><td>{inventoryStatusLabels[item.status]}</td></tr>)}</tbody></table></section>}
        {(printType === 'maintenance' || printType === 'all') && (
          <section className="mb-3 space-y-2">
            <h2 className="print-section-title">{printType === 'all' ? '3.' : '2.'} ARIZA VE BAKIM KAYITLARI</h2>
            <div>
              <p className="font-bold text-[9.5px] text-rose-900 border-b border-rose-300 pb-0.5 mb-1 uppercase tracking-wide">
                {printType === 'all' ? '3.1.' : '2.1.'} DEVAM EDEN (ÇÖZÜLMEMİŞ) ARIZALAR ({openMaintenances.length})
              </p>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Konum</th>
                    <th>Açıklama</th>
                    <th>Öncelik</th>
                    <th>Kayıt Tarihi</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {openMaintenances.length ? openMaintenances.map((item) => (
                    <tr key={item.id}>
                      <td>{item.category || item.title}</td>
                      <td>{item.location || 'ODA GENELİ'}</td>
                      <td>{item.description}</td>
                      <td>{item.priority}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td className="font-bold text-rose-700">Devam Ediyor / Çözülmedi</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="text-slate-500 italic">Devam eden arıza kaydı bulunmamaktadır.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <p className="font-bold text-[9.5px] text-emerald-900 border-b border-emerald-300 pb-0.5 mb-1 uppercase tracking-wide">
                {printType === 'all' ? '3.2.' : '2.2.'} ÇÖZÜLMÜŞ ARIZA VE BAKIM GEÇMİŞİ ({resolvedMaintenances.length})
              </p>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Konum</th>
                    <th>Açıklama</th>
                    <th>Öncelik</th>
                    <th>Kayıt Tarihi</th>
                    <th>Çözülme Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedMaintenances.length ? resolvedMaintenances.map((item) => (
                    <tr key={item.id}>
                      <td>{item.category || item.title}</td>
                      <td>{item.location || 'ODA GENELİ'}</td>
                      <td>{item.description}</td>
                      <td>{item.priority}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td>{formatDateTime(item.resolvedAt)} {item.resolutionNote ? `(${item.resolutionNote})` : ''}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="text-slate-500 italic">Çözülmüş arıza kaydı bulunmamaktadır.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {(printType === 'history' || printType === 'all') && <section className="mb-3"><h2 className="print-section-title">{printType === 'all' ? '4.' : '2.'} KONAKLAMA GEÇMİŞİ</h2><table className="print-table"><thead><tr><th>Personel</th><th>Departman / Unvan</th><th>Yatak</th><th>Giriş Tarihi</th><th>Çıkış Tarihi</th></tr></thead><tbody>{roomOccupancyHistory.length ? roomOccupancyHistory.map((item) => <tr key={item.id}><td>{item.employee.firstName} {item.employee.lastName}</td><td>{item.employee.department}{item.employee.title ? ` / ${item.employee.title}` : ''}</td><td>{item.bedLabel}</td><td>{formatDateTime(item.checkInDate)}</td><td>{formatDateTime(item.checkOutDate)}</td></tr>) : <tr><td colSpan={5}>Konaklama kaydı bulunmamaktadır.</td></tr>}</tbody></table></section>}
        <footer className="mt-6 pt-3 border-t border-slate-500"><p className="text-[8px] italic text-slate-600">İşbu belge, belirtilen odaya ait lojman kayıtlarının kurumsal dökümüdür.</p></footer>
      </div>
      {/* Top Action Bar */}
      <div className="flex items-center justify-end no-print">
        <button
          onClick={() => setShowPrintModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e3a8a] text-white font-bold text-xs shadow-md shadow-blue-950/20 hover:bg-blue-900 transition-all cursor-pointer active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Döküm Yazdır</span>
        </button>
      </div>
      {roomError && <div role="alert" className="no-print p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between gap-3"><span>{roomError}</span><button aria-label="Hata mesajını kapat" onClick={() => setRoomError(null)}><X className="w-4 h-4"/></button></div>}

      {/* Main Room Header Banner (Clean White Card) */}
      <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Room Badge & Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-950/20 shrink-0">
              {currentRoom.roomNumber}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Oda {currentRoom.roomNumber}
                </h1>
                <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  {currentRoom.block.name}
                </span>

                {/* Status Selector */}
                <select
                  value={currentRoom.status}
                  onChange={(e) => handleStatusChange(e.target.value as RoomStatusType)}
                  className={`text-xs font-extrabold px-3 py-1 rounded-xl cursor-pointer focus:outline-none border ${
                    currentRoom.status === 'READY'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : currentRoom.status === 'NEEDS_CLEANING'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <option value="READY">🟢 Hazır (Müsait)</option>
                  <option value="NEEDS_CLEANING">🟡 Temizlik Bekliyor</option>
                  <option value="OUT_OF_ORDER">🔴 Arızalı / Bakımda</option>
                </select>
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-1">
                {currentRoom.block.name} • {currentRoom.floor === 0 ? 'Zemin Kat' : `${currentRoom.floor}. Kat`} • {currentRoom.capacity} Kişilik Lojman Odası
              </p>
            </div>
          </div>

          {/* Right: Quick Stat Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Sakin Sayısı</span>
              <span className="text-base font-black text-slate-900">
                {occupiedCount} <span className="text-xs font-semibold text-slate-500">/ {currentRoom.capacity} Sakin</span>
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-emerald-600 block">Boş Yatak</span>
              <span className="text-base font-black text-emerald-700">{vacantCount} Boş</span>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-2xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-[#1e3a8a] block">Doluluk Oranı</span>
              <span className="text-base font-black text-[#1e3a8a]">%{occupancyRate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white border border-slate-300 rounded-3xl p-1.5 shadow-sm no-print">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BedDouble className="w-4 h-4" />
            <span>Genel</span>
          </button>

          <button
            onClick={() => handleTabChange('inventory')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Oda Zimmetleri ({roomInventories.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('maintenance')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Arıza & Bakım Kayıtları ({roomMaintenances.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('cleaning')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cleaning'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Temizlik Kayıtları ({roomCleaningLogs.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Konaklama Geçmişi</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT AREA */}

      {/* TAB 1: OVERVIEW & RESIDENTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Room Physical Specifications & Details */}
          <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1e3a8a]" />
              <span>Oda Fiziki Özellikleri</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lojman Bloğu</span>
                <span className="text-sm font-extrabold text-slate-900">{currentRoom.block.name}</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Bulunduğu Kat</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {currentRoom.floor === 0 ? 'Zemin Kat (0)' : `${currentRoom.floor}. Kat`}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Kapasite</span>
                <span className="text-sm font-extrabold text-slate-900">{currentRoom.capacity} Kişilik (Yataklı)</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Cinsiyet Politikası</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {currentRoom.block.genderPolicy === 'Male'
                    ? 'Erkek Personel Bloğu'
                    : currentRoom.block.genderPolicy === 'Female'
                    ? 'Kadın Personel Bloğu'
                    : 'Karma Blok'}
                </span>
              </div>
            </div>
          </div>

          {/* Resident Profiles & Bed Matrix */}
          <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#1e3a8a]" />
                <span>Konaklayanlar</span>
              </h2>

              {vacantCount > 0 && (
                <span className="text-xs font-bold text-slate-500">
                  🟢 {vacantCount} Boş Yatak Atamaya Hazır
                </span>
              )}
            </div>

            {/* Beds Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentRoom.beds.map((bed) => {
                const emp = bed.currentEmployee;

                return (
                  <div
                    key={bed.id}
                    onClick={() => {
                      if (bed.isOccupied && emp) {
                        handleSelectEmployee(emp.id);
                      }
                    }}
                    title={bed.isOccupied && emp ? `${emp.firstName} ${emp.lastName} personel detay sayfasını açmak için tıklayın` : ''}
                    className={`p-4 rounded-3xl border transition-all ${
                      bed.isOccupied && emp
                        ? 'bg-slate-50/80 hover:bg-blue-50/80 border-slate-300 hover:border-[#1e3a8a] cursor-pointer group/resident shadow-2xs'
                        : 'bg-emerald-50/40 border-emerald-200 border-dashed'
                    }`}
                  >
                    {bed.isOccupied && emp ? (
                      /* Occupied Resident Card */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-[#1e3a8a] text-white">
                              {bed.bedLabel}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              İkamet Ediyor
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          {emp.photoUrl ? (
                            <img
                              src={emp.photoUrl}
                              alt={emp.firstName}
                              className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-[#1e3a8a] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                              {emp.firstName.charAt(0)}
                              {emp.lastName.charAt(0)}
                            </div>
                          )}

                          <div className="space-y-1 min-w-0 flex-1">
                            <h3 className="text-sm font-extrabold text-slate-900 group-hover/resident:text-[#1e3a8a] transition-colors truncate">
                              {emp.firstName} {emp.lastName}
                            </h3>

                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                {emp.department}
                              </span>
                              {emp.title && <span>• {emp.title}</span>}
                            </div>

                            {emp.phone && (
                              <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span>{emp.phone}</span>
                              </p>
                            )}

                            {/* Habit Badges */}
                            <div className="pt-2 flex items-center gap-1.5">
                              {emp.isSmoker ? (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-extrabold flex items-center gap-1">
                                  <Cigarette className="w-3 h-3" />
                                  <span>Sigara Kullanıyor</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                                  <CigaretteOff className="w-3 h-3" />
                                  <span>Sigarasız</span>
                                </span>
                              )}

                              {emp.hasSnoring && (
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-extrabold flex items-center gap-1">
                                  <Moon className="w-3 h-3" />
                                  <span>Horlama Var</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Vacant Bed Slot */
                      <div className="flex items-center justify-between py-2 text-emerald-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                            <BedDouble className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-emerald-900">{bed.bedLabel}</span>
                            <p className="text-[11px] font-semibold text-emerald-700">Boş Yatak • Atamaya Hazır</p>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Müsait
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY & FIXTURES */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-slate-300 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div><h2 className="text-base font-black text-slate-900 flex items-center gap-2"><span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Package className="w-4.5 h-4.5 text-[#1e3a8a]" /></span><span>Oda Zimmetli Demirbaşlar</span></h2><p className="text-xs text-slate-500 font-semibold mt-1">Toplam {roomInventories.length} demirbaş kaydı</p></div>
          </div>
          {roomInventories.length === 0 ? (
            <div className="m-5 p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
              <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-xs text-slate-700">Bu odaya ait tanımlı zimmetli demirbaş bulunmamaktadır.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Odadaki sakinlere zimmetlenen eşyalar ve lojman demirbaşları burada gösterilir.</p>
            </div>
          ) : (
            <div className="room-table-shell m-5 mt-4">
              <table className="room-data-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr>
                    <th>Sabit Oda Demirbaşı</th>
                    <th className="w-36">Adet / Miktar</th>
                    <th className="w-40">Tesis Tarihi</th>
                    <th className="w-56">Demirbaş Durumu</th>
                  </tr>
                </thead>
                <tbody>
                  {roomInventories.map((inv) => {
                    const currentStatus = inv.status;

                    return (
                      <tr key={inv.id}>
                        <td className="font-extrabold text-slate-900"><div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                          <span>{inv.itemName}</span>
                        </div></td>
                        <td className="font-bold text-slate-900">
                          <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md text-[11px] font-extrabold">
                            {inv.quantity} Adet
                          </span>
                        </td>
                        <td className="font-bold text-slate-600 whitespace-nowrap">{formatDateTime(inv.installedAt)}</td>
                        <td>
                          <select
                            value={currentStatus}
                            disabled={updatingInventoryId === inv.id}
                            onChange={(e) => handleInventoryStatusChange(inv.id, e.target.value as RoomInventoryStatus)}
                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md cursor-pointer focus:outline-none border transition-colors ${
                              currentStatus === 'HEALTHY'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : currentStatus === 'MAINTENANCE_REQUIRED'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : currentStatus === 'DAMAGED'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : currentStatus === 'LOST'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : currentStatus === 'IN_SERVICE'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : currentStatus === 'REPLACEMENT_REQUIRED'
                                ? 'bg-orange-50 text-orange-800 border-orange-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {Object.entries(inventoryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MAINTENANCE LOGS */}
      {activeTab === 'maintenance' && (
        <div className="bg-white border border-slate-300 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Wrench className="w-4.5 h-4.5 text-[#1e3a8a]" /></span>
                <span>Oda Arıza & Bakım Kayıtları</span>
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">Toplam {roomMaintenances.length} kayıt · Arızaları işlem butonlarından düzenleyebilir, çözebilir veya geri alabilirsiniz.</p>
            </div>
            <button onClick={() => { setMaintenanceError(null); setShowMaintenanceModal(true); }} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1e3a8a] text-white font-bold text-xs hover:bg-blue-900 shadow-sm transition-all">
              <Plus className="w-4 h-4" /><span>Yeni Arıza Kaydı</span>
            </button>
          </div>

          {maintenanceError && <div role="alert" className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between gap-3"><span>{maintenanceError}</span><button aria-label="Hata mesajını kapat" onClick={() => setMaintenanceError(null)}><X className="w-4 h-4"/></button></div>}

          {roomMaintenances.length === 0 ? (
            <div className="m-5 p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <CheckCircle2 className="w-11 h-11 text-emerald-600 mx-auto mb-3" />
              <p className="font-extrabold text-sm text-slate-800">Henüz arıza kaydı yok</p>
              <p className="text-xs text-slate-500 mt-1">Yeni bir teknik sorun oluştuğunda “Yeni Arıza Kaydı” ile bildirebilirsiniz.</p>
            </div>
          ) : (
            <div className="room-table-shell m-5 mt-4">
              <table className="room-data-table w-full min-w-[960px] text-left text-xs border-collapse">
                <thead><tr>
                  <th className="w-40">Kategori / Arıza</th><th className="w-28">Konum</th><th>Açıklama</th><th className="w-24 text-center">Öncelik</th><th className="w-36">Kayıt Tarihi</th><th className="w-40">Çözülme Tarihi</th><th className="w-44 text-center">İşlemler</th>
                </tr></thead>
                <tbody>
                  {roomMaintenances.map((maintenance) => {
                    const priorityLabels: Record<string, string> = { LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil' };
                    const priorityClasses: Record<string, string> = { LOW: 'bg-slate-100 text-slate-700 border-slate-200', MEDIUM: 'bg-blue-50 text-blue-800 border-blue-200', HIGH: 'bg-amber-50 text-amber-800 border-amber-200', URGENT: 'bg-rose-50 text-rose-800 border-rose-200' };
                    return <tr key={maintenance.id}>
                      <td className="font-extrabold text-slate-900"><div className="flex items-start gap-2"><Wrench className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0 mt-0.5"/><div><p>{maintenance.category || maintenance.title}</p>{maintenance.category && maintenance.title !== maintenance.category && <p className="text-[11px] text-slate-500 mt-0.5">{maintenance.title}</p>}</div></div></td>
                      <td>{maintenance.location || 'ODA GENELİ'}</td>
                      <td className="leading-relaxed max-w-sm">{maintenance.description}</td>
                      <td className="text-center"><span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${priorityClasses[maintenance.priority] || priorityClasses.MEDIUM}`}>{priorityLabels[maintenance.priority] || maintenance.priority}</span></td>
                      <td className="font-bold text-slate-600 whitespace-nowrap">{formatDateTime(maintenance.createdAt)}</td>
                      <td className="font-bold text-slate-600 whitespace-nowrap">{maintenance.resolvedAt ? <><p>{formatDateTime(maintenance.resolvedAt)}</p>{maintenance.resolutionNote && <p className="mt-1 text-[10px] leading-relaxed text-emerald-700 whitespace-normal">{maintenance.resolutionNote}</p>}</> : <span className="text-slate-500 italic font-semibold">Henüz çözülmedi</span>}</td>
                      <td><div className="flex items-center justify-center gap-1 min-h-[28px]">
                        <button type="button" title="Düzenle" disabled={updatingMaintenanceId === maintenance.id} onClick={() => openMaintenanceEdit(maintenance)} className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"><Edit className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110"/><span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">Düzenle</span></button>
                        {maintenance.status === 'RESOLVED' || maintenance.status === 'CLOSED' ? <button type="button" title="Geri Al" disabled={updatingMaintenanceId === maintenance.id} onClick={() => handleUndoResolveMaintenance(maintenance)} className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200/80 hover:border-amber-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"><History className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:-rotate-45"/><span className="max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">Geri Al</span></button> : <button type="button" title="Çözüldü" disabled={updatingMaintenanceId === maintenance.id} onClick={() => handleResolveMaintenance(maintenance)} className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 hover:border-emerald-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110"/><span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">Çözüldü</span></button>}
                        <button type="button" aria-label={`${maintenance.title} kaydını sil`} title="Sil" disabled={updatingMaintenanceId === maintenance.id} onClick={() => setMaintenanceToDelete(maintenance)} className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200/80 hover:border-red-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"><Trash2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110"/><span className="max-w-0 opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">Sil</span></button>
                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: CLEANING LOGS (TEMİZLİK KAYITLARI) */}
      {activeTab === 'cleaning' && (
        <div className="bg-white border border-slate-300 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-amber-700" />
                </span>
                <span>Oda Temizlik & Hijyen Takip Geçmişi</span>
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Toplam {roomCleaningLogs.length} kayıt · Odanın 3 temel durumu (Temizlik Bekliyor, Temizleniyor, Temizlendi & Hazır) ve durum değişiklikleri aynı veri üzerinde takip edilir.
              </p>
            </div>
            <button
              onClick={() => {
                setCleaningError(null);
                setCleaningToEdit(null);
                setCleaningForm({
                  requestedBy: 'Lojman Yönetimi',
                  notes: '',
                });
                setShowCleaningModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Temizlik Talebi</span>
            </button>
          </div>

          {cleaningError && (
            <div role="alert" className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between gap-3">
              <span>{cleaningError}</span>
              <button aria-label="Hata mesajını kapat" onClick={() => setCleaningError(null)}><X className="w-4 h-4"/></button>
            </div>
          )}

          {roomCleaningLogs.length === 0 ? (
            <div className="m-5 p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Sparkles className="w-11 h-11 text-amber-600 mx-auto mb-3" />
              <p className="font-extrabold text-sm text-slate-800">Henüz temizlik kaydı oluşturulmadı</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Oda durumu "Temizlik Bekliyor" yapıldığında sistem otomatik kayıt açar veya "Yeni Temizlik Talebi" butonu ile talep ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="room-table-shell m-5 mt-4">
              <table className="room-data-table w-full min-w-[960px] text-left text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="w-36">Durum</th>
                    <th className="w-44">Talep Eden / Bildiren</th>
                    <th className="w-40">Talep Açılış Tarihi</th>
                    <th className="w-44">Temizlenme Tarihi & Süre</th>
                    <th className="w-44">Temizleyen Personel</th>
                    <th className="min-w-[180px]">Temizlik Notları</th>
                    <th className="w-48 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {roomCleaningLogs.map((log) => {
                    const isCleaned = log.status === 'CLEANED';
                    const isInProgress = log.status === 'IN_PROGRESS';
                    const isNeedsCleaning = log.status === 'NEEDS_CLEANING';
                    const durationText = formatDuration(log.requestedAt, log.cleanedAt);

                    const statusClasses: Record<string, string> = {
                      NEEDS_CLEANING: 'bg-amber-50 text-amber-800 border-amber-200',
                      IN_PROGRESS: 'bg-blue-50 text-blue-800 border-blue-200',
                      CLEANED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      OUT_OF_ORDER: 'bg-rose-50 text-rose-800 border-rose-200',
                    };

                    const statusLabels: Record<string, string> = {
                      NEEDS_CLEANING: '🟡 Temizlik Bekliyor',
                      IN_PROGRESS: '🔵 Temizlik Yapılıyor',
                      CLEANED: '🟢 Temizlendi & Hazır',
                      OUT_OF_ORDER: '🔴 Kullanım Dışı / Bakımda',
                    };

                    return (
                      <tr key={log.id}>
                        <td className="font-extrabold text-slate-900">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-md border text-[10px] font-extrabold ${statusClasses[log.status] || statusClasses.NEEDS_CLEANING}`}>
                            {statusLabels[log.status] || log.status}
                          </span>
                        </td>
                        <td className="font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{log.requestedBy || 'Lojman Yönetimi'}</span>
                          </div>
                        </td>
                        <td className="font-bold text-slate-600 whitespace-nowrap">
                          {formatDateTime(log.requestedAt)}
                        </td>
                        <td className="font-bold text-slate-600 whitespace-nowrap">
                          {isCleaned && log.cleanedAt ? (
                            <div className="space-y-0.5">
                              <p className="text-emerald-800 font-extrabold">{formatDateTime(log.cleanedAt)}</p>
                              {durationText && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-emerald-100/70 text-emerald-900 rounded text-[10px] font-extrabold">
                                  <Clock className="w-3 h-3 text-emerald-700" />
                                  <span>{durationText} tamamlandı</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Süreç Devam Ediyor</span>
                            </span>
                          )}
                        </td>
                        <td className="font-bold text-slate-700 whitespace-nowrap">
                          {log.cleanedBy ? (
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                              <span className="text-[#1e3a8a] font-extrabold">{log.cleanedBy}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic font-semibold text-[11px]">-</span>
                          )}
                        </td>
                        <td>
                          <div
                            onClick={() => log.notes && setSelectedCleaningNote({ title: `Oda ${currentRoom.roomNumber} — Temizlik Notu`, content: log.notes })}
                            className={`max-w-[180px] truncate text-[11px] p-1.5 rounded-xl transition-all whitespace-nowrap overflow-hidden ${
                              log.notes
                                ? 'cursor-pointer bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-900 border border-slate-200/80 hover:border-blue-300 font-extrabold shadow-2xs'
                                : 'text-slate-400 italic font-normal'
                            }`}
                            title={log.notes ? "Notun tamamını pop-up olarak okumak için tıklayın" : undefined}
                          >
                            {log.notes ? log.notes : 'Not eklenmemiş'}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1 min-h-[28px]">
                            {isNeedsCleaning && (
                              <button
                                type="button"
                                title="Temizliğe Başla"
                                disabled={updatingCleaningId === log.id}
                                onClick={() => handleQuickStartCleaning(log)}
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"
                              >
                                <Clock className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Başlat
                                </span>
                              </button>
                            )}

                            {!isCleaned && (
                              <button
                                type="button"
                                title="Temizlendi Olarak İşaretle"
                                disabled={updatingCleaningId === log.id}
                                onClick={() => handleQuickMarkCleaned(log)}
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 hover:border-emerald-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Temizlendi
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              title="Düzenle"
                              disabled={updatingCleaningId === log.id}
                              onClick={() => {
                                setCleaningToEdit(log);
                                setCleaningForm({
                                  requestedBy: log.requestedBy || 'Lojman Yönetimi',
                                  notes: log.notes || '',
                                });
                                setCleaningError(null);
                                setShowCleaningModal(true);
                              }}
                              className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white border border-slate-300 hover:border-slate-800 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"
                            >
                              <Edit className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                              <span className="max-w-0 opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                Düzenle
                              </span>
                            </button>

                            <button
                              type="button"
                              title="Sil"
                              disabled={updatingCleaningId === log.id}
                              onClick={() => setCleaningToDelete(log)}
                              className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200/80 hover:border-red-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                              <span className="max-w-0 opacity-0 group-hover:max-w-[50px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                Sil
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACCOMMODATION HISTORY (KONAKLAMA GEÇMİŞİ) */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-300 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><History className="w-4.5 h-4.5 text-[#1e3a8a]" /></span>
                <span>Oda Konaklama & Sakin Geçmişi</span>
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Bu odada halen ikamet eden ve geçmişte ikamet etmiş tüm personellerin kayıtları.
              </p>
            </div>

            {/* Interactive Search Bar - Strictly search by Name */}
            <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-1.5 bg-slate-50 w-full sm:w-72 shadow-2xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Sakin adı ve soyadı ile ara..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none w-full placeholder:text-slate-400"
              />
              {historySearchQuery && (
                <button onClick={() => setHistorySearchQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {roomOccupancyHistory.length === 0 ? (
            <div className="m-5 p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500">
              <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-xs text-slate-700">Bu odaya ait konaklama kaydı bulunmamaktadır.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Oda şu anda tamamen boş durumdadır.</p>
            </div>
          ) : (
            <div className="room-table-shell m-5 mt-4">
              <table className="room-data-table w-full text-left text-xs border-collapse">
                <thead>
                  <tr>
                    <th>Personel Bilgisi & Unvan / Firma</th>
                    <th className="w-32 text-center">Yatak Konumu</th>
                    <th className="w-40">Odaya Giriş Tarihi</th>
                    <th className="w-40">Odadan Çıkış Tarihi</th>
                  </tr>
                </thead>
                <tbody>
                  {roomOccupancyHistory
                    .filter((occupancy) => {
                      const emp = occupancy.employee;
                      if (!historySearchQuery.trim()) return true;
                      const q = historySearchQuery.toLowerCase().trim();
                      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                      return fullName.includes(q);
                    })
                    .map((occupancy) => {
                      const emp = occupancy.employee;

                      const formatDateSafely = (dateVal?: string | null): string => {
                        if (!dateVal) return '-';
                        try {
                          const d = new Date(dateVal);
                          if (isNaN(d.getTime())) return '-';
                          return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
                        } catch (e) {
                          return '-';
                        }
                      };

                      return (
                        <tr
                          key={occupancy.id}
                          onClick={() => !emp.id.startsWith('deleted-') && handleSelectEmployee(emp.id)}
                          title={emp.id.startsWith('deleted-') ? 'Personel kaydı silinmiş; konaklama geçmişi korunmuştur.' : `${emp.firstName} ${emp.lastName} personel detay sayfasını açmak için tıklayın`}
                          className={`${emp.id.startsWith('deleted-') ? '' : 'cursor-pointer'} group/row`}
                        >
                          {/* Personel + Departman/Unvan/Firma */}
                          <td className="font-extrabold text-slate-900">
                            <div className="flex items-start gap-2">
                              <UserIcon className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0 mt-0.5" />
                              <div>
                                <div className="font-extrabold text-slate-900 group-hover/row:text-[#1e3a8a] transition-colors">
                                  {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span>{emp.department}</span>
                                  {emp.title && <span>• {emp.title}</span>}
                                  {emp.company && (
                                    <span className="text-slate-700 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px]">
                                      {emp.company}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Yatak */}
                          <td className="text-center">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                              {occupancy.bedLabel}
                            </span>
                          </td>

                          {/* Giriş Tarihi */}
                          <td className="font-bold text-slate-600 whitespace-nowrap">
                            {formatDateSafely(occupancy.checkInDate)}
                          </td>

                          {/* Çıkış Tarihi */}
                          <td className="font-bold text-slate-600 whitespace-nowrap">
                            {occupancy.checkOutDate ? (
                              formatDateSafely(occupancy.checkOutDate)
                            ) : (
                              <span className="text-slate-500 font-semibold italic text-[11px]">Odada İkamet Ediyor</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {showPrintModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="room-print-title" className="bg-white border border-slate-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md"><Printer className="w-5 h-5"/></div><div><h2 id="room-print-title" className="text-lg font-extrabold text-slate-900">Oda Dökümü Seçin</h2><p className="text-xs font-semibold text-slate-500">PDF veya yazıcı çıktısında yer alacak kayıtları belirleyin.</p></div></div><button onClick={() => setShowPrintModal(false)} className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><X className="w-5 h-5"/></button></div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">{([
              ['maintenance', 'Arıza Kayıtları', 'Arıza, öncelik ve çözülme tarihleri', Wrench],
              ['history', 'Konaklama Geçmişi', 'Sakin, yatak, giriş ve çıkış kayıtları', History],
              ['inventory', 'Oda Zimmetleri', 'Demirbaş, konum ve durum bilgileri', Package],
              ['all', 'Tüm Oda Dökümü', 'Tüm kayıtları tek kurumsal belgede birleştirir', FileText],
            ] as const).map(([value, title, detail, Icon]) => <button key={value} onClick={() => handlePrint(value)} className="group text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#1e3a8a] hover:bg-blue-50/50 transition-all"><div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center mb-3 group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors"><Icon className="w-4.5 h-4.5"/></div><p className="text-xs font-extrabold text-slate-900">{title}</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{detail}</p></button>)}</div>
          </div>
        </div>
      )}

      {maintenanceToEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-maintenance-title" className="bg-white border border-slate-300 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl my-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-20">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md"><Wrench className="w-5 h-5"/></div><div><h2 id="edit-maintenance-title" className="text-lg font-extrabold text-slate-900">Arıza / Bakım Kaydını Düzenle</h2><p className="text-xs font-semibold text-slate-500">Oda {currentRoom.roomNumber} — {currentRoom.block?.name} Bloğu</p></div></div>
              <button onClick={() => setMaintenanceToEdit(null)} className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-5">
              {maintenanceError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">{maintenanceError}</div>}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-200/80 pb-2"><h3 className="text-xs font-extrabold text-[#1e3a8a] uppercase tracking-wider flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]"></span><span>Arıza Bilgileri</span></h3></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-800 mb-1">Arıza Kategorisi <span className="text-red-500 font-black">*</span></label><select value={editMaintenanceForm.category} onChange={(e) => setEditMaintenanceForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none cursor-pointer">{maintenanceCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-800 mb-1">Öncelik Seviyesi</label><select value={editMaintenanceForm.priority} onChange={(e) => setEditMaintenanceForm((prev) => ({ ...prev, priority: e.target.value }))} className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-1 focus:ring-[#1e3a8a] ${editMaintenanceForm.priority === 'URGENT' ? 'bg-rose-50 border-rose-300 text-rose-800' : editMaintenanceForm.priority === 'HIGH' ? 'bg-orange-50 border-orange-300 text-orange-800' : editMaintenanceForm.priority === 'MEDIUM' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'}`}><option value="LOW">🟢 Düşük — Acil Değil</option><option value="MEDIUM">🟡 Orta — Normal</option><option value="HIGH">🟠 Yüksek — Öncelikli</option><option value="URGENT">🔴 Acil — Kritik</option></select></div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2"><h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span><span>Arıza Detayları</span></h3></div>
                <div><label className="block text-xs font-bold text-slate-800 mb-1">Arıza Açıklaması <span className="text-red-500 font-black">*</span></label><textarea rows={4} value={editMaintenanceForm.description} onChange={(e) => setEditMaintenanceForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none resize-none"/></div>
                <div><label className="block text-xs font-bold text-slate-800 mb-1">Odadaki Konum <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span></label><input value={editMaintenanceForm.location} onChange={(e) => setEditMaintenanceForm((prev) => ({ ...prev, location: e.target.value }))} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none" placeholder="Ör: Banyo girişi, Pencere kenarı, Yatak-A yanı..."/></div>
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-slate-200 flex justify-end gap-3"><button onClick={() => setMaintenanceToEdit(null)} className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer">İptal</button><button onClick={handleEditMaintenance} disabled={updatingMaintenanceId === maintenanceToEdit.id || !editMaintenanceForm.category || !editMaintenanceForm.description.trim()} className="py-2.5 px-6 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer">{updatingMaintenanceId === maintenanceToEdit.id ? <><Loader2 className="w-4 h-4 animate-spin"/><span>Kaydediliyor...</span></> : <><Check className="w-4 h-4"/><span>Değişiklikleri Kaydet</span></>}</button></div>
          </div>
        </div>
      )}

      {maintenanceToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-maintenance-title" className="bg-white rounded-3xl border border-slate-300 shadow-2xl w-full max-w-md p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto"><Trash2 className="w-6 h-6"/></div>
            <div><h3 id="delete-maintenance-title" className="font-extrabold text-slate-900">Arıza Kaydını Sil</h3><p className="text-xs font-semibold text-slate-600 mt-1"><strong>{maintenanceToDelete.title}</strong> kaydı kalıcı olarak silinecek. Bu işlem yalnızca yönetici yetkisiyle yapılabilir.</p></div>
            <div className="flex justify-center gap-2 pt-2"><button onClick={() => setMaintenanceToDelete(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">İptal</button><button onClick={handleDeleteMaintenance} disabled={updatingMaintenanceId === maintenanceToDelete.id} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-60">{updatingMaintenanceId === maintenanceToDelete.id ? 'Siliniyor…' : 'Evet, Kaydı Sil'}</button></div>
          </div>
        </div>
      )}
      {/* MAINTENANCE REPORT MODAL */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl my-auto">

            {/* Modal Header - Matching AddEmployeeModal */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Arıza / Bakım Bildirimi</h2>
                  <p className="text-xs font-semibold text-slate-500">Oda {currentRoom.roomNumber} — {currentRoom.block?.name} Bloğu</p>
                </div>
              </div>
              <button
                onClick={() => { setShowMaintenanceModal(false); setMaintenanceForm({ category: '', description: '', priority: 'MEDIUM', location: '' }); }}
                className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-6 space-y-5">

              {maintenanceError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">{maintenanceError}</div>}

              {/* Section 1: Arıza Kategorisi & Öncelik */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                  <h3 className="text-xs font-extrabold text-[#1e3a8a] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]"></span>
                    <span>Arıza Bilgileri</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Arıza Kategorisi (Dropdown) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Arıza Kategorisi <span className="text-red-500 font-black">*</span>
                    </label>
                    <select
                      value={maintenanceForm.category}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none cursor-pointer"
                    >
                      <option value="">Kategori Seçin</option>
                      {maintenanceCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Öncelik Seviyesi (Dropdown) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Öncelik Seviyesi
                    </label>
                    <select
                      value={maintenanceForm.priority}
                      onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, priority: e.target.value }))}
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-bold outline-none cursor-pointer focus:ring-1 focus:ring-[#1e3a8a] ${
                        maintenanceForm.priority === 'URGENT'
                          ? 'bg-rose-50 border-rose-300 text-rose-800 focus:border-rose-400'
                          : maintenanceForm.priority === 'HIGH'
                          ? 'bg-orange-50 border-orange-300 text-orange-800 focus:border-orange-400'
                          : maintenanceForm.priority === 'MEDIUM'
                          ? 'bg-amber-50 border-amber-300 text-amber-800 focus:border-amber-400'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:border-emerald-400'
                      }`}
                    >
                      <option value="LOW">🟢 Düşük — Acil Değil</option>
                      <option value="MEDIUM">🟡 Orta — Normal</option>
                      <option value="HIGH">🟠 Yüksek — Öncelikli</option>
                      <option value="URGENT">🔴 Acil — Kritik</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Detaylı Açıklama & Konum */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                    <span>Arıza Detayları</span>
                  </h3>
                </div>

                {/* Detaylı Açıklama */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Arıza Açıklaması <span className="text-red-500 font-black">*</span>
                  </label>
                  <textarea
                    placeholder="Arızanın detaylı açıklamasını yazın. Ne zaman başladı, sürekli mi aralıklı mı, hangi koşulda oluşuyor vb."
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-semibold focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none resize-none"
                  />
                </div>

                {/* Konum */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Odadaki Konum <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ör: Banyo girişi, Pencere kenarı, Yatak-A yanı..."
                    value={maintenanceForm.location}
                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-semibold focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer - Matching AddEmployeeModal */}
            <div className="p-6 pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowMaintenanceModal(false); setMaintenanceForm({ category: '', description: '', priority: 'MEDIUM', location: '' }); }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleMaintenanceSubmit}
                disabled={maintenanceSubmitting || !maintenanceForm.description || !maintenanceForm.category}
                className="py-2.5 px-6 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {maintenanceSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Gönderiliyor...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Arızayı Bildir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEANING LOG CREATE / EDIT MODAL */}
      {showCleaningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {cleaningToEdit ? 'Temizlik Kaydını Düzenle' : 'Yeni Temizlik Talebi'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Oda {currentRoom.roomNumber} — {currentRoom.block?.name} Bloğu
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowCleaningModal(false); setCleaningToEdit(null); }}
                className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-6 space-y-5">
              {cleaningError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                  {cleaningError}
                </div>
              )}

              {/* Form Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                    <span>Talep Bilgileri</span>
                  </h3>
                </div>

                {/* Bildiren / Talep Eden (Dropdown) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Talep Eden Kişi <span className="text-red-500 font-black">*</span>
                  </label>
                  <select
                    value={cleaningForm.requestedBy}
                    onChange={(e) => setCleaningForm((prev) => ({ ...prev, requestedBy: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none cursor-pointer"
                  >
                    <option value="Lojman Yönetimi">🏢 Lojman Yönetimi</option>
                    {roomResidents.length > 0 && (
                      <optgroup label="Odada İkamet Eden Sakinler">
                        {roomResidents.map((res) => (
                          <option key={res.id} value={res.cleanName}>
                            👤 {res.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Notlar */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Temizlik Notları / Açıklama <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span>
                  </label>
                  <textarea
                    placeholder="Temizlik talebine ilişkin detaylı açıklama veya not yazabilirsiniz..."
                    value={cleaningForm.notes}
                    onChange={(e) => setCleaningForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowCleaningModal(false); setCleaningToEdit(null); }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleCleaningSubmit}
                disabled={cleaningSubmitting}
                className="py-2.5 px-6 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {cleaningSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>{cleaningToEdit ? 'Güncelle' : 'Kaydet'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CLEANING CONFIRMATION MODAL */}
      {cleaningToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Temizlik Kaydını Sil</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                Bu temizlik kaydı kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCleaningToDelete(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDeleteCleaningSubmit}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTE DETAILS POPUP MODAL */}
      {selectedCleaningNote && (
        <div
          onClick={() => setSelectedCleaningNote(null)}
          className="fixed inset-0 z-[350] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-[#1e3a8a]">
                <FileText className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-950">{selectedCleaningNote.title}</h3>
              </div>
              <button
                onClick={() => setSelectedCleaningNote(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {selectedCleaningNote.content}
            </div>

            <div className="text-right pt-2">
              <button
                type="button"
                onClick={() => setSelectedCleaningNote(null)}
                className="py-2 px-5 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-extrabold rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
