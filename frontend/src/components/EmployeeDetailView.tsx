import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Building2,
  BedDouble,
  Lock,
  Cigarette,
  CigaretteOff,
  Volume2,
  VolumeX,
  Clock,
  Car,
  ShieldAlert,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Printer,
  PackageCheck,
  PackageX,
  XCircle,
  MessageSquareWarning,
  History,
  Plus,
  ArrowRightLeft,
  Key,
  Shield,
  FileText,
  LogOut,
  X,
  RotateCcw,
  ZoomIn,
  Globe,
  Users,
  ShieldCheck,
  Laptop,
  Pencil,
  Trash2,
  DoorOpen
} from 'lucide-react';
import { Employee, employeeApi } from '../api/employeeApi';
import { AddEmployeeModal } from './AddEmployeeModal';
import { AssignRoomModal } from './AssignRoomModal';
import { Visitor, visitorApi } from '../api/visitorApi';
import { VisitorRecordsTable } from './VisitorRecordsTable';
import { AddVisitorModal } from './AddVisitorModal';

interface EmployeeDetailViewProps {
  employee: Employee;
  onBack: () => void;
}

type TabType = 'general' | 'inventory' | 'complaints' | 'transfers' | 'visitors' | 'occupancyHistory';

export function formatPhone(phone?: string | null): string {
  if (!phone) return 'Belirtilmedi';
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  } else if (digits.length === 10) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return phone;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Tarih Belirtilmedi';
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `${dateFormatted} • ${timeFormatted}`;
  } catch (e) {
    return dateStr;
  }
}

