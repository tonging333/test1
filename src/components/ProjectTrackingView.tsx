import React, { useState, useMemo } from 'react';
import { ProjectItem, DepartmentInfo, CustomStatus, SystemSettings, TrackingFilterState, DisbursementStatus, ExpenseType, InvestmentStage, CustomInvestmentStage } from '../types';
import { formatCurrency, formatMillionBaht, getDisbursementStatusLabel, getDisbursementStatusBadgeStyle, calculateDisbursementRate, getExpenseTypeLabel, getInvestmentStageLabel, getInvestmentStageBadgeStyle } from '../utils/formatters';
import { DEFAULT_INVESTMENT_STAGES } from '../data/projectsData';
import {
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Search,
  SlidersHorizontal,
  RotateCcw,
  PlusCircle,
  FileEdit,
  Eye,
  Calendar,
  Layers,
  ArrowUpDown,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Briefcase,
  HardHat,
  FileSignature,
  Hammer,
  Check,
  Trash2,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

interface ProjectTrackingViewProps {
  projects: ProjectItem[];
  departments: Record<string, DepartmentInfo>;
  statuses: CustomStatus[];
  useCompactUnit: boolean;
  systemSettings: SystemSettings;
  onSelectProject: (project: ProjectItem) => void;
  onOpenDisbursementModal: (project: ProjectItem) => void;
  onEditProject: (project: ProjectItem) => void;
  onDeleteProject?: (projectId: number) => void;
  investmentStages?: CustomInvestmentStage[];
  fiscalYearSeqMap?: Map<number, number>;
}

export const ProjectTrackingView: React.FC<ProjectTrackingViewProps> = React.memo(({
  projects,
  departments,
  statuses,
  useCompactUnit,
  systemSettings,
  onSelectProject,
  onOpenDisbursementModal,
  onEditProject,
  onDeleteProject,
  investmentStages = DEFAULT_INVESTMENT_STAGES,
  fiscalYearSeqMap,
}) => {
  // Only target approved projects
  const approvedProjects = useMemo(() => {
    return projects.filter((p) => p.statusCategory === 'approved');
  }, [projects]);

  // Filters State
  const [filters, setFilters] = useState<TrackingFilterState>({
    searchQuery: '',
    departmentFilter: 'all',
    disbursementStatusFilter: 'all',
    expenseTypeFilter: 'all',
    sortBy: 'approvedBudget',
    sortDirection: 'desc',
  });

  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);

  // Filtered & Sorted Approved Projects
  const filteredProjects = useMemo(() => {
    return approvedProjects
      .filter((p) => {
        // 1. Search Query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase().trim();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchDept = p.departmentCode.toLowerCase().includes(q) || p.departmentName.toLowerCase().includes(q);
          const matchRemarks = (p.remarks || '').toLowerCase().includes(q);
          const matchTracking = (p.trackingNotes || '').toLowerCase().includes(q);
          const matchRecords = (p.disbursementRecords || []).some(
            (r) => r.periodOrMilestone.toLowerCase().includes(q) || (r.docReference || '').toLowerCase().includes(q)
          );
          if (!matchTitle && !matchDept && !matchRemarks && !matchTracking && !matchRecords) {
            return false;
          }
        }

        // 2. Department Filter
        if (filters.departmentFilter !== 'all') {
          if (p.departmentCode !== filters.departmentFilter) {
            return false;
          }
        }

        // 3. Disbursement Status Filter
        if (filters.disbursementStatusFilter !== 'all') {
          const approved = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
            ? p.approvedBudget
            : (p.requestedBudget || 0);
          const disbursed = p.disbursedAmount || 0;
          const rate = calculateDisbursementRate(disbursed, approved);
          const isComplete = rate >= 100 || (approved > 0 && disbursed >= approved) || p.disbursementStatus === 'completed';
          const status = isComplete ? 'completed' : (p.disbursementStatus || (disbursed > 0 ? 'in_progress' : 'not_started'));
          if (status !== filters.disbursementStatusFilter) {
            return false;
          }
        }

        // 4. Expense Type & Investment Stage Filter
        if (filters.expenseTypeFilter !== 'all') {
          if (filters.expenseTypeFilter === 'operating') {
            if (p.expenseType !== 'operating' && p.expenseType !== 'both' && !p.operatingBudget) {
              return false;
            }
          } else if (filters.expenseTypeFilter === 'investment') {
            if (p.expenseType !== 'investment' && p.expenseType !== 'both' && !p.investmentBudget && p.expenseType !== undefined) {
              return false;
            }
          } else {
            // Filter by specific investment stage key
            if (p.investmentStage !== filters.expenseTypeFilter) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const approvedA = a.approvedBudget || a.requestedBudget || 0;
        const approvedB = b.approvedBudget || b.requestedBudget || 0;
        const disbursedA = a.disbursedAmount || 0;
        const disbursedB = b.disbursedAmount || 0;
        const rateA = calculateDisbursementRate(disbursedA, approvedA);
        const rateB = calculateDisbursementRate(disbursedB, approvedB);
        const progressA = a.physicalProgress || 0;
        const progressB = b.physicalProgress || 0;

        let valA: any = a.id;
        let valB: any = b.id;

        switch (filters.sortBy) {
          case 'approvedBudget':
            valA = approvedA;
            valB = approvedB;
            break;
          case 'disbursedAmount':
            valA = disbursedA;
            valB = disbursedB;
            break;
          case 'disbursementRate':
            valA = rateA;
            valB = rateB;
            break;
          case 'physicalProgress':
            valA = progressA;
            valB = progressB;
            break;
          case 'title':
            valA = a.title;
            valB = b.title;
            break;
          default:
            valA = fiscalYearSeqMap ? (fiscalYearSeqMap.get(a.id) ?? a.id) : a.id;
            valB = fiscalYearSeqMap ? (fiscalYearSeqMap.get(b.id) ?? b.id) : b.id;
        }

        if (typeof valA === 'string') {
          return filters.sortDirection === 'asc'
            ? valA.localeCompare(valB, 'th')
            : valB.localeCompare(valA, 'th');
        }

        return filters.sortDirection === 'asc' ? valA - valB : valB - valA;
      });
  }, [approvedProjects, filters]);

  // Overall Tracking KPIs
  const kpis = useMemo(() => {
    let totalApproved = 0;
    let totalDisbursed = 0;
    let totalPhysicalSum = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let delayedCount = 0;

    let totalOperating = 0;
    let totalInvestment = 0;
    let stageProcuringCount = 0;
    let stageBiddingCount = 0;
    let stageSignedCount = 0;

    // Counts for each custom investment stage
    const stageCounts: Record<string, number> = {};
    investmentStages.forEach((st) => {
      stageCounts[st.key] = 0;
    });

    filteredProjects.forEach((p) => {
      // Prioritize the actual approved budget granted by สงป.
      const approved = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
        ? p.approvedBudget
        : (p.requestedBudget || 0);
      const disbursed = p.disbursedAmount || 0;
      totalApproved += approved;
      totalDisbursed += disbursed;
      totalPhysicalSum += p.physicalProgress || 0;

      // Expense Breakdown
      if (p.expenseType === 'operating') {
        totalOperating += p.operatingBudget || approved;
      } else if (p.expenseType === 'both') {
        totalOperating += p.operatingBudget || 0;
        totalInvestment += p.investmentBudget || (approved - (p.operatingBudget || 0));
      } else {
        totalInvestment += p.investmentBudget || approved;
      }

      // Investment Stages
      if (p.investmentStage) {
        if (stageCounts[p.investmentStage] !== undefined) {
          stageCounts[p.investmentStage]++;
        } else {
          stageCounts[p.investmentStage] = (stageCounts[p.investmentStage] || 0) + 1;
        }
      }

      const isComplete = (disbursed >= approved && approved > 0) || p.disbursementStatus === 'completed';
      if (isComplete) {
        completedCount++;
      } else if (p.disbursementStatus === 'delayed') {
        delayedCount++;
      } else if (p.disbursementStatus === 'in_progress' || disbursed > 0) {
        inProgressCount++;
      } else {
        notStartedCount++;
      }
    });

    const totalRemaining = Math.max(0, totalApproved - totalDisbursed);
    const overallDisbursementRate = totalApproved > 0 ? (totalDisbursed / totalApproved) * 100 : 0;
    const avgPhysicalProgress = filteredProjects.length > 0 ? totalPhysicalSum / filteredProjects.length : 0;

    return {
      totalApproved,
      totalDisbursed,
      totalRemaining,
      overallDisbursementRate,
      avgPhysicalProgress,
      totalApprovedCount: filteredProjects.length,
      allApprovedProjectsCount: approvedProjects.length,
      completedCount,
      inProgressCount,
      notStartedCount,
      delayedCount,
      totalOperating,
      totalInvestment,
      stageCounts,
    };
  }, [filteredProjects, approvedProjects.length, investmentStages]);

  // Department Breakdown for Chart
  const departmentChartData = useMemo(() => {
    const map: Record<string, { code: string; name: string; approved: number; disbursed: number; count: number; color: string }> = {};

    filteredProjects.forEach((p) => {
      const code = p.departmentCode;
      const approved = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
        ? p.approvedBudget
        : (p.requestedBudget || 0);
      const disbursed = p.disbursedAmount || 0;

      if (!map[code]) {
        map[code] = {
          code,
          name: p.departmentName,
          approved: 0,
          disbursed: 0,
          count: 0,
          color: departments[code]?.color || '#6366f1',
        };
      }
      map[code].approved += approved;
      map[code].disbursed += disbursed;
      map[code].count += 1;
    });

    return Object.values(map).map((d) => ({
      name: d.code,
      fullName: d.name,
      approvedMB: d.approved / 1_000_000,
      disbursedMB: d.disbursed / 1_000_000,
      approvedRaw: d.approved,
      disbursedRaw: d.disbursed,
      rate: d.approved > 0 ? (d.disbursed / d.approved) * 100 : 0,
      count: d.count,
      color: d.color,
    }));
  }, [filteredProjects, departments]);

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      departmentFilter: 'all',
      disbursementStatusFilter: 'all',
      expenseTypeFilter: 'all',
      sortBy: 'approvedBudget',
      sortDirection: 'desc',
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            ระบบติดตามการเบิกจ่ายงบประมาณและผลการดำเนินงาน
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-300 font-medium">โครงการที่อนุมัติ</div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {kpis.totalApprovedCount} <span className="text-xs font-bold text-slate-300">โครงการ</span>
            </div>
          </div>
          <div className="h-10 w-px bg-white/20" />
          <div className="text-right">
            <div className="text-xs text-slate-300 font-medium">อัตราการเบิกจ่ายรวม</div>
            <div className="text-2xl font-extrabold text-blue-400">
              {kpis.overallDisbursementRate.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards for Disbursement Tracking */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Approved Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700">งบที่ สงป. อนุมัติรวม</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl xl:text-2xl font-bold text-emerald-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpis.totalApproved, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600">
              {kpis.allApprovedProjectsCount > kpis.totalApprovedCount
                ? `กรอง ${kpis.totalApprovedCount} จาก ${kpis.allApprovedProjectsCount} โครงการ`
                : `รวม ${kpis.totalApprovedCount} โครงการ`}
            </span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              อนุมัติ 100%
            </span>
          </div>
        </div>

        {/* Card 2: Total Disbursed */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700">เบิกจ่ายแล้วสะสม</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl xl:text-2xl font-bold text-blue-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpis.totalDisbursed, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600">เทียบงบ สงป. อนุมัติ</span>
            <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {kpis.overallDisbursementRate.toFixed(2)}%
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.overallDisbursementRate)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Remaining Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700">งบประมาณคงเหลือ</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl xl:text-2xl font-bold text-amber-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpis.totalRemaining, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600">คงเหลือที่ต้องเบิก</span>
            <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              {Math.max(0, 100 - kpis.overallDisbursementRate).toFixed(2)}%
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, 100 - kpis.overallDisbursementRate))}%` }}
            />
          </div>
        </div>

        {/* Card 4: Expense Types (Operating & Investment Budget) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700">จำแนกตามประเภทงบประมาณ</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70">
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mb-0.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> งบดำเนินงาน
              </div>
              <div className="text-sm font-extrabold text-emerald-700 truncate">
                {formatCurrency(kpis.totalOperating, useCompactUnit)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/70">
              <div className="text-[11px] font-bold text-blue-800 flex items-center gap-1 mb-0.5">
                <HardHat className="w-3.5 h-3.5 text-blue-600" /> งบลงทุน
              </div>
              <div className="text-sm font-extrabold text-blue-700 truncate">
                {formatCurrency(kpis.totalInvestment, useCompactUnit)}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Analytics: Department Disbursement Comparison Chart */}
      {departmentChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                เปรียบเทียบงบประมาณที่อนุมัติ vs เบิกจ่ายแล้ว จำแนกตามหน่วยงาน
              </h3>
              <p className="text-xs text-slate-500">
                แสดงยอดงบประมาณที่ สงป. อนุมัติ เทียบกับยอดที่เบิกจ่ายแล้วจริง (หน่วย: ล้านบาท)
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> งบอนุมัติ
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> เบิกจ่ายแล้ว
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full min-w-0" style={{ minWidth: 0, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={250} debounce={50}>
              <BarChart data={departmentChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => `${val.toLocaleString()} ลบ.`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ล้านบาท`,
                    name === 'approvedMB' ? 'งบที่อนุมัติ' : 'เบิกจ่ายแล้ว',
                  ]}
                  labelFormatter={(label: any) => {
                    const item = departmentChartData.find((d) => d.name === label);
                    return `${label} - ${item?.fullName || ''} (${item?.count || 0} โครงการ)`;
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                  }}
                />
                <Bar dataKey="approvedMB" name="approvedMB" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="disbursedMB" name="disbursedMB" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter and Search Bar for Tracking */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อโครงการ, หน่วยงาน, เลขที่ฎีกา หรือรายละเอียดการเบิกจ่าย..."
              value={filters.searchQuery}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            />
            {filters.searchQuery && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* Controls Group */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Department Filter */}
            <select
              value={filters.departmentFilter}
              onChange={(e) => setFilters((prev) => ({ ...prev, departmentFilter: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">ทุกหน่วยงาน ({approvedProjects.length})</option>
              {Object.entries(departments).map(([code, info]: [string, DepartmentInfo]) => {
                const count = approvedProjects.filter((p) => p.departmentCode === code).length;
                if (count === 0) return null;
                return (
                  <option key={code} value={code}>
                    {code} - {info?.fullName || code} ({count})
                  </option>
                );
              })}
            </select>

            {/* Expense Type & Sub-options Filter */}
            <select
              value={filters.expenseTypeFilter}
              onChange={(e) => setFilters((prev) => ({ ...prev, expenseTypeFilter: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">ประเภทการเบิกจ่ายทั้งหมด</option>
              <option value="operating">💼 1. งบดำเนินงาน</option>
              <option value="investment">🏗️ 2. งบลงทุน (ทั้งหมด)</option>
              {investmentStages.map((st) => (
                <option key={st.key} value={st.key}>
                  &nbsp;&nbsp;└ 🔹 งบลงทุน: {st.label}
                </option>
              ))}
            </select>

            {/* Disbursement Status Filter */}
            <select
              value={filters.disbursementStatusFilter}
              onChange={(e) => setFilters((prev) => ({ ...prev, disbursementStatusFilter: e.target.value }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">สถานะการเบิกจ่ายทั้งหมด</option>
              <option value="completed">🟢 เบิกจ่ายครบ 100%</option>
              <option value="in_progress">🔵 อยู่ระหว่างเบิกจ่าย</option>
              <option value="not_started">⚪ ยังไม่เริ่มเบิกจ่าย</option>
              <option value="delayed">🔴 ล่าช้ากว่าแผน</option>
            </select>

            {/* Sort Options */}
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as any }))}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="approvedBudget">เรียงตาม งบที่อนุมัติ</option>
              <option value="disbursedAmount">เรียงตาม ยอดเบิกจ่ายแล้ว</option>
              <option value="disbursementRate">เรียงตาม % การเบิกจ่าย</option>
              <option value="physicalProgress">เรียงตาม ความคืบหน้าเนื้องาน</option>
              <option value="id">เรียงตาม ลำดับโครงการ</option>
              <option value="title">เรียงตาม ชื่อโครงการ</option>
            </select>

            {/* Sort Direction Toggle */}
            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
                }))
              }
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 transition-colors"
              title={filters.sortDirection === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Reset Button */}
            {(filters.searchQuery || filters.departmentFilter !== 'all' || filters.disbursementStatusFilter !== 'all' || filters.expenseTypeFilter !== 'all') && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ล้างตัวกรอง
              </button>
            )}

          </div>

        </div>
        
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 flex-wrap gap-2">
          <span>
            แสดง <strong>{filteredProjects.length}</strong> จากทั้งหมด {approvedProjects.length} โครงการที่ได้รับอนุมัติ
          </span>
          <span className="text-[11px] text-slate-400">
            * คลิกที่ปุ่ม <strong>"บันทึกการเบิกจ่าย"</strong> เพื่อระบุงบดำเนินงาน/งบลงทุน และขั้นตอนย่อย
          </span>
        </div>
      </div>

      {/* Main Table: Projects Disbursement Tracking */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            ลองปรับเปลี่ยนคำค้นหา หรือเลือกตัวกรองหน่วยงานและประเภทการเบิกจ่ายใหม่อีกครั้ง
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold tracking-wider uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">ลำดับ</th>
                  <th className="py-3.5 px-4 min-w-[300px]">โครงการ / หน่วยงาน</th>
                  <th className="py-3.5 px-4 text-right min-w-[140px]">งบที่ สงป. อนุมัติ</th>
                  <th className="py-3.5 px-4 min-w-[180px]">ยอดเบิกจ่ายสะสม</th>
                  <th className="py-3.5 px-4 text-right min-w-[130px]">งบประมาณคงเหลือ</th>
                  <th className="py-3.5 px-4 text-center min-w-[130px]">สถานะการเบิกจ่าย</th>
                  <th className="py-3.5 px-4 text-center min-w-[150px]">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p, index) => {
                  const approved = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
                    ? p.approvedBudget
                    : (p.requestedBudget || 0);
                  const disbursed = p.disbursedAmount || 0;
                  const remaining = Math.max(0, approved - disbursed);
                  const rate = calculateDisbursementRate(disbursed, approved);
                  const physical = p.physicalProgress || 0;
                  const isComplete = rate >= 100 || (approved > 0 && disbursed >= approved) || p.disbursementStatus === 'completed';
                  const status = isComplete
                    ? 'completed'
                    : (p.disbursementStatus || (disbursed > 0 ? 'in_progress' : 'not_started'));
                  const statusStyle = getDisbursementStatusBadgeStyle(status);
                  const statusLabel = isComplete ? 'เบิกจ่ายครบ 100%' : getDisbursementStatusLabel(status);
                  const deptInfo = departments[p.departmentCode];
                  const recordsCount = (p.disbursementRecords || []).length;

                  // Expense & Stage badge
                  const opBudget = typeof p.operatingBudget === 'number' ? p.operatingBudget : 0;
                  const invBudget = typeof p.investmentBudget === 'number' ? p.investmentBudget : 0;
                  const hasOperating = p.expenseType === 'operating' || opBudget > 0 || (p.expenseType === 'both' && (opBudget > 0 || invBudget === 0));
                  const hasInvestment = p.expenseType !== 'operating' && (
                    invBudget > 0 ||
                    (p.expenseType === 'investment' && (typeof p.investmentBudget !== 'number' || p.investmentBudget > 0)) ||
                    (!p.expenseType && opBudget === 0 && (typeof p.investmentBudget !== 'number' || p.investmentBudget > 0))
                  );
                  const currentStage = p.investmentStage;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-4 px-4 text-center font-bold text-slate-500">
                        {fiscalYearSeqMap ? (fiscalYearSeqMap.get(p.id) ?? (index + 1)) : (index + 1)}
                      </td>

                      {/* Title & Dept & Badges */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: deptInfo?.color || '#6366f1' }}
                          >
                            {p.departmentCode}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                            {p.departmentName}
                          </span>
                          {p.fiscalYear && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              ปีงบฯ {p.fiscalYear}
                            </span>
                          )}

                          {/* Expense Type Badges */}
                          {hasOperating && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Briefcase className="w-3 h-3" />
                              งบดำเนินงาน
                            </span>
                          )}

                          {hasInvestment && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <HardHat className="w-3 h-3" />
                              งบลงทุน
                            </span>
                          )}

                          {/* Investment Stage Badge */}
                          {hasInvestment && (typeof p.investmentBudget === 'number' ? p.investmentBudget > 0 : true) && currentStage && (() => {
                            const stageBadge = getInvestmentStageBadgeStyle(currentStage, investmentStages);
                            const stageLabel = getInvestmentStageLabel(currentStage, investmentStages);
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${stageBadge.bg} ${stageBadge.text} ${stageBadge.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${stageBadge.dot}`} />
                                {stageLabel}
                              </span>
                            );
                          })()}
                        </div>

                        <h4
                          onClick={() => onSelectProject(p)}
                          className="font-bold text-slate-900 text-sm leading-snug hover:text-indigo-600 cursor-pointer transition-colors line-clamp-2"
                          title="คลิกเพื่อดูรายละเอียดโครงการ"
                        >
                          {p.title}
                        </h4>

                        {/* Budget breakdown info */}
                        {(p.operatingBudget || p.investmentBudget) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            {p.operatingBudget ? (
                              <span className="text-emerald-700 font-semibold">
                                งบดำเนินงาน: {formatCurrency(p.operatingBudget, true)}
                              </span>
                            ) : null}
                            {p.operatingBudget && p.investmentBudget ? <span>•</span> : null}
                            {p.investmentBudget ? (
                              <span className="text-blue-700 font-semibold">
                                งบลงทุน: {formatCurrency(p.investmentBudget, true)}
                              </span>
                            ) : null}
                          </div>
                        )}

                        {p.trackingNotes && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            💬 {p.trackingNotes}
                          </p>
                        )}
                      </td>

                      {/* Approved Budget */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {formatCurrency(approved, useCompactUnit)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          (ขอรับ {formatCurrency(p.requestedBudget, useCompactUnit)})
                        </div>
                      </td>

                      {/* Disbursed Amount & Progress Bar */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-extrabold text-blue-700 text-sm">
                            {formatCurrency(disbursed, useCompactUnit)}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {rate.toFixed(1)}%
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              rate >= 100
                                ? 'bg-emerald-500'
                                : rate >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{recordsCount > 0 ? `เบิกแล้ว ${recordsCount} งวด` : 'ยังไม่มีงวดเบิก'}</span>
                          {p.contractDate && <span>สัญญา: {p.contractDate}</span>}
                        </div>
                      </td>

                      {/* Remaining Budget */}
                      <td className="py-4 px-4 text-right font-bold text-amber-700 text-sm">
                        {formatCurrency(remaining, useCompactUnit)}
                      </td>

                      {/* Disbursement Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          {statusLabel}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenDisbursementModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            title="บันทึกการเบิกจ่าย / เพิ่มงวดงาน / กำหนดประเภทงบ"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            บันทึกเบิกจ่าย
                          </button>
                          <button
                            onClick={() => onSelectProject(p)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            title="ดูรายละเอียดโครงการ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeleteProject && (
                            <button
                              onClick={() => setProjectToDelete(p)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="ลบโครงการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t border-slate-800">
                  <td colSpan={2} className="py-4 px-4 text-left">
                    รวมทั้งสิ้น ({filteredProjects.length} โครงการ)
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-400 font-extrabold text-sm">
                    {formatCurrency(
                      filteredProjects.reduce((acc, p) => acc + ((p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0) ? p.approvedBudget : (p.requestedBudget || 0)), 0),
                      useCompactUnit
                    )}
                  </td>
                  <td className="py-4 px-4 text-left text-blue-400 font-extrabold text-sm">
                    {formatCurrency(
                      filteredProjects.reduce((acc, p) => acc + (p.disbursedAmount || 0), 0),
                      useCompactUnit
                    )}
                  </td>
                  <td className="py-4 px-4 text-right text-amber-400 font-extrabold text-sm">
                    {formatCurrency(
                      filteredProjects.reduce(
                        (acc, p) =>
                          acc +
                          Math.max(
                            0,
                            ((p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0) ? p.approvedBudget : (p.requestedBudget || 0)) - (p.disbursedAmount || 0)
                          ),
                        0
                      ),
                      useCompactUnit
                    )}
                  </td>
                  <td colSpan={2} className="py-4 px-4 text-center text-slate-400 text-xs">
                    อัตราเบิกจ่ายเฉลี่ย (เทียบงบ สงป. อนุมัติ):{' '}
                    <strong className="text-white">
                      {kpis.overallDisbursementRate.toFixed(2)}%
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredProjects.map((p, index) => {
              const approved = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
                ? p.approvedBudget
                : (p.requestedBudget || 0);
              const disbursed = p.disbursedAmount || 0;
              const remaining = Math.max(0, approved - disbursed);
              const rate = calculateDisbursementRate(disbursed, approved);
              const isComplete = rate >= 100 || (approved > 0 && disbursed >= approved) || p.disbursementStatus === 'completed';
              const status = isComplete
                ? 'completed'
                : (p.disbursementStatus || (disbursed > 0 ? 'in_progress' : 'not_started'));
              const statusStyle = getDisbursementStatusBadgeStyle(status);
              const statusLabel = isComplete ? 'เบิกจ่ายครบ 100%' : getDisbursementStatusLabel(status);
              const deptInfo = departments[p.departmentCode];
              const opBudget = typeof p.operatingBudget === 'number' ? p.operatingBudget : 0;
              const invBudget = typeof p.investmentBudget === 'number' ? p.investmentBudget : 0;
              const hasOperating = p.expenseType === 'operating' || opBudget > 0 || (p.expenseType === 'both' && (opBudget > 0 || invBudget === 0));
              const hasInvestment = p.expenseType !== 'operating' && (
                invBudget > 0 ||
                (p.expenseType === 'investment' && (typeof p.investmentBudget !== 'number' || p.investmentBudget > 0)) ||
                (!p.expenseType && opBudget === 0 && (typeof p.investmentBudget !== 'number' || p.investmentBudget > 0))
              );
              const currentStage = p.investmentStage;

              return (
                <div key={p.id} className="p-4 space-y-3">
                  
                  {/* Header info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white"
                        style={{ backgroundColor: deptInfo?.color || '#6366f1' }}
                      >
                        {p.departmentCode}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        ลำดับที่ {fiscalYearSeqMap ? (fiscalYearSeqMap.get(p.id) ?? (index + 1)) : (index + 1)}
                      </span>
                      {hasOperating && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Briefcase className="w-3 h-3" />
                          งบดำเนินงาน
                        </span>
                      )}
                      {hasInvestment && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <HardHat className="w-3 h-3" />
                          งบลงทุน {(typeof p.investmentBudget === 'number' ? p.investmentBudget > 0 : true) && currentStage ? `(${getInvestmentStageLabel(currentStage, investmentStages)})` : ''}
                        </span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                      {statusLabel}
                    </span>
                  </div>

                  {/* Title */}
                  <h4
                    onClick={() => onSelectProject(p)}
                    className="text-sm font-bold text-slate-900 leading-snug cursor-pointer hover:text-indigo-600"
                  >
                    {p.title}
                  </h4>

                  {/* Budget details */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">งบที่อนุมัติ</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(approved, useCompactUnit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">เบิกจ่ายแล้ว</span>
                      <span className="font-bold text-blue-700">
                        {formatCurrency(disbursed, useCompactUnit)} ({rate.toFixed(1)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">งบประมาณคงเหลือ</span>
                      <span className="font-bold text-amber-700">
                        {formatCurrency(remaining, useCompactUnit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">ความคืบหน้าเนื้องาน</span>
                      <span className="font-bold text-indigo-700">{p.physicalProgress || 0}%</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rate >= 100 ? 'bg-emerald-500' : rate >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, rate)}%` }}
                    />
                  </div>

                  {p.updatedAt && (
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                      <span>อัปเดตล่าสุด: <strong className="text-slate-500 font-medium">{p.updatedAt}</strong></span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onOpenDisbursementModal(p)}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      บันทึกการเบิกจ่าย
                    </button>
                    <button
                      onClick={() => onSelectProject(p)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      รายละเอียด
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Delete Confirmation In-App Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              ยืนยันการลบโครงการ?
            </h3>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              คุณกำลังจะลบโครงการ <strong className="text-slate-800 font-semibold">#{projectToDelete.id} - {projectToDelete.title}</strong> ออกจากระบบ ข้อมูลนี้จะถูกลบและซิงค์ไปยัง Google Sheet ด้วย
            </p>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-1.5 mb-5 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">หน่วยงาน:</span>
                <span className="font-semibold text-slate-800">{projectToDelete.departmentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">วงเงินอนุมัติ (สงป.):</span>
                <span className="font-bold text-emerald-700">{formatCurrency(projectToDelete.approvedBudget || 0)} บาท</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProject) {
                    onDeleteProject(projectToDelete.id);
                  }
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>ยืนยันลบโครงการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
