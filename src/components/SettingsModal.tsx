import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  Save,
  Sliders,
  Check,
  AlertTriangle,
  Info,
  Calendar,
  ArrowUp,
  ArrowDown,
  HardHat,
  FileSpreadsheet,
  FileSignature,
  Search,
  Hammer,
  Clock,
  Layers,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Landmark,
  Briefcase,
  BarChart3,
  Coins,
  ShieldCheck,
  Award,
  FileText,
} from 'lucide-react';
import { DepartmentInfo, CustomStatus, CustomInvestmentStage, SystemSettings, ProjectItem } from '../types';
import { DEPARTMENTS, DEFAULT_STATUSES, DEFAULT_INVESTMENT_STAGES, DEFAULT_SYSTEM_SETTINGS } from '../data/projectsData';
import { SyncedSettingsPayload } from '../utils/googleSheets';
import { GoogleSheetsSettingsTab } from './GoogleSheetsSettingsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Record<string, DepartmentInfo>;
  onSaveDepartments: (departments: Record<string, DepartmentInfo>) => void;
  statuses: CustomStatus[];
  onSaveStatuses: (statuses: CustomStatus[]) => void;
  investmentStages: CustomInvestmentStage[];
  onSaveInvestmentStages: (stages: CustomInvestmentStage[]) => void;
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => void;
  onResetAllData: () => void;
  projectsCount: number;
  projects?: ProjectItem[];
  onProjectsUpdated?: (updatedProjects: ProjectItem[]) => void;
  settingsPayload?: SyncedSettingsPayload;
  onSettingsUpdated?: (updatedSettings: SyncedSettingsPayload) => void;
  onGoogleSheetConnectedChange?: (connected: boolean) => void;
  initialTab?: 'statuses' | 'investment_stages' | 'departments' | 'google_sheets' | 'general';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
  onSaveDepartments,
  statuses,
  onSaveStatuses,
  investmentStages,
  onSaveInvestmentStages,
  settings,
  onSaveSettings,
  onResetAllData,
  projectsCount,
  projects = [],
  onProjectsUpdated,
  settingsPayload,
  onSettingsUpdated,
  onGoogleSheetConnectedChange,
  initialTab = 'statuses',
}) => {
  const [activeTab, setActiveTab] = useState<'statuses' | 'investment_stages' | 'departments' | 'google_sheets' | 'general'>(initialTab);

  // Local state for edits
  const [deptList, setDeptList] = useState<DepartmentInfo[]>(() =>
    Object.values(departments)
  );

  const [statusList, setStatusList] = useState<CustomStatus[]>(() => [...statuses]);
  const [stageList, setStageList] = useState<CustomInvestmentStage[]>(() => [...investmentStages]);
  const [generalForm, setGeneralForm] = useState<SystemSettings>(() => ({
    ...settings,
    availableFiscalYears: settings.availableFiscalYears || ['2571', '2570', '2569', '2568'],
    logoType: settings.logoType || 'icon',
    logoIcon: settings.logoIcon || 'building',
    logoColor: settings.logoColor || '#4f46e5',
    logoUrl: settings.logoUrl || '',
  }));
  const [newYearInput, setNewYearInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prevIsOpenRef = useRef<boolean>(false);

  // Sync initial tab when modal opens from closed state
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setDeptList(Object.values(departments));
      setStatusList([...statuses]);
      setStageList([...investmentStages]);
      setGeneralForm({
        ...settings,
        availableFiscalYears: settings.availableFiscalYears || ['2571', '2570', '2569', '2568'],
        logoType: settings.logoType || 'icon',
        logoIcon: settings.logoIcon || 'building',
        logoColor: settings.logoColor || '#4f46e5',
        logoUrl: settings.logoUrl || '',
      });
      setNewYearInput('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialTab, departments, statuses, investmentStages, settings]);

  // Keep local lists updated when props change in background, WITHOUT resetting activeTab or overwriting generalForm
  useEffect(() => {
    if (isOpen) {
      setDeptList(Object.values(departments));
      setStatusList([...statuses]);
      setStageList([...investmentStages]);
    }
  }, [isOpen, departments, statuses, investmentStages]);

  // State for Add/Edit Department Modal
  const [editingDept, setEditingDept] = useState<{ code: string; fullName: string; color: string; isNew?: boolean } | null>(null);

  // State for Add/Edit Status Modal
  const [editingStatus, setEditingStatus] = useState<{ key: string; label: string; description: string; colorTheme: CustomStatus['colorTheme']; isNew?: boolean } | null>(null);

  // State for Add/Edit Investment Stage Modal
  const [editingStage, setEditingStage] = useState<{
    key: string;
    label: string;
    description: string;
    colorTheme: CustomInvestmentStage['colorTheme'];
    iconType?: CustomInvestmentStage['iconType'];
    isNew?: boolean;
  } | null>(null);

  // State for Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Toast / Saved Notice
  const [saveToast, setSaveToast] = useState<string>('');

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 2500);
  };

  // --- Department Handlers ---
  const handleSaveDepartmentItem = (dept: { code: string; fullName: string; color: string; isNew?: boolean }) => {
    if (!dept.code.trim() || !dept.fullName.trim()) return;

    let updated: DepartmentInfo[];
    if (dept.isNew) {
      if (deptList.some((d) => d.code === dept.code.trim())) {
        showNotification(`รหัสหน่วยงาน "${dept.code}" มีอยู่แล้วในระบบ`);
        return;
      }
      updated = [...deptList, { code: dept.code.trim(), fullName: dept.fullName.trim(), color: dept.color }];
    } else {
      updated = deptList.map((d) =>
        d.code === dept.code ? { ...d, fullName: dept.fullName.trim(), color: dept.color } : d
      );
    }

    setDeptList(updated);
    const mapObj: Record<string, DepartmentInfo> = {};
    updated.forEach((d) => {
      mapObj[d.code] = d;
    });
    onSaveDepartments(mapObj);
    setEditingDept(null);
    showNotification('บันทึกข้อมูลหน่วยงานเรียบร้อยแล้ว');
  };

  const handleDeleteDepartment = (code: string) => {
    if (deptList.length <= 1) {
      showNotification('ต้องมีหน่วยงานอย่างน้อย 1 หน่วยงานในระบบ');
      return;
    }

    setConfirmDialog({
      title: 'ยืนยันการลบหน่วยงาน',
      message: `คุณต้องการลบหน่วยงาน "${code}" ออกจากระบบใช่หรือไม่?`,
      confirmText: 'ลบหน่วยงาน',
      isDanger: true,
      onConfirm: () => {
        const updated = deptList.filter((d) => d.code !== code);
        setDeptList(updated);
        const mapObj: Record<string, DepartmentInfo> = {};
        updated.forEach((d) => {
          mapObj[d.code] = d;
        });
        onSaveDepartments(mapObj);
        showNotification(`ลบหน่วยงาน ${code} เรียบร้อยแล้ว`);
        setConfirmDialog(null);
      },
    });
  };

  const handleResetDepartments = () => {
    setConfirmDialog({
      title: 'คืนค่าหน่วยงานเริ่มต้น',
      message: 'ต้องการคืนค่ารายการหน่วยงานเป็นค่าเริ่มต้นของระบบใช่หรือไม่?',
      confirmText: 'คืนค่าเริ่มต้น',
      isDanger: false,
      onConfirm: () => {
        const defaultArr = Object.values(DEPARTMENTS);
        setDeptList(defaultArr);
        onSaveDepartments(DEPARTMENTS);
        showNotification('คืนค่าหน่วยงานเริ่มต้นเรียบร้อยแล้ว');
        setConfirmDialog(null);
      },
    });
  };

  const moveDepartment = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= deptList.length) return;
    const updated = [...deptList];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setDeptList(updated);
    const mapObj: Record<string, DepartmentInfo> = {};
    updated.forEach((d) => {
      mapObj[d.code] = d;
    });
    onSaveDepartments(mapObj);
    showNotification('จัดลำดับหน่วยงานเรียบร้อยแล้ว');
  };

  // --- Status Handlers ---
  const handleSaveStatusItem = (st: { key: string; label: string; description: string; colorTheme: CustomStatus['colorTheme']; isNew?: boolean }) => {
    if (!st.label.trim()) return;

    const formattedKey = st.key.trim().toLowerCase().replace(/\s+/g, '_') || `status_${Date.now()}`;

    let updated: CustomStatus[];
    if (st.isNew) {
      if (statusList.some((s) => s.key === formattedKey)) {
        showNotification(`รหัสสถานะ "${formattedKey}" มีอยู่แล้ว`);
        return;
      }
      updated = [...statusList, { key: formattedKey, label: st.label.trim(), description: st.description.trim(), colorTheme: st.colorTheme }];
    } else {
      updated = statusList.map((s) =>
        s.key === st.key ? { ...s, label: st.label.trim(), description: st.description.trim(), colorTheme: st.colorTheme } : s
      );
    }

    setStatusList(updated);
    onSaveStatuses(updated);
    setEditingStatus(null);
    showNotification('บันทึกสถานะเรียบร้อยแล้ว');
  };

  const handleDeleteStatus = (key: string) => {
    if (statusList.length <= 1) {
      showNotification('ต้องมีสถานะอย่างน้อย 1 รายการในระบบ');
      return;
    }

    const item = statusList.find((s) => s.key === key);
    const labelText = item?.label || key;

    setConfirmDialog({
      title: 'ยืนยันการลบสถานะ',
      message: `คุณต้องการลบสถานะ "${labelText}" ออกจากระบบใช่หรือไม่?`,
      confirmText: 'ลบสถานะ',
      isDanger: true,
      onConfirm: () => {
        const updated = statusList.filter((s) => s.key !== key);
        setStatusList(updated);
        onSaveStatuses(updated);
        showNotification('ลบสถานะเรียบร้อยแล้ว');
        setConfirmDialog(null);
      },
    });
  };

  const handleResetStatuses = () => {
    setConfirmDialog({
      title: 'คืนค่าสถานะเริ่มต้น',
      message: 'ต้องการคืนค่ารายการสถานะเป็นค่าเริ่มต้นของระบบใช่หรือไม่?',
      confirmText: 'คืนค่าเริ่มต้น',
      isDanger: false,
      onConfirm: () => {
        setStatusList(DEFAULT_STATUSES);
        onSaveStatuses(DEFAULT_STATUSES);
        showNotification('คืนค่าสถานะเริ่มต้นเรียบร้อยแล้ว');
        setConfirmDialog(null);
      },
    });
  };

  const moveStatus = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= statusList.length) return;
    const updated = [...statusList];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setStatusList(updated);
    onSaveStatuses(updated);
    showNotification('จัดลำดับสถานะเรียบร้อยแล้ว');
  };

  // --- Investment Stages Handlers ---
  const handleSaveStageItem = (stage: {
    key: string;
    label: string;
    description: string;
    colorTheme: CustomInvestmentStage['colorTheme'];
    iconType?: CustomInvestmentStage['iconType'];
    isNew?: boolean;
  }) => {
    if (!stage.label.trim()) return;

    const formattedKey = stage.key.trim().toLowerCase().replace(/\s+/g, '_') || `stage_${Date.now()}`;

    let updated: CustomInvestmentStage[];
    if (stage.isNew) {
      if (stageList.some((s) => s.key === formattedKey)) {
        showNotification(`รหัสขั้นตอน "${formattedKey}" มีอยู่แล้วในระบบ`);
        return;
      }
      updated = [
        ...stageList,
        {
          key: formattedKey,
          label: stage.label.trim(),
          description: stage.description.trim(),
          colorTheme: stage.colorTheme,
          iconType: stage.iconType || 'search',
        },
      ];
    } else {
      updated = stageList.map((s) =>
        s.key === stage.key
          ? {
              ...s,
              label: stage.label.trim(),
              description: stage.description.trim(),
              colorTheme: stage.colorTheme,
              iconType: stage.iconType || s.iconType || 'search',
            }
          : s
      );
    }

    setStageList(updated);
    onSaveInvestmentStages(updated);
    setEditingStage(null);
    showNotification('บันทึกขั้นตอนงบลงทุนเรียบร้อยแล้ว');
  };

  const handleDeleteStage = (key: string) => {
    if (stageList.length <= 1) {
      showNotification('ต้องมีขั้นตอนงบลงทุนอย่างน้อย 1 รายการในระบบ');
      return;
    }

    const item = stageList.find((s) => s.key === key);
    const labelText = item?.label || key;

    setConfirmDialog({
      title: 'ยืนยันการลบขั้นตอนงบลงทุน',
      message: `คุณต้องการลบขั้นตอน "${labelText}" ออกจากระบบใช่หรือไม่?`,
      confirmText: 'ลบขั้นตอน',
      isDanger: true,
      onConfirm: () => {
        const updated = stageList.filter((s) => s.key !== key);
        setStageList(updated);
        onSaveInvestmentStages(updated);
        showNotification('ลบขั้นตอนงบลงทุนเรียบร้อยแล้ว');
        setConfirmDialog(null);
      },
    });
  };

  const handleResetInvestmentStages = () => {
    setConfirmDialog({
      title: 'คืนค่าขั้นตอนงบลงทุนเริ่มต้น',
      message: 'ต้องการคืนค่ารายการขั้นตอนงบลงทุนเป็นค่าเริ่มต้นของระบบใช่หรือไม่?',
      confirmText: 'คืนค่าเริ่มต้น',
      isDanger: false,
      onConfirm: () => {
        setStageList(DEFAULT_INVESTMENT_STAGES);
        onSaveInvestmentStages(DEFAULT_INVESTMENT_STAGES);
        showNotification('คืนค่าขั้นตอนงบลงทุนเริ่มต้นเรียบร้อยแล้ว');
        setConfirmDialog(null);
      },
    });
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stageList.length) return;
    const updated = [...stageList];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, movedItem);
    setStageList(updated);
    onSaveInvestmentStages(updated);
    showNotification('จัดลำดับขั้นตอนงบลงทุนเรียบร้อยแล้ว');
  };

  // --- General Settings Handlers ---
  const handleAddFiscalYear = () => {
    const yr = newYearInput.trim();
    if (!yr) return;
    if (!/^\d{4}$/.test(yr)) {
      showNotification('กรุณาระบุปีงบประมาณเป็นตัวเลข 4 หลัก เช่น 2570');
      return;
    }
    const currentYears = generalForm.availableFiscalYears || ['2571', '2570', '2569', '2568'];
    if (currentYears.includes(yr)) {
      showNotification(`ปีงบประมาณ พ.ศ. ${yr} มีอยู่ในรายการแล้ว`);
      return;
    }
    const updated = [...currentYears, yr].sort((a, b) => b.localeCompare(a));
    const nextSettings = {
      ...generalForm,
      availableFiscalYears: updated,
    };
    setGeneralForm(nextSettings);
    setNewYearInput('');
    onSaveSettings(nextSettings);
    showNotification(`เพิ่มปีงบประมาณ พ.ศ. ${yr} เรียบร้อยแล้ว`);
  };

  const handleDeleteFiscalYear = (yr: string) => {
    const currentYears = generalForm.availableFiscalYears || ['2571', '2570', '2569', '2568'];
    if (currentYears.length <= 1) {
      showNotification('ต้องมีปีงบประมาณในระบบอย่างน้อย 1 ปี');
      return;
    }

    setConfirmDialog({
      title: 'ยืนยันการลบปีงบประมาณ',
      message: `คุณต้องการลบปีงบประมาณ "พ.ศ. ${yr}" ออกจากตัวเลือกระบบใช่หรือไม่? (ข้อมูลโครงการเดิมที่บันทึกไว้จะไม่ถูกลบ)`,
      confirmText: 'ลบปีงบประมาณ',
      isDanger: true,
      onConfirm: () => {
        const updated = currentYears.filter((y) => y !== yr);
        let nextDefaultYear = generalForm.fiscalYear;
        if (nextDefaultYear === yr) {
          nextDefaultYear = updated[0] || '2569';
        }
        const nextSettings: SystemSettings = {
          ...generalForm,
          fiscalYear: nextDefaultYear,
          availableFiscalYears: updated,
        };
        setGeneralForm(nextSettings);
        onSaveSettings(nextSettings);
        showNotification(`ลบปีงบประมาณ พ.ศ. ${yr} เรียบร้อยแล้ว`);
        setConfirmDialog(null);
      },
    });
  };

  const handleSelectDefaultFiscalYear = (yr: string) => {
    if (generalForm.fiscalYear === yr) return;
    setConfirmDialog({
      title: 'ยืนยันการเปลี่ยนปีงบประมาณหลัก',
      message: `คุณต้องการเปลี่ยนปีงบประมาณหลักของระบบเป็น "พ.ศ. ${yr}" ใช่หรือไม่? ระบบจะใช้ปีนี้เป็นค่าเริ่มต้นสำหรับแสดงผลภาพรวมและสร้างโครงการใหม่`,
      confirmText: `เปลี่ยนเป็นปี ${yr}`,
      cancelText: 'ยกเลิก',
      isDanger: false,
      onConfirm: () => {
        const nextSettings: SystemSettings = {
          ...generalForm,
          fiscalYear: yr,
        };
        setGeneralForm(nextSettings);
        onSaveSettings(nextSettings);
        showNotification(`เปลี่ยนปีงบประมาณหลักเป็น พ.ศ. ${yr} เรียบร้อยแล้ว`);
        setConfirmDialog(null);
      },
    });
  };

  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotification('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/png');
          const nextForm: SystemSettings = {
            ...generalForm,
            logoType: 'image',
            logoUrl: optimizedDataUrl,
          };
          setGeneralForm(nextForm);
          onSaveSettings(nextForm);
          showNotification('อัปโหลดและเปลี่ยนรูปภาพโลโก้สำเร็จ');
        }
      };
      img.onerror = () => {
        const nextForm: SystemSettings = {
          ...generalForm,
          logoType: 'image',
          logoUrl: rawDataUrl,
        };
        setGeneralForm(nextForm);
        onSaveSettings(nextForm);
        showNotification('อัปโหลดและเปลี่ยนรูปภาพโลโก้สำเร็จ');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSelectLogoIcon = (iconKey: SystemSettings['logoIcon']) => {
    const nextForm: SystemSettings = {
      ...generalForm,
      logoType: 'icon',
      logoIcon: iconKey,
    };
    setGeneralForm(nextForm);
    onSaveSettings(nextForm);
  };

  const handleSelectLogoColor = (hex: string) => {
    const nextForm: SystemSettings = {
      ...generalForm,
      logoColor: hex,
    };
    setGeneralForm(nextForm);
    onSaveSettings(nextForm);
  };

  const handleClearLogo = () => {
    const nextForm: SystemSettings = {
      ...generalForm,
      logoType: 'icon',
      logoUrl: '',
    };
    setGeneralForm(nextForm);
    onSaveSettings(nextForm);
    showNotification('รีเซ็ตโลโก้เป็นไอคอนมาตรฐานเรียบร้อยแล้ว');
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (generalForm.fiscalYear !== settings.fiscalYear) {
      setConfirmDialog({
        title: 'ยืนยันการเปลี่ยนปีงบประมาณหลัก',
        message: `คุณกำลังเปลี่ยนปีงบประมาณหลักจาก "พ.ศ. ${settings.fiscalYear || '2569'}" เป็น "พ.ศ. ${generalForm.fiscalYear}" คุณต้องการบันทึกการเปลี่ยนแปลงนี้ใช่หรือไม่?`,
        confirmText: 'บันทึกการเปลี่ยนแปลง',
        cancelText: 'ยกเลิก',
        isDanger: false,
        onConfirm: () => {
          onSaveSettings(generalForm);
          showNotification('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
          setConfirmDialog(null);
        },
      });
      return;
    }
    onSaveSettings(generalForm);
    showNotification('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
  };

  const COLOR_PALETTES: { key: CustomStatus['colorTheme']; name: string; bgClass: string; textClass: string; badgeClass: string }[] = [
    { key: 'sky', name: 'ฟ้า (Sky)', bgClass: 'bg-sky-50', textClass: 'text-sky-800', badgeClass: 'bg-sky-500' },
    { key: 'amber', name: 'ส้ม/ทอง (Amber)', bgClass: 'bg-amber-50', textClass: 'text-amber-800', badgeClass: 'bg-amber-500' },
    { key: 'emerald', name: 'เขียว (Emerald)', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', badgeClass: 'bg-emerald-500' },
    { key: 'blue', name: 'น้ำเงิน (Blue)', bgClass: 'bg-blue-50', textClass: 'text-blue-800', badgeClass: 'bg-blue-500' },
    { key: 'purple', name: 'ม่วง (Purple)', bgClass: 'bg-purple-50', textClass: 'text-purple-800', badgeClass: 'bg-purple-500' },
    { key: 'rose', name: 'ชมพู/แดง (Rose)', bgClass: 'bg-rose-50', textClass: 'text-rose-800', badgeClass: 'bg-rose-500' },
    { key: 'slate', name: 'เทา (Slate)', bgClass: 'bg-slate-100', textClass: 'text-slate-800', badgeClass: 'bg-slate-500' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 no-print">
      <div
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] sm:h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                ตั้งค่าระบบทั้งหมด
              </h2>
              <p className="text-xs text-slate-400">
                จัดการสถานะโครงการ, ขั้นตอนงบลงทุน, หน่วยงานรับผิดชอบ, และการแสดงผลเว็บไซต์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="ปิดหน้าต่างตั้งค่า"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saved Toast Notification */}
        {saveToast && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between shrink-0 animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{saveToast}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-100/80 border-b border-slate-200 p-2 flex items-center gap-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('statuses')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'statuses'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>1. จัดการสถานะ ({statusList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('investment_stages')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'investment_stages'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <HardHat className="w-4 h-4 text-indigo-600" />
            <span>2. ขั้นตอนงบลงทุน ({stageList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'departments'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>3. จัดการหน่วยงาน ({deptList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('google_sheets')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'google_sheets'
                ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>4. ตั้งค่า Google Sheets</span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'general'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <SettingsIcon className="w-4 h-4 text-indigo-600" />
            <span>5. ตั้งค่าปีงบประมาณ & ทั่วไป</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* TAB 1: STATUSES */}
          {activeTab === 'statuses' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    รายการสถานะโครงการในระบบ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำหนดชื่อสถานะ คำอธิบาย และโทนสีสำหรับแสดงผลในการ์ด KPI สรุปภาพรวม
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetStatuses}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>คืนค่าเริ่มต้น</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingStatus({
                        key: '',
                        label: '',
                        description: '',
                        colorTheme: 'sky',
                        isNew: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มสถานะใหม่</span>
                  </button>
                </div>
              </div>

              {/* Status List Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {statusList.map((st, index) => {
                  const palette =
                    COLOR_PALETTES.find((p) => p.key === st.colorTheme) ||
                    COLOR_PALETTES[0];
                  return (
                    <div
                      key={st.key}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${palette.bgClass} ${palette.textClass}`}
                          >
                            {st.label}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            key: {st.key}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                          {st.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[11px] text-slate-400 font-medium">
                          ธีมสี: {palette.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStatus(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveStatus(index, 'down')}
                            disabled={index === statusList.length - 1}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                            title="เลื่อนลง"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setEditingStatus({
                                key: st.key,
                                label: st.label,
                                description: st.description,
                                colorTheme: st.colorTheme,
                                isNew: false,
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition-colors"
                            title="แก้ไขสถานะ"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStatus(st.key)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors"
                            title="ลบสถานะ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INVESTMENT STAGES */}
          {activeTab === 'investment_stages' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-indigo-600" />
                    <span>รายการขั้นตอนย่อยของงบลงทุน (Investment Stages)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำหนดชื่อขั้นตอน คำอธิบายย่อย และโทนสี สำหรับเลือกบันทึกขั้นตอนและคัดกรองในระบบติดตาม
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetInvestmentStages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>คืนค่าเริ่มต้น</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingStage({
                        key: '',
                        label: '',
                        description: '',
                        colorTheme: 'amber',
                        iconType: 'search',
                        isNew: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มขั้นตอนใหม่</span>
                  </button>
                </div>
              </div>

              {/* Stages Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stageList.map((st, index) => {
                  const palette = COLOR_PALETTES.find((p) => p.key === st.colorTheme) || COLOR_PALETTES[1];
                  return (
                    <div
                      key={st.key}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold">
                              {st.key}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${palette.bgClass} ${palette.textClass}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${palette.badgeClass}`} />
                            {palette.name.split(' ')[0]}
                          </span>
                        </div>

                        <div className="pt-1">
                          <div className="flex items-center gap-2">
                            {st.iconType === 'search' && <Search className="w-4 h-4 text-amber-600 shrink-0" />}
                            {st.iconType === 'file' && <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />}
                            {st.iconType === 'signature' && <FileSignature className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {st.iconType === 'hammer' && <Hammer className="w-4 h-4 text-indigo-600 shrink-0" />}
                            {st.iconType === 'clock' && <Clock className="w-4 h-4 text-sky-600 shrink-0" />}
                            {st.iconType === 'check' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {(!st.iconType || st.iconType === 'layers') && <Layers className="w-4 h-4 text-slate-600 shrink-0" />}
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">
                              {st.label}
                            </h4>
                          </div>
                          {st.description && (
                            <p className="text-xs text-slate-500 mt-1 pl-6 line-clamp-2">
                              {st.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[11px] text-slate-400">
                          ลำดับที่ {index + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveStage(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                            title="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveStage(index, 'down')}
                            disabled={index === stageList.length - 1}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                            title="เลื่อนลง"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setEditingStage({
                                key: st.key,
                                label: st.label,
                                description: st.description,
                                colorTheme: st.colorTheme,
                                iconType: st.iconType || 'search',
                                isNew: false,
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition-colors"
                            title="แก้ไขขั้นตอน"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStage(st.key)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors"
                            title="ลบขั้นตอน"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    รายการหน่วยงานรับผิดชอบในระบบ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    จัดการชื่อย่อ ชื่อเต็มหน่วยงาน และโค้ดสีประจำหน่วยงาน
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetDepartments}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>คืนค่าเริ่มต้น</span>
                  </button>
                  <button
                    onClick={() =>
                      setEditingDept({
                        code: '',
                        fullName: '',
                        color: '#3b82f6',
                        isNew: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มหน่วยงานใหม่</span>
                  </button>
                </div>
              </div>

              {/* Departments Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-3 text-center w-24">จัดลำดับ</th>
                        <th className="py-3 px-4">ชื่อย่อ</th>
                        <th className="py-3 px-4">ชื่อเต็มหน่วยงาน</th>
                        <th className="py-3 px-4 text-center">สีประจำหน่วยงาน</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deptList.map((d, index) => (
                        <tr key={d.code} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => moveDepartment(index, 'up')}
                                disabled={index === 0}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                                title="เลื่อนขึ้น"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveDepartment(index, 'down')}
                                disabled={index === deptList.length - 1}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 disabled:opacity-25 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 transition-colors"
                                title="เลื่อนลง"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-indigo-700">
                            {d.code}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            {d.fullName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <span
                                className="w-5 h-5 rounded-md shadow-xs border border-slate-200 shrink-0"
                                style={{ backgroundColor: d.color }}
                              />
                              <span className="font-mono text-xs text-slate-500">
                                {d.color}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setEditingDept({
                                    code: d.code,
                                    fullName: d.fullName,
                                    color: d.color,
                                    isNew: false,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition-colors"
                                title="แก้ไข"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDepartment(d.code)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors"
                                title="ลบ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GOOGLE SHEETS SETTINGS */}
          {activeTab === 'google_sheets' && (
            <GoogleSheetsSettingsTab
              projects={projects}
              onProjectsUpdated={onProjectsUpdated}
              settingsPayload={settingsPayload}
              onSettingsUpdated={onSettingsUpdated}
              onGoogleSheetConnectedChange={onGoogleSheetConnectedChange}
            />
          )}

          {/* TAB 5: GENERAL & FISCAL YEAR SETTINGS */}
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <form
                onSubmit={handleSaveGeneral}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 text-xs sm:text-sm"
              >
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>ตั้งค่าปีงบประมาณและข้อมูลระบบ</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    กำหนดปีงบประมาณหลักของระบบ ค่าเริ่มต้นเมื่อเพิ่มโครงการใหม่ และหัวข้อรายงานสำหรับผู้บริหาร
                  </p>
                </div>

                {/* Fiscal Year Setting with Management and Quick Switcher */}
                <div className="bg-indigo-50/50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-100/80 pb-3">
                    <div>
                      <label className="block text-xs font-bold text-indigo-950">
                        ปีงบประมาณหลักเริ่มต้น (Default Fiscal Year) <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-indigo-700/90 mt-0.5">
                        ปีที่ระบบใช้แสดงผลเริ่มต้น และใช้ตั้งต้นสำหรับโครงการใหม่ (เช่น 1/{generalForm.fiscalYear || '2569'})
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                      พ.ศ. {generalForm.fiscalYear || '2569'}
                    </span>
                  </div>

                  {/* Add New Fiscal Year Input Bar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      เพิ่มปีงบประมาณใหม่เข้าระบบ
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newYearInput}
                        onChange={(e) => setNewYearInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFiscalYear();
                          }
                        }}
                        placeholder="เช่น 2570, 2571, 2572"
                        className="w-full sm:w-48 px-3.5 py-2 rounded-xl border border-indigo-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-900 text-xs sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddFiscalYear}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่มปีงบ</span>
                      </button>
                    </div>
                  </div>

                  {/* Fiscal Years List Chips with Delete Button & Active Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      รายการปีงบประมาณที่รองรับในระบบ (คลิกเพื่อเลือกเป็นปีหลัก หรือกดปุ่ม ✕ เพื่อลบ)
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(generalForm.availableFiscalYears || ['2571', '2570', '2569', '2568']).map((yr) => {
                        const isSelected = generalForm.fiscalYear === yr;
                        return (
                          <div
                            key={yr}
                            className={`inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-xl border transition-all shadow-2xs ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                : 'bg-white text-slate-700 hover:bg-indigo-50 border-indigo-200 font-medium'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectDefaultFiscalYear(yr)}
                              className="text-xs cursor-pointer focus:outline-none"
                              title={`คลิกเพื่อตั้งค่า พ.ศ. ${yr} เป็นปีเริ่มต้น`}
                            >
                              ปี {yr} {isSelected && '✓ (หลัก)'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFiscalYear(yr)}
                              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                isSelected
                                  ? 'hover:bg-indigo-700 text-white/90 hover:text-white'
                                  : 'hover:bg-rose-100 text-slate-400 hover:text-rose-600'
                              }`}
                              title={`ลบปี ${yr} ออกจากรายการ`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Logo & Branding Customization */}
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <span>โลโก้และตราสัญลักษณ์ของระบบ (System Logo & Icon)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        เลือกใช้ไอคอนระบบหรืออัปโหลดรูปภาพตราสัญลักษณ์หน่วยงานเพื่อแสดงที่แถบหัวข้อระบบ
                      </p>
                    </div>

                    {/* Logo Live Preview */}
                    <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                      <span className="text-[11px] text-slate-400 font-medium">ตัวอย่าง:</span>
                      <div
                        style={{
                          backgroundColor: generalForm.logoType === 'image' && generalForm.logoUrl ? '#ffffff' : (generalForm.logoColor || '#4f46e5'),
                        }}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-2xs border border-slate-200 overflow-hidden shrink-0 p-0.5"
                      >
                        {generalForm.logoType === 'image' && generalForm.logoUrl ? (
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            <img
                              src={generalForm.logoUrl}
                              alt="Logo Preview"
                              referrerPolicy="no-referrer"
                              style={{
                                transform: `scale(${(generalForm.logoScale || 115) / 100})`,
                              }}
                              className={`w-full h-full ${generalForm.logoFit === 'cover' ? 'object-cover' : 'object-contain'} transition-transform duration-200`}
                            />
                          </div>
                        ) : (
                          (() => {
                            const iconProps = { className: 'w-5 h-5 text-white' };
                            switch (generalForm.logoIcon) {
                              case 'landmark': return <Landmark {...iconProps} />;
                              case 'briefcase': return <Briefcase {...iconProps} />;
                              case 'bar-chart': return <BarChart3 {...iconProps} />;
                              case 'coins': return <Coins {...iconProps} />;
                              case 'shield': return <ShieldCheck {...iconProps} />;
                              case 'award': return <Award {...iconProps} />;
                              case 'file-text': return <FileText {...iconProps} />;
                              case 'building':
                              default:
                                return <Building2 {...iconProps} />;
                            }
                          })()
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector: Icon vs Image */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setGeneralForm({ ...generalForm, logoType: 'icon' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        generalForm.logoType !== 'image'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🏛️ ใช้ไอคอนมาตรฐาน
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeneralForm({ ...generalForm, logoType: 'image' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        generalForm.logoType === 'image'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🖼️ อัปโหลดรูปภาพตราสัญลักษณ์
                    </button>
                  </div>

                  {/* Mode 1: Icon Preset Selection */}
                  {generalForm.logoType !== 'image' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          เลือกรูปแบบไอคอน
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: 'building', label: 'อาคาร / สำนักงาน', icon: <Building2 className="w-4 h-4" /> },
                            { key: 'landmark', label: 'ส่วนราชการ / กระทรวง', icon: <Landmark className="w-4 h-4" /> },
                            { key: 'briefcase', label: 'แผนงาน / โครงการ', icon: <Briefcase className="w-4 h-4" /> },
                            { key: 'bar-chart', label: 'งบประมาณ / สถิติ', icon: <BarChart3 className="w-4 h-4" /> },
                            { key: 'coins', label: 'การเงิน / เบิกจ่าย', icon: <Coins className="w-4 h-4" /> },
                            { key: 'shield', label: 'กำกับดูแล / ความมั่นคง', icon: <ShieldCheck className="w-4 h-4" /> },
                            { key: 'award', label: 'ยุทธศาสตร์ / ผลงาน', icon: <Award className="w-4 h-4" /> },
                            { key: 'file-text', label: 'เอกสาร / รายงาน', icon: <FileText className="w-4 h-4" /> },
                          ].map((item) => {
                            const isSelected = (generalForm.logoIcon || 'building') === item.key;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleSelectLogoIcon(item.key as any)}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-2xs ring-2 ring-indigo-200'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className={isSelected ? 'text-indigo-600' : 'text-slate-500'}>
                                  {item.icon}
                                </span>
                                <span className="text-[11px] truncate">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Color Palette Selection */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          เลือกสีพื้นหลังของไอคอน
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[
                            { hex: '#4f46e5', name: 'Indigo (น้ำเงินคราม)' },
                            { hex: '#2563eb', name: 'Blue (น้ำเงินราชการ)' },
                            { hex: '#0891b2', name: 'Cyan (ฟ้าคราม)' },
                            { hex: '#059669', name: 'Emerald (เขียวมรกต)' },
                            { hex: '#84cc16', name: 'Lime (เขียวสดใส)' },
                            { hex: '#d97706', name: 'Amber (ทอง/อำพัน)' },
                            { hex: '#ea580c', name: 'Orange (ส้มอิฐ)' },
                            { hex: '#e11d48', name: 'Rose (แดงกุหลาบ)' },
                            { hex: '#7c3aed', name: 'Violet (ม่วงเข้ม)' },
                            { hex: '#334155', name: 'Slate (เทาเข้ม)' },
                          ].map((color) => {
                            const isSelected = (generalForm.logoColor || '#4f46e5') === color.hex;
                            return (
                              <button
                                key={color.hex}
                                type="button"
                                onClick={() => handleSelectLogoColor(color.hex)}
                                title={color.name}
                                style={{ backgroundColor: color.hex }}
                                className={`w-7 h-7 rounded-lg transition-transform cursor-pointer flex items-center justify-center text-white ${
                                  isSelected ? 'scale-115 ring-2 ring-offset-2 ring-indigo-500 shadow-sm' : 'hover:scale-105 opacity-90'
                                }`}
                              >
                                {isSelected && <Check className="w-4 h-4 drop-shadow-xs" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Custom Image Logo Upload & URL */}
                  {generalForm.logoType === 'image' && (
                    <div className="space-y-3 pt-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />

                      {/* Dropzone & Upload Action */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            คลิกเพื่อเลือกไฟล์รูปภาพ หรือลากไฟล์มาวางที่นี่
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            รองรับไฟล์ PNG, JPG, SVG หรือ WebP (แนะนำรูปพื้นหลังโปร่งใส ขนาดไม่เกิน 2MB)
                          </p>
                        </div>
                      </div>

                      {/* Image URL Input as Alternative */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          หรือระบุลิงก์รูปภาพโลโก้ (Image URL)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={generalForm.logoUrl || ''}
                            onChange={(e) =>
                              setGeneralForm({
                                ...generalForm,
                                logoType: 'image',
                                logoUrl: e.target.value,
                              })
                            }
                            placeholder="https://example.com/logo.png"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono text-xs text-slate-800"
                          />
                          {generalForm.logoUrl && (
                            <button
                              type="button"
                              onClick={handleClearLogo}
                              className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer shrink-0"
                            >
                              ล้างรูป
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scale & Fit Controls when Logo Image is present */}
                      {generalForm.logoUrl && (
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800">
                              🔍 ปรับขนาดรูปภาพตราสัญลักษณ์ให้ใหญ่เต็มกรอบ (Scale: {generalForm.logoScale || 115}%)
                            </label>
                            <div className="flex items-center gap-1">
                              {[100, 120, 140, 160, 180].map((scale) => (
                                <button
                                  key={scale}
                                  type="button"
                                  onClick={() => {
                                    const nextForm = { ...generalForm, logoScale: scale };
                                    setGeneralForm(nextForm);
                                    onSaveSettings(nextForm);
                                  }}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                                    (generalForm.logoScale || 115) === scale
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {scale}%
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="range"
                            min="80"
                            max="220"
                            step="5"
                            value={generalForm.logoScale || 115}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const nextForm = { ...generalForm, logoScale: val };
                              setGeneralForm(nextForm);
                              onSaveSettings(nextForm);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 font-medium">รูปแบบการจัดวาง (Fit Style):</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextForm = { ...generalForm, logoFit: 'contain' as const };
                                  setGeneralForm(nextForm);
                                  onSaveSettings(nextForm);
                                }}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                  (generalForm.logoFit || 'contain') === 'contain'
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                พอดีกรอบ (Contain)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextForm = { ...generalForm, logoFit: 'cover' as const };
                                  setGeneralForm(nextForm);
                                  onSaveSettings(nextForm);
                                }}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                  generalForm.logoFit === 'cover'
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                เต็มพื้นที่ (Cover)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อหัวข้อรายงานหลัก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={generalForm.appTitle}
                    onChange={(e) =>
                      setGeneralForm({ ...generalForm, appTitle: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ข้อความย่อยส่วนย่อ
                  </label>
                  <input
                    type="text"
                    value={generalForm.appSubtitle}
                    onChange={(e) =>
                      setGeneralForm({ ...generalForm, appSubtitle: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-medium text-slate-800"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกการตั้งค่าปีงบประมาณและระบบ</span>
                  </button>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>พื้นที่เสี่ยง (Danger Zone)</span>
                </div>
                <p className="text-xs text-rose-700">
                  ลบข้อมูลการแก้ไขโครงการทั้งหมด และรีเซ็ตกลับเป็นข้อมูลตัวอย่างเริ่มต้นของระบบ ({projectsCount} รายการ)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDialog({
                      title: 'ยืนยันการรีเซ็ตข้อมูลทั้งหมด',
                      message: 'คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตข้อมูลโครงการ การตั้งค่า และส่วนทั้งหมดกลับเป็นค่าโรงงานเริ่มต้น?',
                      confirmText: 'รีเซ็ตข้อมูลทั้งหมด',
                      isDanger: true,
                      onConfirm: () => {
                        onResetAllData();
                        showNotification('รีเซ็ตข้อมูลทั้งหมดเรียบร้อยแล้ว');
                        setConfirmDialog(null);
                      },
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>รีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าโรงงาน</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>การเปลี่ยนแปลงจะถูกบันทึกในเบราว์เซอร์อัตโนมัติ</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Submodal: Edit/Add Department */}
      {editingDept && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                {editingDept.isNew ? 'เพิ่มหน่วยงานใหม่' : `แก้ไขหน่วยงาน: ${editingDept.code}`}
              </h4>
              <button
                onClick={() => setEditingDept(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อย่อหน่วยงาน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={!editingDept.isNew}
                value={editingDept.code}
                onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value })}
                placeholder="เช่น อส., คพ., กทม."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-indigo-700 disabled:bg-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อเต็มหน่วยงาน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editingDept.fullName}
                onChange={(e) => setEditingDept({ ...editingDept, fullName: e.target.value })}
                placeholder="เช่น กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                สีประจำหน่วยงาน
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={editingDept.color}
                  onChange={(e) => setEditingDept({ ...editingDept, color: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 p-0.5"
                />
                <input
                  type="text"
                  value={editingDept.color}
                  onChange={(e) => setEditingDept({ ...editingDept, color: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleSaveDepartmentItem(editingDept)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submodal: Edit/Add Status */}
      {editingStatus && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900">
                {editingStatus.isNew ? 'เพิ่มสถานะใหม่' : `แก้ไขสถานะ`}
              </h4>
              <button
                onClick={() => setEditingStatus(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingStatus.isNew && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัสอ้างอิงสถานะ (Key) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingStatus.key}
                  onChange={(e) => setEditingStatus({ ...editingStatus, key: e.target.value })}
                  placeholder="เช่น custom_review"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อสถานะที่แสดง <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editingStatus.label}
                onChange={(e) => setEditingStatus({ ...editingStatus, label: e.target.value })}
                placeholder="เช่น อยู่ระหว่างพิจารณา (สงป.)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                คำอธิบายย่อ
              </label>
              <input
                type="text"
                value={editingStatus.description}
                onChange={(e) => setEditingStatus({ ...editingStatus, description: e.target.value })}
                placeholder="เช่น ส่งเรื่องเสนอ สงป. แล้ว"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เลือกธีมสี
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PALETTES.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setEditingStatus({ ...editingStatus, colorTheme: p.key })}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                      editingStatus.colorTheme === p.key
                        ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${p.badgeClass}`} />
                    <span className="text-slate-700 text-[11px] truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStatus(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleSaveStatusItem(editingStatus)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Investment Stage Modal */}
      {editingStage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <HardHat className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">
                  {editingStage.isNew ? 'เพิ่มขั้นตอนงบลงทุนใหม่' : `แก้ไขขั้นตอนงบลงทุน`}
                </h4>
              </div>
              <button
                onClick={() => setEditingStage(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingStage.isNew && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัสอ้างอิงขั้นตอน (Key) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingStage.key}
                  onChange={(e) => setEditingStage({ ...editingStage, key: e.target.value })}
                  placeholder="เช่น procuring, bidding, signed, inspection"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">ใช้ตัวอักษรภาษาอังกฤษพิมพ์เล็กและเครื่องหมาย _ เท่านั้น</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ชื่อขั้นตอนที่แสดง <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editingStage.label}
                onChange={(e) => setEditingStage({ ...editingStage, label: e.target.value })}
                placeholder="เช่น หาผู้รับจ้าง, ประกวดราคา, ลงนามในสัญญา"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                คำอธิบายย่อยของขั้นตอน
              </label>
              <input
                type="text"
                value={editingStage.description}
                onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                placeholder="เช่น จัดทำร่าง TOR / สืบราคากลาง"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เลือกไอคอน
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: 'search', label: 'ค้นหา/TOR', icon: Search },
                  { type: 'file', label: 'ประกวดราคา', icon: FileSpreadsheet },
                  { type: 'signature', label: 'ลงนามสัญญา', icon: FileSignature },
                  { type: 'hammer', label: 'ดำเนินการ', icon: Hammer },
                  { type: 'clock', label: 'ตรวจรับงาน', icon: Clock },
                  { type: 'check', label: 'เสร็จสมบูรณ์', icon: Check },
                  { type: 'layers', label: 'ขั้นตอนอื่นๆ', icon: Layers },
                ].map((ic) => {
                  const IconComp = ic.icon;
                  const isSelected = (editingStage.iconType || 'search') === ic.type;
                  return (
                    <button
                      key={ic.type}
                      type="button"
                      onClick={() => setEditingStage({ ...editingStage, iconType: ic.type as any })}
                      className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-600 ring-2 ring-amber-100 bg-amber-50/50 text-amber-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <IconComp className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-slate-500'}`} />
                      <span className="text-[10px] truncate max-w-full">{ic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                เลือกธีมสี
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PALETTES.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setEditingStage({ ...editingStage, colorTheme: p.key })}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      editingStage.colorTheme === p.key
                        ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${p.badgeClass}`} />
                    <span className="text-slate-700 text-[11px] truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleSaveStageItem(editingStage)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer"
              >
                บันทึกขั้นตอน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              {confirmDialog.isDanger ? (
                <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <Info className="w-5 h-5" />
                </div>
              )}
              <h3>{confirmDialog.title}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {confirmDialog.cancelText || 'ยกเลิก'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors shadow-2xs cursor-pointer ${
                  confirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmDialog.confirmText || 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
