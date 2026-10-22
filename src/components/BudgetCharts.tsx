import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { ProjectItem, DepartmentCode, DepartmentInfo, CustomStatus } from '../types';
import { DEPARTMENTS } from '../data/projectsData';
import { formatCurrency, getStatusLabel } from '../utils/formatters';
import { BarChart3, PieChart as PieIcon, Clock, ChevronRight } from 'lucide-react';

interface BudgetChartsProps {
  projects: ProjectItem[];
  useCompactUnit: boolean;
  departments?: Record<string, DepartmentInfo>;
  statuses?: CustomStatus[];
  onSelectProject?: (project: ProjectItem) => void;
}

interface StatusDataPoint {
  name: string;
  value: number;
  count: number;
  category: string;
  rawRequested: number;
  rawApproved: number;
}

interface DeptDataPoint {
  code: string;
  name: string;
  requestedMB: number;
  approvedMB: number;
  rawRequested: number;
  rawApproved: number;
  count: number;
}

export const BudgetCharts: React.FC<BudgetChartsProps> = React.memo(({
  projects,
  useCompactUnit,
  departments = DEPARTMENTS,
  statuses,
  onSelectProject,
}) => {
  const [activeTab, setActiveTab] = useState<'department' | 'status'>('department');
  const [selectedStatusCategory, setSelectedStatusCategory] = useState<string | null>(null);

  // Filter minister pending projects ("อยู่ระหว่างการพิจารณาของรัฐมนตรี")
  const ministerProjects = useMemo(
    () => projects.filter((p) => p.statusCategory === 'draft_pending'),
    [projects]
  );
  const ministerLabel = getStatusLabel('draft_pending', statuses);

  // Projects for the selected status in side panel (default to minister pending if none selected)
  const sidePanelProjects = useMemo(() => {
    if (selectedStatusCategory) {
      return projects.filter((p) => p.statusCategory === selectedStatusCategory);
    }
    return ministerProjects;
  }, [projects, selectedStatusCategory, ministerProjects]);

  const sidePanelTitle = selectedStatusCategory
    ? getStatusLabel(selectedStatusCategory, statuses)
    : ministerLabel;

  const STATUS_COLORS: Record<string, string> = {
    approved: '#10b981',        // Emerald
    under_review: '#f59e0b',    // Amber
    signed_pending: '#3b82f6',  // Blue
    returned_review: '#f43f5e', // Rose
    disapproved: '#64748b',     // Slate
    draft_pending: '#a855f7',   // Purple
  };

  // --- 1. Data Prep: By Status (Fixed strictly to Project Count) ---
  const statusData: StatusDataPoint[] = useMemo(() => {
    const counts = projects.reduce((acc: Record<string, StatusDataPoint>, p) => {
      const key = p.statusCategory;
      if (!acc[key]) {
        acc[key] = {
          name: getStatusLabel(key, statuses),
          value: 0,
          count: 0,
          category: key,
          rawRequested: 0,
          rawApproved: 0,
        };
      }
      acc[key].rawRequested += p.requestedBudget || 0;
      acc[key].rawApproved += p.approvedBudget || 0;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, StatusDataPoint>);

    return (Object.values(counts) as StatusDataPoint[]).map((item) => ({
      ...item,
      value: item.count, // Fixed to count of projects
    }));
  }, [projects, statuses]);

  // --- 2. Data Prep: By Department (Requested vs Approved) ---
  const departmentData: DeptDataPoint[] = useMemo(() => {
    const deptCounts = projects.reduce((acc: Record<string, DeptDataPoint>, p) => {
      const code = p.departmentCode;
      if (!acc[code]) {
        acc[code] = {
          code,
          name: departments[code]?.fullName || DEPARTMENTS[code as DepartmentCode]?.fullName || code,
          requestedMB: 0,
          approvedMB: 0,
          rawRequested: 0,
          rawApproved: 0,
          count: 0,
        };
      }
      acc[code].rawRequested += p.requestedBudget || 0;
      acc[code].rawApproved += p.approvedBudget || 0;
      acc[code].requestedMB = Number(((acc[code].rawRequested) / 1_000_000).toFixed(2));
      acc[code].approvedMB = Number(((acc[code].rawApproved) / 1_000_000).toFixed(2));
      acc[code].count += 1;
      return acc;
    }, {} as Record<string, DeptDataPoint>);

    return (Object.values(deptCounts) as DeptDataPoint[]).sort((a, b) => b.rawRequested - a.rawRequested);
  }, [projects, departments]);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 max-w-xs z-50">
          <p className="font-bold text-amber-300 border-b border-slate-700 pb-1.5 mb-1.5 flex items-center justify-between gap-2">
            <span>{data.name || data.code || data.shortTitle}</span>
            {data.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                {data.count} โครงการ
              </span>
            )}
          </p>
          {data.count !== undefined && (
            <p className="text-white font-medium flex justify-between gap-4">
              <span className="text-slate-300">จำนวนโครงการ:</span>
              <span className="text-indigo-300 font-bold">
                {data.count} โครงการ ({projects.length > 0 ? ((data.count / projects.length) * 100).toFixed(1) : 0}%)
              </span>
            </p>
          )}
          {data.rawRequested !== undefined && data.rawRequested > 0 && (
            <p className="text-white font-medium flex justify-between gap-4 mt-0.5">
              <span className="text-slate-300">วงเงินขอรับจัดสรร:</span>
              <span className="text-blue-400 font-bold">{formatCurrency(data.rawRequested, useCompactUnit)}</span>
            </p>
          )}
          {data.rawApproved !== undefined && data.rawApproved > 0 && (
            <p className="text-white font-medium flex justify-between gap-4 mt-0.5">
              <span className="text-slate-300">วงเงิน สงป.อนุมัติ:</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(data.rawApproved, useCompactUnit)}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="budget-charts-section" className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 mb-6">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            วิเคราะห์ข้อมูลเชิงกราฟิก
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เปรียบเทียบวงเงินแยกตามหน่วยงาน และสัดส่วนจำนวนโครงการตามสถานะ
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          <button
            id="tab-dept-btn"
            onClick={() => setActiveTab('department')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'department'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>เปรียบเทียบตามหน่วยงาน</span>
          </button>

          <button
            id="tab-status-btn"
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'status'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>สัดส่วนจำนวนโครงการ</span>
          </button>
        </div>
      </div>

      {/* Main Container: Chart + Side Panel */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch">
        
        {/* Chart Display Area */}
        <div className="w-full lg:w-1/2 flex-1 min-w-0 flex flex-col justify-between">
          
          {/* Sub-label when in Status mode */}
          {activeTab === 'status' && (
            <div className="flex items-center justify-between gap-2 mb-3 px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                สัดส่วนตามจำนวนโครงการ (รวม {projects.length} โครงการ)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                (คลิกที่ชิ้นกราฟเพื่อกรองรายการ)
              </span>
            </div>
          )}

          <div className="h-72 sm:h-80 relative min-w-0 w-full" style={{ minWidth: 0, minHeight: 280 }}>
            {/* Tab 1: Department Bar Chart - Comparison Requested vs Approved */}
            {activeTab === 'department' && (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={260} debounce={50}>
                <BarChart data={departmentData} margin={{ top: 20, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 'bold', fill: '#334155' }} />
                  <YAxis tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}M`} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} formatter={(value) => <span className="text-xs text-slate-700 font-bold">{value}</span>} />
                  <Bar dataKey="requestedMB" name="วงเงินขอรับจัดสรร (ล้านบาท)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="approvedMB" name="วงเงิน สงป.อนุมัติ (ล้านบาท)" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Tab 2: Status Donut Chart - Strictly Project Count */}
            {activeTab === 'status' && (
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={260} debounce={50}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    onClick={(entry: any) => setSelectedStatusCategory(entry?.category || entry?.nameKey || null)}
                    cursor="pointer"
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.category] || '#94a3b8'}
                        stroke={selectedStatusCategory === entry.category ? '#1e293b' : '#ffffff'}
                        strokeWidth={selectedStatusCategory === entry.category ? 3 : 2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => {
                      const item = statusData.find((d) => d.name === value);
                      return (
                        <span className="text-xs text-slate-700 font-medium">
                          {value} {item ? `(${item.count})` : ''}
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Breakdown Mini Grid */}
          {activeTab === 'status' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
              {statusData.map((item) => {
                const pct = projects.length > 0 ? ((item.count / projects.length) * 100).toFixed(1) : '0';
                return (
                  <button
                    type="button"
                    key={item.category}
                    onClick={() => setSelectedStatusCategory((curr) => curr === item.category ? null : item.category)}
                    className={`p-2 rounded-xl text-left border transition-all text-xs ${
                      selectedStatusCategory === item.category
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-slate-800 truncate text-[11px]">{item.name}</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 shrink-0">
                        {item.count} โครงการ
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 flex justify-between items-center">
                      <span>สัดส่วน:</span>
                      <span className="font-bold text-slate-700">{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Side Panel: Selected Status or Minister Pending */}
        <div id="minister-review-side-panel" className="w-full lg:w-1/2 flex-1 min-w-0 bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/90 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-tight">
                    {sidePanelTitle}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedStatusCategory ? 'คลิกที่โครงการเพื่อดูรายละเอียด' : 'โครงการรอดำเนินการเสนอ รมต.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedStatusCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedStatusCategory(null)}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    ล้างการเลือก
                  </button>
                )}
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-500 text-white shadow-2xs">
                  {sidePanelProjects.length}
                </span>
              </div>
            </div>

            {/* List of projects in this status */}
            <div className="space-y-2 max-h-72 lg:max-h-80 overflow-y-auto pr-1">
              {sidePanelProjects.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-medium">
                  ไม่มีโครงการในสถานะนี้
                </div>
              ) : (
                sidePanelProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectProject && onSelectProject(p)}
                    className="p-2.5 bg-white hover:bg-sky-50/70 rounded-xl border border-slate-200/80 hover:border-sky-300 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-sky-700">
                        {p.title}
                      </span>
                      <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {p.departmentCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                      <div className="flex items-center gap-2 font-medium">
                        <span>ขอ: {formatCurrency(p.requestedBudget, useCompactUnit)}</span>
                        {p.approvedBudget ? (
                          <span className="text-emerald-700 font-bold">
                            อนุมัติ: {formatCurrency(p.approvedBudget, useCompactUnit)}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-sky-600 font-medium flex items-center gap-0.5 group-hover:underline">
                        รายละเอียด <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
});

