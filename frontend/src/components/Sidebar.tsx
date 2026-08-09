import React, { useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Users,
  BedDouble,
  Wrench,
  Package,
  ShieldCheck,
  LogOut,
  ChevronRight,
  UserCheck,
  Bell,
  User as UserIcon
} from 'lucide-react';
import { User } from '../api/authApi';
import { appConfig } from '../config/appConfig';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onLogout,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Genel Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Personel Kayıtları', icon: Users },
    { id: 'rooms', label: 'Oda Kayıtları', icon: BedDouble },
    { id: 'visitors', label: 'Ziyaretçi Takibi', icon: UserCheck },
    { id: 'issues', label: 'Arıza Yönetimi', icon: Wrench },
    { id: 'warehouse', label: 'Depo & Stok Takibi', icon: Package },
    { id: 'notifications', label: 'Duyuru Arşivi', icon: Bell },
  ].filter((item) => currentUser.role !== 'SECURITY' || ['dashboard', 'rooms', 'visitors', 'issues'].includes(item.id));

  return (<>
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden sm:flex fixed top-0 left-0 h-screen bg-white border-r border-slate-300 shadow-xl z-50 transition-all duration-300 ease-in-out flex-col justify-between no-print ${isHovered ? 'w-64' : 'w-20'
        }`}
    >
      {/* Top Header & Logo */}
      <div>
        <div className="h-16 px-4 flex items-center gap-3 border-b border-slate-200 overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a8a] flex items-center justify-center text-white shadow-md shrink-0">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div className={`transition-opacity duration-200 whitespace-nowrap ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <h1 className="font-extrabold text-slate-900 text-base leading-tight">
              {appConfig.appName}
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold">{appConfig.appSubtitle}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs transition-all relative group cursor-pointer ${isActive
                  ? 'bg-[#1e3a8a] text-white shadow-md shadow-blue-950/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-[#1e3a8a]'
                  }`}
                title={!isHovered ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-[#1e3a8a]'}`} />

                <span className={`whitespace-nowrap transition-opacity duration-200 flex-1 text-left ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {item.label}
                </span>

                {/* Indicator arrow if active */}
                {isActive && isHovered && (
                  <ChevronRight className="w-4 h-4 text-white shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: User Profile & Logout */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2">
        {/* User Card */}
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a8a] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
            {currentUser.fullName.charAt(0)}
          </div>
          <div className={`transition-opacity duration-200 overflow-hidden ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <p className="text-xs font-bold text-slate-900 truncate leading-tight">
              {currentUser.fullName}
            </p>
            <span className="inline-block mt-0.5 px-2 py-0.2 text-[10px] font-extrabold rounded-md bg-[#1e3a8a]/10 text-[#1e3a8a]">
              {currentUser.role === 'ADMIN' ? 'Yönetici' : currentUser.role === 'HOUSING_MANAGER' ? 'Lojman Amiri' : 'Güvenlik'}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs text-red-700 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 transition-all cursor-pointer shadow-sm ${!isHovered ? 'justify-center' : ''
            }`}
          title="Güvenli Çıkış Yap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
            Çıkış Yap
          </span>
        </button>
      </div>
    </aside>
    <nav aria-label="Mobil ana menü" className="sm:hidden fixed inset-x-0 bottom-0 z-50 h-16 bg-white border-t border-slate-300 shadow-2xl flex items-stretch no-print">
      {menuItems.map((item) => { const Icon = item.icon; const active = activeTab === item.id; return <button key={item.id} onClick={() => onTabChange(item.id)} aria-current={active ? 'page' : undefined} className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? 'text-[#1e3a8a] bg-blue-50' : 'text-slate-600'}`}><Icon className="w-5 h-5" /><span>{item.label.replace('Genel ', '')}</span></button>; })}
      <button onClick={onLogout} className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-rose-700"><LogOut className="w-5 h-5" /><span>Çıkış</span></button>
    </nav>
  </>);
};
