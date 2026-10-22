import React from 'react';
import { KpiSummary } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Layers } from 'lucide-react';

interface KpiSummaryCardsProps {
  kpi: KpiSummary;
  useCompactUnit: boolean;
  activeStatusFilter?: string;
  onSelectStatusFilter?: (status: string) => void;
}

export const KpiSummaryCards: React.FC<KpiSummaryCardsProps> = React.memo(({
  kpi,
  useCompactUnit,
  activeStatusFilter = 'all',
  onSelectStatusFilter,
}) => {
  const approvedPct = kpi.totalRequestedBudget > 0 
    ? ((kpi.totalApprovedBudget / kpi.totalRequestedBudget) * 100).toFixed(1) 
    : '0.0';

  const underReviewPct = kpi.totalRequestedBudget > 0 
    ? ((kpi.totalUnderReviewBudget / kpi.totalRequestedBudget) * 100).toFixed(1) 
    : '0.0';

  const returnedPct = kpi.totalRequestedBudget > 0 
    ? ((kpi.totalReturnedBudget / kpi.totalRequestedBudget) * 100).toFixed(1) 
    : '0.0';

  const handleCardClick = (status: string) => {
    if (onSelectStatusFilter) {
      onSelectStatusFilter(status);
    }
  };

  return (
    <div id="kpi-summary-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      
      {/* 1. Total Requested Budget */}
      <div
        id="kpi-card-total"
        onClick={() => handleCardClick('all')}
        className={`bg-white rounded-xl p-5 shadow-xs border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group h-full hover:scale-[1.015] ${
          activeStatusFilter === 'all'
            ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20 shadow-md'
            : 'border-slate-200/80 hover:border-indigo-300 hover:shadow-md'
        }`}
        title="คลิกเพื่อดูโครงการทั้งหมด"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 leading-snug whitespace-nowrap truncate">
            งบขอรับจัดสรรรวม
          </span>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-bold text-slate-900 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpi.totalRequestedBudget, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="flex items-center gap-1 text-slate-600">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              รวม {kpi.totalProjects} โครงการ
            </span>
            {activeStatusFilter === 'all' ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                เลือกอยู่
              </span>
            ) : (
              <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                100%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Minister Review Pending */}
      <div
        id="kpi-card-minister-review"
        onClick={() => handleCardClick('draft_pending')}
        className={`bg-white rounded-xl p-5 shadow-xs border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group h-full hover:scale-[1.015] ${
          activeStatusFilter === 'draft_pending'
            ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-50/20 shadow-md'
            : 'border-slate-200/80 hover:border-sky-300 hover:shadow-md'
        }`}
        title="คลิกเพื่อกรองโครงการที่อยู่ระหว่างพิจารณาของรัฐมนตรี"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 leading-snug whitespace-nowrap truncate">
            อยู่ระหว่างพิจารณา (รมต.)
          </span>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5 my-1 whitespace-nowrap truncate">
            <span className="text-xl xl:text-2xl font-bold text-slate-900">
              {kpi.draftPendingProjectsCount ?? 0}
            </span>
            <span className="text-base font-bold text-slate-800">โครงการ</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium min-h-[29px]">
            <span className="text-slate-600 whitespace-nowrap truncate">
              รอดำเนินการลงนาม รมต.
            </span>
            {activeStatusFilter === 'draft_pending' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-600 text-white shrink-0">
                เลือกอยู่
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Approved Budget */}
      <div
        id="kpi-card-approved"
        onClick={() => handleCardClick('approved')}
        className={`bg-white rounded-xl p-5 shadow-xs border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group h-full hover:scale-[1.015] ${
          activeStatusFilter === 'approved'
            ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20 shadow-md'
            : 'border-slate-200/80 hover:border-emerald-300 hover:shadow-md'
        }`}
        title="คลิกเพื่อกรองโครงการที่ สงป. อนุมัติแล้ว"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 leading-snug whitespace-nowrap truncate">
            สงป. อนุมัติแล้ว
          </span>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-bold text-emerald-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpi.totalApprovedBudget, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600 whitespace-nowrap truncate">
              อนุมัติ {kpi.approvedProjectsCount} โครงการ
            </span>
            {activeStatusFilter === 'approved' ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                เลือกอยู่
              </span>
            ) : (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                {approvedPct}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Under Review Budget */}
      <div
        id="kpi-card-under-review"
        onClick={() => handleCardClick('under_review')}
        className={`bg-white rounded-xl p-5 shadow-xs border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group h-full hover:scale-[1.015] ${
          activeStatusFilter === 'under_review'
            ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20 shadow-md'
            : 'border-slate-200/80 hover:border-amber-300 hover:shadow-md'
        }`}
        title="คลิกเพื่อกรองโครงการที่อยู่ระหว่างพิจารณาของ สงป."
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 leading-snug whitespace-nowrap truncate">
            อยู่ระหว่างพิจารณา (สงป.)
          </span>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-bold text-amber-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpi.totalUnderReviewBudget, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600 whitespace-nowrap truncate">
              พิจารณา {kpi.underReviewProjectsCount} โครงการ
            </span>
            {activeStatusFilter === 'under_review' ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white shrink-0">
                เลือกอยู่
              </span>
            ) : (
              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                {underReviewPct}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Returned & Disapproved Budget */}
      <div
        id="kpi-card-returned"
        onClick={() => handleCardClick('returned_review')}
        className={`bg-white rounded-xl p-5 shadow-xs border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group h-full hover:scale-[1.015] ${
          activeStatusFilter === 'returned_review'
            ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20 shadow-md'
            : 'border-slate-200/80 hover:border-rose-300 hover:shadow-md'
        }`}
        title="คลิกเพื่อกรองโครงการส่งคืนทบทวนหรือไม่อนุมัติ"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-700 leading-snug whitespace-nowrap truncate">
            ส่งคืนทบทวน / ไม่เห็นชอบ
          </span>
        </div>
        <div>
          <div className="text-xl xl:text-2xl font-bold text-rose-600 tracking-tight my-1 whitespace-nowrap truncate">
            {formatCurrency(kpi.totalReturnedBudget, useCompactUnit)}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
            <span className="text-slate-600 whitespace-nowrap truncate">
              รวม {kpi.returnedProjectsCount} โครงการ
            </span>
            {activeStatusFilter === 'returned_review' ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shrink-0">
                เลือกอยู่
              </span>
            ) : (
              <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 shrink-0">
                {returnedPct}%
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
});
