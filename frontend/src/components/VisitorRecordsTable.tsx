import React, { useState, useEffect, useRef } from 'react';
import { ArchiveRestore, Car, FilePenLine, FileText, LogOut, Phone, RotateCcw, Trash2, UserCheck, Users, X } from 'lucide-react';
import { Visitor } from '../api/visitorApi';
import { VisitorDetailModal } from './VisitorDetailModal';

interface Props {
  visitors: Visitor[];
  loading: boolean;
  busyId?: string | null;
  canManageArchive?: boolean;
  readOnly?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onCheckOut?: (visitor: Visitor) => void;
  onUndoCheckOut?: (visitor: Visitor) => void;
  onEdit?: (visitor: Visitor) => void;
  onDelete?: (visitor: Visitor) => void;
  onRestore?: (visitor: Visitor) => void;
}

const formatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
const formatDate = (value?: string | null) => (value ? formatter.format(new Date(value)) : '-');

const formatPhone = (phone?: string | null) => {
  if (!phone) return null;
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
      return `${days}g ${remHours}sa`;
    }
    if (hours > 0) {
      return `${hours}sa ${minutes}dk`;
    }
    return `${minutes}dk`;
  } catch {
    return '-';
  }
}

const buttonBase =
  'group relative inline-flex items-center justify-center h-7 px-2 rounded-lg border transition-all duration-300 ease-out shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden disabled:opacity-40';
const labelBase =
  'max-w-0 opacity-0 group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-300 text-[11px] font-extrabold whitespace-nowrap overflow-hidden';

