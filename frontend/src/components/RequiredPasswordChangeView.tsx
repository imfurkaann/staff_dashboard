import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, LogOut } from 'lucide-react';
import { authApi, User } from '../api/authApi';

interface RequiredPasswordChangeViewProps {
  user: User;
  onCompleted: () => void;
  onLogout: () => void;
}

const inputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white';

export const RequiredPasswordChangeView: React.FC<RequiredPasswordChangeViewProps> = ({ user, onCompleted, onLogout }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError('Yeni parola ile doğrulama alanı eşleşmiyor.');
      return;
    }
    setBusy(true);
    const result = await authApi.changePassword(oldPassword, newPassword);
    setBusy(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    onCompleted();
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl">
        <header className="bg-blue-950 p-6 text-white">
          <KeyRound className="mb-3 h-8 w-8" />
          <h1 className="text-xl font-black">Geçici parolanızı değiştirin</h1>
          <p className="mt-2 text-xs font-semibold text-blue-100">{user.fullName} · @{user.username}</p>
        </header>
        <div className="space-y-4 p-6">
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Hesap güvenliği için diğer sayfalara geçmeden önce size verilen geçici parolayı yenilemeniz gerekir.
          </div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
          <label className="block text-xs font-extrabold text-slate-700">GEÇİCİ PAROLA
            <input required type="password" autoComplete="current-password" maxLength={72} value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-extrabold text-slate-700">YENİ PAROLA
            <input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-extrabold text-slate-700">YENİ PAROLA TEKRAR
            <input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} />
          </label>
          <p className="text-[11px] font-semibold text-slate-500">En az 12 karakter; büyük harf, küçük harf, rakam ve özel karakter içermelidir.</p>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={onLogout} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"><LogOut className="h-4 w-4" />Çıkış</button>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{busy ? 'Değiştiriliyor...' : 'Parolayı Değiştir'}</button>
        </footer>
      </form>
    </main>
  );
};
