import React from 'react';
import { X, Building2, Calendar, FileText, CheckCircle2, AlertCircle, Copy, Check, Pencil, TrendingUp, Briefcase, HardHat, FileSignature, Search, FileSpreadsheet, Trash2 } from 'lucide-react';
import { ProjectItem, CustomStatus, CustomInvestmentStage } from '../types';
import { formatCurrency, getStatusBadgeStyle, getStatusLabel, getExpenseTypeLabel, getInvestmentStageLabel, extractFiscalYear } from '../utils/formatters';
import { parseMeetingNo } from '../utils/googleSheets';
import { DEFAULT_INVESTMENT_STAGES } from '../data/projectsData';

interface ProjectModalProps {
  project: ProjectItem | null;
  useCompactUnit: boolean;
  onClose: () => void;
  onEdit?: (project: ProjectItem) => void;
  onEditProjectInfo?: (project: ProjectItem) => void;
  onDelete?: (projectId: number) => void;
  statuses?: CustomStatus[];
  investmentStages?: CustomInvestmentStage[];
  fiscalYearSeqMap?: Map<number, number>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  useCompactUnit,
  onClose,
  onEdit,
  onEditProjectInfo,
  onDelete,
  statuses,
  investmentStages = DEFAULT_INVESTMENT_STAGES,
  fiscalYearSeqMap,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  if (!project) return null;

  const style = getStatusBadgeStyle(project.statusCategory, statuses);

  const handleCopyDetails = () => {
    const text = `โครงการ: ${project.title}
หน่วยงาน: ${project.departmentCode} (${project.departmentName})
ประชุมครั้งที่: ${project.meetingNo}
วงเงินขอรับจัดสรร: ${formatCurrency(project.requestedBudget)}
รัฐมนตรีลงนาม: ${project.ministerSignedDate || 'ไม่มีข้อมูล'}
สงป. อนุมัติ (วันที่): ${project.bbApprovedDate || 'ยังไม่ได้อนุมัติ / ไม่ระบุ'}
สถานะ/สงป.อนุมัติ: ${project.approvedBudget ? formatCurrency(project.approvedBudget) : project.approvedStatusText}
หมายเหตุ: ${project.remarks || '-'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 no-print">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between shrink-0">
          <div className="pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-600 text-white">
                ลำดับที่ {fiscalYearSeqMap ? (fiscalYearSeqMap.get(project.id) ?? project.id) : project.id}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-950 text-indigo-200 border border-indigo-700/70">
                ปีงบประมาณ พ.ศ. {project.fiscalYear || extractFiscalYear(project.meetingNo, '2569', project.title)}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                parseMeetingNo(project.meetingNo) === 'ไม่ได้จัดประชุม'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {parseMeetingNo(project.meetingNo) === 'ไม่ได้จัดประชุม'
                  ? 'ไม่ได้จัดประชุม'
                  : `ประชุมครั้งที่ ${parseMeetingNo(project.meetingNo)}`}
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-white leading-snug">
              {project.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-700 overflow-y-auto flex-1">
          
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${style.bg} ${style.border}`}>
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-0.5">
                สถานะงบประมาณ
              </span>
              <span className={`text-sm sm:text-base font-bold ${style.text}`}>
                {getStatusLabel(project.statusCategory, statuses)}
              </span>
            </div>
            {project.approvedBudget && (
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase text-slate-500 block mb-0.5">
                  สงป. อนุมัติแล้ว
                </span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-700">
                  {formatCurrency(project.approvedBudget, useCompactUnit)}
                </span>
              </div>
            )}
          </div>