export const VisitorRecordsTable: React.FC<Props> = ({
  visitors,
  loading,
  busyId,
  canManageArchive,
  readOnly = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onCheckOut,
  onUndoCheckOut,
  onEdit,
  onDelete,
  onRestore,
}) => {
  const [selectedNote, setSelectedNote] = useState<{ title: string; content: string } | null>(null);
  const [selectedDetailVisitor, setSelectedDetailVisitor] = useState<Visitor | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '120px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <div className="bg-white border border-slate-300 rounded-3xl overflow-hidden shadow-sm w-full">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
              <th className="py-2.5 px-3 whitespace-nowrap">Ziyaretçi & Telefon</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Firma & Plaka</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Ziyaret Edilen Personel</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Ziyaret Amacı</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Giriş Tarihi & Süre</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Çıkış Tarihi</th>
              <th className="py-2.5 px-3 whitespace-nowrap text-center">Durum</th>
              <th className="py-2.5 px-3 whitespace-nowrap text-center">Not</th>
              {!readOnly && <th className="py-2.5 px-3 text-right whitespace-nowrap">İşlem</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-800">
            {loading ? (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="p-8 text-center text-slate-500 font-bold whitespace-nowrap">
                  Ziyaretçi kayıtları yükleniyor...
                </td>
              </tr>
            ) : visitors.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 8 : 9} className="p-8 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p className="text-xs font-extrabold text-slate-800">Ziyaretçi Kaydı Bulunamadı</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 font-semibold">Seçilen kriterlere uygun kayıt bulunmuyor.</p>
                </td>
              </tr>
            ) : (
              visitors.map((visitor) => {
                const isInside = visitor.status === 'INSIDE';
                const duration = calculateDuration(visitor.entryTime, visitor.exitTime);

                return (
                  <tr
                    key={visitor.id}
                    onClick={() => setSelectedDetailVisitor(visitor)}
                    className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                      visitor.isDeleted ? 'bg-rose-50/40 opacity-75' : ''
                    }`}
                  >
                    {/* 1. Ziyaretçi Bilgisi & Telefon */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/80 text-[#1e3a8a] flex items-center justify-center shrink-0 shadow-2xs">
                          <UserCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1 whitespace-nowrap">
                            <span className="truncate max-w-[130px]" title={visitor.fullName}>
                              {visitor.fullName}
                            </span>
                            <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-extrabold shrink-0">
                              {visitor.visitorCount || 1} Kişi
                            </span>
                          </div>
                          {visitor.phone ? (
                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 font-mono whitespace-nowrap">
                              <Phone className="w-3 h-3 text-[#1e3a8a] shrink-0" />
                              <span>{formatPhone(visitor.phone)}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] text-slate-400 italic">Tel yok</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. Geldiği Firma & Plaka */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div
                        className="font-bold text-slate-900 text-xs truncate max-w-[130px]"
                        title={visitor.company || 'Bireysel Ziyaretçi'}
                      >
                        {visitor.company || 'Bireysel'}
                      </div>
                      {visitor.vehiclePlate && (
                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <Car className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-700">{visitor.vehiclePlate}</span>
                        </div>
                      )}
                    </td>

                    {/* 3. Ziyaret Edilen Personel (AYRI KOLON) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div
                        className="font-bold text-slate-900 text-xs truncate max-w-[130px]"
                        title={visitor.hostEmployeeName || 'Belirtilmedi'}
                      >
                        {visitor.hostEmployeeName || '-'}
                      </div>
                      <div
                        className="text-[10px] text-[#1e3a8a] font-bold truncate max-w-[130px]"
                        title={visitor.hostRoomLabel || 'Oda Ataması Yok'}
                      >
                        {visitor.hostRoomLabel || 'Oda yok'}
                      </div>
                    </td>

                    {/* 4. Ziyaret Amacı (AYRI KOLON) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div
                        className="font-bold text-slate-800 text-xs truncate max-w-[120px]"
                        title={visitor.purpose || '-'}
                      >
                        {visitor.purpose || '-'}
                      </div>
                    </td>

                    {/* 5. Giriş Tarihi & Süre */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-slate-800 text-xs">{formatDate(visitor.entryTime)}</div>
                      <div className="mt-0.5">
                        {isInside ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold animate-pulse border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            İçeride ({duration})
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-500 font-bold">
                            Süre: {duration}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 6. Çıkış Tarihi (AYRI KOLON) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className={`font-bold text-xs ${isInside ? 'text-emerald-700 italic text-[11px]' : 'text-slate-700'}`}>
                        {isInside ? 'Henüz çıkış yapmadı' : formatDate(visitor.exitTime)}
                      </div>
                    </td>

                    {/* 7. Durum */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${
                          visitor.isDeleted
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : isInside
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {visitor.isDeleted ? 'ARŞİVLENDİ' : isInside ? 'İÇERİDE' : 'ÇIKIŞ YAPILDI'}
                      </span>
                    </td>

                    {/* 8. Notlar - Pop-up Modal */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-center">
                      {visitor.notes ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNote({ title: `${visitor.fullName} — Ziyaretçi Notu`, content: visitor.notes! });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 font-extrabold text-[10px] cursor-pointer transition-colors shadow-2xs"
                          title="Notu okumak için tıklayın"
                        >
                          <FileText className="w-3 h-3 text-blue-700 shrink-0" />
                          <span>Oku</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[10px] font-normal">-</span>
                      )}
                    </td>

                    {/* 9. İşlem Butonları */}
                    {!readOnly && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center gap-1">
                          {visitor.isDeleted ? (
                            <button
                              disabled={busyId === visitor.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestore && onRestore(visitor);
                              }}
                              className={`${buttonBase} bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white border-violet-200/80 hover:border-violet-600`}
                              title="Geri Yükle"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                              <span className={labelBase}>Geri Yükle</span>
                            </button>
                          ) : (
                            <>
                              {isInside ? (
                                <button
                                  disabled={busyId === visitor.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCheckOut && onCheckOut(visitor);
                                  }}
                                  className={`${buttonBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80 hover:border-emerald-600`}
                                  title="Çıkış Yap"
                                >
                                  <LogOut className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                                  <span className={labelBase}>Çıkış Yap</span>
                                </button>
                              ) : (
                                <button
                                  disabled={busyId === visitor.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUndoCheckOut && onUndoCheckOut(visitor);
                                  }}
                                  className={`${buttonBase} bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80 hover:border-amber-600`}
                                  title="Geri Al"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                                  <span className={labelBase}>Geri Al</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit && onEdit(visitor);
                                }}
                                className={`${buttonBase} bg-blue-50 text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white border-blue-200/80 hover:border-[#1e3a8a]`}
                                title="Düzenle"
                              >
                                <FilePenLine className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                                <span className={labelBase}>Düzenle</span>
                              </button>
                              {canManageArchive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete && onDelete(visitor);
                                  }}
                                  className={`${buttonBase} bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-200/80 hover:border-rose-600`}
                                  title="Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                                  <span className={labelBase}>Sil</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Infinite Scroll Sentinel & Loader */}
      {hasMore && (
        <div ref={sentinelRef} className="py-3.5 text-center border-t border-slate-200 bg-slate-50/70">
          {loadingMore ? (
            <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
              <span className="w-4 h-4 rounded-full border-2 border-[#1e3a8a] border-t-transparent animate-spin"></span>
              <span>Daha fazla kayıt yükleniyor...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs font-extrabold text-[#1e3a8a] hover:underline cursor-pointer"
            >
              Daha fazla kayıt yükle...
            </button>
          )}
        </div>
      )}
      {!hasMore && visitors.length > 0 && !loading && (
        <div className="py-2.5 text-center border-t border-slate-100 bg-slate-50/40 text-[11px] font-bold text-slate-400">
          Tüm kayıtlar görüntülendi ({visitors.length} kayıt)
        </div>
      )}

      {/* NOTE DETAILS POPUP MODAL */}
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

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words">
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

      {/* VISITOR DETAILS POPUP MODAL */}
      <VisitorDetailModal
        visitor={selectedDetailVisitor}
        isOpen={selectedDetailVisitor !== null}
        onClose={() => setSelectedDetailVisitor(null)}
        onEdit={!readOnly ? onEdit : undefined}
        onCheckOut={!readOnly ? onCheckOut : undefined}
        onUndoCheckOut={!readOnly ? onUndoCheckOut : undefined}
      />
    </div>
  );
};
