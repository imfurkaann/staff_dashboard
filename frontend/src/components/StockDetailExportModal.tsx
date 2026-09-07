import React, { useState } from 'react';
import { AlertTriangle, Building2, ClipboardCheck, FileSpreadsheet, History, Package, X } from 'lucide-react';
import { StockDetailExportSection } from '../api/stockApi';

type ExportScope = 'stock' | 'device';

interface StockDetailExportModalProps {
  scope: ExportScope;
  title: string;
  isExporting: boolean;
  exportError?: string;
  onClose: () => void;
  onExport: (sections: StockDetailExportSection[]) => void;
}

const stockOptions: Array<{ value: StockDetailExportSection; label: string; description: string; icon: React.ElementType }> = [
  { value: 'summary', label: 'Stok Özeti', description: 'Stok kartı bilgileri, toplam ve elde kalan miktar.', icon: Package },
  { value: 'rooms', label: 'Oda Dağılımı', description: 'Ürünün bulunduğu odalar, cihaz adları ve veriliş tarihleri.', icon: Building2 },
  { value: 'coverage', label: 'Eksik Odalar', description: 'Tanımlı oda standardına göre eksik miktarlar.', icon: ClipboardCheck },
  { value: 'faults', label: 'Arıza Kayıtları', description: 'Ürüne bağlı açık ve kapanmış arıza kayıtları.', icon: AlertTriangle },
  { value: 'movements', label: 'Stok Hareketleri', description: 'Depo girişleri, atamalar, transferler ve durum hareketleri.', icon: History },
];

const deviceOptions: Array<{ value: StockDetailExportSection; label: string; description: string; icon: React.ElementType }> = [
  { value: 'summary', label: 'Cihaz Bilgileri', description: 'Seçilen cihazın adı, odası, durumu ve odaya veriliş tarihi.', icon: Package },
  { value: 'faults', label: 'Arıza Kayıtları', description: 'Yalnızca seçilen cihaza ait açık ve kapanmış arıza kayıtları.', icon: AlertTriangle },
  { value: 'movements', label: 'Cihaz Hareketleri', description: 'Yalnızca seçilen cihazın atama, transfer ve durum geçmişi.', icon: History },
];

export const StockDetailExportModal: React.FC<StockDetailExportModalProps> = ({ scope, title, isExporting, exportError, onClose, onExport }) => {
  const options = scope === 'device' ? deviceOptions : stockOptions;
  const [selected, setSelected] = useState<StockDetailExportSection[]>([]);
  const [selectionError, setSelectionError] = useState('');

  const toggle = (value: StockDetailExportSection) => {
    setSelectionError('');
    setSelected((current) => current.includes(value) ? current.filter((section) => section !== value) : [...current, value]);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) {
      setSelectionError('Excel raporu için en az bir bölüm seçin.');
      return;
    }
    onExport(options.map((option) => option.value).filter((value) => selected.includes(value)));
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn" onMouseDown={isExporting ? undefined : onClose}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-slate-900 via-[#1e3a8a] to-slate-900 p-5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10"><FileSpreadsheet className="h-5 w-5" /></span>
            <div className="min-w-0"><h3 className="text-base font-extrabold">Excel Raporu Oluştur</h3><p className="truncate text-xs font-semibold text-blue-200">{title}</p></div>
          </div>
          <button type="button" disabled={isExporting} onClick={onClose} className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 overflow-y-auto p-6">
          <div><h4 className="text-sm font-black text-slate-900">Excel’de bulunacak bölümleri seçin</h4><p className="mt-1 text-[11px] font-semibold text-slate-500">Her seçim aynı Excel dosyasında ayrı bir çalışma sayfası olarak hazırlanır.</p></div>
          <div className="space-y-2">
            {options.map(({ value, label, description, icon: Icon }) => {
              const checked = selected.includes(value);
              return <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${checked ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(value)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#1e3a8a]" />
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${checked ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-500'}`}><Icon className="h-4 w-4" /></span>
                <span><span className="block text-xs font-black text-slate-900">{label}</span><span className="mt-0.5 block text-[11px] font-semibold leading-4 text-slate-500">{description}</span></span>
              </label>;
            })}
          </div>
          {selectionError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{selectionError}</p>}
          {exportError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{exportError}</p>}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] font-semibold text-[#1e3a8a]">
            {selected.length === 0 ? 'Henüz bölüm seçilmedi.' : `${selected.length} çalışma sayfası tek Excel dosyasında oluşturulacak.`}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" disabled={isExporting} onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">Vazgeç</button>
            <button type="submit" disabled={isExporting || selected.length === 0} className="flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#172554] disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />{isExporting ? 'Excel Hazırlanıyor...' : 'Excel Raporunu İndir'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
