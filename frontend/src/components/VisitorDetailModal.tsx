import React from 'react';
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  FilePenLine,
  FileText,
  LogOut,
  MapPin,
  Phone,
  RotateCcw,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { Visitor } from '../api/visitorApi';

interface VisitorDetailModalProps {
  visitor: Visitor | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (visitor: Visitor) => void;
  onCheckOut?: (visitor: Visitor) => void;
  onUndoCheckOut?: (visitor: Visitor) => void;
}

export const VisitorDetailModal: React.FC<VisitorDetailModalProps> = ({
  visitor,
  isOpen,
  onClose,
  onEdit,
  onCheckOut,
  onUndoCheckOut,
}) => {
  if (!isOpen || !visitor) return null;

  const formatter = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });

  const formatDateWithTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return formatter.format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatPhone = (phone?: string | null) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('0')) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 9)} ${clean.slice(9, 11)}`;
    }
    if (clean.length === 10) {
      return `0${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)}`;
    }
    return phone;
  };

  const isInside = !visitor.exitTime && visitor.status === 'INSIDE';

  const renderStatusBadge = () => {
    if (visitor.isDeleted) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 w-fit">
          <Clock className="w-3.5 h-3.5 text-rose-600" /> ARŞİVLENDİ
        </span>
      );
    }
    if (isInside) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 w-fit">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> İÇERİDE
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1.5 w-fit">
        <Clock className="w-3.5 h-3.5 text-slate-500" /> ÇIKIŞ YAPILDI
      </span>
    );
  };

  const createdByName = visitor.createdBy?.fullName || 'Bilinmeyen Kullanıcı';
  const updatedByName = visitor.updatedBy?.fullName || 'Bilinmeyen Kullanıcı';
  const deletedByName = visitor.deletedBy?.fullName || 'Bilinmeyen Kullanıcı';

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
              {renderStatusBadge()}
              {visitor.visitorCount > 1 && (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-blue-100 border border-white/20 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> +{visitor.visitorCount} Kişi
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-white pt-1">{visitor.fullName}</h2>
            {visitor.company ? (
              <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {visitor.company}
              </p>
            ) : (
              <p className="text-xs font-semibold text-blue-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Bireysel Ziyaretçi
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
          {/* Ziyaret Amacı */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#1e3a8a]" /> Ziyaret Nedeni & Amacı
            </h4>
            <p className="text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap break-words">
              {visitor.purpose || 'Belirtilmemiş'}
            </p>
          </div>

          {/* Detay Bilgi Kartları Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Telefon */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> Telefon Numarası
              </span>
              <p className="text-sm font-extrabold text-slate-900">{formatPhone(visitor.phone)}</p>
            </div>

            {/* Plaka */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-slate-500" /> Araç Plakası
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {visitor.vehiclePlate ? (
                  <span className="px-2 py-0.5 rounded-md border border-slate-300 bg-slate-50 font-mono tracking-wider">
                    {visitor.vehiclePlate.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-slate-400 font-semibold italic">Yaya / Belirtilmemiş</span>
                )}
              </p>
            </div>

            {/* Ziyaret Edilen Personel */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" /> Ziyaret Edilen Personel
              </span>
              <p className="text-sm font-extrabold text-slate-900">
                {visitor.hostEmployeeName || 'Bilinmeyen Personel'}
              </p>
            </div>

            {/* Konum / Oda */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Lojman Konum / Oda Detayı
              </span>
              <p className="text-sm font-extrabold text-[#1e3a8a]">
                {visitor.hostRoomLabel || 'Konum Bilgisi Yok'}
              </p>
            </div>

            {/* Giriş Tarihi */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Giriş Zamanı
              </span>
              <p className="text-xs font-extrabold text-slate-900">
                {formatDateWithTime(visitor.entryTime)}
              </p>
            </div>

            {/* Çıkış Tarihi */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Çıkış Zamanı
              </span>
              <p className="text-xs font-extrabold text-slate-900">
                {visitor.exitTime ? (
                  formatDateWithTime(visitor.exitTime)
                ) : (
                  <span className="text-emerald-600 font-extrabold italic">Henüz çıkış yapmadı</span>
                )}
              </p>
            </div>

            {/* Kaydeden Personel */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Kaydı Oluşturan
              </span>
              <p className="text-xs font-extrabold text-slate-900">{createdByName}</p>
            </div>

            {/* Son Güncelleyen VEYA Arşivleyen Yetkili */}
            {visitor.isDeleted ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-rose-600" /> Arşivleyen / Silen Yetkili
                </span>
                <p className="text-xs font-extrabold text-rose-900">{deletedByName}</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Son Güncelleyen
                </span>
                <p className="text-xs font-extrabold text-slate-900">
                  {visitor.updatedAt !== visitor.createdAt ? updatedByName : '-'}
                </p>
              </div>
            )}
          </div>

          {/* Notlar */}
          {visitor.notes && (
            <div className="space-y-1.5 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 text-amber-950">
              <h4 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                <FileText className="w-4 h-4 text-amber-600" /> Not
              </h4>
              <p className="text-amber-900 leading-relaxed font-semibold whitespace-pre-wrap break-words">
                {visitor.notes}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {!visitor.isDeleted &&
              (isInside ? (
                onCheckOut && (
                  <button
                    type="button"
                    onClick={() => {
                      onCheckOut(visitor);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Çıkış Yap</span>
                  </button>
                )
              ) : (
                onUndoCheckOut && (
                  <button
                    type="button"
                    onClick={() => {
                      onUndoCheckOut(visitor);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Çıkış İşlemini Geri Al</span>
                  </button>
                )
              ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!visitor.isDeleted && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(visitor);
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
