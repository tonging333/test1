import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  TableProperties,
  Download,
  LogOut,
  User as UserIcon,
  ArrowDownToLine,
  ArrowUpToLine,
  Radio,
  Clock,
  Link,
  Sliders,
  FolderPlus,
  Layers,
  Sparkles,
  Copy,
  Check,
  Code,
  Zap,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ProjectItem } from '../types';
import {
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  initAuth,
  createBudgetSpreadsheet,
  syncProjectsToGoogleSheet,
  fetchProjectsFromGoogleSheet,
  syncSettingsToGoogleSheet,
  fetchSettingsFromGoogleSheet,
  fetchSpreadsheetInfo,
  extractSpreadsheetId,
  downloadProjectsCsv,
  getStoredSheetConfig,
  setStoredSheetConfig,
  generateShareableUrl,
  formatAuthErrorMessage,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  GoogleSheetsConfig,
  SyncedSettingsPayload,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_APPS_SCRIPT_URL,
  DEFAULT_SHEET_CONFIG,
} from '../utils/googleSheets';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  onProjectsUpdated?: (updatedProjects: ProjectItem[]) => void;
  settingsPayload?: SyncedSettingsPayload;
  onSettingsUpdated?: (updatedSettings: SyncedSettingsPayload) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  projects,
  onProjectsUpdated,
  settingsPayload,
  onSettingsUpdated,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncAction, setSyncAction] = useState<'create' | 'connect' | 'pull' | 'push' | 'sync_all' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Connection Mode Tabs (Create New vs Connect Existing)
  const [connectTab, setConnectTab] = useState<'create' | 'connect_existing'>('create');
  const [sheetName, setSheetName] = useState('ระบบติดตามงบประมาณและโครงการ (Budget Tracking 2569)');
  const [existingUrlOrId, setExistingUrlOrId] = useState('');
  const [autoSync, setAutoSync] = useState(true);

  // No-Login Apps Script Webhook State
  const [scriptUrlInput, setScriptUrlInput] = useState('');
  const [isScriptSectionOpen, setIsScriptSectionOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const handleCopyShareLink = () => {
    const shareUrl = generateShareableUrl();
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredSheetConfig();
      setSheetConfig(stored);
      if (stored && stored.autoSyncEnabled !== undefined) {
        setAutoSync(stored.autoSyncEnabled);
      }
      if (stored?.scriptAppUrl) {
        setScriptUrlInput(stored.scriptAppUrl);
      }
      setStatusMessage(null);
      
      const unsubscribe = initAuth(
        (user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        },
        () => {
          setCurrentUser(null);
          setAccessToken(null);
        }
      );
      return () => unsubscribe();
    }
  }, [isOpen]);

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleSaveScriptUrl = () => {
    if (!sheetConfig) return;
    const cleanUrl = scriptUrlInput.trim();
    const updated = {
      ...sheetConfig,
      scriptAppUrl: cleanUrl || undefined,
    };
    setSheetConfig(updated);
    setStoredSheetConfig(updated);
    setStatusMessage({
      type: 'success',
      text: cleanUrl
        ? 'บันทึก Google Apps Script Webhook สำเร็จ! ตอนนี้ทุกเครื่องสามารถบันทึกและแก้ไขข้อมูลกลับไปที่ Google Sheet ได้โดยไม่ต้องเข้าสู่ระบบ Google'
        : 'ยกเลิกการใช้ Google Apps Script Webhook เรียบร้อย',
    });
  };

  if (!isOpen) return null;

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    if (sheetConfig) {
      const updated = { ...sheetConfig, autoSyncEnabled: enabled };
      setSheetConfig(updated);
      setStoredSheetConfig(updated);
    }
  };

  // 1. Create New Google Spreadsheet on Drive
  const handleLoginAndCreate = async () => {
    setIsLoading(true);
    setSyncAction('create');
    setStatusMessage(null);
    try {
      let token = accessToken || getAccessToken();
      if (!token) {
        const signinRes = await googleSignIn();
        setCurrentUser(signinRes.user);
        setAccessToken(signinRes.accessToken);
        token = signinRes.accessToken;
      }

      const res = await createBudgetSpreadsheet(token, projects, sheetName, settingsPayload);
      const newConfig: GoogleSheetsConfig = {
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        sheetTitle: sheetName,
        lastSyncedAt: new Date().toISOString(),
        autoSyncEnabled: autoSync,
        syncDirection: 'two_way',
      };
      setSheetConfig(newConfig);
      setStoredSheetConfig(newConfig);
      setStatusMessage({
        type: 'success',
        text: 'สร้าง Google Sheet พร้อมบันทึกโครงการและการตั้งค่าระบบ (3 Tabs) สำเร็จแล้ว!',
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Google sheet create note:', err?.message || err);
      }
      setStatusMessage({
        type: 'error',
        text: formatAuthErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
      setSyncAction(null);
    }
  };

  // 2. Connect Existing Google Spreadsheet by URL / ID
  const handleConnectExistingSheet = async () => {
    if (!existingUrlOrId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'กรุณากรอก URL ของ Google Sheet หรือ Spreadsheet ID ที่ต้องการเชื่อมต่อ',
      });
      return;
    }

    const spreadsheetId = extractSpreadsheetId(existingUrlOrId);
    if (!spreadsheetId) {
      setStatusMessage({
        type: 'error',
        text: 'ไม่สามารถระบุ Spreadsheet ID จากลิงก์ที่ระบุได้ กรุณาตรวจสอบลิงก์อีกครั้ง',
      });
      return;
    }

    setIsLoading(true);
    setSyncAction('connect');
    setStatusMessage(null);

    try {
      let token = accessToken || getAccessToken();

      // First attempt to verify spreadsheet info (supports both token & public)
      let sheetInfo;
      try {
        sheetInfo = await fetchSpreadsheetInfo(token, spreadsheetId);
      } catch (authErr) {
        // If failed without token, try Google Login
        if (!token) {
          const signinRes = await googleSignIn();
          setCurrentUser(signinRes.user);
          setAccessToken(signinRes.accessToken);
          token = signinRes.accessToken;
          sheetInfo = await fetchSpreadsheetInfo(token, spreadsheetId);
        } else {
          throw authErr;
        }
      }

      // Pull projects & settings from this sheet
      const pulledProjects = await fetchProjectsFromGoogleSheet(token, spreadsheetId, projects);
      if (onProjectsUpdated && pulledProjects.length > 0) {
        onProjectsUpdated(pulledProjects);
      }

      if (settingsPayload && onSettingsUpdated) {
        const pulledSettings = await fetchSettingsFromGoogleSheet(token, spreadsheetId, settingsPayload);
        onSettingsUpdated(pulledSettings);
      }

      const newConfig: GoogleSheetsConfig = {
        spreadsheetId,
        spreadsheetUrl: sheetInfo.spreadsheetUrl,
        sheetTitle: sheetInfo.title,
        lastSyncedAt: new Date().toISOString(),
        autoSyncEnabled: autoSync,
        syncDirection: 'two_way',
        scriptAppUrl: scriptUrlInput.trim() || undefined,
      };

      setSheetConfig(newConfig);
      setStoredSheetConfig(newConfig);
      setStatusMessage({
        type: 'success',
        text: `เชื่อมต่อกับ Google Sheet "${sheetInfo.title}" สำเร็จ! ซิงค์โครงการ (${pulledProjects.length} รายการ) และการตั้งค่าระบบเรียบร้อย${!token ? ' (โหมดเข้าถึงแบบสาธารณะ)' : ''}`,
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Connect existing sheet note:', err?.message || err);
      }
      setStatusMessage({
        type: 'error',
        text: formatAuthErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
      setSyncAction(null);
    }
  };

  // 3. Pull from Google Sheet -> Web (Both Projects & Settings)
  const handlePullFromSheet = async () => {
    if (!sheetConfig?.spreadsheetId) return;
    setIsLoading(true);
    setSyncAction('pull');
    setStatusMessage(null);
    try {
      let token = accessToken || getAccessToken();
      let pulledProjects: ProjectItem[] = [];

      try {
        pulledProjects = await fetchProjectsFromGoogleSheet(token, sheetConfig.spreadsheetId, projects);
      } catch (authErr) {
        if (!token) {
          const signinRes = await googleSignIn();
          setCurrentUser(signinRes.user);
          setAccessToken(signinRes.accessToken);
          token = signinRes.accessToken;
          pulledProjects = await fetchProjectsFromGoogleSheet(token, sheetConfig.spreadsheetId, projects);
        } else {
          throw authErr;
        }
      }

      if (onProjectsUpdated && pulledProjects.length > 0) {
        onProjectsUpdated(pulledProjects);
      }

      // Pull settings
      if (settingsPayload && onSettingsUpdated) {
        const pulledSettings = await fetchSettingsFromGoogleSheet(token, sheetConfig.spreadsheetId, settingsPayload);
        onSettingsUpdated(pulledSettings);
      }

      const updated = {
        ...sheetConfig,
        lastSyncedAt: new Date().toISOString(),
      };
      setSheetConfig(updated);
      setStoredSheetConfig(updated);
      setStatusMessage({
        type: 'success',
        text: `ดึงข้อมูลล่าสุด (${pulledProjects.length} โครงการ พร้อมการตั้งค่าระบบ) จาก Google Sheet มายังเว็บเรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Pull sheet note:', err?.message || err);
      }
      setStatusMessage({
        type: 'error',
        text: formatAuthErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
      setSyncAction(null);
    }
  };

  // 4. Push Web -> Google Sheet (Both Projects & Settings)
  const handlePushToSheet = async () => {
    if (!sheetConfig?.spreadsheetId) return;
    setIsLoading(true);
    setSyncAction('push');
    setStatusMessage(null);
    try {
      let token = accessToken || getAccessToken();
      // Only require Google sign-in if no Apps Script webhook URL is set
      if (!token && !sheetConfig.scriptAppUrl) {
        const signinRes = await googleSignIn();
        setCurrentUser(signinRes.user);
        setAccessToken(signinRes.accessToken);
        token = signinRes.accessToken;
      }

      // Push Projects (supports OAuth token or Apps Script Webhook)
      await syncProjectsToGoogleSheet(token, sheetConfig.spreadsheetId, projects, sheetConfig.scriptAppUrl);

      // Push Settings
      if (settingsPayload) {
        await syncSettingsToGoogleSheet(token, sheetConfig.spreadsheetId, settingsPayload, sheetConfig.scriptAppUrl);
      }

      const updated = {
        ...sheetConfig,
        lastSyncedAt: new Date().toISOString(),
      };
      setSheetConfig(updated);
      setStoredSheetConfig(updated);
      setStatusMessage({
        type: 'success',
        text: `ส่งออกข้อมูลโครงการ (${projects.length} รายการ) และการตั้งค่าระบบไปยัง Google Sheet เรียบร้อยแล้ว${sheetConfig.scriptAppUrl && !token ? ' (ผ่าน Apps Script Webhook ไม่ต้องล็อกอิน)' : ''}`,
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Push sheet note:', err?.message || err);
      }
      setStatusMessage({
        type: 'error',
        text: formatAuthErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
      setSyncAction(null);
    }
  };

  const handleDownloadCsv = () => {
    downloadProjectsCsv(projects);
    setStatusMessage({
      type: 'success',
      text: 'ดาวน์โหลดไฟล์ตารางข้อมูล (CSV UTF-8) สำเร็จ! สามารถเปิดใน Google Sheets หรือ Excel ได้ทันที',
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-inner shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">ฐานข้อมูล Google Sheets</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                  Two-Way Live Database
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                ซิงค์โครงการ + การตั้งค่าระบบ (ขั้นตอนงบลงทุน / หน่วยงาน / สถานะ) อัตโนมัติทุกเครื่อง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          
          {/* Status feedback */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* User auth state banner */}
          {currentUser && (
            <div className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-xs">
              <div className="flex items-center gap-2 text-emerald-900">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                <span>เข้าสู่ระบบด้วย: <strong>{currentUser.email || currentUser.displayName}</strong></span>
              </div>
              <button
                type="button"
                onClick={logoutGoogle}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}

          {/* If already has a connected spreadsheet */}
          {sheetConfig?.spreadsheetUrl ? (
            <div className="space-y-4">
              
              {/* Connected Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Google Sheet ที่เชื่อมต่อ:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
                      Live Connected
                    </span>
                  </div>
                  <a
                    href={sheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <span>เปิด Google Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <p className="text-sm font-bold text-slate-900 truncate">
                  {sheetConfig.sheetTitle}
                </p>

                {/* Structure info pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Layers className="w-3 h-3 text-blue-600" /> 1. แท็บ Projects (รายการโครงการ)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <TableProperties className="w-3 h-3 text-emerald-600" /> 2. แท็บ Disbursement_Records (ประวัติรายการและงวดงาน)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    <Sliders className="w-3 h-3 text-purple-600" /> 3. แท็บ _Settings (การตั้งค่า/ขั้นตอนงบลงทุน)
                  </span>
                </div>

                {sheetConfig.lastSyncedAt && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    ซิงค์ล่าสุด: {new Date(sheetConfig.lastSyncedAt).toLocaleString('th-TH')}
                  </p>
                )}

                {/* Auto Sync Toggle */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      การเชื่อมต่ออัตโนมัติ (Live Auto-Sync)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      เมื่อเปิดเว็บ หรือแก้ไขข้อมูล จะอัปเดตตรงกับ Google Sheet อัตโนมัติ
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => handleToggleAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">
                      ลิงก์แชร์สำหรับเปิดใช้งานร่วมกัน (Auto-Sync Link)
                    </span>
                    <span className="text-[11px] text-indigo-700 block">
                      ส่งลิงก์นี้ให้เพื่อน เมื่อเพื่อนเปิดเว็บจะเชื่อมต่อ Google Sheet นี้และอัปเดตข้อมูลอัตโนมัติทันที
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>คัดลอกลิงก์แล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกลิงก์แชร์พร้อมชีต</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons for Two-Way Sync */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                {/* 1. Pull from Google Sheet */}
                <button
                  type="button"
                  onClick={handlePullFromSheet}
                  disabled={isLoading}
                  className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-900 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ArrowDownToLine className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span>ดึงข้อมูลจาก Google Sheet ➔ เว็บ</span>
                    </div>
                    {isLoading && syncAction === 'pull' && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-normal">
                    ดึงโครงการและการตั้งค่าระบบล่าสุดที่แก้ไขใน Sheet มายังเว็บ
                  </p>
                </button>

                {/* 2. Push to Google Sheet */}
                <button
                  type="button"
                  onClick={handlePushToSheet}
                  disabled={isLoading}
                  className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-100/60 text-indigo-950 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                      <ArrowUpToLine className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                      <span>ส่งข้อมูล เว็บ ➔ Google Sheet (กู้คืนข้อมูลขึ้นชีต)</span>
                    </div>
                    {isLoading && syncAction === 'push' && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-normal">
                    ส่งโครงการทั้งหมดในระบบและการตั้งค่าขึ้นบันทึกทับใน Google Sheet ทันที
                  </p>
                </button>

              </div>

              {/* No-Login Write via Apps Script Webhook Accordion */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setIsScriptSectionOpen(!isScriptSectionOpen)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 block">
                        ตัวเลือก: บันทึกข้อมูลได้โดยไม่ต้องล็อกอิน Google (Apps Script Webhook)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {sheetConfig.scriptAppUrl ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> เปิดใช้งาน Webhook แล้ว (บันทึกได้ทุกเครื่องโดยไม่ต้อง Login)
                          </span>
                        ) : (
                          'ติดตั้งสคริปต์สั้นๆ ครั้งเดียว เพื่อให้ทุกเครื่องแก้ไขและบันทึกลงชีตได้ 100%'
                        )}
                      </span>
                    </div>
                  </div>
                  {isScriptSectionOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isScriptSectionOpen && (
                  <div className="p-4 pt-1 border-t border-amber-200/70 bg-white space-y-3.5">
                    <div className="space-y-2 text-slate-600 text-xs">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-indigo-600" />
                        วิธีติดตั้งใน Google Sheet (ทำเพียง 1 นาที):
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] text-slate-700 leading-relaxed">
                        <li>
                          เปิด Google Sheet นี้ ไปที่เมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong>
                        </li>
                        <li>
                          ลบโค้ดเดิมทั้งหมด แล้วกดปุ่มคัดลอกโค้ดด้านล่างนี้ไปวางแทนที่:
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={handleCopyScript}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                copiedScript
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {copiedScript ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>คัดลอกโค้ดแล้ว! นำไปวางใน Apps Script ได้เลย</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>📋 คัดลอกโค้ด Apps Script ทั้งหมด</span>
                                </>
                              )}
                            </button>
                          </div>
                        </li>
                        <li>
                          กดปุ่มสีน้ำเงิน <strong>ทำให้ใช้งานได้ (Deploy) &gt; การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong>
                        </li>
                        <li>
                          เลือกประเภท <strong>เว็บแอป (Web app)</strong> และตั้งค่าช่อง <strong>ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)</strong> แล้วกด ทำให้ใช้งานได้
                        </li>
                        <li>
                          คัดลอก <strong>URL เว็บแอป</strong> ที่ได้ (ขึ้นต้นด้วย https://script.google.com/...) มาวางในช่องด้านล่าง:
                        </li>
                      </ol>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-slate-700">
                        วาง URL เว็บแอป (Apps Script Webhook URL):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={scriptUrlInput}
                          onChange={(e) => setScriptUrlInput(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={handleSaveScriptUrl}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                        >
                          บันทึก URL
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* Connection Options: Create New OR Connect Existing */
            <div className="space-y-4">
              
              {/* Tab selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setConnectTab('create')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    connectTab === 'create'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สร้างไฟล์ใหม่ใน Google Drive</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab('connect_existing')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    connectTab === 'connect_existing'
                      ? 'bg-white text-indigo-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Link className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เชื่อมต่อไฟล์เดิมด้วย URL / ID</span>
                </button>
              </div>

              {connectTab === 'create' ? (
                /* Tab 1: Create New Sheet */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      ชื่อไฟล์ Google Sheet ที่ต้องการสร้าง:
                    </label>
                    <input
                      type="text"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="ระบบติดตามงบประมาณและโครงการ..."
                    />
                  </div>

                  <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 text-xs text-slate-700 space-y-2">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <TableProperties className="w-4 h-4 text-emerald-700" />
                      ระบบจะสร้างชีตที่มี 3 แท็บสำคัญพร้อมใช้งาน:
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                      <li>
                        <strong>แท็บ Projects</strong>: รายการโครงการ, ประเภทงบ, วงเงินจัดสรร, ยอดเบิกจ่าย, สถานะ
                      </li>
                      <li>
                        <strong>แท็บ _Settings</strong>: การตั้งค่าระบบ, ขั้นตอนงบลงทุน (Custom Stages), หน่วยงาน, และสถานะ
                      </li>
                      <li>
                        <strong>แท็บ Disbursement_Records</strong>: บันทึกประวัติการเบิกจ่ายตามงวด
                      </li>
                    </ul>
                  </div>

                  {/* Main Button: Sign In & Create on Google Drive */}
                  <button
                    type="button"
                    onClick={handleLoginAndCreate}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading && syncAction === 'create' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังเชื่อมต่อและสร้าง Live Google Sheet...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 shrink-0 text-emerald-200" />
                        <span>เชื่อมต่อ Google และสร้าง Google Sheet อัตโนมัติ</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Tab 2: Connect Existing Sheet */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      1. วาง URL ของ Google Sheet หรือ Spreadsheet ID:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setExistingUrlOrId(DEFAULT_SPREADSHEET_URL);
                        setScriptUrlInput(DEFAULT_APPS_SCRIPT_URL);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      ⚡ กรอกค่าเริ่มต้นของระบบ
                    </button>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={existingUrlOrId}
                      onChange={(e) => setExistingUrlOrId(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                      placeholder={DEFAULT_SPREADSHEET_URL}
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      💡 เหมาะสำหรับเปิดในคอมเครื่องอื่น เพื่อดึงข้อมูลและการตั้งค่าชุดเดียวกันมาแสดงผล
                    </span>
                  </div>

                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      2. (ไม่บังคับ) วาง Apps Script Webhook URL เพื่อบันทึกข้อมูลได้โดยไม่ต้อง Login:
                    </label>
                    <input
                      type="text"
                      value={scriptUrlInput}
                      onChange={(e) => setScriptUrlInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-xs"
                      placeholder={DEFAULT_APPS_SCRIPT_URL}
                    />
                    <span className="text-[11px] text-amber-700 mt-1 block">
                      ⚡ หากกรอกช่องนี้ เครื่องนี้จะสามารถกดบันทึก/แก้ไขข้อมูลกลับเข้าชีตได้ทันทีโดยไม่ต้องเข้าสู่ระบบ Google
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectExistingSheet}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading && syncAction === 'connect' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>กำลังตรวจสอบและดึงข้อมูลจาก Google Sheet...</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 shrink-0 text-indigo-200" />
                        <span>เชื่อมต่อ Google Sheet นี้และซิงค์ข้อมูลทันที</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Direct CSV / Excel Download Option */}
              <div className="pt-2">
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-2 text-[11px] text-slate-400 font-medium">หรือดาวน์โหลดไฟล์ทันที</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStoredSheetConfig(DEFAULT_SHEET_CONFIG);
                      setSheetConfig(DEFAULT_SHEET_CONFIG);
                      setStatusMessage({
                        type: 'success',
                        text: 'เชื่อมต่อกับ Google Sheet และ Webhook เริ่มต้นของระบบเรียบร้อยแล้ว',
                      });
                    }}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>คืนค่าเชื่อมต่อเริ่มต้น</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>ดาวน์โหลด .CSV UTF-8</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Option to disconnect or change sheet */}
          {sheetConfig?.spreadsheetUrl && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>ต้องการเปลี่ยนหรือเชื่อมต่อไฟล์ใหม่?</span>
              <button
                type="button"
                onClick={() => {
                  setSheetConfig(null);
                  setStoredSheetConfig(null);
                }}
                className="font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
              >
                ยกเลิกการเชื่อมต่อไฟล์นี้
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
