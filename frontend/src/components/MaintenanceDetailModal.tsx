import React from 'react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FilePenLine,
  FileText,
  MapPin,
  RotateCcw,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { MaintenanceLog, MaintenancePriority, MaintenanceStatus } from '../api/maintenanceApi';

interface MaintenanceDetailModalProps {
  log: MaintenanceLog | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (log: MaintenanceLog) => void;
  onStatusChange?: (log: MaintenanceLog, newStatus: MaintenanceStatus) => void;
  currentUserFullName?: string;
}

export const MaintenanceDetailModal: React.FC<MaintenanceDetailModalProps> = ({
  log,
  isOpen,
  onClose,
  onEdit,
  onStatusChange,
  currentUserFullName = 'Lojman Yönetimi',
}) => {
  if (!isOpen || !log) return null;

  const formatDateWithTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderPriorityBadge = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> ACİL Öncelik
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1.5 w-fit">
            <AlertTriangle className="w-3.5 h-3.5" /> Yüksek Öncelik
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" /> Orta Öncelik
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5" /> Düşük Öncelik
          </span>
        );
    }
  };

  const renderStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Çözüldü / Tamamlandı
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 w-fit">
            <Wrench className="w-3.5 h-3.5 text-blue-600" /> İşlemde (Teknisyen İlgileniyor)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 w-fit">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Açık Bildirim
          </span>
        );
    }
  };

  const reportedByName =
    log.reportedBy && log.reportedBy !== 'Sistem Kullanıcısı'
      ? log.reportedBy
      : currentUserFullName;

  const resolvedByName =
    log.assignedTo ||
    (log.status === 'RESOLVED' || log.status === 'CLOSED' ? currentUserFullName : null);

  return (
    <div
      className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#1e3a8a] to-slate-900 p-6 text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1.5 pr-8">
            <div className="flex flex-wrap items-center gap-2">
              {renderPriorityBadge(log.priority)}
              {renderStatusBadge(log.status)}
              {log.category && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-blue-100 border border-white/20">
                  {log.category}
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-white pt-1">{log.title || 'Arıza Detayı'}</h2>
            {log.room ? (
              <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {log.room.block.name} — Oda {log.room.roomNumber} ({log.room.floor}. Kat)
              </p>
            ) : (
              <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Genel Lokasyon / Belirtilmemiş
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-semibold text-slate-700">
          {/* Arıza Açıklaması */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#1e3a8a]" /> Arıza Açıklaması & Sorun Detayı
            </h4>
            <p className="text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap">
              {log.description}
            </p>
          </div>

          {/* Lokasyon Detayı */}
          {log.location && (
            <div className="flex items-center gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-900">
              <MapPin className="w-4 h-4 text-[#1e3a8a] shrink-0" />
              <div>
                <strong className="font-bold">Konum / Lokasyon Detayı:</strong>{' '}
                <span>{log.location}</span>
              </div>
            </div>
          )}

          {/* Çözüm Notu */}
          {log.resolutionNote && (
            <div className="space-y-1.5 bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-emerald-950">
              <h4 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Çözüm & Yapılan İşlem Notu
              </h4>
              <p className="text-emerald-900 leading-relaxed font-semibold">
                {log.resolutionNote}
              </p>
            </div>
          )}

          {/* Detay Bilgi Kartları Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Bildiren Kişi */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Bildiren Kişi
              </span>
              <p className="text-sm font-extrabold text-slate-900">{reportedByName}</p>
            </div>

            {/* Çözümleyen Personel */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Çözümleyen Personel
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {resolvedByName || <span className="text-slate-400 font-semibold italic">Henüz Çözülmedi</span>}
              </p>
            </div>

            {/* Açılış Tarihi */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Arıza Bildirim Tarihi
              </span>
              <p className="text-xs font-extrabold text-slate-900">
                {formatDateWithTime(log.createdAt)}
              </p>
            </div>

            {/* Kapanış Tarihi */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Tamamlanma / Kapanış Tarihi
              </span>
              <p className="text-xs font-extrabold text-slate-900">
                {log.resolvedAt ? (
                  formatDateWithTime(log.resolvedAt)
                ) : (
                  <span className="text-slate-400 font-semibold italic">-</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onStatusChange &&
              (log.status === 'RESOLVED' || log.status === 'CLOSED' ? (
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange(log, 'OPEN');
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Çözümü Geri Al (Açık Yap)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onStatusChange(log, 'RESOLVED');
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Çözüldü Olarak İşaretle</span>
                </button>
              ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(log);
                }}
                className="px-4 py-2 rounded-xl bg-blue-50 text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white border border-blue-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FilePenLine className="w-4 h-4" />
                <span>Düzenle</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
