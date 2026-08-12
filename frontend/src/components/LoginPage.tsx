import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  KeyRound, 
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  LogIn
} from 'lucide-react';
import { authApi, User } from '../api/authApi';
import { appConfig } from '../config/appConfig';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onSwitchToStaffLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onSwitchToStaffLogin }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMessage('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.login(usernameOrEmail, password);

      if (response.success && response.data?.user) {
        setSuccessMessage('Giriş başarılı. Yönlendiriliyorsunuz...');
        setTimeout(() => {
          onLoginSuccess(response.data!.user);
        }, 600);
      } else {
        setErrorMessage(response.message || 'Giriş başarısız. Bilgilerinizi kontrol ediniz.');
      }
    } catch (err: any) {
      setErrorMessage('Bir bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoFill = (role: 'admin' | 'amir' | 'guvenlik') => {
    setUsernameOrEmail(role);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-200/70 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative selection:bg-[#1e3a8a] selection:text-white">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-slate-300/40 to-transparent pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex justify-between items-center z-10 py-2">
        <div className="flex items-center gap-3">
          {/* Distinct Visible Navy Logo Container */}
          <div className="w-11 h-11 rounded-xl bg-[#1e3a8a] flex items-center justify-center text-white shadow-md shadow-blue-950/20 shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-xl tracking-tight leading-tight">
              {appConfig.appName}
            </h1>
            <p className="text-xs text-slate-600 font-semibold">{appConfig.appSubtitle}</p>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto z-10 py-6">
        <div className="bg-white border border-slate-300 rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-300/80">
          
          {/* Card Icon & Header */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-[#1e3a8a]/10 border border-[#1e3a8a]/20 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-[#1e3a8a] shadow-sm">
              <KeyRound className="w-7 h-7 text-[#1e3a8a]" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sisteme Giriş Yapın</h2>
            <p className="text-xs font-semibold text-slate-600 mt-1.5 leading-relaxed">
              Personel kayıtları, oda yerleştirme ve lojman yönetim paneline erişmek için giriş yapın.
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div role="alert" className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs shadow-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Success Message Box */}
          {successMessage && (
            <div role="status" className="mb-5 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-3 text-[#1e3a8a] text-xs shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-[#1e3a8a] shrink-0" />
              <div className="font-semibold">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email Field */}
            <div>
              <label htmlFor="login-identifier" className="block text-xs font-bold text-slate-800 mb-1.5">
                Kullanıcı Adı veya E-Posta
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="login-identifier"
                  autoComplete="username"
                  type="text"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  maxLength={254}
                  placeholder="Kullanıcı adınız..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-bold text-slate-800">
                  Şifre
                </label>
                <span className="text-[11px] text-slate-600 flex items-center gap-1 font-semibold">
                  <HelpCircle className="w-3.5 h-3.5" /> Şifre için yöneticinize başvurun
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={72}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 transition-all shadow-sm"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Solid Navy Blue Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3.5 px-4 bg-[#1e3a8a] hover:bg-[#1e293b] active:bg-[#0f172a] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>Giriş Yap</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Test Buttons */}
          {appConfig.showDemoAccounts && <div className="mt-7 pt-5 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-600 mb-2.5 text-center uppercase tracking-wider">
              Hızlı Test / Demo Hesapları
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoFill('admin')}
                className="py-2 px-2 bg-slate-100 hover:bg-[#1e3a8a] hover:text-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold transition-all text-center cursor-pointer shadow-sm"
              >
                Yönetici
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('amir')}
                className="py-2 px-2 bg-slate-100 hover:bg-[#1e3a8a] hover:text-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold transition-all text-center cursor-pointer shadow-sm"
              >
                Lojman Amiri
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoFill('guvenlik')}
                className="py-2 px-2 bg-slate-100 hover:bg-[#1e3a8a] hover:text-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold transition-all text-center cursor-pointer shadow-sm"
              >
                Güvenlik
              </button>
            </div>
          </div>}

          {/* Switch to Staff Login Button */}
          {onSwitchToStaffLogin && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={onSwitchToStaffLogin}
                className="text-xs font-bold text-slate-700 hover:text-[#1e3a8a] inline-flex items-center gap-1.5 transition py-2 px-3 rounded-xl hover:bg-slate-200/60"
              >
                <span>📱 Mobil Personel Portalı Girişine Geç</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center text-xs text-slate-600 font-semibold z-10 py-2">
        <p>{appConfig.copyrightText}</p>
      </footer>
    </div>
  );
};
