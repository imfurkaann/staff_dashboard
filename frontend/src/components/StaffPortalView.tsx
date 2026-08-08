import React, { useEffect, useState } from 'react';
import { User } from '../api/authApi';
import { portalApi, StaffPortalData } from '../api/portalApi';
import { appConfig } from '../config/appConfig';
import { 
  Building2, 
  BedDouble, 
  Users, 
  Bell, 
  Package, 
  LogOut, 
  Smartphone,
  CheckCircle2,
  Clock,
  User as UserIcon,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  BellRing
} from 'lucide-react';

interface StaffPortalViewProps {
  currentUser: User;
  onLogout: () => void;
}

export const StaffPortalView: React.FC<StaffPortalViewProps> = ({ currentUser: _currentUser, onLogout }) => {
  const [data, setData] = useState<StaffPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'room' | 'notifications' | 'inventories'>('room');

  // PWA Deferred Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // Phone Notification Permission State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(true);
  const [pushStatus, setPushStatus] = useState('Telefon bildirimi durumu kontrol ediliyor...');
  const [showIOSNotifGuide, setShowIOSNotifGuide] = useState(false);

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);

  const urlBase64ToUint8Array = (value: string) => {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
  };

  const registerPushSubscription = async (): Promise<PushSubscription> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Bu cihaz push bildirimlerini desteklemiyor.');
    }
    const registration = await navigator.serviceWorker.ready;
    const publicKey = await portalApi.getPushPublicKey();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    // A VAPID key change invalidates the old browser subscription. Recreate it
    // instead of silently saving an unusable endpoint on the server.
    if (subscription?.options.applicationServerKey) {
      const currentKey = new Uint8Array(subscription.options.applicationServerKey);
      const keyMatches = currentKey.length === applicationServerKey.length
        && currentKey.every((byte, index) => byte === applicationServerKey[index]);
      if (!keyMatches) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }
    await portalApi.subscribePush(subscription);
    return subscription;
  };

  const enablePhoneNotifications = async () => {
    if (isIOS && !isStandalone) {
      setPushEnabled(false);
      setPushStatus('iPhone bildirimi için siteyi Ana Ekrana ekleyip uygulama simgesinden açın.');
      setShowIOSNotifGuide(true);
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushEnabled(false);
      setPushStatus('Bu cihaz telefon bildirimlerini desteklemiyor.');
      return;
    }
    setPushBusy(true);
    try {
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== 'granted') {
        setPushEnabled(false);
        setPushStatus(perm === 'denied'
          ? 'Bildirim izni kapalı. iPhone Ayarlar bölümünden uygulama bildirimlerine izin verin.'
          : 'Bildirim izni verilmedi.');
        return;
      }
      await registerPushSubscription();
      setPushEnabled(true);
      try {
        const testResult = await portalApi.testPush();
        setPushStatus(testResult.sent > 0
          ? 'Açık — cihaz kaydedildi ve test bildirimi telefona gönderildi.'
          : 'Açık — cihaz kayıtlı ancak test bildirimi teslim edilemedi.');
      } catch (testError: any) {
        setPushStatus(`Açık — cihaz kayıtlı; test sonucu: ${testError?.message || 'teslimat doğrulanamadı.'}`);
      }
    } catch (error: any) {
      setPushEnabled(false);
      setPushStatus(error?.message || 'Telefon bildirimi etkinleştirilemedi.');
    } finally {
      setPushBusy(false);
    }
  };

  const disablePhoneNotifications = async () => {
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await portalApi.unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      setPushStatus('Kapalı — bu cihaza telefon bildirimi gönderilmeyecek.');
    } catch (error: any) {
      setPushStatus(error?.message || 'Telefon bildirimi kapatılamadı.');
    } finally {
      setPushBusy(false);
    }
  };

  const togglePhoneNotifications = () => {
    if (pushBusy) return;
    if (pushEnabled) void disablePhoneNotifications();
    else void enablePhoneNotifications();
  };

  const fetchPortalData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await portalApi.getPortalData();
      setData(res);

    } catch (err: any) {
      const errMsg = err.message || 'Veriler yüklenirken bir hata oluştu.';
      setError(errMsg);
      if (errMsg.includes('yetkiniz kaldırılmıştır') || errMsg.includes('pasifleştirildi') || errMsg.includes('Oturum') || errMsg.includes('403')) {
        setTimeout(() => {
          onLogout();
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();

    // Verify both the browser subscription and its server registration. Permission
    // alone is not enough to receive a phone notification.
    const refreshPushState = async () => {
      if (isIOS && !isStandalone) {
        setPushStatus('Kapalı — iPhone için önce Ana Ekrana ekleyin.');
        setPushBusy(false);
        return;
      }
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('Bu cihaz telefon bildirimlerini desteklemiyor.');
        setPushBusy(false);
        return;
      }
      setNotifPermission(Notification.permission);
      if (Notification.permission !== 'granted') {
        setPushStatus(Notification.permission === 'denied'
          ? 'Kapalı — cihaz ayarlarında bildirim izni engellenmiş.'
          : 'Kapalı — açmak için anahtara dokunun.');
        setPushBusy(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setPushStatus('Kapalı — izin var ancak bu cihaz sunucuya kayıtlı değil.');
          return;
        }
        await registerPushSubscription();
        setPushEnabled(true);
        setPushStatus('Açık — bu cihaz telefon bildirimleri için sunucuya kayıtlı.');
      } catch (error: any) {
        setPushEnabled(false);
        setPushStatus(error?.message || 'Cihaz aboneliği doğrulanamadı.');
      } finally {
        setPushBusy(false);
      }
    };
    void refreshPushState();

    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPWA(false);
    }
    setDeferredPrompt(null);
  };

  // Helper for Turkish Room Status Labels
  const formatRoomStatus = (status: string) => {
    switch (status) {
      case 'READY':
        return { label: 'Hazır / Temiz', icon: CheckCircle2, colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'NEEDS_CLEANING':
        return { label: 'Temizlik Bekliyor', icon: Clock, colorClass: 'text-amber-800 bg-amber-50 border-amber-200' };
      case 'OUT_OF_ORDER':
        return { label: 'Bakımda / Arızalı', icon: AlertCircle, colorClass: 'text-red-700 bg-red-50 border-red-200' };
      default:
        return { label: status || 'Kullanımda', icon: CheckCircle2, colorClass: 'text-slate-800 bg-slate-100 border-slate-200' };
    }
  };

  // Helper for Turkish Inventory Status Labels
  const formatInventoryStatus = (status: string) => {
    switch (status) {
      case 'TESLİM_EDİLDİ':
        return { label: 'Teslim Edildi', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'ÇIKIŞ_İZİNLİ_ŞAHSİ_MÜLK':
        return { label: 'Şahsi Mülk', colorClass: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'TAM_İADE_ALINDI':
        return { label: 'İade Edildi', colorClass: 'bg-slate-100 text-slate-700 border-slate-200' };
      default:
        return { label: status, colorClass: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-800">
        <div className="w-10 h-10 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-700">Personel Portalı yükleniyor...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center text-slate-800 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center text-2xl font-bold mb-4 border border-red-200 shadow-sm">
          !
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Erişim Hatası</h2>
        <p className="text-slate-600 text-xs max-w-sm mb-6 font-semibold">{error || 'Verilere erişilemedi.'}</p>
        <button
          onClick={onLogout}
          className="px-6 py-2.5 bg-[#1e3a8a] hover:bg-[#152a65] text-white text-xs font-bold rounded-xl transition shadow-sm"
        >
          Çıkış Yap
        </button>
      </div>
    );
  }

  const { profile, roomInfo, roommates, inventories, notifications } = data;

  // Filter Company vs Personal Inventories
  const companyInventories = inventories.filter((inv) => inv.category !== 'ŞAHSİ_EŞYA');
  const personalInventories = inventories.filter((inv) => inv.category === 'ŞAHSİ_EŞYA');

  const roomStatusObj = roomInfo ? formatRoomStatus(roomInfo.roomStatus) : null;
  const RoomStatusIcon = roomStatusObj ? roomStatusObj.icon : CheckCircle2;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col pb-20 selection:bg-[#1e3a8a] selection:text-white">
      {/* Top Header matching Main App Branding & Displaying Profile Photo */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-40 px-4 py-3.5 sm:px-6 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Personel Profil Fotoğrafı / Avatar Badge */}
            <div className="w-11 h-11 rounded-2xl bg-[#1e3a8a] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0 overflow-hidden border border-slate-300">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
              )}
            </div>

            <div>
              <h1 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-[11px] text-slate-500 font-bold">
                {profile.department} {profile.title ? `• ${profile.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canInstallPWA && (
              <button
                onClick={handleInstallPWA}
                className="px-3 py-1.5 bg-[#1e3a8a]/10 hover:bg-[#1e3a8a]/20 border border-[#1e3a8a]/30 text-[#1e3a8a] text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#1e3a8a]" />
                <span>App Yükle</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-2 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 rounded-xl transition text-xs font-bold flex items-center gap-1"
              title="Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="grid grid-cols-3 bg-white p-1.5 rounded-2xl border border-slate-300 shadow-sm text-xs font-bold">
          <button
            onClick={() => setActiveTab('room')}
            className={`py-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'room'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1e3a8a]'
            }`}
          >
            <BedDouble className="w-4 h-4 shrink-0" />
            <span>Odam</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap relative ${
              activeTab === 'notifications'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1e3a8a]'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Duyurular</span>
            {notifications.items.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-slate-950 font-extrabold rounded-full shadow-sm">
                {notifications.items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventories')}
            className={`py-3 rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'inventories'
                ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#1e3a8a]'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Zimmetlerim</span>
          </button>
        </div>

        {/* TAB 1: ROOM & ROOMMATES */}
        {activeTab === 'room' && (
          <div className="space-y-6">
            {/* Room Location Card */}
            {roomInfo ? (
              <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-3 py-1 bg-[#1e3a8a]/10 text-[#1e3a8a] border border-[#1e3a8a]/20 text-xs font-extrabold rounded-full mb-2">
                      {roomInfo.blockName}
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      Oda {roomInfo.roomNumber}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {roomInfo.floor}. Kat • Tahsis Edilen Yatak: <span className="text-[#1e3a8a] font-extrabold">{roomInfo.bedLabel}</span>
                    </p>
                  </div>

                  <div className="text-right bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Oda Kapasitesi</span>
                    <span className="text-xs font-extrabold text-slate-900">{roomInfo.capacity} Kişilik</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs font-semibold">
                  <div className={`p-3 rounded-2xl border ${roomStatusObj?.colorClass}`}>
                    <span className="text-slate-500 block text-[11px]">Oda Durumu</span>
                    <span className="font-extrabold flex items-center gap-1 mt-0.5">
                      <RoomStatusIcon className="w-3.5 h-3.5" />
                      {roomStatusObj?.label}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Vardiya Düzeni</span>
                    <span className="font-extrabold text-slate-900 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#1e3a8a]" />
                      {profile.shiftType || 'Gündüz Vardiyası'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-300 rounded-3xl p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl font-bold border border-amber-200">
                  🏠
                </div>
                <h3 className="font-bold text-slate-900 text-base">Oda Ataması Bekleniyor</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto font-semibold">
                  Henüz aktif bir lojman odasına ve yatağa atamanız yapılmamıştır. Lojman amirliği ile görüşebilirsiniz.
                </p>
              </div>
            )}

            {/* Roommates Card */}
            <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1e3a8a]" />
                  <span>Oda Arkadaşlarım</span>
                  <span className="px-2.5 py-0.5 bg-[#1e3a8a]/10 text-[#1e3a8a] text-xs font-extrabold rounded-full border border-[#1e3a8a]/20">
                    {roommates.length}
                  </span>
                </h3>
              </div>

              {roommates.length > 0 ? (
                <div className="space-y-3">
                  {roommates.map((rm) => (
                    <div
                      key={rm.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1e3a8a] text-white rounded-xl flex items-center justify-center font-bold text-xs shadow-sm">
                          {rm.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{rm.fullName}</div>
                          <div className="text-[11px] text-slate-600 font-semibold">{rm.department} {rm.title ? `• ${rm.title}` : ''}</div>
                        </div>
                      </div>

                      <span className="px-3 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl shadow-xs">
                        {rm.bedLabel}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-semibold italic text-center py-6">
                  Odanızda kalan başka personel bulunmuyor.
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <BellRing className={`w-4 h-4 shrink-0 ${pushEnabled ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Telefon Bildirimleri</h3>
                    <span className={`text-[10px] font-extrabold ${pushEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {pushBusy ? 'KONTROL EDİLİYOR' : pushEnabled ? 'AÇIK' : 'KAPALI'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushEnabled}
                  aria-label="Telefon bildirimlerini aç veya kapat"
                  disabled={pushBusy}
                  onClick={togglePhoneNotifications}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#1e3a8a]/40 disabled:cursor-wait disabled:opacity-60 ${
                    pushEnabled ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
              <p className={`text-[11px] font-semibold leading-relaxed ${pushEnabled ? 'text-emerald-700' : notifPermission === 'denied' ? 'text-amber-700' : 'text-slate-600'}`}>
                {pushStatus}
              </p>
            </div>

            {notifications.items.length > 0 ? (
              <div className="space-y-3">
                {notifications.items.map((item) => {
                  const isUrgent = item.priority === 'URGENT';
                  const isImportant = item.priority === 'IMPORTANT';

                  const fullDateTimeStr = new Date(item.createdAt).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Istanbul',
                  });

                  return (
                    <div
                      key={item.recipientId}
                      className="p-5 bg-white border border-slate-300 rounded-3xl transition shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-nowrap">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-md border uppercase tracking-wider shrink-0 ${
                            isUrgent
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : isImportant
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}
                        >
                          {isUrgent ? 'ACİL' : isImportant ? 'ÖNEMLİ' : 'DUYURU'}
                        </span>

                        <span className="text-[10px] sm:text-[11px] text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap shrink-0">
                          {fullDateTimeStr}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{item.message}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-300 rounded-3xl p-8 text-center text-slate-500 text-xs font-semibold shadow-sm">
                Gelen herhangi bir duyuru bulunmuyor.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVENTORIES (Separated into Lojman Zimmetleri & Şahsi Mülkler) */}
        {activeTab === 'inventories' && (
          <div className="space-y-6">
            {/* Section 1: Lojman Zimmetleri */}
            <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1e3a8a] shrink-0" />
                  <span className="whitespace-nowrap">Lojman Zimmetleri</span>
                  <span className="px-2.5 py-0.5 bg-[#1e3a8a]/10 text-[#1e3a8a] text-xs font-extrabold rounded-full border border-[#1e3a8a]/20">
                    {companyInventories.length}
                  </span>
                </h3>
              </div>

              {companyInventories.length > 0 ? (
                <div className="space-y-3">
                  {companyInventories.map((inv) => {
                    const statusObj = formatInventoryStatus(inv.status);
                    const rawDate = inv.assignedDate || (inv as any).createdAt;
                    let displayDate = null;
                    if (rawDate) {
                      try {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          displayDate = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
                        }
                      } catch (_e) {}
                    }

                    return (
                      <div
                        key={inv.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">{inv.itemName}</div>
                          <div className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{inv.itemCode ? `Stok: ${inv.itemCode}` : 'Lojman Zimmeti'}</span>
                            {displayDate && (
                              <span className="text-slate-400 font-medium">
                                • Tarih: {displayDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-extrabold rounded-xl border whitespace-nowrap shrink-0 ${statusObj.colorClass}`}>
                          {statusObj.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-semibold italic text-center py-4">
                  Üzerinize tanımlı lojman eşyası/zimmeti bulunmamaktadır.
                </p>
              )}
            </div>

            {/* Section 2: Şahsi Eşyalarım */}
            <div className="bg-white border border-slate-300 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="whitespace-nowrap">Şahsi Eşyalarım</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-200">
                    {personalInventories.length}
                  </span>
                </h3>
              </div>

              {personalInventories.length > 0 ? (
                <div className="space-y-3">
                  {personalInventories.map((inv) => {
                    const statusObj = formatInventoryStatus(inv.status);
                    const rawDate = inv.assignedDate || (inv as any).createdAt;
                    let displayDate = null;
                    if (rawDate) {
                      try {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          displayDate = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
                        }
                      } catch (_e) {}
                    }

                    return (
                      <div
                        key={inv.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">{inv.itemName}</div>
                          <div className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{inv.serialNo ? `Seri/Marka: ${inv.serialNo}` : 'Şahsi Mülk Beyanı'}</span>
                            {displayDate && (
                              <span className="text-slate-400 font-medium">
                                • Tarih: {displayDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-extrabold rounded-xl border whitespace-nowrap shrink-0 ${statusObj.colorClass}`}>
                          {statusObj.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-semibold italic text-center py-4">
                  Sisteme bildirilmiş onaylı şahsi mülk kaydınız bulunmamaktadır.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* iOS Notification Setup Guide Modal */}
      {showIOSNotifGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍏</span>
                <h3 className="font-extrabold text-slate-900 text-sm">iPhone Bildirim Kurulumu</h3>
              </div>
              <button
                onClick={() => setShowIOSNotifGuide(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Apple iOS politikası gereği iPhone ve iPad cihazlarda bildirim alabilmek için uygulamanın <strong>Ana Ekrana Eklenmiş</strong> olması gerekmektedir.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5 text-xs font-semibold text-slate-800">
              <div className="flex items-start gap-2">
                <span className="bg-[#1e3a8a] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Safari altındaki <strong>Paylaş (Share ⎘)</strong> butonuna dokunun.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-[#1e3a8a] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Menüde <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-[#1e3a8a] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>Ana ekrandaki <strong>LojmanYönetim</strong> simgesinden uygulamayı açtığınızda bildirimler aktifleşecektir.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSNotifGuide(false)}
              className="w-full py-3 bg-[#1e3a8a] text-white text-xs font-bold rounded-xl hover:bg-[#152a65] transition shadow-sm"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
