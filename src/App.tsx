import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { Header } from './components/Header';
import { KpiSummaryCards } from './components/KpiSummaryCards';
import { BudgetCharts } from './components/BudgetCharts';
import { FiltersBar } from './components/FiltersBar';
import { ProjectList } from './components/ProjectList';
import { ProjectTrackingView } from './components/ProjectTrackingView';
import { PROJECTS_DATA, DEPARTMENTS, DEFAULT_STATUSES, DEFAULT_INVESTMENT_STAGES, DEFAULT_SYSTEM_SETTINGS } from './data/projectsData';
import { FilterState, ProjectItem, KpiSummary, DepartmentInfo, CustomStatus, CustomInvestmentStage, SystemSettings, ActiveTab } from './types';
import { extractFiscalYear } from './utils/formatters';
import { Building2, Calendar, AlertCircle } from 'lucide-react';
import { SyncToast, SyncState } from './components/SyncToast';
import { OperationStatusModal, OperationModalState } from './components/OperationStatusModal';
import {
  getStoredSheetConfig,
  getAccessToken,
  fetchProjectsFromGoogleSheet,
  syncProjectsToGoogleSheet,
  fetchSettingsFromGoogleSheet,
  syncSettingsToGoogleSheet,
  areProjectsDifferent,
  initAuth,
  SyncedSettingsPayload,
} from './utils/googleSheets';

