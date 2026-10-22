import React, { useState, useEffect } from 'react';
import { ProjectItem, DisbursementRecord, DisbursementStatus, DepartmentInfo, ExpenseType, InvestmentStage, CustomInvestmentStage } from '../types';
import { formatCurrency } from '../utils/formatters';
import { FormattedNumberInput } from './FormattedNumberInput';
import { DEFAULT_INVESTMENT_STAGES } from '../data/projectsData';
import {
  X,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Save,
  Tag,
  FileCheck,
  Briefcase,
  HardHat,
  Search,
  FileSpreadsheet,
  FileSignature,
  Layers,
  Sparkles,
  Lock,
  PieChart,
  Hammer,
  Check,
} from 'lucide-react';

interface DisbursementModalProps {
  project: ProjectItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProject: ProjectItem) => void;
  departments: Record<string, DepartmentInfo>;
  investmentStages?: CustomInvestmentStage[];
}

export const DisbursementModal: React.FC<DisbursementModalProps> = ({
  project,
  isOpen,
  onClose,
  onSave,
  departments,
  investmentStages = DEFAULT_INVESTMENT_STAGES,
}) => {
  const determineExpenseType = (p?: ProjectItem | null): ExpenseType => {
    if (!p) return 'investment';
    if (p.expenseType === 'both' || p.expenseType === 'operating' || p.expenseType === 'investment') {
      return p.expenseType;
    }
    const op = typeof p.operatingBudget === 'number' ? p.operatingBudget : 0;
    const inv = typeof p.investmentBudget === 'number' ? p.investmentBudget : 0;
    if (op > 0 && inv > 0) return 'both';
    if (op > 0) return 'operating';
    if (inv > 0) return 'investment';
    return 'investment';
  };

  // Form states
  const [approvedBudget, setApprovedBudget] = useState<number>(() => {
    return (project?.approvedBudget !== null && project?.approvedBudget !== undefined && (project?.approvedBudget ?? 0) > 0)
      ? (project?.approvedBudget ?? 0)
      : (project?.requestedBudget || 0);
  });

  const [expenseType, setExpenseType] = useState<ExpenseType>(() => determineExpenseType(project));
  const [operatingBudget, setOperatingBudget] = useState<number>(
    project?.operatingBudget ?? 0
  );
  const [investmentBudget, setInvestmentBudget] = useState<number>(
    project?.investmentBudget ?? 0
  );
  const [investmentStage, setInvestmentStage] = useState<InvestmentStage | null>(
    project?.investmentStage ?? (project?.contractDate ? 'signed' : 'procuring')
  );

  const [disbursedAmount, setDisbursedAmount] = useState<number>(project?.disbursedAmount || 0);
  const [physicalProgress, setPhysicalProgress] = useState<number>(project?.physicalProgress || 0);
  const [disbursementStatus, setDisbursementStatus] = useState<DisbursementStatus>(
    project?.disbursementStatus || 'not_started'
  );
  const [contractDate, setContractDate] = useState<string>(project?.contractDate || '');
  const [projectDeadline, setProjectDeadline] = useState<string>(project?.projectDeadline || '');
  const [trackingNotes, setTrackingNotes] = useState<string>(project?.trackingNotes || '');
  const [records, setRecords] = useState<DisbursementRecord[]>(project?.disbursementRecords || []);

  // New Record input fields
  const [showAddRecord, setShowAddRecord] = useState<boolean>(false);
  const [newRecDate, setNewRecDate] = useState<string>('');
  const [newRecAmount, setNewRecAmount] = useState<number>(0);
  const [newRecPeriod, setNewRecPeriod] = useState<string>('');
  const [newRecDoc, setNewRecDoc] = useState<string>('');
  const [newRecNote, setNewRecNote] = useState<string>('');

  const handleOperatingBudgetChange = (val: number) => {
    const numVal = Number(val) || 0;
    setOperatingBudget(numVal);
    const newTotal = numVal + (Number(investmentBudget) || 0);
    setDisbursedAmount(newTotal);
    if (approvedBudget > 0 && newTotal >= approvedBudget) {
      setDisbursementStatus('completed');
    }
  };

  const handleInvestmentBudgetChange = (val: number) => {
    const numVal = Number(val) || 0;
    setInvestmentBudget(numVal);
    const newTotal = (Number(operatingBudget) || 0) + numVal;
    setDisbursedAmount(newTotal);
    if (approvedBudget > 0 && newTotal >= approvedBudget) {
      setDisbursementStatus('completed');
    }
  };

  const handleExpenseTypeChange = (newType: ExpenseType) => {
    setExpenseType(newType);
    // Always show operating budget + investment budget for disbursedAmount at all times
    const newTotal = (Number(operatingBudget) || 0) + (Number(investmentBudget) || 0);
    setDisbursedAmount(newTotal);
    if (approvedBudget > 0 && newTotal >= approvedBudget) {
      setDisbursementStatus('completed');
    }
  };

  // Sync state when project changes
  useEffect(() => {
    if (project) {
      const initialApproved = (project.approvedBudget !== null && project.approvedBudget !== undefined && project.approvedBudget > 0)
        ? project.approvedBudget
        : (project.requestedBudget || 0);
      setApprovedBudget(initialApproved);

      const initialType = determineExpenseType(project);
      setExpenseType(initialType);
      const op = project.operatingBudget ?? 0;
      const inv = project.investmentBudget ?? 0;
      setOperatingBudget(op);
      setInvestmentBudget(inv);
      setInvestmentStage(project.investmentStage ?? (project.contractDate ? 'signed' : 'procuring'));

      // Always calculate total disbursed as operating + investment budget
      const totalCombined = (op > 0 || inv > 0) ? (op + inv) : (project.disbursedAmount || 0);
      setDisbursedAmount(totalCombined);
      setPhysicalProgress(project.physicalProgress || 0);
      const isComplete = (initialApproved > 0 && totalCombined >= initialApproved) || project.disbursementStatus === 'completed';
      setDisbursementStatus(isComplete ? 'completed' : (project.disbursementStatus || 'not_started'));
      setContractDate(project.contractDate || '');
      setProjectDeadline(project.projectDeadline || '');
      setTrackingNotes(project.trackingNotes || '');
      setRecords(project.disbursementRecords || []);
      setShowAddRecord(false);
    }
  }, [project]);

  // Recalculate total disbursed from records if records exist
  const handleAddRecord = () => {
    if (newRecAmount <= 0) {
      alert('กรุณาระบุจำนวนเงินที่เบิกจ่ายมากกว่า 0 บาท');
      return;
    }
    if (!newRecPeriod.trim()) {
      alert('กรุณาระบุงวดที่หรือรายการเบิกจ่าย');
      return;
    }

    const currentTotalRecords = records.reduce((acc, curr) => acc + curr.amount, 0);
    const newTotalRecords = currentTotalRecords + newRecAmount;

    // Validate: Total disbursement records must not exceed approved budget
    if (approvedBudget > 0 && newTotalRecords > approvedBudget) {
      alert(
        `ไม่สามารถบันทึกได้ เนื่องจากยอดรวมประวัติรายการเบิกจ่ายงวดงาน (${formatCurrency(newTotalRecords)} บาท) เกินกว่าวงเงินที่ สงป. อนุมัติ (${formatCurrency(approvedBudget)} บาท)\n\nสามารถระบุได้อีกไม่เกิน: ${formatCurrency(Math.max(0, approvedBudget - currentTotalRecords))} บาท`
      );
      return;
    }

    const newRecord: DisbursementRecord = {
      id: `rec-${Date.now()}`,
      disbursedDate: newRecDate.trim() || new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
      amount: newRecAmount,
      periodOrMilestone: newRecPeriod.trim(),
      docReference: newRecDoc.trim() || undefined,
      note: newRecNote.trim() || undefined,
    };

    // Add record without modifying disbursedAmount
    setRecords([...records, newRecord]);

    // Reset new record form
    setNewRecDate('');
    setNewRecAmount(0);
    setNewRecPeriod('');
    setNewRecDoc('');
    setNewRecNote('');
    setShowAddRecord(false);
  };

  const handleDeleteRecord = (recordId: string) => {
    // Remove record without modifying disbursedAmount
    setRecords(records.filter((r) => r.id !== recordId));
  };

  if (!isOpen || !project) return null;

  const remainingBudget = Math.max(0, approvedBudget - disbursedAmount);
  const disbursementRate = approvedBudget > 0 ? Math.min(100, (disbursedAmount / approvedBudget) * 100) : 0;
  const totalRecordsAmount = records.reduce((acc, curr) => acc + curr.amount, 0);
  const recordsQuotaRemaining = Math.max(0, approvedBudget - totalRecordsAmount);
  const recordsPercentage = approvedBudget > 0 ? (totalRecordsAmount / approvedBudget) * 100 : 0;

  const handleSave = () => {
    // Validate that total records do not exceed approved budget
    const totalRecs = records.reduce((acc, curr) => acc + curr.amount, 0);
    if (approvedBudget > 0 && totalRecs > approvedBudget) {
      alert(
        `ยอดรวมประวัติรายการเบิกจ่ายงวดงาน (${formatCurrency(totalRecs)} บาท) เกินกว่าวงเงินที่ สงป. อนุมัติ (${formatCurrency(approvedBudget)} บาท)\n\nกรุณาปรับลดจำนวนเงินในรายการงวดงานก่อนบันทึก`
      );
      return;
    }

    const finalDisbursementStatus: DisbursementStatus =
      (approvedBudget > 0 && disbursedAmount >= approvedBudget)
        ? 'completed'
        : disbursementStatus;

    const updated: ProjectItem = {
      ...project,
      approvedBudget: approvedBudget > 0 ? approvedBudget : (project.approvedBudget || project.requestedBudget),
      approvedStatusText: approvedBudget > 0 ? formatCurrency(approvedBudget) : project.approvedStatusText,
      expenseType,
      operatingBudget: operatingBudget || 0,
      investmentBudget: investmentBudget || 0,
      investmentStage: (expenseType === 'investment' || expenseType === 'both' || investmentBudget > 0) ? investmentStage : null,
      disbursedAmount,
      physicalProgress,
      disbursementStatus: finalDisbursementStatus,
      contractDate: contractDate.trim() || null,
      projectDeadline: projectDeadline.trim() || null,
      trackingNotes: trackingNotes.trim(),
      disbursementRecords: records,
    };

    onSave(updated);
    onClose();
  };

  const deptInfo = departments[project.departmentCode];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                สงป. อนุมัติแล้ว
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: deptInfo?.color || '#6366f1' }}
              >
                {project.departmentCode} - {project.departmentName}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                ประชุมครั้งที่ {project.meetingNo}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
              บันทึกการเบิกจ่ายและติดตามผล: {project.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                งบที่ สงป. อนุมัติ
              </div>
              <div className="text-lg font-bold text-emerald-600">
                {formatCurrency(approvedBudget)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                วงเงินที่ได้รับจัดสรร
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                เบิกจ่ายแล้วสะสม
              </div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(disbursedAmount)}
              </div>
              <div className="text-[11px] font-bold text-blue-700 mt-0.5">
                {disbursementRate.toFixed(2)}% ของงบอนุมัติ
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                งบประมาณคงเหลือ
              </div>
              <div className="text-lg font-bold text-amber-700">
                {formatCurrency(remainingBudget)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                คงเหลือ {Math.max(0, 100 - disbursementRate).toFixed(2)}%
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <PieChart className="w-3.5 h-3.5 text-indigo-600" />
                  อัตราการเบิกจ่ายสะสม
                </span>
              </div>
              <div className="text-lg font-extrabold text-indigo-700">
                {disbursementRate.toFixed(2)}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    disbursementRate >= 100
                      ? 'bg-emerald-500'
                      : disbursementRate >= 50
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, disbursementRate)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Core Tracking Status & Budget Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            
            {/* Status Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>สถานะการเบิกจ่ายงบประมาณ <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={disbursementStatus}
                onChange={(e) => {
                  const newStatus = e.target.value as DisbursementStatus;
                  setDisbursementStatus(newStatus);
                  if (newStatus === 'in_progress' && !expenseType) {
                    setExpenseType('investment');
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  disbursementStatus === 'in_progress'
                    ? 'border-blue-500 bg-blue-50/40 text-blue-900 ring-2 ring-blue-200'
                    : 'border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-400'
                }`}
              >
                <option value="not_started">⚪ ยังไม่เริ่มเบิกจ่าย</option>
                <option value="in_progress">🔵 อยู่ระหว่างการเบิกจ่าย</option>
                <option value="completed">🟢 เบิกจ่ายครบ 100%</option>
                <option value="delayed">🔴 ล่าช้ากว่าแผนการดำเนินงาน</option>
              </select>
            </div>

            {/* Approved Budget Field - Locked / Non-editable */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>วงเงินที่ สงป. อนุมัติ (บาท)</span>
                </label>
              </div>
              <FormattedNumberInput
                value={approvedBudget}
                onChange={() => {}}
                disabled={true}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-extrabold text-emerald-900 bg-slate-100/90 cursor-not-allowed select-none"
              />
            </div>

            {/* Total Disbursed Direct Input - Locked / Calculated */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>ยอดเงินเบิกจ่ายรวมสะสม (บาท)</span>
                </label>
              </div>
              <FormattedNumberInput
                value={disbursedAmount}
                onChange={() => {}}
                disabled={true}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-extrabold text-blue-900 bg-slate-100/90 cursor-not-allowed select-none"
              />
            </div>

          </div>

          {/* SECTION: ประเภทการเบิกจ่ายและวงเงินงบประมาณ (แสดงเมื่อเลือกสถานะ 'อยู่ระหว่างการเบิกจ่าย') */}
          {disbursementStatus === 'in_progress' ? (
            <div className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      ประเภทการเบิกจ่ายและวงเงินงบประมาณ
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      อยู่ระหว่างเบิกจ่าย
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ระบุประเภทงบประมาณ (งบดำเนินงาน / งบลงทุน) และขั้นตอนการดำเนินงานของงบลงทุนเพื่อติดตามผล
                  </p>
                </div>

                {/* Type Selector Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleExpenseTypeChange('operating')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      expenseType === 'operating'
                        ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    1. งบดำเนินงาน
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExpenseTypeChange('investment')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      expenseType === 'investment'
                        ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    2. งบลงทุน
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExpenseTypeChange('both')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      expenseType === 'both'
                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    3. มีทั้ง 2 งบ
                  </button>
                </div>
              </div>

              {/* Inputs based on Expense Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. งบดำเนินงาน Input */}
                {(expenseType === 'operating' || expenseType === 'both') && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    expenseType === 'operating' ? 'bg-emerald-50/40 border-emerald-200 col-span-1 md:col-span-2' : 'bg-emerald-50/30 border-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-emerald-600" />
                        1. วงเงินงบดำเนินงาน (บาท) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOperatingBudgetChange(approvedBudget)}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
                      >
                        ใส่งบเท่าที่อนุมัติ
                      </button>
                    </div>
                    <FormattedNumberInput
                      value={operatingBudget}
                      onChange={(val) => handleOperatingBudgetChange(val)}
                      className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <span className="text-[11px] text-emerald-700/80 mt-1 block">
                      ค่าตอบแทน ใช้สอย วัสดุ สาธารณูปโภค และค่าใช้จ่ายดำเนินงานทั่วไป
                    </span>
                  </div>
                )}

                {/* 2. งบลงทุน Input + Sub-options */}
                {(expenseType === 'investment' || expenseType === 'both') && (
                  <div className={`p-4 rounded-xl border transition-all ${
                    expenseType === 'investment' ? 'bg-blue-50/40 border-blue-200 col-span-1 md:col-span-2' : 'bg-blue-50/30 border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <HardHat className="w-4 h-4 text-blue-600" />
                        2. วงเงินงบลงทุน (บาท) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleInvestmentBudgetChange(approvedBudget)}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline"
                      >
                        ใส่งบเท่าที่อนุมัติ
                      </button>
                    </div>
                    <FormattedNumberInput
                      value={investmentBudget}
                      onChange={(val) => handleInvestmentBudgetChange(val)}
                      className="w-full px-3.5 py-2 rounded-xl border border-blue-300 text-sm font-bold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />

                    {/* Sub-options for Investment Budget */}
                    {investmentBudget > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-blue-200/80">
                        <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            ตัวเลือกย่อยขั้นตอนของงบลงทุน <span className="text-rose-500">*</span>
                          </span>
                          <span className="text-[11px] font-normal text-slate-500">
                            (แก้ไขขั้นตอนได้ในหน้า "ตั้งค่าระบบ")
                          </span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {investmentStages.map((st) => {
                            const isSelected = investmentStage === st.key;
                            let themeClass = isSelected
                              ? 'bg-amber-100/90 border-amber-400 text-amber-900 ring-2 ring-amber-300 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';

                            if (st.colorTheme === 'blue') {
                              themeClass = isSelected
                                ? 'bg-blue-100/90 border-blue-400 text-blue-900 ring-2 ring-blue-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                            } else if (st.colorTheme === 'emerald') {
                              themeClass = isSelected
                                ? 'bg-emerald-100/90 border-emerald-400 text-emerald-900 ring-2 ring-emerald-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                            } else if (st.colorTheme === 'purple') {
                              themeClass = isSelected
                                ? 'bg-purple-100/90 border-purple-400 text-purple-900 ring-2 ring-purple-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                            } else if (st.colorTheme === 'rose') {
                              themeClass = isSelected
                                ? 'bg-rose-100/90 border-rose-400 text-rose-900 ring-2 ring-rose-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                            } else if (st.colorTheme === 'sky') {
                              themeClass = isSelected
                                ? 'bg-sky-100/90 border-sky-400 text-sky-900 ring-2 ring-sky-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                            }

                            return (
                              <button
                                key={st.key}
                                type="button"
                                onClick={() => setInvestmentStage(st.key)}
                                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${themeClass}`}
                              >
                                <div className="flex items-center gap-1.5 w-full mb-0.5">
                                  {st.iconType === 'file' && <FileSpreadsheet className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-700' : 'text-slate-400'}`} />}
                                  {st.iconType === 'signature' && <FileSignature className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />}
                                  {st.iconType === 'hammer' && <Hammer className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-700' : 'text-slate-400'}`} />}
                                  {st.iconType === 'clock' && <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-700' : 'text-slate-400'}`} />}
                                  {st.iconType === 'check' && <Check className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />}
                                  {st.iconType === 'layers' && <Layers className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-700' : 'text-slate-400'}`} />}
                                  {(!st.iconType || st.iconType === 'search') && <Search className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-700' : 'text-slate-400'}`} />}
                                  <span className="text-xs font-bold truncate">{st.label}</span>
                                  {isSelected && (
                                    <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />
                                  )}
                                </div>
                                {st.description && (
                                  <span className="text-[10px] text-slate-500 line-clamp-1">
                                    {st.description}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

              {/* Total Summary Row within the Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-indigo-100 bg-indigo-50/60 -mx-5 -mb-5 px-5 py-3.5 rounded-b-xl">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    ฿
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 block font-medium">
                      รวมวงเงินงบประมาณจัดสรร (งบดำเนินงาน + งบลงทุน)
                    </span>
                    <span className="text-base font-extrabold text-indigo-900">
                      {formatCurrency((operatingBudget || 0) + (investmentBudget || 0))} บาท
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">สัดส่วนจัดสรรเทียบงบอนุมัติ</span>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md border border-indigo-300">
                    {approvedBudget > 0
                      ? `${((((operatingBudget || 0) + (investmentBudget || 0)) / approvedBudget) * 100).toFixed(2)}% ของงบอนุมัติ`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  หากต้องการระบุ <strong>งบดำเนินงาน / งบลงทุน</strong> และขั้นตอนย่อย (หาผู้รับจ้าง / ประกวดราคา / ลงนามสัญญา) ให้เลือกสถานะเป็น <strong>"🔵 อยู่ระหว่างการเบิกจ่าย"</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDisbursementStatus('in_progress');
                  if (!expenseType) {
                    setExpenseType('investment');
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shrink-0 transition-colors"
              >
                เปลี่ยนเป็นอยู่ระหว่างเบิกจ่าย
              </button>
            </div>
          )}

          {/* Disbursement Records / Installments List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    ประวัติรายการเบิกจ่ายงวดงาน ({records.length} รายการ)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    รวมงวดงาน {formatCurrency(totalRecordsAmount)} บ.
                  </span>
                  {recordsQuotaRemaining > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      บันทึกได้อีก {formatCurrency(recordsQuotaRemaining)} บ.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                      บันทึกงวดงานครบวงเงินอนุมัติแล้ว
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  บันทึกประวัติการเบิกเงินแต่ละงวด/ฎีกาเบิกจ่าย (ยอดรวมต้องไม่เกินวงเงินที่ สงป. อนุมัติ {formatCurrency(approvedBudget)} บาท)
                </p>
              </div>
              {!showAddRecord && (
                <button
                  type="button"
                  onClick={() => setShowAddRecord(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มงวดเบิกจ่าย
                </button>
              )}
            </div>

            {/* Add Record Form Inline */}
            {showAddRecord && (
              <div className="mb-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-900">
                      ➕ เพิ่มรายการเบิกจ่ายงวดใหม่
                    </span>
                    <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      วงเงินงวดงานคงเหลือที่บันทึกได้: <strong className="text-emerald-700 font-bold">{formatCurrency(recordsQuotaRemaining)}</strong> บาท
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddRecord(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    ยกเลิก
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      งวดที่ / รายการเบิกจ่าย <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ค่างวดงานที่ 1 (20%)"
                      value={newRecPeriod}
                      onChange={(e) => setNewRecPeriod(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        จำนวนเงิน (บาท) <span className="text-rose-500">*</span>
                      </label>
                      {recordsQuotaRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewRecAmount(recordsQuotaRemaining)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-900 underline font-medium"
                        >
                          ใส่ยอดคงเหลือทั้งหมด
                        </button>
                      )}
                    </div>
                    <FormattedNumberInput
                      value={newRecAmount}
                      onChange={(val) => setNewRecAmount(val)}
                      className={`w-full px-3 py-1.5 text-xs bg-white rounded-lg border font-bold focus:outline-none focus:ring-2 ${
                        newRecAmount > recordsQuotaRemaining && approvedBudget > 0
                          ? 'border-rose-400 text-rose-700 focus:ring-rose-400 bg-rose-50/50'
                          : 'border-slate-300 text-slate-900 focus:ring-indigo-400'
                      }`}
                    />
                    {newRecAmount > recordsQuotaRemaining && approvedBudget > 0 ? (
                      <span className="text-[10px] text-rose-600 font-bold mt-0.5 block">
                        ⚠️ จำนวนเงินเกินวงเงินที่ สงป. อนุมัติคงเหลือ (เกินไป {formatCurrency(newRecAmount - recordsQuotaRemaining)} บาท)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        บันทึกได้ไม่เกิน {formatCurrency(recordsQuotaRemaining)} บาท
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      วันที่เบิกจ่าย
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 15 ก.พ. 2569"
                      value={newRecDate}
                      onChange={(e) => setNewRecDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      เลขที่เอกสาร / ฎีกาเบิกเงิน
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ฎีกา 69/00123"
                      value={newRecDoc}
                      onChange={(e) => setNewRecDoc(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ตรวจรับงานงวดที่ 1 เรียบร้อย"
                      value={newRecNote}
                      onChange={(e) => setNewRecNote(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRecord(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    disabled={newRecAmount > recordsQuotaRemaining && approvedBudget > 0}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                      newRecAmount > recordsQuotaRemaining && approvedBudget > 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    บันทึกงวดงานนี้
                  </button>
                </div>
              </div>
            )}

            {/* Records List Table */}
            {records.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                ยังไม่มีการบันทึกประวัติการเบิกจ่ายงวดงาน คลิกที่ปุ่ม <strong>"เพิ่มงวดเบิกจ่าย"</strong> เพื่อเริ่มบันทึก
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">งวดที่ / รายการ</th>
                      <th className="py-2.5 px-3 text-right">จำนวนเงิน (บาท)</th>
                      <th className="py-2.5 px-3">วันที่เบิกจ่าย</th>
                      <th className="py-2.5 px-3">เลขที่เอกสาร/ฎีกา</th>
                      <th className="py-2.5 px-3">หมายเหตุ</th>
                      <th className="py-2.5 px-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((rec, idx) => (
                      <tr key={rec.id || idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {rec.periodOrMilestone}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                          {formatCurrency(rec.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {rec.disbursedDate || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {rec.docReference ? (
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                              {rec.docReference}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {rec.note || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">รวมยอดเงินตามงวดงานทั้งหมด</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          (เฉพาะประวัติงวดงาน ไม่รวมกับยอดเบิกจ่ายสะสม)
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-extrabold text-sm">
                        {formatCurrency(totalRecordsAmount)}
                      </td>
                      <td colSpan={4} className="py-2.5 px-3 text-slate-500 text-[11px]">
                        ({records.length} รายการ | {recordsPercentage.toFixed(1)}% ของงบอนุมัติ)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Tracking Notes */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              บันทึกผลการติดตาม / สรุปความก้าวหน้าสำหรับผู้บริหาร
            </label>
            <textarea
              rows={3}
              placeholder="ระบุข้อสังเกต ปัญหาอุปสรรค หรือสถานะการดำเนินงานปัจจุบัน..."
              value={trackingNotes}
              onChange={(e) => setTrackingNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <Save className="w-4 h-4" />
            บันทึกข้อมูลการติดตาม
          </button>
        </div>

      </div>
    </div>
  );
};
