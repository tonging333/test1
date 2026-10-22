import { StatusCategory, CustomStatus, CustomInvestmentStage } from '../types';
import { DEFAULT_STATUSES, DEFAULT_INVESTMENT_STAGES } from '../data/projectsData';

export function formatCurrency(amount: number | null | undefined, compact: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '-';
  }

  if (compact) {
    return `${(amount / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้านบาท`;
  }

  return `${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

export function formatMillionBaht(amount: number): string {
  const mb = amount / 1_000_000;
  return `${mb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลบ.`;
}

export function getStatusLabel(category: StatusCategory, customStatuses?: CustomStatus[]): string {
  if (customStatuses && customStatuses.length > 0) {
    const found = customStatuses.find((s) => s.key === category);
    if (found) return found.label;
  }
  const defaultFound = DEFAULT_STATUSES.find((s) => s.key === category);
  if (defaultFound) return defaultFound.label;

  switch (category) {
    case 'approved':
      return 'สงป. อนุมัติแล้ว';
    case 'under_review':
      return 'อยู่ระหว่างพิจารณา (สงป.)';
    case 'signed_pending':
      return 'รมต. ลงนามแล้ว (รอดำเนินการ)';
    case 'returned_review':
      return 'ส่งเรื่องคืนให้ไปทบทวน';
    case 'disapproved':
      return 'ที่ประชุมไม่เห็นชอบ';
    case 'draft_pending':
      return 'อยู่ระหว่างการพิจารณาของรัฐมนตรี';
    default:
      return category || 'ไม่ระบุ';
  }
}

export interface StatusBadgeStyle {
  bg: string;
  text: string;
  border: string;
  iconBg: string;
  dot: string;
}

const THEME_STYLES: Record<string, StatusBadgeStyle> = {
  sky: {
    bg: 'bg-sky-50 hover:bg-sky-100',
    text: 'text-sky-700 font-medium',
    border: 'border-sky-200',
    iconBg: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  amber: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    text: 'text-amber-800 font-medium',
    border: 'border-amber-200',
    iconBg: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  emerald: {
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    text: 'text-emerald-700 font-medium',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    text: 'text-blue-700 font-medium',
    border: 'border-blue-200',
    iconBg: 'bg-blue-500',
    dot: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-50 hover:bg-purple-100',
    text: 'text-purple-700 font-medium',
    border: 'border-purple-200',
    iconBg: 'bg-purple-500',
    dot: 'bg-purple-500',
  },
  rose: {
    bg: 'bg-rose-50 hover:bg-rose-100',
    text: 'text-rose-700 font-medium',
    border: 'border-rose-200',
    iconBg: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
  slate: {
    bg: 'bg-slate-100 hover:bg-slate-200',
    text: 'text-slate-700 font-medium',
    border: 'border-slate-300',
    iconBg: 'bg-slate-500',
    dot: 'bg-slate-500',
  },
  indigo: {
    bg: 'bg-indigo-50 hover:bg-indigo-100',
    text: 'text-indigo-700 font-medium',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-500',
    dot: 'bg-indigo-500',
  },
};

export function getStatusBadgeStyle(category: StatusCategory, customStatuses?: CustomStatus[]): StatusBadgeStyle {
  if (customStatuses && customStatuses.length > 0) {
    const found = customStatuses.find((s) => s.key === category);
    if (found && found.colorTheme && THEME_STYLES[found.colorTheme]) {
      return THEME_STYLES[found.colorTheme];
    }
  }

  const defaultFound = DEFAULT_STATUSES.find((s) => s.key === category);
  if (defaultFound && defaultFound.colorTheme && THEME_STYLES[defaultFound.colorTheme]) {
    return THEME_STYLES[defaultFound.colorTheme];
  }

  switch (category) {
    case 'approved':
      return THEME_STYLES.emerald;
    case 'under_review':
      return THEME_STYLES.amber;
    case 'signed_pending':
      return THEME_STYLES.blue;
    case 'returned_review':
      return THEME_STYLES.rose;
    case 'disapproved':
      return THEME_STYLES.slate;
    case 'draft_pending':
      return THEME_STYLES.sky;
    default:
      return THEME_STYLES.slate;
  }
}

export function getDisbursementStatusLabel(status?: string): string {
  switch (status) {
    case 'completed':
      return 'เบิกจ่ายครบ 100%';
    case 'in_progress':
      return 'อยู่ระหว่างเบิกจ่าย';
    case 'delayed':
      return 'ล่าช้ากว่าแผน';
    case 'not_started':
    default:
      return 'ยังไม่เริ่มเบิกจ่าย';
  }
}

export function getDisbursementStatusBadgeStyle(status?: string): StatusBadgeStyle {
  switch (status) {
    case 'completed':
      return THEME_STYLES.emerald;
    case 'in_progress':
      return THEME_STYLES.blue;
    case 'delayed':
      return THEME_STYLES.rose;
    case 'not_started':
    default:
      return THEME_STYLES.slate;
  }
}

export function calculateDisbursementRate(disbursed: number | undefined | null, approved: number | undefined | null): number {
  const a = Number(approved) || 0;
  const d = Number(disbursed) || 0;
  if (a <= 0 || d <= 0) return 0;
  const rate = (d / a) * 100;
  return Math.min(Math.round(rate * 100) / 100, 100);
}

export function getExpenseTypeLabel(type?: string): string {
  switch (type) {
    case 'operating':
      return 'งบดำเนินงาน';
    case 'investment':
      return 'งบลงทุน';
    case 'both':
      return 'งบดำเนินงาน + งบลงทุน';
    default:
      return 'ยังไม่ระบุประเภท';
  }
}

export function getInvestmentStageLabel(stage?: string | null, customStages?: CustomInvestmentStage[]): string {
  if (!stage) return 'ยังไม่ระบุขั้นตอน';
  if (customStages && customStages.length > 0) {
    const found = customStages.find((s) => s.key === stage);
    if (found) return found.label;
  }
  const defaultFound = DEFAULT_INVESTMENT_STAGES.find((s) => s.key === stage);
  if (defaultFound) return defaultFound.label;

  switch (stage) {
    case 'procuring':
      return 'หาผู้รับจ้าง';
    case 'bidding':
      return 'ประกวดราคา';
    case 'signed':
      return 'ลงนามในสัญญา';
    default:
      return stage;
  }
}

export function getInvestmentStageBadgeStyle(stage?: string | null, customStages?: CustomInvestmentStage[]): StatusBadgeStyle {
  if (!stage) return THEME_STYLES.slate;
  if (customStages && customStages.length > 0) {
    const found = customStages.find((s) => s.key === stage);
    if (found && found.colorTheme && THEME_STYLES[found.colorTheme]) {
      return THEME_STYLES[found.colorTheme];
    }
  }
  const defaultFound = DEFAULT_INVESTMENT_STAGES.find((s) => s.key === stage);
  if (defaultFound && defaultFound.colorTheme && THEME_STYLES[defaultFound.colorTheme]) {
    return THEME_STYLES[defaultFound.colorTheme];
  }
  switch (stage) {
    case 'signed':
      return THEME_STYLES.emerald;
    case 'bidding':
      return THEME_STYLES.blue;
    case 'procuring':
      return THEME_STYLES.amber;
    default:
      return THEME_STYLES.slate;
  }
}

/**
 * Extracts Thai fiscal year (พ.ศ.) with priority given to explicit fiscalYear field.
 * Falls back to meeting number, project title, or default system fiscal year.
 * E.g. explicit '2569' -> '2569', "1/2569" -> "2569", "12/2568" -> "2568", "ไม่ได้จัดประชุม" -> fallbackYear
 */
export function extractFiscalYear(
  meetingNo?: string | null,
  fallbackYear: string = '2569',
  title?: string | null,
  explicitFiscalYear?: string | null
): string {
  // 1. Highest priority: Explicit fiscalYear field
  if (explicitFiscalYear && String(explicitFiscalYear).trim()) {
    const yr = String(explicitFiscalYear).trim();
    if (/^\d{4}$/.test(yr)) return yr;
  }

  // 2. Extract from meeting number (e.g., "1/2569", "12/2568")
  if (meetingNo) {
    const str = String(meetingNo).trim();
    const match = str.match(/\/(\d{4})/);
    if (match && match[1]) {
      return match[1];
    }
    const yearMatch = str.match(/(25\d{2})/);
    if (yearMatch && yearMatch[1]) {
      return yearMatch[1];
    }
  }

  // 3. Extract from title
  if (title) {
    const titleMatch = String(title).match(/(25\d{2})/);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1];
    }
  }

  return fallbackYear;
}

/**
 * Helper to get the definitive fiscal year of a project item
 */
export function getProjectFiscalYear(
  project: { fiscalYear?: string | null; meetingNo?: string | null; title?: string | null },
  fallbackYear: string = '2569'
): string {
  if (project.fiscalYear && String(project.fiscalYear).trim()) {
    return String(project.fiscalYear).trim();
  }
  return extractFiscalYear(project.meetingNo, fallbackYear, project.title);
}

