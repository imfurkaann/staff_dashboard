import React, { useEffect, useState, useMemo } from 'react';
import {
  BedDouble,
  Building2,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  Cigarette,
  CigaretteOff,
  Moon,
  Layers,
  X,
  Loader2,
  AlertTriangle,
  Building,
  Phone,
  Briefcase,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { roomApi, Room, RoomStatusType, BlockSummary } from '../api/roomApi';
import { RoomDetailView } from './RoomDetailView';
import { RoomOccupancyExportModal, ReportCategory } from './RoomOccupancyExportModal';
import { User } from '../api/authApi';
import { can } from '../security/accessControl';

type GroupByMode = 'block' | 'floor';

interface RoomManagementViewProps {
  onNavigateTo?: (tab: string, empId?: string) => void;
  currentUser: User;
}

export const RoomManagementView: React.FC<RoomManagementViewProps> = ({ onNavigateTo, currentUser }) => {
  const canManageRooms = can(currentUser.role, 'ROOM_MANAGE');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoomDetail, setActiveRoomDetail] = useState<Room | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<'room' | 'block' | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ blockId: '', floor: '1', roomNumber: '', capacity: '2', isSpecialFacility: false, roomType: 'ÇAMAŞIRHANE' });
  const [blockForm, setBlockForm] = useState({ name: '', genderPolicy: 'Mixed' });

  const getRoomTypeBadge = (roomType?: string | null) => {
    if (!roomType || roomType === 'PERSONEL_ODASI') return null;
    const badges: Record<string, { label: string; style: string }> = {
      'ÇAMAŞIRHANE': { label: '🧺 ÇAMAŞIRHANE', style: 'bg-blue-100 text-blue-900 border-blue-300' },
      'DEPO': { label: '📦 DEPO', style: 'bg-amber-100 text-amber-900 border-amber-300' },
      'DUŞHANE': { label: '🚿 DUŞHANE', style: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
      'MESCİT': { label: '🕌 MESCİT', style: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
      'TEKNİK_ODA': { label: '🛠️ TEKNİK ODA', style: 'bg-purple-100 text-purple-900 border-purple-300' },
      'MUTFAK': { label: '🍽️ MUTFAK', style: 'bg-orange-100 text-orange-900 border-orange-300' },
      'LOBİ': { label: '🛋️ LOBİ', style: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
      'SPOR_SALONU': { label: '🏋️ SPOR SALONU', style: 'bg-rose-100 text-rose-900 border-rose-300' },
      'GÜVENLİK': { label: '🛡️ GÜVENLİK', style: 'bg-slate-200 text-slate-900 border-slate-400' },
      'DİĞER': { label: '🚪 HİZMET ALANI', style: 'bg-slate-100 text-slate-800 border-slate-300' },
    };
    const b = badges[roomType] || { label: `🚪 ${roomType}`, style: 'bg-slate-100 text-slate-800 border-slate-300' };
    return (
      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${b.style}`}>
        {b.label}
      </span>
    );
  };

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSelectEmployee = (e: React.MouseEvent, empId: string) => {
    e.stopPropagation();
    localStorage.setItem('staff_app_active_emp_id', empId);
    localStorage.setItem('staff_app_active_tab', 'employees');
    if (onNavigateTo) {
      onNavigateTo('employees', empId);
    }
  };

  // Grouping & Filtering state
  const [groupBy, setGroupBy] = useState<GroupByMode>('block'); // 'block' or 'floor'
  const [selectedBlockId, setSelectedBlockId] = useState<string>('ALL');
  const [selectedFloor, setSelectedFloor] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOccupancy, setSelectedOccupancy] = useState<string>('ALL'); // 'ALL' | 'FULL' | 'EMPTY' | 'PARTIAL'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch rooms & blocks data
  const fetchRooms = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [roomsData, blocksData] = await Promise.all([
        roomApi.getRooms(),
        roomApi.getBlocks(),
      ]);
      setRooms(roomsData);
      setBlocks(blocksData);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Oda ve yatak bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // Quick room status update handler
  const handleStatusChange = async (roomId: string, newStatus: RoomStatusType) => {
    try {
      const updated = await roomApi.updateRoomStatus(roomId, newStatus);
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status: updated.status } : r)));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Oda durumu güncellenemedi.');
    }
  };

  const openRoomDetail = async (roomId: string) => {
    setDetailLoadingId(roomId);
    setError(null);
    try {
      setActiveRoomDetail(await roomApi.getRoomById(roomId));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Oda detayları yüklenemedi.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const openCreateModal = (type: 'room' | 'block') => {
    setCreateError(null);
    if (type === 'room') setRoomForm((prev) => ({ ...prev, blockId: prev.blockId || availableBlocks[0]?.id || '' }));
    setCreateModal(type);
  };

  const handleCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      if (createModal === 'room') {
        await roomApi.createRoom({
          blockId: roomForm.blockId,
          floor: Number(roomForm.floor),
          roomNumber: roomForm.roomNumber,
          capacity: roomForm.isSpecialFacility ? 0 : Number(roomForm.capacity),
          roomType: roomForm.isSpecialFacility ? roomForm.roomType : 'PERSONEL_ODASI',
        });
        setRoomForm((prev) => ({ ...prev, roomNumber: '', capacity: prev.isSpecialFacility ? '0' : '2' }));
      } else if (createModal === 'block') {
        await roomApi.createBlock(blockForm);
        setBlockForm({ name: '', genderPolicy: 'Mixed' });
      }
      setCreateModal(null);
      await fetchRooms(true);
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || err?.message || 'Kayıt oluşturulamadı.');
    } finally { setCreateSubmitting(false); }
  };

  // Available unique blocks and floors
  const availableBlocks = useMemo(() => {
    if (blocks.length > 0) {
      return blocks.map((b) => ({ id: b.id, name: b.name }));
    }
    const map = new Map<string, string>();
    rooms.forEach((r) => map.set(r.blockId, r.block.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [blocks, rooms]);

  const availableFloors = useMemo(() => {
    const floorSet = new Set<number>();
    rooms.forEach((r) => floorSet.add(r.floor));
    return Array.from(floorSet).sort((a, b) => a - b);
  }, [rooms]);

  // Filtered rooms strictly matching:
  // - Block, Floor, Status, Occupancy
  // - Search Query ONLY matching Oda No or Personel Adı
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Block filter
      if (selectedBlockId !== 'ALL' && room.blockId !== selectedBlockId) {
        return false;
      }
      // Floor filter
      if (selectedFloor !== 'ALL' && room.floor !== Number(selectedFloor)) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && room.status !== selectedStatus) {
        return false;
      }
      // Occupancy state filter (Dolu, Boş, Yarı Dolu)
      if (selectedOccupancy !== 'ALL') {
        if (room.roomType && room.roomType !== 'PERSONEL_ODASI') return false;
        const occupiedCount = room.beds.filter((b) => b.isOccupied).length;
        if (selectedOccupancy === 'FULL' && occupiedCount < room.capacity) {
          return false;
        }
        if (selectedOccupancy === 'EMPTY' && occupiedCount > 0) {
          return false;
        }
        if (selectedOccupancy === 'PARTIAL' && (occupiedCount === 0 || occupiedCount >= room.capacity)) {
          return false;
        }
      }
      // Search query ONLY matching Oda No or Personel Adı
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesRoom = room.roomNumber.toLowerCase().includes(query);
        const matchesEmployeeName = room.beds.some((bed) => {
          if (!bed.currentEmployee) return false;
          const fullName = `${bed.currentEmployee.firstName} ${bed.currentEmployee.lastName}`.toLowerCase();
          return fullName.includes(query);
        });

        if (!matchesRoom && !matchesEmployeeName) {
          return false;
        }
      }
      return true;
    });
  }, [rooms, selectedBlockId, selectedFloor, selectedStatus, selectedOccupancy, searchQuery]);

  // Grouped rooms data structure
  const groupedData = useMemo(() => {
    if (groupBy === 'block') {
      const groups: { [key: string]: { title: string; subtitle?: string; rooms: Room[] } } = {};
      filteredRooms.forEach((room) => {
        const key = room.block.name;
        if (!groups[key]) {
          groups[key] = {
            title: key,
            subtitle:
              room.block.genderPolicy === 'Male'
                ? 'Erkek Lojman Bloğu'
                : room.block.genderPolicy === 'Female'
                  ? 'Kadın Lojman Bloğu'
                  : 'Karma Lojman Bloğu',
            rooms: [],
          };
        }
        groups[key].rooms.push(room);
      });
      return Object.values(groups);
    } else {
      // Group by Floor
      const groups: { [key: number]: { title: string; subtitle?: string; rooms: Room[] } } = {};
      filteredRooms.forEach((room) => {
        const key = room.floor;
        if (!groups[key]) {
          groups[key] = {
            title: room.floor === 0 ? 'Zemin Kat (0. Kat)' : `${room.floor}. Kat`,
            subtitle: `${room.floor}. katta bulunan odalar`,
            rooms: [],
          };
        }
        groups[key].rooms.push(room);
      });

      // Sort by floor number ascending
      return Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b)
        .map((floorNum) => groups[floorNum]);
    }
  }, [filteredRooms, groupBy]);

  if (activeRoomDetail) {
    return (
      <RoomDetailView
        room={activeRoomDetail}
        currentUser={currentUser}
        onBack={() => setActiveRoomDetail(null)}
        onRoomUpdated={(updated) => {
          setActiveRoomDetail(updated);
          setRooms((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
        onNavigateToEmployee={(empId) => {
          setActiveRoomDetail(null);
          if (onNavigateTo) {
            onNavigateTo('employees', empId);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Filter & Grouping Control Bar */}
      <div className="bg-white border border-slate-300 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Grouping Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full lg:w-auto overflow-x-auto shrink-0">
            <button
              onClick={() => setGroupBy('block')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                groupBy === 'block'
                  ? 'bg-[#1e3a8a] text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Blok Blok Sırala</span>
            </button>
            <button
              onClick={() => setGroupBy('floor')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                groupBy === 'floor'
                  ? 'bg-[#1e3a8a] text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kat Kat Sırala</span>
            </button>
          </div>

          {/* Filter Dropdowns, Action Buttons & Search Box */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* 1. Block Filter Dropdown */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">
              <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
              >
                <option value="ALL">Tüm Bloklar</option>
                {availableBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Floor Filter Dropdown */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
              >
                <option value="ALL">Tüm Katlar</option>
                {availableFloors.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? 'Zemin Kat (0)' : `${f}. Kat`}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Occupancy Filter Dropdown */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedOccupancy}
                onChange={(e) => setSelectedOccupancy(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
              >
                <option value="ALL">Tüm Doluluklar</option>
                <option value="EMPTY">🟢 Boş Odalar</option>
                <option value="PARTIAL">🟡 Yarı Dolu</option>
                <option value="FULL">🔴 Tam Dolu</option>
              </select>
            </div>

            {/* 4. Room Status Filter Dropdown */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer text-slate-800 font-bold"
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="READY">🟢 Hazır</option>
                <option value="NEEDS_CLEANING">🟡 Temizlik</option>
                <option value="OUT_OF_ORDER">🔴 Arızalı</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] lg:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Oda No veya Personel..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#1e3a8a] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => openCreateModal('block')}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:border-[#1e3a8a] hover:text-[#1e3a8a] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              Yeni Blok
            </button>
            <button
              onClick={() => openCreateModal('room')}
              disabled={availableBlocks.length === 0}
              className="px-3.5 py-2 rounded-xl border border-[#1e3a8a] bg-[#1e3a8a] text-white hover:bg-blue-900 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Oda
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Rapor / Çıktı Al</span>
            </button>
            <button
              onClick={() => fetchRooms(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
              title="Yenile"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1e3a8a]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Width Grid */}
      {loading ? (
        <div className="bg-white border border-slate-300 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#1e3a8a] animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-700">Odalar ve konaklayan sakinler yükleniyor...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center text-rose-800">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-bold text-sm">{error}</p>
          <button
            onClick={() => fetchRooms()}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
          >
            Tekrar Deneyin
          </button>
        </div>
      ) : groupedData.length === 0 ? (
        <div className="bg-white border border-slate-300 rounded-3xl p-12 text-center text-slate-500">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Filtrelere Uygun Oda Bulunamadı</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Oda numarası veya personel adını kontrol edebilir ya da filtreleri sıfırlayabilirsiniz.
          </p>
        </div>
      ) : (
        /* LISTED ROOMS BY GROUP (BLOCK OR FLOOR) */
        <div className="space-y-6">
          {groupedData.map((group, groupIdx) => {
            const totalGroupRooms = group.rooms.length;
            let totalGroupCapacity = 0;
            let occupiedGroupBeds = 0;

            group.rooms.forEach((r) => {
              totalGroupCapacity += r.capacity;
              r.beds.forEach((b) => {
                if (b.isOccupied) occupiedGroupBeds++;
              });
            });

            const groupOccupancyRate =
              totalGroupCapacity > 0 ? Math.round((occupiedGroupBeds / totalGroupCapacity) * 100) : 0;

            return (
              <div key={groupIdx} className="space-y-4">
                {/* Group Header Banner - Clean White Design */}
                <div className="flex items-center justify-between bg-white border border-slate-300 rounded-2xl px-5 py-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1e3a8a]/10 flex items-center justify-center text-[#1e3a8a] font-bold shrink-0">
                      {groupBy === 'block' ? <Building2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900 tracking-tight">{group.title}</h2>
                      {group.subtitle && (
                        <p className="text-[11px] font-semibold text-slate-500">{group.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {totalGroupRooms} Oda • {totalGroupCapacity} Yatak
                    </span>
                    <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-50 text-[#1e3a8a] border border-blue-200">
                      %{groupOccupancyRate} Doluluk
                    </span>
                  </div>
                </div>

                {/* Rooms Grid under this Group - Perfectly fitting responsive grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 w-full">
                  {group.rooms.map((room) => {
                    const occupiedCount = room.beds.filter((b) => b.isOccupied).length;
                    const isSpecialFacility = Boolean(room.roomType && room.roomType !== 'PERSONEL_ODASI');

                    return (
                      <div
                        key={room.id}
                        className="bg-white border border-slate-300 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[175px]"
                      >
                        <div>
                          {/* Room Card Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                            <div
                              onClick={() => openRoomDetail(room.id)}
                              className="flex items-center gap-2.5 cursor-pointer group/title hover:opacity-80 transition-opacity"
                              title="Oda detaylarını ve zimmetlerini incelemek için tıklayın"
                            >
                              <div className="w-10 h-10 rounded-2xl bg-[#1e3a8a] text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-950/20 shrink-0 group-hover/title:bg-blue-900 transition-colors">
                                {room.roomNumber}
                              </div>
                              <div>
                                <h3 className="font-extrabold text-slate-900 text-sm group-hover/title:text-[#1e3a8a] transition-colors flex items-center gap-1.5">
                                  {isSpecialFacility ? room.roomNumber : `Oda ${room.roomNumber}`}{detailLoadingId === room.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1e3a8a]" />}
                                </h3>
                                <p className="text-[11px] font-semibold text-slate-500">
                                  {room.block.name} • {room.floor === 0 ? 'Zemin Kat' : `${room.floor}. Kat`} {!isSpecialFacility && <>• <span className="font-extrabold text-[#1e3a8a]">{occupiedCount}/{room.capacity} Yatak</span></>}
                                </p>
                              </div>
                            </div>

                            {/* Status Selector Dropdown */}
                            <select
                              value={room.status}
                              onChange={(e) => handleStatusChange(room.id, e.target.value as RoomStatusType)}
                              className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl cursor-pointer focus:outline-none border ${room.status === 'READY'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : room.status === 'NEEDS_CLEANING'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                            >
                              <option value="READY">🟢 Hazır</option>
                              <option value="NEEDS_CLEANING">🟡 Temizlik</option>
                              <option value="OUT_OF_ORDER">🔴 Arızalı</option>
                            </select>
                          </div>

                          {/* Residents / Bed Slots List */}
                          <div className="space-y-2">
                            {isSpecialFacility && (
                              <div className="flex min-h-16 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center">
                                <div><div>{getRoomTypeBadge(room.roomType)}</div><p className="mt-1.5 text-[10px] font-semibold text-slate-500">Personel yerleşimine kapalı hizmet alanı</p></div>
                              </div>
                            )}
                            <div className={`space-y-2 ${room.beds.length > 2 ? 'max-h-[135px] overflow-y-auto pr-1' : ''}`}>
                              {room.beds.map((bed) => {
                                const emp = bed.currentEmployee;

                                return (
                                  <div
                                    key={bed.id}
                                    onClick={(e) => {
                                      if (bed.isOccupied && emp) {
                                        handleSelectEmployee(e, emp.id);
                                      }
                                    }}
                                    title={bed.isOccupied && emp ? `${emp.firstName} ${emp.lastName} personel detayını görüntülemek için tıklayın` : ''}
                                    className={`p-2.5 rounded-2xl border transition-all ${bed.isOccupied && emp
                                        ? 'bg-slate-50/90 hover:bg-blue-50/90 border-slate-200 hover:border-[#1e3a8a] cursor-pointer shadow-2xs hover:shadow-xs group/resident'
                                        : 'bg-emerald-50/30 border-emerald-200 border-dashed flex items-center justify-between text-emerald-800'
                                      }`}
                                  >
                                    {bed.isOccupied && emp ? (
                                      /* Resident Details - 2 Line Spacious Clean Layout */
                                      <div className="space-y-1">
                                        {/* Row 1: Avatar, Name & Badges */}
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {emp.photoUrl ? (
                                              <img
                                                src={emp.photoUrl}
                                                alt={emp.firstName}
                                                className="w-7 h-7 rounded-lg object-cover border border-slate-300 shrink-0"
                                              />
                                            ) : (
                                              <div className="w-7 h-7 rounded-lg bg-[#1e3a8a] text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs">
                                                {emp.firstName.charAt(0)}
                                                {emp.lastName.charAt(0)}
                                              </div>
                                            )}
                                            <span className="text-xs font-black text-slate-900 truncate">
                                              {emp.firstName} {emp.lastName}
                                            </span>
                                          </div>

                                          {/* Room Compatibility Badges */}
                                          <div className="flex items-center gap-1 shrink-0">
                                            <span
                                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold flex items-center gap-0.5 border ${emp.isSmoker ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                }`}
                                              title={emp.isSmoker ? 'Sigara Kullanıyor' : 'Sigara Kullanmıyor'}
                                            >
                                              {emp.isSmoker ? <Cigarette className="w-3 h-3 text-amber-700" /> : <CigaretteOff className="w-3 h-3 text-emerald-700" />}
                                              <span>{emp.isSmoker ? 'Sigaralı' : 'Sigarasız'}</span>
                                            </span>

                                            {emp.hasSnoring && (
                                              <span
                                                className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-indigo-50 text-indigo-900 border border-indigo-200 flex items-center gap-0.5"
                                                title="Horlama Durumu Var"
                                              >
                                                <Moon className="w-3 h-3 text-indigo-700" />
                                                <span>Horlama</span>
                                              </span>
                                            )}

                                            {emp.shiftType && (
                                              <span
                                                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                                title="Vardiya Düzeni"
                                              >
                                                {emp.shiftType}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Row 2: Department, Title & Company (Strict 1-line Truncate, No Wrap) */}
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 pl-9 min-w-0 overflow-hidden whitespace-nowrap">
                                          <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span className="truncate min-w-0 flex-1">
                                            {emp.department}{emp.title ? ` • ${emp.title}` : ''}
                                          </span>
                                          {emp.company && (
                                            <span
                                              className="text-slate-700 font-extrabold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-[10px] shrink-0 truncate max-w-[85px]"
                                              title={emp.company}
                                            >
                                              {emp.company}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      /* Vacant Bed */
                                      <>
                                        <div className="flex items-center gap-2 text-xs font-bold">
                                          <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>{bed.bedLabel}</span>
                                        </div>
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                                          Boş Yatak (Müsait)
                                        </span>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !createSubmitting && setCreateModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-room-entity-title" onClick={(event) => event.stopPropagation()} className="bg-white border border-slate-300 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center">{createModal === 'room' ? <BedDouble className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}</div><div><h2 id="create-room-entity-title" className="text-base font-extrabold text-slate-900">{createModal === 'room' ? 'Yeni Oda Oluştur' : 'Yeni Blok Oluştur'}</h2><p className="text-xs text-slate-500 font-semibold">{createModal === 'room' ? 'Oda ve yatak kayıtları birlikte oluşturulur.' : 'Oda yerleşimleri için yeni blok tanımlayın.'}</p></div></div><button type="button" onClick={() => setCreateModal(null)} disabled={createSubmitting} className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><X className="w-4 h-4" /></button></div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {createError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">{createError}</div>}
              {createModal === 'room' ? <>
                <label className="block text-xs font-bold text-slate-700">Blok<select required value={roomForm.blockId} onChange={(e) => setRoomForm((prev) => ({ ...prev, blockId: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold outline-none focus:border-[#1e3a8a]">{availableBlocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}</select></label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-700">Oda Numarası / Oda Adı *
                    <input required maxLength={50} value={roomForm.roomNumber} onChange={(e) => setRoomForm((prev) => ({ ...prev, roomNumber: e.target.value.toLocaleUpperCase('tr-TR') }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-[#1e3a8a]" placeholder="Ör. 218 veya ÇAMAŞIRHANE ODASI" />
                  </label>
                  <label className="block text-xs font-bold text-slate-700">Kat
                    <input required type="number" min={-5} max={200} value={roomForm.floor} onChange={(e) => setRoomForm((prev) => ({ ...prev, floor: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-[#1e3a8a]" />
                  </label>
                </div>

                <fieldset className="grid grid-cols-2 gap-2" aria-label="Alan türü">
                  <button type="button" onClick={() => setRoomForm((prev) => ({ ...prev, isSpecialFacility: false, capacity: prev.capacity === '0' ? '2' : prev.capacity }))} className={`rounded-xl border p-3 text-left transition ${!roomForm.isSpecialFacility ? 'border-[#1e3a8a] bg-blue-50 ring-1 ring-[#1e3a8a]' : 'border-slate-300 bg-white'}`}>
                    <span className="block text-xs font-extrabold text-slate-900">Konaklama Odası</span>
                    <span className="mt-1 block text-[10px] font-semibold text-slate-500">Personel ve yatak kapasitesi olan oda</span>
                  </button>
                  <button type="button" onClick={() => setRoomForm((prev) => ({ ...prev, isSpecialFacility: true, capacity: '0' }))} className={`rounded-xl border p-3 text-left transition ${roomForm.isSpecialFacility ? 'border-[#1e3a8a] bg-blue-50 ring-1 ring-[#1e3a8a]' : 'border-slate-300 bg-white'}`}>
                    <span className="block text-xs font-extrabold text-slate-900">Ortak / Hizmet Alanı</span>
                    <span className="mt-1 block text-[10px] font-semibold text-slate-500">Depo, çamaşırhane, mutfak vb.</span>
                  </button>
                </fieldset>

                {roomForm.isSpecialFacility ? (
                  <label className="block text-xs font-bold text-slate-700">Alan Türü *
                    <select required value={roomForm.roomType} onChange={(e) => setRoomForm((prev) => ({ ...prev, roomType: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold outline-none focus:border-[#1e3a8a]">
                      <option value="ÇAMAŞIRHANE">Çamaşırhane</option><option value="DEPO">Depo</option><option value="DUŞHANE">Duşhane</option><option value="MESCİT">Mescit</option><option value="TEKNİK_ODA">Teknik Oda</option><option value="MUTFAK">Mutfak</option><option value="LOBİ">Lobi</option><option value="SPOR_SALONU">Spor Salonu</option><option value="GÜVENLİK">Güvenlik</option><option value="DİĞER">Diğer Hizmet Alanı</option>
                    </select>
                  </label>
                ) : (
                  <label className="block text-xs font-bold text-slate-700">Yatak Kapasitesi *
                    <input required type="number" min={1} max={26} value={roomForm.capacity} onChange={(e) => setRoomForm((prev) => ({ ...prev, capacity: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-[#1e3a8a]" />
                    <span className="mt-1 block text-[10px] font-semibold text-slate-500">Yalnızca konaklama odaları için yatak oluşturulur.</span>
                  </label>
                )}
              </> : <>
                <label className="block text-xs font-bold text-slate-700">Blok Adı<input required maxLength={50} value={blockForm.name} onChange={(e) => setBlockForm((prev) => ({ ...prev, name: e.target.value.toLocaleUpperCase('tr-TR') }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-[#1e3a8a]" placeholder="Ör. B BLOK" /></label>
                <label className="block text-xs font-bold text-slate-700">Yerleşim Politikası<select value={blockForm.genderPolicy} onChange={(e) => setBlockForm((prev) => ({ ...prev, genderPolicy: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold outline-none focus:border-[#1e3a8a]"><option value="Mixed">Karma</option><option value="Male">Erkek</option><option value="Female">Kadın</option></select></label>
              </>}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2"><button type="button" onClick={() => setCreateModal(null)} disabled={createSubmitting} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">İptal</button><button type="submit" disabled={createSubmitting || (createModal === 'room' && !roomForm.blockId)} className="px-5 py-2.5 rounded-xl bg-[#1e3a8a] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">{createSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{createSubmitting ? 'Kaydediliyor...' : 'Kaydı Oluştur'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ODA & KONAKLAYANLAR / DEMİRBAŞ EXCEL EKSPORT MODALI */}
      <RoomOccupancyExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        isExporting={isExporting}
        onExport={async (category: ReportCategory, filter: string, startDate?: string, endDate?: string) => {
          setIsExporting(true);
          try {
            if (category === 'OCCUPANCY') {
              await roomApi.exportOccupancyExcel(filter, startDate, endDate);
            } else {
              await roomApi.exportRoomInventoryExcel(filter);
            }
            setIsExportModalOpen(false);
          } catch (err: any) {
            alert(err.message || 'Excel raporu indirilirken bir hata oluştu.');
          } finally {
            setIsExporting(false);
          }
        }}
      />
    </div>
  );
};
