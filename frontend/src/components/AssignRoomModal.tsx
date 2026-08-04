import React, { useEffect, useState } from 'react';
import {
  BedDouble,
  Building2,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { employeeApi, Bed, Employee } from '../api/employeeApi';

interface AssignRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSuccess: () => void;
}

export const AssignRoomModal: React.FC<AssignRoomModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
}) => {
  const [availableBeds, setAvailableBeds] = useState<Bed[]>([]);
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [loadingBeds, setLoadingBeds] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employee) {
      fetchBeds();
    } else {
      setSelectedBedId('');
      setError(null);
    }
  }, [isOpen, employee]);

  const fetchBeds = async () => {
    setLoadingBeds(true);
    setError(null);
    try {
      const beds = await employeeApi.getAvailableBeds(employee?.gender);
      setAvailableBeds(beds);

      if (beds.length > 0) {
        setSelectedBedId(beds[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch available beds:', err);
      setError(err?.message || 'Müsait yatak listesi alınamadı.');
    } finally {
      setLoadingBeds(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !selectedBedId) {
      alert('Lütfen bir yatak seçiniz.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await employeeApi.updateEmployee(employee.id, {
        bedId: selectedBedId,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to assign bed:', err);
      setError(err?.message || 'Personele oda atanırken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn no-print"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900 animate-in fade-in zoom-in duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Personele Oda & Yatak Ata</h3>
              <p className="text-xs text-slate-500">Müsait lojman odasına yerleşim yapın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Employee Info Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {employee.firstName.charAt(0)}
              {employee.lastName.charAt(0)}
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">
                {employee.firstName} {employee.lastName}
              </h4>
              <p className="text-[11px] font-semibold text-slate-500">{employee.department}</p>
            </div>
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
              employee.gender === 'Male'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-teal-50 text-teal-800 border border-teal-200'
            }`}
          >
            {employee.gender === 'Male' ? 'Erkek' : 'Kadın'}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Müsait Oda & Yatak Seçimi *
            </label>

            {loadingBeds ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#1e3a8a] animate-spin mb-2" />
                <span className="text-xs font-bold">Müsait yataklar yükleniyor...</span>
              </div>
            ) : availableBeds.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center text-amber-900 text-xs font-semibold space-y-1">
                <p className="font-bold">Müsait Boş Yatak Bulunamadı!</p>
                <p className="text-[11px] text-amber-700">
                  Lütfen önce Odalar sayfasından uygun bir oda/yatak ekleyin veya mevcut odaları boşaltın.
                </p>
              </div>
            ) : (
              <select
                value={selectedBedId}
                onChange={(e) => setSelectedBedId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors cursor-pointer"
              >
                {availableBeds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.room.block.name} • Oda {bed.room.roomNumber} ({bed.room.floor}. Kat) - {bed.bedLabel}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting || availableBeds.length === 0}
              className="py-2 px-4 bg-[#1e3a8a] hover:bg-blue-900 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>Oda Atamasını Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
