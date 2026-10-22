import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ProjectItem,
  DepartmentCode,
  ExpenseType,
  DisbursementStatus,
  InvestmentStage,
  StatusCategory,
  SystemSettings,
  CustomStatus,
  CustomInvestmentStage,
  DepartmentInfo,
  DisbursementRecord,
} from '../types';
import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_STATUSES, DEFAULT_INVESTMENT_STAGES, DEPARTMENTS } from '../data/projectsData';
import { extractFiscalYear } from './formatters';

// Initialize Firebase App
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache
let cachedAccessToken: string | null = null;

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetTitle: string;
  lastSyncedAt?: string;
  autoSyncEnabled?: boolean; // Automatic sync mode
  syncDirection?: 'two_way' | 'pull' | 'push';
  scriptAppUrl?: string; // Optional Google Apps Script Web App URL for 100% login-free write access
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// == โค้ด Google Apps Script สำหรับระบบติดตามงบประมาณ (3 Tabs Two-Way Sync) ==
// วิธีติดตั้ง: ใน Google Sheet ไปที่ ส่วนขยาย (Extensions) > Apps Script > วางโค้ดนี้แทนที่ทั้งหมด
// จากนั้นกด "ทำให้ใช้งานได้ (Deploy)" > "การทำให้ใช้งานได้รายการใหม่ (New deployment)"
// เลือกประเภท: เว็บแอป (Web app) | ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone) | กดบันทึกและคัดลอก URL มาใส่ในเว็บ

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Budget Tracker Webhook is Active (3 Tabs Supported)' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var projectHeaders = [
      'รหัสโครงการ (project_id)', 'ครั้งที่ประชุม (meeting_no)', 'สถานะโครงการ/การพิจารณา (status_category)',
      'สำนัก/หน่วยงาน (agency)', 'ชื่อโครงการ (title)',
      'ประเภทงบหลัก (expense_type)', 'วงเงินขอรับจัดสรร (บาท)', 'วงเงินที่ สงป. อนุมัติ (บาท)',
      'เบิกจ่ายงบดำเนินงาน (บาท)', 'เบิกจ่ายงบลงทุน (บาท)', 'ยอดเบิกจ่ายสะสมรวม (บาท)',
      'งบคงเหลือ (บาท)', 'อัตราเบิกจ่าย (%)', 'สถานะการเบิกจ่าย',
      'ขั้นตอนจัดซื้อจัดจ้าง (งบลงทุน)', 'วันที่ลงนามสัญญา', 'กำหนดแล้วเสร็จ',
      'หมายเหตุ/ปัญหาอุปสรรค', 'วันที่รัฐมนตรีลงนาม (minister_signed_date)',
      'วันที่ สงป. อนุมัติ (bb_approved_date)', 'อัปเดตล่าสุด', 'ผู้ปรับปรุงข้อมูล',
      'ปีงบประมาณ (fiscal_year)'
    ];

    var recordHeaders = [
      'รหัสรายการ (record_id)', 'รหัสโครงการ (project_id)', 'วันที่เบิกจ่าย',
      'ประเภทงบประมาณ', 'งวดงาน/รายการเบิกจ่าย', 'จำนวนเงิน (บาท)',
      'เลขที่หนังสือ/ฎีกาเบิกเงิน', 'วันที่บันทึกระบบ'
    ];

    var settingsHeaders = [
      'หมวดหมู่ (Category)', 'รหัสระบุ (Key)', 'ชื่อ/การแสดงผล (Label/Value)',
      'คำอธิบาย (Description)', 'ธีมสี/ค่าเพิ่มเติม (Color/Extra)', 'ไอคอน (Icon)',
      'ข้อมูลสำรองระบบ (JSON_Data)'
    ];

    // 1. ซิงค์ข้อมูลโครงการ (Projects)
    if (payload.action === 'sync_projects' || payload.action === 'sync_all' || payload.action === 'sync_structure') {
      var pSheet = ss.getSheetByName('Projects') || ss.insertSheet('Projects');
      if (pSheet.getLastRow() === 0) {
        pSheet.getRange(1, 1, 1, projectHeaders.length).setValues([projectHeaders]);
        pSheet.getRange(1, 1, 1, projectHeaders.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
        pSheet.setFrozenRows(1);
      } else {
        // อัปเดตหัวตารางให้เป็นปัจจุบันเสมอ
        pSheet.getRange(1, 1, 1, projectHeaders.length).setValues([projectHeaders]);
        pSheet.getRange(1, 1, 1, projectHeaders.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
      }
      if (payload.projectRows) {
        var lastRow = pSheet.getLastRow();
        var lastCol = Math.max(pSheet.getLastColumn(), projectHeaders.length);
        if (lastRow > 1) {
          pSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
        }
        if (payload.projectRows.length > 0) {
          // กำหนดรูปแบบคอลัมน์ B (ครั้งที่ประชุม) เป็น Plain Text ป้องกัน Sheet แปลงเป็นวันที่
          pSheet.getRange(2, 2, payload.projectRows.length, 1).setNumberFormat('@');
          pSheet.getRange(2, 1, payload.projectRows.length, payload.projectRows[0].length).setValues(payload.projectRows);
        }
      }
    }

    // 1.1 ซิงค์ประวัติการเบิกจ่ายงวดงาน (Disbursement_Records)
    if (payload.action === 'sync_projects' || payload.action === 'sync_all' || payload.action === 'sync_disbursements' || payload.action === 'sync_structure') {
      var dSheet = ss.getSheetByName('Disbursement_Records') || ss.insertSheet('Disbursement_Records');
      if (dSheet.getLastRow() === 0) {
        dSheet.getRange(1, 1, 1, recordHeaders.length).setValues([recordHeaders]);
        dSheet.getRange(1, 1, 1, recordHeaders.length).setBackground('#065f46').setFontColor('#ffffff').setFontWeight('bold');
        dSheet.setFrozenRows(1);
      }
      if (payload.disbursementRows) {
        var dLastRow = dSheet.getLastRow();
        var dLastCol = Math.max(dSheet.getLastColumn(), recordHeaders.length);
        if (dLastRow > 1) {
          dSheet.getRange(2, 1, dLastRow - 1, dLastCol).clearContent();
        }
        if (payload.disbursementRows.length > 0) {
          dSheet.getRange(2, 1, payload.disbursementRows.length, payload.disbursementRows[0].length).setValues(payload.disbursementRows);
        }
      }
    }

    // 2. ซิงค์การตั้งค่าระบบ (_Settings)
    if (payload.action === 'sync_settings' || payload.action === 'sync_all' || payload.action === 'sync_structure') {
      var sSheet = ss.getSheetByName('_Settings') || ss.insertSheet('_Settings');
      if (sSheet.getLastRow() === 0) {
        sSheet.getRange(1, 1, 1, settingsHeaders.length).setValues([settingsHeaders]);
        sSheet.getRange(1, 1, 1, settingsHeaders.length).setBackground('#3730a3').setFontColor('#ffffff').setFontWeight('bold');
        sSheet.setFrozenRows(1);
      }
      if (payload.settingsRows) {
        var sLastRow = sSheet.getLastRow();
        var sLastCol = Math.max(sSheet.getLastColumn(), settingsHeaders.length);
        if (sLastRow > 1) {
          sSheet.getRange(2, 1, sLastRow - 1, sLastCol).clearContent();
        }
        if (payload.settingsRows.length > 0) {
          sSheet.getRange(2, 1, payload.settingsRows.length, payload.settingsRows[0].length).setValues(payload.settingsRows);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export interface SyncedSettingsPayload {
  systemSettings: SystemSettings;
  investmentStages: CustomInvestmentStage[];
  statuses: CustomStatus[];
  departments: Record<string, DepartmentInfo>;
}

export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1dPHA4XU38CgfR3WzjxS13A3iIauJzV8d6SN32MSl0Ak/edit?usp=sharing';
export const DEFAULT_SPREADSHEET_ID = '1dPHA4XU38CgfR3WzjxS13A3iIauJzV8d6SN32MSl0Ak';
export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwjoEBUWl6KyWfIU2vX1t2oAGW1poOXa9dHMmKW3nc3vSwcRvJhxHGEZPmj29MM6lOMgA/exec';

export const DEFAULT_SHEET_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: DEFAULT_SPREADSHEET_ID,
  spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
  sheetTitle: 'ระบบติดตามงบประมาณและโครงการ (Budget Tracking 2569)',
  scriptAppUrl: DEFAULT_APPS_SCRIPT_URL,
  autoSyncEnabled: true,
  syncDirection: 'two_way',
};

export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
};

export const getStoredSheetConfig = (): GoogleSheetsConfig | null => {
  let existing: GoogleSheetsConfig | null = null;
  const isExplicitlyDisconnected = typeof window !== 'undefined' 
    ? localStorage.getItem('budget_google_sheet_disconnected') === 'true' 
    : false;

  const data = typeof window !== 'undefined' ? localStorage.getItem('budget_google_sheet_config') : null;
  if (data) {
    try {
      existing = JSON.parse(data);
    } catch {
      existing = null;
    }
  }

  // Check URL query parameters for auto-configuration across shared links
  if (typeof window !== 'undefined' && window.location.search) {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const sheetParam = searchParams.get('sheet') || searchParams.get('sheetId') || searchParams.get('spreadsheetId');
      const scriptParam = searchParams.get('script') || searchParams.get('webhook') || searchParams.get('scriptAppUrl');

      if (sheetParam) {
        const parsedId = extractSpreadsheetId(sheetParam);
        if (parsedId) {
          const newConfig: GoogleSheetsConfig = {
            spreadsheetId: parsedId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${parsedId}/edit`,
            sheetTitle: existing?.sheetTitle || 'Google Sheet ที่เชื่อมต่อ',
            scriptAppUrl: scriptParam || existing?.scriptAppUrl || (parsedId === DEFAULT_SPREADSHEET_ID ? DEFAULT_APPS_SCRIPT_URL : undefined),
            autoSyncEnabled: true,
            syncDirection: 'two_way',
            lastSyncedAt: existing?.lastSyncedAt || new Date().toISOString(),
          };
          localStorage.setItem('budget_google_sheet_config', JSON.stringify(newConfig));
          localStorage.removeItem('budget_google_sheet_disconnected');
          return newConfig;
        }
      }
    } catch (e) {
      console.warn('URL params parsing note:', e);
    }
  }

  if (isExplicitlyDisconnected) {
    return null;
  }

  if (existing) {
    // If existing config matches default or lacks scriptAppUrl, ensure default webhook URL is attached
    if (!existing.scriptAppUrl && (!existing.spreadsheetId || existing.spreadsheetId === DEFAULT_SPREADSHEET_ID)) {
      existing.scriptAppUrl = DEFAULT_APPS_SCRIPT_URL;
    }
    return existing;
  }

  // Default initial configuration with user's Google Sheet and Apps Script Webhook
  return DEFAULT_SHEET_CONFIG;
};

export const generateShareableUrl = (customBaseUrl?: string): string => {
  const config = getStoredSheetConfig();
  const base = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
  if (!config?.spreadsheetId) return base;
  
  const params = new URLSearchParams();
  params.set('sheet', config.spreadsheetId);
  if (config.scriptAppUrl) {
    params.set('script', config.scriptAppUrl);
  }
  return `${base}?${params.toString()}`;
};

export const setStoredSheetConfig = (config: GoogleSheetsConfig | null) => {
  if (config) {
    localStorage.setItem('budget_google_sheet_config', JSON.stringify(config));
    localStorage.removeItem('budget_google_sheet_disconnected');
  } else {
    localStorage.removeItem('budget_google_sheet_config');
    localStorage.setItem('budget_google_sheet_disconnected', 'true');
  }
};

export const getStoredAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  return localStorage.getItem('google_sheets_token');
};

export const setStoredAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('google_sheets_token', token);
  } else {
    localStorage.removeItem('google_sheets_token');
  }
};

/**
 * Listen to Firebase Auth state
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = getStoredAccessToken();
    if (user && token) {
      cachedAccessToken = token;
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * User-friendly translator for Firebase & Google Sheets auth errors
 */
export const formatAuthErrorMessage = (error: any): string => {
  if (!error) return 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
  const code = error.code || '';
  const message = error.message || '';

  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return 'หน้าต่างเข้าสู่ระบบ Google ถูกปิดก่อนทำรายการเสร็จสิ้น (กรุณากดใหม่อีกครั้งเมื่อพร้อม)';
  }
  if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
    return 'เบราว์เซอร์บล็อกหน้าต่าง Pop-up กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/cancelled-popup-request' || message.includes('cancelled-popup-request')) {
    return 'มีการเรียกเปิดหน้าต่างซ้อนกัน กรุณาลองใหม่อีกครั้ง';
  }
  if (code === 'auth/network-request-failed' || message.includes('network-request-failed')) {
    return 'การเชื่อมต่อเครือข่ายขัดข้อง กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
  }
  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    return 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Auth (ท่านสามารถใช้ปุ่มดาวน์โหลดไฟล์ CSV แทนได้ทันที)';
  }
  return message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ Google';
};

/**
 * Sign in with Google using Firebase Auth popup to obtain Workspace token
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่พบ Access Token จากการเข้าสู่ระบบ Google กรุณาลองใหม่อีกครั้ง');
    }
    cachedAccessToken = credential.accessToken;
    setStoredAccessToken(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
      console.warn('Firebase Auth sign in note:', error?.message || error);
    }
    throw error;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken || getStoredAccessToken();
};

export const logoutGoogle = async () => {
  await signOut(auth);
  setStoredAccessToken(null);
};

export const getStatusCategoryLabel = (category?: StatusCategory, customStatuses?: CustomStatus[]): string => {
  if (!category) return 'อยู่ระหว่างการพิจารณาของรัฐมนตรี';
  if (customStatuses) {
    const found = customStatuses.find((s) => s.key === category);
    if (found) return found.label;
  }
  switch (category) {
    case 'approved':
      return 'สงป. อนุมัติแล้ว';
    case 'under_review':
      return 'อยู่ระหว่างพิจารณา (สงป.)';
    case 'draft_pending':
      return 'อยู่ระหว่างการพิจารณาของรัฐมนตรี';
    case 'signed_pending':
      return 'รมต. ลงนามแล้ว (รอดำเนินการ)';
    case 'returned_review':
      return 'ส่งคืนทบทวน / ไม่เห็นชอบ';
    case 'disapproved':
      return 'ที่ประชุมไม่เห็นชอบ';
    default:
      return category;
  }
};

export const parseMeetingNo = (val: any): string => {
  if (val === null || val === undefined) return '1/2569';
  const str = String(val).trim();
  if (!str || str === '-') return '1/2569';

  // 1. Text like "ไม่ได้จัดประชุม", "ไม่จัดประชุม", "ไม่ได้จัด", "ไม่จัด"
  if (str.includes('ไม่ได้จัด') || str.includes('ไม่จัด') || str.includes('ไม่ได')) {
    return 'ไม่ได้จัดประชุม';
  }

  // 2. If already standard round format "1/2568", "1/2569", "2/2569", "3/2569", "4/2569", "12/2568", etc.
  if (/^\d+\/\d{4}$/.test(str)) {
    return str;
  }

  // 3. Handle Google Visualization Date string: "Date(2569,0,1)", "Date(2569, 2, 1)", "Date(2569, 3, 2)", etc.
  const gvizDateMatch = str.match(/Date\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (gvizDateMatch) {
    let year = parseInt(gvizDateMatch[1], 10);
    const month = parseInt(gvizDateMatch[2], 10); // 0-indexed month (0=Jan=1, 1=Feb=2, 2=Mar=3, 3=Apr=4)
    if (year < 2500) year += 543;
    
    // In Google Sheets, entering "3/2569" converts to Month index 2 (March). Round is month + 1
    const round = month + 1;
    return `${round}/${year}`;
  }

  // 4. If Google Sheets / Excel auto-converted "3/2569" to date string like "1/3/2569", "01/03/2569", "1/4/2569", "01/04/2569"
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 2500) year += 543;

    // In standard Thai/date conversion: day=1, month=3 -> round is 3
    const round = (part1 === 1 && part2 >= 1 && part2 <= 12) ? part2 : part1;
    return `${round}/${year}`;
  }

  // 5. If yyyy-mm-dd e.g. "2569-03-01" or "2026-03-01"
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    if (year < 2500) year += 543;
    const month = parseInt(ymdMatch[2], 10);
    const round = month || 1;
    return `${round}/${year}`;
  }

  // 6. If match embedded round/year
  const extracted = str.match(/(\d+\/\d{4})/);
  if (extracted) return extracted[1];

  // 7. If only number like "1", "2", "3", "4"
  if (/^\d+$/.test(str)) {
    return `${str}/2569`;
  }

  return str;
};

export const parseStatusCategoryFromLabel = (rawLabel: any, existingCategory?: StatusCategory): StatusCategory => {
  const clean = String(rawLabel || '').trim();
  if (!clean) return existingCategory || 'draft_pending';
  if (
    clean === 'approved' ||
    clean.includes('อนุมัติแล้ว') ||
    clean.includes('สงป. อนุมัติ') ||
    clean.includes('สงป.อนุมัติ')
  ) {
    return 'approved';
  }
  if (
    clean === 'under_review' ||
    clean.includes('อยู่ระหว่างพิจารณา (สงป.)') ||
    (clean.includes('สงป.') && !clean.includes('อนุมัติ'))
  ) {
    return 'under_review';
  }
  if (
    clean === 'draft_pending' ||
    clean.includes('พิจารณาของรัฐมนตรี') ||
    clean.includes('รอจัดประชุม') ||
    clean.includes('รอดำเนินการ') ||
    clean.includes('คำขอใหม่') ||
    clean.includes('เสนอ รมต.')
  ) {
    return 'draft_pending';
  }
  if (
    clean === 'signed_pending' ||
    clean.includes('ลงนามแล้ว') ||
    clean.includes('รมต. ลงนาม')
  ) {
    return 'signed_pending';
  }
  if (
    clean === 'returned_review' ||
    clean.includes('ส่งคืน') ||
    clean.includes('ทบทวน')
  ) {
    return 'returned_review';
  }
  if (clean === 'disapproved' || clean.includes('ไม่เห็นชอบ')) {
    return 'disapproved';
  }
  return existingCategory || 'draft_pending';
};

/**
 * Escapes user input string to prevent CSV / Formula Injection attacks in Google Sheets & Excel.
 * Any string starting with dangerous formula characters (=, +, -, @, \t, \r) is prefixed with a single quote (').
 */
export const sanitizeForSheetFormula = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  // If string starts with risky formula trigger characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Unescapes a string retrieved from Google Sheets that had a security single quote prefix.
 */
export const unescapeSheetFormula = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.startsWith("'") && /^[=+\-@\t\r]/.test(str.slice(1))) {
    return str.slice(1);
  }
  return str;
};

export const mapProjectToRow = (p: ProjectItem, index: number) => {
  const rowNum = index + 2; // Row 1 is header
  const statusCategoryText = getStatusCategoryLabel(p.statusCategory);

  const expenseTypeLabel =
    p.expenseType === 'operating'
      ? 'งบดำเนินงาน'
      : p.expenseType === 'investment'
      ? 'งบลงทุน'
      : 'ทั้ง 2 ประเภท';

  const approvedAmountForDisb = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
    ? p.approvedBudget
    : (p.requestedBudget || 0);
  const isFullyDisbursed = p.disbursementStatus === 'completed' || (approvedAmountForDisb > 0 && (p.disbursedAmount || 0) >= approvedAmountForDisb);

  const statusLabel =
    isFullyDisbursed
      ? 'เบิกจ่ายครบ 100%'
      : p.disbursementStatus === 'in_progress'
      ? 'อยู่ระหว่างการเบิกจ่าย'
      : p.disbursementStatus === 'delayed'
      ? 'ล่าช้ากว่าแผน'
      : 'ยังไม่เริ่มเบิกจ่าย';

  const stageLabel =
    p.investmentStage === 'procuring'
      ? 'หาผู้รับจ้าง'
      : p.investmentStage === 'bidding'
      ? 'ประกวดราคา'
      : p.investmentStage === 'signed'
      ? 'ลงนามในสัญญา'
      : (p.investmentStage || '-');

  // Format or preserve individual project last updated timestamp
  const lastUpdated = p.updatedAt || p.createdAt || new Date().toLocaleString('th-TH');
  const modifiedBy = sanitizeForSheetFormula(p.lastModifiedBy || 'ระบบติดตามงบประมาณ');

  return [
    p.id,
    sanitizeForSheetFormula(p.meetingNo || '1/2569'),
    statusCategoryText,
    sanitizeForSheetFormula(p.departmentCode || ''),
    sanitizeForSheetFormula(p.title || ''),
    expenseTypeLabel,
    p.requestedBudget || 0,
    p.approvedBudget || 0,
    p.operatingBudget || 0,
    p.investmentBudget || 0,
    `=I${rowNum}+J${rowNum}`, // Formula: disbursed total (I + J)
    `=H${rowNum}-K${rowNum}`, // Formula: remaining (H - K)
    `=IF(H${rowNum}>0, (K${rowNum}/H${rowNum})*100, 0)`, // Formula: rate %
    statusLabel,
    stageLabel,
    sanitizeForSheetFormula(p.contractDate || ''),
    sanitizeForSheetFormula(p.projectDeadline || ''),
    sanitizeForSheetFormula(p.remarks || ''),
    sanitizeForSheetFormula(p.ministerSignedDate || ''),
    sanitizeForSheetFormula(p.bbApprovedDate || ''),
    lastUpdated,
    modifiedBy,
    sanitizeForSheetFormula(p.fiscalYear || extractFiscalYear(p.meetingNo, '2569', p.title)),
  ];
};

export const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const clean = String(val).replace(/,/g, '').replace(/%/g, '').replace(/฿/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const normalizeBudget = parseNum;

/**
 * Convert Google Sheet Row array into ProjectItem object
 */
export const mapRowToProject = (row: any[], existingProject?: ProjectItem | null): ProjectItem => {

  if (!row || row.length === 0) {
    return existingProject || {
      id: Math.floor(Math.random() * 10000),
      meetingNo: '1/2569',
      title: 'โครงการใหม่',
      departmentCode: 'OTHER',
      departmentName: 'อื่นๆ',
      requestedBudget: 0,
      ministerSignedDate: null,
      bbApprovedDate: null,
      approvedBudget: null,
      approvedStatusText: '-',
      remarks: '',
      statusCategory: 'draft_pending',
    };
  }

  // Detect whether row is 22-column (new) format or 20-column (legacy) format
  // In 22-column format: row[1] is meetingNo, row[2] is statusCategory, row[3] is departmentCode, row[4] is title
  // In 20-column legacy format: row[1] is departmentCode, row[2] is title
  const is22Col =
    row.length >= 21 ||
    (row[1] &&
      (String(row[1]).includes('/') ||
        String(row[1]).includes('ประชุม') ||
        String(row[1]).includes('ไม่ได้จัด') ||
        String(row[2]).includes('พิจารณา') ||
        String(row[2]).includes('อนุมัติ') ||
        String(row[2]).includes('ส่งคืน') ||
        String(row[2]).includes('ไม่เห็นชอบ')));

  let id: number;
  let meetingNo: string;
  let statusCategoryRaw: string;
  let departmentCode: DepartmentCode;
  let title: string;
  let expenseTypeRaw: string;
  let requestedBudget: number;
  let approvedBudget: number | null;
  let operatingBudget: number;
  let investmentBudget: number;
  let disbursedAmount: number;
  let statusLabelRaw: string;
  let stageLabelRaw: string;
  let contractDate: string | null;
  let projectDeadline: string | null;
  let remarks: string;
  let ministerSignedDate: string | null;
  let bbApprovedDate: string | null;
  let updatedAt: string | undefined;
  let lastModifiedBy: string;
  let fiscalYear: string | undefined = existingProject?.fiscalYear;

  if (is22Col) {
    id = parseInt(row[0]) || (existingProject ? existingProject.id : Math.floor(Math.random() * 10000));
    meetingNo = parseMeetingNo(row[1] !== undefined && row[1] !== null ? unescapeSheetFormula(row[1]) : existingProject?.meetingNo);
    statusCategoryRaw = String(row[2] || '').trim();
    departmentCode = (row[3] ? unescapeSheetFormula(row[3]).trim() : existingProject?.departmentCode || 'OTHER') as DepartmentCode;
    title = row[4] ? unescapeSheetFormula(row[4]).trim() : existingProject?.title || `โครงการลำดับที่ ${id}`;
    expenseTypeRaw = String(row[5] || '').trim();
    requestedBudget = parseNum(row[6]) > 0 ? parseNum(row[6]) : existingProject?.requestedBudget || 0;
    const parsedApproved = parseNum(row[7]);
    approvedBudget = parsedApproved > 0 ? parsedApproved : (existingProject?.approvedBudget ?? null);
    operatingBudget = row[8] !== undefined && row[8] !== null && String(row[8]).trim() !== '' ? parseNum(row[8]) : (existingProject?.operatingBudget || 0);
    investmentBudget = row[9] !== undefined && row[9] !== null && String(row[9]).trim() !== '' ? parseNum(row[9]) : (existingProject?.investmentBudget || 0);
    disbursedAmount = operatingBudget + investmentBudget;
    statusLabelRaw = String(row[13] || '').trim();
    stageLabelRaw = String(row[14] || '').trim();
    contractDate =
      row[15] !== undefined && row[15] !== null && String(row[15]).trim() !== '' && String(row[15]).trim() !== '-' && String(row[15]).trim() !== 'null'
        ? unescapeSheetFormula(row[15]).trim()
        : null;
    projectDeadline =
      row[16] !== undefined && row[16] !== null && String(row[16]).trim() !== '' && String(row[16]).trim() !== '-' && String(row[16]).trim() !== 'null'
        ? unescapeSheetFormula(row[16]).trim()
        : null;
    remarks = row[17] !== undefined && row[17] !== null ? unescapeSheetFormula(row[17]).trim() : '';
    const rawMinister = row[18] !== undefined && row[18] !== null ? unescapeSheetFormula(row[18]).trim() : '';
    ministerSignedDate = rawMinister && rawMinister !== '-' && rawMinister !== 'null' ? rawMinister : null;
    const rawBB = row[19] !== undefined && row[19] !== null ? unescapeSheetFormula(row[19]).trim() : '';
    bbApprovedDate = rawBB && rawBB !== '-' && rawBB !== 'null' ? rawBB : null;
    updatedAt =
      row[20] !== undefined && row[20] !== null && String(row[20]).trim() !== ''
        ? String(row[20]).trim()
        : existingProject?.updatedAt;
    lastModifiedBy =
      row[21] !== undefined && row[21] !== null && String(row[21]).trim() !== ''
        ? unescapeSheetFormula(row[21]).trim()
        : existingProject?.lastModifiedBy || 'ระบบติดตามงบประมาณ';

    // Parse fiscalYear from 23rd column (index 22) if present
    if (row[22] !== undefined && row[22] !== null && String(row[22]).trim() !== '') {
      const cleanY = String(row[22]).replace(/[^0-9]/g, '').trim();
      if (cleanY.length === 4) {
        fiscalYear = cleanY;
      }
    }
  } else {
    // Legacy 20-column format
    id = parseInt(row[0]) || (existingProject ? existingProject.id : Math.floor(Math.random() * 10000));
    meetingNo = existingProject?.meetingNo || '1/2569';
    statusCategoryRaw = '';
    departmentCode = (row[1] ? unescapeSheetFormula(row[1]).trim() : existingProject?.departmentCode || 'OTHER') as DepartmentCode;
    title = row[2] ? unescapeSheetFormula(row[2]).trim() : existingProject?.title || `โครงการลำดับที่ ${id}`;
    expenseTypeRaw = String(row[3] || '').trim();
    requestedBudget = parseNum(row[4]) > 0 ? parseNum(row[4]) : existingProject?.requestedBudget || 0;
    const parsedApproved = parseNum(row[5]);
    approvedBudget = parsedApproved > 0 ? parsedApproved : (existingProject?.approvedBudget ?? null);
    operatingBudget = row[6] !== undefined && row[6] !== null && String(row[6]).trim() !== '' ? parseNum(row[6]) : (existingProject?.operatingBudget || 0);
    investmentBudget = row[7] !== undefined && row[7] !== null && String(row[7]).trim() !== '' ? parseNum(row[7]) : (existingProject?.investmentBudget || 0);
    disbursedAmount = operatingBudget + investmentBudget;
    statusLabelRaw = String(row[11] || '').trim();
    stageLabelRaw = String(row[12] || '').trim();
    contractDate =
      row[13] !== undefined && row[13] !== null && String(row[13]).trim() !== '' && String(row[13]).trim() !== '-'
        ? unescapeSheetFormula(row[13]).trim()
        : null;
    projectDeadline =
      row[14] !== undefined && row[14] !== null && String(row[14]).trim() !== '' && String(row[14]).trim() !== '-'
        ? unescapeSheetFormula(row[14]).trim()
        : null;
    remarks = row[15] !== undefined && row[15] !== null ? unescapeSheetFormula(row[15]).trim() : '';

    ministerSignedDate = null;
    bbApprovedDate = null;
    if (row.length >= 19) {
      const col16 = row[16] !== undefined && row[16] !== null ? unescapeSheetFormula(row[16]).trim() : '';
      if (col16 && col16 !== '-' && col16 !== 'null') ministerSignedDate = col16;
      const col17 = row[17] !== undefined && row[17] !== null ? unescapeSheetFormula(row[17]).trim() : '';
      if (col17 && col17 !== '-' && col17 !== 'null') bbApprovedDate = col17;
    } else if (row.length === 18) {
      const col17 = String(row[17] || '').trim();
      const col16 = String(row[16] || '').trim();
      if (col17 !== 'ระบบติดตามงบประมาณ' && !col16.includes(':')) {
        if (col16 && col16 !== '-' && col16 !== 'null') ministerSignedDate = col16;
        if (col17 && col17 !== '-' && col17 !== 'null') bbApprovedDate = col17;
      }
    }

    if (row[20] && /^\d{4}$/.test(String(row[20]).trim())) {
      fiscalYear = String(row[20]).trim();
    }

    updatedAt =
      row[18] !== undefined && row[18] !== null && String(row[18]).trim() !== ''
        ? String(row[18]).trim()
        : existingProject?.updatedAt;
    lastModifiedBy =
      row[19] !== undefined && row[19] !== null && String(row[19]).trim() !== ''
        ? unescapeSheetFormula(row[19]).trim()
        : existingProject?.lastModifiedBy || 'ระบบติดตามงบประมาณ';
  }

  let expenseType: ExpenseType = 'both';
  if (expenseTypeRaw.includes('ดำเนินงาน')) expenseType = 'operating';
  else if (expenseTypeRaw.includes('ลงทุน')) expenseType = 'investment';

  let disbursementStatus: DisbursementStatus = existingProject?.disbursementStatus || 'not_started';
  if (statusLabelRaw.includes('ครบ') || statusLabelRaw.includes('100')) disbursementStatus = 'completed';
  else if (statusLabelRaw.includes('อยู่ระหว่าง')) disbursementStatus = 'in_progress';
  else if (statusLabelRaw.includes('ล่าช้า')) disbursementStatus = 'delayed';

  let investmentStage: InvestmentStage | null = existingProject?.investmentStage || null;
  if (stageLabelRaw.includes('หาผู้รับจ้าง')) investmentStage = 'procuring';
  else if (stageLabelRaw.includes('ประกวดราคา')) investmentStage = 'bidding';
  else if (stageLabelRaw.includes('ลงนาม')) investmentStage = 'signed';
  else if (stageLabelRaw && stageLabelRaw !== '-') investmentStage = stageLabelRaw;

  // Determine status category
  let statusCategory: StatusCategory;
  if (statusCategoryRaw) {
    statusCategory = parseStatusCategoryFromLabel(statusCategoryRaw, existingProject?.statusCategory);
  } else {
    statusCategory =
      existingProject?.statusCategory || (approvedBudget && approvedBudget > 0 ? 'approved' : 'under_review');
    if (statusLabelRaw.includes('อนุมัติ') || (approvedBudget && approvedBudget > 0) || bbApprovedDate) {
      statusCategory = 'approved';
    } else if (
      statusLabelRaw.includes('พิจารณาของรัฐมนตรี') ||
      statusLabelRaw.includes('เสนอ รมต.') ||
      statusLabelRaw.includes('รอจัดประชุม')
    ) {
      statusCategory = 'draft_pending';
    } else if (statusLabelRaw.includes('สงป.') || remarks.includes('พิจารณา')) {
      statusCategory = 'under_review';
    } else if (statusLabelRaw.includes('ลงนาม') || remarks.includes('ลงนาม')) {
      statusCategory = 'signed_pending';
    } else if (statusLabelRaw.includes('คืน') || statusLabelRaw.includes('ไม่เห็นชอบ')) {
      statusCategory = 'returned_review';
    }
  }

  const physicalProgress =
    approvedBudget && approvedBudget > 0
      ? Math.min(100, Math.round((disbursedAmount / approvedBudget) * 100))
      : existingProject?.physicalProgress || 0;

  const approvedStatusText =
    statusCategory === 'approved' && approvedBudget && approvedBudget > 0
      ? `${approvedBudget.toLocaleString()} บาท`
      : getStatusCategoryLabel(statusCategory);

  return {
    id,
    fiscalYear: fiscalYear || existingProject?.fiscalYear || extractFiscalYear(meetingNo, '2569', title),
    meetingNo,
    title,
    departmentCode,
    departmentName: existingProject?.departmentName || departmentCode,
    requestedBudget,
    ministerSignedDate,
    bbApprovedDate,
    approvedBudget,
    approvedStatusText,
    remarks,
    statusCategory,
    expenseType,
    operatingBudget,
    investmentBudget,
    investmentStage,
    disbursedAmount,
    physicalProgress,
    disbursementStatus,
    contractDate,
    projectDeadline,
    disbursementRecords: existingProject?.disbursementRecords || [],
    trackingNotes: existingProject?.trackingNotes || '',
    createdAt: existingProject?.createdAt,
    updatedAt: updatedAt || existingProject?.updatedAt,
    lastModifiedBy,
  };
};

/**
 * Compare two project lists to check if there are actual data changes
 */
export const areProjectsDifferent = (listA: ProjectItem[], listB: ProjectItem[]): boolean => {
  if (listA.length !== listB.length) return true;
  for (let i = 0; i < listA.length; i++) {
    const a = listA[i];
    const b = listB[i];
    if (
      a.id !== b.id ||
      a.meetingNo !== b.meetingNo ||
      a.statusCategory !== b.statusCategory ||
      a.title !== b.title ||
      a.departmentCode !== b.departmentCode ||
      a.requestedBudget !== b.requestedBudget ||
      a.approvedBudget !== b.approvedBudget ||
      (a.ministerSignedDate || '') !== (b.ministerSignedDate || '') ||
      (a.bbApprovedDate || '') !== (b.bbApprovedDate || '') ||
      a.operatingBudget !== b.operatingBudget ||
      a.investmentBudget !== b.investmentBudget ||
      a.disbursedAmount !== b.disbursedAmount ||
      a.physicalProgress !== b.physicalProgress ||
      a.disbursementStatus !== b.disbursementStatus ||
      a.investmentStage !== b.investmentStage ||
      a.contractDate !== b.contractDate ||
      a.projectDeadline !== b.projectDeadline ||
      a.remarks !== b.remarks ||
      a.expenseType !== b.expenseType
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Check if settings have real differences
 */
export const areSettingsDifferent = (
  a: SyncedSettingsPayload,
  b: SyncedSettingsPayload
): boolean => {
  return JSON.stringify(a) !== JSON.stringify(b);
};

export const PROJECT_HEADERS = [
  'รหัสโครงการ (project_id)',
  'ครั้งที่ประชุม (meeting_no)',
  'สถานะโครงการ/การพิจารณา (status_category)',
  'สำนัก/หน่วยงาน (agency)',
  'ชื่อโครงการ (title)',
  'ประเภทงบหลัก (expense_type)',
  'วงเงินขอรับจัดสรร (บาท)',
  'วงเงินที่ สงป. อนุมัติ (บาท)',
  'เบิกจ่ายงบดำเนินงาน (บาท)',
  'เบิกจ่ายงบลงทุน (บาท)',
  'ยอดเบิกจ่ายสะสมรวม (บาท)',
  'งบคงเหลือ (บาท)',
  'อัตราเบิกจ่าย (%)',
  'สถานะการเบิกจ่าย',
  'ขั้นตอนจัดซื้อจัดจ้าง (งบลงทุน)',
  'วันที่ลงนามสัญญา',
  'กำหนดแล้วเสร็จ',
  'หมายเหตุ/ปัญหาอุปสรรค',
  'วันที่รัฐมนตรีลงนาม (minister_signed_date)',
  'วันที่ สงป. อนุมัติ (bb_approved_date)',
  'อัปเดตล่าสุด',
  'ผู้ปรับปรุงข้อมูล',
  'ปีงบประมาณ (fiscal_year)',
];

export const RECORD_HEADERS = [
  'รหัสรายการ (record_id)',
  'รหัสโครงการ (project_id)',
  'วันที่เบิกจ่าย',
  'ประเภทงบประมาณ',
  'งวดงาน/รายการเบิกจ่าย',
  'จำนวนเงิน (บาท)',
  'เลขที่หนังสือ/ฎีกาเบิกเงิน',
  'วันที่บันทึกระบบ',
];

export const SETTINGS_HEADERS = [
  'หมวดหมู่ (Category)',
  'รหัสระบุ (Key)',
  'ชื่อ/การแสดงผล (Label/Value)',
  'คำอธิบาย (Description)',
  'ธีมสี/ค่าเพิ่มเติม (Color/Extra)',
  'ไอคอน (Icon)',
  'ข้อมูลสำรองระบบ (JSON_Data)',
];

export const mapSettingsToRows = (payload: SyncedSettingsPayload): any[][] => {
  const rows: any[][] = [];

  // General settings
  rows.push(['general', 'fiscalYear', payload.systemSettings.fiscalYear || '2569', 'ปีงบประมาณ', '', '', '']);
  rows.push(['general', 'appTitle', payload.systemSettings.appTitle || '', 'ชื่อหัวข้อระบบ', '', '', '']);
  rows.push(['general', 'appSubtitle', payload.systemSettings.appSubtitle || '', 'คำอธิบายระบบ', '', '', '']);
  if (payload.systemSettings.logoType) {
    rows.push(['general', 'logoType', payload.systemSettings.logoType, 'ประเภทโลโก้ (icon/image)', '', '', '']);
  }
  if (payload.systemSettings.logoIcon) {
    rows.push(['general', 'logoIcon', payload.systemSettings.logoIcon, 'ไอคอนโลโก้', '', '', '']);
  }
  if (payload.systemSettings.logoColor) {
    rows.push(['general', 'logoColor', payload.systemSettings.logoColor, 'สีโลโก้', '', '', '']);
  }
  if (payload.systemSettings.logoUrl) {
    const safeLogoUrl = payload.systemSettings.logoUrl.length > 45000
      ? payload.systemSettings.logoUrl.slice(0, 45000)
      : payload.systemSettings.logoUrl;
    rows.push(['general', 'logoUrl', safeLogoUrl, 'ลิงก์รูปภาพโลโก้', '', '', '']);
  }
  if (payload.systemSettings.availableFiscalYears && payload.systemSettings.availableFiscalYears.length > 0) {
    rows.push(['general', 'availableFiscalYears', payload.systemSettings.availableFiscalYears.join(','), 'รายการปีงบประมาณที่รองรับ', '', '', '']);
  }

  // Investment stages
  payload.investmentStages.forEach((st) => {
    rows.push(['investment_stage', st.key, st.label, st.description, st.colorTheme, st.iconType || 'search', '']);
  });

  // Statuses
  payload.statuses.forEach((st) => {
    rows.push(['status', st.key, st.label, st.description, st.colorTheme, '', '']);
  });

  // Departments
  Object.values(payload.departments).forEach((d) => {
    rows.push(['department', d.code, d.fullName, '', d.color, '', '']);
  });

  // Raw JSON backup row for accurate 1:1 reproduction
  rows.push(['__raw_config__', 'all_settings', 'JSON_BACKUP', 'Auto-generated settings bundle', '', '', JSON.stringify(payload)]);

  return rows;
};

export const parseSettingsFromRows = (
  rows: any[][],
  fallback: SyncedSettingsPayload
): SyncedSettingsPayload => {
  if (!rows || rows.length === 0) return fallback;

  // 1. Try to read from raw JSON backup row first
  const rawRow = rows.find((r) => r[0] === '__raw_config__' && r[6]);
  if (rawRow && rawRow[6]) {
    try {
      const parsed = JSON.parse(rawRow[6]);
      if (parsed && typeof parsed === 'object') {
        return {
          systemSettings: parsed.systemSettings || fallback.systemSettings,
          investmentStages: parsed.investmentStages || fallback.investmentStages,
          statuses: parsed.statuses || fallback.statuses,
          departments: parsed.departments || fallback.departments,
        };
      }
    } catch (e) {
      console.warn('Parsing raw JSON backup row note:', e);
    }
  }

  // 2. Parse from human-readable rows
  const nextSettings: SystemSettings = { ...fallback.systemSettings };
  const nextStages: CustomInvestmentStage[] = [];
  const nextStatuses: CustomStatus[] = [];
  const nextDepts: Record<string, DepartmentInfo> = {};

  rows.forEach((row) => {
    const category = String(row[0] || '').trim();
    const key = String(row[1] || '').trim();
    const label = String(row[2] || '').trim();
    const desc = String(row[3] || '').trim();
    const extra = String(row[4] || '').trim();
    const icon = String(row[5] || '').trim();

    if (!key && !label) return;

    if (category === 'general') {
      if (key === 'fiscalYear') nextSettings.fiscalYear = label;
      else if (key === 'appTitle') nextSettings.appTitle = label;
      else if (key === 'appSubtitle') nextSettings.appSubtitle = label;
      else if (key === 'logoType') nextSettings.logoType = label === 'image' ? 'image' : 'icon';
      else if (key === 'logoIcon') nextSettings.logoIcon = label as any;
      else if (key === 'logoColor') nextSettings.logoColor = label;
      else if (key === 'logoUrl') nextSettings.logoUrl = label;
      else if (key === 'availableFiscalYears') {
        const parsedYears = label.split(',').map((y) => y.trim()).filter(Boolean);
        if (parsedYears.length > 0) nextSettings.availableFiscalYears = parsedYears;
      }
    } else if (category === 'investment_stage') {
      nextStages.push({
        key: key || label,
        label: label || key,
        description: desc,
        colorTheme: (extra as any) || 'amber',
        iconType: (icon as any) || 'search',
      });
    } else if (category === 'status') {
      nextStatuses.push({
        key: key || label,
        label: label || key,
        description: desc,
        colorTheme: (extra as any) || 'emerald',
      });
    } else if (category === 'department') {
      if (key) {
        nextDepts[key] = {
          code: key,
          fullName: label || key,
          color: extra || '#4f46e5',
        };
      }
    }
  });

  return {
    systemSettings: nextSettings,
    investmentStages: nextStages.length > 0 ? nextStages : fallback.investmentStages,
    statuses: nextStatuses.length > 0 ? nextStatuses : fallback.statuses,
    departments: Object.keys(nextDepts).length > 0 ? nextDepts : fallback.departments,
  };
};

/**
 * Ensure _Settings tab exists in the spreadsheet
 */
export const ensureSettingsSheetExists = async (
  token: string,
  spreadsheetId: string,
  initialSettings?: SyncedSettingsPayload
): Promise<void> => {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!metaRes.ok) return;

    const metaData = await metaRes.json();
    const hasSettingsTab = (metaData.sheets || []).some(
      (s: any) => s.properties?.title === '_Settings'
    );

    if (!hasSettingsTab) {
      // Add _Settings sheet
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: '_Settings',
                  gridProperties: {
                    frozenRowCount: 1,
                    columnCount: 7,
                  },
                },
              },
            },
          ],
        }),
      });

      // Write default settings rows
      const fallbackPayload: SyncedSettingsPayload = initialSettings || {
        systemSettings: DEFAULT_SYSTEM_SETTINGS,
        investmentStages: DEFAULT_INVESTMENT_STAGES,
        statuses: DEFAULT_STATUSES,
        departments: DEPARTMENTS,
      };

      const settingsRows = mapSettingsToRows(fallbackPayload);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Settings!A1:G?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [SETTINGS_HEADERS, ...settingsRows],
          }),
        }
      );
    }
  } catch (err) {
    console.warn('ensureSettingsSheetExists note:', err);
  }
};

/**
 * Ensure Disbursement_Records tab exists in the spreadsheet
 */
export const ensureDisbursementSheetExists = async (
  token: string,
  spreadsheetId: string,
  projects?: ProjectItem[]
): Promise<void> => {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!metaRes.ok) return;

    const metaData = await metaRes.json();
    const hasDisbursementTab = (metaData.sheets || []).some(
      (s: any) => s.properties?.title === 'Disbursement_Records'
    );

    if (!hasDisbursementTab) {
      // Add Disbursement_Records sheet
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Disbursement_Records',
                  gridProperties: {
                    frozenRowCount: 1,
                    columnCount: 8,
                  },
                },
              },
            },
          ],
        }),
      });

      // Write header & existing records
      const recordsRows = projects ? mapProjectsToDisbursementRows(projects) : [];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Disbursement_Records!A1:H?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [RECORD_HEADERS, ...recordsRows],
          }),
        }
      );
    }
  } catch (err) {
    console.warn('ensureDisbursementSheetExists note:', err);
  }
};

/**
 * Fetch rows from Google Sheet using Google Visualization Query (public without OAuth login)
 */
export const fetchPublicSheetRows = async (spreadsheetId: string, sheetName: string): Promise<any[][]> => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    const res = await fetch(url, {
      signal: controller?.signal,
    }).catch((err) => {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ (Status: ${res.status})`);
    }
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
    if (!match || !match[1]) {
      throw new Error('รูปแบบข้อมูล Google Sheet ไม่ถูกต้องหรือไม่สามารถเข้าถึงได้');
    }
    const data = JSON.parse(match[1]);
    if (data.status === 'error') {
      throw new Error(data.errors?.[0]?.detailed_message || data.errors?.[0]?.message || 'ไม่สามารถเข้าถึงชีตนี้ได้ (กรุณาตั้งค่าแชร์ชีตเป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู" หรือเข้าสู่ระบบ Google)');
    }
    const table = data.table;
    if (!table || !table.rows) return [];
    return table.rows.map((r: any) =>
      (r.c || []).map((cell: any) => {
        if (!cell) return '';
        // If cell.f is a custom string or cell.v is Date(...) string, check cell.f first
        if (typeof cell.v === 'string' && cell.v.startsWith('Date(') && cell.f) {
          return cell.f;
        }
        return cell.v !== null && cell.v !== undefined ? cell.v : cell.f || '';
      })
    );
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('การเชื่อมต่อกับ Google Sheet หมดเวลา (Timeout)');
    }
    throw err;
  }
};

/**
 * Fetch settings from connected Google Sheet (_Settings tab)
 * Supports both Authenticated token & Public Google Sheet fallback
 */
export const fetchSettingsFromGoogleSheet = async (
  token: string | null,
  spreadsheetId: string,
  currentSettings: SyncedSettingsPayload
): Promise<SyncedSettingsPayload> => {
  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Settings!A2:G`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const rows: any[][] = data.values || [];
        if (rows.length > 0) {
          return parseSettingsFromRows(rows, currentSettings);
        }
        return currentSettings;
      }
    } catch {
      // Ignore and try public fallback
    }
  }

  // Public fallback
  try {
    const publicRows = await fetchPublicSheetRows(spreadsheetId, '_Settings');
    if (publicRows.length > 0) {
      return parseSettingsFromRows(publicRows, currentSettings);
    }
  } catch {
    // Tab may not exist or sheet is private; silently fallback to current settings
  }

  return currentSettings;
};

/**
 * Fetch disbursement records from Disbursement_Records tab
 */
export const fetchDisbursementsFromGoogleSheet = async (
  token: string | null,
  spreadsheetId: string
): Promise<Map<number, DisbursementRecord[]>> => {
  let rows: any[][] = [];

  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Disbursement_Records!A2:H`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch {
      // Ignore and try public fallback
    }
  }

  if (rows.length === 0) {
    try {
      rows = await fetchPublicSheetRows(spreadsheetId, 'Disbursement_Records');
    } catch {
      // Tab may not exist yet in older sheets
    }
  }

  const map = new Map<number, DisbursementRecord[]>();
  rows.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const recId = String(row[0] || `rec-${idx + 1}`);
    const projId = parseInt(row[1]);
    const disbursedDate = String(row[2] || '');
    const expStr = String(row[3] || '');
    const expenseCategory = expStr.includes('ดำเนินงาน')
      ? 'operating'
      : expStr.includes('ลงทุน')
      ? 'investment'
      : undefined;
    const periodOrMilestone = String(row[4] || '');
    const amount = typeof row[5] === 'number' ? row[5] : parseFloat(String(row[5]).replace(/,/g, '')) || 0;
    const docReference = String(row[6] || '');
    const note = String(row[7] || '');

    if (!isNaN(projId) && projId > 0) {
      if (!map.has(projId)) {
        map.set(projId, []);
      }
      map.get(projId)!.push({
        id: recId,
        disbursedDate,
        amount,
        periodOrMilestone,
        docReference: docReference || undefined,
        note: note || undefined,
        expenseCategory,
      });
    }
  });

  return map;
};

