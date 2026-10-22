import React, { useState, useRef, useMemo } from 'react';
import { ProjectItem, CustomStatus, DepartmentInfo } from '../types';
import { formatCurrency, getStatusBadgeStyle, getStatusLabel } from '../utils/formatters';
import { parseMeetingNo } from '../utils/googleSheets';
import { DEPARTMENTS } from '../data/projectsData';
import { Eye, ChevronRight, FileText, Calendar, Building2, AlertCircle, Pencil, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_STATUSES } from '../data/projectsData';

type ColumnKey = 'id' | 'meetingNo' | 'title' | 'department' | 'requestedBudget' | 'ministerSignedDate' | 'bbApprovedDate' | 'status' | 'actions';

const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  id: 55,
  meetingNo: 105,
  title: 300,
  department: 100,
  requestedBudget: 150,
  ministerSignedDate: 120,
  bbApprovedDate: 125,
  status: 190,
  actions: 115,
};

interface ProjectListProps {
  projects: ProjectItem[];
  useCompactUnit: boolean;
  onSelectProject: (project: ProjectItem) => void;
  onEditProject?: (project: ProjectItem) => void;
  onDeleteProject?: (projectId: number) => void;
  onAddNewProject?: () => void;
  searchQuery: string;
  statuses?: CustomStatus[];
  departments?: Record<string, DepartmentInfo>;
  fiscalYearSeqMap?: Map<number, number>;
}

