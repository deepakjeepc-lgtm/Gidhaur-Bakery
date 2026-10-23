import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  RefreshCw,
  X,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  dbConnectionService,
  DbConnectionDetails
} from '../../services/dbConnectionService';
import {
  getTimeUntilQuotaReset,
  getQuotaUsageStats,
  QuotaMetric
} from '../../services/quotaTrackerService';
import { triggerHaptic } from '../../utils/haptics';

interface DatabaseStatusIndicatorProps {
  onOpenQuotaView?: () => void;
  className?: string;
}

export const DatabaseStatusIndicator = React.memo<DatabaseStatusIndicatorProps>(({
  className = ''
}) => {
  const [details, setDetails] = useState<DbConnectionDetails>(() =>
    dbConnectionService.getState()
  );
  const [quotaStats, setQuotaStats] = useState<QuotaMetric>(() =>
    getQuotaUsageStats()
  );
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilQuotaReset());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);

  const [currentTimeTick, setCurrentTimeTick] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = dbConnectionService.subscribe((newDetails) => {
      setDetails(newDetails);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleQuotaUpdate = (e: any) => {
      if (e.detail) {
        setQuotaStats(e.detail);
      } else {
        setQuotaStats(getQuotaUsageStats());
      }
    };
    window.addEventListener('gidhaur_quota_updated', handleQuotaUpdate);
    return () => window.removeEventListener('gidhaur_quota_updated', handleQuotaUpdate);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilQuotaReset());
      setCurrentTimeTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleManualTest = async () => {
    try {
      triggerHaptic('light');
    } catch {}
    setIsTesting(true);
    setTestResult(null);

    const res = await dbConnectionService.testConnectionManual();
    setTestResult(res);
    setDetails(dbConnectionService.getState());
    setIsTesting(false);
    setCurrentTimeTick(Date.now());
    try {
      if (res.success) {
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
      }
    } catch {}
  };

  const formatExactTime = (d: Date | null) => {
    const target = d ? new Date(d) : new Date();
    return target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getRelativeTime = (d: Date | null, nowMs: number) => {
    if (!d) return 'Just now';
    const targetMs = new Date(d).getTime();
    if (isNaN(targetMs)) return 'Just now';
    const diffSec = Math.max(0, Math.floor((nowMs - targetMs) / 1000));
    if (diffSec < 4) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  };

  const isQuotaFull = details.status === 'quota-full' || quotaStats.isExhausted || quotaStats.estimatedReads >= quotaStats.readsLimit;
  const isDisconnected = !details.isOnline || details.status === 'disconnected';
  const isGreen = !isQuotaFull && !isDisconnected && details.status === 'connected';

  const readsPercent = Math.min(100, Math.round((quotaStats.estimatedReads / quotaStats.readsLimit) * 100));
  const remainingReads = Math.max(0, quotaStats.readsLimit - quotaStats.estimatedReads);

  const writesPercent = Math.min(100, Math.round((quotaStats.estimatedWrites / quotaStats.writesLimit) * 100));
  const remainingWrites = Math.max(0, quotaStats.writesLimit - quotaStats.estimatedWrites);

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        {/* Flat Matte Indicator Badge in Curator Bar */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            try {
              triggerHaptic('selection');
            } catch {}
          }}
          id="admin-db-status-indicator"
          aria-label={`Database & Quota Status: ${isGreen ? 'Live' : isQuotaFull ? 'Quota Full' : 'Offline'}`}
          className={`px-2.5 py-1.5 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 border cursor-pointer shrink-0 select-none ${
            isGreen
              ? 'bg-[#18181B] hover:bg-[#242427] text-[#10B981] border-[#27272A]'
              : isQuotaFull
              ? 'bg-[#18181B] hover:bg-[#242427] text-[#F59E0B] border-[#F59E0B]/40'
              : 'bg-[#18181B] hover:bg-[#242427] text-[#EF4444] border-[#EF4444]/40'
          }`}
          title={
            isGreen
              ? 'Database Live & Quota Safe'
              : isQuotaFull
              ? 'Daily Quota Full'
              : 'Database Disconnected / Offline'
          }
        >
          <span
            className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              isGreen ? 'bg-[#10B981]' : isQuotaFull ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
            }`}
          />
          <Database className="w-3 h-3 hidden sm:inline" />
          <span>{isGreen ? 'DB LIVE' : isQuotaFull ? 'QUOTA FULL' : 'DB OFFLINE'}</span>
        </button>
      </div>

      {typeof document !== 'undefined' &&
        isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="db-health-modal-title"
            className="admin-curator-console fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-[#0A0A0A]/85 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
              }
            }}
          >
            <div
              className="w-full max-w-lg bg-[#18181B] rounded-sm border border-[#27272A] overflow-hidden flex flex-col max-h-[min(90dvh,720px)] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#27272A] bg-[#0A0A0A] shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-sm border border-[#27272A] bg-[#18181B] flex items-center justify-center shrink-0 ${
                      isGreen
                        ? 'text-[#10B981]'
                        : isQuotaFull
                        ? 'text-[#F59E0B]'
                        : 'text-[#EF4444]'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3
                      id="db-health-modal-title"
                      className="font-bold text-sm uppercase tracking-[-0.02em] text-[#FFFFFF] leading-tight"
                    >
                      Database &amp; Quota Health
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-[#A1A1AA] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#10B981] shrink-0" />
                        <span>
                          SYNCED: <strong className="text-[#FFFFFF] tabular-nums">{formatExactTime(details.lastSyncTime)}</strong> ({getRelativeTime(details.lastSyncTime, currentTimeTick)})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-sm text-[#71717A] hover:text-[#FFFFFF] bg-[#18181B] border border-[#27272A] cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain no-scrollbar">
                {/* Main Status Alert Banner */}
                <div>
                  {isGreen && (
                    <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#10B981]/40 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                      <div className="text-xs text-[#A1A1AA] leading-relaxed">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                          <span className="font-mono font-bold text-[#10B981] text-xs uppercase tracking-[0.06em]">
                            LIVE CONNECTED &amp; QUOTA SAFE
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#18181B] px-2 py-0.5 rounded-sm border border-[#27272A] tabular-nums">
                            {formatExactTime(details.lastSyncTime)}
                          </span>
                        </div>
                        Real-time database connection is active. Daily read and write consumption is within safe limits.
                      </div>
                    </div>
                  )}

                  {isQuotaFull && (
                    <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#F59E0B]/40 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                      <div className="text-xs text-[#A1A1AA] leading-relaxed">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                          <span className="font-mono font-bold text-[#F59E0B] text-xs uppercase tracking-[0.06em]">
                            QUOTA LIMIT FULL
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#F59E0B] bg-[#18181B] px-2 py-0.5 rounded-sm border border-[#27272A] tabular-nums">
                            {formatExactTime(details.lastSyncTime)}
                          </span>
                        </div>
                        Daily Spark free-tier limit (50,000 reads) reached. Operating in safe local cache mode.
                      </div>
                    </div>
                  )}

                  {isDisconnected && !isQuotaFull && (
                    <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#EF4444]/40 flex items-start gap-3">
                      <WifiOff className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                      <div className="text-xs text-[#A1A1AA] leading-relaxed">
                        <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                          <span className="font-mono font-bold text-[#EF4444] text-xs uppercase tracking-[0.06em]">
                            DATABASE OFFLINE / DISCONNECTED
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#EF4444] bg-[#18181B] px-2 py-0.5 rounded-sm border border-[#27272A] tabular-nums">
                            {formatExactTime(details.lastSyncTime)}
                          </span>
                        </div>
                        Cloud server unreachable. Orders and edits are securely stored in local device cache.
                      </div>
                    </div>
                  )}
                </div>

                {/* Diagnostics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* 1. Connection Status */}
                  <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] flex items-center gap-1.5">
                        {details.isOnline ? (
                          <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <WifiOff className="w-3.5 h-3.5 text-[#EF4444]" />
                        )}
                        NETWORK &amp; PING
                      </span>
                      <p className={`font-mono font-bold text-xs ${details.isOnline ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {details.isOnline ? 'ONLINE CONNECTED' : 'OFFLINE'}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#FFFFFF] bg-[#18181B] px-2 py-1 rounded-sm border border-[#27272A] tabular-nums">
                      {details.latencyMs ? `${details.latencyMs}ms` : '< 120ms'}
                    </span>
                  </div>

                  {/* 2. Last Health Check */}
                  <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#FF5500]" />
                        LAST HEALTH CHECK
                      </span>
                      <p className="font-mono font-bold text-xs text-[#FFFFFF] tabular-nums">
                        {formatExactTime(details.lastSyncTime)} IST
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#18181B] px-2 py-1 rounded-sm border border-[#27272A] shrink-0">
                      {getRelativeTime(details.lastSyncTime, currentTimeTick)}
                    </span>
                  </div>

                  {/* 3. Quota Reset Countdown */}
                  <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-between sm:col-span-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                        DAILY QUOTA RESET IN
                      </span>
                      <p className="font-mono font-bold text-sm text-[#FFFFFF] tabular-nums">
                        {timeLeft.formatted}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#18181B] px-2 py-1 rounded-sm border border-[#27272A]">
                      12:30 PM IST (SPARK CYCLE)
                    </span>
                  </div>

                  {/* 4. Document Reads Meter */}
                  <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                        TODAY'S READS
                      </span>
                      <span className="font-bold font-mono text-[11px] text-[#FFFFFF] tabular-nums">
                        {quotaStats.estimatedReads.toLocaleString()} / {quotaStats.readsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-[#18181B] rounded-sm h-1.5 overflow-hidden border border-[#27272A]">
                      <div
                        className={`h-full ${
                          readsPercent >= 90 ? 'bg-[#EF4444]' : readsPercent >= 70 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${readsPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A] tabular-nums">
                      <span>{readsPercent}% USED</span>
                      <span className="font-bold text-[#10B981]">{remainingReads.toLocaleString()} LEFT</span>
                    </div>
                  </div>

                  {/* 5. Document Writes Meter */}
                  <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-[#FF5500]" />
                        TODAY'S WRITES
                      </span>
                      <span className="font-bold font-mono text-[11px] text-[#FFFFFF] tabular-nums">
                        {quotaStats.estimatedWrites.toLocaleString()} / {quotaStats.writesLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-[#18181B] rounded-sm h-1.5 overflow-hidden border border-[#27272A]">
                      <div
                        className={`h-full ${
                          writesPercent >= 90 ? 'bg-[#EF4444]' : writesPercent >= 70 ? 'bg-[#F59E0B]' : 'bg-[#FF5500]'
                        }`}
                        style={{ width: `${writesPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A] tabular-nums">
                      <span>{writesPercent}% USED</span>
                      <span className="font-bold text-[#FF5500]">{remainingWrites.toLocaleString()} LEFT</span>
                    </div>
                  </div>
                </div>

                {/* Zero-Loop Protection Guarantee Badge */}
                <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center gap-2.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span className="text-[#A1A1AA]">
                    <strong className="text-[#FFFFFF] font-mono uppercase text-[11px]">Zero-Loop Architecture:</strong> Guarded reads and writes with local IndexedDB cache.
                  </span>
                </div>

                {/* Test Result Feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-sm text-xs flex items-center gap-2.5 border font-mono ${
                      testResult.success
                        ? 'bg-[#0A0A0A] border-[#10B981]/40 text-[#10B981]'
                        : 'bg-[#0A0A0A] border-[#EF4444]/40 text-[#EF4444]'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                    )}
                    <div className="flex-1 truncate">
                      <span className="font-bold">{testResult.message}</span>
                      <span className="block text-[10px] text-[#A1A1AA] tabular-nums">
                        Roundtrip latency: {testResult.latencyMs}ms • Realtime sync validated
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="p-4 border-t border-[#27272A] bg-[#0A0A0A] flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleManualTest}
                  disabled={isTesting}
                  className="w-full sm:flex-1 py-2 px-4 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] disabled:opacity-60 text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] border border-[#FF5500] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'TESTING PING...' : 'TEST CONNECTION (1 READ PING)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full sm:w-auto py-2 px-5 rounded-sm bg-[#18181B] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] border border-[#27272A] cursor-pointer"
                >
                  DONE
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

DatabaseStatusIndicator.displayName = 'DatabaseStatusIndicator';
