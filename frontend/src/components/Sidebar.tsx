import React, { useState, useEffect } from 'react';
import {
  Building2,
  LayoutDashboard,
  Users,
  BedDouble,
  Wrench,
  Package,
  Boxes,
  ShieldCheck,
  LogOut,
  ChevronRight,
  UserCheck,
  Bell,
  User as UserIcon,
  UserCog,
  MessageSquareWarning
} from 'lucide-react';
import { User } from '../api/authApi';
import { appConfig } from '../config/appConfig';
import { canAccessTab, ROLE_LABELS } from '../security/accessControl';
import { ticketApi, connectTicketSocket, playChimeSound } from '../api/ticketApi';

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
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPendingTickets = async () => {
      if (!canAccessTab(currentUser.role, 'tickets')) return;
      try {
        const res = await ticketApi.getTickets({ status: 'OPEN' });
        if (isMounted) {
          setOpenTicketsCount(res.stats?.open || 0);
        }
      } catch (err) {
        // silent fallback
      }
    };

    fetchPendingTickets();

    const cleanupSocket = connectTicketSocket((event) => {
      if (!isMounted) return;
      if (event.type === 'TICKET_CREATED') {
        playChimeSound();
        fetchPendingTickets();
      } else if (event.type === 'TICKET_UPDATED') {
        fetchPendingTickets();
      }
    });

    const interval = setInterval(fetchPendingTickets, 30000);
    return () => {
      isMounted = false;
      cleanupSocket();
      clearInterval(interval);
    };
  }, [currentUser.role, activeTab]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Personel Yönetimi', icon: Users },
    { id: 'rooms', label: 'Oda Yönetimi', icon: BedDouble },
    { id: 'visitors', label: 'Ziyaretçi Yönetimi', icon: UserCheck },
    { id: 'tickets', label: 'Talep & Şikayetler', icon: MessageSquareWarning },
    { id: 'issues', label: 'Arıza Yönetimi', icon: Wrench },
    { id: 'warehouse', label: 'Depo & Stok Yönetimi', icon: Package },
    { id: 'shared-assets', label: 'Ortak Eşya Yönetimi', icon: Boxes },
    { id: 'notifications', label: 'Duyuru Yönetimi', icon: Bell },
    { id: 'users', label: 'Kullanıcı & Roller', icon: UserCog },
  ].filter((item) => canAccessTab(currentUser.role, item.id));

  return (<>
    <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-slate-300 bg-white px-3 shadow-sm sm:hidden no-print">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e3a8a] text-white">
        <Building2 className="h-5 w-5" />
      </div>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Yönetim sayfası</span>
        <select
          value={activeTab}
          onChange={(event) => onTabChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-800 outline-none focus:border-[#1e3a8a]"
        >
          {menuItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <button onClick={onLogout} aria-label="Oturumu kapat" className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
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
            const hasNewTickets = item.id === 'tickets' && openTicketsCount > 0;

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
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-[#1e3a8a]'}`} />
                  {hasNewTickets && !isHovered && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
                    </span>
                  )}
                </div>

                <span className={`whitespace-nowrap transition-opacity duration-200 flex-1 text-left ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {item.label}
                </span>

                {/* Pulsing indicator badge for new tickets */}
                {hasNewTickets && isHovered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs animate-pulse">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                    </span>
                    <span>{openTicketsCount} Yeni</span>
                  </span>
                )}

                {/* Indicator arrow if active */}
                {isActive && isHovered && !hasNewTickets && (
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
              {ROLE_LABELS[currentUser.role]}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 transition-all group cursor-pointer ${isHovered ? 'justify-start' : 'justify-center'
            }`}
          title={!isHovered ? 'Çıkış Yap' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 hidden'}`}>
            Oturumu Kapat
          </span>
        </button>
      </div>
    </aside>
  </>);
};
