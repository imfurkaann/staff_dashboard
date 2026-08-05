import React, { useEffect, useState } from 'react';
import { BedDouble, Calendar, RefreshCw, Users, UserPlus, Wrench } from 'lucide-react';
import { User } from '../api/authApi';
import { dashboardApi, DashboardSummary } from '../api/dashboardApi';

interface DashboardViewProps { currentUser: User; onNavigateTo: (tab: string) => void }

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, onNavigateTo }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError(null);
    try { setSummary(await dashboardApi.getSummary()); }
    catch { setError('Dashboard verileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const occupancy = summary?.totalBeds ? Math.round((summary.occupiedBeds / summary.totalBeds) * 100) : 0;
  const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-sm font-bold text-slate-600">Dashboard yükleniyor…</div>;
  if (error || !summary) return <div role="alert" className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center"><p className="font-bold text-rose-900">{error}</p><button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold"><RefreshCw className="inline w-4 h-4 mr-2"/>Yeniden dene</button></div>;

  const cards = [
    { label: 'Toplam personel', value: summary.totalEmployees, icon: Users, tab: 'employees' },
    { label: 'Lojmanda kalan', value: summary.residentEmployees, icon: Users, tab: 'employees' },
    { label: 'Atama bekleyen', value: summary.pendingEmployees, icon: UserPlus, tab: 'employees' },
    { label: 'Açık arıza', value: summary.openMaintenance, icon: Wrench, tab: 'issues' },
  ];

  return <div className="space-y-6">
    <header className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
      <div><p className="text-xs text-slate-500 font-semibold flex items-center gap-1"><Calendar className="w-4 h-4"/>{date}</p><h1 className="text-2xl font-extrabold text-slate-900 mt-1">Hoş geldiniz, {currentUser.fullName}</h1><p className="text-sm text-slate-600 mt-1">Lojmanın güncel operasyon özeti.</p></div>
      <button onClick={() => onNavigateTo('employees')} className="px-4 py-3 rounded-xl bg-[#1e3a8a] text-white text-sm font-bold flex items-center gap-2 cursor-pointer"><UserPlus className="w-4 h-4"/>Yeni personel</button>
    </header>
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Özet bilgiler">{cards.map(({ label, value, icon: Icon, tab }) => <div key={label} onClick={() => onNavigateTo(tab)} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm hover:border-[#1e3a8a] transition-all cursor-pointer group"><div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600 group-hover:text-[#1e3a8a] transition-colors">{label}</span><Icon className="w-5 h-5 text-[#1e3a8a]"/></div><p className="text-3xl font-black mt-3 text-slate-900">{value}</p></div>)}</section>
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm"><div className="flex justify-between"><h2 className="font-extrabold">Yatak doluluğu</h2><BedDouble className="w-5 h-5 text-[#1e3a8a]"/></div><p className="text-4xl font-black mt-4">%{occupancy}</p><div className="h-3 bg-slate-100 rounded-full mt-4 overflow-hidden"><div className="h-full bg-[#1e3a8a]" style={{ width: `${occupancy}%` }}/></div><p className="text-xs text-slate-600 mt-2">{summary.occupiedBeds} dolu · {summary.totalBeds - summary.occupiedBeds} boş · {summary.totalBeds} toplam</p></div>
      <div className="lg:col-span-2 bg-white border border-slate-300 rounded-3xl p-6 shadow-sm"><h2 className="font-extrabold mb-4">Blok bazlı doluluk</h2>{summary.blocks.length === 0 ? <p className="text-sm text-slate-500">Henüz blok ve yatak kaydı yok.</p> : <div className="space-y-4">{summary.blocks.map((block) => { const rate = block.totalBeds ? Math.round(block.occupiedBeds / block.totalBeds * 100) : 0; return <div key={block.id}><div className="flex justify-between text-sm font-bold"><span>{block.name}</span><span>{block.occupiedBeds}/{block.totalBeds} · %{rate}</span></div><div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-blue-700" style={{width:`${rate}%`}}/></div></div> })}</div>}</div>
    </section>
  </div>;
};
