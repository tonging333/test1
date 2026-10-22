import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ArrowLeftRight } from 'lucide-react';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'pulled_update' | 'error';

interface SyncToastProps {
  status: SyncState;
  message?: string;
  lastSyncedTime?: string | null;
  onQuickSync?: () => void;
}

export const SyncToast: React.FC<SyncToastProps> = ({
  status,
  message,
  lastSyncedTime,
  onQuickSync,
}) => {
  if (status === 'idle') return null;

  return (
    <div
      id="live-sync-toast"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 no-print"
      style={{
        backgroundColor:
          status === 'syncing'
            ? 'rgba(238, 242, 255, 0.95)'
            : status === 'pulled_update' || status === 'synced'
            ? 'rgba(236, 253, 245, 0.95)'
            : 'rgba(254, 242, 242, 0.95)',
        borderColor:
          status === 'syncing'
            ? '#c7d2fe'
            : status === 'pulled_update' || status === 'synced'
            ? '#a7f3d0'
            : '#fecaca',
        color:
          status === 'syncing'
            ? '#3730a3'
            : status === 'pulled_update' || status === 'synced'
            ? '#065f46'
            : '#991b1b',
      }}
    >
      <div className="flex items-center gap-2">
        {status === 'syncing' && (
          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
        )}
        {(status === 'synced' || status === 'pulled_update') && (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        )}
        {status === 'error' && (
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
        )}

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-bold">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>
              {message ||
                (status === 'syncing'
                  ? 'กำลังซิงค์ข้อมูลทั้งสองฝั่ง (Real-Time Live Sync)...'
                  : status === 'pulled_update'
                  ? 'ตรวจพบการแก้ไขใน Google Sheet — ซิงค์เข้าเว็บทันที'
                  : 'ข้อมูลบนเว็บและ Google Sheet ตรงกันแล้ว')}
            </span>
          </div>
          {lastSyncedTime && (
            <span className="text-[10px] opacity-75 font-normal">
              อัปเดตเมื่อ: {lastSyncedTime}
            </span>
          )}
        </div>
      </div>

      {onQuickSync && status !== 'syncing' && (
        <button
          type="button"
          onClick={onQuickSync}
          className="ml-2 px-2 py-1 rounded-md text-[11px] font-bold bg-white/80 hover:bg-white shadow-2xs border border-current/20 transition-colors"
        >
          ซิงค์ตอนนี้
        </button>
      )}
    </div>
  );
};