/**
 * Sync system settings to Google Sheet (_Settings tab)
 * Supports both Google OAuth Token & Apps Script Web App (No-login)
 */
export const syncSettingsToGoogleSheet = async (
  token: string | null,
  spreadsheetId: string,
  settingsPayload: SyncedSettingsPayload,
  scriptAppUrl?: string
): Promise<void> => {
  const effectiveScriptUrl = scriptAppUrl || getStoredSheetConfig()?.scriptAppUrl;
  const settingsRows = mapSettingsToRows(settingsPayload);

  // If Apps Script Web App URL is available, send via Webhook (No Google Login Required)
  if (effectiveScriptUrl) {
    try {
      await fetch(effectiveScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'sync_settings',
          settingsRows: [SETTINGS_HEADERS, ...settingsRows],
        }),
      });
      return;
    } catch (scriptErr) {
      console.warn('Apps Script settings sync failed:', scriptErr);
      if (!token) throw scriptErr;
    }
  }

  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบ Google หรือตั้งค่า Google Apps Script Webhook เพื่อบันทึกข้อมูล');
  }

  await ensureSettingsSheetExists(token, spreadsheetId, settingsPayload);

  // Clear existing content below header
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Settings!A2:G:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Write new rows
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Settings!A1:G?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SETTINGS_HEADERS, ...settingsRows],
      }),
    }
  );
};