          {/* Key Grid Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-500" /> หน่วยงานรับผิดชอบ
              </span>
              <p className="font-bold text-slate-900">
                {project.departmentCode} — {project.departmentName}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" /> ปีงบประมาณ
              </span>
              <p className="font-bold text-indigo-900">
                พ.ศ. {project.fiscalYear || extractFiscalYear(project.meetingNo, '2569', project.title)}
                <span className="text-[10px] text-slate-500 font-normal ml-1.5">(1 ต.ค. - 30 ก.ย.)</span>
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> รัฐมนตรีลงนาม
              </span>
              <p className="font-semibold text-slate-800">
                {project.ministerSignedDate || 'ยังไม่ได้ลงนาม / ไม่ระบุ'}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> สงป. อนุมัติ (วันที่)
              </span>
              <p className="font-semibold text-emerald-800">
                {project.bbApprovedDate || 'ยังไม่ได้อนุมัติ / ไม่ระบุ'}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                วงเงินขอรับจัดสรร
              </span>
              <p className="font-extrabold text-blue-700 text-base sm:text-lg">
                {formatCurrency(project.requestedBudget, false)}
              </p>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                ผลการอนุมัติ (สงป.)
              </span>
              <p className="font-bold text-slate-800">
                {project.approvedStatusText}
              </p>
            </div>
          </div>

          {/* Disbursement & Tracking Progress if Approved */}
          {project.statusCategory === 'approved' && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  ความก้าวหน้าการเบิกจ่ายและผลการดำเนินงาน
                </span>
                <span className="text-xs font-extrabold text-blue-700">
                  {project.disbursedAmount && project.approvedBudget
                    ? `${((project.disbursedAmount / project.approvedBudget) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              </div>

              {/* Expense Type and Stage Badges */}
              {(() => {
                const opBudget = typeof project.operatingBudget === 'number' ? project.operatingBudget : 0;
                const invBudget = typeof project.investmentBudget === 'number' ? project.investmentBudget : 0;
                const hasOperating = project.expenseType === 'operating' || opBudget > 0 || (project.expenseType === 'both' && (opBudget > 0 || invBudget === 0));
                const hasInvestment = project.expenseType !== 'operating' && (
                  invBudget > 0 ||
                  (project.expenseType === 'investment' && (typeof project.investmentBudget !== 'number' || project.investmentBudget > 0)) ||
                  (!project.expenseType && opBudget === 0 && (typeof project.investmentBudget !== 'number' || project.investmentBudget > 0))
                );

                return (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {hasOperating && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Briefcase className="w-3.5 h-3.5 text-emerald-700" />
                        งบดำเนินงาน: {project.operatingBudget ? formatCurrency(project.operatingBudget) : 'ตามวงเงินอนุมัติ'}
                      </span>
                    )}
                    {hasInvestment && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-blue-100 text-blue-800 border border-blue-300">
                        <HardHat className="w-3.5 h-3.5 text-blue-700" />
                        งบลงทุน: {project.investmentBudget ? formatCurrency(project.investmentBudget) : 'ตามวงเงินอนุมัติ'}
                      </span>
                    )}
                    {hasInvestment && (typeof project.investmentBudget === 'number' ? project.investmentBudget > 0 : true) && project.investmentStage && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        ขั้นตอน: {getInvestmentStageLabel(project.investmentStage, investmentStages)}
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-white p-3 rounded-lg border border-blue-100">
                <div>
                  <span className="text-[11px] text-slate-500 block">เบิกจ่ายแล้วสะสม</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {formatCurrency(project.disbursedAmount || 0, useCompactUnit)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">งบประมาณคงเหลือ</span>
                  <span className="font-bold text-amber-700 text-sm">
                    {formatCurrency(
                      Math.max(0, (project.approvedBudget || 0) - (project.disbursedAmount || 0)),
                      useCompactUnit
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">ความคืบหน้าเนื้องาน</span>
                  <span className="font-bold text-indigo-700 text-sm">
                    {project.physicalProgress || 0}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      project.approvedBudget && project.disbursedAmount
                        ? Math.min(100, (project.disbursedAmount / project.approvedBudget) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>

              {project.trackingNotes && (
                <div className="text-xs text-blue-950 font-medium">
                  <strong>หมายเหตุติดตามผล:</strong> {project.trackingNotes}
                </div>
              )}
            </div>
          )}

          {/* Remarks Section */}
          {project.remarks && (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-600" /> หมายเหตุ / มติที่ประชุม
              </span>
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                {project.remarks}
              </p>
            </div>
          )}

          {/* Timestamp info */}
          {project.updatedAt && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
              <span>บันทึก/แก้ไขข้อมูลล่าสุด: <strong className="text-slate-600 font-semibold">{project.updatedAt}</strong></span>
              {project.lastModifiedBy && <span>ผู้ปรับปรุง: {project.lastModifiedBy}</span>}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDetails}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">คัดลอกเรียบร้อย</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>คัดลอกข้อมูล</span>
                </>
              )}
            </button>

            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs cursor-pointer"
                title="ไปหน้าบันทึกเบิกจ่าย เพื่อแก้ไขสถานะการเบิกจ่าย"
              >
                <TrendingUp className="w-4 h-4" />
                <span>บันทึกเบิกจ่าย / แก้ไขสถานะ</span>
              </button>
            )}

            {onEditProjectInfo && (
              <button
                onClick={() => {
                  onClose();
                  onEditProjectInfo(project);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                title="แก้ไขข้อมูลทั่วไปของโครงการ"
              >
                <Pencil className="w-4 h-4 text-slate-500" />
                <span>แก้ไขข้อมูลโครงการ</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
                title="ลบโครงการนี้ออกจากระบบ"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>ลบโครงการ</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>

      {/* Delete Confirmation In-App Modal */}
      {showDeleteConfirm && project && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              ยืนยันการลบโครงการ?
            </h3>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              คุณกำลังจะลบโครงการ <strong className="text-slate-800 font-semibold">#{project.id} - {project.title}</strong> ออกจากระบบ ข้อมูลนี้จะถูกลบและซิงค์ไปยัง Google Sheet ด้วย
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDelete) {
                    onDelete(project.id);
                  }
                  setShowDeleteConfirm(false);
                  onClose();
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
};
