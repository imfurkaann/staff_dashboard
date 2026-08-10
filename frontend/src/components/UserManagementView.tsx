import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, KeyRound, Plus, Search, ShieldCheck, UserCog, X } from 'lucide-react';
import { ManagedUser, userManagementApi } from '../api/userManagementApi';
import { APP_ROLES, AppRole, ROLE_LABELS } from '../security/accessControl';

const roleDescriptions: Record<AppRole, string> = {
  ADMIN: 'Tüm sistem, kullanıcılar ve hassas bilgiler.',
  HOUSING_MANAGER: 'Admin ile aynı operasyonel ve yönetim yetkileri.',
  HOUSING_STAFF: 'Tüm lojman operasyonları; hassas personel ve kullanıcı yönetimi hariç.',
  TECHNICAL_MANAGER: 'Tüm arıza süreçleri, raporlar, cihaz yaşam döngüsü ve stok görünümü.',
  TECHNICIAN: 'Odalar ve arızalar; işlem, çözüm ve servis bilgisi güncelleme.',
  HOUSEKEEPING: 'Yalnızca odalar ve temizlik süreçleri.',
  WAREHOUSE_MANAGER: 'Depo, stok, zimmet ve ortak eşya işlemleri.',
  HR_MANAGER: 'Personel yönetimi ve hassas personel bilgileri.',
  SECURITY: 'Ziyaretçiler, temel oda görünümü ve arıza bildirimi.',
  STAFF: 'Yalnızca kendi personel portalı.',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:border-[#1e3a8a] focus:bg-white';

export const UserManagementView: React.FC<{ currentUserId: string }> = ({ currentUserId }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | 'password' | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState({ username: '', email: '', fullName: '', role: 'HOUSING_STAFF' as AppRole, password: '', isActive: true });

  const load = async () => { try { setLoading(true); setError(null); setUsers(await userManagementApi.list()); } catch (e) { setError(e instanceof Error ? e.message : 'Kullanıcılar yüklenemedi.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => users.filter((user) => [user.fullName, user.username, user.email, ROLE_LABELS[user.role]].join(' ').toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR'))), [users, search]);

  const openCreate = () => { setSelected(null); setForm({ username: '', email: '', fullName: '', role: 'HOUSING_STAFF', password: '', isActive: true }); setModal('create'); setError(null); };
  const openEdit = (user: ManagedUser) => { setSelected(user); setForm({ username: user.username, email: user.email, fullName: user.fullName, role: user.role, password: '', isActive: user.isActive }); setModal('edit'); setError(null); };
  const openPassword = (user: ManagedUser) => { setSelected(user); setForm((old) => ({ ...old, password: '' })); setModal('password'); setError(null); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (modal === 'create') await userManagementApi.create({ username: form.username, email: form.email, fullName: form.fullName, role: form.role, password: form.password });
      else if (modal === 'edit' && selected) await userManagementApi.update(selected.id, { email: form.email, fullName: form.fullName, role: form.role, isActive: form.isActive });
      else if (modal === 'password' && selected) await userManagementApi.resetPassword(selected.id, form.password);
      setModal(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.'); } finally { setBusy(false); }
  };

  return <div className="space-y-5 animate-fadeIn">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"><div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><UserCog className="h-5 w-5 text-[#1e3a8a]"/>Kullanıcı ve Rol Yönetimi</h2><p className="mt-1 text-xs font-semibold text-slate-500">Hesaplar silinmez; kapatılır ve bütün rol değişiklikleri denetim geçmişine yazılır.</p></div><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-xs font-extrabold text-white"><Plus className="h-4 w-4"/>Yeni Kullanıcı</button></div>
    {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4"/>{error}</div>}
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, kullanıcı adı, e-posta veya rol ara..." className={`${inputClass} pl-10`}/></div>
    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600"><tr><th className="p-3">Kullanıcı</th><th className="p-3">Rol</th><th className="p-3">Hesap</th><th className="p-3">Son Giriş</th><th className="p-3 text-right">İşlem</th></tr></thead><tbody className="divide-y divide-slate-200">{loading ? <tr><td colSpan={5} className="p-8 text-center font-bold text-slate-500">Kullanıcılar yükleniyor...</td></tr> : filtered.map((user) => <tr key={user.id} className={!user.isActive ? 'bg-slate-50 opacity-65' : ''}><td className="p-3"><strong className="block text-slate-900">{user.fullName}</strong><span className="text-[10px] text-slate-500">@{user.username} · {user.email}</span>{user.employee && <span className="mt-1 block text-[9px] font-bold text-blue-700">Personel kaydına bağlı · {user.employee.department}</span>}</td><td className="p-3"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-900">{ROLE_LABELS[user.role]}</span><p className="mt-1 max-w-xs text-[9px] text-slate-500">{roleDescriptions[user.role]}</p></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{user.isActive ? 'AKTİF' : 'KAPALI'}</span></td><td className="p-3 text-[10px] text-slate-600">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('tr-TR') : 'Henüz giriş yapmadı'}</td><td className="p-3"><div className="flex justify-end gap-2"><button onClick={() => openPassword(user)} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800" title="Parola yenile"><KeyRound className="h-4 w-4"/></button><button onClick={() => openEdit(user)} className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-800" title="Hesabı düzenle"><ShieldCheck className="h-4 w-4"/></button></div></td></tr>)}</tbody></table></div></div>
    {modal && <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={() => !busy && setModal(null)}><form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-5"><div><h3 className="font-black text-slate-900">{modal === 'create' ? 'Yeni Kullanıcı Oluştur' : modal === 'edit' ? 'Hesap ve Rol Düzenle' : 'Parola Yenile'}</h3><p className="text-[10px] font-semibold text-slate-500">{selected?.fullName || 'Yeni yönetim hesabı'}</p></div><button type="button" onClick={() => setModal(null)}><X className="h-5 w-5"/></button></div><div className="space-y-4 p-5">{error && <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}{modal !== 'password' && <><label className="block text-[10px] font-extrabold text-slate-600">AD SOYAD *<input required maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass}/></label>{modal === 'create' && <label className="block text-[10px] font-extrabold text-slate-600">KULLANICI ADI *<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLocaleLowerCase('tr-TR') })} className={inputClass}/></label>}<label className="block text-[10px] font-extrabold text-slate-600">E-POSTA *<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass}/></label><label className="block text-[10px] font-extrabold text-slate-600">ROL *<select disabled={selected?.id === currentUserId} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })} className={inputClass}>{APP_ROLES.filter((role) => modal === 'edit' || role !== 'STAFF').map((role) => <option key={role} value={role}>{ROLE_LABELS[role]} — {roleDescriptions[role]}</option>)}</select></label>{modal === 'edit' && <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" disabled={selected?.id === currentUserId} checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}/>Hesap aktif</label>}</>}{(modal === 'create' || modal === 'password') && <label className="block text-[10px] font-extrabold text-slate-600">GEÇİCİ PAROLA *<input required type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass}/><span className="mt-1 block normal-case text-[9px] font-semibold text-slate-500">En az 12 karakter; büyük/küçük harf, rakam ve özel karakter.</span></label>}</div><div className="flex justify-end gap-2 border-t border-slate-200 p-4"><button type="button" onClick={() => setModal(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">Vazgeç</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"><Check className="h-4 w-4"/>{busy ? 'Kaydediliyor...' : 'Güvenli Kaydet'}</button></div></form></div>}
  </div>;
};
