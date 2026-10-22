import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
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
} from '../utils/googleSheets';

interface GoogleSheetsSettingsTabProps {
  projects: ProjectItem[];
  onProjectsUpdated?: (updatedProjects: ProjectItem[]) => void;
  settingsPayload?: SyncedSettingsPayload;
  onSettingsUpdated?: (updatedSettings: SyncedSettingsPayload) => void;
  onGoogleSheetConnectedChange?: (connected: boolean) => void;
}

export const GoogleSheetsSettingsTab: React.FC<GoogleSheetsSettingsTabProps> = ({
  projects,
  onProjectsUpdated,
  settingsPayload,
  onSettingsUpdated,
  onGoogleSheetConnectedChange,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncAction, setSyncAction] = useState<'create' | 'connect' | 'pull' | 'push' | 'sync_all' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Connection Mode Tabs (Create New vs Connect Existing)
  const [connectTab, setConnectTab] = useState<'connect_existing' | 'create'>('connect_existing');
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
  }, []);

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
      if (onGoogleSheetConnectedChange) {
        onGoogleSheetConnectedChange(true);
      }
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

      let sheetInfo;
      try {
        sheetInfo = await fetchSpreadsheetInfo(token, spreadsheetId);
      } catch (authErr) {
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
      if (onGoogleSheetConnectedChange) {
        onGoogleSheetConnectedChange(true);
      }
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
      if (!token && !sheetConfig.scriptAppUrl) {
        const signinRes = await googleSignIn();
        setCurrentUser(signinRes.user);
        setAccessToken(signinRes.accessToken);
        token = signinRes.accessToken;
      }

      await syncProjectsToGoogleSheet(token, sheetConfig.spreadsheetId, projects, sheetConfig.scriptAppUrl);

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

  // 5. Full Two-Way Sync All
  const handleTwoWaySyncAll = async () => {
    if (!sheetConfig?.spreadsheetId) return;
    setIsLoading(true);
    setSyncAction('sync_all');
    setStatusMessage(null);
    try {
      let token = accessToken || getAccessToken();

      // Pull latest first
      let pulledProjects = projects;
      try {
        pulledProjects = await fetchProjectsFromGoogleSheet(token, sheetConfig.spreadsheetId, projects);
        if (onProjectsUpdated && pulledProjects.length > 0) {
          onProjectsUpdated(pulledProjects);
        }
        if (settingsPayload && onSettingsUpdated) {
          const pulledSettings = await fetchSettingsFromGoogleSheet(token, sheetConfig.spreadsheetId, settingsPayload);
          onSettingsUpdated(pulledSettings);
        }
      } catch (pullErr) {
        console.warn('Pull phase during full sync notice:', pullErr);
      }

      // Then Push back
      await syncProjectsToGoogleSheet(token, sheetConfig.spreadsheetId, pulledProjects, sheetConfig.scriptAppUrl);
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
        text: `ซิงค์ 2 ทาง (Two-Way Live Sync) สำเร็จ! โครงการ ${pulledProjects.length} รายการ และการตั้งค่าระบบตรงกันกับ Google Sheet แล้ว`,
      });
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Two-way sync error note:', err?.message || err);
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

  const handleDisconnect = () => {
    setSheetConfig(null);
    setStoredSheetConfig(null);
    if (onGoogleSheetConnectedChange) {
      onGoogleSheetConnectedChange(false);
    }
    setStatusMessage({
      type: 'success',
      text: 'ยกเลิกการเชื่อมต่อกับ Google Sheet เรียบร้อยแล้ว',
    });
  };

  return (
    <div className="space-y-4">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              การเชื่อมต่อฐานข้อมูล Google Sheets
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Two-Way Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            เชื่อมต่อกับ Google Sheet สำหรับบันทึก ซิงค์ข้อมูลโครงการ และขั้นตอนการตั้งค่าระบบร่วมกันแบบ Real-time
          </p>
        </div>
        {sheetConfig?.spreadsheetUrl && (
          <a
            href={sheetConfig.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shrink-0"
          >
            <span>เปิด Google Sheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Status Feedback Notification */}
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
          <span className="flex-1">{statusMessage.text}</span>
        </div>
      )}

      {/* User Auth Banner */}
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

      {/* When Connected */}
      {sheetConfig?.spreadsheetUrl ? (
        <div className="space-y-4">
          {/* Connected Sheet Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Google Sheet ที่เชื่อมต่อ:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
                  Live Connected
                </span>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                เปลี่ยน / ยกเลิกการเชื่อมต่อ
              </button>
            </div>

            <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {sheetConfig.sheetTitle}
            </p>

            {/* Structure info pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Layers className="w-3 h-3 text-blue-600" /> 1. Projects (โครงการ)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TableProperties className="w-3 h-3 text-emerald-600" /> 2. Disbursement_Records (รายการเบิกจ่าย/งวดงาน)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Sliders className="w-3 h-3 text-purple-600" /> 3. _Settings (การตั้งค่าระบบ)
              </span>
            </div>

            {sheetConfig.lastSyncedAt && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                ซิงค์ล่าสุด: {new Date(sheetConfig.lastSyncedAt).toLocaleString('th-TH')}
              </p>
            )}

            {/* Auto Sync Toggle */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  การเชื่อมต่ออัตโนมัติ (Live Auto-Sync)
                </span>
                <span className="text-[11px] text-slate-500">
                  เมื่อเปิดเว็บหรือบันทึกข้อมูล จะอัปเดตตรงกับ Google Sheet อัตโนมัติ
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
          <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  ลิงก์แชร์สำหรับเปิดใช้งานร่วมกัน (Auto-Sync Link)
                </span>
                <span className="text-[11px] text-indigo-700 block">
                  ส่งลิงก์นี้ให้ทีมงาน เมื่อเปิดเว็บจะเชื่อมต่อ Google Sheet นี้และแสดงข้อมูลตรงกันทันที
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Pull from Google Sheet */}
            <button
              type="button"
              onClick={handlePullFromSheet}
              disabled={isLoading}
              className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-900 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-2xs"
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
              className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-900 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <ArrowUpToLine className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                  <span>ส่งข้อมูลจากเว็บ ➔ Google Sheet</span>
                </div>
                {isLoading && syncAction === 'push' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                อัปเดตตาราง Google Sheet ทั้ง 3 แท็บด้วยข้อมูลล่าสุดบนเว็บ
              </p>
            </button>

            {/* 3. Full Two-Way Sync All */}
            <button
              type="button"
              onClick={handleTwoWaySyncAll}
              disabled={isLoading}
              className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-900 transition-all text-left flex flex-col justify-between group disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <RefreshCw className="w-4 h-4 text-indigo-600 group-hover:rotate-180 transition-transform" />
                  <span>ซิงค์ 2 ทางแบบสมบูรณ์ (Two-Way Sync All)</span>
                </div>
                {isLoading && syncAction === 'sync_all' && (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                ตรวจสอบและประสานข้อมูลทั้งเว็บและ Sheet ให้ตรงกัน 100%
              </p>
            </button>

            {/* 4. Export CSV */}
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Download className="w-4 h-4 text-slate-600 group-hover:translate-y-0.5 transition-transform" />
                  <span>ดาวน์โหลดไฟล์สำรองข้อมูล (CSV)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                ส่งออกรายการโครงการเป็นไฟล์ CSV เพื่อเปิดใน Excel ได้ทันที
              </p>
            </button>
          </div>

          {/* Webhook Apps Script Section */}
          <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-2xs space-y-3">
            <button
              type="button"
              onClick={() => setIsScriptSectionOpen(!isScriptSectionOpen)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Google Apps Script Webhook (ซิงค์ 2 ทางโดยไม่ต้องกดล็อกอิน Google)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    ติดตั้ง Webhook เพื่อให้ทุกเครื่องและทุกคนสามารถบันทึกข้อมูลลง Google Sheet ได้โดยตรง
                  </p>
                </div>
              </div>
              {isScriptSectionOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isScriptSectionOpen && (
              <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Web App URL ของ Google Apps Script (Webhook URL):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={scriptUrlInput}
                      onChange={(e) => setScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveScriptUrl}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      บันทึก URL
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>ขั้นตอนการติดตั้ง (เพียง 1 นาที):</span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ด Apps Script'}</span>
                    </button>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>เปิด Google Sheet ➔ เมนู <strong>ส่วนขยาย (Extensions)</strong> ➔ <strong>Apps Script</strong></li>
                    <li>วางโค้ดที่คัดลอกลงในไฟล์ Code.gs ทั้งหมด แล้วกดบันทึก (Ctrl+S)</li>
                    <li>กดปุ่ม <strong>ทำให้ใช้งานได้ (Deploy)</strong> ➔ <strong>การทำให้ใช้งานได้รายการใหม่ (New deployment)</strong> ➔ เลือกประเภท <strong>เว็บแอป (Web app)</strong></li>
                    <li>ตั้งค่า <strong>ผู้มีสิทธิ์เข้าถึง (Who has access)</strong> เป็น <strong>ทุกคน (Anyone)</strong> ➔ กด Deploy แล้วนำ Web App URL มาวางที่ช่องด้านบน</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* When NOT Connected - Setup Form */
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          {/* Sub Tabs: Connect Existing vs Create New */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setConnectTab('connect_existing')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                connectTab === 'connect_existing'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>1. เชื่อมต่อด้วยลิงก์ Google Sheet ที่มีอยู่</span>
            </button>
            <button
              type="button"
              onClick={() => setConnectTab('create')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                connectTab === 'create'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>2. สร้าง Google Sheet ใหม่บน Drive</span>
            </button>
          </div>

          {connectTab === 'connect_existing' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  วางลิงก์ Google Sheet URL หรือ Spreadsheet ID:
                </label>
                <input
                  type="text"
                  value={existingUrlOrId}
                  onChange={(e) => setExistingUrlOrId(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1wD.../edit"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  * ชีตควรแชร์สิทธิ์ &quot;ทุกคนที่มีลิงก์สามารถดู/แก้ไขได้&quot; เพื่อให้ทุกเครื่องสามารถดึงข้อมูลได้ราบรื่น
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Google Apps Script Webhook URL (ทางเลือก สำหรับซิงค์เขียนกลับโดยไม่ต้องล็อกอิน):
                </label>
                <input
                  type="url"
                  value={scriptUrlInput}
                  onChange={(e) => setScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleConnectExistingSheet}
                disabled={isLoading || !existingUrlOrId.trim()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                {isLoading && syncAction === 'connect' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังเชื่อมต่อและดึงข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4" />
                    <span>เชื่อมต่อกับ Google Sheet นี้</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ชื่อ Google Sheet ที่จะสร้าง:
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="ชื่อแผ่นงาน Google Sheet"
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-[11px] text-emerald-900">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  ระบบจะสร้าง Google Sheet บน Google Drive ของคุณโดยอัตโนมัติ พร้อมโครงสร้าง 3 แท็บ:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-emerald-800">
                  <li><strong>Projects:</strong> บันทึกทุกโครงการพร้อมยอดงบและสถานะ</li>
                  <li><strong>Disbursement_Records:</strong> บันทึกประวัติรายการเบิกจ่ายและงวดงาน</li>
                  <li><strong>_Settings:</strong> บันทึกขั้นตอนงบลงทุน หน่วยงาน และสถานะระบบ</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleLoginAndCreate}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                {isLoading && syncAction === 'create' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังสร้าง Google Sheet บน Google Drive...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>เข้าสู่ระบบ Google และสร้าง Google Sheet ทันที</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Fallback CSV Download */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              หรือต้องการสำรองข้อมูลเป็นไฟล์แบบออฟไลน์?
            </span>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด CSV ({projects.length} โครงการ)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
