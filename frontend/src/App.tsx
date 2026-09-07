import React, { lazy, Suspense, useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { StaffLoginView } from './components/StaffLoginView';
import { authApi, User } from './api/authApi';
import { Sidebar } from './components/Sidebar';
import { canAccessTab, firstAllowedTab } from './security/accessControl';
import { RequiredPasswordChangeView } from './components/RequiredPasswordChangeView';
import { canonicalManagementUrl, managementUrl, portalUrl } from './utils/navigationUrl';

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
const SupportTicketManagementView = lazy(() => import('./components/SupportTicketManagementView').then((m) => ({ default: m.SupportTicketManagementView })));

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
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const savedTab = localStorage.getItem('staff_app_active_tab');
    const validTabs = ['employees', 'rooms', 'visitors', 'tickets', 'issues', 'maintenance', 'notifications', 'warehouse', 'shared-assets', 'users'];
    if (urlTab && validTabs.includes(urlTab)) return urlTab;
    if (savedTab && validTabs.includes(savedTab)) return savedTab;
    return 'dashboard';
  });

  const handleTabChange = (tab: string, empId?: string, skipPushState = false) => {
    setActiveTab(tab);
    localStorage.setItem('staff_app_active_tab', tab);
    if (empId) {
      localStorage.setItem('staff_app_active_emp_id', empId);
    } else if (tab === 'employees') {
      localStorage.removeItem('staff_app_active_emp_id');
    }

    if (!skipPushState) {
      const url = managementUrl(tab, { empId });
      window.history.pushState({ tab, empId, timestamp: Date.now() }, '', url.toString());
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

  useEffect(() => {
    // Personel portalı, yönetim ekranlarının tab parametrelerini asla taşımaz.
    if (currentUser?.role !== 'STAFF') return;
    const params = new URLSearchParams(window.location.search);
    const validPortalTabs = ['room', 'notifications', 'inventories', 'sharedAssets', 'tickets'];
    const portalTab = validPortalTabs.includes(params.get('portalTab') || '') ? params.get('portalTab')! : 'room';
    const portalModal = params.get('portalModal') === 'ticket' ? 'ticket' : undefined;
    const url = portalUrl(portalTab, portalModal);
    if (url.toString() !== window.location.href) {
      window.history.replaceState({ portalTab, ...(portalModal && { portalModal }), timestamp: Date.now() }, '', url.toString());
    }
  }, [currentUser?.role]);

  useEffect(() => {
    // Initialize browser history entry if missing
    const params = new URLSearchParams(window.location.search);
    if (!params.has('tab')) {
      const url = canonicalManagementUrl(activeTab);
      window.history.replaceState({ tab: activeTab, timestamp: Date.now() }, '', url.toString());
    } else {
      const url = canonicalManagementUrl(activeTab);
      window.history.replaceState({ tab: activeTab, timestamp: Date.now() }, '', url.toString());
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      let targetTab = 'dashboard';
      if (state && state.tab) {
        targetTab = state.tab;
      } else {
        const searchParams = new URLSearchParams(window.location.search);
        const urlTab = searchParams.get('tab');
        const validTabs = ['employees', 'rooms', 'visitors', 'tickets', 'issues', 'maintenance', 'notifications', 'warehouse', 'shared-assets', 'users'];
        if (urlTab && validTabs.includes(urlTab)) {
          targetTab = urlTab;
        }
      }
      setActiveTab(targetTab);
      localStorage.setItem('staff_app_active_tab', targetTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  if (currentUser.mustChangePassword) {
    return (
      <RequiredPasswordChangeView
        user={currentUser}
        onCompleted={() => setCurrentUser(null)}
        onLogout={handleLogout}
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
      <div className="min-w-0 flex-1 ml-0 sm:ml-20 min-h-screen p-4 pt-20 pb-24 sm:p-6 lg:p-8 transition-all duration-300">
        <Suspense fallback={<PageLoader />}>
        {permittedTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onNavigateTo={handleTabChange}
          />
        )}

        {permittedTab === 'employees' && (
          <EmployeeManagementView currentUser={currentUser} />
        )}

        {permittedTab === 'rooms' && (
          <RoomManagementView onNavigateTo={handleTabChange} currentUser={currentUser} />
        )}

        {permittedTab === 'visitors' && (
          <VisitorManagementView currentUser={currentUser} />
        )}

        {permittedTab === 'tickets' && (
          <SupportTicketManagementView currentUser={currentUser} />
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

        {permittedTab === 'users' && <UserManagementView currentUserId={currentUser.id} onNavigateToEmployee={(employeeId) => handleTabChange('employees', employeeId)} onOwnPasswordChanged={() => setCurrentUser(null)} />}

        </Suspense>
      </div>
    </div>
  );
};
