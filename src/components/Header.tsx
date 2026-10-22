import React from 'react';
import { 
  Building2, 
  Landmark, 
  Briefcase, 
  BarChart3, 
  Coins, 
  ShieldCheck, 
  Award, 
  FileText, 
  RotateCcw, 
  Sparkles, 
  Sliders, 
  LayoutDashboard, 
  TrendingUp, 
  Calendar 
} from 'lucide-react';
import { SystemSettings, ActiveTab } from '../types';

interface HeaderProps {
  useCompactUnit: boolean;
  setUseCompactUnit: (value: boolean) => void;
  onResetFilters: () => void;
  onPrint?: () => void;
  onOpenSettings: (tab?: 'statuses' | 'investment_stages' | 'departments' | 'google_sheets' | 'general') => void;
  onOpenGoogleSheets?: () => void;
  totalProjectsCount: number;
  filteredProjectsCount: number;
  systemSettings: SystemSettings;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  approvedProjectsCount: number;
  isGoogleSheetConnected?: boolean;
  onQuickSync?: () => void;
  isSyncing?: boolean;
  selectedFiscalYear?: string;
  onSelectFiscalYear?: (year: string) => void;
  availableFiscalYears?: string[];
}

export const Header: React.FC<HeaderProps> = React.memo(({
  useCompactUnit,
  setUseCompactUnit,
  onResetFilters,
  onPrint,
  onOpenSettings,
  onOpenGoogleSheets,
  totalProjectsCount,
  filteredProjectsCount,
  systemSettings,
  activeTab,
  setActiveTab,
  approvedProjectsCount,
  isGoogleSheetConnected = false,
  onQuickSync,
  isSyncing = false,
  selectedFiscalYear,
  onSelectFiscalYear,
  availableFiscalYears = ['2570', '2569', '2568'],
}) => {
  const currentYear = selectedFiscalYear || systemSettings.fiscalYear || '2569';

  // Helper to render configured logo icon
  const renderLogoIcon = () => {
    const iconProps = { className: 'w-7 h-7 sm:w-8 sm:h-8' };
    switch (systemSettings.logoIcon) {
      case 'landmark':
        return <Landmark {...iconProps} />;
      case 'briefcase':
        return <Briefcase {...iconProps} />;
      case 'bar-chart':
        return <BarChart3 {...iconProps} />;
      case 'coins':
        return <Coins {...iconProps} />;
      case 'shield':
        return <ShieldCheck {...iconProps} />;
      case 'award':
        return <Award {...iconProps} />;
      case 'file-text':
        return <FileText {...iconProps} />;
      case 'building':
      default:
        return <Building2 {...iconProps} />;
    }
  };

  return (
    <header id="app-header" className="bg-white text-slate-800 shadow-xs border-b border-slate-200 sticky top-0 z-30 transition-all">
      <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5 min-w-0">
            {(() => {
              const hasCustomImage = (systemSettings.logoType === 'image' || (!systemSettings.logoType && Boolean(systemSettings.logoUrl))) && Boolean(systemSettings.logoUrl);
              const scale = (systemSettings.logoScale || 135) / 100;
              const fitMode = systemSettings.logoFit === 'cover' ? 'object-cover' : 'object-contain';
              
              return (
                <div
                  style={{
                    backgroundColor: hasCustomImage ? 'transparent' : (systemSettings.logoColor || '#4f46e5'),
                  }}
                  className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center font-bold shrink-0 select-none ${
                    hasCustomImage ? 'bg-transparent border-0 shadow-none p-0' : 'rounded-2xl shadow-xs border border-slate-200/90 p-1 text-white'
                  }`}
                >
                  {hasCustomImage ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <img
                        src={systemSettings.logoUrl}
                        alt="System Logo"
                        referrerPolicy="no-referrer"
                        style={{
                          transform: `scale(${scale})`,
                        }}
                        className={`w-full h-full ${fitMode} transition-transform duration-200`}
                      />
                    </div>
                  ) : (
                    <div 
                      className="w-full h-full rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: systemSettings.logoColor || '#4f46e5' }}
                    >
                      {renderLogoIcon()}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 rounded-lg px-2 py-0.5 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-indigo-900 shrink-0">
                    ปีงบประมาณ
                  </span>
                  {onSelectFiscalYear ? (
                    <select
                      id="header-fiscal-year-select"
                      value={currentYear}
                      onChange={(e) => onSelectFiscalYear(e.target.value)}
                      className="bg-white text-indigo-800 font-bold text-xs rounded-md px-1.5 py-0.5 border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                      title="เลือกปีงบประมาณเพื่อกรองข้อมูลทั้งระบบ"
                    >
                      {availableFiscalYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr === 'all' ? 'ทุกปีงบประมาณ (ทั้งหมด)' : `พ.ศ. ${yr}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-bold text-indigo-700">
                      พ.ศ. {systemSettings.fiscalYear || '2569'}
                    </span>
                  )}
                </div>

                {currentYear !== 'all' && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    แสดงเฉพาะปี {currentYear}
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-slate-900 mt-1 truncate">
                {systemSettings.appTitle || 'สรุปภาพรวมงบประมาณและสถานะโครงการ (งบกลาง)'}
              </h1>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-1.5 sm:gap-2 shrink-0">
            
            {/* Unit Toggle Button */}
            <div className="inline-flex items-center p-0.5 sm:p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                id="unit-full-btn"
                onClick={() => setUseCompactUnit(false)}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition-all font-semibold ${
                  !useCompactUnit
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                บาท
              </button>
              <button
                id="unit-compact-btn"
                onClick={() => setUseCompactUnit(true)}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition-all font-semibold ${
                  useCompactUnit
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ล้านบาท
              </button>
            </div>

            {/* Reset Filters */}
            {activeTab === 'overview' && filteredProjectsCount < totalProjectsCount && (
              <button
                id="reset-filters-btn"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง ({filteredProjectsCount}/{totalProjectsCount})</span>
              </button>
            )}

            {/* Quick Sync Button */}
            {onQuickSync && (
              <button
                id="quick-sync-btn"
                type="button"
                onClick={onQuickSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 cursor-pointer"
                title="กดเพื่อซิงค์ข้อมูลกับ Google Sheet ทันที"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ด่วน'}</span>
                {isGoogleSheetConnected && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900 ml-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Live
                  </span>
                )}
              </button>
            )}

            {/* Settings Button */}
            <button
              id="settings-btn"
              onClick={() => onOpenSettings('statuses')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 no-print"
              title="ตั้งค่าสถานะ หน่วยงาน และระบบ"
            >
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>ตั้งค่าระบบ</span>
            </button>
          </div>

        </div>

        {/* View Navigation Tabs */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 no-print">
          <button
            id="tab-overview-btn"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>ภาพรวมงบประมาณ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'overview'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalProjectsCount}
            </span>
          </button>

          <button
            id="tab-tracking-btn"
            onClick={() => setActiveTab('tracking')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
              activeTab === 'tracking'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>ติดตามโครงการ</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                activeTab === 'tracking'
                  ? 'bg-emerald-400 text-slate-900 shadow-2xs'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              สงป. อนุมัติ ({approvedProjectsCount})
            </span>
          </button>
        </div>

      </div>
    </header>
  );
});

