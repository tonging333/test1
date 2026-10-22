import React, { useState, useEffect } from 'react';
import { X, Save, Building2, Calendar, DollarSign, FileText, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { ProjectItem, DepartmentCode, DepartmentInfo, CustomStatus } from '../types';
import { DEPARTMENTS, DEFAULT_STATUSES } from '../data/projectsData';
import { ThaiDatePicker } from './ThaiDatePicker';
import { FormattedNumberInput } from './FormattedNumberInput';
import { parseMeetingNo } from '../utils/googleSheets';
import { extractFiscalYear } from '../utils/formatters';

interface ProjectEditModalProps {
  project: ProjectItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProject: ProjectItem) => void;
  onDelete?: (projectId: number) => void;
  departments: Record<string, DepartmentInfo>;
  statuses: CustomStatus[];
  isNew?: boolean;
  availableFiscalYears?: string[];
}

const STATUS_THEME_CLASSES: Record<string, { active: string; default: string }> = {
  sky: {
    active: 'bg-sky-50 border-sky-400 text-sky-800 ring-2 ring-sky-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  amber: {
    active: 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  emerald: {
    active: 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  blue: {
    active: 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  purple: {
    active: 'bg-purple-50 border-purple-400 text-purple-800 ring-2 ring-purple-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  rose: {
    active: 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  slate: {
    active: 'bg-slate-100 border-slate-400 text-slate-800 ring-2 ring-slate-200',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  indigo: {
    active: 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-100',
    default: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
  },
};

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
  project,
  isOpen,
  onClose,
  onSave,
  onDelete,
  departments,
  statuses,
  isNew = false,
  availableFiscalYears,
}) => {
  const [formData, setFormData] = useState<ProjectItem | null>(project);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (project) {
      const fy = project.fiscalYear || extractFiscalYear(project.meetingNo, '2569', project.title);
      setFormData({
        ...project,
        fiscalYear: fy,
        meetingNo: parseMeetingNo(project.meetingNo),
      });
      setSuccessMessage('');
      setShowDeleteConfirm(false);
    }
  }, [project]);

  const yearsList = React.useMemo(() => {
    const list = new Set<string>();
    if (availableFiscalYears && availableFiscalYears.length > 0) {
      availableFiscalYears.forEach((y) => {
        if (y && y !== 'all') list.add(y.trim());
      });
    }
    ['2571', '2570', '2569', '2568', '2567'].forEach((y) => list.add(y));
    if (formData?.fiscalYear) list.add(formData.fiscalYear);
    return Array.from(list).sort((a, b) => b.localeCompare(a));
  }, [availableFiscalYears, formData?.fiscalYear]);

  if (!isOpen || !project || !formData) return null;

  const handleDepartmentChange = (code: DepartmentCode) => {
    const deptInfo = departments[code] || DEPARTMENTS[code];
    if (deptInfo) {
      setFormData((prev) => prev ? ({
        ...prev,
        departmentCode: code,
        departmentName: deptInfo.fullName,
      }) : null);
    } else {
      setFormData((prev) => prev ? ({
        ...prev,
        departmentCode: code,
      }) : null);
    }
  };

  const handleStatusChange = (statusKey: string, statusLabel: string) => {
    setFormData((prev) => {
      if (!prev) return null;
      let newApprovedBudget: number | null = prev.approvedBudget;
      if (statusKey === 'approved') {
        if (!prev.approvedBudget || prev.approvedBudget <= 0) {
          newApprovedBudget = prev.requestedBudget;
        }
      } else {
        newApprovedBudget = null;
      }
      return {
        ...prev,
        statusCategory: statusKey as ProjectItem['statusCategory'],
        approvedBudget: newApprovedBudget,
        approvedStatusText: statusLabel,
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('กรุณาระบุชื่อโครงการ');
      return;
    }
    onSave({
      ...formData,
      meetingNo: parseMeetingNo(formData.meetingNo),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 no-print">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isNew ? 'bg-emerald-600' : 'bg-indigo-600'} text-white`}>
              {isNew ? 'เพิ่มโครงการใหม่' : 'แก้ไขข้อมูล'}
            </span>
            <span className="text-sm font-bold text-slate-200">
              {isNew ? `โครงการลำดับที่ #${formData.id}` : `โครงการ #${formData.id}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-700 overflow-y-auto flex-1">
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ชื่อโครงการ <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Fiscal Year */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ปีงบประมาณ (พ.ศ.) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.fiscalYear || '2569'}
                onChange={(e) => setFormData({ ...formData, fiscalYear: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/40 text-indigo-950 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              >
                {yearsList.map((yr) => (
                  <option key={yr} value={yr}>
                    พ.ศ. {yr}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                รอบ 1 ต.ค. - 30 ก.ย.
              </span>
            </div>

            {/* Meeting No */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ครั้งที่ประชุม <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.meetingNo}
                onChange={(e) => setFormData({ ...formData, meetingNo: e.target.value })}
                placeholder="เช่น 12/2568, 1/2569"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                ครั้งที่/ปี หรือ ไม่ได้จัดประชุม
              </span>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                หน่วยงานรับผิดชอบ <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.departmentCode}
                onChange={(e) => handleDepartmentChange(e.target.value as DepartmentCode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold bg-white"
              >
                {Object.entries(departments).map(([code, dept]) => (
                  <option key={code} value={code}>
                    {code} — {(dept as DepartmentInfo).fullName}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block truncate">
                {formData.departmentName}
              </span>
            </div>
          </div>

          {/* Requested Budget */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วงเงินขอรับจัดสรร (บาท) <span className="text-rose-500">*</span>
            </label>
            <FormattedNumberInput
              required
              value={formData.requestedBudget}
              onChange={(val) => setFormData({ ...formData, requestedBudget: val || 0 })}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-indigo-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Minister Signed Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                วันที่รัฐมนตรีลงนาม
              </label>
              <ThaiDatePicker
                value={formData.ministerSignedDate}
                onChange={(newDateStr) => {
                  setFormData((prev) => {
                    if (!prev) return null;
                    const cleanDate = newDateStr && newDateStr.trim().length > 0 ? newDateStr.trim() : null;
                    const isSigned = !!cleanDate;
                    
                    let newStatus = prev.statusCategory;
                    let newStatusText = prev.approvedStatusText;

                    // If signed date is provided and current status is draft_pending, auto-update to under_review (สงป.)
                    if (isSigned && prev.statusCategory === 'draft_pending') {
                      newStatus = 'under_review';
                      newStatusText = 'อยู่ระหว่างพิจารณา (สงป.)';
                    } else if (!isSigned && prev.statusCategory === 'under_review' && !prev.bbApprovedDate) {
                      // If signed date is deleted/cleared and current status is under_review, auto-revert to draft_pending
                      newStatus = 'draft_pending';
                      newStatusText = 'อยู่ระหว่างการพิจารณาของรัฐมนตรี';
                    }

                    return {
                      ...prev,
                      ministerSignedDate: cleanDate,
                      statusCategory: newStatus,
                      approvedStatusText: newStatusText,
                    };
                  });
                }}
                placeholder="คลิกเลือกวันลงนาม หรือพิมพ์วันที่..."
              />
            </div>

            {/* BB Approved Date (สงป. อนุมัติ (วันที่)) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                สงป. อนุมัติ (วันที่)
              </label>
              <ThaiDatePicker
                value={formData.bbApprovedDate || null}
                onChange={(newDateStr) => {
                  setFormData((prev) => {
                    if (!prev) return null;
                    const cleanDate = newDateStr && newDateStr.trim().length > 0 ? newDateStr.trim() : null;
                    const isApproved = !!cleanDate;
                    let newStatus = prev.statusCategory;
                    let newApprovedBudget = prev.approvedBudget;
                    let newStatusText = prev.approvedStatusText;

                    if (isApproved && prev.statusCategory !== 'approved') {
                      newStatus = 'approved';
                      if (!newApprovedBudget || newApprovedBudget <= 0) {
                        newApprovedBudget = prev.requestedBudget;
                      }
                      newStatusText = 'สงป. อนุมัติแล้ว';
                    } else if (!isApproved && prev.statusCategory === 'approved') {
                      // If BB approved date cleared and no approved budget, revert to under_review or draft_pending
                      newStatus = prev.ministerSignedDate ? 'under_review' : 'draft_pending';
                      newApprovedBudget = null;
                      newStatusText = prev.ministerSignedDate ? 'อยู่ระหว่างพิจารณา (สงป.)' : 'อยู่ระหว่างการพิจารณาของรัฐมนตรี';
                    }

                    return {
                      ...prev,
                      bbApprovedDate: cleanDate,
                      statusCategory: newStatus,
                      approvedBudget: newApprovedBudget,
                      approvedStatusText: newStatusText,
                    };
                  });
                }}
                placeholder="คลิกเลือกวันที่ สงป. อนุมัติ..."
              />
            </div>
          </div>

          {/* Status Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              สถานะงบประมาณ
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(statuses && statuses.length > 0 ? statuses : DEFAULT_STATUSES).map((st) => {
                const isSelected = formData.statusCategory === st.key;
                const themeClasses = STATUS_THEME_CLASSES[st.colorTheme] || STATUS_THEME_CLASSES.sky;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => handleStatusChange(st.key, st.label)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                      isSelected ? themeClasses.active : themeClasses.default
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Approved Budget */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                วงเงินที่อนุมัติ (บาท)
              </label>
              <FormattedNumberInput
                value={formData.approvedBudget}
                onChange={(val) => setFormData({ ...formData, approvedBudget: val })}
                disabled={formData.statusCategory !== 'approved'}
                placeholder={formData.statusCategory === 'approved' ? "ระบุตัวเลขออนุมัติ (หากมี)" : "เฉพาะสถานะ สงป. อนุมัติแล้ว"}
                className={`w-full px-3 py-2 rounded-xl border outline-none transition-all font-bold ${
                  formData.statusCategory === 'approved'
                    ? 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-emerald-700 bg-white'
                    : 'border-slate-200 bg-slate-100/90 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              />
            </div>

            {/* Approved Status Text */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ข้อความแสดงสถานะ
              </label>
              <input
                type="text"
                value={formData.approvedStatusText}
                onChange={(e) => setFormData({ ...formData, approvedStatusText: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมายเหตุ / มติที่ประชุม
            </label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="ระบุรายละเอียดเพิ่มเติม หรือมติที่ประชุม (ถ้ามี)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium"
            />
          </div>

          {/* Buttons Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                title="ลบโครงการนี้ออกจากระบบ"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>ลบโครงการ</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold ${
                  isNew ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                } text-white shadow-xs transition-colors cursor-pointer`}
              >
                <Save className="w-4 h-4" />
                <span>{isNew ? 'บันทึกโครงการใหม่' : 'บันทึกการแก้ไข'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation In-App Modal */}
      {showDeleteConfirm && formData && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              ยืนยันการลบโครงการ?
            </h3>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              คุณกำลังจะลบโครงการ <strong className="text-slate-800 font-semibold">#{formData.id} - {formData.title}</strong> ออกจากระบบ ข้อมูลนี้จะถูกลบและซิงค์ไปยัง Google Sheet ด้วย
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
                    onDelete(formData.id);
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