export const ProjectList: React.FC<ProjectListProps> = React.memo(({
  projects,
  useCompactUnit,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onAddNewProject,
  searchQuery,
  statuses,
  departments = DEPARTMENTS,
  fiscalYearSeqMap,
}) => {
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COL_WIDTHS);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const activeResizeRef = useRef<{ col: ColumnKey; startX: number; startWidth: number } | null>(null);

  // คำนวณยอดรวมงบประมาณขอรับจัดสรรทั้งสิ้น และยอดที่ สงป. อนุมัติแล้ว ของแถวทั้งหมดที่แสดง
  const totalRequestedBudget = useMemo(() => {
    return projects.reduce((acc, curr) => acc + (Number(curr.requestedBudget) || 0), 0);
  }, [projects]);

  const totalApprovedBudget = useMemo(() => {
    return projects.reduce((acc, curr) => {
      if (curr.statusCategory === 'approved') {
        return acc + (curr.approvedBudget != null && curr.approvedBudget > 0 ? curr.approvedBudget : (curr.requestedBudget || 0));
      }
      if (curr.approvedBudget != null && curr.approvedBudget > 0) {
        return acc + curr.approvedBudget;
      }
      return acc;
    }, 0);
  }, [projects]);

  const approvedCount = useMemo(() => {
    return projects.filter(
      (p) => p.statusCategory === 'approved' || (p.approvedBudget != null && p.approvedBudget > 0)
    ).length;
  }, [projects]);

  const handleMouseDown = (col: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[col];
    activeResizeRef.current = { col, startX, startWidth };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!activeResizeRef.current) return;
      const deltaX = moveEvent.clientX - activeResizeRef.current.startX;
      const minW = col === 'id' ? 45 : col === 'actions' ? 70 : 80;
      const newWidth = Math.max(minW, activeResizeRef.current.startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [col]: newWidth,
      }));
    };

    const onMouseUp = () => {
      activeResizeRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTouchStart = (col: ColumnKey, e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const startX = e.touches[0].clientX;
    const startWidth = colWidths[col];
    activeResizeRef.current = { col, startX, startWidth };

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!activeResizeRef.current || moveEvent.touches.length !== 1) return;
      const deltaX = moveEvent.touches[0].clientX - activeResizeRef.current.startX;
      const minW = col === 'id' ? 45 : col === 'actions' ? 70 : 80;
      const newWidth = Math.max(minW, activeResizeRef.current.startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [col]: newWidth,
      }));
    };

    const onTouchEnd = () => {
      activeResizeRef.current = null;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  const resetColWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
  };

  if (projects.length === 0) {
    return (
      <div id="no-projects-found" className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">ไม่พบโครงการที่ค้นหา</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          ลองปรับตัวกรองหรือล้างคำค้นหา "{searchQuery}" อีกครั้ง
        </p>
        {onAddNewProject && (
          <button
            type="button"
            onClick={onAddNewProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มโครงการใหม่</span>
          </button>
        )}
      </div>
    );
  }

  const isWidthsModified = Object.keys(DEFAULT_COL_WIDTHS).some(
    (k) => colWidths[k as ColumnKey] !== DEFAULT_COL_WIDTHS[k as ColumnKey]
  );

  return (
    <div id="project-list-section" className="space-y-4">
      
      {/* Table Header Summary & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-semibold text-slate-600 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-800 font-bold">รายการโครงการ ({projects.length} รายการ)</span>
          {isWidthsModified && (
            <button
              onClick={resetColWidths}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
              title="คืนค่าขนาดคอลัมน์เดิม"
            >
              <RotateCcw className="w-3 h-3" />
              รีเซ็ตขนาดคอลัมน์
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-normal hidden lg:inline">
            ลากขอบหัวตารางเพื่อย่อ/ขยายคอลัมน์ | คลิกแถวเพื่อดูรายละเอียด
          </span>
          {onAddNewProject && (
            <button
              id="btn-add-new-project"
              type="button"
              onClick={onAddNewProject}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-sm active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มโครงการ</span>
            </button>
          )}
        </div>
      </div>

      {/* --- DESKTOP TABLE VIEW (sm and up) --- */}
      <div className="hidden md:block bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-xs sm:text-sm table-fixed"
            style={{ minWidth: (Object.values(colWidths) as number[]).reduce((a: number, b: number) => a + b, 0) }}
          >
            <thead>
              <tr className="bg-slate-900 text-white font-bold tracking-wider uppercase text-xs select-none border-b border-slate-800">
                {/* ลำดับ */}
                <th
                  style={{ width: `${colWidths.id}px` }}
                  className="py-3.5 px-2 text-center relative group"
                >
                  <span>ลำดับ</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('id', e)}
                    onTouchStart={(e) => handleTouchStart('id', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* ครั้งที่ประชุม */}
                <th
                  style={{ width: `${colWidths.meetingNo}px` }}
                  className="py-3.5 px-3 relative group"
                >
                  <span>ครั้งที่ประชุม</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('meetingNo', e)}
                    onTouchStart={(e) => handleTouchStart('meetingNo', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* ชื่อโครงการ */}
                <th
                  style={{ width: `${colWidths.title}px` }}
                  className="py-3.5 px-4 relative group"
                >
                  <span>ชื่อโครงการ</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('title', e)}
                    onTouchStart={(e) => handleTouchStart('title', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* หน่วยงาน */}
                <th
                  style={{ width: `${colWidths.department}px` }}
                  className="py-3.5 px-3 text-center relative group"
                >
                  <span>หน่วยงาน</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('department', e)}
                    onTouchStart={(e) => handleTouchStart('department', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* ขอรับจัดสรร (บาท) */}
                <th
                  style={{ width: `${colWidths.requestedBudget}px` }}
                  className="py-3.5 px-4 text-right relative group"
                >
                  <span>ขอรับจัดสรร (บาท)</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('requestedBudget', e)}
                    onTouchStart={(e) => handleTouchStart('requestedBudget', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* รมต. ลงนาม */}
                <th
                  style={{ width: `${colWidths.ministerSignedDate}px` }}
                  className="py-3.5 px-3 text-center relative group"
                >
                  <span>รมต. ลงนาม</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('ministerSignedDate', e)}
                    onTouchStart={(e) => handleTouchStart('ministerSignedDate', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* สงป. อนุมัติ */}
                <th
                  style={{ width: `${colWidths.bbApprovedDate}px` }}
                  className="py-3.5 px-3 text-center relative group"
                >
                  <span>สงป. อนุมัติ</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('bbApprovedDate', e)}
                    onTouchStart={(e) => handleTouchStart('bbApprovedDate', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* สถานะ */}
                <th
                  style={{ width: `${colWidths.status}px` }}
                  className="py-3.5 px-4 text-center relative group"
                >
                  <span>สถานะ</span>
                  <div
                    onMouseDown={(e) => handleMouseDown('status', e)}
                    onTouchStart={(e) => handleTouchStart('status', e)}
                    className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none flex items-center justify-center group/handle z-10 hover:bg-slate-800 transition-colors"
                    title="ลากเพื่อย่อ/ขยายขนาดคอลัมน์"
                  >
                    <div className="w-[2px] h-3.5 bg-slate-700 group-hover/handle:bg-indigo-400 group-hover/handle:h-full transition-all" />
                  </div>
                </th>

                {/* จัดการ */}
                <th
                  style={{ width: `${colWidths.actions}px` }}
                  className="py-3.5 px-3 text-center relative"
                >
                  <span>จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
              {/* แถว รวมงบประมาณทั้งสิ้น บนสุดของตาราง */}
              <tr
                id="table-row-total-budget-summary"
                className="bg-indigo-50/75 hover:bg-indigo-50/90 border-b-2 border-indigo-200/90 font-bold transition-colors select-none"
              >
                {/* รวมงบประมาณทั้งสิ้น (รวมคอลัมน์ ลำดับ, ครั้งที่ประชุม, ชื่อโครงการ, หน่วยงาน) */}
                <td colSpan={4} className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-black shadow-xs shrink-0">
                      ∑
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                      รวมงบประมาณทั้งสิ้น
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-white/90 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                      {projects.length} โครงการ
                    </span>
                  </div>
                </td>

                {/* ขอรับจัดสรรทั้งสิ้น (บาท) */}
                <td className="py-3 px-4 text-right font-extrabold text-indigo-950 text-xs sm:text-sm truncate">
                  {formatCurrency(totalRequestedBudget, useCompactUnit)}
                </td>

                {/* รมต. ลงนาม */}
                <td className="py-3 px-3 text-center text-xs text-slate-400 font-normal">
                  -
                </td>

                {/* สงป. อนุมัติ */}
                <td className="py-3 px-3 text-center text-xs text-slate-400 font-normal">
                  -
                </td>

                {/* สถานะ ที่สงป.อนุมัติแล้ว */}
                <td className="py-3 px-4 text-center overflow-hidden">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 max-w-full truncate shadow-xs">
                      {formatCurrency(totalApprovedBudget, useCompactUnit)}
                    </span>
                    {approvedCount > 0 && (
                      <span className="text-[10px] text-emerald-700 font-semibold whitespace-nowrap">
                        อนุมัติแล้ว {approvedCount} โครงการ
                      </span>
                    )}
                  </div>
                </td>

                {/* จัดการ */}
                <td className="py-3 px-2 text-center text-slate-400 font-normal">
                  -
                </td>
              </tr>

              {projects.map((item, idx) => {
                const style = getStatusBadgeStyle(item.statusCategory, statuses);
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectProject(item)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    {/* ลำดับ */}
                    <td className="py-3.5 px-2 text-center font-bold text-slate-500 truncate">
                      {fiscalYearSeqMap ? (fiscalYearSeqMap.get(item.id) ?? (idx + 1)) : (idx + 1)}
                    </td>

                    {/* ครั้งที่ประชุม */}
                    <td className="py-3.5 px-3 truncate">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {parseMeetingNo(item.meetingNo)}
                        </span>
                        {item.fiscalYear && (
                          <span className="text-[10px] font-medium text-slate-400">
                            ปีงบฯ {item.fiscalYear}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ชื่อโครงการ */}
                    <td className="py-3 px-4 overflow-hidden">
                      <p className="font-semibold text-slate-800 text-xs sm:text-sm leading-snug line-clamp-2 hover:text-indigo-600 transition-colors">
                        {item.title}
                      </p>
                      {item.remarks && (
                        <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-medium bg-amber-50 px-2 py-0.5 rounded-md w-fit border border-amber-200/60">
                          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate max-w-md">{item.remarks}</span>
                        </p>
                      )}
                    </td>

                    {/* หน่วยงาน */}
                    <td className="py-3.5 px-3 text-center truncate">
                      <span
                        className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: (departments[item.departmentCode]?.color || DEPARTMENTS[item.departmentCode]?.color || '#3b82f6') }}
                        title={item.departmentName}
                      >
                        {item.departmentCode}
                      </span>
                    </td>

                    {/* ขอรับจัดสรร */}
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 truncate">
                      {formatCurrency(item.requestedBudget, useCompactUnit)}
                    </td>

                    {/* รัฐมนตรีลงนาม */}
                    <td className="py-3.5 px-3 text-center text-xs text-slate-600 truncate">
                      {item.ministerSignedDate ? (
                        <span className="font-medium text-slate-700">{item.ministerSignedDate}</span>
                      ) : (
                        <span className="text-slate-400 font-light">-</span>
                      )}
                    </td>

                    {/* สงป. อนุมัติ */}
                    <td className="py-3.5 px-3 text-center text-xs truncate">
                      {item.bbApprovedDate ? (
                        <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 inline-block">
                          {item.bbApprovedDate}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-light">-</span>
                      )}
                    </td>

                    {/* สงป.อนุมัติ / สถานะ */}
                    <td className="py-3.5 px-4 text-center overflow-hidden">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-xl text-xs font-semibold border max-w-full truncate ${style.bg} ${style.text} ${style.border}`}>
                        {item.approvedBudget ? formatCurrency(item.approvedBudget, useCompactUnit) : getStatusLabel(item.statusCategory, statuses)}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(item);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onEditProject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProject(item);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors shrink-0"
                            title="แก้ไขข้อมูล"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteProject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(item);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
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
          </table>
        </div>
      </div>

      {/* --- MOBILE CARD VIEW (xs / sm touch devices) --- */}
      <div className="md:hidden space-y-3">
        {/* สรุปรวมงบประมาณทั้งสิ้นบนสุดสำหรับ Mobile */}
        <div id="mobile-total-budget-summary-card" className="bg-gradient-to-r from-slate-100 via-indigo-50/50 to-emerald-50/50 rounded-2xl p-4 border border-indigo-200/80 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-indigo-100/80">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-black shadow-xs">
                ∑
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                รวมงบประมาณทั้งสิ้น
              </span>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              {projects.length} โครงการ
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/90 p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                ขอรับจัดสรรทั้งสิ้น
              </span>
              <span className="font-extrabold text-indigo-950 text-xs sm:text-sm">
                {formatCurrency(totalRequestedBudget, useCompactUnit)}
              </span>
            </div>

            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">
                สงป. อนุมัติแล้ว
              </span>
              <span className="font-extrabold text-emerald-800 text-xs sm:text-sm">
                {formatCurrency(totalApprovedBudget, useCompactUnit)}
              </span>
              {approvedCount > 0 && (
                <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                  ({approvedCount} โครงการ)
                </span>
              )}
            </div>
          </div>
        </div>

        {projects.map((item, idx) => {
          const style = getStatusBadgeStyle(item.statusCategory, statuses);
          return (
            <div
              key={item.id}
              onClick={() => onSelectProject(item)}
              className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 active:bg-slate-50 transition-all cursor-pointer relative"
            >
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-white">
                    #{fiscalYearSeqMap ? (fiscalYearSeqMap.get(item.id) ?? (idx + 1)) : (idx + 1)}
                  </span>
                  {item.fiscalYear && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ปีงบฯ {item.fiscalYear}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                    parseMeetingNo(item.meetingNo) === 'ไม่ได้จัดประชุม'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {parseMeetingNo(item.meetingNo) === 'ไม่ได้จัดประชุม'
                      ? 'ไม่ได้จัดประชุม'
                      : `ประชุม ${parseMeetingNo(item.meetingNo)}`}
                  </span>
                </div>
                <span
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-bold text-white"
                  style={{ backgroundColor: DEPARTMENTS[item.departmentCode]?.color || '#3b82f6' }}
                >
                  {item.departmentCode}
                </span>
              </div>

              {/* Title */}
              <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug mb-2">
                {item.title}
              </h4>

              {/* Status Badge */}
              <div className="mb-3">
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                  {getStatusLabel(item.statusCategory, statuses)}
                  {item.approvedBudget && `: ${formatCurrency(item.approvedBudget, useCompactUnit)}`}
                </span>
              </div>

              {/* Budget Details Grid */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      ขอรับจัดสรร
                    </span>
                    <span className="font-extrabold text-blue-700 text-sm">
                      {formatCurrency(item.requestedBudget, useCompactUnit)}
                    </span>
                  </div>

                  {item.ministerSignedDate && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        รมต. ลงนาม
                      </span>
                      <span className="font-medium text-slate-700 text-xs">
                        {item.ministerSignedDate}
                      </span>
                    </div>
                  )}
                </div>

                {item.bbApprovedDate && (
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-700">
                      สงป. อนุมัติ (วันที่)
                    </span>
                    <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 text-xs">
                      {item.bbApprovedDate}
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks if present */}
              {item.remarks && (
                <div className="mt-2.5 p-2 bg-amber-50 rounded-lg text-[11px] text-amber-900 font-medium border border-amber-200/60 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{item.remarks}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100 gap-2">
                <div className="flex items-center gap-1.5">
                  {onEditProject && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProject(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                  )}
                  {onDeleteProject && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(item);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200 hover:bg-rose-100 transition-colors"
                      title="ลบโครงการ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-right text-xs font-semibold text-blue-600 flex items-center gap-1 ml-auto">
                  <span>รายละเอียดเพิ่มเติม</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
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
                <span className="text-slate-400">วงเงินขอรับจัดสรร:</span>
                <span className="font-bold text-blue-700">{formatCurrency(projectToDelete.requestedBudget)} บาท</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
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
