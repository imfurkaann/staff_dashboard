import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Users,
  X,
} from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';

export interface VisitorExportFilter {
  status: string;
  startDate?: string;
  endDate?: string;
}

interface VisitorExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (filter: VisitorExportFilter) => void;
  isExporting: boolean;
}

export const VisitorExportModal: React.FC<VisitorExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport({
      status: selectedStatus,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
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
              <h3 className="text-base font-extrabold text-white">Ziyaretçi Excel Raporu İndir</h3>
              <p className="text-xs font-semibold text-blue-200">
                Kayıt durum kuralı ve tarih aralığı seçerek Excel dökümü alın.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Ziyaretçi Durumu Seçimi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Ziyaretçi Kayıt Durumu Kriteri
            <span className="relative block mt-1">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="ALL">Tüm Ziyaretçiler (İçeridekiler & Çıkış Yapanlar)</option>
                <option value="INSIDE">Sadece Halen İçeride Olan Ziyaretçiler</option>
                <option value="EXITED">Sadece Çıkış Yapmış Geçmiş Ziyaretçiler</option>
                <option value="DELETED">Sadece Silinen / Arşivlenen Ziyaretçiler</option>
              </select>
            </span>
          </label>

          {/* Tarih Aralığı Seçimi (Ortak DateRangePicker Komponenti) */}
          <div className="space-y-1.5 border-t border-slate-200 pt-4">
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Ziyaret Giriş / Çıkış Tarih Aralığı (Opsiyonel)
            </label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
              fullWidth={true}
              placeholder="Ziyaret Tarih Aralığı Seçin"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-[11px] font-semibold text-[#1e3a8a] flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Tarih aralığı seçildiğinde, belirtilen tarihler arasında tesise giriş yapmış veya çıkış yapmış tüm ziyaretçi kayıtları kurumsal formatta Excel'e aktarılır.
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
              <span>{isExporting ? 'Rapor Hazırlanıyor...' : 'Excel Listesini İndir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
