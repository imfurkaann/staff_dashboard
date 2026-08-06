import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Users,
  PackageCheck,
  X,
  BedDouble,
  Boxes,
} from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';

export type ReportCategory = 'OCCUPANCY' | 'ROOM_INVENTORY';

interface RoomOccupancyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (category: ReportCategory, filter: string, startDate?: string, endDate?: string) => void;
  isExporting: boolean;
}

export const RoomOccupancyExportModal: React.FC<RoomOccupancyExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  isExporting,
}) => {
  const [reportCategory, setReportCategory] = useState<ReportCategory>('OCCUPANCY');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('ACTIVE');
  const [inventoryFilter, setInventoryFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filter = reportCategory === 'OCCUPANCY' ? occupancyFilter : inventoryFilter;
    onExport(reportCategory, filter, startDate || undefined, endDate || undefined);
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
              <h3 className="text-base font-extrabold text-white">Oda & Demirbaş Excel Raporu İndir</h3>
              <p className="text-xs font-semibold text-blue-200">
                Lütfen rapor türünü ve indirmek istediğiniz alt filtre kriterlerini seçiniz.
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

        {/* Category Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setReportCategory('OCCUPANCY')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              reportCategory === 'OCCUPANCY'
                ? 'bg-[#1e3a8a] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>1. Konaklayanlar Listesi</span>
          </button>

          <button
            type="button"
            onClick={() => setReportCategory('ROOM_INVENTORY')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              reportCategory === 'ROOM_INVENTORY'
                ? 'bg-[#1e3a8a] text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>2. Oda Demirbaş & Zimmetleri</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* CATEGORY A: KONAKLAYANLAR LİSTESİ */}
          {reportCategory === 'OCCUPANCY' && (
            <div className="space-y-4 animate-fadeIn">
              <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
                Konaklama İkamet Durumu Kriteri
                <span className="relative block mt-1">
                  <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={occupancyFilter}
                    onChange={(e) => setOccupancyFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
                  >
                    <option value="ACTIVE">Sadece Halen Odada Konaklayanlar (Aktif İkamet Edenler)</option>
                    <option value="CHECKED_OUT">Sadece Odadan Çıkış Yapmış Olanlar (Geçmiş Konaklayanlar)</option>
                    <option value="ALL">Tüm Konaklama Geçmişi (Aktif Kalmaya Devam Edenler & Çıkış Yapanlar)</option>
                  </select>
                </span>
              </label>

              {/* Tarih Aralığı Seçimi (Ortak DateRangePicker Komponenti) */}
              <div className="space-y-1.5 border-t border-slate-200 pt-3">
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Konaklama Tarih Aralığı (Geçmiş / Aktif Dönem)
                </label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  fullWidth={true}
                  placeholder="Geçmiş / Aktif Konaklama Dönemi Seçin"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-[11px] font-semibold text-[#1e3a8a] flex items-start gap-2">
                <Users className="w-4 h-4 shrink-0 mt-0.5 text-[#1e3a8a]" />
                <p>
                  Tarih aralığı seçildiğinde, belirtilen tarihler arasında odalarda ikamet etmiş veya aktif konaklayan tüm personeller tarih çakışması bazında Excel belgesine aktarılır.
                </p>
              </div>
            </div>
          )}

          {/* CATEGORY B: ODA DEMİRBAŞ & ZİMMETLERİ */}
          {reportCategory === 'ROOM_INVENTORY' && (
            <div className="space-y-4 animate-fadeIn">
              <label className="block space-y-1.5 text-xs font-extrabold text-slate-700">
                Oda Demirbaş / Eşya Durum Kriteri
                <span className="relative block mt-1">
                  <PackageCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={inventoryFilter}
                    onChange={(e) => setInventoryFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold appearance-none cursor-pointer text-slate-900"
                  >
                    <option value="ALL">Tüm Oda Demirbaşları (Tüm Bloklar & Odalar)</option>
                    <option value="PROBLEMATIC_ALL">Tüm Sorunlu Demirbaşlar (Bakım, Hasarlı, Kayıp, Serviste vb.)</option>
                    <option value="HEALTHY">Sadece Sağlam & Çalışır Demirbaşlar</option>
                    <option value="MAINTENANCE_REQUIRED">Sadece Arızalı / Bakım Bekleyenler</option>
                    <option value="DAMAGED">Sadece Kırık / Hasarlı Demirbaşlar</option>
                    <option value="LOST">Sadece Kayıp / Zayi Olanlar</option>
                    <option value="IN_SERVICE">Sadece Tamirde / Servistekiler</option>
                    <option value="REPLACEMENT_REQUIRED">Sadece Değişim Bekleyenler</option>
                    <option value="RETIRED">Sadece İade Edilen / Düşümü Yapılanlar</option>
                  </select>
                </span>
              </label>

              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl text-[11px] font-semibold text-purple-900 flex items-start gap-2">
                <Boxes className="w-4 h-4 shrink-0 mt-0.5 text-purple-700" />
                <p>
                  Bu raporda odaların kendi bünyesinde bulunan sabit demirbaş ve eşyalar (TV, Klima, Baza vb.) listelenir. Personelin yanında getirdiği şahsi mülkler dahil değildir.
                </p>
              </div>
            </div>
          )}

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
