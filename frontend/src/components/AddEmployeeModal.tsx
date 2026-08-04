import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Camera, 
  Upload, 
  BedDouble, 
  ShieldAlert, 
  Check, 
  AlertCircle, 
  Building2, 
  Phone, 
  Briefcase, 
  FileText,
  Clock,
  RefreshCw,
  Cigarette,
  CigaretteOff,
  Car,
  Volume2,
  VolumeX,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { employeeApi, Bed, Employee } from '../api/employeeApi';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedEmployee?: Employee) => void;
  initialData?: Employee | null;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  // Required Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [department, setDepartment] = useState('İnşaat / Saha');

  // General & Roommate Compatibility State
  const [tcNo, setTcNo] = useState('');
  const [showTcNo, setShowTcNo] = useState(false);
  const [registrationNo, setRegistrationNo] = useState('');
  const [title, setTitle] = useState('Mühendis');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  
  // Roommate Compatibility Fields (Lojmanda Oda Arkadaşı Uyumluluğu)
  const [isSmoker, setIsSmoker] = useState(false);
  const [hasSnoring, setHasSnoring] = useState(false);
  const [shiftType, setShiftType] = useState('Gündüz');
  const [ageGroup, setAgeGroup] = useState('26-40 Yaş (Orta Yaş)');
  const [languageNationality, setLanguageNationality] = useState('Türkçe (T.C.)');

  // Security / Parking
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Emergency Contact Split Fields
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Eşi');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Optional Room/Bed Assignment State
  const [assignBed, setAssignBed] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState('');
  const [availableBeds, setAvailableBeds] = useState<Bed[]>([]);
  const [isLoadingBeds, setIsLoadingBeds] = useState(false);

  // Camera State
  const [photoTab, setPhotoTab] = useState<'upload' | 'camera'>('upload');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorPopUpMessage, setErrorPopUpMessage] = useState<string | null>(null);

  const departmentsList = [
    'İnşaat / Saha',
    'İdari İşler',
    'Güvenlik',
    'Mutfak / Restoran',
    'Kat Hizmetleri / Temizlik',
    'Teknik Servis / Bakım',
    'Bilgi İşlem / IT',
    'Lojistik / Depo',
    'Diğer',
  ];

  const titlesList = [
    'Mühendis',
    'Mimar',
    'Şantiye Formeni',
    'Usta / Teknik Eleman',
    'Saha İşçisi / Personel',
    'Güvenlik Görevlisi',
    'Kat Hizmetlisi / Temizlikçi',
    'Aşçı / Mutfak Personeli',
    'Şoför',
    'Depo / Lojistik Görevlisi',
    'İK / İdari Personel',
    'Diğer',
  ];

  const relationsList = [
    'Eşi',
    'Babası',
    'Annesi',
    'Çocuğu',
    'Kardeşi',
    'Akrabası',
    'Arkadaşı',
    'Diğer',
  ];

  // Pre-fill form when modal opens with initialData (Edit Mode) or reset (Create Mode)
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFirstName(initialData.firstName || '');
        setLastName(initialData.lastName || '');
        setGender((initialData.gender as 'Male' | 'Female') || 'Male');
        setDepartment(initialData.department || 'İnşaat / Saha');
        setTcNo('');
        setShowTcNo(false);
        setRegistrationNo(initialData.registrationNo || '');
        setTitle(initialData.title || 'Mühendis');
        setCompany(initialData.company || '');
        setPhone(initialData.phone || '');
        setIsSmoker(initialData.isSmoker ?? false);
        setHasSnoring(initialData.hasSnoring ?? false);
        setShiftType(initialData.shiftType || 'Gündüz');
        setAgeGroup(initialData.ageGroup || '26-40 Yaş (Orta Yaş)');
        setLanguageNationality(initialData.languageNationality || 'Türkçe (T.C.)');
        setVehiclePlate(initialData.vehiclePlate || '');
        setEmergencyContactName(initialData.emergencyContactName || '');
        setEmergencyRelation(initialData.emergencyRelation || 'Eşi');
        setEmergencyContactPhone(initialData.emergencyContactPhone || '');
        setPhotoUrl(initialData.photoUrl || null);
        setAssignBed(false);
        setSelectedBedId('');
        setErrorPopUpMessage(null);
      } else {
        setFirstName('');
        setLastName('');
        setGender('Male');
        setDepartment('İnşaat / Saha');
        setTitle('Mühendis');
        setTcNo('');
        setShowTcNo(false);
        setRegistrationNo('');
        setCompany('');
        setPhone('');
        setIsSmoker(false);
        setHasSnoring(false);
        setShiftType('Gündüz');
        setAgeGroup('26-40 Yaş (Orta Yaş)');
        setLanguageNationality('Türkçe (T.C.)');
        setVehiclePlate('');
        setEmergencyContactName('');
        setEmergencyRelation('Eşi');
        setEmergencyContactPhone('');
        setPhotoUrl(null);
        setAssignBed(false);
        setSelectedBedId('');
        setErrorPopUpMessage(null);
      }
    }
  }, [isOpen, initialData]);

  // Fetch available beds when assignBed toggle or gender changes
  useEffect(() => {
    if (assignBed) {
      setIsLoadingBeds(true);
      employeeApi.getAvailableBeds(gender)
        .then((beds) => {
          setAvailableBeds(beds);
          if (beds.length > 0) {
            setSelectedBedId(beds[0].id);
          } else {
            setSelectedBedId('');
          }
        })
        .finally(() => setIsLoadingBeds(false));
    }
  }, [assignBed, gender]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setErrorPopUpMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      setErrorPopUpMessage('Kamera erişimi sağlanamadı. Lütfen dosya yükleme modunu kullanınız.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/') || file.size > 1_500_000) {
        setErrorPopUpMessage('Lütfen 1,5 MB boyutunu aşmayan bir görsel seçin.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPopUpMessage(null);

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setErrorPopUpMessage('Personel Adı ve Soyadı girilmesi zorunludur.');
      return;
    }

    if (!department) {
      setErrorPopUpMessage('Lütfen bir departman seçiniz.');
      return;
    }

    if (assignBed && !selectedBedId) {
      setErrorPopUpMessage('Personeli yerleştirmek için lütfen listeden boş bir oda/yatak seçiniz.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        department,
        title,
        company: company.trim() || undefined,
        tcNo: tcNo.trim() || undefined,
        registrationNo: registrationNo.trim() || undefined,
        phone: phone.trim() || undefined,
        isSmoker,
        hasSnoring,
        shiftType,
        ageGroup,
        languageNationality,
        vehiclePlate: vehiclePlate.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyRelation: emergencyRelation || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        photoUrl: photoUrl || undefined,
        bedId: assignBed ? selectedBedId : undefined,
      };

      let resultEmployee: Employee;
      if (initialData) {
        resultEmployee = await employeeApi.updateEmployee(initialData.id, payload);
      } else {
        resultEmployee = await employeeApi.createEmployee(payload);
      }

      onSuccess(resultEmployee);
      handleResetAndClose();
    } catch (err: any) {
      // Trigger Center Pop-up Warning Modal
      setErrorPopUpMessage(err.message || 'Personel kaydı kaydedilirken hata meydana geldi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    stopCamera();
    setFirstName('');
    setLastName('');
    setGender('Male');
    setDepartment('İnşaat / Saha');
    setTitle('Mühendis');
    setTcNo('');
    setShowTcNo(false);
    setRegistrationNo('');
    setCompany('');
    setPhone('');
    setIsSmoker(false);
    setHasSnoring(false);
    setVehiclePlate('');
    setEmergencyContactName('');
    setEmergencyRelation('Eşi');
    setEmergencyContactPhone('');
    setShiftType('Gündüz');
    setPhotoUrl(null);
    setAssignBed(false);
    setSelectedBedId('');
    setErrorPopUpMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      
      {/* MODERN MINIMAL CENTER ERROR POPUP MODAL */}
      {errorPopUpMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-left space-y-4 animate-scaleUp">
            
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setErrorPopUpMessage(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-extrabold text-slate-900">
                Sistem Uyarısı
              </h3>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                {errorPopUpMessage}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setErrorPopUpMessage(null)}
                className="w-full py-2.5 px-4 bg-[#1e3a8a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Main Form Modal */}
      <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp my-auto">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-3xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a8a] text-white flex items-center justify-center shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {initialData ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Kaydı'}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {initialData ? 'Personel kayıt ve lojman oda uyum bilgilerini güncelleyin.' : 'Personel bilgilerini ve lojman oda uyum kriterlerini tanımlayın.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Photo Upload / Camera Capture Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#1e3a8a]" />
              <span>Personel Vesikalık Fotoğrafı</span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-200 border-2 border-slate-300 overflow-hidden flex items-center justify-center shrink-0 relative shadow-inner">
                {photoUrl ? (
                  <img src={photoUrl} alt="Personel Fotoğrafı" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-2 w-full">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { stopCamera(); setPhotoTab('upload'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      photoTab === 'upload' ? 'bg-[#1e3a8a] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Dosya Yükle
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhotoTab('camera'); startCamera(); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      photoTab === 'camera' ? 'bg-[#1e3a8a] text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kameradan Çek</span>
                  </button>
                </div>

                {photoTab === 'upload' ? (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                  />
                ) : (
                  <div className="space-y-2">
                    {isCameraActive ? (
                      <div className="relative rounded-xl overflow-hidden bg-black max-w-xs h-36">
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" /> Fotoğraf Çek
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="py-2 px-3 bg-[#1e3a8a] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Kamerayı Yeniden Başlat
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Zorunlu Temel Bilgiler */}
          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
              <h3 className="text-xs font-extrabold text-[#1e3a8a] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a]"></span>
                <span>1. Kimlik & Departman Bilgileri</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ad (Required) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Adı <span className="text-red-500 font-black">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ahmet"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
                  required
                />
              </div>

              {/* Soyad (Required) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Soyadı <span className="text-red-500 font-black">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Yılmaz"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
                  required
                />
              </div>

              {/* Cinsiyet (Required) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Cinsiyet <span className="text-red-500 font-black">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('Male')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      gender === 'Male'
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Erkek
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('Female')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      gender === 'Female'
                        ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Kadın
                  </button>
                </div>
              </div>

              {/* Departman (Required Dropdown) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Departman <span className="text-red-500 font-black">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none cursor-pointer shadow-sm"
                  required
                >
                  {departmentsList.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Toplu Konaklama Oda Arkadaşı Uyum Kriterleri */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                <span>2. Toplu Konaklama Oda Arkadaşı Uyum Kriterleri</span>
              </h3>
              <span className="text-[10px] font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                Oda Eşleştirme İçin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Sigara Kullanımı */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Sigara Kullanımı
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsSmoker(false)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      !isSmoker
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <CigaretteOff className="w-3.5 h-3.5" /> İçmiyor
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSmoker(true)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isSmoker
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Cigarette className="w-3.5 h-3.5" /> İçiyor
                  </button>
                </div>
              </div>

              {/* Horlama / Uyku Düzeni */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Horlama / Uyku Uyum Durumu
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHasSnoring(false)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      !hasSnoring
                        ? 'bg-blue-800 text-white border-blue-800'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <VolumeX className="w-3.5 h-3.5" /> Horlama Yok
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasSnoring(true)}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      hasSnoring
                        ? 'bg-purple-800 text-white border-purple-800'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Horlama Var
                  </button>
                </div>
              </div>

              {/* Vardiya Tipi */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Vardiya Düzeni (Uykunun Bölünmemesi İçin)
                </label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer shadow-sm"
                >
                  <option value="Gündüz">Gündüz Vardiyası</option>
                  <option value="Gece">Gece Vardiyası</option>
                  <option value="Dönüşümlü">Dönüşümlü (Vardiyalı)</option>
                </select>
              </div>

              {/* Yaş Grubu */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Yaş Grubu (Jenerasyon Uyumu)
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer shadow-sm"
                >
                  <option value="18-25 Yaş (Genç)">18-25 Yaş (Genç Grubu)</option>
                  <option value="26-40 Yaş (Orta Yaş)">26-40 Yaş (Orta Yaş Grubu)</option>
                  <option value="41-55 Yaş (Deneyimli)">41-55 Yaş (Deneyimli Grubu)</option>
                  <option value="56+ Yaş (Kıdemli)">56+ Yaş (Kıdemli Grubu)</option>
                </select>
              </div>

              {/* Konuşulan Dil / Uyruk */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Konuşulan Dil / Uyruk (Kültürel Uyum)
                </label>
                <select
                  value={languageNationality}
                  onChange={(e) => setLanguageNationality(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer shadow-sm"
                >
                  <option value="Türkçe (T.C.)">Türkçe (T.C.)</option>
                  <option value="İngilizce">İngilizce</option>
                  <option value="Rusça">Rusça</option>
                  <option value="Arapça">Arapça</option>
                  <option value="Farsça">Farsça</option>
                  <option value="Kırgızca / Özbekçe / Kazakça">Kırgızca / Özbekçe / Kazakça</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Sicil, Şirket & İletişim Detayları */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
              <span>3. Görev, Taşeron & İletişim Detayları</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Görev & Unvan (Dropdown) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Görev / Unvan
                </label>
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  {titlesList.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Taşeron / Şirket (Auto Normalized) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Bağlı Taşeron / Şirket
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Örn: Usta Cam A.Ş."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              {/* Araç Plakası (Otopark) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-[#1e3a8a]" />
                  <span>Otopark / Araç Plakası</span>
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Örn: 34 ABC 123"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              {/* TC Kimlik No (Sensitive) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#1e3a8a]" />
                  <span>TC Kimlik / Pasaport</span>
                </label>
                <input
                  type="password"
                  value={tcNo}
                  onChange={(e) => setTcNo(e.target.value)}
                  placeholder={initialData?.tcNoMasked || '11 Haneli TC No'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              {/* Sicil No */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Sicil No
                </label>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  placeholder="Örn: SIC-1092"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              {/* Telefon Numarası */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Telefon Numarası
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0532 000 0000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

            </div>

            {/* Acil Durum İletişim Bilgileri */}
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-xs font-extrabold text-slate-900 mb-2.5">
                Acil Durum İletişim Yakını
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Yakınının Adı & Soyadı
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Örn: Ali Yılmaz"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Yakınlık Derecesi
                  </label>
                  <select
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    {relationsList.map((rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Yakınının Telefonu
                  </label>
                  <input
                    type="text"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Örn: 0533 111 2233"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Opsiyonel Oda / Yatak Atama */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-900">
                <input
                  type="checkbox"
                  checked={assignBed}
                  onChange={(e) => setAssignBed(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                />
                <span>Personeli Kaydederken Doğrudan Odaya/Yatağa Yerleştir</span>
              </label>
            </div>

            {assignBed && (
              <div className="pt-2">
                {isLoadingBeds ? (
                  <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 py-2">
                    <div className="w-4 h-4 border-2 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
                    <span>{gender === 'Male' ? 'Erkek' : 'Kadın'} Lojmanlarındaki uygun yataklar yükleniyor...</span>
                  </div>
                ) : availableBeds.length > 0 ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Yerleştirilecek Boş Oda & Yatak Seçin ({gender === 'Male' ? 'Erkek Uyumlu' : 'Kadın Uyumlu'})
                    </label>
                    <select
                      value={selectedBedId}
                      onChange={(e) => setSelectedBedId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none cursor-pointer shadow-sm"
                    >
                      {availableBeds.map((bed) => (
                        <option key={bed.id} value={bed.id}>
                          {bed.room.block.name} • Oda {bed.room.roomNumber} (Kat {bed.room.floor}) • {bed.bedLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Şu anda {gender === 'Male' ? 'Erkek' : 'Kadın'} bloğunda boş yatak bulunamadı. Personel "Atama Bekleyenler" listesine kaydedilecektir.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-6 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-950/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>{initialData ? 'Güncelleniyor...' : 'Kaydediliyor...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{initialData ? 'Değişiklikleri Kaydet' : 'Kaydı Tamamla'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
