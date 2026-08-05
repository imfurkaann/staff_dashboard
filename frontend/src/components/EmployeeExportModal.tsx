import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Users,
  X,
} from 'lucide-react';

interface EmployeeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (status: string) => void;
  isExporting: boolean;
}

export const EmployeeExportModal: React.FC<EmployeeExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(selectedStatus);
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="bg-white border border-slate-300 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#1e3a8a] to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-white">Excel Raporu İndir</h3>
              <p className="text-xs font-semibold text-blue-200">
                Çıktıda yer alacak ikamet durum kriterlerini belirleyin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Lojman Durumu Seçimi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Lojman İkamet Durumu Kriteri
            <span className="relative block mt-1">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="ALL">Tüm Personeller (Lojmanda Kalanlar & Ayrılanlar & Atama Bekleyenler)</option>
                <option value="RESIDENT">Sadece Lojmanda Kalanlar (Aktif Giriş Yapanlar)</option>
                <option value="CHECKED_OUT">Sadece Lojmandan Ayrılanlar (Çıkış Yapanlar)</option>
                <option value="PENDING_ASSIGNMENT">Sadece Oda / Yatak Ataması Bekleyenler</option>
              </select>
            </span>
          </label>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-[11px] font-semibold text-[#1e3a8a] flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Oluşturulacak Excel belgesinde her bir veri alanı ayrı kolonlarda listelenecektir. Tarih ve saat verileri de analiz kolaylığı için ayrı kolonlara bölünmüştür.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-md disabled:bg-[#1e3a8a]/50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Dosya Hazırlanıyor...' : 'Excel Listesini İndir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
