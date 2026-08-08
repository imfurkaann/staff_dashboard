import React, { useState } from 'react';
import { authApi, User } from '../api/authApi';
import { appConfig } from '../config/appConfig';
import { Building2, User as UserIcon, Lock, LogIn, ShieldAlert, ArrowRight } from 'lucide-react';

interface StaffLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToAdminLogin: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onLoginSuccess, onSwitchToAdminLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await authApi.login(username.trim(), password);

      if (response.success && response.data?.user) {
        const user = response.data.user;
        if (user.role !== 'STAFF') {
          setErrorMessage('Bu sayfa sadece Personeller içindir. Yönetici girişi için aşağıdaki bağlantıyı kullanabilirsiniz.');
          authApi.logout().catch(() => {});
          setIsLoading(false);
          return;
        }
        onLoginSuccess(user);
      } else {
        setErrorMessage(response.message || 'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-8 selection:bg-[#1e3a8a] selection:text-white">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-[#1e3a8a] text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-950/20">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {appConfig.appName}
            </h1>
            <p className="text-xs font-bold text-[#1e3a8a] bg-[#1e3a8a]/10 inline-block px-3 py-1 rounded-full border border-[#1e3a8a]/20 mt-1">
              📱 Mobil Personel Giriş Portalı
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border border-slate-300 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-extrabold text-slate-900">Personel Girişi</h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Lojman amirliği tarafından verilen kullanıcı adı ve şifrenizle giriş yapınız.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-semibold">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Kullanıcı Adı</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Örn: ahmet.yilmaz"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] transition"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Şifre</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a] transition"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#1e3a8a] hover:bg-[#152a65] text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
