import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BedDouble, Bell,
  Boxes, Building2, CalendarDays, CheckCircle2, Clock3, DoorOpen, LogIn,
  MessageSquareWarning, RefreshCw, Sparkles, SprayCan, UserCheck, UserPlus, Users, Wrench,
} from 'lucide-react';
import { User } from '../api/authApi';
import { dashboardApi, DashboardSummary } from '../api/dashboardApi';
import { canAccessTab } from '../security/accessControl';

interface DashboardViewProps { currentUser: User; onNavigateTo: (tab: string) => void }
type IconType = typeof Users;

const trDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', ...options }).format(new Date(value));

const statusLabel: Record<string, string> = {
  OPEN: 'Açık', IN_PROGRESS: 'İşlemde', RESOLVED: 'Çözüldü', CLOSED: 'Kapalı',
  REJECTED: 'Reddedildi', NEEDS_CLEANING: 'Temizlik bekliyor', OUT_OF_ORDER: 'Kullanım dışı',
};

const PanelHeader = ({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2 className="text-[15px] font-black text-slate-900">{title}</h2>
      {note && <p className="mt-0.5 text-[11px] font-medium text-slate-500">{note}</p>}
    </div>
    {action}
  </div>
);

const MetricCard = ({ label, value, note, icon: Icon, color, onClick }: {
  label: string; value: string | number; note: string; icon: IconType; color: string; onClick: () => void;
}) => (
  <button onClick={onClick} className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">{note}</p>
      </div>
      <span className={`rounded-xl p-2.5 ${color}`}><Icon className="h-5 w-5"/></span>
    </div>
  </button>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, onNavigateTo }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try { setSummary(await dashboardApi.getSummary()); }
    catch { setError('Dashboard verileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const occupancyRate = summary?.occupancy.totalBeds
    ? Math.round(summary.occupancy.occupiedBeds / summary.occupancy.totalBeds * 100) : 0;
  const maxActivity = useMemo(() => Math.max(1, ...(summary?.activity || []).map((day) =>
    day.occupancy + day.maintenance + day.visitors + day.tickets)), [summary?.activity]);

  if (loading) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-bold text-slate-600">
      <RefreshCw className="mb-3 h-6 w-6 animate-spin text-blue-800"/>Güncel lojman bilgileri hazırlanıyor…
    </div>
  );
  if (error || !summary) return (
    <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
      <p className="font-bold text-rose-900">{error}</p>
      <button onClick={load} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">
        <RefreshCw className="mr-2 inline h-4 w-4"/>Yeniden dene
      </button>
    </div>
  );

  const go = (tab: string) => { if (canAccessTab(currentUser.role, tab)) onNavigateTo(tab); };
  const hour = Number(new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }).format(new Date()));
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const tasks = [
    summary.maintenance?.urgent ? { title: 'Acil arızalara müdahale edin', detail: `${summary.maintenance.urgent} acil kayıt bekliyor`, count: summary.maintenance.urgent, tab: 'issues', tone: 'rose', icon: Wrench } : null,
    summary.visitors?.overdue ? { title: 'Geciken ziyaretçi çıkışları', detail: '24 saati aşan kayıtları kapatın', count: summary.visitors.overdue, tab: 'visitors', tone: 'amber', icon: UserCheck } : null,
    summary.sharedAssets?.overdue ? { title: 'Süresi geçen ortak eşyalar', detail: 'Teslim durumlarını kontrol edin', count: summary.sharedAssets.overdue, tab: 'shared-assets', tone: 'amber', icon: Boxes } : null,
    summary.employees?.pending ? { title: 'Oda ataması bekleyen personel', detail: 'Uygun boş yatağa yerleştirin', count: summary.employees.pending, tab: 'employees', tone: 'blue', icon: UserPlus } : null,
    summary.tickets?.open ? { title: 'Yeni talep ve şikâyetler', detail: `${summary.tickets.inProgress} kayıt işlemde`, count: summary.tickets.open, tab: 'tickets', tone: 'slate', icon: MessageSquareWarning } : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; count: number; tab: string; tone: string; icon: IconType }>;

  const quickActions = [
    { tab: 'employees', label: 'Personel ekle / yerleştir', icon: UserPlus },
    { tab: 'rooms', label: 'Oda işlemleri', icon: BedDouble },
    { tab: 'visitors', label: 'Ziyaretçi girişi', icon: LogIn },
    { tab: 'issues', label: 'Arıza bildir', icon: Wrench },
    { tab: 'shared-assets', label: 'Ortak eşya ver / al', icon: Boxes },
    { tab: 'notifications', label: 'Duyuru yayınla', icon: Bell },
  ].filter((item) => canAccessTab(currentUser.role, item.tab));

  const dashboardCards = [
    { label: 'Lojman Doluluğu', value: `%${occupancyRate}`, note: `${summary.occupancy.availableBeds} boş yatak mevcut`, icon: BedDouble, color: 'bg-blue-50 text-blue-700', tab: 'rooms' },
    { label: 'Bugünkü Yerleşim', value: summary.occupancy.checkInsToday, note: `${summary.occupancy.checkOutsToday} personel çıkış yaptı`, icon: Users, color: 'bg-violet-50 text-violet-700', tab: canAccessTab(currentUser.role, 'employees') ? 'employees' : 'rooms' },
    { label: 'Toplam Oda', value: summary.rooms.total, note: `${summary.rooms.ready} oda kullanıma hazır`, icon: DoorOpen, color: 'bg-emerald-50 text-emerald-700', tab: 'rooms' },
    summary.employees
      ? { label: 'Kayıtlı Personel', value: summary.employees.total, note: `${summary.employees.resident} kişi lojmanda kalıyor`, icon: UserCheck, color: 'bg-cyan-50 text-cyan-700', tab: 'employees' }
      : summary.sharedAssets
        ? { label: 'Ortak Eşya', value: summary.sharedAssets.total, note: `${summary.sharedAssets.available} cihaz müsait`, icon: Boxes, color: 'bg-cyan-50 text-cyan-700', tab: 'shared-assets' }
        : null,
  ].filter(Boolean) as Array<{ label: string; value: string | number; note: string; icon: IconType; color: string; tab: string }>;

  return <div className="space-y-5 pb-8">
    <header className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <CalendarDays className="h-4 w-4 text-blue-700"/>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">{greeting}, {currentUser.fullName.split(' ')[0]}</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">Bugün takip etmeniz gereken lojman işleri aşağıda sıralandı.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-right text-[10px] font-semibold text-slate-400 sm:block">
            Son güncelleme<br/><b className="text-slate-600">{trDate(summary.generatedAt, { hour: '2-digit', minute: '2-digit' })}</b>
          </span>
          <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-50">
            <RefreshCw className="h-4 w-4"/>Yenile
          </button>
        </div>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Günün özeti">
      {dashboardCards.map((card) => <MetricCard key={card.label} {...card} onClick={() => go(card.tab)}/>)}
    </section>

    <section className="grid gap-5 xl:grid-cols-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <PanelHeader title="Öncelikli İşler" note="Önem sırasına göre tamamlanması gereken işlemler"/>
        {tasks.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600"/>
            <p className="text-sm font-black text-emerald-900">Şu anda bekleyen kritik iş yok</p>
            <p className="mt-1 text-[11px] font-semibold text-emerald-700">Lojman operasyonları normal görünüyor.</p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {tasks.map(({ title, detail, count, tab, tone, icon: Icon }) => (
              <button key={title} onClick={() => go(tab)} className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50">
                <span className={`rounded-xl p-2.5 ${tone === 'rose' ? 'bg-rose-100 text-rose-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}><Icon className="h-4 w-4"/></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-900">{title}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{detail}</p></div>
                <span className="min-w-7 rounded-lg bg-white px-2 py-1 text-center text-xs font-black text-slate-900 shadow-sm">{count}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-700"/>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <PanelHeader title="Hızlı İşlemler" note="Günlük işlemlere tek tıkla başlayın"/>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(({ tab, label, icon: Icon }) => (
            <button key={tab} onClick={() => go(tab)} className="flex min-h-20 flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50">
              <Icon className="h-4 w-4 text-blue-800"/><span className="mt-3 text-[11px] font-black leading-tight text-slate-800">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
        <PanelHeader title="Oda ve Blok Durumu" note="Hangi blokta ne kadar boş kapasite var?"/>
        <div className="space-y-4">
          {summary.blocks.map((block) => {
            const rate = block.totalBeds ? Math.round(block.occupiedBeds / block.totalBeds * 100) : 0;
            return <button key={block.id} onClick={() => go('rooms')} className="w-full text-left">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black text-slate-800"><Building2 className="h-3.5 w-3.5 text-blue-700"/>{block.name}</span>
                <span className="text-[10px] font-bold text-slate-500">{block.occupiedBeds} dolu · {Math.max(0, block.totalBeds - block.occupiedBeds)} boş · %{rate}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500" style={{ width: `${rate}%` }}/></div>
            </button>;
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <PanelHeader title="Kontrol Gereken Odalar" note="Temizlik veya teknik işlem bekleyen odalar" action={<button onClick={() => go('rooms')} className="text-[10px] font-black text-blue-800">Tüm odalar →</button>}/>
        {summary.rooms.attention.length === 0 ? <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Tüm odalar hazır durumda.</div> : (
          <div className="space-y-2">{summary.rooms.attention.map((room) => (
            <button key={room.id} onClick={() => go('rooms')} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
              <span className={`h-2.5 w-2.5 rounded-full ${room.status === 'OUT_OF_ORDER' ? 'bg-rose-500' : 'bg-amber-500'}`}/>
              <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-800">{room.roomLabel}</span>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${room.status === 'OUT_OF_ORDER' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabel[room.status]}</span>
            </button>
          ))}</div>
        )}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.visitors && <button onClick={() => go('visitors')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-violet-300">
        <div className="flex items-center justify-between"><span className="rounded-xl bg-violet-50 p-2 text-violet-700"><UserCheck className="h-5 w-5"/></span><ArrowRight className="h-4 w-4 text-slate-300"/></div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Ziyaretçiler</p><p className="mt-1 text-xl font-black">{summary.visitors.inside} <span className="text-[11px] font-semibold text-slate-500">içeride</span></p>
        <p className={`mt-1 text-[10px] font-bold ${summary.visitors.overdue ? 'text-rose-700' : 'text-violet-700'}`}>{summary.visitors.overdue ? `${summary.visitors.overdue} geciken çıkış` : `Bugün ${summary.visitors.todayEntries} giriş`}</p>
      </button>}
      {summary.sharedAssets && <button onClick={() => go('shared-assets')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-cyan-300">
        <div className="flex items-center justify-between"><span className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><Boxes className="h-5 w-5"/></span><ArrowRight className="h-4 w-4 text-slate-300"/></div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Ortak Eşyalar</p><p className="mt-1 text-xl font-black">{summary.sharedAssets.loaned} <span className="text-[11px] font-semibold text-slate-500">kullanımda</span></p>
        <p className={`mt-1 text-[10px] font-bold ${summary.sharedAssets.overdue ? 'text-rose-700' : 'text-cyan-700'}`}>{summary.sharedAssets.overdue ? `${summary.sharedAssets.overdue} teslim gecikmiş` : `Bugün ${summary.sharedAssets.usesToday} kullanım`}</p>
      </button>}
      {summary.cleaning && <button onClick={() => go('rooms')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-300">
        <div className="flex items-center justify-between"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><SprayCan className="h-5 w-5"/></span><ArrowRight className="h-4 w-4 text-slate-300"/></div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Bugün Tamamlanan Temizlik</p><p className="mt-1 text-xl font-black">{summary.cleaning.cleanedToday} <span className="text-[11px] font-semibold text-slate-500">oda temizlendi</span></p>
        <p className="mt-1 text-[10px] font-bold text-emerald-700">{summary.cleaning.inProgress} oda şu an temizleniyor</p>
      </button>}
      {summary.tickets && <button onClick={() => go('tickets')} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-amber-300">
        <div className="flex items-center justify-between"><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><MessageSquareWarning className="h-5 w-5"/></span><ArrowRight className="h-4 w-4 text-slate-300"/></div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-wide text-slate-500">Sonuçlanan Talepler</p><p className="mt-1 text-xl font-black">{summary.tickets.resolved} <span className="text-[11px] font-semibold text-slate-500">talep çözüldü</span></p>
        <p className="mt-1 text-[10px] font-bold text-amber-700">Toplam sonuçlanan kayıt</p>
      </button>}
    </section>

    <section className="grid gap-5 xl:grid-cols-3">
      {summary.maintenance && <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <PanelHeader title="Aktif Arızalar" note={`Bu ay ${summary.maintenance.resolvedThisMonth} kayıt çözüldü`} action={<button onClick={() => go('issues')} className="text-[10px] font-black text-blue-800">Arıza sayfası →</button>}/>
        {summary.maintenance.recent.length === 0 ? <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Aktif arıza bulunmuyor.</div> : (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {summary.maintenance.recent.map((item, index) => <button key={item.id} onClick={() => go('issues')} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 ${index ? 'border-t border-slate-100' : ''}`}>
              <span className={`rounded-lg p-2 ${item.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}><Wrench className="h-4 w-4"/></span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-900">{item.title}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{item.roomLabel} · {trDate(item.createdAt, { day: '2-digit', month: 'short' })}</p></div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.priority === 'URGENT' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{item.priority === 'URGENT' ? 'ACİL' : statusLabel[item.status]}</span>
            </button>)}
          </div>
        )}
      </div>}

      <div className="space-y-5">
        {summary.notifications && <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Son Duyurular" action={<button onClick={() => go('notifications')} className="text-[10px] font-black text-blue-800">Tümü →</button>}/>
          <div className="space-y-3">{summary.notifications.recent.length === 0 ? <p className="text-xs font-semibold text-slate-500">Henüz duyuru bulunmuyor.</p> : summary.notifications.recent.slice(0, 4).map((item) => (
            <button key={item.id} onClick={() => go('notifications')} className="flex w-full items-start gap-3 text-left">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.priority === 'URGENT' ? 'bg-rose-500' : item.priority === 'IMPORTANT' ? 'bg-amber-500' : 'bg-blue-500'}`}/>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{item.title}</p><p className="mt-0.5 text-[9px] font-semibold text-slate-400">{trDate(item.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div>
            </button>
          ))}</div>
        </div>}
        {summary.employees && <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <PanelHeader title="Departman Dağılımı" action={<button onClick={() => go('employees')} className="text-[10px] font-black text-blue-800">Personeller →</button>}/>
          <div className="space-y-2">{summary.employees.departments.length === 0 ? <p className="text-xs font-semibold text-slate-500">Departman bilgisi bulunmuyor.</p> : summary.employees.departments.slice(0, 5).map((department) => <div key={department.name} className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold text-slate-600">{department.name}</span><span className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">{department.count}</span></div>)}</div>
        </div>}
      </div>
    </section>

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <PanelHeader title="Son 7 Günlük Operasyon Yoğunluğu" note="Günlük yerleşim, arıza, ziyaretçi ve talep kayıtları"/>
      <div className="mb-3 flex flex-wrap gap-4 text-[9px] font-bold text-slate-500"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-blue-600"/>Yerleşim</span>{summary.maintenance && <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500"/>Arıza</span>}{summary.visitors && <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-violet-500"/>Ziyaretçi</span>}{summary.tickets && <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500"/>Talep</span>}</div>
      <div className="flex h-36 items-end gap-2 sm:gap-5">{summary.activity.map((day) => { const total = day.occupancy + day.maintenance + day.visitors + day.tickets; return <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[9px] font-black text-slate-600">{total}</span><div className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-md bg-slate-100" style={{ height: `${Math.max(total ? 10 : 3, total / maxActivity * 95)}px` }}><div className="bg-blue-600" style={{ flex: day.occupancy }}/><div className="bg-rose-500" style={{ flex: day.maintenance }}/><div className="bg-violet-500" style={{ flex: day.visitors }}/><div className="bg-amber-500" style={{ flex: day.tickets }}/></div><span className="mt-1.5 text-[9px] font-bold text-slate-500">{trDate(`${day.date}T12:00:00`, { weekday: 'short' })}</span></div>; })}</div>
    </section>

    <footer className="flex flex-col items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-semibold text-slate-500 sm:flex-row">
      <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-blue-700"/>Yalnızca yetkili olduğunuz işlemler gösterilir.</span>
      <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5"/>Veriler “Yenile” ile anında güncellenir.</span>
    </footer>
  </div>;
};