export const EmployeeDetailView: React.FC<EmployeeDetailViewProps> = ({
  employee,
  onBack,
}) => {
  // currentEmp tracks local state for immediate UI updates after edit
  const [currentEmp, setCurrentEmp] = useState<Employee>(employee || {} as Employee);
  const [operationError, setOperationError] = useState<string | null>(null);

  const handlePrint = () => {
    const originalTitle = document.title;
    const employeeName = `${currentEmp.firstName} ${currentEmp.lastName}`.trim();
    document.title = employeeName || 'Personel Lojman İkamet Dökümü';

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  if (!employee && !currentEmp?.id) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <p className="text-xs font-bold text-slate-600">Personel detayı bulunamadı veya yükleniyor...</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#1e3a8a] text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
        >
          Personel Listesine Dön
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('staff_app_emp_detail_tab');
    if (saved && ['general', 'inventory', 'complaints', 'visitors'].includes(saved)) {
      return saved as TabType;
    }
    return 'general';
  });

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    localStorage.setItem('staff_app_emp_detail_tab', tab);
  };
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);
  const [itemPhotoLightboxUrl, setItemPhotoLightboxUrl] = useState<string | null>(null);

  const getStayDays = () => {
    if (!currentEmp.checkInDate && !currentEmp.createdAt) return '1 Gün';
    try {
      const checkIn = new Date(currentEmp.checkInDate || currentEmp.createdAt);
      const checkOut = currentEmp.checkOutDate ? new Date(currentEmp.checkOutDate) : new Date();
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return `${diffDays} Gün`;
    } catch (e) {
      return '1 Gün';
    }
  };

  const formatCleanTcNo = (tc?: string | null, masked?: string | null) => {
    if (tc && tc.length === 11 && !tc.includes(':') && /^\d+$/.test(tc)) {
      return tc;
    }
    if (masked && masked.length > 3 && !masked.includes(':')) {
      return masked;
    }
    return 'Belirtilmedi';
  };

  const parseReturnDateAndReason = (dateStr?: string | null) => {
    if (!dateStr) return { date: '-', reason: '-' };
    if (dateStr.includes('(') && dateStr.includes(')')) {
      const match = dateStr.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        return { date: match[1].trim(), reason: match[2].trim() };
      }
    }
    return { date: dateStr, reason: '-' };
  };

  // Modals state
  const [isAddPersonalModalOpen, setIsAddPersonalModalOpen] = useState(false);
  const [isAddLojmanModalOpen, setIsAddLojmanModalOpen] = useState(false);
  const [isAddComplaintModalOpen, setIsAddComplaintModalOpen] = useState(false);

  // Form inputs for modals
  const [newPersonalName, setNewPersonalName] = useState('');
  const [newPersonalSerial, setNewPersonalSerial] = useState('');
  const [newPersonalNotes, setNewPersonalNotes] = useState('');
  const [newPersonalPhotoUrl, setNewPersonalPhotoUrl] = useState<string | null>(null);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 1_500_000) {
        setOperationError('Lütfen 1,5 MB boyutunu aşmayan bir görsel seçin.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPersonalPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [newLojmanName, setNewLojmanName] = useState('');

  const [newComplaintTitle, setNewComplaintTitle] = useState('Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma');
  const [newComplaintContent, setNewComplaintContent] = useState('');

  // Parse persisted inventory and discipline records.
  const dbDelivered = currentEmp.inventories
    ? currentEmp.inventories.filter((i: any) => i.category !== 'ŞAHSİ_EŞYA').map((i: any) => ({
      id: i.id,
      itemName: i.itemName,
      assignedDate: formatDateTime(i.assignedDate || i.createdAt),
      returnedDate: i.returnedDate ? formatDateTime(i.returnedDate) : null,
      status: i.status === 'TAM_İADE_ALINDI' ? 'Tam İade Alındı' : 'Teslim Edildi',
    }))
    : [];

  const dbPersonal = currentEmp.inventories
    ? currentEmp.inventories.filter((i: any) => i.category === 'ŞAHSİ_EŞYA').map((i: any) => ({
      id: i.id,
      itemName: i.itemName,
      serialNo: i.serialNo || 'Belirtilmedi',
      declaredDate: formatDateTime(i.assignedDate || i.createdAt),
      exitDate: i.returnedDate ? formatDateTime(i.returnedDate) : null,
      approvalStatus: 'Güvenlik Onaylı - Çıkış İzinli',
      notes: i.notes || 'Personel lojmana girerken kendi yanında getirdi.',
    }))
    : [];

  const dbComplaints = currentEmp.disciplinaryNotes
    ? currentEmp.disciplinaryNotes.map((d: any) => ({
      id: d.id,
      date: formatDateTime(d.createdAt),
      title: d.title,
      content: d.content,
      status: d.status || 'Görüşüldü',
      reportedBy: d.reportedBy || 'Lojman Amirliği',
    }))
    : [];

  const hasDbInventories = Array.isArray(currentEmp.inventories);
  const hasDbComplaints = Array.isArray(currentEmp.disciplinaryNotes);

  // Inventory Items - Check-in Delivered Items (Lojmanın Verdiği)
  const [deliveredInventories, setDeliveredInventories] = useState(
    hasDbInventories ? dbDelivered : []
  );

  // Inventory Items - Check-out Returned Items (Lojmana İade Edilenler)
  const [returnedInventories, setReturnedInventories] = useState<Array<{ id: string; itemName: string; returnDate: string; status: string; condition: string }>>([]);

  // Personelin Kendi Yanında Getirdiği Şahsi Eşyalar (Çıkış İzinli Mülkiyet Beyanı)
  const [personalBelongings, setPersonalBelongings] = useState(
    hasDbInventories ? dbPersonal : []
  );

  // Complaints / Discipline Notes
  const [complaints, setComplaints] = useState(
    hasDbComplaints ? dbComplaints : []
  );

  // Keep state in sync with employee prop changes
  useEffect(() => {
    setCurrentEmp(employee);
    if (Array.isArray(employee.inventories)) {
      setDeliveredInventories(
        employee.inventories.filter((i: any) => i.category !== 'ŞAHSİ_EŞYA').map((i: any) => ({
          id: i.id,
          itemName: i.itemName,
          itemCode: i.itemCode || 'ZMM-101',
          assignedDate: formatDateTime(i.assignedDate || i.createdAt),
          returnedDate: i.returnedDate ? formatDateTime(i.returnedDate) : null,
          status: i.status === 'TAM_İADE_ALINDI' ? 'Tam İade Alındı' : i.status === 'TESLİM_ALINAMADI' ? 'Teslim Alınamadı' : 'Teslim Edildi',
        }))
      );
      setPersonalBelongings(
        employee.inventories.filter((i: any) => i.category === 'ŞAHSİ_EŞYA').map((i: any) => ({
          id: i.id,
          itemName: i.itemName,
          serialNo: i.serialNo || i.itemCode || 'Belirtilmedi',
          declaredDate: formatDateTime(i.assignedDate || i.createdAt),
          exitDate: i.returnedDate ? formatDateTime(i.returnedDate) : null,
          approvalStatus: 'Güvenlik Onaylı - Çıkış İzinli',
          notes: i.notes || 'Personel lojmana girerken kendi yanında getirdi.',
        }))
      );
    }
    if (Array.isArray(employee.disciplinaryNotes)) {
      setComplaints(
        employee.disciplinaryNotes.map((d: any) => ({
          id: d.id,
          date: formatDateTime(d.createdAt),
          title: d.title,
          content: d.content,
          status: d.status || 'Görüşüldü',
          reportedBy: d.reportedBy || 'Lojman Amirliği',
        }))
      );
    }
  }, [employee]);

  // Room Transfer History
  const [transfers, setTransfers] = useState([
    {
      id: 'tr-1',
      date: formatDateTime(currentEmp.checkInDate || currentEmp.createdAt),
      action: 'Giriş Kaydı',
      fromRoom: '-',
      toRoom: `${currentEmp.beds?.[0]?.room.block.name || 'A Blok'} • Oda ${currentEmp.beds?.[0]?.room.roomNumber || '101'}`,
      toBed: currentEmp.beds?.[0]?.bedLabel || 'Yatak-1',
      reason: 'Sisteme İlk Kayıt ve Odaya Giriş'
    },
  ]);

  const currentBed = currentEmp.beds && currentEmp.beds.length > 0 ? currentEmp.beds[0] : null;

  // Edit Employee Profile Modal State (uses AddEmployeeModal in edit mode)
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isAssignRoomOpen, setIsAssignRoomOpen] = useState(false);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);

  // Refresh current employee profile after room assignment
  const refreshEmployeeData = async () => {
    try {
      const emps = await employeeApi.getEmployees();
      const updated = emps.find((e) => e.id === currentEmp.id);
      if (updated) {
        setCurrentEmp(updated);
      }
    } catch (err) {
      console.warn('Failed to refresh employee details:', err);
    }
  };

  // Handler called when AddEmployeeModal successfully saves edit
  const handleProfileEditSuccess = (updatedEmployee?: Employee) => {
    if (updatedEmployee) {
      setCurrentEmp(prev => ({ ...prev, ...updatedEmployee }));
    }
    setIsEditProfileModalOpen(false);
  };

  // Handlers to add items dynamically into PostgreSQL
  const handleAddPersonalBelonging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonalName.trim()) return;

    try {
      if (employee.id && !employee.id.startsWith('emp-')) {
        await employeeApi.addInventoryItem(employee.id, {
          itemName: newPersonalName.trim(),
          itemCode: newPersonalSerial.trim() || undefined,
          category: 'ŞAHSİ_EŞYA',
          serialNo: newPersonalSerial.trim() || undefined,
          photoUrl: newPersonalPhotoUrl || undefined,
          notes: newPersonalNotes.trim() || undefined,
        });
      }
    } catch (err) {
      setOperationError('Şahsi eşya kaydedilemedi. Lütfen tekrar deneyin.');
      return;
    }

    const newItem = {
      id: `pr-${Date.now()}`,
      itemName: newPersonalName.trim(),
      serialNo: newPersonalSerial.trim() || 'Belirtilmedi',
      declaredDate: formatDateTime(new Date().toISOString()),
      exitDate: null,
      approvalStatus: 'Güvenlik Onaylı - Çıkış İzinli',
      photoUrl: newPersonalPhotoUrl || undefined,
      notes: newPersonalNotes.trim() || 'Personel lojmana girerken kendi yanında getirdi.',
    };

    setPersonalBelongings([newItem, ...personalBelongings]);
    setNewPersonalName('');
    setNewPersonalSerial('');
    setNewPersonalNotes('');
    setNewPersonalPhotoUrl(null);
    setIsAddPersonalModalOpen(false);
  };

  const handleAddLojmanInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLojmanName.trim()) return;

    try {
      if (employee.id && !employee.id.startsWith('emp-')) {
        await employeeApi.addInventoryItem(employee.id, {
          itemName: newLojmanName.trim(),
          category: 'LOJMAN_ZİMMETİ',
        });
      }
    } catch (err) {
      setOperationError('Zimmet kaydedilemedi. Lütfen tekrar deneyin.');
      return;
    }

    const newItem = {
      id: `inv-${Date.now()}`,
      itemName: newLojmanName.trim(),
      assignedDate: formatDateTime(new Date().toISOString()),
      returnedDate: null,
      status: 'Teslim Edildi',
    };

    setDeliveredInventories([newItem, ...deliveredInventories]);
    setNewLojmanName('');
    setIsAddLojmanModalOpen(false);
  };

  // Visitor Records State
  // Ziyaretçi API'si tamamlandığında bu state gerçek kayıtlardan beslenecek.
  const [visitors, setVisitors] = useState<Array<{
    id: string;
    visitorName: string;
    visitorTcNo: string;
    relation: string;
    entryDate: string;
    exitDate: string | null;
    status: string;
    notes: string;
  }>>([]);
  const [visitorRecords, setVisitorRecords] = useState<Visitor[]>([]);
  const [visitorRecordsLoading, setVisitorRecordsLoading] = useState(false);
  const [visitorRecordsError, setVisitorRecordsError] = useState<string | null>(null);
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);

  const loadVisitorRecords = async () => {
    setVisitorRecordsLoading(true);
    setVisitorRecordsError(null);
    try {
      const result = await visitorApi.getVisitors({ hostEmployeeId: employee.id, pageSize: 100, sortBy: 'entryTime', sortOrder: 'desc' });
      setVisitorRecords(result.items);
    } catch (error) {
      setVisitorRecordsError(error instanceof Error ? error.message : 'Ziyaretçi kayıtları yüklenemedi.');
    } finally {
      setVisitorRecordsLoading(false);
    }
  };

  useEffect(() => { loadVisitorRecords(); }, [employee.id]);

  // Edit Item State for Excel Tables, Complaints & Visitors
  const [editingItem, setEditingItem] = useState<{ id: string; type: 'delivered' | 'personal' | 'returned' | 'complaint' | 'visitor'; itemName: string; serialNo?: string; content?: string; relation?: string } | null>(null);

  // Unreturned Item Modal State
  const [unreturnedModalItem, setUnreturnedModalItem] = useState<{ id: string; itemName: string } | null>(null);
  const [unreturnedReason, setUnreturnedReason] = useState<string>('Kayıp / Kayboldu');
  const [unreturnedNote, setUnreturnedNote] = useState<string>('');

  useEffect(() => {
    if (unreturnedModalItem) {
      setUnreturnedReason('Kayıp / Kayboldu');
      setUnreturnedNote('');
    }
  }, [unreturnedModalItem]);

  const handleMarkUnreturnedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unreturnedModalItem) return;

    const currentTime = formatDateTime(new Date().toISOString());
    const fullReason = unreturnedReason === 'Diğer (Açıklama Giriniz)'
      ? (unreturnedNote.trim() ? `Diğer: ${unreturnedNote.trim()}` : 'Diğer Belirtilmedi')
      : unreturnedReason;

    try {
      if (!unreturnedModalItem.id.startsWith('inv-') && !unreturnedModalItem.id.startsWith('pr-')) {
        await employeeApi.returnInventoryItem(unreturnedModalItem.id);
      }
    } catch (err) {
      setOperationError('İade işlemi kaydedilemedi. Lütfen tekrar deneyin.');
      return;
    }

    setDeliveredInventories(deliveredInventories.map(i =>
      i.id === unreturnedModalItem.id
        ? { ...i, returnedDate: `${currentTime} (${fullReason})`, status: 'Teslim Alınamadı' }
        : i
    ));

    setUnreturnedModalItem(null);
  };

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmText?: string;
    confirmVariant?: 'emerald' | 'rose' | 'purple' | 'blue';
    onConfirm: () => void;
  } | null>(null);

  const handleDeleteItem = (id: string, type: 'delivered' | 'personal' | 'returned' | 'complaint' | 'visitor') => {
    const itemName = type === 'delivered'
      ? deliveredInventories.find(i => i.id === id)?.itemName
      : type === 'personal'
        ? personalBelongings.find(p => p.id === id)?.itemName
        : type === 'returned'
          ? returnedInventories.find(r => r.id === id)?.itemName
          : type === 'complaint'
            ? complaints.find(c => c.id === id)?.title
            : visitors.find(v => v.id === id)?.visitorName;

    setConfirmModal({
      isOpen: true,
      title: type === 'visitor' ? 'Ziyaretçi Kaydını Silme Onayı' : type === 'complaint' ? 'Şikayet Kaydını Silme Onayı' : 'Kaydı Silme Onayı',
      message: itemName
        ? `"${itemName}" kaydını silmek istediğinizden emin misiniz?`
        : 'Bu kaydı silmek istediğinizden emin misiniz?',
      subMessage: 'Bu işlem kalıcı olarak silinecektir.',
      confirmText: 'Evet, Sil',
      confirmVariant: 'rose',
      onConfirm: async () => {
        try {
          if (!id.startsWith('inv-') && !id.startsWith('pr-') && !id.startsWith('ret-') && !id.startsWith('cmp-') && !id.startsWith('vst-')) {
            await employeeApi.deleteInventoryItem(id);
          }
        } catch (err) {
          setOperationError('Kayıt silinemedi. Lütfen tekrar deneyin.');
          setConfirmModal(null);
          return;
        }

        if (type === 'delivered') {
          setDeliveredInventories(deliveredInventories.filter(i => i.id !== id));
        } else if (type === 'personal') {
          setPersonalBelongings(personalBelongings.filter(p => p.id !== id));
        } else if (type === 'returned') {
          setReturnedInventories(returnedInventories.filter(r => r.id !== id));
        } else if (type === 'complaint') {
          setComplaints(complaints.filter(c => c.id !== id));
        } else if (type === 'visitor') {
          setVisitors(visitors.filter(v => v.id !== id));
        }
        setConfirmModal(null);
      }
    });
  };

  const handleReturnItem = (id: string, type: 'delivered' | 'personal') => {
    const returnTime = formatDateTime(new Date().toISOString());
    const itemName = type === 'delivered'
      ? deliveredInventories.find(i => i.id === id)?.itemName
      : personalBelongings.find(p => p.id === id)?.itemName;

    setConfirmModal({
      isOpen: true,
      title: type === 'delivered' ? 'Teslim Alma Onayı' : 'Çıkış Beyanı Onayı',
      message: itemName
        ? `"${itemName}" eşyasını teslim aldığınızı onaylıyor musunuz?`
        : 'Bu eşyayı teslim aldığınızı onaylıyor musunuz?',
      subMessage: `İşlem Zamanı: ${returnTime}`,
      confirmText: type === 'delivered' ? 'Evet, Teslim Al' : 'Evet, Çıkış Yap',
      confirmVariant: type === 'delivered' ? 'emerald' : 'purple',
      onConfirm: async () => {
        try {
          if (!id.startsWith('inv-') && !id.startsWith('pr-')) {
            await employeeApi.returnInventoryItem(id);
          }
        } catch (err) {
          setOperationError('Teslim işlemi kaydedilemedi. Lütfen tekrar deneyin.');
          setConfirmModal(null);
          return;
        }

        if (type === 'delivered') {
          setDeliveredInventories(deliveredInventories.map(i => i.id === id ? { ...i, returnedDate: returnTime, status: 'Tam İade Alındı' } : i));
        } else if (type === 'personal') {
          setPersonalBelongings(personalBelongings.map(p => p.id === id ? { ...p, exitDate: returnTime } : p));
        }
        setConfirmModal(null);
      }
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      if (!editingItem.id.startsWith('inv-') && !editingItem.id.startsWith('pr-') && !editingItem.id.startsWith('ret-') && !editingItem.id.startsWith('vst-')) {
        await employeeApi.updateInventoryItem(editingItem.id, {
          itemName: editingItem.itemName,
          serialNo: editingItem.serialNo,
        });
      }
    } catch (err) {
      setOperationError('Değişiklik kaydedilemedi. Lütfen tekrar deneyin.');
      return;
    }

    if (editingItem.type === 'delivered') {
      setDeliveredInventories(deliveredInventories.map(i => i.id === editingItem.id ? { ...i, itemName: editingItem.itemName } : i));
    } else if (editingItem.type === 'personal') {
      setPersonalBelongings(personalBelongings.map(p => p.id === editingItem.id ? { ...p, itemName: editingItem.itemName, serialNo: editingItem.serialNo || p.serialNo } : p));
    } else if (editingItem.type === 'returned') {
      setReturnedInventories(returnedInventories.map(r => r.id === editingItem.id ? { ...r, itemName: editingItem.itemName } : r));
    } else if (editingItem.type === 'complaint') {
      setComplaints(complaints.map(c => c.id === editingItem.id ? { ...c, title: editingItem.itemName, content: editingItem.content || c.content } : c));
    } else if (editingItem.type === 'visitor') {
      setVisitors(visitors.map(v => v.id === editingItem.id ? {
        ...v,
        visitorName: editingItem.itemName,
        visitorTcNo: editingItem.serialNo || v.visitorTcNo,
        relation: editingItem.relation || v.relation,
        notes: editingItem.content || v.notes,
      } : v));
    }

    setEditingItem(null);
  };

  const handleAddComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaintTitle.trim()) return;

    try {
      if (employee.id && !employee.id.startsWith('emp-')) {
        await employeeApi.addDisciplinaryNote(employee.id, {
          title: newComplaintTitle.trim(),
          content: newComplaintContent.trim() || 'Açıklama girilmedi.',
          reportedBy: 'Lojman Amirliği',
        });
      }
    } catch (err) {
      setOperationError('Disiplin notu kaydedilemedi. Lütfen tekrar deneyin.');
      return;
    }

    const newItem = {
      id: `cmp-${Date.now()}`,
      date: formatDateTime(new Date().toISOString()),
      title: newComplaintTitle.trim(),
      content: newComplaintContent.trim() || 'Açıklama girilmedi.',
      status: 'Görüşüldü',
      reportedBy: 'Lojman Amirliği',
    };

    setComplaints([newItem, ...complaints]);
    setNewComplaintTitle('Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma');
    setNewComplaintContent('');
    setIsAddComplaintModalOpen(false);
  };

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* PERSONEL PROFİL BİLGİLERİNİ DÜZENLEME MODALI - AddEmployeeModal (edit mode) */}
      <AddEmployeeModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        onSuccess={handleProfileEditSuccess}
        initialData={currentEmp}
      />

      {/* PERSONELE ODA & YATAK ATAMA MODALI */}
      <AssignRoomModal
        isOpen={isAssignRoomOpen}
        onClose={() => setIsAssignRoomOpen(false)}
        employee={currentEmp}
        onSuccess={refreshEmployeeData}
      />

      {/* ODADAN ÇIKIŞ ONAY MODALI */}
      {isCheckoutConfirmOpen && (
        <div
          onClick={() => setIsCheckoutConfirmOpen(false)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center text-slate-900"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Odadan Çıkış Yap</h3>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                <strong className="text-slate-900">{currentEmp.firstName} {currentEmp.lastName}</strong> isimli personeli odasından çıkarmak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutConfirmOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsCheckoutConfirmOpen(false);
                  try {
                    const updated = await employeeApi.checkoutRoom(currentEmp.id);
                    setCurrentEmp(updated);
                  } catch (err: any) {
                    alert(err.message || 'Odadan çıkış yapılırken bir hata oluştu.');
                  }
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-colors"
              >
                Evet, Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DÜZENLEME MODALI */}
      {editingItem && (
        <div
          onClick={() => setEditingItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#1e3a8a]" />
                <span>{editingItem.type === 'complaint' ? 'Şikayet / Disiplin Kaydını Düzenle' : 'Zimmet / Eşya Kaydını Düzenle'}</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              {editingItem.type === 'visitor' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Ziyaretçi Adı Soyadı *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingItem.itemName}
                      onChange={(e) => setEditingItem({ ...editingItem, itemName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      TC Kimlik No
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={editingItem.serialNo || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, serialNo: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Yakınlık / İlişkisi *
                    </label>
                    <select
                      value={editingItem.relation || 'Kardeşi'}
                      onChange={(e) => setEditingItem({ ...editingItem, relation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none cursor-pointer"
                    >
                      <option value="Kardeşi">Kardeşi</option>
                      <option value="Babası">Babası</option>
                      <option value="Annesi">Annesi</option>
                      <option value="Eşi">Eşi</option>
                      <option value="Çocuğu">Çocuğu</option>
                      <option value="Arkadaşı">Arkadaşı</option>
                      <option value="Akrabası">Akrabası</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Açıklama / Not
                    </label>
                    <textarea
                      rows={2}
                      value={editingItem.content || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </>
              ) : editingItem.type === 'complaint' ? (
                <>
                  <div>
                    <label className="block font-extrabold text-slate-800 mb-1.5">
                      Disiplin / Şikayet Maddesi *
                    </label>
                    <select
                      required
                      value={editingItem.itemName}
                      onChange={(e) => setEditingItem({ ...editingItem, itemName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors cursor-pointer text-xs"
                    >
                      <option value="Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma">Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma</option>
                      <option value="Madde 2: Temizlik, Hijyen ve Düzen İhlali">Madde 2: Temizlik, Hijyen ve Düzen İhlali</option>
                      <option value="Madde 3: Lojman İçi Alkol, Sigara veya Yasaklı Madde Kullanımı">Madde 3: Lojman İçi Alkol, Sigara veya Yasaklı Madde Kullanımı</option>
                      <option value="Madde 4: Lojman Eşyalarına veya Demirbaşa Zarar Verme">Madde 4: Lojman Eşyalarına veya Demirbaşa Zarar Verme</option>
                      <option value="Madde 5: İzinsiz Misafir Veya Yabancı Şahıs Konaklatma">Madde 5: İzinsiz Misafir Veya Yabancı Şahıs Konaklatma</option>
                      <option value="Madde 6: Giriş / Çıkış Saatleri ve Güvenlik Kurallarına Uymama">Madde 6: Giriş / Çıkış Saatleri ve Güvenlik Kurallarına Uymama</option>
                      <option value="Madde 7: Diğer Disiplin / Düzen İhlalleri">Madde 7: Diğer Disiplin / Düzen İhlalleri</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-extrabold text-slate-800 mb-1.5">
                      Şikayetin Açıklaması & Detayları *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={editingItem.content || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors text-xs resize-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Eşya / Cihaz Adı *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingItem.itemName}
                      onChange={(e) => setEditingItem({ ...editingItem, itemName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  {editingItem.type === 'personal' && (
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Seri No / Marka
                      </label>
                      <input
                        type="text"
                        value={editingItem.serialNo || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, serialNo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#1e3a8a] hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM ONAY / CONFIRMATION MODAL */}
      {confirmModal && confirmModal.isOpen && (
        <div
          onClick={() => setConfirmModal(null)}
          className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-900 animate-fadeIn"
          >
            <div className="flex items-start gap-3.5">
              {confirmModal.confirmVariant === 'rose' && (
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
                  <Trash2 className="w-5.5 h-5.5" />
                </div>
              )}
              {confirmModal.confirmVariant === 'emerald' && (
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                  <RotateCcw className="w-5.5 h-5.5" />
                </div>
              )}
              {confirmModal.confirmVariant === 'purple' && (
                <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
                  <LogOut className="w-5.5 h-5.5" />
                </div>
              )}
              {(!confirmModal.confirmVariant || confirmModal.confirmVariant === 'blue') && (
                <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
                  <AlertCircle className="w-5.5 h-5.5" />
                </div>
              )}

              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                  {confirmModal.title}
                </h3>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            {confirmModal.subMessage && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-slate-600 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{confirmModal.subMessage}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className={`py-2 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer ${confirmModal.confirmVariant === 'rose'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : confirmModal.confirmVariant === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : confirmModal.confirmVariant === 'purple'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-[#1e3a8a] hover:bg-slate-900'
                  }`}
              >
                {confirmModal.confirmText || 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TESLİM ALINAMADI NEDENİ SEÇİM MODALI */}
      {unreturnedModalItem && (
        <div
          onClick={() => setUnreturnedModalItem(null)}
          className="fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <PackageX className="w-4.5 h-4.5 text-amber-600" />
                <span>Zimmet Teslim Alınamadı Kaydı</span>
              </h3>
              <button
                type="button"
                onClick={() => setUnreturnedModalItem(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-xs space-y-1">
              <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>{unreturnedModalItem.itemName}</span>
              </div>
              <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                Bu eşya lojman amirliğine teslim edilemedi olarak işaretlenecektir. Lütfen nedenini seçiniz.
              </p>
            </div>

            <form onSubmit={handleMarkUnreturnedSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-slate-800 mb-1.5">
                  Teslim Alınamama Nedeni *
                </label>
                <select
                  value={unreturnedReason}
                  onChange={(e) => setUnreturnedReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors cursor-pointer"
                >
                  <option value="Kayıp / Kayboldu">Kayıp / Kayboldu</option>
                  <option value="Hasarlı / Kullanılamaz Halde">Hasarlı / Kullanılamaz Halde</option>
                  <option value="Personel Tarafından Geri Verilmedi">Personel Tarafından Geri Verilmedi</option>
                  <option value="Kırıldı / Bozuldu">Kırıldı / Bozuldu</option>
                  <option value="Eksik Parça / Aksesuar">Eksik Parça / Aksesuar</option>
                  <option value="Diğer (Açıklama Giriniz)">Diğer (Açıklama Giriniz)</option>
                </select>
              </div>

              {unreturnedReason === 'Diğer (Açıklama Giriniz)' && (
                <div className="animate-fadeIn">
                  <label className="block font-extrabold text-slate-800 mb-1.5">
                    Ek Açıklama / Notlar *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={unreturnedNote}
                    onChange={(e) => setUnreturnedNote(e.target.value)}
                    placeholder="Lütfen teslim alınamama nedenini detaylıca yazınız..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors text-xs resize-none"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnreturnedModalItem(null)}
                  className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PackageX className="w-4 h-4" />
                  <span>Teslim Alınamadı Olarak Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL (PERSONEL VESİKALIK VEYA ŞAHSİ EŞYA GÖRSELİ) */}
      {(isPhotoLightboxOpen || itemPhotoLightboxUrl) && (
        <div
          onClick={() => {
            setIsPhotoLightboxOpen(false);
            setItemPhotoLightboxUrl(null);
          }}
          className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn no-print cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white border border-slate-300 rounded-3xl p-4 max-w-lg w-full shadow-2xl space-y-4 text-center cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-[#1e3a8a]" />
                <span>
                  {itemPhotoLightboxUrl ? 'Şahsi Eşya / Cihaz Görseli Kaydı' : `Personel Vesikalık Fotoğrafı (${employee.firstName} ${employee.lastName})`}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsPhotoLightboxOpen(false);
                  setItemPhotoLightboxUrl(null);
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full h-80 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner">
              {itemPhotoLightboxUrl ? (
                <img src={itemPhotoLightboxUrl} alt="Şahsi Eşya Fotoğrafı" className="w-full h-full object-contain bg-slate-950" />
              ) : employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={`${employee.firstName} ${employee.lastName}`}
                  className="w-full h-full object-contain bg-slate-950"
                />
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-24 h-24 rounded-full bg-[#1e3a8a] text-white font-black text-4xl flex items-center justify-center mx-auto shadow-md">
                    {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                  </div>
                  <p className="text-xs text-slate-500 font-bold">Fotoğraf yüklenmemiş</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 font-semibold">
              Kapatmak için görselin dışına veya [X] butonuna tıklayabilirsiniz.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. YENİ ŞAHSİ EŞYA / CİHAZ BEYANI EKLEME MODALI */}
      {/* ------------------------------------------------------------- */}
      {isAddPersonalModalOpen && (
        <div
          onClick={() => setIsAddPersonalModalOpen(false)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Laptop className="w-4 h-4 text-purple-700" />
                <span>Yeni Şahsi Eşya / Cihaz Beyanı Ekle</span>
              </h3>
              <button
                onClick={() => setIsAddPersonalModalOpen(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPersonalBelonging} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Eşya / Cihaz Adı *
                </label>
                <input
                  type="text"
                  required
                  value={newPersonalName}
                  onChange={(e) => setNewPersonalName(e.target.value)}
                  placeholder="Örn: Vestel 32 LED TV, Arzum Kettle, Bisan Bisiklet"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Marka / Seri Numarası
                </label>
                <input
                  type="text"
                  value={newPersonalSerial}
                  onChange={(e) => setNewPersonalSerial(e.target.value)}
                  placeholder="Örn: SN-904821"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Açıklama / Not
                </label>
                <textarea
                  rows={2}
                  value={newPersonalNotes}
                  onChange={(e) => setNewPersonalNotes(e.target.value)}
                  placeholder="Personel lojmana girerken yanında getirdi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                />
              </div>

              {/* Opsiyonel Ürün Görseli */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Ürün Görseli (Opsiyonel)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="w-full text-xs font-semibold text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-900 cursor-pointer"
                  />
                  {newPersonalPhotoUrl && (
                    <img src={newPersonalPhotoUrl} alt="Önizleme" className="w-10 h-10 rounded-lg object-cover border border-purple-300 shrink-0" />
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPersonalModalOpen(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-purple-900 hover:bg-purple-950 text-white font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Beyanı Kaydet (Çıkış İzinli)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. YENİ LOJMAN ZİMMETİ VERME MODALI */}
      {/* ------------------------------------------------------------- */}
      {isAddLojmanModalOpen && (
        <div
          onClick={() => setIsAddLojmanModalOpen(false)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-700" />
                <span>Yeni Lojman Zimmeti Ver</span>
              </h3>
              <button
                onClick={() => setIsAddLojmanModalOpen(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLojmanInventory} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Zimmetli Ekipman / Eşya Tanımı *
                </label>
                <input
                  type="text"
                  required
                  value={newLojmanName}
                  onChange={(e) => setNewLojmanName(e.target.value)}
                  placeholder="Örn: 1x Oda Kapı Anahtarı, Nevresim Takımı"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLojmanModalOpen(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#1e3a8a] hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Zimmeti Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. YENİ ŞİKAYET / DİSİPLİN NOTU EKLEME MODALI */}
      {/* ------------------------------------------------------------- */}
      {isAddComplaintModalOpen && (
        <div
          onClick={() => setIsAddComplaintModalOpen(false)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <MessageSquareWarning className="w-4 h-4 text-amber-700" />
                <span>Yeni Şikayet / Disiplin Notu Ekle</span>
              </h3>
              <button
                onClick={() => setIsAddComplaintModalOpen(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddComplaint} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-extrabold text-slate-800 mb-1.5">
                  Disiplin / Şikayet Maddesi *
                </label>
                <select
                  required
                  value={newComplaintTitle}
                  onChange={(e) => setNewComplaintTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-amber-600 focus:bg-white transition-colors cursor-pointer text-xs"
                >
                  <option value="Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma">Madde 1: Oda İçi Gürültü / Huzursuzluk Çıkarma</option>
                  <option value="Madde 2: Temizlik, Hijyen ve Düzen İhlali">Madde 2: Temizlik, Hijyen ve Düzen İhlali</option>
                  <option value="Madde 3: Lojman İçi Alkol, Sigara veya Yasaklı Madde Kullanımı">Madde 3: Lojman İçi Alkol, Sigara veya Yasaklı Madde Kullanımı</option>
                  <option value="Madde 4: Lojman Eşyalarına veya Demirbaşa Zarar Verme">Madde 4: Lojman Eşyalarına veya Demirbaşa Zarar Verme</option>
                  <option value="Madde 5: İzinsiz Misafir Veya Yabancı Şahıs Konaklatma">Madde 5: İzinsiz Misafir Veya Yabancı Şahıs Konaklatma</option>
                  <option value="Madde 6: Giriş / Çıkış Saatleri ve Güvenlik Kurallarına Uymama">Madde 6: Giriş / Çıkış Saatleri ve Güvenlik Kurallarına Uymama</option>
                  <option value="Madde 7: Diğer Disiplin / Düzen İhlalleri">Madde 7: Diğer Disiplin / Düzen İhlalleri</option>
                </select>
              </div>

              <div>
                <label className="block font-extrabold text-slate-800 mb-1.5">
                  Şikayetin Açıklaması & Detayları *
                </label>
                <textarea
                  rows={4}
                  required
                  value={newComplaintContent}
                  onChange={(e) => setNewComplaintContent(e.target.value)}
                  placeholder="Olayın nerede, ne zaman gerçekleştiğini ve şikayetin içeriğini detaylıca anlatınız..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 outline-none focus:border-amber-600 focus:bg-white transition-colors text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddComplaintModalOpen(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-md"
                >
                  Notu Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCLUSIVE OFFICIAL CORPORATE PRINT DOCUMENT */}
      <div className="official-print-document hidden print:block text-black font-sans text-[10px] leading-tight space-y-3">

        {/* Corporate Header */}
        <div className="border-b-2 border-slate-900 pb-2">
          <h1 className="text-sm font-black uppercase tracking-wide text-slate-900">
            DOSİNİA RESORT LOJMAN YÖNETİMİ
          </h1>
          <h2 className="text-xs font-extrabold text-slate-800 uppercase mt-0.5">
            PERSONEL SİCİL, ODA VE ZİMMET DETAYLI İKAMET DÖKÜMÜ
          </h2>
        </div>

        {/* 1. PERSONEL KİMLİK, İŞ VE İKAMET BİLGİLERİ (EXCEL GRID LAYOUT) */}
        <div className="border border-slate-500 overflow-hidden break-inside-avoid">
          <div className="bg-slate-200 font-black px-2 py-1 border-b border-slate-500 uppercase text-[10px] text-slate-900">
            1. PERSONEL KİMLİK, GÖREV VE LOJMAN İKAMET BİLGİLERİ
          </div>
          <table className="w-full table-fixed text-left border-collapse text-[10px]">
            <colgroup><col className="w-[20%]"/><col className="w-[30%]"/><col className="w-[20%]"/><col className="w-[30%]" /></colgroup>
            <tbody>
              <tr className="border-b border-slate-400">
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Adı Soyadı:</td>
                <td className="p-1.5 font-black text-slate-900 border-r border-slate-400">{currentEmp.firstName} {currentEmp.lastName}</td>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">TC Kimlik No:</td>
                <td className="p-1.5 font-semibold text-slate-900">{formatCleanTcNo(currentEmp.tcNo, currentEmp.tcNoMasked)}</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Departman:</td>
                <td className="p-1.5 font-semibold border-r border-slate-400">{currentEmp.department}</td>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Ünvan:</td>
                <td className="p-1.5 font-semibold">{currentEmp.title || 'Belirtilmedi'}</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Sicil No:</td>
                <td className="p-1.5 font-semibold border-r border-slate-400">{currentEmp.registrationNo || 'Belirtilmedi'}</td>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Araç Plaka No:</td>
                <td className="p-1.5 font-semibold">{currentEmp.vehiclePlate || 'Araç Yok'}</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Telefon Numarası:</td>
                <td className="p-1.5 font-semibold border-r border-slate-400">{formatPhone(currentEmp.phone)}</td>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Bağlı Şirket / Taşeron:</td>
                <td className="p-1.5 font-semibold">{currentEmp.company || 'Dosinia Resort'}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Mevcut Lojman & Oda:</td>
                <td className="p-1.5 font-black text-slate-900 border-r border-slate-400">
                  {currentBed ? `${currentBed.room.block.name} • Oda ${currentBed.room.roomNumber} (${currentBed.bedLabel})` : 'Atama Yapılmadı'}
                </td>
                <td className="p-1.5 font-bold bg-slate-100 border-r border-slate-400 whitespace-nowrap">Konaklanan Gün Sayısı:</td>
                <td className="p-1.5 font-black text-slate-900">{getStayDays()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. ODA DEĞİŞTİRME VE HAREKET GEÇMİŞİ */}
        <div className="border border-slate-500 overflow-hidden break-inside-avoid">
          <div className="bg-slate-200 font-black px-2 py-1 border-b border-slate-500 uppercase text-[10px] text-slate-900">
            2. ODA DEĞİŞTİRME VE HAREKET GEÇMİŞİ
          </div>
          {currentEmp.occupancies && currentEmp.occupancies.length > 0 ? (
            <table className="w-full table-fixed text-left border-collapse text-[10px]">
              <colgroup><col className="w-[40%]"/><col className="w-[30%]"/><col className="w-[30%]"/></colgroup>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 font-black text-slate-900">
                  <th className="p-1.5 border-r border-slate-400">Oda & Yatak Konumu</th>
                  <th className="p-1.5 border-r border-slate-400">Giriş Tarihi & Saati</th>
                  <th className="p-1.5">Çıkış Tarihi & Saati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {currentEmp.occupancies.map(log => {
                  const blockName = log.bed?.room?.block?.name || '-';
                  const roomNumber = log.bed?.room?.roomNumber || '-';
                  const bedLabel = log.bed?.bedLabel || '-';

                  return (
                    <tr key={log.id} className="even:bg-slate-50">
                      <td className="p-1.5 font-black text-slate-900 border-r border-slate-400">{blockName} • Oda {roomNumber} ({bedLabel})</td>
                      <td className="p-1.5 border-r border-slate-400 font-semibold">{formatDateTime(log.checkInDate)}</td>
                      <td className="p-1.5 font-semibold">{log.checkOutDate ? formatDateTime(log.checkOutDate) : 'Halen Odada Kalıyor'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-1.5 text-center text-slate-600 font-semibold italic">Kayıtlı oda konaklama geçmişi bulunmamaktadır.</div>
          )}
        </div>

        {/* 3. ŞİKAYET VE DİSİPLİN NOTLARI GEÇMİŞİ */}
        <div className="border border-slate-500 overflow-hidden break-inside-avoid">
          <div className="bg-slate-200 font-black px-2 py-1 border-b border-slate-500 uppercase text-[10px] text-slate-900">
            3. ŞİKAYET VE DİSİPLİN NOTLARI GEÇMİŞİ
          </div>
          {complaints.length > 0 ? (
            <table className="w-full table-fixed text-left border-collapse text-[10px]">
              <colgroup><col className="w-[32%]"/><col className="w-[44%]"/><col className="w-[24%]"/></colgroup>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 font-black text-slate-900">
                  <th className="p-1.5 border-r border-slate-400">Disiplin / Şikayet Maddesi</th>
                  <th className="p-1.5 border-r border-slate-400">Açıklama / Detaylar</th>
                  <th className="p-1.5">Kayıt Tarihi & Saati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {complaints.map(cmp => (
                  <tr key={cmp.id} className="even:bg-slate-50">
                    <td className="p-1.5 font-bold border-r border-slate-400">{cmp.title}</td>
                    <td className="p-1.5 border-r border-slate-400">{cmp.content}</td>
                    <td className="p-1.5 font-semibold">{cmp.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-1.5 text-center text-slate-600 font-semibold italic">Personel hakkında kayıtlı şikayet / disiplin notu bulunmamaktadır.</div>
          )}
        </div>

        {/* 4. LOJMAN ZİMMETLERİ VE ŞAHSİ EŞYA BEYANI */}
        <div className="border border-slate-500 overflow-hidden break-inside-avoid">
          <div className="bg-slate-200 font-black px-2 py-1 border-b border-slate-500 uppercase text-[10px] text-slate-900">
            4. VERİLEN/ALINAN ZİMMETLER VE PERSONEL ŞAHSİ EŞYA BEYANI
          </div>

          {/* Subtable A: Lojman Zimmetleri */}
          <div className="px-2 py-0.5 bg-slate-100 font-black border-b border-slate-400 text-[9px] uppercase">
            A) TESLİM EDİLEN LOJMAN ZİMMET VE EKİPMANLARI
          </div>
          <table className="w-full table-fixed text-left border-collapse text-[10px] border-b border-slate-400">
            <colgroup><col className="w-[30%]"/><col className="w-[22%]"/><col className="w-[22%]"/><col className="w-[26%]"/></colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-400 font-bold text-slate-800">
                <th className="p-1.5 border-r border-slate-400">Ekipman / Eşya Tanımı</th>
                <th className="p-1.5 border-r border-slate-400">Teslim Edilme Tarihi</th>
                <th className="p-1.5 border-r border-slate-400">Teslim Alınma Tarihi</th>
                <th className="p-1.5">Teslim Alınamama Nedeni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {deliveredInventories.map(inv => {
                const parsed = parseReturnDateAndReason(inv.returnedDate);
                const showReturnDate = inv.status === 'Teslim Alınamadı' ? '-' : parsed.date;
                const showReason = inv.status === 'Teslim Alınamadı' ? parsed.reason : '-';
                return (
                  <tr key={inv.id} className="even:bg-slate-50">
                    <td className="p-1.5 font-semibold border-r border-slate-400">{inv.itemName}</td>
                    <td className="p-1.5 border-r border-slate-400">{inv.assignedDate}</td>
                    <td className="p-1.5 border-r border-slate-400 font-bold text-slate-900">{showReturnDate}</td>
                    <td className="p-1.5 font-semibold text-slate-800">{showReason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Subtable B: Şahsi Eşyalar */}
          <div className="px-2 py-0.5 bg-slate-100 font-black border-b border-slate-400 text-[9px] uppercase">
            B) PERSONELİN YANINDA GETİRDİĞİ ŞAHSİ EŞYA BEYANI
          </div>
          <table className="w-full table-fixed text-left border-collapse text-[10px]">
            <colgroup><col className="w-[24%]"/><col className="w-[16%]"/><col className="w-[20%]"/><col className="w-[18%]"/><col className="w-[22%]"/></colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-400 font-bold text-slate-800">
                <th className="p-1.5 border-r border-slate-400">Şahsi Eşya / Cihaz Adı</th>
                <th className="p-1.5 border-r border-slate-400">Seri No / Marka</th>
                <th className="p-1.5 border-r border-slate-400">Giriş Beyan Tarihi</th>
                <th className="p-1.5 border-r border-slate-400">Çıkış Tarihi</th>
                <th className="p-1.5">Beyan Durumu / Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {personalBelongings.map(pb => (
                <tr key={pb.id} className="even:bg-slate-50">
                  <td className="p-1.5 font-semibold border-r border-slate-400">{pb.itemName}</td>
                  <td className="p-1.5 border-r border-slate-400 font-mono text-[9px]">{pb.serialNo}</td>
                  <td className="p-1.5 border-r border-slate-400">{pb.declaredDate}</td>
                  <td className="p-1.5 border-r border-slate-400 font-bold text-slate-900">
                    {(pb as any).exitDate || '-'}
                  </td>
                  <td className="p-1.5 font-semibold text-slate-800">
                    {pb.notes || pb.approvalStatus || 'Güvenlik Onaylı - Çıkış İzinli'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signature & Confirmation Block */}
        <div className="pt-2 border-t border-slate-400 text-[9px] text-slate-700 space-y-2 break-inside-avoid">
          <p className="italic leading-tight">
            İşbu belge, personelin lojmandaki sicil, oda değişikliği, disiplin ve zimmet durumunu gösteren resmi kurum dökümüdür.
          </p>
          <div className="grid grid-cols-3 gap-5 text-center font-bold text-slate-900 pt-3">
            <div className="space-y-6">
              <div>DÜZENLEYEN / LOJMAN YÖNETİMİ</div>
              <div className="border-b border-slate-800 w-36 mx-auto text-[8px] font-normal text-slate-600">İmza / Mühür</div>
            </div>
            <div className="space-y-6">
              <div>İNSAN KAYNAKLARI</div>
              <div className="border-b border-slate-800 w-36 mx-auto text-[8px] font-normal text-slate-600">İmza / Kaşe</div>
            </div>
            <div className="space-y-6">
              <div>TESLİM ALAN / PERSONEL</div>
              <div className="border-b border-slate-800 w-36 mx-auto text-[8px] font-normal text-slate-600">İmza</div>
            </div>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* SCREEN UI VIEW */}
      {/* ------------------------------------------------------------- */}
      <div className="no-print space-y-5">

        {/* Main Profile Card */}
        <div className="p-6 rounded-3xl bg-white border border-slate-300 text-slate-900 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5">

          {/* Avatar with Click to Enlarge */}
          <div
            onClick={() => setIsPhotoLightboxOpen(true)}
            className="relative group w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-inner cursor-pointer hover:border-[#1e3a8a] transition-all"
            title="Büyütmek için tıklayın"
          >
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <span className="font-black text-2xl text-[#1e3a8a]">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </span>
            )}
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <ZoomIn className="w-6 h-6" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-2xl font-black text-slate-900">
                {currentEmp.firstName} {currentEmp.lastName}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${currentEmp.gender === 'Male' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}>
                {currentEmp.gender === 'Male' ? 'Erkek' : 'Kadın'}
              </span>
            </div>

            <p className="text-xs font-bold text-[#1e3a8a]">
              {currentEmp.department} {currentEmp.title ? `• ${currentEmp.title}` : ''}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-medium text-slate-600 pt-1">
              {currentEmp.company && (
                <span className="bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold text-slate-800">
                  {currentEmp.company}
                </span>
              )}
              {currentEmp.registrationNo && (
                <span className="text-slate-500 font-semibold">Sicil No: <strong className="text-slate-900 font-bold">{currentEmp.registrationNo}</strong></span>
              )}
            </div>
          </div>

          {/* Right Action Stack: Edit Profile & Print Buttons TOP, Status Badge BOTTOM */}
          <div className="shrink-0 text-center sm:text-right space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2">
              {currentBed ? (
                <button
                  type="button"
                  onClick={() => setIsCheckoutConfirmOpen(true)}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl border border-rose-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md w-full sm:w-auto"
                >
                  <DoorOpen className="w-4 h-4 text-white" />
                  <span>Odadan Çıkış Yap</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAssignRoomOpen(true)}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl border border-emerald-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md w-full sm:w-auto"
                >
                  <BedDouble className="w-4 h-4 text-white" />
                  <span>Personele Oda Ata</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(true)}
                className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-2xl border border-amber-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md w-full sm:w-auto"
              >
                <Pencil className="w-4 h-4 text-white" />
                <span>Personel Bilgilerini Düzenle</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                title="Yazdırma ekranındaki Hedef alanından PDF olarak kaydet seçeneğini kullanabilirsiniz."
                className="py-2.5 px-4 bg-[#1e3a8a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-2xl border border-blue-900 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md w-full sm:w-auto"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>Yazdır / PDF Kaydet</span>
              </button>
            </div>
          </div>

        </div>

        {/* Main Tab Navigation Header */}
        <div className="bg-white border border-slate-300 rounded-3xl p-2 shadow-sm flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => handleTabSwitch('general')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'general'
              ? 'bg-[#1e3a8a] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <User className="w-4 h-4" />
            <span>Personel Genel Bilgileri</span>
          </button>

          <button
            onClick={() => handleTabSwitch('inventory')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'inventory'
              ? 'bg-[#1e3a8a] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Zimmet & Şahsi Eşya Beyanı ({deliveredInventories.length + personalBelongings.length})</span>
          </button>

          <button
            onClick={() => handleTabSwitch('complaints')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'complaints'
              ? 'bg-[#1e3a8a] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <MessageSquareWarning className="w-4 h-4" />
            <span>Şikayet & Disiplin Notları ({complaints.length})</span>
          </button>

          <button
            onClick={() => handleTabSwitch('visitors')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'visitors'
              ? 'bg-[#1e3a8a] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Ziyaretçi Kayıtları ({visitorRecords.length})</span>
          </button>

          <button
            onClick={() => handleTabSwitch('occupancyHistory')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'occupancyHistory'
              ? 'bg-[#1e3a8a] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <History className="w-4 h-4" />
            <span>Konaklama Geçmişi ({currentEmp.occupancies?.length || 0})</span>
          </button>

        </div>

        {operationError && <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-bold text-rose-900 flex justify-between gap-3"><span>{operationError}</span><button aria-label="Hata mesajını kapat" onClick={() => setOperationError(null)}><X className="w-4 h-4"/></button></div>}

        {/* TAB CONTENT AREA */}
        <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm min-h-[360px]">

          {/* TAB 1: PERSONEL GENEL BİLGİLERİ */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fadeIn">

              {/* KİMLİK & İLETİŞİM VE ACİL DURUM YAKINI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-3">
                    <Lock className="w-4 h-4 text-[#1e3a8a]" />
                    <span>Kimlik & İletişim Detayları</span>
                  </h3>

                  <div className="space-y-3 text-xs font-semibold text-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                        <span className="text-slate-500 font-bold">TC Kimlik No</span>
                        <span className="font-extrabold text-slate-900">{currentEmp.tcNoMasked || 'Belirtilmedi'}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                        <span className="text-slate-500 font-bold">Sicil No</span>
                        <span className="font-extrabold text-slate-900">{currentEmp.registrationNo || 'Belirtilmedi'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                      <span className="text-slate-500 font-bold">Telefon Numarası</span>
                      <span className="font-extrabold text-[#1e3a8a] flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5" /> {formatPhone(currentEmp.phone)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                      <span className="text-slate-500 font-bold">Otopark Araç Plakası</span>
                      <span className="font-extrabold text-slate-900 flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-[#1e3a8a]" /> {currentEmp.vehiclePlate || 'Araç Yok'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acil Durum Yakını */}
                <div className="p-5 rounded-2xl bg-red-50/60 border border-red-200 space-y-3">
                  <h3 className="text-xs font-extrabold text-red-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-3">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Acil Durum İletişim Yakını</span>
                  </h3>

                  {currentEmp.emergencyContactName ? (
                    <div className="space-y-3 text-xs font-semibold text-slate-800">
                      <div className="bg-white p-3 rounded-2xl border border-red-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold block">Yakınının Adı & Soyadı</span>
                        <strong className="text-sm text-slate-900 font-extrabold">{currentEmp.emergencyContactName}</strong>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                        <span className="text-slate-500 font-bold">Yakınlık Derecesi</span>
                        <span className="font-extrabold text-slate-900">{currentEmp.emergencyRelation || 'Yakını'}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200">
                        <span className="text-slate-500 font-bold">Telefon Numarası</span>
                        <span className="font-extrabold text-red-700 flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5" /> {formatPhone(currentEmp.emergencyContactPhone)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-white rounded-2xl border border-red-200 text-xs font-semibold text-slate-500">
                      Acil durum yakını bilgisi henüz girilmemiş.
                    </div>
                  )}
                </div>
              </div>

              {/* LOJMAN ODA & YATAK KONUMU */}
              <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-emerald-700" />
                  <span>Lojman Oda & Yatak Konumu</span>
                </h3>

                {currentBed ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm text-xs font-semibold text-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-500 font-bold block">Lojman Bloğu</span>
                      <strong className="text-base text-emerald-950 font-extrabold">{currentBed.room.block.name}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-bold block">Oda & Kat Numarası</span>
                      <strong className="text-base text-slate-900 font-extrabold">Oda {currentBed.room.roomNumber} (Kat {currentBed.room.floor})</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 font-bold block">Tahsis Edilen Yatak</span>
                      <strong className="text-base text-[#1e3a8a] font-extrabold">{currentBed.bedLabel}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Bu personele henüz lojmanda oda veya yatak yerleşimi yapılmadı.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ODA ARKADAŞI UYUM KRİTERLERİ PROFİLİ */}
              <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-700" />
                  <span>Oda Arkadaşı Uyum Kriterleri Profili</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Sigara */}
                  <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${employee.isSmoker ? 'bg-amber-100/60 border-amber-300 text-amber-950' : 'bg-emerald-100/60 border-emerald-300 text-emerald-950'
                    }`}>
                    {employee.isSmoker ? <Cigarette className="w-5 h-5 text-amber-700 shrink-0" /> : <CigaretteOff className="w-5 h-5 text-emerald-700 shrink-0" />}
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Sigara Kullanımı</span>
                      <span className="text-sm font-extrabold">{employee.isSmoker ? 'Sigara İçiyor' : 'Sigara İçmiyor'}</span>
                    </div>
                  </div>

                  {/* Horlama */}
                  <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-3 ${employee.hasSnoring ? 'bg-purple-100/60 border-purple-300 text-purple-950' : 'bg-blue-100/60 border-blue-300 text-blue-950'
                    }`}>
                    {employee.hasSnoring ? <Volume2 className="w-5 h-5 text-purple-700 shrink-0" /> : <VolumeX className="w-5 h-5 text-blue-700 shrink-0" />}
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Uyku / Horlama</span>
                      <span className="text-sm font-extrabold">{employee.hasSnoring ? 'Horlama Var' : 'Horlama Yok'}</span>
                    </div>
                  </div>

                  {/* Vardiya */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-900 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-[#1e3a8a] shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Vardiya Düzeni</span>
                      <span className="text-sm font-extrabold">{employee.shiftType || 'Gündüz Vardiyası'}</span>
                    </div>
                  </div>

                  {/* Yaş Grubu */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-900 flex items-center gap-3">
                    <Users className="w-5 h-5 text-teal-700 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Yaş Grubu</span>
                      <span className="text-sm font-extrabold">{employee.ageGroup || '26-40 Yaş (Orta Yaş)'}</span>
                    </div>
                  </div>

                  {/* Konuşulan Dil / Uyruk */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-900 flex items-center gap-3">
                    <Globe className="w-5 h-5 text-indigo-700 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold">Konuşulan Dil / Uyruk</span>
                      <span className="text-sm font-extrabold">{employee.languageNationality || 'Türkçe (T.C.)'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KAYIT, ODAYA YERLEŞME & ODADAN ÇIKIŞ TARİHİ KARTLARI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Sistem Kayıt Tarihi & Saati</span>
                    <strong className="text-xs text-slate-900 font-extrabold">{formatDateTime(employee.createdAt)}</strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Odaya Giriş Tarihi & Saati</span>
                    <strong className="text-xs text-emerald-950 font-extrabold">
                      {employee.status === 'RESIDENT' ? formatDateTime(employee.checkInDate || employee.createdAt) : 'Odaya Yerleşme Bekliyor'}
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-800 font-bold block uppercase tracking-wider">Odadan Çıkış Tarihi & Saati</span>
                    <strong className="text-xs text-rose-950 font-extrabold">
                      {employee.checkOutDate ? formatDateTime(employee.checkOutDate) : (employee.status === 'RESIDENT' ? 'Halen Odada İkamet Ediyor' : 'Çıkış Yapılmadı')}
                    </strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ZİMMET & ŞAHSİ EŞYA BEYANI (EXCEL TABLO DÜZENİ) */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-fadeIn">

              {/* SECTION A: GİRİŞTE LOJMANDAN TESLİM EDİLENLER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-blue-700" />
                      <span>1. Girişte Lojmandan Teslim Edilen Zimmet & Ekipmanlar</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Lojman idaresi tarafından personele teslim edilen nevresim, anahtar ve oda eşyaları.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddLojmanModalOpen(true)}
                    className="py-2 px-3 bg-[#1e3a8a] hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Yeni Lojman Zimmeti Ver
                  </button>
                </div>

                {/* Excel Tipi Tablo Görünümü */}
                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-300 font-extrabold text-slate-800">
                        <th className="py-2 px-3 border-r border-slate-200">Ekipman / Eşya Tanımı</th>
                        <th className="py-2 px-3 border-r border-slate-200 w-1/4">Teslim Edilme Tarihi</th>
                        <th className="py-2 px-3 border-r border-slate-200 w-1/4">Teslim Alınma Tarihi / Not</th>
                        <th className="py-2 px-3 border-r border-slate-200 w-1/6 text-center">Zimmet Durumu</th>
                        <th className="py-2 px-3 w-52 text-center">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {deliveredInventories.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 px-3 font-extrabold text-slate-900 border-r border-slate-200 flex items-center gap-2">
                            <Key className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                            <span>{inv.itemName}</span>
                          </td>
                          <td className="py-1.5 px-3 font-semibold text-slate-700 border-r border-slate-200">{inv.assignedDate}</td>
                           <td className="py-1.5 px-3 font-bold border-r border-slate-200">
                            {inv.status === 'Teslim Alınamadı' ? (
                              <span className="text-rose-800 font-extrabold text-[11px]">
                                {parseReturnDateAndReason(inv.returnedDate).reason}
                              </span>
                            ) : inv.returnedDate ? (
                              <span className="text-emerald-800 font-bold">
                                {inv.returnedDate}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-semibold italic">Kullanımda / İade Edilmedi</span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-center border-r border-slate-200">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${inv.status === 'Tam İade Alındı'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                              : inv.status === 'Teslim Alınamadı'
                                ? 'bg-rose-50 text-rose-900 border-rose-300'
                                : 'bg-blue-50 text-blue-900 border-blue-200'
                              }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 min-h-[28px]">
                              {inv.status !== 'Tam İade Alındı' && inv.status !== 'Teslim Alınamadı' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleReturnItem(inv.id, 'delivered')}
                                    title="Teslim Al"
                                    className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 hover:border-emerald-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:rotate-[-45deg]" />
                                    <span className="max-w-0 opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                      Teslim Al
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUnreturnedModalItem({ id: inv.id, itemName: inv.itemName });
                                      setUnreturnedReason('Kayıp / Kayboldu');
                                      setUnreturnedNote('');
                                    }}
                                    title="Teslim Alınamadı"
                                    className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200/80 hover:border-amber-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                                  >
                                    <XCircle className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                    <span className="max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                      Teslim Alınamadı
                                    </span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() => setEditingItem({ id: inv.id, type: 'delivered', itemName: inv.itemName })}
                                title="Düzenle"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Düzenle
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(inv.id, 'delivered')}
                                title="Sil"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200/80 hover:border-red-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Sil
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION B: PERSONELİN KENDİ YANINDA GETİRDİĞİ ŞAHSİ EŞYALAR */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                      <span>2. Personelin Yanında Getirdiği Şahsi Eşya Beyanı</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Personelin lojmana getirip ayrılırken yanında çıkarabileceği şahsi mülk eşyaları.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddPersonalModalOpen(true)}
                    className="py-1.5 px-3 bg-purple-900 hover:bg-purple-950 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Şahsi Eşya / Cihaz Beyanı Ekle
                  </button>
                </div>

                {/* Excel Tipi Tablo Görünümü */}
                <div className="border border-purple-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-purple-100/50 border-b border-purple-200 font-extrabold text-slate-800">
                        <th className="py-2 px-3 border-r border-purple-200 w-12 text-center">Görsel</th>
                        <th className="py-2 px-3 border-r border-purple-200">Şahsi Eşya / Cihaz Adı</th>
                        <th className="py-2 px-3 border-r border-purple-200 w-1/5">Seri No / Marka</th>
                        <th className="py-2 px-3 border-r border-purple-200 w-1/5">Giriş Beyan Tarihi</th>
                        <th className="py-2 px-3 border-r border-purple-200 w-1/4 text-center">Çıkış Tarihi / Durum</th>
                        <th className="py-2 px-3 w-40 text-center">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-200/60">
                      {personalBelongings.map((pb) => (
                        <tr key={pb.id} className="hover:bg-purple-50/40 transition-colors">
                          <td className="py-1 px-2 border-r border-purple-200 text-center">
                            {(pb as any).photoUrl ? (
                              <div
                                onClick={() => setItemPhotoLightboxUrl((pb as any).photoUrl || null)}
                                className="w-7 h-7 rounded-lg bg-slate-900 border border-purple-300 overflow-hidden mx-auto cursor-pointer shadow-sm relative group"
                                title="Fotoğrafı büyüt"
                              >
                                <img src={(pb as any).photoUrl} alt={pb.itemName} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-900 flex items-center justify-center font-bold text-xs mx-auto border border-purple-200">
                                <Laptop className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </td>
                          <td className="py-1.5 px-3 font-extrabold text-slate-900 border-r border-purple-200">
                            <div className="flex items-center gap-2">
                              <span>{pb.itemName}</span>
                              {(pb as any).photoUrl && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                                  📷 Fotoğraflı
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-3 font-semibold text-slate-800 border-r border-purple-200 font-mono">{pb.serialNo}</td>
                          <td className="py-1.5 px-3 font-semibold text-slate-700 border-r border-purple-200">{pb.declaredDate}</td>
                          <td className="py-1.5 px-3 text-center border-r border-purple-200 font-extrabold text-slate-900">
                            {(pb as any).exitDate ? `Çıkış: ${(pb as any).exitDate}` : 'Odada / Kullanımda'}
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 min-h-[28px]">
                              {!(pb as any).exitDate && (
                                <button
                                  type="button"
                                  onClick={() => handleReturnItem(pb.id, 'personal')}
                                  title="Çıkış Yap"
                                  className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border border-purple-200/80 hover:border-purple-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                                >
                                  <LogOut className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                  <span className="max-w-0 opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                    Çıkış Yap
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingItem({ id: pb.id, type: 'personal', itemName: pb.itemName, serialNo: pb.serialNo })}
                                title="Düzenle"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Düzenle
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(pb.id, 'personal')}
                                title="Sil"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Sil
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: PERSONEL HAKKINDAKİ ŞİKAYETLER */}
          {activeTab === 'complaints' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Şikayet & Disiplin Notları</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddComplaintModalOpen(true)}
                  className="py-1.5 px-3 bg-[#1e3a8a] hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Şikayet / Not Ekle
                </button>
              </div>

              {complaints.length > 0 ? (
                <div className="border border-amber-200/80 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-amber-100/50 border-b border-amber-200 font-extrabold text-slate-800">
                        <th className="py-2 px-3 border-r border-amber-200 w-1/3">Şikayet / Disiplin Maddesi</th>
                        <th className="py-2 px-3 border-r border-amber-200">Açıklama & Detaylar</th>
                        <th className="py-2 px-3 border-r border-amber-200 w-44">Kaydedilme Tarihi</th>
                        <th className="py-2 px-3 w-36 text-center">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-200/60">
                      {complaints.map((cmp) => (
                        <tr key={cmp.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2 px-3 font-extrabold text-slate-900 border-r border-amber-200 align-top">
                            <div className="flex items-center gap-1.5">
                              <MessageSquareWarning className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>{cmp.title}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 border-r border-amber-200 leading-relaxed align-top">
                            {cmp.content}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-600 border-r border-amber-200 whitespace-nowrap align-top">
                            {cmp.date}
                          </td>
                          <td className="py-2 px-3 text-center align-top">
                            <div className="flex items-center justify-center gap-1 min-h-[28px]">
                              <button
                                type="button"
                                onClick={() => setEditingItem({ id: cmp.id, type: 'complaint', itemName: cmp.title, content: cmp.content })}
                                title="Düzenle"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/80 hover:border-blue-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Düzenle
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(cmp.id, 'complaint')}
                                title="Sil"
                                className="group relative inline-flex items-center justify-center h-7 px-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-500 ease-out shadow-2xs hover:shadow-md cursor-pointer overflow-hidden"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                                <span className="max-w-0 opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-[11px] font-extrabold whitespace-nowrap overflow-hidden">
                                  Sil
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-bold">
                  Bu personel hakkında verilmiş herhangi bir şikayet veya disiplin notu bulunmamaktadır.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ODA DEĞİŞTİRME VE HAREKET GEÇMİŞİ */}
          {activeTab === 'transfers' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Oda Değiştirme & Konaklama Geçmişi</h3>
                </div>
              </div>

              <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-300 font-extrabold text-slate-800">
                      <th className="py-2 px-3 border-r border-slate-200">İşlem Türü</th>
                      <th className="py-2 px-3 border-r border-slate-200 w-1/6">Önceki Konum</th>
                      <th className="py-2 px-3 border-r border-slate-200 w-1/5">Yeni Konum</th>
                      <th className="py-2 px-3 border-r border-slate-200 w-32 text-center">Yatak</th>
                      <th className="py-2 px-3 border-r border-slate-200 w-36">İşlem Tarihi</th>
                      <th className="py-2 px-3">Açıklama / Neden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-extrabold text-slate-900 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                            <span>{transfer.action}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-600 border-r border-slate-200">
                          {transfer.fromRoom || '-'}
                        </td>
                        <td className="py-2 px-3 font-bold text-[#1e3a8a] border-r border-slate-200">
                          {transfer.toRoom}
                        </td>
                        <td className="py-2 px-3 font-extrabold text-slate-800 border-r border-slate-200 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-[11px]">
                            {transfer.toBed || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                          {transfer.date}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 leading-relaxed">
                          {transfer.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: ZİYARETÇİ KAYITLARI */}
          {activeTab === 'visitors' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-extrabold text-slate-900">Ziyaretçi Kayıtları</h3><p className="text-xs text-slate-500 font-semibold mt-0.5">Personeli ziyaret eden kişilerin gerçek giriş ve çıkış kayıtları.</p></div>
                <button type="button" onClick={() => setIsVisitorModalOpen(true)} className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-extrabold"><Plus className="w-4 h-4" /><span>Yeni Ziyaretçi</span></button>
              </div>
              {visitorRecordsError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{visitorRecordsError}</div>}
              <VisitorRecordsTable
                visitors={visitorRecords}
                loading={visitorRecordsLoading}
                readOnly={true}
              />
              <AddVisitorModal isOpen={isVisitorModalOpen} fixedHostEmployeeId={employee.id} onClose={() => setIsVisitorModalOpen(false)} onSuccess={loadVisitorRecords} />
            </div>
          )}

          {/* TAB 6: KONAKLAMA GEÇMİŞİ */}
          {activeTab === 'occupancyHistory' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Konaklama Geçmişi</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Personelin lojmanda kaldığı geçmiş odalar ile giriş ve çıkış tarihleri.
                </p>
              </div>

              {currentEmp.occupancies && currentEmp.occupancies.length > 0 ? (
                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-300 font-extrabold text-slate-800">
                        <th className="py-2.5 px-3 border-r border-slate-200">Blok Adı</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Oda Numarası</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Yatak Konumu</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-44">Giriş Tarihi & Saati</th>
                        <th className="py-2.5 px-3 w-44">Çıkış Tarihi & Saati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {currentEmp.occupancies.map((log: any) => {
                        const blockName = log.bed?.room?.block?.name || '-';
                        const roomNumber = log.bed?.room?.roomNumber || '-';
                        const bedLabel = log.bed?.bedLabel || '-';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 font-extrabold text-[#1e3a8a] border-r border-slate-200">
                              {blockName}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-slate-900 border-r border-slate-200">
                              {roomNumber}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-slate-800 border-r border-slate-200">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-[11px]">
                                {bedLabel}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                              {formatDateTime(log.checkInDate)}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-600 whitespace-nowrap">
                              {log.checkOutDate ? formatDateTime(log.checkOutDate) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                                  Halen Odada Kalıyor
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-bold">
                  Bu personel için henüz bir konaklama geçmişi kaydı bulunmamaktadır.
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
