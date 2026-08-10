import React, { lazy, Suspense, useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { StaffLoginView } from './components/StaffLoginView';
import { authApi, User } from './api/authApi';
import { Sidebar } from './components/Sidebar';
import { canAccessTab, firstAllowedTab } from './security/accessControl';

const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const EmployeeManagementView = lazy(() => import('./components/EmployeeManagementView').then((m) => ({ default: m.EmployeeManagementView })));
const RoomManagementView = lazy(() => import('./components/RoomManagementView').then((m) => ({ default: m.RoomManagementView })));
const VisitorManagementView = lazy(() => import('./components/VisitorManagementView').then((m) => ({ default: m.VisitorManagementView })));
const MaintenanceManagementView = lazy(() => import('./components/MaintenanceManagementView').then((m) => ({ default: m.MaintenanceManagementView })));
const StaffPortalView = lazy(() => import('./components/StaffPortalView').then((m) => ({ default: m.StaffPortalView })));
const NotificationManagementView = lazy(() => import('./components/NotificationManagementView').then((m) => ({ default: m.NotificationManagementView })));
const WarehouseManagementView = lazy(() => import('./components/WarehouseManagementView').then((m) => ({ default: m.WarehouseManagementView })));
const SharedAssetManagementView = lazy(() => import('./components/SharedAssetManagementView').then((m) => ({ default: m.SharedAssetManagementView })));
const UserManagementView = lazy(() => import('./components/UserManagementView').then((m) => ({ default: m.UserManagementView })));

const PageLoader = () => <div className="min-h-[50vh] flex items-center justify-center"><div className="w-9 h-9 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin" /></div>;

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitialChecking, setIsInitialChecking] = useState(true);
  const [loginMode, setLoginMode] = useState<'staff' | 'admin'>(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPortal = params.get('portal');
    if (requestedPortal === 'admin' || window.location.hash.includes('admin')) return 'admin';
    if (requestedPortal === 'staff' || window.location.hash.includes('staff')) return 'staff';
    return window.matchMedia('(max-width: 767px)').matches ? 'staff' : 'admin';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = localStorage.getItem('staff_app_active_tab');
    return ['employees', 'rooms', 'visitors', 'issues', 'maintenance', 'notifications', 'warehouse', 'shared-assets', 'users'].includes(savedTab || '') ? savedTab! : 'dashboard';
  });

  const handleTabChange = (tab: string, empId?: string) => {
    setActiveTab(tab);
    localStorage.setItem('staff_app_active_tab', tab);
    if (empId) {
      localStorage.setItem('staff_app_active_emp_id', empId);
    } else if (tab === 'employees') {
      localStorage.removeItem('staff_app_active_emp_id');
    }
  };

  useEffect(() => {
    // Check active persistent session on app load
    const checkSession = async () => {
      try {
        const user = await authApi.getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      } catch (_err) {
        setCurrentUser(null);
      } finally {
        setIsInitialChecking(false);
      }
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (_err) {}
    setCurrentUser(null);
    localStorage.removeItem('staff_app_active_tab');
    localStorage.removeItem('staff_app_active_emp_id');
  };

  if (isInitialChecking) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-800">
        <div className="w-9 h-9 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-700">Oturum bilgileri doğrulanıyor...</p>
      </div>
    );
  }

  // Render Login Screen if not authenticated
  if (!currentUser) {
    if (loginMode === 'staff') {
      return (
        <StaffLoginView
          onLoginSuccess={(user) => setCurrentUser(user)}
          onSwitchToAdminLogin={() => setLoginMode('admin')}
        />
      );
    }

    return (
      <LoginPage
        onLoginSuccess={(user) => setCurrentUser(user)}
        onSwitchToStaffLogin={() => setLoginMode('staff')}
      />
    );
  }

  // Strict Role Guard: Staff users ONLY see the Staff Mobile Portal
  if (currentUser.role === 'STAFF') {
    return <Suspense fallback={<PageLoader />}><StaffPortalView currentUser={currentUser} onLogout={handleLogout} /></Suspense>;
  }

  const permittedTab = canAccessTab(currentUser.role, activeTab) ? activeTab : firstAllowedTab(currentUser.role);

  // Management / Admin Users Dashboard
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex selection:bg-[#1e3a8a] selection:text-white">
      {/* Collapsible Hover Sidebar */}
      <Sidebar
        currentUser={currentUser}
        activeTab={permittedTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-0 sm:ml-20 min-h-screen p-4 pb-24 sm:p-6 lg:p-8 transition-all duration-300">
        <Suspense fallback={<PageLoader />}>
        {permittedTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onNavigateTo={handleTabChange}
          />
        )}

        {permittedTab === 'employees' && (
          <EmployeeManagementView />
        )}

        {permittedTab === 'rooms' && (
          <RoomManagementView onNavigateTo={handleTabChange} currentUser={currentUser} />
        )}

        {permittedTab === 'visitors' && (
          <VisitorManagementView currentUser={currentUser} />
        )}

        {(permittedTab === 'issues' || permittedTab === 'maintenance') && (
          <MaintenanceManagementView currentUser={currentUser} />
        )}

        {permittedTab === 'notifications' && (
          <NotificationManagementView currentUser={currentUser} />
        )}

        {permittedTab === 'warehouse' && (
          <WarehouseManagementView currentUser={currentUser} />
        )}

        {permittedTab === 'shared-assets' && (
          <SharedAssetManagementView />
        )}

        {permittedTab === 'users' && <UserManagementView currentUserId={currentUser.id} />}

        {permittedTab === 'inventory' && (
          <div className="bg-white border border-slate-300 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Zimmet & Envanter Modülü</h2>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Oda ve yatak zimmetleri teslim kayıtları.
            </p>
          </div>
        )}

        {permittedTab === 'kbs' && (
          <div className="bg-white border border-slate-300 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Emniyet KBS Modülü</h2>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Kimlik Bildirim Sistemi CSV/Excel toplu veri alımı.
            </p>
          </div>
        )}
        </Suspense>
      </div>
    </div>
  );
};
