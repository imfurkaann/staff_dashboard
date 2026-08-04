import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Car, FileText, Loader2, Phone, Search, User, UserCheck, Users, X } from 'lucide-react';
import { employeeApi, Employee } from '../api/employeeApi';
import { CreateVisitorPayload, Visitor, visitorApi } from '../api/visitorApi';

interface AddVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  visitor?: Visitor | null;
  fixedHostEmployeeId?: string;
}

const emptyForm = { fullName: '', visitorCount: 1, phone: '', company: '', hostEmployeeId: '', hostSearch: '', purpose: '', vehiclePlate: '', notes: '' };

export const AddVisitorModal: React.FC<AddVisitorModalProps> = ({ isOpen, onClose, onSuccess, visitor, fixedHostEmployeeId }) => {
  const [form, setForm] = useState(emptyForm);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...emptyForm,
      fullName: visitor?.fullName || '', visitorCount: visitor?.visitorCount || 1, phone: visitor?.phone || '', company: visitor?.company || '',
      hostEmployeeId: fixedHostEmployeeId || visitor?.hostEmployeeId || '', hostSearch: visitor?.hostEmployeeName || '', purpose: visitor?.purpose || '',
      vehiclePlate: visitor?.vehiclePlate || '', notes: visitor?.notes || '',
    });
    setError(null);
    setEmployeesLoading(true);
    employeeApi.getEmployees('', 'ALL', 'ALL').then(setEmployees).catch(() => setError('Personel listesi yüklenemedi.')).finally(() => setEmployeesLoading(false));
  }, [isOpen, visitor, fixedHostEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const query = form.hostSearch.toLocaleLowerCase('tr-TR').trim();
    return employees.filter((employee) => !query || `${employee.firstName} ${employee.lastName} ${employee.department}`.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 20);
  }, [employees, form.hostSearch]);

  if (!isOpen) return null;
  const update = (field: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.hostEmployeeId) { setError('Ziyaret edilen personeli listeden seçin.'); return; }
    setSubmitting(true); setError(null);
    const payload: CreateVisitorPayload = {
      fullName: form.fullName, visitorCount: form.visitorCount, phone: form.phone || undefined, company: form.company || undefined,
      hostEmployeeId: form.hostEmployeeId, purpose: form.purpose, vehiclePlate: form.vehiclePlate || undefined, notes: form.notes || undefined,
    };
    try {
      if (visitor) await visitorApi.updateVisitor(visitor.id, payload);
      else await visitorApi.createVisitor(payload);
      onSuccess(); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Kayıt tamamlanamadı.'); }
    finally { setSubmitting(false); }
  };

  const fields = [
    { key: 'fullName', label: 'Ziyaretçi Adı Soyadı *', icon: User, placeholder: 'Örn. Ahmet Yılmaz', required: true },
    { key: 'phone', label: 'Telefon', icon: Phone, placeholder: '05XX XXX XX XX', required: false },
    { key: 'company', label: 'Firma / Kurum', icon: Building2, placeholder: 'Firma veya kurum adı', required: false },
    { key: 'purpose', label: 'Ziyaret Amacı *', icon: FileText, placeholder: 'Görüşme, teslimat vb.', required: true },
    { key: 'vehiclePlate', label: 'Araç Plakası', icon: Car, placeholder: '34 ABC 123', required: false },
  ] as const;

  return <div className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 no-print" onMouseDown={onClose}>
    <div className="bg-white border border-slate-300 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[92vh] overflow-y-auto" onMouseDown={(event) => event.stopPropagation()}>
      <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-5 border-b border-slate-200 rounded-t-3xl">
        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center"><UserCheck className="w-5 h-5" /></span><div><h3 className="text-base font-extrabold text-slate-900">{visitor ? 'Ziyaretçi Kaydını Düzenle' : 'Yeni Ziyaretçi Girişi'}</h3><p className="text-xs font-semibold text-slate-500">Giriş ve ziyaret bilgilerini eksiksiz kaydedin.</p></div></div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(({ key, label, icon: Icon, placeholder, required }) => <label key={key} className="space-y-1.5 text-xs font-extrabold text-slate-700">{label}<span className="relative block"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input required={required} maxLength={key === 'purpose' ? 200 : 120} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-[#1e3a8a] outline-none text-xs font-bold" /></span></label>)}
          <label className="space-y-1.5 text-xs font-extrabold text-slate-700">Gelen Kişi Sayısı *<span className="relative block"><Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="number" min={1} max={20} required value={form.visitorCount} onChange={(event) => update('visitorCount', Number(event.target.value))} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none text-xs font-bold" /></span></label>
          <label className="relative sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Ziyaret Edilen Personel *<span className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input disabled={Boolean(fixedHostEmployeeId)} value={form.hostSearch} onFocus={() => setEmployeePickerOpen(true)} onChange={(event) => { update('hostSearch', event.target.value); update('hostEmployeeId', ''); setEmployeePickerOpen(true); }} placeholder="Personel adıyla arayın ve listeden seçin" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none text-xs font-bold disabled:bg-slate-100" /></span>
            {employeePickerOpen && !fixedHostEmployeeId && <div className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-xl">{employeesLoading ? <p className="p-4 text-center text-xs text-slate-500">Personeller yükleniyor...</p> : filteredEmployees.map((employee) => <button key={employee.id} type="button" onClick={() => { update('hostEmployeeId', employee.id); update('hostSearch', `${employee.firstName} ${employee.lastName}`); setEmployeePickerOpen(false); }} className="w-full p-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0"><span className="block text-xs font-extrabold text-slate-900">{employee.firstName} {employee.lastName}</span><span className="text-[10px] font-semibold text-slate-500">{employee.department}{employee.beds?.[0] ? ` • ${employee.beds[0].room.block.name} / Oda ${employee.beds[0].room.roomNumber}` : ''}</span></button>)}</div>}
          </label>
          <label className="sm:col-span-2 space-y-1.5 text-xs font-extrabold text-slate-700">Notlar<span className="relative block"><FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => update('notes', event.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 outline-none text-xs font-bold resize-none" /></span></label>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">İptal</button><button disabled={submitting} className="px-5 py-2.5 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}{visitor ? 'Değişiklikleri Kaydet' : 'Girişi Kaydet'}</button></div>
      </form>
    </div>
  </div>;
};
