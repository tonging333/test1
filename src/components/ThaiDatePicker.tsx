import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react';

interface ThaiDatePickerProps {
  value: string | null;
  onChange: (dateStr: string | null) => void;
  placeholder?: string;
}

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const DAYS_OF_WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'เลือกวันลงนาม หรือ พิมพ์วันที่...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing value or fallback to current date
  const parseValueToDate = (val: string | null): { year: number; month: number; day: number } => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (!val) return { year, month, day };

    const parts = val.trim().split(/\s+/);
    if (parts.length >= 3) {
      const parsedDay = parseInt(parts[0], 10);
      const monthIdx = THAI_MONTHS.indexOf(parts[1]);
      const parsedYearBE = parseInt(parts[2], 10);

      if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
        day = parsedDay;
      }
      if (monthIdx !== -1) {
        month = monthIdx;
      }
      if (!isNaN(parsedYearBE) && parsedYearBE > 2000) {
        year = parsedYearBE - 543;
      }
    }
    return { year, month, day };
  };

  const initialParsed = parseValueToDate(value);
  const [viewYear, setViewYear] = useState<number>(initialParsed.year);
  const [viewMonth, setViewMonth] = useState<number>(initialParsed.month);

  useEffect(() => {
    if (value && isOpen) {
      const parsed = parseValueToDate(value);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value, isOpen]);

  // Close calendar popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (day: number) => {
    const yearBE = viewYear + 543;
    const monthName = THAI_MONTHS[viewMonth];
    const formattedDate = `${day} ${monthName} ${yearBE}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const yearBE = now.getFullYear() + 543;
    const formattedDate = `${day} ${THAI_MONTHS[month]} ${yearBE}`;
    onChange(formattedDate);
    setViewYear(now.getFullYear());
    setViewMonth(month);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  // Days calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Highlight if selected matches currently viewed year/month/day
  const parsedVal = parseValueToDate(value);
  const isSelectedDay = (day: number) => {
    if (!value) return false;
    return (
      parsedVal.day === day &&
      parsedVal.month === viewMonth &&
      parsedVal.year === viewYear
    );
  };

  const yearsList = [];
  const currentYearAD = new Date().getFullYear();
  for (let y = currentYearAD - 5; y <= currentYearAD + 5; y++) {
    yearsList.push(y);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={value || ''}
          onClick={() => setIsOpen(true)}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw && raw.trim() !== '' ? raw : null);
          }}
          placeholder={placeholder}
          className="w-full pl-3 pr-20 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-800 text-xs sm:text-sm"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-100"
              title="ล้างวันที่"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="เปิดปฏิทินเลือกวันที่"
          >
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      </div>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-72 sm:w-80 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls */}
          <div className="flex items-center justify-between gap-1 mb-3 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Month & Year Pickers */}
            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-800 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer outline-none"
              >
                {THAI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 hover:bg-slate-100 font-bold text-xs text-slate-800 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer outline-none"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    พ.ศ. {y + 543}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS_OF_WEEK.map((day, idx) => (
              <span
                key={`dow-${idx}-${day}`}
                className={`text-[11px] font-bold py-1 ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Day buttons */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const selected = isSelectedDay(dayNum);
              const dayOfWeek = (firstDayOfWeek + i) % 7;
              const isSunday = dayOfWeek === 0;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => selectDay(dayNum)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                    selected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : isSunday
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors"
            >
              วันนี้
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>เว้นว่าง</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