/**
 * Fetch projects from connected Google Sheet (Projects tab + Disbursement_Records tab)
 * Supports both Authenticated token & Public Google Sheet without login
 */
export const fetchProjectsFromGoogleSheet = async (
  token: string | null,
  spreadsheetId: string,
  currentProjects: ProjectItem[],
  isSilent: boolean = false
): Promise<ProjectItem[]> => {
  let rows: any[][] = [];

  // Try via OAuth token first if provided
  if (token) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Projects!A2:W`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch {
      rows = [];
    }
  }

  // If no rows from token (or no token provided), try public query
  if (rows.length === 0) {
    try {
      rows = await fetchPublicSheetRows(spreadsheetId, 'Projects');
    } catch (pubErr: any) {
      if (isSilent) {
        // Return existing projects gracefully on background sync network errors
        return currentProjects;
      }
      if (!token) {
        throw new Error(
          pubErr?.message ||
            'ไม่สามารถเข้าถึง Google Sheet นี้ได้ (หากเป็นชีตส่วนตัว กรุณาเข้าสู่ระบบ Google หรือตั้งค่าการแชร์เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู")'
        );
      }
      throw pubErr;
    }
  }

  if (rows.length === 0) {
    return currentProjects;
  }

  // Also fetch disbursement records from Disbursement_Records tab
  let disbursementsMap = new Map<number, DisbursementRecord[]>();
  try {
    disbursementsMap = await fetchDisbursementsFromGoogleSheet(token, spreadsheetId);
  } catch {
    // Non-blocking fallback
  }

  const existingMap = new Map<number, ProjectItem>();
  currentProjects.forEach((p) => existingMap.set(p.id, p));

  const parsedProjects: ProjectItem[] = rows.map((row, idx) => {
    const id = parseInt(row[0]) || idx + 1;
    const existing = existingMap.get(id);
    const mapped = mapRowToProject(row, existing);

    // If records found in Disbursement_Records tab, attach them
    if (disbursementsMap.has(id) && (disbursementsMap.get(id) || []).length > 0) {
      mapped.disbursementRecords = disbursementsMap.get(id);
    } else if (existing?.disbursementRecords && existing.disbursementRecords.length > 0) {
      mapped.disbursementRecords = existing.disbursementRecords;
    }

    return mapped;
  });

  return parsedProjects;
};

/**
 * Fetch spreadsheet metadata to verify connection
 * Supports both Authenticated token & Public Sheet
 */
export const fetchSpreadsheetInfo = async (
  token: string | null,
  spreadsheetId: string
): Promise<{ title: string; spreadsheetUrl: string; sheetCount: number; isReadOnly?: boolean }> => {
  if (token) {
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          title: data.properties?.title || 'Google Sheet',
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          sheetCount: data.sheets?.length || 0,
          isReadOnly: false,
        };
      }
    } catch (e) {
      console.warn('fetchSpreadsheetInfo auth warning:', e);
    }
  }

  // Public fallback: verify access by testing public rows
  try {
    await fetchPublicSheetRows(spreadsheetId, 'Projects');
    return {
      title: 'Google Sheet (Public / Shared)',
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetCount: 3,
      isReadOnly: !token,
    };
  } catch (err: any) {
    throw new Error(
      'ไม่พบไฟล์ Google Sheet หรือไม่มีสิทธิ์เข้าถึง (หากเป็นชีตส่วนตัว กรุณาเข้าสู่ระบบ Google หรือตั้งค่าการแชร์ใน Google Drive เป็น "ทุกคนที่มีลิงก์มีสิทธิ์ดู")'
    );
  }
};

/**
 * Create a new structured Google Spreadsheet with 3 tabs (Projects, Disbursement_Records, _Settings)
 */
export const createBudgetSpreadsheet = async (
  token: string,
  projects: ProjectItem[],
  customTitle: string = 'ระบบติดตามงบประมาณและโครงการ (Budget Tracking 2569)',
  settingsPayload?: SyncedSettingsPayload
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const createPayload = {
    properties: {
      title: customTitle,
    },
    sheets: [
      {
        properties: {
          sheetId: 0,
          title: 'Projects',
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 22,
          },
        },
      },
      {
        properties: {
          sheetId: 1,
          title: 'Disbursement_Records',
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 8,
          },
        },
      },
      {
        properties: {
          sheetId: 2,
          title: '_Settings',
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 7,
          },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'ไม่สามารถสร้าง Google Sheet ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง');
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  const projectRows = projects.map((p, index) => mapProjectToRow(p, index));

  const initialSettingsData: SyncedSettingsPayload = settingsPayload || {
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    investmentStages: DEFAULT_INVESTMENT_STAGES,
    statuses: DEFAULT_STATUSES,
    departments: DEPARTMENTS,
  };

  const settingsRows = mapSettingsToRows(initialSettingsData);

  // Write data to all 3 sheets
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'Projects!A1:W',
            values: [PROJECT_HEADERS, ...projectRows],
          },
          {
            range: 'Disbursement_Records!A1:H1',
            values: [RECORD_HEADERS],
          },
          {
            range: '_Settings!A1:G',
            values: [SETTINGS_HEADERS, ...settingsRows],
          },
        ],
      }),
    }
  );

  // Format headers
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Format Projects Header (Row 1) - Navy Blue Header
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 22,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.23, blue: 0.44 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Format Disbursement_Records Header (Row 1) - Emerald Green Header
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 8,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.08, green: 0.45, blue: 0.32 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Format _Settings Header (Row 1) - Indigo Violet Header
          {
            repeatCell: {
              range: {
                sheetId: 2,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.29, green: 0.24, blue: 0.65 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Auto-resize columns on Projects
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 22,
              },
            },
          },
        ],
      }),
    });
  } catch (fmtErr) {
    console.warn('Formatting spreadsheet warning:', fmtErr);
  }

  // Save config with two-way autoSync enabled
  const config: GoogleSheetsConfig = {
    spreadsheetId,
    spreadsheetUrl,
    sheetTitle: customTitle,
    lastSyncedAt: new Date().toISOString(),
    autoSyncEnabled: true,
    syncDirection: 'two_way',
  };
  setStoredSheetConfig(config);

  return { spreadsheetId, spreadsheetUrl };
};

export const mapProjectsToDisbursementRows = (projects: ProjectItem[]): any[][] => {
  const rows: any[][] = [];
  projects.forEach((p) => {
    (p.disbursementRecords || []).forEach((r) => {
      const expTypeLabel =
        r.expenseCategory === 'operating'
          ? 'งบดำเนินงาน'
          : r.expenseCategory === 'investment'
          ? 'งบลงทุน'
          : 'งบดำเนินงาน/งบลงทุน';
      rows.push([
        r.id,
        p.id,
        r.disbursedDate || '',
        expTypeLabel,
        r.periodOrMilestone || '',
        r.amount || 0,
        r.docReference || '',
        r.updatedAt || r.createdAt || p.updatedAt || new Date().toLocaleString('th-TH'),
      ]);
    });
  });
  return rows;
};

/**
 * Sync current projects to existing Google Sheet (Push to Google Sheet)
 * Supports both Google OAuth Token & Apps Script Web App (No-login)
 */
export const syncProjectsToGoogleSheet = async (
  token: string | null,
  spreadsheetId: string,
  projects: ProjectItem[],
  scriptAppUrl?: string
): Promise<void> => {
  if (!projects || projects.length === 0) {
    console.warn('syncProjectsToGoogleSheet: Empty projects list provided. Aborting sync to prevent accidental sheet wipe.');
    return;
  }

  const effectiveScriptUrl = scriptAppUrl || getStoredSheetConfig()?.scriptAppUrl;
  const projectRows = projects.map((p, index) => mapProjectToRow(p, index));
  const disbursementRows = mapProjectsToDisbursementRows(projects);

  // If Apps Script Web App URL is available, send via Webhook (No Google Login Required)
  if (effectiveScriptUrl) {
    try {
      await fetch(effectiveScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'sync_projects',
          projectRows,
          disbursementRows,
        }),
      });

      const existingConfig = getStoredSheetConfig();
      if (existingConfig) {
        existingConfig.lastSyncedAt = new Date().toISOString();
        setStoredSheetConfig(existingConfig);
      }
      return;
    } catch (scriptErr) {
      console.warn('Apps Script projects sync failed:', scriptErr);
      if (!token) throw scriptErr;
    }
  }

  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบ Google หรือตั้งค่า Google Apps Script Webhook เพื่อบันทึกข้อมูล');
  }

  // 1. Ensure Disbursement_Records tab exists
  await ensureDisbursementSheetExists(token, spreadsheetId, projects);

  // 2. Clear existing Projects content below header and write fresh
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Projects!A2:Z:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Projects!A2:W?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: projectRows,
      }),
    }
  );

  // 3. Clear and write Disbursement_Records
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Disbursement_Records!A2:H:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Always ensure header on row 1
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Disbursement_Records!A1:H1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [RECORD_HEADERS],
        }),
      }
    );

    if (disbursementRows.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Disbursement_Records!A2:H?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: disbursementRows,
          }),
        }
      );
    }
  } catch (dErr) {
    console.warn('Disbursement_Records sync warning:', dErr);
  }

  const existingConfig = getStoredSheetConfig();
  if (existingConfig) {
    existingConfig.lastSyncedAt = new Date().toISOString();
    setStoredSheetConfig(existingConfig);
  }
};

/**
 * Master Sync function: Synchronizes Projects, Disbursement_Records, and _Settings tabs all together
 */
export const syncAllToGoogleSheet = async (
  token: string | null,
  spreadsheetId: string,
  projects: ProjectItem[],
  settingsPayload: SyncedSettingsPayload,
  scriptAppUrl?: string
): Promise<void> => {
  const effectiveScriptUrl = scriptAppUrl || getStoredSheetConfig()?.scriptAppUrl;
  const projectRows = projects.map((p, index) => mapProjectToRow(p, index));
  const disbursementRows = mapProjectsToDisbursementRows(projects);
  const settingsRows = mapSettingsToRows(settingsPayload);

  // If Apps Script Web App URL is available, send via Webhook
  if (effectiveScriptUrl) {
    try {
      await fetch(effectiveScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'sync_all',
          projectRows,
          disbursementRows,
          settingsRows: [SETTINGS_HEADERS, ...settingsRows],
        }),
      });

      const existingConfig = getStoredSheetConfig();
      if (existingConfig) {
        existingConfig.lastSyncedAt = new Date().toISOString();
        setStoredSheetConfig(existingConfig);
      }
      return;
    } catch (scriptErr) {
      console.warn('Apps Script sync_all failed:', scriptErr);
      if (!token) throw scriptErr;
    }
  }

  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบ Google หรือตั้งค่า Google Apps Script Webhook เพื่อบันทึกข้อมูล');
  }

  // Ensure and sync Projects + Disbursements
  await syncProjectsToGoogleSheet(token, spreadsheetId, projects, scriptAppUrl);

  // Ensure and sync Settings
  await syncSettingsToGoogleSheet(token, spreadsheetId, settingsPayload, scriptAppUrl);
};

/**
 * Direct CSV download fallback
 */
export const downloadProjectsCsv = (projects: ProjectItem[]) => {
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = projects.map((p) => {
    const expenseTypeLabel =
      p.expenseType === 'operating'
        ? 'งบดำเนินงาน'
        : p.expenseType === 'investment'
        ? 'งบลงทุน'
        : 'ทั้ง 2 ประเภท';

    const approvedAmountForDisb = (p.approvedBudget !== null && p.approvedBudget !== undefined && p.approvedBudget > 0)
      ? p.approvedBudget
      : (p.requestedBudget || 0);
    const isFullyDisbursed = p.disbursementStatus === 'completed' || (approvedAmountForDisb > 0 && (p.disbursedAmount || 0) >= approvedAmountForDisb);

    const statusLabel =
      isFullyDisbursed
        ? 'เบิกจ่ายครบ 100%'
        : p.disbursementStatus === 'in_progress'
        ? 'อยู่ระหว่างการเบิกจ่าย'
        : p.disbursementStatus === 'delayed'
        ? 'ล่าช้ากว่าแผน'
        : 'ยังไม่เริ่มเบิกจ่าย';

    const stageLabel =
      p.investmentStage === 'procuring'
        ? 'หาผู้รับจ้าง'
        : p.investmentStage === 'bidding'
        ? 'ประกวดราคา'
        : p.investmentStage === 'signed'
        ? 'ลงนามในสัญญา'
        : (p.investmentStage || '-');

    const statusCategoryLabel = getStatusCategoryLabel(p.statusCategory);
    const disbursed = (p.operatingBudget || 0) + (p.investmentBudget || 0);
    const approved = p.approvedBudget || 0;
    const remaining = approved - disbursed;
    const rate = approved > 0 ? ((disbursed / approved) * 100).toFixed(2) : '0.00';

    return [
      escapeCsv(p.id),
      escapeCsv(p.meetingNo || '1/2569'),
      escapeCsv(statusCategoryLabel),
      escapeCsv(p.departmentCode || ''),
      escapeCsv(p.title || ''),
      escapeCsv(expenseTypeLabel),
      p.requestedBudget || 0,
      p.approvedBudget || 0,
      p.operatingBudget || 0,
      p.investmentBudget || 0,
      disbursed,
      remaining,
      `${rate}%`,
      escapeCsv(statusLabel),
      escapeCsv(stageLabel),
      escapeCsv(p.contractDate || ''),
      escapeCsv(p.projectDeadline || ''),
      escapeCsv(p.remarks || ''),
      escapeCsv(p.ministerSignedDate || ''),
      escapeCsv(p.bbApprovedDate || ''),
      escapeCsv(p.updatedAt || new Date().toLocaleString('th-TH')),
      escapeCsv(p.lastModifiedBy || 'ระบบติดตามงบประมาณ'),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [PROJECT_HEADERS.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `งบประมาณโครงการ_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
