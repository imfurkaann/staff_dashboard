import React, { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { StaffLoginView } from './components/StaffLoginView';
import { authApi, User } from './api/authApi';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { RoomManagementView } from './components/RoomManagementView';
import { VisitorManagementView } from './components/VisitorManagementView';
import { MaintenanceManagementView } from './components/MaintenanceManagementView';
import { StaffPortalView } from './components/StaffPortalView';
import { NotificationManagementView } from './components/NotificationManagementView';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitialChecking, setIsInitialChecking] = useState(true);
  const [loginMode, setLoginMode] = useState<'staff' | 'admin'>(() => {
    const isStaffUrl = window.location.search.includes('portal=staff') || window.location.hash.includes('staff');
    return isStaffUrl ? 'staff' : 'staff';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = localStorage.getItem('staff_app_active_tab');
    return ['employees', 'rooms', 'visitors', 'issues', 'maintenance', 'notifications'].includes(savedTab || '') ? savedTab! : 'dashboard';
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
    return <StaffPortalView currentUser={currentUser} onLogout={handleLogout} />;
  }

  // Management / Admin Users Dashboard
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex selection:bg-[#1e3a8a] selection:text-white">
      {/* Collapsible Hover Sidebar */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-0 sm:ml-20 min-h-screen p-4 pb-24 sm:p-6 lg:p-8 transition-all duration-300">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onNavigateTo={handleTabChange}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagementView />
        )}

        {activeTab === 'rooms' && (
          <RoomManagementView onNavigateTo={handleTabChange} />
        )}

        {activeTab === 'visitors' && (
          <VisitorManagementView currentUser={currentUser} />
        )}

        {(activeTab === 'issues' || activeTab === 'maintenance') && (
          <MaintenanceManagementView currentUser={currentUser} />
        )}

        {activeTab === 'notifications' && (
          <NotificationManagementView currentUser={currentUser} />
        )}

        {activeTab === 'inventory' && (
          <div className="bg-white border border-slate-300 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Zimmet & Envanter Modülü</h2>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Oda ve yatak zimmetleri teslim kayıtları.
            </p>
          </div>
        )}

        {activeTab === 'kbs' && (
          <div className="bg-white border border-slate-300 rounded-3xl p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Emniyet KBS Modülü</h2>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Kimlik Bildirim Sistemi CSV/Excel toplu veri alımı.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
