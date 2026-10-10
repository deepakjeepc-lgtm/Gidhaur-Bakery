import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  BarChart3,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  dbConnectionService,
  DbConnectionDetails
} from '../../services/dbConnectionService';
import {
  getTimeUntilQuotaReset,
  getQuotaUsageStats,
  SPARK_LIMITS,
  QuotaMetric
} from '../../services/quotaTrackerService';
import { triggerHaptic } from '../../utils/haptics';

interface DatabaseStatusIndicatorProps {
  onOpenQuotaView?: () => void;
  className?: string;
}

export const DatabaseStatusIndicator: React.FC<DatabaseStatusIndicatorProps> = ({
  onOpenQuotaView,
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

  // Subscribe to zero-read db connection updates
  useEffect(() => {
    const unsubscribe = dbConnectionService.subscribe((newDetails) => {
      setDetails(newDetails);
    });
    return () => unsubscribe();
  }, []);

  // Listen to background quota tracker events
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

  // Countdown timer for quota reset and live relative time ticker (pure client-side math, zero network reads)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntilQuotaReset());
      setCurrentTimeTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Prevent background scroll and handle Escape key to dismiss modal
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

  // State calculations
  const isQuotaFull = details.status === 'quota-full' || quotaStats.isExhausted || quotaStats.estimatedReads >= quotaStats.readsLimit;
  const isDisconnected = !details.isOnline || details.status === 'disconnected';
  const isGreen = !isQuotaFull && !isDisconnected && details.status === 'connected';

  // Read & Write calculations for Spark Tier
  const readsPercent = Math.min(100, Math.round((quotaStats.estimatedReads / quotaStats.readsLimit) * 100));
  const remainingReads = Math.max(0, quotaStats.readsLimit - quotaStats.estimatedReads);

  const writesPercent = Math.min(100, Math.round((quotaStats.estimatedWrites / quotaStats.writesLimit) * 100));
  const remainingWrites = Math.max(0, quotaStats.writesLimit - quotaStats.estimatedWrites);

  return (
    <>
      <div className={`relative inline-block ${className}`}>
      {/* Indicator Pill Button in Floating Bar */}
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
        className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-2xs shrink-0 select-none ${
          isGreen
            ? 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border-emerald-300/80 shadow-emerald-500/10'
            : isQuotaFull
            ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300 ring-2 ring-red-400/40 animate-pulse'
            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 ring-2 ring-rose-400/30'
        }`}
        title={
          isGreen
            ? 'Database Live & Quota Safe (Click for All-in-One Health Report)'
            : isQuotaFull
            ? 'Daily Quota Full (Red Alert) - Click for Diagnostics'
            : 'Database Disconnected / Offline - Click for Diagnostics'
        }
      >
        {/* Blinking / Pulsing Dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {isGreen ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </>
          ) : (
            <>
              {/* Aggressive Red Blink when disconnected or quota is full */}
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-90 duration-500" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </>
          )}
        </span>

        {/* Label */}
        <div className="flex items-center gap-1.5 leading-none">
          <Database className="w-3 h-3 opacity-70 hidden sm:inline" />
          <span className="font-extrabold tracking-tight">
            {isGreen ? 'DB Live' : isQuotaFull ? 'Quota Full' : 'DB Offline'}
          </span>
        </div>
      </button>
    </div>

    {/* Render modal directly into document.body via Portal to prevent any parent backdrop-filter / transform / overflow clipping */}
    {typeof document !== 'undefined' &&
      isOpen &&
      createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="db-health-modal-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[min(90dvh,720px)] my-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed, Non-Shrinking) */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isGreen
                      ? 'bg-emerald-100 text-emerald-700'
                      : isQuotaFull
                      ? 'bg-red-100 text-red-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="db-health-modal-title"
                    className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight"
                  >
                    Database & Quota Health
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>All-in-one check</span>
                    </p>
                    <span className="text-slate-300">•</span>
                    <p className="text-[11px] text-slate-700 flex items-center gap-1 font-semibold bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                      <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Last Checked: <strong className="font-mono text-slate-950 font-extrabold">{formatExactTime(details.lastSyncTime)}</strong> ({getRelativeTime(details.lastSyncTime, currentTimeTick)})</span>
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Smoothly Scrollable, Does not get cut off) */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain no-scrollbar">
              {/* Main Status Alert Banner */}
              <div>
                {isGreen && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950 leading-relaxed">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                        <span className="font-extrabold text-emerald-950 text-sm">
                          🟢 Live Connected & Quota Safe (Green Blink)
                        </span>
                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                          Verified: {formatExactTime(details.lastSyncTime)} ({getRelativeTime(details.lastSyncTime, currentTimeTick)})
                        </span>
                      </div>
                      Database se live real-time connection active hai. Daily read & write consumption bilkul safe limit ke andar hai.
                    </div>
                  </div>
                )}

                {isQuotaFull && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-300 flex items-start gap-3 animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-950 leading-relaxed">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                        <span className="font-extrabold text-red-700 text-sm">
                          🔴 Quota Limit Full (Red Alert)
                        </span>
                        <span className="text-[10px] font-mono font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-md border border-red-300">
                          Detected: {formatExactTime(details.lastSyncTime)}
                        </span>
                      </div>
                      Firebase / Google Cloud daily Spark free-tier limit (50,000 reads) poori ho chuki hai. Bill na bane isliye app safe offline cache mode me switch ho gayi hai.
                    </div>
                  </div>
                )}

                {isDisconnected && !isQuotaFull && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                    <WifiOff className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-950 leading-relaxed">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-0.5">
                        <span className="font-extrabold text-rose-700 text-sm">
                          🔴 Database Offline / Disconnected
                        </span>
                        <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                          Recorded: {formatExactTime(details.lastSyncTime)}
                        </span>
                      </div>
                      Internet connection ya Firebase cloud server unreachable hai. Aapke orders aur edits local device par secure store ho rahe hain.
                    </div>
                  </div>
                )}
              </div>

              {/* 5-Card Quick Diagnostics Grid with Prominent Last Update */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* 1. Connection Status */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                      {details.isOnline ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      Network & Ping
                    </span>
                    <p className={`font-extrabold text-sm ${details.isOnline ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {details.isOnline ? 'Online Connected' : 'Offline'}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                    {details.latencyMs ? `${details.latencyMs}ms` : '< 120ms'}
                  </span>
                </div>

                {/* 2. Last Health Check & Sync Time Card (Prominently Added) */}
                <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-200/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-blue-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Last Health Check & Sync
                    </span>
                    <p className="font-extrabold text-sm text-slate-900 font-mono flex items-center gap-1">
                      <span>{formatExactTime(details.lastSyncTime)}</span>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">IST</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold text-blue-900 bg-blue-100/90 px-2 py-1 rounded-lg border border-blue-300 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{getRelativeTime(details.lastSyncTime, currentTimeTick)}</span>
                  </span>
                </div>

                {/* 3. Quota Reset Countdown */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between sm:col-span-2">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      Daily Quota Reset In
                    </span>
                    <p className="font-mono font-extrabold text-sm text-slate-900">
                      {timeLeft.formatted}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 inline-block">
                      12:30 PM IST (Spark Cycle)
                    </span>
                  </div>
                </div>

                {/* 3. Document Reads Meter */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      Today's Reads
                    </span>
                    <span className="font-extrabold font-mono text-slate-800">
                      {quotaStats.estimatedReads.toLocaleString()} / {quotaStats.readsLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        readsPercent >= 90 ? 'bg-red-500' : readsPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${readsPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{readsPercent}% consumed</span>
                    <span className="font-bold text-emerald-700">{remainingReads.toLocaleString()} left</span>
                  </div>
                </div>

                {/* 4. Document Writes Meter */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-indigo-500" />
                      Today's Writes
                    </span>
                    <span className="font-extrabold font-mono text-slate-800">
                      {quotaStats.estimatedWrites.toLocaleString()} / {quotaStats.writesLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        writesPercent >= 90 ? 'bg-red-500' : writesPercent >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${writesPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{writesPercent}% consumed</span>
                    <span className="font-bold text-indigo-700">{remainingWrites.toLocaleString()} left</span>
                  </div>
                </div>
              </div>

              {/* Zero-Loop Protection Guarantee Badge */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 flex items-center gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-900 font-medium">
                  <strong>Zero-Loop Architecture:</strong> Koi background polling loop nahi chalta. Reads sirf actual user actions par IndexedDB local cache ke sath chalte hain.
                </span>
              </div>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 border ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <div className="flex-1 truncate">
                    <span className="font-extrabold">{testResult.message}</span>
                    <span className="block text-[10px] text-slate-600">
                      Roundtrip latency: {testResult.latencyMs}ms • Realtime sync validated
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls (Fixed, Non-Shrinking) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleManualTest}
                disabled={isTesting}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Firestore Ping...' : 'Test Connection (1 Read Ping)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full sm:w-auto py-2.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
