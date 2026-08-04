import React, { useState } from 'react';
import { 
  X, 
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
  Eye,
  EyeOff,
  PackageCheck
} from 'lucide-react';
import { Employee } from '../api/employeeApi';
import { decryptSensitiveData } from '../utils/cryptoHelpers';

interface EmployeeDetailModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  employee,
  isOpen,
  onClose,
}) => {
  const [showFullTc, setShowFullTc] = useState(false);

  if (!isOpen || !employee) return null;

  const currentBed = employee.beds && employee.beds.length > 0 ? employee.beds[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp my-auto">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Personel Detay Kartı</h2>
              <p className="text-xs font-semibold text-slate-500">Kimlik, lojman oda konumu ve acil durum sicil dosyası.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {/* Profile Summary Card */}
          <div className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt={`${employee.firstName} ${employee.lastName}`} className="w-full h-full object-cover" />
              ) : (
                <span className="font-black text-2xl text-[#60a5fa]">
                  {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                </span>
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl font-black text-white">
                  {employee.firstName} {employee.lastName}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                  employee.gender === 'Male' ? 'bg-blue-900/80 text-blue-200 border border-blue-700' : 'bg-teal-900/80 text-teal-200 border border-teal-700'
                }`}>
                  {employee.gender === 'Male' ? 'Erkek' : 'Kadın'}
                </span>
              </div>

              <p className="text-xs font-bold text-blue-300">
                {employee.department} {employee.title ? `• ${employee.title}` : ''}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-medium text-slate-300 pt-1">
                {employee.company && (
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 font-bold text-slate-200">
                    {employee.company}
                  </span>
                )}
                {employee.registrationNo && (
                  <span className="text-slate-400">Sicil No: <strong className="text-white">{employee.registrationNo}</strong></span>
                )}
              </div>
            </div>

            {/* Resident Status Badge */}
            <div className="shrink-0 text-center sm:text-right">
              {employee.status === 'RESIDENT' ? (
                <span className="px-3 py-1.5 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Lojmanda İkamet Ediyor
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-2xl bg-amber-950 border border-amber-700 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md">
                  <Clock className="w-4 h-4 text-amber-400" /> Atama Bekliyor
                </span>
              )}
            </div>
          </div>

          {/* Grid Section 1: Lojman & Oda Konumu */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-emerald-700" />
              <span>Lojman Oda & Yatak Tahsis Durumu</span>
            </h3>

            {currentBed ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm text-xs font-semibold text-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold block">Lojman Bloğu</span>
                  <strong className="text-sm text-emerald-950 font-extrabold">{currentBed.room.block.name}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold block">Oda & Kat Numarası</span>
                  <strong className="text-sm text-slate-900 font-extrabold">Oda {currentBed.room.roomNumber} (Kat {currentBed.room.floor})</strong>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-bold block">Tahsis Edilen Yatak</span>
                  <strong className="text-sm text-[#1e3a8a] font-extrabold">{currentBed.bedLabel}</strong>
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

          {/* Grid Section 2: Oda Arkadaşı Uyum Kriterleri */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
            <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" />
              <span>Oda Arkadaşı Uyum Profili</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Sigara */}
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
                employee.isSmoker ? 'bg-amber-100/60 border-amber-300 text-amber-950' : 'bg-emerald-100/60 border-emerald-300 text-emerald-950'
              }`}>
                {employee.isSmoker ? <Cigarette className="w-4 h-4 text-amber-700" /> : <CigaretteOff className="w-4 h-4 text-emerald-700" />}
                <div>
                  <span className="text-[10px] text-slate-500 block font-bold">Sigara Kullanımı</span>
                  <span>{employee.isSmoker ? 'Sigara İçiyor (Sigaralı Oda)' : 'Sigara İçmiyor (Sigarasız Oda)'}</span>
                </div>
              </div>

              {/* Horlama */}
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 ${
                employee.hasSnoring ? 'bg-purple-100/60 border-purple-300 text-purple-950' : 'bg-blue-100/60 border-blue-300 text-blue-950'
              }`}>
                {employee.hasSnoring ? <Volume2 className="w-4 h-4 text-purple-700" /> : <VolumeX className="w-4 h-4 text-blue-700" />}
                <div>
                  <span className="text-[10px] text-slate-500 block font-bold">Uyku / Horlama</span>
                  <span>{employee.hasSnoring ? 'Horlama Var' : 'Horlama Yok'}</span>
                </div>
              </div>

              {/* Vardiya Tipi */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#1e3a8a]" />
                <div>
                  <span className="text-[10px] text-slate-500 block font-bold">Vardiya Düzeni</span>
                  <span>{employee.shiftType || 'Gündüz Vardiyası'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Section 3: İletişim, Kimlik & Güvenlik */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Kimlik & İletişim Detayları */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1e3a8a]" />
                <span>Kimlik & İletişim Bilgileri</span>
              </h3>

              <div className="space-y-2 text-xs font-semibold text-slate-800">
                {/* TC No */}
                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold">TC Kimlik No</span>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">
                      {showFullTc ? (employee.tcNo || 'Belirtilmedi') : (employee.tcNoMasked || 'Belirtilmedi')}
                    </span>
                    {employee.tcNo && (
                      <button
                        type="button"
                        onClick={() => setShowFullTc(!showFullTc)}
                        className="text-slate-400 hover:text-[#1e3a8a] transition-colors"
                      >
                        {showFullTc ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Telefon */}
                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold">Telefon Numarası</span>
                  <span className="font-extrabold text-[#1e3a8a] flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {employee.phone || 'Belirtilmedi'}
                  </span>
                </div>

                {/* Araç Plakası */}
                <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold">Otopark Araç Plakası</span>
                  <span className="font-extrabold text-slate-900 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-[#1e3a8a]" /> {employee.vehiclePlate || 'Araç Yok'}
                  </span>
                </div>
              </div>
            </div>

            {/* Acil Durum İletişim Yakını */}
            <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200 space-y-3">
              <h3 className="text-xs font-extrabold text-red-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>Acil Durum İletişim Yakını</span>
              </h3>

              {employee.emergencyContactName ? (
                <div className="space-y-2 text-xs font-semibold text-slate-800">
                  <div className="bg-white p-2.5 rounded-xl border border-red-200 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold block">Yakınının Adı & Soyadı</span>
                    <strong className="text-sm text-slate-900 font-extrabold">{employee.emergencyContactName}</strong>
                  </div>
                  <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-200">
                    <span className="text-slate-500 font-bold">Yakınlık Derecesi</span>
                    <span className="font-extrabold text-slate-900">{employee.emergencyRelation || 'Yakını'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-200">
                    <span className="text-slate-500 font-bold">Telefon Numarası</span>
                    <span className="font-extrabold text-red-700 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {employee.emergencyContactPhone || '-'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white rounded-xl border border-red-200 text-xs font-semibold text-slate-500">
                  Acil durum yakını bilgisi henüz girilmemiş.
                </div>
              )}
            </div>

          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-6 bg-[#1e3a8a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Kapat
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
