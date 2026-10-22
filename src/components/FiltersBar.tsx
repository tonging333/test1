import React, { useMemo } from 'react';
import { Search, Filter, ArrowUpDown, X, Building2, Calendar, CheckCircle2, Layers } from 'lucide-react';
import { FilterState, DepartmentInfo, CustomStatus } from '../types';

interface FiltersBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  totalCount: number;
  filteredCount: number;
  onReset: () => void;
  departments: Record<string, DepartmentInfo>;
  statuses: CustomStatus[];
  availableFiscalYears?: string[];
  allMeetings?: string[];
  onSelectFiscalYear?: (year: string) => void;
}

export const FiltersBar: React.FC<FiltersBarProps> = React.memo(({
  filters,
  setFilters,
  totalCount,
  filteredCount,
  onReset,
  departments,
  statuses,
  availableFiscalYears = ['2570', '2569', '2568'],
  allMeetings = ['1/2568', '12/2568', '1/2569', '2/2569', '3/2569', '4/2569', 'ไม่ได้จัดประชุม'],
  onSelectFiscalYear,
}) => {
  // Dynamically filter meetings based on currently selected fiscal year
  const filteredMeetingOptions = useMemo(() => {
    if (!filters.fiscalYearFilter || filters.fiscalYearFilter === 'all') {
      return ['ทั้งหมด', ...allMeetings];
    }
    const currentYear = filters.fiscalYearFilter;
    const matching = allMeetings.filter((m) => {
      if (m === 'ไม่ได้จัดประชุม') return true;
      return m.includes(currentYear);
    });
    return ['ทั้งหมด', ...matching];
  }, [filters.fiscalYearFilter, allMeetings]);
  
  const statusOptions = [
    { value: 'all', label: 'สถานะทั้งหมด' },
    ...statuses.map((s) => ({ value: s.key, label: s.label })),
  ];

  const departmentKeys = Object.keys(departments);

  // When fiscal year changes, if current meeting does not match new year, reset meeting to 'ทั้งหมด'
  const handleFiscalYearChange = (year: string) => {
    if (onSelectFiscalYear) {
      onSelectFiscalYear(year);
      return;
    }
    setFilters((prev) => {
      let nextMeeting = prev.meetingFilter;
      if (year !== 'all' && nextMeeting !== 'ทั้งหมด' && nextMeeting !== 'ไม่ได้จัดประชุม' && !nextMeeting.includes(year)) {
        nextMeeting = 'ทั้งหมด';
      }
      return {
        ...prev,
        fiscalYearFilter: year,
        meetingFilter: nextMeeting,
      };
    });
  };

  return (
    <div id="filters-section" className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 mb-6 no-print">
      
      {/* Top Search Bar & Sort */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="search-input"
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="ค้นหาชื่อโครงการ, เลขคดี, หรือคีย์เวิร์ด..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {filters.searchQuery && (
            <button
              id="clear-search-btn"
              onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> เรียงตาม:
          </span>
          <select
            id="sort-by-select"
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="id">ลำดับโครงการ (เริ่มต้นที่ 1)</option>
            <option value="requestedBudget">วงเงินขอรับจัดสรร</option>
            <option value="approvedBudget">วงเงินอนุมัติ</option>
            <option value="title">ชื่อโครงการ</option>
          </select>

          <button
            id="sort-direction-btn"
            onClick={() => setFilters((prev) => ({ ...prev, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }))}
            className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
            title={filters.sortDirection === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            {filters.sortDirection === 'asc' ? '↑ น้อยไปมาก' : '↓ มากไปน้อย'}
          </button>
        </div>

      </div>

      {/* Filter Options Grid (4 Filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
        
        {/* 1. Fiscal Year Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase text-indigo-700 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-indigo-600" /> ปีงบประมาณ
          </label>
          <select
            id="fiscal-year-filter-select"
            value={filters.fiscalYearFilter || 'all'}
            onChange={(e) => handleFiscalYearChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 text-indigo-950 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            {availableFiscalYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr === 'all' ? 'ทุกปีงบประมาณ (ทั้งหมด)' : `ปีงบประมาณ ${yr}`}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Meeting Filter */}
        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-blue-500" /> ครั้งที่ประชุม
          </label>
          <select
            id="meeting-filter-select"
            value={filters.meetingFilter}
            onChange={(e) => setFilters((prev) => ({ ...prev, meetingFilter: e.target.value }))}
            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {filteredMeetingOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ทั้งหมด' ? 'ประชุมทุกครั้ง' : opt === 'ไม่ได้จัดประชุม' ? 'ไม่ได้จัดประชุม' : `ประชุมครั้งที่ ${opt}`}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Department Filter */}
        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-blue-500" /> หน่วยงานรับผิดชอบ
          </label>
          <select
            id="department-filter-select"
            value={filters.departmentFilter}
            onChange={(e) => setFilters((prev) => ({ ...prev, departmentFilter: e.target.value }))}
            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">ทุกหน่วยงาน</option>
            {departmentKeys.map((code) => (
              <option key={code} value={code}>
                {code} - {departments[code]?.fullName || code}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-500" /> สถานะงบประมาณ
          </label>
          <select
            id="status-filter-select"
            value={filters.statusFilter}
            onChange={(e) => setFilters((prev) => ({ ...prev, statusFilter: e.target.value }))}
            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

      </div>
    </div>
  );
});
