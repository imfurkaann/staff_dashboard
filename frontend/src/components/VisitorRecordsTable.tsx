import React, { useState } from 'react';
import { ArchiveRestore, Car, FilePenLine, FileText, LogOut, Phone, RotateCcw, Trash2, UserCheck, Users, X } from 'lucide-react';
import { Visitor } from '../api/visitorApi';

interface Props {
  visitors: Visitor[];
  loading: boolean;
  busyId?: string | null;
  canManageArchive?: boolean;
  readOnly?: boolean;
  onCheckOut?: (visitor: Visitor) => void;
  onUndoCheckOut?: (visitor: Visitor) => void;
  onEdit?: (visitor: Visitor) => void;
  onDelete?: (visitor: Visitor) => void;
  onRestore?: (visitor: Visitor) => void;
}

const formatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
const formatDate = (value?: string | null) => value ? formatter.format(new Date(value)) : '-';

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

function calculateDuration(entryIso: string, exitIso?: string | null): string {
  try {
    const start = new Date(entryIso).getTime();
    const end = exitIso ? new Date(exitIso).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days} gün ${remHours} saat`;
    }
    if (hours > 0) {
      return `${hours} sa ${minutes} dk`;
    }
    return `${minutes} dk`;
  } catch {
    return '-';
  }
}

const buttonBase = 'group relative inline-flex items-center justify-center h-8 px-2.5 rounded-xl border transition-all duration-500 ease-out shadow-xs hover:shadow-md cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase = 'max-w-0 opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-500 ease-out text-xs font-extrabold whitespace-nowrap overflow-hidden';

export const VisitorRecordsTable: React.FC<Props> = ({ visitors, loading, busyId, canManageArchive, readOnly = false, onCheckOut, onUndoCheckOut, onEdit, onDelete, onRestore }) => {
  const [selectedNote, setSelectedNote] = useState<{ title: string; content: string } | null>(null);

  return (
    <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-300 text-[11px] uppercase tracking-wide font-extrabold text-slate-700">
              <th className="py-2.5 px-3 min-w-[190px]">Ziyaretçi Adı & Telefon</th>
              <th className="py-2.5 px-3 min-w-[90px]">Kişi Sayısı</th>
              <th className="py-2.5 px-3 min-w-[160px]">Geldiği Firma & Plaka</th>
              <th className="py-2.5 px-3 min-w-[170px]">Ziyaret Edilen Personel</th>
              <th className="py-2.5 px-3 min-w-[150px]">Ziyaret Amacı</th>
              <th className="py-2.5 px-3 min-w-[150px]">Giriş Tarihi & Süre</th>
              <th className="py-2.5 px-3 min-w-[130px]">Çıkış Tarihi</th>
              <th className="py-2.5 px-3 min-w-[100px]">Durum</th>
              <th className="py-2.5 px-3 min-w-[150px]">Notlar</th>
              {!readOnly && <th className="py-2.5 px-3 text-right min-w-[140px]">İşlem</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
            {loading ? <tr><td colSpan={readOnly ? 9 : 10} className="p-8 text-center text-slate-500 font-bold">Ziyaretçi kayıtları yükleniyor...</td></tr> : visitors.length === 0 ? <tr><td colSpan={readOnly ? 9 : 10} className="p-8 text-center"><Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" /><p className="text-xs font-extrabold text-slate-800">Ziyaretçi Kaydı Bulunamadı</p><p className="mt-0.5 text-[11px] text-slate-500">Seçilen kriterlere uygun kayıt bulunmuyor.</p></td></tr> : visitors.map((visitor) => {
              const isInside = visitor.status === 'INSIDE';
              const duration = calculateDuration(visitor.entryTime, visitor.exitTime);

              return <tr key={visitor.id} className={`group/row hover:bg-blue-50/35 transition-colors ${visitor.isDeleted ? 'bg-rose-50/40 opacity-75' : ''}`}>
                {/* Ziyaretçi Adı & Belirgin Telefon Numarası */}
                <td className="py-2 px-3 align-top">
                  <div className="flex items-start gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 text-[#1e3a8a] flex items-center justify-center shrink-0 mt-0.5">
                      <UserCheck className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <p className="font-extrabold text-slate-950 text-xs leading-tight">{visitor.fullName}</p>
                      {visitor.phone && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#1e3a8a] bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-md mt-1 whitespace-nowrap shadow-2xs">
                          <Phone className="w-3 h-3 text-[#1e3a8a]" />
                          {formatPhone(visitor.phone)}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Kişi Sayısı (Ayrı Kolon) */}
                <td className="py-2 px-3 align-top whitespace-nowrap">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-extrabold text-slate-700">
                    {visitor.visitorCount || 1} Kişi
                  </span>
                </td>

                {/* Geldiği Firma & Plaka */}
                <td className="py-2 px-3 align-top">
                  <p className="font-extrabold text-slate-900 leading-tight">{visitor.company || 'Bireysel Ziyaretçi'}</p>
                  {visitor.vehiclePlate && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-slate-600">
                      <Car className="w-3 h-3 text-slate-500" />
                      {visitor.vehiclePlate}
                    </span>
                  )}
                </td>

                {/* Ziyaret Edilen Personel */}
                <td className="py-2 px-3 align-top">
                  <p className="font-extrabold text-slate-900 leading-tight">{visitor.hostEmployeeName || '-'}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#1e3a8a]">{visitor.hostRoomLabel || 'Oda ataması yok'}</p>
                </td>

                {/* Ziyaret Amacı */}
                <td className="py-2 px-3 align-top">
                  <p className="font-bold text-slate-800 leading-tight">{visitor.purpose || '-'}</p>
                </td>

                {/* Giriş Tarihi & Yanıp Sönen Yeşil Süre Rozeti */}
                <td className="py-2 px-3 align-top whitespace-nowrap">
                  <p className="font-extrabold text-slate-800 leading-tight">{formatDate(visitor.entryTime)}</p>
                  <div className="mt-0.5">
                    {isInside ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold animate-pulse border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        İçeride ({duration})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        Süre: {duration}
                      </span>
                    )}
                  </div>
                </td>

                {/* Çıkış Tarihi */}
                <td className="py-2 px-3 align-top whitespace-nowrap">
                  <p className={`font-extrabold leading-tight ${isInside ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {isInside ? 'Henüz çıkış yapmadı' : formatDate(visitor.exitTime)}
                  </p>
                </td>

                {/* Durum Kolonu */}
                <td className="py-2 px-3 align-top whitespace-nowrap">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                    visitor.isDeleted
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : isInside
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}>
                    {visitor.isDeleted ? 'ARŞİVLENDİ' : isInside ? 'İÇERİDE' : 'ÇIKIŞ YAPILDI'}
                  </span>
                </td>

                {/* Notlar - Tek Satır Truncate & Tıklayınca Açılan Modal */}
                <td className="py-2 px-3 align-top">
                  <div
                    onClick={() => visitor.notes && setSelectedNote({ title: `${visitor.fullName} - Ziyaretçi Notu`, content: visitor.notes })}
                    className={`max-w-[160px] truncate text-[11px] p-1 rounded-lg transition-all whitespace-nowrap overflow-hidden ${
                      visitor.notes
                        ? 'cursor-pointer bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-900 border border-slate-200/80 hover:border-blue-300 font-extrabold shadow-2xs'
                        : 'text-slate-400 italic font-normal'
                    }`}
                    title={visitor.notes ? "Notun tamamını okumak için tıklayın" : undefined}
                  >
                    {visitor.notes ? visitor.notes : 'Not eklenmemiş'}
                  </div>
                </td>

                {/* İşlem Butonları (Only when not readOnly) */}
                {!readOnly && (
                  <td className="py-2 px-3 align-top">
                    <div className="flex justify-end items-center gap-1.5">
                      {visitor.isDeleted ? (
                        <button disabled={busyId === visitor.id} onClick={() => onRestore && onRestore(visitor)} className={`${buttonBase} bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white border-violet-200/80 hover:border-violet-600`}>
                          <ArchiveRestore className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-500" />
                          <span className={labelBase}>Geri Yükle</span>
                        </button>
                      ) : (
                        <>
                          {isInside ? (
                            <button disabled={busyId === visitor.id} onClick={() => onCheckOut && onCheckOut(visitor)} className={`${buttonBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80 hover:border-emerald-600`}>
                              <LogOut className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-500" />
                              <span className={labelBase}>Çıkış Yap</span>
                            </button>
                          ) : (
                            <button disabled={busyId === visitor.id} onClick={() => onUndoCheckOut && onUndoCheckOut(visitor)} className={`${buttonBase} bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80 hover:border-amber-600`}>
                              <RotateCcw className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-500" />
                              <span className={labelBase}>Geri Al</span>
                            </button>
                          )}
                          <button onClick={() => onEdit && onEdit(visitor)} className={`${buttonBase} bg-blue-50 text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white border-blue-200/80 hover:border-[#1e3a8a]`}>
                            <FilePenLine className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-500" />
                            <span className={labelBase}>Düzenle</span>
                          </button>
                          {canManageArchive && (
                            <button onClick={() => onDelete && onDelete(visitor)} className={`${buttonBase} bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-200/80 hover:border-rose-600`}>
                              <Trash2 className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-500" />
                              <span className={labelBase}>Sil</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {/* Dedicated Full Note Popup Modal */}
      {selectedNote && (
        <div
          onClick={() => setSelectedNote(null)}
          className="fixed inset-0 z-[350] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-300 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-[#1e3a8a]">
                <FileText className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-950">{selectedNote.title}</h3>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {selectedNote.content}
            </div>

            <div className="text-right pt-2">
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="py-2 px-5 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-extrabold rounded-xl cursor-pointer transition-colors shadow-xs"
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
