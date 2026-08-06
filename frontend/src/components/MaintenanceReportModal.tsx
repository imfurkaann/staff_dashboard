import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Wrench,
  X,
} from 'lucide-react';
import { MaintenancePriority, MaintenanceStatus } from '../api/maintenanceApi';
import { BlockSummary } from '../api/roomApi';
import { DateRangePicker } from './DateRangePicker';

export interface MaintenanceReportCriteria {
  status: MaintenanceStatus | 'ALL';
  priority: MaintenancePriority | 'ALL';
  category: string;
  blockId: string;
  dateStart: string;
  dateEnd: string;
}

interface MaintenanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  blocks: BlockSummary[];
  onGenerateReport: (criteria: MaintenanceReportCriteria) => void;
  isExporting?: boolean;
}

const categoryOptions = [
  'Elektrik & Aydınlatma',
  'Su & Tesisat',
  'İklimlendirme & Klima',
  'Mobilya & Ahşap',
  'Beyaz Eşya & Elektronik',
  'Kapı, Pencere & Kilit',
  'Temizlik & Hijyen',
  'Genel Bakım & Onarım',
];

export const MaintenanceReportModal: React.FC<MaintenanceReportModalProps> = ({
  isOpen,
  onClose,
  blocks,
  onGenerateReport,
  isExporting = false,
}) => {
  const [status, setStatus] = useState<MaintenanceStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<MaintenancePriority | 'ALL'>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [blockId, setBlockId] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerateReport({
      status,
      priority,
      category,
      blockId,
      dateStart,
      dateEnd,
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
              <h3 className="text-base font-extrabold text-white">Arıza Excel Raporu İndir</h3>
              <p className="text-xs font-semibold text-blue-200">
                Seçtiğiniz kriterlere göre filtrelenmiş kurumsal Excel dökümü alın.
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
          {/* Arıza Durum Filtresi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Arıza Durum Kriteri
            <span className="relative block mt-1">
              <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaintenanceStatus | 'ALL')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="ALL">Tüm Arızalar (Açık, İşlemde, Çözülen)</option>
                <option value="OPEN">Sadece Açık Arızalar</option>
                <option value="IN_PROGRESS">Sadece İşlemdeki Arızalar</option>
                <option value="RESOLVED">Sadece Çözülen Arızalar</option>
                <option value="CLOSED">Sadece Kapalı Arızalar</option>
              </select>
            </span>
          </label>

          {/* Kategori Filtresi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Arıza Kategorisi
            <span className="relative block mt-1">
              <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="ALL">Tüm Kategoriler</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {/* Öncelik Seviyesi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Öncelik Seviyesi
            <span className="relative block mt-1">
              <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MaintenancePriority | 'ALL')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="ALL">Tüm Öncelikler</option>
                <option value="URGENT">🔴 ACİL Öncelikli Arızalar</option>
                <option value="HIGH">🟠 Yüksek Öncelikli Arızalar</option>
                <option value="MEDIUM">🟡 Orta Öncelikli Arızalar</option>
                <option value="LOW">🟢 Düşük Öncelikli Arızalar</option>
              </select>
            </span>
          </label>

          {/* Blok Seçimi */}
          <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
            Blok Kriteri
            <span className="relative block mt-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
              >
                <option value="">Tüm Bloklar</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {/* Tarih Aralığı */}
          <div className="space-y-1.5 text-xs font-extrabold text-slate-700">
            <label className="block">Kayıt Tarih Aralığı (Opsiyonel)</label>
            <DateRangePicker
              startDate={dateStart}
              endDate={dateEnd}
              onChange={(start, end) => {
                setDateStart(start);
                setDateEnd(end);
              }}
              fullWidth
              placeholder="Tarih aralığı seçin (Tümü için boş bırakın)"
            />
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-[11px] font-semibold text-[#1e3a8a] flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Belirlediğiniz kriterlere uyan tüm teknik arıza ve bakım kayıtları kurumsal şablon formatında Excel belgesine aktarılacaktır.
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
              <span>{isExporting ? 'Excel Hazırlanıyor...' : 'Excel Listesini İndir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
