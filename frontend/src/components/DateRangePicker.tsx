import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  fullWidth?: boolean;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  fullWidth = false,
  className = '',
  buttonClassName = '',
  placeholder = 'Kayıt Tarih Aralığı Seçin',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [selectingStep, setSelectingStep] = useState<'START' | 'END'>('START');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1];
    return `${parseInt(day, 10)} ${monthName} ${year}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0 = Monday, 6 = Sunday
  };

  const handleDateClick = (dateStr: string) => {
    if (selectingStep === 'START' || !startDate || (startDate && endDate)) {
      onChange(dateStr, '');
      setSelectingStep('END');
    } else {
      if (dateStr < startDate) {
        onChange(dateStr, '');
        setSelectingStep('END');
      } else {
        onChange(startDate, dateStr);
        setSelectingStep('START');
        setIsOpen(false);
      }
    }
  };

  const setPreset = (type: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30' | 'ALL') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'TODAY') {
      onChange(todayStr, todayStr);
    } else if (type === 'THIS_WEEK') {
      const first = new Date(today);
      const day = first.getDay();
      const diff = first.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(first.setDate(diff));
      onChange(startOfWeek.toISOString().split('T')[0], todayStr);
    } else if (type === 'THIS_MONTH') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onChange(startOfMonth.toISOString().split('T')[0], todayStr);
    } else if (type === 'LAST_30') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      onChange(past.toISOString().split('T')[0], todayStr);
    } else if (type === 'ALL') {
      onChange('', '');
    }
    setIsOpen(false);
    setSelectingStep('START');
  };

  // Generate Calendar Grid for currentMonth
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const renderCalendarDays = () => {
    const cells = [];
    // Padding days from previous month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`pad-${i}`} className="h-9 w-9" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isStart = startDate === dayStr;
      const isEnd = endDate === dayStr;
      const isSelected = isStart || isEnd;

      let isInRange = false;
      if (startDate && endDate) {
        isInRange = dayStr > startDate && dayStr < endDate;
      } else if (startDate && hoverDate && selectingStep === 'END') {
        isInRange = dayStr > startDate && dayStr <= hoverDate;
      }

      const isToday = dayStr === new Date().toISOString().split('T')[0];

      cells.push(
        <button
          key={d}
          type="button"
          onClick={() => handleDateClick(dayStr)}
          onMouseEnter={() => setHoverDate(dayStr)}
          onMouseLeave={() => setHoverDate(null)}
          className={`h-9 w-9 text-xs font-extrabold rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
            isSelected
              ? 'bg-[#1e3a8a] text-white shadow-md z-10 scale-105'
              : isInRange
              ? 'bg-blue-100/80 text-[#1e3a8a] rounded-none'
              : isToday
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'text-slate-800 hover:bg-slate-100'
          }`}
        >
          {d}
        </button>
      );
    }

    return cells;
  };

  const displayText = startDate
    ? endDate
      ? `${formatDateDisplay(startDate)} — ${formatDateDisplay(endDate)}`
      : `${formatDateDisplay(startDate)} — Çıkış Seçin`
    : placeholder;

  return (
    <div ref={containerRef} className={`relative text-left ${fullWidth ? 'block w-full' : 'inline-block w-full sm:w-auto'} ${className}`}>
      {/* Trigger Button */}
      <div className={`flex items-center gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all border cursor-pointer ${
            fullWidth ? 'w-full h-10 px-3' : 'px-3.5 py-2'
          } ${
            startDate || endDate
              ? 'bg-blue-50 border-blue-400 text-[#1e3a8a] shadow-xs'
              : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-white focus:border-[#1e3a8a]'
          } ${buttonClassName}`}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="w-4 h-4 text-[#1e3a8a] shrink-0" />
            <span className="truncate">{displayText}</span>
          </div>
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              onChange('', '');
              setSelectingStep('START');
            }}
            title="Tarih Filtresini Temizle"
            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hotel Reservation Style Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-[250] bg-white border border-slate-300 rounded-3xl p-4 shadow-2xl space-y-3 w-80 animate-fadeIn">
          
          {/* Quick Presets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setPreset('TODAY')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={() => setPreset('THIS_WEEK')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              Bu Hafta
            </button>
            <button
              type="button"
              onClick={() => setPreset('THIS_MONTH')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              Bu Ay
            </button>
            <button
              type="button"
              onClick={() => setPreset('LAST_30')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer whitespace-nowrap"
            >
              Son 30 Gün
            </button>
            <button
              type="button"
              onClick={() => setPreset('ALL')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer whitespace-nowrap ml-auto"
            >
              Temizle
            </button>
          </div>

          {/* Month Header & Controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs font-black text-slate-900">
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-1">
            {DAY_NAMES.map((d) => (
              <span key={d} className="text-[10px] font-black text-slate-400 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {renderCalendarDays()}
          </div>

          {/* Selection Hint */}
          <div className="pt-2 border-t border-slate-200 text-[10px] font-semibold text-slate-500 text-center">
            {selectingStep === 'START' ? '📌 Lojmana Giriş Tarihini Seçin' : '🏁 Lojmandan Çıkış Tarihini Seçin'}
          </div>
        </div>
      )}
    </div>
  );
};
