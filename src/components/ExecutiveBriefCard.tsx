import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, AlertCircle, CheckCircle, TrendingUp, HelpCircle } from 'lucide-react';
import { KpiSummary } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ExecutiveBriefCardProps {
  kpi: KpiSummary;
}

export const ExecutiveBriefCard: React.FC<ExecutiveBriefCardProps> = ({ kpi }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div id="executive-brief-card" className="bg-indigo-900 rounded-xl p-5 sm:p-6 mb-6 shadow-lg shadow-indigo-100/50 text-white border border-indigo-800 no-print">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500/20 p-2.5 rounded-lg border border-indigo-400/30 text-amber-300">
            <Lightbulb className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              สรุปกลยุทธ์และสาระสำคัญสำหรับผู้บริหาร (Executive Note)
            </h2>
            <p className="text-xs text-indigo-200">
              วิเคราะห์ภาพรวมงบประมาณ 20 โครงการ วงเงินรวม {formatCurrency(kpi.totalRequestedBudget, true)}
            </p>
          </div>
        </div>
        <button
          className="px-3 py-1.5 rounded-lg bg-white text-indigo-900 text-xs font-bold hover:bg-indigo-50 transition-colors shadow-xs"
          aria-label={isExpanded ? "ย่อส่วนสรุป" : "ขยายส่วนสรุป"}
        >
          {isExpanded ? (
            <span className="flex items-center gap-1"><ChevronUp className="w-4 h-4" /> ย่อหน้า</span>
          ) : (
            <span className="flex items-center gap-1"><ChevronDown className="w-4 h-4" /> ขยายสรุป</span>
          )}
        </button>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="mt-5 pt-4 border-t border-indigo-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
          
          {/* Box 1: Status Distribution Overview */}
          <div className="bg-indigo-950/60 rounded-lg p-4 border border-indigo-800/80">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <CheckCircle className="w-4 h-4" />
              <span>1. สภาพการอนุมัติงบประมาณ</span>
            </div>
            <p className="text-indigo-100 leading-relaxed">
              สงป. อนุมัติแล้ว <strong className="text-emerald-300 font-bold">{formatCurrency(kpi.totalApprovedBudget, true)}</strong> (คิดเป็น <span className="text-emerald-400 font-bold">{(kpi.totalApprovedBudget/kpi.totalRequestedBudget*100).toFixed(1)}%</span>) โดยโครงการหลักคือการบริหารจัดการทรัพยากรธรรมชาติ (ทบ. 6.54 พันล้านบาท)
            </p>
          </div>

          {/* Box 2: Returned/Review Alert */}
          <div className="bg-indigo-950/60 rounded-lg p-4 border border-indigo-800/80">
            <div className="flex items-center gap-2 text-rose-300 font-bold mb-2">
              <AlertCircle className="w-4 h-4" />
              <span>2. โครงการส่งเรื่องคืนทบทวน</span>
            </div>
            <p className="text-indigo-100 leading-relaxed">
              วงเงินสูงถึง <strong className="text-rose-200 font-bold">{formatCurrency(kpi.totalReturnedBudget, true)}</strong> (คิดเป็น <span className="text-rose-300 font-bold">{(kpi.totalReturnedBudget/kpi.totalRequestedBudget*100).toFixed(1)}%</span>) โดยเฉพาะโครงการแก้ไขปัญหาน้ำเร่งด่วน (ทน. 24.06 พันล้านบาท) และศูนย์ AI (ศทอ. 420 ล้านบาท)
            </p>
          </div>

          {/* Box 3: Under Review & Next Actions */}
          <div className="bg-indigo-950/60 rounded-lg p-4 border border-indigo-800/80">
            <div className="flex items-center gap-2 text-amber-300 font-bold mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>3. โครงการอยู่ระหว่างพิจารณา</span>
            </div>
            <p className="text-indigo-100 leading-relaxed">
              รวม <strong className="text-amber-200 font-bold">{formatCurrency(kpi.totalUnderReviewBudget, true)}</strong> (คิดเป็น <span className="text-amber-300 font-bold">{(kpi.totalUnderReviewBudget/kpi.totalRequestedBudget*100).toFixed(1)}%</span>) ไฮไลต์หลักคือรายการงบกลางกรณีคลองด่าน (คพ. 10 พันล้านบาท) และเยียวยาช้างป่า (อส.)
            </p>
          </div>

        </div>
      )}

    </div>
  );
};
