import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  BedDouble, 
  Phone, 
  Building2, 
  ShieldAlert, 
  User as UserIcon,
  RefreshCw,
  CheckCircle2,
  Clock,
  Briefcase,
  Cigarette,
  CigaretteOff,
  Car,
  Volume2,
  VolumeX,
  Lock,
  Eye,
  ChevronRight,
  Calendar,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  DoorOpen
} from 'lucide-react';
import { employeeApi, Employee } from '../api/employeeApi';
import { AddEmployeeModal } from './AddEmployeeModal';
import { EmployeeDetailView } from './EmployeeDetailView';
import { EmployeeExportModal } from './EmployeeExportModal';
import { AssignRoomModal } from './AssignRoomModal';
import { DateRangePicker } from './DateRangePicker';

/**
 * Formats ISO date time strings for Turkish display
 * E.g. "2026-07-30T21:46:00Z" -> "30.07.2026 • 21:46"
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return 'Belirtilmedi';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} • ${hours}:${minutes}`;
  } catch (e) {
    return isoString;
  }
}

/**
 * Formats phone numbers for optimal Turkish readability
 * E.g. "05061622322" -> "0506 162 23 22"
 */
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

export const EmployeeManagementView: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportExcel = async (exportStatus: string) => {
    setIsExporting(true);
    setLoadError(null);
    setIsExportModalOpen(false);
    try {
      await employeeApi.exportExcel(search, exportStatus, departmentFilter, genderFilter);
    } catch (err: any) {
      setLoadError(err.message || 'Excel çıktısı alınırken hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  // Single Lojmana Kayıt Tarih Aralığı Date Range Picker
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Sorting state for columns
  const [sortField, setSortField] = useState<'name' | 'room' | 'date' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'name' | 'room' | 'date') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setDepartmentFilter('ALL');
    setGenderFilter('ALL');
    setDateRangeStart('');
    setDateRangeEnd('');
  };

  const hasActiveDateFilters = Boolean(dateRangeStart || dateRangeEnd);

  const activeFilterCount = (genderFilter !== 'ALL' ? 1 : 0) +
    (departmentFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (hasActiveDateFilters ? 1 : 0);

  // Page View state: null = List View, Employee object = Full Detail Page
  const [activeEmployeeDetail, setActiveEmployeeDetail] = useState<Employee | null>(null);
  const [assignRoomEmployee, setAssignRoomEmployee] = useState<Employee | null>(null);

  const openEmployeeDetail = (emp: Employee) => {
    setActiveEmployeeDetail(emp);
    localStorage.setItem('staff_app_active_emp_id', emp.id);
  };

  const closeEmployeeDetail = () => {
    setActiveEmployeeDetail(null);
    localStorage.removeItem('staff_app_active_emp_id');
    fetchEmployees();
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Delete Employee Confirmation state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string; name: string } | null>(null);
  const [checkoutConfirmModal, setCheckoutConfirmModal] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteEmployee = (id: string, name: string) => {
    setDeleteConfirmModal({ id, name });
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteConfirmModal) return;
    try {
      await employeeApi.deleteEmployee(deleteConfirmModal.id);
      setEmployees(prev => prev.filter(e => e.id !== deleteConfirmModal.id));
    } catch (err) {
      setLoadError('Personel kaydı silinemedi. Yetkinizi ve bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await employeeApi.getEmployees(search, statusFilter, departmentFilter);
      setEmployees(data);
    } catch (err) {
      setLoadError('Personel kayıtları yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, departmentFilter]);

  // Restore saved active employee on initial load or after fetch
  useEffect(() => {
    const savedEmpId = localStorage.getItem('staff_app_active_emp_id');
    if (savedEmpId && employees.length > 0) {
      const found = employees.find(e => e.id === savedEmpId);
      if (found) {
        setActiveEmployeeDetail(found);
      }
    }
  }, [employees]);

  // Client-side instant filtering across all parameters
  const filteredEmployees = employees.filter((emp) => {
    // 1. Search Query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
      const matchTc = (emp.tcNo || emp.tcNoMasked || '').toLowerCase().includes(q);
      const matchReg = (emp.registrationNo || '').toLowerCase().includes(q);
      const matchPlate = (emp.vehiclePlate || '').toLowerCase().includes(q);
      const matchPhone = (emp.phone || '').toLowerCase().includes(q);
      const matchDept = (emp.department || '').toLowerCase().includes(q);
      const matchCompany = (emp.company || '').toLowerCase().includes(q);
      const matchTitle = (emp.title || '').toLowerCase().includes(q);
      if (!matchName && !matchTc && !matchReg && !matchPlate && !matchPhone && !matchDept && !matchCompany && !matchTitle) {
        return false;
      }
    }

    // 2. Gender Filter
    if (genderFilter !== 'ALL') {
      const empGender = emp.gender === 'Female' ? 'Female' : 'Male';
      if (empGender !== genderFilter) return false;
    }

    // 3. Lojmana Kayıt Tarihi (Check-in / Registration Date) Range Filter
    if (dateRangeStart || dateRangeEnd) {
      const regDateVal = emp.checkInDate || emp.createdAt;
      if (!regDateVal) return false;
      const empDate = regDateVal.slice(0, 10);
      if (dateRangeStart && empDate < dateRangeStart) return false;
      if (dateRangeEnd && empDate > dateRangeEnd) return false;
    }

    return true;
  });

  // Apply Column Sorting (Personel Bilgisi, Oda Konumu, Lojmana Kayıt Tarihi)
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (!sortField) return 0;

    if (sortField === 'name') {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB, 'tr') : nameB.localeCompare(nameA, 'tr');
    }

    if (sortField === 'room') {
      const bedA = a.beds && a.beds.length > 0 ? `${a.beds[0].room.block.name} ${a.beds[0].room.roomNumber}` : 'ZZZ';
      const bedB = b.beds && b.beds.length > 0 ? `${b.beds[0].room.block.name} ${b.beds[0].room.roomNumber}` : 'ZZZ';
      return sortOrder === 'asc' ? bedA.localeCompare(bedB, 'tr') : bedB.localeCompare(bedA, 'tr');
    }

    if (sortField === 'date') {
      const dateA = new Date(a.checkInDate || a.createdAt).getTime();
      const dateB = new Date(b.checkInDate || b.createdAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }

    return 0;
  });

  const departmentsList = [
    'ALL',
    'İnşaat / Saha',
    'İdari İşler',
    'Güvenlik',
    'Mutfak / Restoran',
    'Kat Hizmetleri / Temizlik',
    'Teknik Servis / Bakım',
    'Bilgi İşlem / IT',
    'Lojistik / Depo',
    'Diğer',
  ];

  // If a staff member is selected, render the Dedicated Full Page view!
  if (activeEmployeeDetail) {
    return (
      <EmployeeDetailView
        employee={activeEmployeeDetail}
        onBack={closeEmployeeDetail}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-300 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full lg:w-auto overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'ALL' ? 'bg-[#1e3a8a] text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Tüm Personeller ({filteredEmployees.length})
            </button>
            <button
              onClick={() => setStatusFilter('RESIDENT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'RESIDENT' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Lojmanda İkamet Edenler
            </button>
            <button
              onClick={() => setStatusFilter('PENDING_ASSIGNMENT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'PENDING_ASSIGNMENT' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Atama Bekleyenler
            </button>
          </div>

          {/* Search Box, Gender, Department, Single Hotel Date Range Picker & New Employee Button */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[180px] lg:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ad, Soyad, TC, Sicil, Plaka..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#1e3a8a] outline-none"
              />
            </div>

            {/* Cinsiyet Dropdown */}
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">Tüm Cinsiyetler</option>
              <option value="Male">Erkek</option>
              <option value="Female">Kadın</option>
            </select>

            {/* Departman Dropdown */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">Tüm Departmanlar</option>
              {departmentsList.filter(d => d !== 'ALL').map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Otel Rezervasyon Tarzı Tek Tık Date Range Picker */}
            <DateRangePicker
              startDate={dateRangeStart}
              endDate={dateRangeEnd}
              onChange={(start, end) => {
                setDateRangeStart(start);
                setDateRangeEnd(end);
              }}
            />

            {/* Temizle Butonu (Filtre aktifse) */}
            {(search || activeFilterCount > 0) && (
              <button
                type="button"
                onClick={resetAllFilters}
                title="Tüm Filtreleri Sıfırla"
                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sıfırla</span>
              </button>
            )}

            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={isExporting || isLoading}
              className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-800/50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>{isExporting ? 'Aktarılıyor...' : 'Excel Listesini İndir'}</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="py-2 px-4 bg-[#1e3a8a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ml-auto lg:ml-0"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Yeni Personel Kaydı</span>
            </button>
          </div>

        </div>
      </div>

      {/* High-Density Compact Table View */}
      {loadError ? (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-3 shadow-sm">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-900">{loadError}</p>
          <button type="button" onClick={fetchEmployees} className="py-2 px-4 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold">
            Yeniden Dene
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white border border-slate-300 rounded-3xl p-12 text-center text-slate-600 space-y-3 shadow-sm">
          <div className="w-8 h-8 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold">Personel kayıtları yükleniyor...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Personel Kaydı Bulunamadı</h3>
          <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto">
            Seçilen arama ve tarih filtreleme kriterlerinize uygun personel bulunamadı.
          </p>
          <button
            onClick={resetAllFilters}
            className="mt-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Filtreleri Temizle
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer select-none whitespace-nowrap"
                    >
                      <span>Personel Bilgisi</span>
                      {sortField === 'name' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-700 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-700 font-bold" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Departman / Unvan / Firma</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Kimlik & Sicil</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('room')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer select-none whitespace-nowrap"
                    >
                      <span>Lojman / Oda Konumu</span>
                      {sortField === 'room' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-700 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-700 font-bold" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSort('date')}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer select-none whitespace-nowrap"
                    >
                      <span>Kayıt Tarihi & Saati</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-700 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-700 font-bold" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap w-[110px]">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
                {sortedEmployees.map((emp) => {
                  const hasBed = emp.beds && emp.beds.length > 0;
                  const currentBed = hasBed ? emp.beds![0] : null;

                  return (
                    <tr 
                      key={emp.id}
                      onClick={() => openEmployeeDetail(emp)}
                      className="hover:bg-slate-100/80 transition-colors cursor-pointer"
                    >
                      {/* 1. Personel Avatar & Ad Soyad */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt={`${emp.firstName} ${emp.lastName}`} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-extrabold text-[#1e3a8a] text-xs">
                                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 whitespace-nowrap">
                              <span className="truncate max-w-[200px]" title={`${emp.firstName} ${emp.lastName}`}>{emp.firstName} {emp.lastName}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold shrink-0 ${
                                emp.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-teal-100 text-teal-800'
                              }`}>
                                {emp.gender === 'Male' ? 'Erkek' : 'Kadın'}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 mt-0.5 font-mono whitespace-nowrap">
                              <Phone className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                              <span>{formatPhone(emp.phone)}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Departman / Unvan / Şirket */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs truncate max-w-[220px]" title={emp.department}>{emp.department}</div>
                        <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                          <span className="truncate max-w-[150px]" title={emp.title || 'Unvan Belirtilmedi'}>{emp.title || 'Unvan Belirtilmedi'}</span>
                          {emp.company && (
                            <span className="text-slate-700 font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0 max-w-[120px] truncate" title={emp.company}>
                              {emp.company}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Kimlik & Sicil No */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1 whitespace-nowrap">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{emp.tcNoMasked || '-'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                          Sicil: <strong className="text-slate-800">{emp.registrationNo || '-'}</strong>
                        </div>
                      </td>

                      {/* 4. Lojman / Oda Konumu */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {currentBed ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-extrabold text-xs inline-flex items-center gap-1.5 whitespace-nowrap">
                            <BedDouble className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="truncate max-w-[240px]" title={`${currentBed.room.block.name} • Oda ${currentBed.room.roomNumber} (${currentBed.bedLabel})`}>
                              {currentBed.room.block.name} • Oda {currentBed.room.roomNumber} ({currentBed.bedLabel})
                            </span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-xs inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Atama Bekliyor</span>
                          </span>
                        )}
                      </td>

                      {/* 5. Ayrı Kolon: Lojmana Kayıt Tarihi & Saati */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-[#1e3a8a] shrink-0" />
                          <span>{formatDateTime(emp.checkInDate || emp.createdAt)}</span>
                        </div>
                      </td>

                      {/* 6. Aksiyonlar — tooltip açılır butonlar */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 min-h-[32px] whitespace-nowrap shrink-0">
                          {/* Personele Oda Ata / Odadan Çıkış Yap */}
                          {hasBed ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCheckoutConfirmModal({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` });
                              }}
                              title="Odadan Çıkış Yap"
                              className="group relative inline-flex items-center justify-center h-8 px-2.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200/80 hover:border-amber-600 transition-all duration-500 ease-out shadow-xs hover:shadow-md cursor-pointer overflow-hidden"
                            >
                              <DoorOpen className="w-4 h-4 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                              <span className="max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-xs font-extrabold whitespace-nowrap overflow-hidden">
                                Çıkış Yap
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignRoomEmployee(emp);
                              }}
                              title="Personele Oda Ata"
                              className="group relative inline-flex items-center justify-center h-8 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 hover:border-emerald-600 transition-all duration-500 ease-out shadow-xs hover:shadow-md cursor-pointer overflow-hidden"
                            >
                              <BedDouble className="w-4 h-4 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                              <span className="max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-xs font-extrabold whitespace-nowrap overflow-hidden">
                                Oda Ata
                              </span>
                            </button>
                          )}

                           {/* Sil */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`);
                            }}
                            title="Sil"
                            className="group relative inline-flex items-center justify-center h-8 px-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200/80 hover:border-rose-600 transition-all duration-500 ease-out shadow-xs hover:shadow-md cursor-pointer overflow-hidden"
                          >
                            <Trash2 className="w-4 h-4 shrink-0 transition-transform duration-500 group-hover:scale-110" />
                            <span className="max-w-0 opacity-0 group-hover:max-w-[40px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-xs font-extrabold whitespace-nowrap overflow-hidden">
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
        </div>
      )}

      {/* Add Employee Modal */}
      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
      />

      {/* Assign Room Modal */}
      <AssignRoomModal
        isOpen={!!assignRoomEmployee}
        onClose={() => setAssignRoomEmployee(null)}
        employee={assignRoomEmployee}
        onSuccess={() => {
          fetchEmployees();
        }}
      />

      {/* Delete Employee Confirmation Modal */}
      {deleteConfirmModal && (
        <div
          onClick={() => setDeleteConfirmModal(null)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Personel Kaydını Sil</h3>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                <strong className="text-slate-900">{deleteConfirmModal.name}</strong> isimli personelin kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={confirmDeleteEmployee}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-colors"
              >
                Evet, Personeli Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Export Modal */}
      <EmployeeExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportExcel}
        isExporting={isExporting}
      />

      {/* Checkout Employee Confirmation Modal */}
      {checkoutConfirmModal && (
        <div
          onClick={() => setCheckoutConfirmModal(null)}
          className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Odadan Çıkış Yap</h3>
              <p className="text-xs text-slate-600 font-semibold mt-1">
                <strong className="text-slate-900">{checkoutConfirmModal.name}</strong> isimli personeli odasından çıkarmak istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutConfirmModal(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = checkoutConfirmModal.id;
                  setCheckoutConfirmModal(null);
                  try {
                    const updatedEmp = await employeeApi.checkoutRoom(targetId);
                    setEmployees(prev => prev.map(p => p.id === targetId ? updatedEmp : p));
                  } catch (err: any) {
                    alert(err.message || 'Çıkış yapılırken bir hata oluştu.');
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
    </div>
  );
};
