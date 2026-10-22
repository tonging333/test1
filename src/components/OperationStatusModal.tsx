import React, { useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, PlusCircle, Edit3, Trash2, Save, RefreshCw, Sliders } from 'lucide-react';

export type OperationType = 'add' | 'edit' | 'delete' | 'disbursement' | 'settings' | 'sync' | 'reset' | 'general';
export type OperationStatus = 'loading' | 'success' | 'error';

export interface OperationModalState {
  isOpen: boolean;
  status: OperationStatus;
  title: string;
  description?: string;
  type?: OperationType;
  autoCloseDelay?: number; // ms to auto close on success (default: 1200)
}

interface OperationStatusModalProps {
  state: OperationModalState;
  onClose: () => void;
}

export const OperationStatusModal: React.FC<OperationStatusModalProps> = ({ state, onClose }) => {
  const { isOpen, status, title, description, type = 'general', autoCloseDelay = 1200 } = state;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && status === 'success') {
      timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, status, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  // Icon selector based on type & status
  const getHeaderIcon = () => {
    if (status === 'loading') {
      return (
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
            {type === 'add' && <PlusCircle className="w-6 h-6 animate-pulse" />}
            {type === 'edit' && <Edit3 className="w-6 h-6 animate-pulse" />}
            {type === 'delete' && <Trash2 className="w-6 h-6 animate-pulse text-rose-500" />}
            {type === 'disbursement' && <Save className="w-6 h-6 animate-pulse text-emerald-600" />}
            {type === 'settings' && <Sliders className="w-6 h-6 animate-pulse text-indigo-600" />}
            {type === 'sync' && <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />}
            {type === 'reset' && <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />}
            {type === 'general' && <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />}
          </div>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-200 flex items-center justify-center text-emerald-600 animate-in zoom-in-75 duration-300 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
        </div>
      );
    }

    return (
      <div className="w-16 h-16 rounded-full bg-rose-100 border-4 border-rose-200 flex items-center justify-center text-rose-600 animate-in zoom-in-75 duration-300 shadow-lg shadow-rose-500/10">
        <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
      </div>
    );
  };

  const getThemeColor = () => {
    if (status === 'success') return 'text-emerald-700';
    if (status === 'error') return 'text-rose-700';
    if (type === 'delete') return 'text-rose-600';
    return 'text-slate-800';
  };

  return (
    <div
      id="operation-status-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 no-print"
      style={{ pointerEvents: status === 'loading' ? 'all' : 'auto' }}
    >
      <div
        id="operation-status-modal-card"
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 p-6 flex flex-col items-center text-center transform transition-all animate-in zoom-in-95 duration-200 relative overflow-hidden"
      >
        {/* Top animated colored bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-300 ${
            status === 'loading'
              ? 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 animate-pulse'
              : status === 'success'
              ? 'bg-emerald-500'
              : 'bg-rose-500'
          }`}
        />

        {/* Icon */}
        <div className="mb-4 mt-2">{getHeaderIcon()}</div>

        {/* Title */}
        <h3 className={`text-base font-bold mb-1.5 transition-colors ${getThemeColor()}`}>
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-500 leading-relaxed max-w-[280px]">
            {description}
          </p>
        )}

        {/* Progress hint during loading */}
        {status === 'loading' && (
          <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
            <span>กรุณารอสักครู่ กำลังประมวลผลข้อมูล...</span>
          </div>
        )}

        {/* Success badge */}
        {status === 'success' && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full animate-in fade-in slide-in-from-bottom-1">
            <span>ดำเนินการเสร็จสมบูรณ์</span>
          </div>
        )}

        {/* Close Button for Error */}
        {status === 'error' && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        )}
      </div>
    </div>
  );
};