// Code Splitting & Lazy Loading for heavy modals to minimize initial bundle size and boost render speed
const ProjectModal = React.lazy(() => import('./components/ProjectModal').then((m) => ({ default: m.ProjectModal })));
const ProjectEditModal = React.lazy(() => import('./components/ProjectEditModal').then((m) => ({ default: m.ProjectEditModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const DisbursementModal = React.lazy(() => import('./components/DisbursementModal').then((m) => ({ default: m.DisbursementModal })));

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [useCompactUnit, setUseCompactUnit] = useState<boolean>(true);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [isAddingNewProject, setIsAddingNewProject] = useState<boolean>(false);
  const [disbursementProject, setDisbursementProject] = useState<ProjectItem | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'statuses' | 'investment_stages' | 'departments' | 'google_sheets' | 'general'>('statuses');
  const [isGoogleSheetConnected, setIsGoogleSheetConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToastStatus, setSyncToastStatus] = useState<SyncState>('idle');
  const [syncToastMessage, setSyncToastMessage] = useState<string>('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  // Operation Status Pop-up Modal State
  const [operationState, setOperationState] = useState<OperationModalState>({
    isOpen: false,
    status: 'loading',
    title: '',
    description: '',
    type: 'general',
    autoCloseDelay: 1200,
  });

  // 1. Projects State - Pure In-Memory & Direct Google Sheet source (No LocalStorage caching)
  const [projects, setProjects] = useState<ProjectItem[]>(PROJECTS_DATA);
  const projectsRef = useRef<ProjectItem[]>(projects);
  projectsRef.current = projects;

  // 2. Departments State
  const [departments, setDepartments] = useState<Record<string, DepartmentInfo>>(DEPARTMENTS);

  // 3. Statuses State
  const [statuses, setStatuses] = useState<CustomStatus[]>(DEFAULT_STATUSES);

  // 4. Investment Stages State
  const [investmentStages, setInvestmentStages] = useState<CustomInvestmentStage[]>(DEFAULT_INVESTMENT_STAGES);

  // 5. System Settings State (Persistent across sessions)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem('system_settings_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SYSTEM_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SYSTEM_SETTINGS;
  });

  // Save systemSettings to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('system_settings_cache', JSON.stringify(systemSettings));
    } catch (e) {
      console.warn('Unable to cache system settings in localStorage', e);
    }
  }, [systemSettings]);

  // Extract all available fiscal years in data + systemSettings
  const availableFiscalYears = useMemo(() => {
    const years = new Set<string>();
    if (systemSettings.fiscalYear) {
      years.add(systemSettings.fiscalYear);
    }
    if (systemSettings.availableFiscalYears && systemSettings.availableFiscalYears.length > 0) {
      systemSettings.availableFiscalYears.forEach((yr) => {
        if (yr) years.add(yr.trim());
      });
    }
    projects.forEach((p) => {
      const yr = p.fiscalYear || extractFiscalYear(p.meetingNo, systemSettings.fiscalYear, p.title);
      if (yr) years.add(yr);
    });
    // Ensure standard fiscal years are included
    ['2570', '2569', '2568'].forEach((yr) => {
      // If user has custom defined list, keep custom or default
      if (!systemSettings.availableFiscalYears || systemSettings.availableFiscalYears.length === 0) {
        years.add(yr);
      }
    });
    const sorted = Array.from(years).sort((a, b) => b.localeCompare(a));
    return ['all', ...sorted];
  }, [projects, systemSettings.fiscalYear, systemSettings.availableFiscalYears]);

  // Extract all unique meeting numbers
  const allMeetings = useMemo(() => {
    const meetings = new Set<string>();
    projects.forEach((p) => {
      if (p.meetingNo) meetings.add(p.meetingNo);
    });
    ['1/2568', '12/2568', '1/2569', '2/2569', '3/2569', '4/2569', 'ไม่ได้จัดประชุม'].forEach((m) => meetings.add(m));
    return Array.from(meetings);
  }, [projects]);

  // 6. Filters State
  const [filters, setFilters] = useState<FilterState>(() => ({
    searchQuery: '',
    fiscalYearFilter: systemSettings.fiscalYear || '2569',
    meetingFilter: 'ทั้งหมด',
    departmentFilter: 'all',
    statusFilter: 'all',
    sortBy: 'id',
    sortDirection: 'asc',
  }));

  // Show toast notification helper
  const triggerSyncToast = useCallback((status: SyncState, message: string, durationMs: number = 3500) => {
    setSyncToastStatus(status);
    setSyncToastMessage(message);
    const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncedTime(now);

    if (status !== 'syncing') {
      setTimeout(() => {
        setSyncToastStatus((curr) => (curr === status ? 'idle' : curr));
      }, durationMs);
    }
  }, []);

  // Fiscal Year Confirmation Dialog State
  const [pendingFiscalYearChange, setPendingFiscalYearChange] = useState<string | null>(null);

  const handleSelectFiscalYear = useCallback((year: string) => {
    if (year === filters.fiscalYearFilter) return;
    setPendingFiscalYearChange(year);
  }, [filters.fiscalYearFilter]);

  const confirmFiscalYearChange = useCallback(() => {
    if (!pendingFiscalYearChange) return;
    const year = pendingFiscalYearChange;
    setFilters((prev) => {
      let nextMeeting = prev.meetingFilter;
      if (year !== 'all' && nextMeeting !== 'ทั้งหมด' && nextMeeting !== 'ไม่ได้จัดประชุม' && !nextMeeting.includes(year)) {
        nextMeeting = 'ทั้งหมด';
      }
      return {
        ...prev,
        fiscalYearFilter: year,
        meetingFilter: nextMeeting,
      };
    });
    triggerSyncToast('success', year === 'all' ? 'แสดงข้อมูลโครงการทุกปีงบประมาณ' : `สลับแสดงข้อมูลปีงบประมาณ พ.ศ. ${year}`, 2500);
    setPendingFiscalYearChange(null);
  }, [pendingFiscalYearChange, triggerSyncToast]);

  const cancelFiscalYearChange = useCallback(() => {
    setPendingFiscalYearChange(null);
  }, []);

  // Composite current settings payload
  const currentSettingsPayload: SyncedSettingsPayload = useMemo(() => ({
    systemSettings,
    investmentStages,
    statuses,
    departments,
  }), [systemSettings, investmentStages, statuses, departments]);

  const settingsPayloadRef = useRef<SyncedSettingsPayload>(currentSettingsPayload);
  settingsPayloadRef.current = currentSettingsPayload;

  // Mutex lock for background syncing to avoid race conditions & duplicate network requests
  const isSyncInProgressRef = useRef<boolean>(false);

  // Apply settings pulled from Google Sheet to React state
  const applySyncedSettings = useCallback((incoming: SyncedSettingsPayload) => {
    let changed = false;
    if (incoming.systemSettings) {
      setSystemSettings((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(incoming.systemSettings)) {
          changed = true;
          return incoming.systemSettings!;
        }
        return prev;
      });
    }
    if (incoming.investmentStages && incoming.investmentStages.length > 0) {
      setInvestmentStages((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(incoming.investmentStages)) {
          changed = true;
          return incoming.investmentStages!;
        }
        return prev;
      });
    }
    if (incoming.statuses && incoming.statuses.length > 0) {
      setStatuses((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(incoming.statuses)) {
          changed = true;
          return incoming.statuses!;
        }
        return prev;
      });
    }
    if (incoming.departments && Object.keys(incoming.departments).length > 0) {
      setDepartments((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(incoming.departments)) {
          changed = true;
          return incoming.departments!;
        }
        return prev;
      });
    }
    return changed;
  }, []);

  // Helper to push updated settings payload to Google Sheet _Settings tab
  const pushSettingsToSheet = useCallback(async (payload: SyncedSettingsPayload, successTitle: string = 'บันทึกการตั้งค่าระบบสำเร็จ!') => {
    const config = getStoredSheetConfig();
    const token = getAccessToken();
    if (config?.spreadsheetId && config.autoSyncEnabled !== false && (token || config.scriptAppUrl)) {
      triggerSyncToast('syncing', 'กำลังซิงค์การตั้งค่าระบบไปยัง Google Sheet...');
      try {
        await syncSettingsToGoogleSheet(token, config.spreadsheetId, payload, config.scriptAppUrl);
        triggerSyncToast('synced', 'บันทึกการตั้งค่าระบบลง Google Sheet เรียบร้อยแล้ว');
      } catch (err) {
        console.error('Settings sync to Google Sheet error:', err);
        triggerSyncToast('error', 'บันทึกการตั้งค่าในระบบแล้ว แต่ไม่สามารถซิงค์ลง Google Sheet ได้');
      }
    } else {
      triggerSyncToast('synced', successTitle);
    }
  }, [triggerSyncToast]);

  // High-performance continuous bidirectional synchronization engine with In-flight Mutex lock
  const syncFromGoogleSheet = useCallback(async (silent: boolean = false) => {
    const config = getStoredSheetConfig();
    if (!config?.spreadsheetId || config.autoSyncEnabled === false) return;
    if (isSyncInProgressRef.current) return;

    isSyncInProgressRef.current = true;
    const token = getAccessToken();

    try {
      if (!silent) {
        setIsSyncing(true);
        triggerSyncToast('syncing', 'กำลังดึงข้อมูลโครงการและการตั้งค่าจาก Google Sheet...');
      }

      // 1. Pull projects (supports token or public sheet)
      const currentProjects = projectsRef.current;
      const pulled = await fetchProjectsFromGoogleSheet(token, config.spreadsheetId, currentProjects, silent);
      
      // 2. Pull settings (_Settings tab)
      const currentPayload = settingsPayloadRef.current;
      const pulledSettings = await fetchSettingsFromGoogleSheet(token, config.spreadsheetId, currentPayload);
      const settingsChanged = applySyncedSettings(pulledSettings);

      // Check if there are real differences in projects compared to current state
      setProjects((curr) => {
        if (!pulled || pulled.length === 0) return curr;
        if (areProjectsDifferent(curr, pulled)) {
          triggerSyncToast('pulled_update', `อัปเดตข้อมูลล่าสุดจาก Google Sheet (${pulled.length} โครงการ${settingsChanged ? ' + การตั้งค่าระบบ' : ''}) แล้ว`);
          setSelectedProject((prev) => (prev ? pulled.find((p) => p.id === prev.id) || prev : null));
          return pulled;
        } else if (settingsChanged) {
          triggerSyncToast('pulled_update', 'อัปเดตการตั้งค่าระบบจาก Google Sheet แล้ว');
        } else if (!silent) {
          triggerSyncToast('synced', 'ข้อมูลโครงการและการตั้งค่าบนเว็บตรงกับ Google Sheet แล้ว');
        }
        return curr;
      });
    } catch (err: any) {
      if (!silent) {
        console.error('Manual sync check failed:', err);
        triggerSyncToast('error', err?.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลกับ Google Sheet');
      }
    } finally {
      isSyncInProgressRef.current = false;
      if (!silent) {
        setIsSyncing(false);
      }
    }
  }, [applySyncedSettings, triggerSyncToast]);

  // Initial connection check & auth listener (Runs once cleanly)
  useEffect(() => {
    const config = getStoredSheetConfig();
    setIsGoogleSheetConnected(!!config?.spreadsheetUrl);

    if (config?.spreadsheetId && config.autoSyncEnabled !== false) {
      syncFromGoogleSheet(true);
    }

    const unsub = initAuth(() => {
      if (config?.spreadsheetId && config.autoSyncEnabled !== false) {
        syncFromGoogleSheet(true);
      }
    });

    return () => unsub();
  }, [syncFromGoogleSheet]);

  // Stable Background polling every 15 seconds + instant pull on window focus / tab switch
  useEffect(() => {
    const config = getStoredSheetConfig();
    if (!config?.spreadsheetId || config.autoSyncEnabled === false) return;

    // 1. Periodic background polling
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        syncFromGoogleSheet(true);
      }
    }, 15000);

    // 2. Instant pull when user switches tab or returns to browser
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
        syncFromGoogleSheet(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [syncFromGoogleSheet]);

  // Quick Sync Handler (Header button)
  const handleQuickSync = useCallback(async () => {
    const config = getStoredSheetConfig();
    if (!config?.spreadsheetId) {
      setSettingsInitialTab('google_sheets');
      setIsSettingsOpen(true);
      return;
    }

    setOperationState({
      isOpen: true,
      status: 'loading',
      type: 'sync',
      title: 'กำลังซิงค์ข้อมูลกับ Google Sheet...',
      description: 'กำลังเชื่อมต่อและดึงข้อมูลโครงการและการตั้งค่าล่าสุด...',
      autoCloseDelay: 1200,
    });

    try {
      await syncFromGoogleSheet(false);
      setOperationState({
        isOpen: true,
        status: 'success',
        type: 'sync',
        title: 'ซิงค์ข้อมูลสำเร็จ!',
        description: 'ข้อมูลบนเว็บและ Google Sheet ตรงกันเรียบร้อยแล้ว',
        autoCloseDelay: 1200,
      });
    } catch (err) {
      setOperationState({
        isOpen: true,
        status: 'error',
        type: 'sync',
        title: 'ไม่สามารถซิงค์ข้อมูลได้',
        description: 'กรุณาตรวจสอบการเชื่อมต่อหรือสิทธิ์การเข้าถึง Google Sheet',
      });
    }
  }, [syncFromGoogleSheet]);

  // Open Add New Project Modal with prefilled default template
  const handleOpenAddNewProject = useCallback(() => {
    const nextId = projects.length > 0
      ? Math.max(...projects.map((p) => (typeof p.id === 'number' ? p.id : parseInt(String(p.id), 10) || 0))) + 1
      : 1;

    const activeYear = filters.fiscalYearFilter !== 'all' ? filters.fiscalYearFilter : (systemSettings.fiscalYear || '2569');
    const defaultDept = Object.keys(departments)[0] || 'สตน.';
    const nowTimestamp = new Date().toLocaleString('th-TH');
    const newProject: ProjectItem = {
      id: nextId,
      fiscalYear: activeYear,
      meetingNo: `1/${activeYear}`,
      title: '',
      departmentCode: defaultDept,
      departmentName: departments[defaultDept]?.fullName || DEPARTMENTS[defaultDept]?.fullName || '',
      requestedBudget: 0,
      ministerSignedDate: '',
      bbApprovedDate: '',
      statusCategory: 'draft_pending',
      approvedBudget: null,
      approvedStatusText: 'เรื่องเสนอใหม่',
      remarks: '',
      expenseType: 'investment',
      operatingBudget: 0,
      investmentBudget: 0,
      investmentStage: 'procuring',
      disbursedAmount: 0,
      physicalProgress: 0,
      disbursementStatus: 'not_started',
      disbursementRecords: [],
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
      lastModifiedBy: 'ระบบติดตามงบประมาณ',
    };

    setEditingProject(newProject);
    setIsAddingNewProject(true);
  }, [projects, departments, filters.fiscalYearFilter, systemSettings.fiscalYear]);

  // Save Project (Instant Optimistic Update ➔ Non-blocking Background Sync to Google Sheet)
  const handleSaveProject = async (updatedProject: ProjectItem) => {
    const isNew = isAddingNewProject;
    const nowTimestamp = new Date().toLocaleString('th-TH');
    const isDisbursement = !!updatedProject.disbursementRecords && updatedProject.disbursementRecords.length > 0;

    const projectToSave: ProjectItem = {
      ...updatedProject,
      fiscalYear: updatedProject.fiscalYear || extractFiscalYear(updatedProject.meetingNo, systemSettings.fiscalYear, updatedProject.title),
      createdAt: updatedProject.createdAt || nowTimestamp,
      updatedAt: nowTimestamp,
      lastModifiedBy: 'ระบบติดตามงบประมาณ',
    };

    // 1. INSTANT OPTIMISTIC UI: Update state in memory immediately (0ms)
    const currentList = projects && projects.length > 0 ? projects : PROJECTS_DATA;
    const exists = currentList.some((p) => p.id === projectToSave.id);
    const nextProjects: ProjectItem[] = exists
      ? currentList.map((p) => (p.id === projectToSave.id ? projectToSave : p))
      : [...currentList, projectToSave];

    setProjects(nextProjects);

    if (selectedProject?.id === projectToSave.id) {
      setSelectedProject(projectToSave);
    }
    setIsAddingNewProject(false);
    setEditingProject(null);

    // 2. Non-blocking Toast notification
    const syncActionLabel = isNew
      ? 'เพิ่มโครงการใหม่แล้ว'
      : isDisbursement
      ? 'บันทึกการเบิกจ่ายแล้ว'
      : `อัปเดตข้อมูลโครงการ "${projectToSave.title || 'โครงการ'}" แล้ว`;
    
    // Auto-push to Google Sheet in background
    const config = getStoredSheetConfig();
    const token = getAccessToken();
    if (config?.spreadsheetId && config.autoSyncEnabled !== false && (token || config.scriptAppUrl)) {
      triggerSyncToast('syncing', `${syncActionLabel} — กำลังซิงค์ลง Google Sheet...`);
      try {
        await syncProjectsToGoogleSheet(token, config.spreadsheetId, nextProjects, config.scriptAppUrl);
        triggerSyncToast('synced', isNew ? `เพิ่มโครงการใหม่และบันทึกลง Google Sheet สำเร็จ` : `บันทึกลง Google Sheet เรียบร้อยแล้ว`);
      } catch (err) {
        console.error('Background sync to Google Sheet error:', err);
        triggerSyncToast('error', 'บันทึกในเว็บแล้ว แต่ไม่สามารถส่งไป Google Sheet ได้ กรุณาตรวจสอบการเชื่อมต่อ');
      }
    } else {
      triggerSyncToast('synced', syncActionLabel);
    }
  };

  // Quick 1-Click Status Change from Table/Cards
  const handleQuickStatusChange = (project: ProjectItem, newStatusKey: string, newStatusLabel: string) => {
    let newApprovedBudget: number | null = project.approvedBudget;
    if (newStatusKey === 'approved') {
      if (!project.approvedBudget || project.approvedBudget <= 0) {
        newApprovedBudget = project.requestedBudget;
      }
    } else {
      newApprovedBudget = null;
    }

    const updatedProject: ProjectItem = {
      ...project,
      statusCategory: newStatusKey as ProjectItem['statusCategory'],
      approvedBudget: newApprovedBudget,
      approvedStatusText: newStatusLabel,
    };

    handleSaveProject(updatedProject);
  };

  // Delete Project (Instant Optimistic Update ➔ Non-blocking Background Sync)
  const handleDeleteProject = async (projectId: number) => {
    const currentList = projects && projects.length > 0 ? projects : PROJECTS_DATA;
    const deletedProject = currentList.find((p) => p.id === projectId);
    const nextProjects = currentList.filter((p) => p.id !== projectId);

    // 1. INSTANT OPTIMISTIC UI: Remove from memory immediately
    setProjects(nextProjects);

    if (selectedProject?.id === projectId) {
      setSelectedProject(null);
    }
    if (editingProject?.id === projectId) {
      setEditingProject(null);
    }
    if (disbursementProject?.id === projectId) {
      setDisbursementProject(null);
    }

    const title = deletedProject?.title ? ` "${deletedProject.title}"` : '';

    // 2. Auto-push to Google Sheet in background
    const config = getStoredSheetConfig();
    const token = getAccessToken();
    if (config?.spreadsheetId && config.autoSyncEnabled !== false && (token || config.scriptAppUrl)) {
      triggerSyncToast('syncing', `ลบโครงการ${title}แล้ว — กำลังอัปเดต Google Sheet...`);
      try {
        await syncProjectsToGoogleSheet(token, config.spreadsheetId, nextProjects, config.scriptAppUrl);
        triggerSyncToast('synced', `ลบโครงการและอัปเดต Google Sheet สำเร็จ`);
      } catch (err) {
        console.error('Delete sync to Google Sheet error:', err);
        triggerSyncToast('error', 'ลบโครงการในระบบแล้ว แต่ไม่สามารถส่งไป Google Sheet ได้');
      }
    } else {
      triggerSyncToast('synced', `ลบโครงการ${title}เรียบร้อยแล้ว`);
    }
  };

  // Save Departments
  const handleSaveDepartments = (updatedDepts: Record<string, DepartmentInfo>) => {
    setDepartments(updatedDepts);
    pushSettingsToSheet({
      ...currentSettingsPayload,
      departments: updatedDepts,
    }, 'บันทึกข้อมูลหน่วยงานสำเร็จ!');
  };

  // Save Statuses
  const handleSaveStatuses = (updatedStatuses: CustomStatus[]) => {
    setStatuses(updatedStatuses);
    pushSettingsToSheet({
      ...currentSettingsPayload,
      statuses: updatedStatuses,
    }, 'บันทึกข้อมูลสถานะสำเร็จ!');
  };

  // Save Investment Stages
  const handleSaveInvestmentStages = (updatedStages: CustomInvestmentStage[]) => {
    setInvestmentStages(updatedStages);
    pushSettingsToSheet({
      ...currentSettingsPayload,
      investmentStages: updatedStages,
    }, 'บันทึกขั้นตอนงบลงทุนสำเร็จ!');
  };

  // Save System Settings
  const handleSaveSettings = (updatedSettings: SystemSettings) => {
    setSystemSettings(updatedSettings);
    pushSettingsToSheet({
      ...currentSettingsPayload,
      systemSettings: updatedSettings,
    }, 'บันทึกการตั้งค่าระบบสำเร็จ!');
  };

  // Reset All Data (Fetches fresh from Google Sheet)
  const handleResetAllData = async () => {
    setOperationState({
      isOpen: true,
      status: 'loading',
      type: 'reset',
      title: 'กำลังรีเซ็ตและดึงข้อมูลจาก Google Sheet...',
      description: 'กำลังดึงข้อมูลล่าสุดจาก Google Sheet มาแสดงผลใหม่...',
      autoCloseDelay: 1500,
    });

    await syncFromGoogleSheet(false);

    setOperationState({
      isOpen: true,
      status: 'success',
      type: 'reset',
      title: 'รีเซ็ตข้อมูลสำเร็จ!',
      description: 'ระบบได้ดึงข้อมูลโครงการและการตั้งค่าล่าสุดจาก Google Sheet เรียบร้อยแล้ว',
      autoCloseDelay: 1500,
    });
  };

  // Memoized handlers for child components to eliminate unnecessary re-renders
  const handleSelectProject = useCallback((project: ProjectItem) => {
    setSelectedProject(project);
  }, []);

  const handleEditProject = useCallback((project: ProjectItem) => {
    setEditingProject(project);
  }, []);

  const handleOpenDisbursementModal = useCallback((project: ProjectItem) => {
    setDisbursementProject(project);
  }, []);

  const handleCloseSelectedProject = useCallback(() => {
    setSelectedProject(null);
  }, []);

  const handleCloseEditingProject = useCallback(() => {
    setEditingProject(null);
    setIsAddingNewProject(false);
  }, []);

  const handleCloseDisbursementModal = useCallback(() => {
    setDisbursementProject(null);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenSettings = useCallback((tab: 'statuses' | 'investment_stages' | 'departments' | 'google_sheets' | 'general' = 'statuses') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      fiscalYearFilter: systemSettings.fiscalYear || '2569',
      meetingFilter: 'ทั้งหมด',
      departmentFilter: 'all',
      statusFilter: 'all',
      sortBy: 'id',
      sortDirection: 'asc',
    });
  }, [systemSettings.fiscalYear]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // คำนวณลำดับโครงการให้เริ่มนับ 1 ใหม่ทุกปีงบประมาณ (Sequence restarts from 1 per fiscal year)
  const fiscalYearSeqMap = useMemo(() => {
    const map = new Map<number, number>();
    const yearCounters: Record<string, number> = {};

    // เรียงตาม ID เดิมเพื่อรักษาลำดับธรรมชาติของโครงการ
    const sorted = [...projects].sort((a, b) => (a.id || 0) - (b.id || 0));
    sorted.forEach((p) => {
      const pYear = p.fiscalYear || extractFiscalYear(p.meetingNo, systemSettings.fiscalYear, p.title);
      const nextSeq = (yearCounters[pYear] || 0) + 1;
      yearCounters[pYear] = nextSeq;
      map.set(p.id, nextSeq);
    });

    return map;
  }, [projects, systemSettings.fiscalYear]);

  // 1. High-Performance Base Filtered Projects (Fiscal Year, Search, Meeting, Department - without statusFilter)
  const baseFilteredProjects = useMemo(() => {
    const rawSearch = filters.searchQuery.trim().toLowerCase();
    const fiscalYear = filters.fiscalYearFilter;
    const meeting = filters.meetingFilter;
    const dept = filters.departmentFilter;
    const hasSearch = rawSearch.length > 0;
    const hasFiscalYear = fiscalYear && fiscalYear !== 'all';
    const hasMeeting = meeting !== 'ทั้งหมด';
    const hasDept = dept !== 'all';

    return projects.filter((p) => {
      // 1. Fiscal Year Filter
      if (hasFiscalYear) {
        const pYear = p.fiscalYear || extractFiscalYear(p.meetingNo, systemSettings.fiscalYear, p.title);
        if (pYear !== fiscalYear) {
          return false;
        }
      }

      // 2. Meeting Filter (Fastest check)
      if (hasMeeting && p.meetingNo !== meeting) {
        return false;
      }

      // 3. Department Filter (Fast check)
      if (hasDept && p.departmentCode !== dept) {
        return false;
      }

      // 4. Search Query
      if (hasSearch) {
        const matchTitle = p.title.toLowerCase().includes(rawSearch);
        const matchDept = p.departmentCode.toLowerCase().includes(rawSearch) || p.departmentName.toLowerCase().includes(rawSearch);
        const matchRemarks = p.remarks ? p.remarks.toLowerCase().includes(rawSearch) : false;
        const matchMeeting = p.meetingNo.toLowerCase().includes(rawSearch);
        if (!matchTitle && !matchDept && !matchRemarks && !matchMeeting) {
          return false;
        }
      }

      return true;
    });
  }, [projects, filters.fiscalYearFilter, filters.meetingFilter, filters.departmentFilter, filters.searchQuery, systemSettings.fiscalYear]);

  // 2. Filter & Sort Projects (applying statusFilter)
  const filteredProjects = useMemo(() => {
    const statusF = filters.statusFilter;
    const sortBy = filters.sortBy;
    const isAsc = filters.sortDirection === 'asc';

    let list = baseFilteredProjects;

    if (statusF !== 'all') {
      if (statusF === 'returned_review') {
        list = list.filter((p) => p.statusCategory === 'returned_review' || p.statusCategory === 'disapproved');
      } else {
        list = list.filter((p) => p.statusCategory === statusF);
      }
    }

    return [...list].sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'id') {
        valA = fiscalYearSeqMap.get(a.id) ?? a.id;
        valB = fiscalYearSeqMap.get(b.id) ?? b.id;
        if (filters.fiscalYearFilter === 'all') {
          const yA = a.fiscalYear || extractFiscalYear(a.meetingNo, systemSettings.fiscalYear, a.title);
          const yB = b.fiscalYear || extractFiscalYear(b.meetingNo, systemSettings.fiscalYear, b.title);
          if (yA !== yB) {
            return isAsc ? yA.localeCompare(yB) : yB.localeCompare(yA);
          }
        }
      }

      if (sortBy === 'approvedBudget') {
        valA = a.approvedBudget || 0;
        valB = b.approvedBudget || 0;
      }

      if (typeof valA === 'string') {
        return isAsc ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
      }

      return isAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [baseFilteredProjects, filters.statusFilter, filters.sortBy, filters.sortDirection]);

  // 3. Calculate Overall KPIs from baseFilteredProjects (Single Pass Loop)
  const kpiSummary = useMemo<KpiSummary>(() => {
    let totalRequested = 0;
    let totalApproved = 0;
    let totalUnderReview = 0;
    let totalReturned = 0;
    let totalPending = 0;

    let approvedCount = 0;
    let underReviewCount = 0;
    let returnedCount = 0;
    let pendingCount = 0;
    let draftPendingCount = 0;

    const len = baseFilteredProjects.length;
    for (let i = 0; i < len; i++) {
      const p = baseFilteredProjects[i];
      totalRequested += p.requestedBudget;

      switch (p.statusCategory) {
        case 'approved':
          totalApproved += p.approvedBudget || p.requestedBudget;
          approvedCount += 1;
          break;
        case 'under_review':
          totalUnderReview += p.requestedBudget;
          underReviewCount += 1;
          break;
        case 'signed_pending':
          totalPending += p.requestedBudget;
          pendingCount += 1;
          break;
        case 'returned_review':
        case 'disapproved':
          totalReturned += p.requestedBudget;
          returnedCount += 1;
          break;
        case 'draft_pending':
          totalPending += p.requestedBudget;
          pendingCount += 1;
          draftPendingCount += 1;
          break;
      }
    }

    const approvalRate = totalRequested > 0 ? (totalApproved / totalRequested) * 100 : 0;

    return {
      totalRequestedBudget: totalRequested,
      totalApprovedBudget: totalApproved,
      totalUnderReviewBudget: totalUnderReview,
      totalReturnedBudget: totalReturned,
      totalPendingBudget: totalPending,
      totalProjects: len,
      approvedProjectsCount: approvedCount,
      underReviewProjectsCount: underReviewCount,
      returnedProjectsCount: returnedCount,
      pendingProjectsCount: pendingCount,
      draftPendingProjectsCount: draftPendingCount,
      approvalRatePercentage: approvalRate,
    };
  }, [baseFilteredProjects]);

  const fiscalYearProjects = useMemo(() => {
    const fiscalYear = filters.fiscalYearFilter;
    if (!fiscalYear || fiscalYear === 'all') {
      return projects;
    }
    return projects.filter((p) => {
      const pYear = p.fiscalYear || extractFiscalYear(p.meetingNo, systemSettings.fiscalYear, p.title);
      return pYear === fiscalYear;
    });
  }, [projects, filters.fiscalYearFilter, systemSettings.fiscalYear]);

  const fiscalYearTotalProjectsCount = fiscalYearProjects.length;

  const approvedProjectsCount = useMemo(() => {
    return fiscalYearProjects.filter((p) => p.statusCategory === 'approved').length;
  }, [fiscalYearProjects]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-['Prompt',sans-serif]">
      
      {/* Executive Header */}
      <Header
        useCompactUnit={useCompactUnit}
        setUseCompactUnit={setUseCompactUnit}
        onResetFilters={handleResetFilters}
        onPrint={handlePrint}
        onOpenSettings={handleOpenSettings}
        totalProjectsCount={fiscalYearTotalProjectsCount}
        filteredProjectsCount={filteredProjects.length}
        systemSettings={systemSettings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        approvedProjectsCount={approvedProjectsCount}
        isGoogleSheetConnected={isGoogleSheetConnected}
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        selectedFiscalYear={filters.fiscalYearFilter}
        onSelectFiscalYear={handleSelectFiscalYear}
        availableFiscalYears={availableFiscalYears}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'overview' ? (
          <>
            {/* High Level KPI Cards */}
            <KpiSummaryCards
              kpi={kpiSummary}
              useCompactUnit={useCompactUnit}
              activeStatusFilter={filters.statusFilter}
              onSelectStatusFilter={(status) => {
                setFilters((prev) => ({
                  ...prev,
                  statusFilter: prev.statusFilter === status ? 'all' : status,
                }));
              }}
            />

            {/* Visual Charts Section */}
            <BudgetCharts
              projects={baseFilteredProjects}
              useCompactUnit={useCompactUnit}
              departments={departments}
              statuses={statuses}
              onSelectProject={handleSelectProject}
            />

            {/* Search & Filters */}
            <FiltersBar
              filters={filters}
              setFilters={setFilters}
              totalCount={projects.length}
              filteredCount={filteredProjects.length}
              onReset={handleResetFilters}
              departments={departments}
              statuses={statuses}
              availableFiscalYears={availableFiscalYears}
              allMeetings={allMeetings}
              onSelectFiscalYear={handleSelectFiscalYear}
            />

            {/* Main Projects List / Table */}
            <ProjectList
              projects={filteredProjects}
              useCompactUnit={useCompactUnit}
              onSelectProject={handleSelectProject}
              onEditProject={handleEditProject}
              onDeleteProject={handleDeleteProject}
              onAddNewProject={handleOpenAddNewProject}
              searchQuery={filters.searchQuery}
              statuses={statuses}
              departments={departments}
              fiscalYearSeqMap={fiscalYearSeqMap}
            />
          </>
        ) : (
          /* Project Tracking View */
          <ProjectTrackingView
            projects={baseFilteredProjects}
            departments={departments}
            statuses={statuses}
            investmentStages={investmentStages}
            useCompactUnit={useCompactUnit}
            systemSettings={systemSettings}
            onSelectProject={handleSelectProject}
            onOpenDisbursementModal={handleOpenDisbursementModal}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            fiscalYearSeqMap={fiscalYearSeqMap}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white text-slate-500 py-6 border-t border-slate-200 mt-12 text-xs no-print">
        <div className="max-w-[1800px] w-full mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="flex items-center justify-center gap-2 text-center">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-800">
              {systemSettings.appTitle || 'ระบบสรุปและวิเคราะห์ข้อมูลงบประมาณสำหรับผู้บริหาร'}
            </span>
          </div>
        </div>
      </footer>

      {/* Lazy-Loaded Modals with Suspense for smooth, non-blocking rendering */}
      <Suspense fallback={null}>
        {/* Project Detail Modal */}
        {selectedProject && (
          <ProjectModal
            project={selectedProject}
            useCompactUnit={useCompactUnit}
            onClose={handleCloseSelectedProject}
            onEdit={handleOpenDisbursementModal}
            onEditProjectInfo={handleEditProject}
            onDelete={handleDeleteProject}
            statuses={statuses}
            investmentStages={investmentStages}
            fiscalYearSeqMap={fiscalYearSeqMap}
          />
        )}

        {/* Project Edit / Add Modal */}
        {editingProject && (
          <ProjectEditModal
            project={editingProject}
            isOpen={!!editingProject}
            onClose={handleCloseEditingProject}
            onSave={handleSaveProject}
            onDelete={handleDeleteProject}
            departments={departments}
            statuses={statuses}
            isNew={isAddingNewProject}
            availableFiscalYears={availableFiscalYears}
          />
        )}

        {/* Project Disbursement & Tracking Modal */}
        {disbursementProject && (
          <DisbursementModal
            project={disbursementProject}
            isOpen={!!disbursementProject}
            onClose={handleCloseDisbursementModal}
            onSave={handleSaveProject}
            departments={departments}
            investmentStages={investmentStages}
          />
        )}

        {/* System Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={handleCloseSettings}
            initialTab={settingsInitialTab}
            departments={departments}
            onSaveDepartments={handleSaveDepartments}
            statuses={statuses}
            onSaveStatuses={handleSaveStatuses}
            investmentStages={investmentStages}
            onSaveInvestmentStages={handleSaveInvestmentStages}
            settings={systemSettings}
            onSaveSettings={handleSaveSettings}
            onResetAllData={handleResetAllData}
            projectsCount={projects.length}
            projects={projects}
            onProjectsUpdated={(updatedProjects) => {
              setProjects(updatedProjects);
              setIsGoogleSheetConnected(true);
            }}
            settingsPayload={currentSettingsPayload}
            onSettingsUpdated={(updatedSettings) => {
              applySyncedSettings(updatedSettings);
              setIsGoogleSheetConnected(true);
            }}
            onGoogleSheetConnectedChange={(connected) => {
              setIsGoogleSheetConnected(connected);
            }}
          />
        )}
      </Suspense>

      {/* Real-Time Two-Way Sync Toast Indicator */}
      <SyncToast
        status={syncToastStatus}
        message={syncToastMessage}
        lastSyncedTime={lastSyncedTime}
        onQuickSync={handleQuickSync}
      />

      {/* Operation Status Modal */}
      <OperationStatusModal
        state={operationState}
        onClose={() => setOperationState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Fiscal Year Change Confirmation Dialog */}
      {pendingFiscalYearChange !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 relative transform transition-all animate-scale-up">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันการเปลี่ยนปีงบประมาณ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เปลี่ยนมุมมองการแสดงผลและการกรองข้อมูลโครงการ
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 mb-5 text-xs text-slate-600 space-y-2">
              <p className="leading-relaxed">
                คุณต้องการเปลี่ยนมุมมองการแสดงผลจาก{' '}
                <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {filters.fiscalYearFilter === 'all' ? 'ทุกปีงบประมาณ' : `พ.ศ. ${filters.fiscalYearFilter}`}
                </span>{' '}
                เป็น{' '}
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {pendingFiscalYearChange === 'all' ? 'ทุกปีงบประมาณ (ทั้งหมด)' : `ปีงบประมาณ พ.ศ. ${pendingFiscalYearChange}`}
                </span>{' '}
                ใช่หรือไม่?
              </p>
              <p className="text-[11px] text-slate-500">
                💡 ระบบจะกรองการ์ดสรุปยอด แผนภูมิวิเคราะห์ และตารางโครงการให้ตรงตามปีงบประมาณที่เลือก
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelFiscalYearChange}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmFiscalYearChange}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <span>ยืนยันเปลี่ยนปีงบประมาณ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
