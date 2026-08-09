import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Bell, 
  Send, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Users, 
  Building2, 
  Search, 
  X, 
  Filter,
  Plus,
  RotateCcw,
  Calendar,
  RefreshCw,
  UserCheck,
  FileText,
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { notificationApi, SentNotification, RecipientInfo, NotificationQuery, NotificationSummaryStats } from '../api/notificationApi';
import { employeeApi, Employee } from '../api/employeeApi';
import { roomApi } from '../api/roomApi';
import { User } from '../api/authApi';

interface NotificationManagementViewProps {
  currentUser: User;
}

const buttonBase =
  'group relative inline-flex items-center justify-center h-7 px-2 rounded-lg border transition-all duration-300 ease-out shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase =
  'max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 text-[11px] font-extrabold whitespace-nowrap overflow-hidden';

export const NotificationManagementView: React.FC<NotificationManagementViewProps> = ({ currentUser }) => {
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummaryStats>({
    totalCount: 0,
    normalCount: 0,
    importantCount: 0,
    urgentCount: 0,
  });

  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  // Modal Detail State
  const [selectedDetailNotif, setSelectedDetailNotif] = useState<SentNotification | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  // Send New Notification Modal States
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [composePriority, setComposePriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');
  const [composeTargetType, setComposeTargetType] = useState<'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT' | 'GENDER'>('ALL');
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Auxiliary Seeding / Options State
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Specific User Selector Filter
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedSelectDept, setSelectedSelectDept] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Memoized query parameter building matching Maintenance filters
  const queryParams = useMemo<NotificationQuery>(() => {
    return {
      priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
      targetType: selectedTargetType !== 'ALL' ? selectedTargetType : undefined,
      search: search.trim() || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      pageSize: 25,
    };
  }, [selectedPriority, selectedTargetType, search, dateStart, dateEnd]);

  // Load data matching Maintenance loading logic
  const loadData = async (isInitial = false, pageToFetch = 1) => {
    const requestId = ++requestIdRef.current;
    if (pageToFetch === 1) {
      if (isInitial) setIsInitialLoading(true);
      setIsFetching(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const result = await notificationApi.getSentNotifications({
        ...queryParams,
        page: pageToFetch,
      });
      if (requestId !== requestIdRef.current) return;

      if (pageToFetch === 1) {
        setHistory(result.items);
      } else {
        setHistory((prev) => [...prev, ...result.items]);
      }

      setPage(pageToFetch);
      setHasMore(result.pagination.page < result.pagination.totalPages);
      setTotalRecords(result.pagination.total);
      setSummary(result.summary);
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setError(caught instanceof Error ? caught.message : 'Duyuru kayıtları yüklenemedi.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsInitialLoading(false);
        setIsFetching(false);
        setIsLoadingMore(false);
      }
    }
  };

  // Immediate fetch on filter change
  useEffect(() => {
    const isFirst = history.length === 0;
    const delay = search ? 250 : 0;
    const timer = window.setTimeout(() => loadData(isFirst, 1), delay);
    return () => window.clearTimeout(timer);
  }, [queryParams]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && hasMore && !isLoadingMore && !isFetching) {
          void loadData(false, page + 1);
        }
      },
      { threshold: 0.2 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, isLoadingMore, isFetching, page]);

  const fetchOptions = async () => {
    try {
      const roomList = await roomApi.getRooms();
      if (roomList) {
        const uniqueBlocksMap = new Map<string, string>();
        roomList.forEach((r) => {
          if (r.block) {
            uniqueBlocksMap.set(r.block.id, r.block.name);
          }
        });
        setBlocks(Array.from(uniqueBlocksMap.entries()).map(([id, name]) => ({ id, name })));
      }

      const empData = await employeeApi.getEmployees();
      if (empData) {
        setEmployees(empData);
        const depts = Array.from(new Set(empData.map((e) => e.department).filter(Boolean)));
        setDepartments(depts as string[]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const handleUserToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const filteredEmployeesForSelection = employees.filter((emp) => {
    if (!emp.userId) return false;
    const queryStr = employeeSearch.toLowerCase().trim();
    const matchesSearch = !queryStr || 
      emp.firstName.toLowerCase().includes(queryStr) ||
      emp.lastName.toLowerCase().includes(queryStr);
    const matchesDept = !selectedSelectDept || emp.department === selectedSelectDept;
    return matchesSearch && matchesDept;
  });

  const handleSelectAllSpecific = () => {
    const ids = filteredEmployeesForSelection.map((e) => e.userId!);
    setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...ids])));
  };

  const handleClearSpecific = () => {
    const idsToRemove = filteredEmployeesForSelection.map((e) => e.userId!);
    setSelectedUserIds(selectedUserIds.filter((id) => !idsToRemove.includes(id)));
  };

  const toggleBlockSelection = (blockName: string) => {
    setSelectedBlocks((prev) =>
      prev.includes(blockName)
        ? prev.filter((name) => name !== blockName)
        : [...prev, blockName]
    );
  };

  const toggleDeptSelection = (deptName: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptName)
        ? prev.filter((name) => name !== deptName)
        : [...prev, deptName]
    );
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    let targetValue: string | undefined = undefined;

    if (composeTargetType === 'BLOCK') {
      if (selectedBlocks.length === 0) {
        setStatusMessage({ type: 'error', text: 'Lütfen en az bir lojman bloğu seçiniz.' });
        return;
      }
      targetValue = JSON.stringify(selectedBlocks);
    } else if (composeTargetType === 'DEPARTMENT') {
      if (selectedDepts.length === 0) {
        setStatusMessage({ type: 'error', text: 'Lütfen en az bir departman seçiniz.' });
        return;
      }
      targetValue = JSON.stringify(selectedDepts);
    } else if (composeTargetType === 'GENDER') {
      if (!selectedGender) {
        setStatusMessage({ type: 'error', text: 'Lütfen cinsiyet seçiniz.' });
        return;
      }
      targetValue = selectedGender;
    } else if (composeTargetType === 'SPECIFIC_USERS') {
      if (selectedUserIds.length === 0) {
        setStatusMessage({ type: 'error', text: 'Lütfen en az 1 personel seçiniz.' });
        return;
      }
      targetValue = JSON.stringify(selectedUserIds);
    }

    try {
      setIsSending(true);
      setStatusMessage(null);

      const res = await notificationApi.sendNotification({
        title: title.trim(),
        message: message.trim(),
        priority: composePriority,
        targetType: composeTargetType,
        targetValue,
      });

      setStatusMessage({ type: 'success', text: res.message || 'Bildirim başarıyla gönderildi.' });
      
      // Reset compose state
      setTitle('');
      setMessage('');
      setSelectedUserIds([]);
      setSelectedGender('');
      setSelectedBlocks([]);
      setSelectedDepts([]);
      setIsSendModalOpen(false);
      
      // Reload archive list
      void loadData(false, 1);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Bildirim gönderilemedi.' });
    } finally {
      setIsSending(false);
    }
  };

  // Initials avatars utilities
  const getInitialsColor = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-pink-100 text-pink-700 border-pink-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-cyan-100 text-cyan-700 border-cyan-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    if (!name) return 'P';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const filteredRecipients = selectedDetailNotif?.recipients?.filter((rec) => {
    const q = modalSearch.toLowerCase().trim();
    if (!q) return true;
    return rec.fullName.toLowerCase().includes(q) || rec.username.toLowerCase().includes(q);
  }) || [];

  const renderPriorityBadge = (priorityVal: 'NORMAL' | 'IMPORTANT' | 'URGENT') => {
    switch (priorityVal) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            ACİL
          </span>
        );
      case 'IMPORTANT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertCircle className="w-3.5 h-3.5 text-orange-700 shrink-0" />
            ÖNEMLİ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Info className="w-3.5 h-3.5 text-blue-700 shrink-0" />
            DUYURU
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn w-full max-w-full">
      {/* Top Header Tabs & Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Priority Tabs matching Maintenance Status Tabs layout */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedPriority('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedPriority === 'ALL'
                ? 'bg-[#1e3a8a] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Tüm Duyurular ({summary.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPriority('NORMAL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedPriority === 'NORMAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Normal ({summary.normalCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPriority('IMPORTANT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedPriority === 'IMPORTANT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Önemli ({summary.importantCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedPriority('URGENT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              selectedPriority === 'URGENT'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Acil ({summary.urgentCount})
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => {
              setStatusMessage(null);
              setIsSendModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#172554] border border-[#1e3a8a] font-extrabold text-xs transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Duyuru Gönder</span>
          </button>
        </div>
      </div>



      {/* Error Notifications */}
      {error && (
        <div className="flex justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls Bar matching Maintenance filter bar layout */}
      <div className="relative z-40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-xs items-center">
        {/* Search */}
        <div className="lg:col-span-4">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Duyuru başlığı veya içerik ara..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 placeholder-slate-400"
            />
          </label>
        </div>

        {/* Target Type Filter */}
        <div className="lg:col-span-3">
          <label className="relative block">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedTargetType}
              onChange={(e) => setSelectedTargetType(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold text-slate-900 cursor-pointer appearance-none"
            >
              <option value="ALL">Tüm Hedef Kitleler</option>
              <option value="ALL_TARGET">Tüm Lojman</option>
              <option value="BLOCK">Bloğa Özel</option>
              <option value="DEPARTMENT">Departmana Özel</option>
              <option value="SPECIFIC_USERS">Özel Kişiler</option>
            </select>
          </label>
        </div>

        {/* Date Range Picker */}
        <div className="lg:col-span-5">
          <DateRangePicker
            startDate={dateStart}
            endDate={dateEnd}
            onChange={(start, end) => {
              setDateStart(start);
              setDateEnd(end);
            }}
            fullWidth
            placeholder="Gönderim Tarih Aralığı Seçin"
          />
        </div>
      </div>

      {/* Main Table / Mobile List Section */}
      <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-xs">
        {isInitialLoading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin mb-3" />
            Duyuru arşiv kayıtları yükleniyor...
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-extrabold text-slate-800">Kayıt Bulunamadı</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Seçilen filtrelere uygun duyuru kaydı bulunmuyor.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">Duyuru Başlığı</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Duyuru İçeriği</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Öncelik</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Gönderen Yetkili</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Hedef Kitle</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Gönderim Tarihi</th>
                    <th className="py-3.5 px-4 whitespace-nowrap text-center">Alıcı Sayısı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-bold text-slate-900">
                  {history.map((item) => {
                    let blockLabel = `Blok (${item.targetValue})`;
                    if (item.targetType === 'BLOCK' && item.targetValue) {
                      try {
                        if (item.targetValue.startsWith('[')) {
                          const arr = JSON.parse(item.targetValue) as string[];
                          blockLabel = `Bloklar (${arr.join(', ')})`;
                        }
                      } catch {}
                    }

                    let deptLabel = `Departman (${item.targetValue})`;
                    if (item.targetType === 'DEPARTMENT' && item.targetValue) {
                      try {
                        if (item.targetValue.startsWith('[')) {
                          const arr = JSON.parse(item.targetValue) as string[];
                          deptLabel = `Departmanlar (${arr.join(', ')})`;
                        }
                      } catch {}
                    }

                    const targetLabel = item.targetType === 'ALL'
                      ? 'Tüm Lojman'
                      : item.targetType === 'BLOCK'
                      ? blockLabel
                      : item.targetType === 'DEPARTMENT'
                      ? deptLabel
                      : item.targetType === 'GENDER'
                      ? `Cinsiyet (${item.targetValue === 'Male' ? 'Erkek' : 'Kadın'})`
                      : 'Özel Kişiler';

                    const formattedDate = new Date(item.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Istanbul',
                    });

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedDetailNotif(item);
                          setModalSearch('');
                        }}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        {/* 1. Duyuru Başlığı */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/80 text-[#1e3a8a] flex items-center justify-center shrink-0 shadow-2xs">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div className="font-extrabold text-slate-900 text-sm truncate max-w-[180px]" title={item.title}>
                              {item.title}
                            </div>
                          </div>
                        </td>

                        {/* 2. Duyuru İçeriği */}
                        <td className="py-3.5 px-4 max-w-[280px]">
                          <p className="font-extrabold text-slate-950 truncate max-w-[260px]" title={item.message}>
                            {item.message}
                          </p>
                        </td>

                        {/* 3. Öncelik */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderPriorityBadge(item.priority)}
                        </td>

                        {/* 4. Gönderen Yetkili */}
                        <td className="py-3.5 px-4 whitespace-nowrap max-w-[160px]">
                          <span className="font-extrabold text-slate-800 block truncate max-w-[150px]" title={item.senderName || 'Sistem Yöneticisi'}>
                            {item.senderName || 'Sistem Yöneticisi'}
                          </span>
                        </td>

                        {/* 5. Hedef Kitle */}
                        <td className="py-3.5 px-4 whitespace-nowrap max-w-[150px]">
                          <span className="font-extrabold text-slate-700 block truncate max-w-[140px]" title={targetLabel}>
                            {targetLabel}
                          </span>
                        </td>

                        {/* 6. Gönderim Tarihi */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-slate-600">
                          {formattedDate}
                        </td>

                        {/* 7. Alıcı Sayısı */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <span className="bg-slate-100 border border-slate-200 text-slate-700 font-extrabold px-2.5 py-0.5 rounded-full text-[10px]">
                            {item.totalRecipients} Alıcı
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Grid View matching Maintenance list layout */}
            <div className="lg:hidden divide-y divide-slate-200">
              {history.map((item) => {
                let blockLabel = `Blok (${item.targetValue})`;
                if (item.targetType === 'BLOCK' && item.targetValue) {
                  try {
                    if (item.targetValue.startsWith('[')) {
                      const arr = JSON.parse(item.targetValue) as string[];
                      blockLabel = `Bloklar (${arr.join(', ')})`;
                    }
                  } catch {}
                }

                let deptLabel = `Departman (${item.targetValue})`;
                if (item.targetType === 'DEPARTMENT' && item.targetValue) {
                  try {
                    if (item.targetValue.startsWith('[')) {
                      const arr = JSON.parse(item.targetValue) as string[];
                      deptLabel = `Departmanlar (${arr.join(', ')})`;
                    }
                  } catch {}
                }

                const targetLabel = item.targetType === 'ALL'
                  ? 'Tüm Lojman'
                  : item.targetType === 'BLOCK'
                  ? blockLabel
                  : item.targetType === 'DEPARTMENT'
                  ? deptLabel
                  : item.targetType === 'GENDER'
                  ? `Cinsiyet (${item.targetValue === 'Male' ? 'Erkek' : 'Kadın'})`
                  : 'Özel Kişiler';

                const formattedDate = new Date(item.createdAt).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Istanbul',
                });

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedDetailNotif(item);
                      setModalSearch('');
                    }}
                    className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-[#1e3a8a] text-sm block">
                          {targetLabel}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-xs mt-1">{item.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {renderPriorityBadge(item.priority)}
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 line-clamp-2">
                      {item.message}
                    </p>

                    <div className="text-[11px] space-y-1 pt-2 border-t border-slate-100 text-slate-700">
                      <p><strong>Gönderen Yetkili:</strong> {item.senderName || 'Sistem Yöneticisi'}</p>
                      <p><strong>Alıcı Sayısı:</strong> {item.totalRecipients} Alıcı</p>
                      <p><strong>Gönderim Tarihi:</strong> {formattedDate}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Sentinel & Loading Indicator matching Maintenance */}
            <div ref={sentinelRef} className="py-4 text-center">
              {isLoadingMore && (
                <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 shadow-2xs">
                  <div className="w-4 h-4 border-2 border-[#1e3a8a]/20 border-t-[#1e3a8a] rounded-full animate-spin" />
                  Daha fazla duyuru kaydı yükleniyor...
                </div>
              )}
              {!hasMore && history.length > 0 && (
                <p className="text-[11px] font-semibold text-slate-400">
                  Tüm duyurular gösteriliyor ({history.length} / {summary.totalCount})
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* POPUP MODAL: YENİ DUYURU GÖNDER */}
      {isSendModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-3xl p-8 md:p-10 max-w-6xl w-full max-h-[92vh] overflow-y-auto space-y-6 shadow-2xl animate-scaleUp">
            
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#1e3a8a]">
                  <Send className="w-5 h-5" />
                  <h3 className="font-black text-slate-900 text-base">Yeni Bildirim & Duyuru Gönder</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Lojmandaki çalışanlar veya belirli hedef kitleler için duyuru oluşturun. Gönderilen bildirimler ilgili panellerde anında listelenecektir.
                </p>
              </div>
              <button
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center border border-slate-200 text-xs font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSendSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Priority & Target Selections */}
                <div className="space-y-6">
                  {/* Priority Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Öncelik Seviyesi</label>
                    <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                      Duyurunun aciliyet durumunu belirtin. Kritik duyurular için 'Acil' seçiniz.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setComposePriority('NORMAL')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          composePriority === 'NORMAL'
                            ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Normal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposePriority('IMPORTANT')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          composePriority === 'IMPORTANT'
                            ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Önemli</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposePriority('URGENT')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          composePriority === 'URGENT'
                            ? 'bg-red-50 text-red-700 border-red-400 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Acil</span>
                      </button>
                    </div>
                  </div>

                  {/* Target Selector Tabs */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Hedef Kitle Seçimi</label>
                    <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                      Bildirimin gönderileceği çalışan gruplarını filtreleyin. Birden fazla blok veya departman seçebilirsiniz.
                    </p>
                    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] sm:text-xs font-bold pt-1">
                      <button
                        type="button"
                        onClick={() => setComposeTargetType('ALL')}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg transition text-center cursor-pointer ${composeTargetType === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
                      >
                        Tüm Lojman
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeTargetType('BLOCK')}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg transition text-center cursor-pointer ${composeTargetType === 'BLOCK' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
                      >
                        Blok
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeTargetType('DEPARTMENT')}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg transition text-center cursor-pointer ${composeTargetType === 'DEPARTMENT' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
                      >
                        Departman
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeTargetType('GENDER')}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg transition text-center cursor-pointer ${composeTargetType === 'GENDER' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
                      >
                        Cinsiyet
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposeTargetType('SPECIFIC_USERS')}
                        className={`flex-1 min-w-[65px] py-1.5 rounded-lg transition text-center cursor-pointer ${composeTargetType === 'SPECIFIC_USERS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-950'}`}
                      >
                        Kişiler
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Target Input Forms */}
                  {composeTargetType === 'BLOCK' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Hedef Lojman Blokları (Çoklu Seçim)
                      </label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {blocks.map((b) => {
                          const isSelected = selectedBlocks.includes(b.name);
                          return (
                            <button
                              type="button"
                              key={b.id}
                              onClick={() => toggleBlockSelection(b.name)}
                              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-2xs font-extrabold'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{b.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {composeTargetType === 'DEPARTMENT' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Filter className="w-3.5 h-3.5" />
                        Hedef Departmanlar (Çoklu Seçim)
                      </label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {departments.map((dept) => {
                          const isSelected = selectedDepts.includes(dept);
                          return (
                            <button
                              type="button"
                              key={dept}
                              onClick={() => toggleDeptSelection(dept)}
                              className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-2xs font-extrabold'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{dept}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {composeTargetType === 'GENDER' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" />
                        Hedef Cinsiyet Seçimi
                      </label>
                      <div className="relative">
                        <select
                          value={selectedGender}
                          onChange={(e) => setSelectedGender(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 appearance-none cursor-pointer"
                        >
                          <option value="">-- Cinsiyet Seçiniz --</option>
                          <option value="Male">Erkek</option>
                          <option value="Female">Kadın</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {composeTargetType === 'SPECIFIC_USERS' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-[11px] font-bold text-slate-700">
                          Seçilen Personel: <span className="text-blue-600">{selectedUserIds.length} Kişi</span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllSpecific}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-[9px] font-bold text-slate-700 transition cursor-pointer"
                          >
                            Filtreli Seç
                          </button>
                          <button
                            type="button"
                            onClick={handleClearSpecific}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-md text-[9px] font-bold text-slate-700 transition cursor-pointer"
                          >
                            Filtreli Temizle
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Personel ara..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                        />
                        <div className="relative shrink-0">
                          <select
                            value={selectedSelectDept}
                            onChange={(e) => setSelectedSelectDept(e.target.value)}
                            className="border border-slate-300 rounded-xl pl-2.5 pr-8 py-1.5 text-xs bg-white font-bold text-slate-700 appearance-none cursor-pointer"
                          >
                            <option value="">Tüm Departmanlar</option>
                            {departments.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                        </div>
                      </div>

                      <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-white space-y-1">
                        {filteredEmployeesForSelection.length > 0 ? (
                          filteredEmployeesForSelection.map((emp) => {
                            const isSelected = selectedUserIds.includes(emp.userId!);
                            const empName = `${emp.firstName} ${emp.lastName}`;
                            return (
                              <div
                                key={emp.id}
                                onClick={() => handleUserToggle(emp.userId!)}
                                className={`p-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                                  isSelected ? 'bg-blue-50 text-blue-900 border border-blue-100 font-bold' : 'hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold ${getInitialsColor(empName)}`}>
                                    {getInitials(empName)}
                                  </div>
                                  <span>{empName} <span className="opacity-60 text-[10px]">({emp.department})</span></span>
                                </div>
                                {isSelected ? (
                                  <span className="text-blue-600 font-bold text-xs">✓</span>
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-white" />
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-4 text-slate-500 text-xs italic">
                            Kayıtlı personel bulunamadı.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Title & Message */}
                <div className="space-y-6 flex flex-col justify-between">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-700">Duyuru Başlığı</label>
                      <span className={`text-[9px] font-semibold ${title.length > 100 ? 'text-red-500' : 'text-slate-400'}`}>
                        {title.length} / 120
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                      Duyurunun ana konusunu kısaca açıklayan net bir başlık giriniz.
                    </p>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      placeholder="Örn: Su Kesintisi Hakkında Bilgilendirme..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-slate-700">Duyuru Mesajı</label>
                      <span className={`text-[9px] font-semibold ${message.length > 1800 ? 'text-red-500' : 'text-slate-400'}`}>
                        {message.length} / 2000
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                      Duyuru detaylarını (tarih, saat, lokasyon ve talimatlar gibi) içeren metni buraya giriniz.
                    </p>
                    <textarea
                      rows={12}
                      required
                      maxLength={2000}
                      placeholder="Duyuru mesaj detaylarını yazınız..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition resize-none leading-relaxed min-h-[260px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-300"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSending || !title.trim() || !message.trim()}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer border-none"
                >
                  {isSending ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* GRADIENT DETAY MODALI (Arıza Kayıtlarındaki Tasarıma Birebir Uyumlu) */}
      {selectedDetailNotif && (
        <div
          className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fadeIn"
          onMouseDown={() => setSelectedDetailNotif(null)}
        >
          <div
            className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Gradient */}
            <div className="bg-gradient-to-r from-slate-900 via-[#1e3a8a] to-slate-900 p-6 text-white flex items-start justify-between relative shrink-0">
              <div className="space-y-1.5 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Priority Badge */}
                  {selectedDetailNotif.priority === 'URGENT' ? (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 w-fit uppercase">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-700" /> ACİL Öncelik
                    </span>
                  ) : selectedDetailNotif.priority === 'IMPORTANT' ? (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1.5 w-fit uppercase">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-700" /> Önemli Öncelik
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 w-fit uppercase">
                      <Info className="w-3.5 h-3.5 text-blue-700" /> Normal Öncelik
                    </span>
                  )}

                  {/* Target Group Badge */}
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold bg-white/10 text-blue-100 border border-white/20">
                    {selectedDetailNotif.targetType === 'ALL'
                      ? 'Tüm Lojman'
                      : selectedDetailNotif.targetType === 'BLOCK'
                      ? `Blok (${selectedDetailNotif.targetValue})`
                      : selectedDetailNotif.targetType === 'DEPARTMENT'
                      ? `Departman (${selectedDetailNotif.targetValue})`
                      : 'Özel Kişiler'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white pt-1">{selectedDetailNotif.title || 'Duyuru Detayı'}</h2>
                <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-blue-300" /> Lojman Yönetim Bildirimi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailNotif(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs font-semibold text-slate-700">
              {/* Duyuru Mesajı */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#1e3a8a]" /> Duyuru Mesajı & İçerik Detayı
                </h4>
                <p className="text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap break-words">
                  {selectedDetailNotif.message}
                </p>
              </div>

              {/* Detay Bilgi Kartları Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Gönderen Yetkili */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" /> Gönderen Yetkili
                  </span>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {selectedDetailNotif.senderName || 'Sistem Yöneticisi'}
                  </div>
                </div>

                {/* Gönderim Zamanı */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Gönderim Zamanı
                  </span>
                  <div className="font-extrabold text-slate-900 text-sm">
                    {new Date(selectedDetailNotif.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Istanbul',
                    })}
                  </div>
                </div>
              </div>

              {/* Alıcı Personel Listesi */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#1e3a8a]" /> Alıcı Personel Listesi ({selectedDetailNotif.totalRecipients} Kişi)
                  </h4>
                  <div className="relative font-normal">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Alıcı ara..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-[11px] border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#1e3a8a] w-full sm:w-40 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-200/60 p-2 bg-white space-y-1">
                    {filteredRecipients.length > 0 ? (
                      filteredRecipients.map((rec, i) => {
                        const recName = rec.fullName;
                        return (
                          <div key={i} className="flex items-center gap-2 py-2 px-2 text-xs">
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${getInitialsColor(recName)}`}>
                              {getInitials(recName)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800">{recName}</span>
                              <span className="text-[10px] text-slate-500 ml-1.5">@{rec.username}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        {modalSearch ? 'Arama kriterine uygun alıcı bulunamadı.' : 'Alıcı listesi mevcut değil.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDetailNotif(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
