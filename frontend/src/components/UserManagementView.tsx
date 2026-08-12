import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldEllipsis,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  ManagedUser,
  ManagedUserDetail,
  RoleCatalogItem,
  userManagementApi,
} from '../api/userManagementApi';
import { APP_ROLES, AppRole, ROLE_LABELS } from '../security/accessControl';
import { authApi } from '../api/authApi';

interface UserManagementViewProps {
  currentUserId: string;
  onNavigateToEmployee?: (employeeId: string) => void;
  onOwnPasswordChanged?: () => void;
}

type ModalType = 'create' | 'edit' | 'password' | 'self-password' | 'details' | null;
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const PRIVILEGED_ROLES = new Set<AppRole>(['ADMIN', 'HOUSING_MANAGER']);
const inputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-[#1e3a8a] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60';

const auditActionLabels: Record<string, string> = {
  USER_CREATED: 'Kullanıcı oluşturuldu',
  USER_UPDATED: 'Hesap güncellendi',
  PASSWORD_RESET: 'Parola yönetici tarafından yenilendi',
  PASSWORD_CHANGED: 'Kullanıcı parolasını değiştirdi',
  EMPLOYEE_PORTAL_ACCOUNT_CREATED: 'Personel portal hesabı oluşturuldu',
  EMPLOYEE_PORTAL_ACCOUNT_UPDATED: 'Personel portal hesabı güncellendi',
  EMPLOYEE_PORTAL_ACCOUNT_GENERATED: 'Personel portal hesabı üretildi',
  EMPLOYEE_PORTAL_ACCOUNT_DEACTIVATED: 'Personel portal hesabı kapatıldı',
  EMPLOYEE_PORTAL_ACCOUNT_REACTIVATED: 'Personel portal hesabı yeniden açıldı',
};

function formatDate(value?: string | null, fallback = 'Kayıt yok'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('tr-TR');
}

function roleOptions(modal: ModalType, selected: ManagedUser | null): AppRole[] {
  if (selected?.employee) return ['STAFF'];
  if (modal === 'create') return APP_ROLES.filter((role) => role !== 'STAFF');
  return selected?.role === 'STAFF' ? [...APP_ROLES] : APP_ROLES.filter((role) => role !== 'STAFF');
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUserId, onNavigateToEmployee, onOwnPasswordChanged }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);
  const [matrixRole, setMatrixRole] = useState<AppRole>('ADMIN');
  const [refreshKey, setRefreshKey] = useState(0);
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', fullName: '', role: 'HOUSING_STAFF' as AppRole, password: '', oldPassword: '', confirmation: '', isActive: true });

  useEffect(() => {
    let active = true;
    userManagementApi.roles()
      .then((catalog) => { if (active) setRoles(catalog); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Rol bilgileri yüklenemedi.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await userManagementApi.list({ search, role: roleFilter, status: statusFilter, page, pageSize });
        if (!active) return;
        setUsers(result.items);
        setTotal(result.total);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Kullanıcılar yüklenemedi.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, roleFilter, statusFilter, page, pageSize, refreshKey]);

  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageStats = useMemo(() => ({
    active: users.filter((user) => user.isActive).length,
    temporary: users.filter((user) => user.mustChangePassword).length,
    linked: users.filter((user) => Boolean(user.employee)).length,
  }), [users]);

  const selectedRoleCatalog = roles.find((item) => item.role === matrixRole);
  const roleDescription = (role: AppRole) => roles.find((item) => item.role === role)?.description || ROLE_LABELS[role];

  const closeModal = () => {
    if (busy) return;
    setModal(null);
    setSelected(null);
    setDetail(null);
    setRiskConfirmed(false);
    setError(null);
  };

  const openCreate = () => {
    setSelected(null);
    setForm({ username: '', email: '', fullName: '', role: 'HOUSING_STAFF', password: '', oldPassword: '', confirmation: '', isActive: true });
    setRiskConfirmed(false);
    setModal('create');
    setError(null);
  };

  const openEdit = (user: ManagedUser) => {
    setSelected(user);
    setForm({ username: user.username, email: user.email, fullName: user.fullName, role: user.role, password: '', oldPassword: '', confirmation: '', isActive: user.isActive });
    setRiskConfirmed(false);
    setModal('edit');
    setError(null);
  };

  const openPassword = (user: ManagedUser) => {
    setSelected(user);
    setForm((current) => ({ ...current, password: '', oldPassword: '', confirmation: '' }));
    setModal(user.id === currentUserId ? 'self-password' : 'password');
    setError(null);
  };

  const openDetails = async (user: ManagedUser) => {
    setSelected(user);
    setDetail(null);
    setModal('details');
    setError(null);
    setBusy(true);
    try {
      setDetail(await userManagementApi.get(user.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kullanıcı ayrıntıları yüklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const riskyEdit = modal === 'edit' && selected && (
    (!form.isActive && selected.isActive)
    || (form.role !== selected.role && (PRIVILEGED_ROLES.has(form.role) || PRIVILEGED_ROLES.has(selected.role)))
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (riskyEdit && !riskConfirmed) {
      setError('Kritik hesap değişikliğini onaylamanız gerekir.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (modal === 'create') {
        await userManagementApi.create({ username: form.username, email: form.email, fullName: form.fullName, role: form.role, password: form.password });
      } else if (modal === 'edit' && selected) {
        await userManagementApi.update(selected.id, { email: form.email, fullName: form.fullName, role: form.role, isActive: form.isActive });
      } else if (modal === 'password' && selected) {
        await userManagementApi.resetPassword(selected.id, form.password);
      } else if (modal === 'self-password') {
        if (form.password !== form.confirmation) throw new Error('Yeni parola ile doğrulama alanı eşleşmiyor.');
        const result = await authApi.changePassword(form.oldPassword, form.password);
        if (!result.success) throw new Error(result.message);
        setModal(null);
        onOwnPasswordChanged?.();
        return;
      }
      setModal(null);
      setSelected(null);
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><UserCog className="h-5 w-5 text-[#1e3a8a]" />Kullanıcı ve Rol Yönetimi</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Hesaplar kapatılarak korunur; rol, durum ve parola işlemleri denetim geçmişine yazılır.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRoleMatrix((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-extrabold text-blue-900"><ShieldEllipsis className="h-4 w-4" />Rol Yetkileri</button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-xs font-extrabold text-white"><Plus className="h-4 w-4" />Yeni Kullanıcı</button>
        </div>
      </div>

      {error && !modal && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4" />{error}</div>}

      {showRoleMatrix && (
        <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-sm font-black text-slate-900">Rol – modül bağlantıları</h3><p className="mt-1 text-[11px] font-semibold text-slate-500">Bu liste sunucunun uyguladığı gerçek izin matrisinden alınır.</p></div>
            <select value={matrixRole} onChange={(event) => setMatrixRole(event.target.value as AppRole)} className={`${inputClass} w-auto min-w-52`}>
              {roles.map((item) => <option key={item.role} value={item.role}>{item.label}</option>)}
            </select>
          </div>
          {selectedRoleCatalog && <div className="mt-4"><p className="text-xs font-bold text-slate-700">{selectedRoleCatalog.description}</p><div className="mt-3 flex flex-wrap gap-2">{selectedRoleCatalog.permissions.map((item) => <span key={item.permission} title={item.permission} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">{item.label}</span>)}</div></div>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Users className="h-5 w-5 text-blue-800" /><strong className="mt-2 block text-xl text-slate-900">{total}</strong><span className="text-[10px] font-bold uppercase text-slate-500">Filtrelenen hesap</span></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><ShieldCheck className="h-5 w-5 text-emerald-700" /><strong className="mt-2 block text-xl text-slate-900">{pageStats.active}</strong><span className="text-[10px] font-bold uppercase text-slate-500">Bu sayfada aktif</span></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><KeyRound className="h-5 w-5 text-amber-700" /><strong className="mt-2 block text-xl text-slate-900">{pageStats.temporary}</strong><span className="text-[10px] font-bold uppercase text-slate-500">Parola değişimi bekliyor</span></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Link2 className="h-5 w-5 text-violet-700" /><strong className="mt-2 block text-xl text-slate-900">{pageStats.linked}</strong><span className="text-[10px] font-bold uppercase text-slate-500">Personel bağlantılı</span></div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_220px_180px_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={120} placeholder="Ad, kullanıcı adı, e-posta veya sicil ara..." className={`${inputClass} pl-10`} /></div>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AppRole | 'ALL')} className={inputClass}><option value="ALL">Tüm roller</option>{APP_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={inputClass}><option value="ALL">Tüm hesaplar</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Kapalı</option></select>
        <button onClick={() => setRefreshKey((value) => value + 1)} title="Listeyi yenile" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600"><tr><th className="p-3">Kullanıcı</th><th className="p-3">Rol ve bağlantı</th><th className="p-3">Hesap</th><th className="p-3">Son giriş</th><th className="p-3 text-right">İşlem</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? <tr><td colSpan={5} className="p-8 text-center font-bold text-slate-500">Kullanıcılar yükleniyor...</td></tr> : users.length === 0 ? <tr><td colSpan={5} className="p-8 text-center font-bold text-slate-500">Filtrelerle eşleşen kullanıcı bulunamadı.</td></tr> : users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50/70'}>
                  <td className="p-3"><strong className="block text-slate-900">{user.fullName}{user.id === currentUserId && <><span aria-hidden="true"> </span><span className="ml-2 text-[9px] text-blue-700">SİZ</span></>}</strong><span className="text-[10px] text-slate-500">@{user.username} · {user.email}</span></td>
                  <td className="p-3"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-900">{ROLE_LABELS[user.role]}</span>{user.employee && <button onClick={() => onNavigateToEmployee?.(user.employee!.id)} disabled={!onNavigateToEmployee} className="mt-1 block text-left text-[9px] font-bold text-violet-700 disabled:cursor-default">Personel kaydına bağlı · {user.employee.department}</button>}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{user.isActive ? 'AKTİF' : 'KAPALI'}</span>{user.mustChangePassword && <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-800">GEÇİCİ PAROLA</span>}</div></td>
                  <td className="p-3 text-[10px] text-slate-600">{formatDate(user.lastLoginAt, 'Henüz giriş yapmadı')}</td>
                  <td className="p-3"><div className="flex justify-end gap-2"><button onClick={() => openDetails(user)} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700" title="Ayrıntı ve denetim geçmişi"><Eye className="h-4 w-4" /></button><button onClick={() => openPassword(user)} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800" title={user.id === currentUserId ? 'Kendi parolanızı değiştirin' : 'Geçici parola oluştur'}><KeyRound className="h-4 w-4" /></button><button onClick={() => openEdit(user)} className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-800" title="Hesabı düzenle"><ShieldCheck className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600"><span>{total === 0 ? '0 kayıt' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} / ${total}`}</span><div className="flex items-center gap-2"><button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span>Sayfa {page} / {totalPages}</span><button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={closeModal} role="presentation">
          <div onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Kullanıcı işlemi" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5"><div><h3 className="font-black text-slate-900">{modal === 'create' ? 'Yeni Kullanıcı Oluştur' : modal === 'edit' ? 'Hesap ve Rol Düzenle' : modal === 'password' ? 'Geçici Parola Yenile' : modal === 'self-password' ? 'Parolamı Değiştir' : 'Kullanıcı Ayrıntıları'}</h3><p className="text-[10px] font-semibold text-slate-500">{selected?.fullName || 'Yeni yönetim hesabı'}</p></div><button type="button" onClick={closeModal} disabled={busy} aria-label="Pencereyi kapat"><X className="h-5 w-5" /></button></div>

            {modal === 'details' ? (
              <div className="space-y-5 p-5">
                {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
                {busy && !detail ? <div className="p-8 text-center text-xs font-bold text-slate-500">Ayrıntılar yükleniyor...</div> : detail && <>
                  <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><span className="text-[9px] font-black uppercase text-slate-500">Hesap</span><strong className="mt-1 block text-sm text-slate-900">@{detail.username}</strong><span className="text-[10px] text-slate-600">{detail.email}</span></div><div className="rounded-xl border border-slate-200 p-3"><span className="text-[9px] font-black uppercase text-slate-500">Rol</span><strong className="mt-1 block text-sm text-slate-900">{ROLE_LABELS[detail.role]}</strong><span className="text-[10px] text-slate-600">{roleDescription(detail.role)}</span></div></div>
                  {detail.employee && <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 p-3"><div><strong className="text-xs text-violet-950">Personel kaydına bağlı</strong><p className="text-[10px] text-violet-800">{detail.employee.firstName} {detail.employee.lastName} · {detail.employee.registrationNo || 'Sicil yok'} · {detail.employee.department}</p></div>{onNavigateToEmployee && <button onClick={() => { closeModal(); onNavigateToEmployee(detail.employee!.id); }} className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-2 text-[10px] font-bold text-white">Personeli aç <ExternalLink className="h-3 w-3" /></button>}</div>}
                  <div className="grid gap-2 text-[10px] sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><Clock3 className="mb-1 h-4 w-4 text-slate-500" />Oluşturma<br /><strong>{formatDate(detail.createdAt)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><Clock3 className="mb-1 h-4 w-4 text-slate-500" />Son güncelleme<br /><strong>{formatDate(detail.updatedAt)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><Clock3 className="mb-1 h-4 w-4 text-slate-500" />Son giriş<br /><strong>{formatDate(detail.lastLoginAt, 'Henüz giriş yok')}</strong></div></div>
                  <div><h4 className="mb-3 text-xs font-black uppercase text-slate-700">Son 50 denetim kaydı</h4><div className="space-y-2">{detail.userAuditHistory.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">Denetim kaydı bulunmuyor.</p> : detail.userAuditHistory.map((entry) => <div key={entry.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-xs text-slate-900">{auditActionLabels[entry.action] || entry.action}</strong><span className="text-[9px] text-slate-500">{formatDate(entry.createdAt)}</span></div><p className="mt-1 text-[10px] font-semibold text-slate-600">{entry.notes || 'Açıklama yok'}</p><p className="mt-1 text-[9px] text-slate-500">İşlemi yapan: {entry.actorUser ? `${entry.actorUser.fullName} (@${entry.actorUser.username})` : 'Sistem / silinmiş kullanıcı'}</p></div>)}</div></div>
                </>}
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="space-y-4 p-5">
                  {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
                  {modal !== 'password' && <>
                    <label className="block text-[10px] font-extrabold text-slate-600">AD SOYAD *<input required maxLength={120} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className={inputClass} /></label>
                    {modal === 'create' && <label className="block text-[10px] font-extrabold text-slate-600">KULLANICI ADI *<input required minLength={3} maxLength={50} pattern="[a-z0-9._-]+" autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLocaleLowerCase('en-US') })} className={inputClass} /></label>}
                    <label className="block text-[10px] font-extrabold text-slate-600">E-POSTA *<input required type="email" maxLength={254} autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} /></label>
                    <label className="block text-[10px] font-extrabold text-slate-600">ROL *<select disabled={selected?.id === currentUserId || Boolean(selected?.employee)} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })} className={inputClass}>{roleOptions(modal, selected).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]} — {roleDescription(role)}</option>)}</select></label>
                    {selected?.employee && <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[10px] font-bold text-violet-900">Bu hesap bir personel kaydına bağlıdır. Rolü güvenlik ve veri kapsamı nedeniyle STAFF olarak kilitlidir.</p>}
                    {modal === 'edit' && <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" disabled={selected?.id === currentUserId} checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Hesap aktif</label>}
                  </>}
                  {(modal === 'create' || modal === 'password') && <label className="block text-[10px] font-extrabold text-slate-600">GEÇİCİ PAROLA *<input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={inputClass} /><span className="mt-1 block normal-case text-[9px] font-semibold text-slate-500">En az 12 karakter; büyük/küçük harf, rakam ve özel karakter. Kullanıcı ilk girişte değiştirmek zorundadır.</span></label>}
                  {modal === 'self-password' && <><label className="block text-[10px] font-extrabold text-slate-600">MEVCUT PAROLA *<input required type="password" autoComplete="current-password" maxLength={72} value={form.oldPassword} onChange={(event) => setForm({ ...form, oldPassword: event.target.value })} className={inputClass} /></label><label className="block text-[10px] font-extrabold text-slate-600">YENİ PAROLA *<input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={inputClass} /></label><label className="block text-[10px] font-extrabold text-slate-600">YENİ PAROLA TEKRAR *<input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} className={inputClass} /><span className="mt-1 block normal-case text-[9px] font-semibold text-slate-500">Değişiklikten sonra bütün oturumlar kapatılır ve yeniden giriş gerekir.</span></label></>}
                  {riskyEdit && <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[10px] font-bold text-amber-950"><input type="checkbox" checked={riskConfirmed} onChange={(event) => setRiskConfirmed(event.target.checked)} className="mt-0.5" />Bu işlemin hesabı kapatacağını veya ayrıcalıklı erişimi değiştireceğini anladım.</label>}
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" onClick={closeModal} disabled={busy} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">Vazgeç</button><button disabled={busy || Boolean(riskyEdit && !riskConfirmed)} className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"><Check className="h-4 w-4" />{busy ? 'Kaydediliyor...' : 'Güvenli Kaydet'}</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
