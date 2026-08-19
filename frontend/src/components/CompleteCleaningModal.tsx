import React, { useState, useEffect } from 'react';
import { Sparkles, Check, X, Loader2, User } from 'lucide-react';

interface CompleteCleaningModalProps {
  isOpen: boolean;
  roomTitle: string;
  currentUserFullName: string;
  onClose: () => void;
  onSubmit: (data: { cleanedBy: string; notes?: string }) => Promise<void>;
}

export const CompleteCleaningModal: React.FC<CompleteCleaningModalProps> = ({
  isOpen,
  roomTitle,
  currentUserFullName,
  onClose,
  onSubmit,
}) => {
  const [cleanedBy, setCleanedBy] = useState<string>(currentUserFullName || '');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCleanedBy(currentUserFullName || '');
      setNotes('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, currentUserFullName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanedBy.trim()) {
      setError('Lütfen temizleyen personel adını girin.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        cleanedBy: cleanedBy.trim(),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'İşlem tamamlanırken bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-cleaning-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-300 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 id="complete-cleaning-modal-title" className="text-base font-black text-slate-900 tracking-tight">
                Temizliği Tamamla & Odayı Hazır Et
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {roomTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Temizleyen Personel (ZORUNLU) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
              Temizleyen Personel Adı Soyadı <span className="text-rose-500 font-black">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                maxLength={100}
                value={cleanedBy}
                onChange={(e) => setCleanedBy(e.target.value)}
                placeholder="Ör. Ahmet Yılmaz"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              Temizliği bilfiil gerçekleştiren personelin ismini kontrol edin veya düzenleyin (Zorunlu).
            </p>
          </div>

          {/* Temizlik Detay Açıklaması / Notlar (İSTEĞE BAĞLI) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
              Temizlik Detay Açıklaması / Notlar <span className="text-slate-400 font-semibold text-[10px]">(İsteğe Bağlı)</span>
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Varsa yapılan temizlik, dezenfeksiyon veya kontrol detaylarını yazabilirsiniz (İsteğe bağlı)..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting || !cleanedBy.trim()}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Odayı Hazır Et & Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
