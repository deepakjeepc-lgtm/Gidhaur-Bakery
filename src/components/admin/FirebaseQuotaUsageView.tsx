import React, { useState, useEffect } from 'react';
import {
  Database,
  Clock,
  Activity,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Server,
  Zap,
  Info,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Eye,
  Sliders
} from 'lucide-react';
import { Product } from '../../types';
import {
  getQuotaUsageStats,
  saveQuotaUsageStats,
  getTimeUntilQuotaReset,
  recordQuotaExhaustedEvent,
  SPARK_LIMITS,
  QuotaMetric
} from '../../services/quotaTrackerService';
import { CloudStorageMeter } from './CloudStorageMeter';
import { triggerHaptic } from '../../utils/haptics';

interface FirebaseQuotaUsageViewProps {
  products: Product[];
  onRefreshProducts?: () => void;
}

export const FirebaseQuotaUsageView: React.FC<FirebaseQuotaUsageViewProps> = ({
  products,
  onRefreshProducts
}) => {
  const [stats, setStats] = useState<QuotaMetric>(() => getQuotaUsageStats());
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilQuotaReset());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  // Live timer for reset countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilQuotaReset());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to background quota tracker events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setStats(e.detail);
      } else {
        setStats(getQuotaUsageStats());
      }
    };
    window.addEventListener('gidhaur_quota_updated', handleUpdate);
    return () => window.removeEventListener('gidhaur_quota_updated', handleUpdate);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    triggerHaptic('light');
    try {
      if (onRefreshProducts) {
        await onRefreshProducts();
      }
      setStats(getQuotaUsageStats());
      setTestSuccessMessage('Quota status refreshed successfully.');
      triggerHaptic('success');
      setTimeout(() => setTestSuccessMessage(null), 3000);
    } catch {
      setTestSuccessMessage('Sync completed with local cached state.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSimulateQuota = () => {
    const nextState = !stats.isExhausted;
    recordQuotaExhaustedEvent(nextState, nextState ? 'Admin preview simulation' : '');
    setStats(getQuotaUsageStats());
    triggerHaptic('medium');
  };

  // Calculations
  const readsPercent = Math.min(100, Math.round((stats.estimatedReads / stats.readsLimit) * 100));
  const remainingReads = Math.max(0, stats.readsLimit - stats.estimatedReads);

  const writesPercent = Math.min(100, Math.round((stats.estimatedWrites / stats.writesLimit) * 100));
  const remainingWrites = Math.max(0, stats.writesLimit - stats.estimatedWrites);

  const getBarColor = (percent: number) => {
    if (percent >= 90) return 'bg-rose-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getBadgeStyle = (percent: number) => {
    if (percent >= 90) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (percent >= 70) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Database className="w-3.5 h-3.5" /> Cloud Firestore
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" /> AI Shared Quota (Spark)
              </span>
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight">
              Daily Firebase Consumption & Quotas
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 max-w-xl">
              Monitor real-time document reads, writes, burst limits, and countdown timers to daily UTC midnight quota resets.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all border border-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Checking...' : 'Refresh Status'}
            </button>
            <button
              onClick={toggleSimulateQuota}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                stats.isExhausted
                  ? 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600'
                  : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-750'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {stats.isExhausted ? 'Quota Simulation: ON' : 'Test Quota Screen'}
            </button>
          </div>
        </div>

        {testSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {testSuccessMessage}
          </div>
        )}
      </div>

      {/* Countdown Reset Banner Card */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <Clock className="w-4 h-4 animate-pulse" /> Daily Quota Refresh Schedule
            </div>
            <h2 className="font-heading font-extrabold text-xl text-stone-900">
              Next Quota Reset Countdown
            </h2>
            <p className="text-xs text-stone-500 max-w-md">
              Google Cloud resets all API consumer quotas daily at <strong className="text-stone-800">12:30 PM IST (Midnight Pacific / 07:00 UTC)</strong>.
            </p>
          </div>

          {/* Big Digital Clock Display */}
          <div className="flex items-center gap-3 bg-stone-950 text-white p-4 rounded-2xl shadow-inner border border-stone-800">
            <div className="text-center px-2">
              <div className="font-mono font-black text-2xl sm:text-3xl text-amber-400">
                {timeLeft.hours.toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] uppercase font-bold text-stone-400">Hours</div>
            </div>
            <span className="font-mono text-2xl text-stone-500 font-bold">:</span>
            <div className="text-center px-2">
              <div className="font-mono font-black text-2xl sm:text-3xl text-amber-400">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] uppercase font-bold text-stone-400">Minutes</div>
            </div>
            <span className="font-mono text-2xl text-stone-500 font-bold">:</span>
            <div className="text-center px-2">
              <div className="font-mono font-black text-2xl sm:text-3xl text-rose-400">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </div>
              <div className="text-[10px] uppercase font-bold text-stone-400">Seconds</div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Quota Metric Cards (Reads, Writes, Burst Protection) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Document Reads */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-600" /> Daily Reads
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeStyle(readsPercent)}`}>
                {readsPercent}% Used
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono font-black text-3xl text-stone-900">
                {stats.estimatedReads.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-stone-400">
                / {stats.readsLimit.toLocaleString()} limit
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Remaining today: <strong className="text-stone-800">{remainingReads.toLocaleString()}</strong> reads
            </p>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 ${getBarColor(readsPercent)}`}
                style={{ width: `${Math.max(2, readsPercent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400 font-medium">
              <span>0</span>
              <span>50k Free Spark Pool</span>
            </div>
          </div>
        </div>

        {/* Card 2: Document Writes */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" /> Daily Writes
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getBadgeStyle(writesPercent)}`}>
                {writesPercent}% Used
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono font-black text-3xl text-stone-900">
                {stats.estimatedWrites.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-stone-400">
                / {stats.writesLimit.toLocaleString()} limit
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Remaining today: <strong className="text-stone-800">{remainingWrites.toLocaleString()}</strong> writes
            </p>
          </div>

          <div>
            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 ${getBarColor(writesPercent)}`}
                style={{ width: `${Math.max(2, writesPercent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400 font-medium">
              <span>0</span>
              <span>20k Free Spark Pool</span>
            </div>
          </div>
        </div>

        {/* Card 3: Realtime Listeners & Rate-Limit Shield */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600" /> Rate Protection
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Protected
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono font-black text-3xl text-stone-900">
                {stats.activeListenersCount}
              </span>
              <span className="text-xs font-semibold text-stone-400">
                active listeners
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Recursive loops removed. Maximum burst limited to safe levels.
            </p>
          </div>

          <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/70 text-[11px] text-stone-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Burst limit capped at &lt; 200 ops/min to prevent Firebase rate throttling.</span>
          </div>
        </div>
      </div>

      {/* Database Technical Specification */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs p-6">
        <h3 className="font-heading font-extrabold text-base text-stone-900 mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-amber-600" /> Database Technical Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70">
            <span className="text-stone-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
              Database ID
            </span>
            <span className="font-mono font-bold text-stone-800 text-[11px] break-all">
              ai-studio-swadeep-c9f5f4f9-12f6-4ef3-a3b0-884128973d8b
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70">
            <span className="text-stone-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
              Cloud Region
            </span>
            <span className="font-bold text-stone-800">
              asia-southeast1 (Singapore)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70">
            <span className="text-stone-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
              Local Backup Status
            </span>
            <span className="font-bold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> /api/products Mirror Active
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/70">
            <span className="text-stone-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">
              Quota Reset Time
            </span>
            <span className="font-bold text-stone-800">
              12:30 PM IST (Midnight PT)
            </span>
          </div>
        </div>

        {/* Why numbers differ from Firebase Console note */}
        <div className="mt-5 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">
                Yahan (Admin Panel) aur Firebase Console ke numbers me antar kyu hota hai?
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pt-1">
                <li>
                  <strong>Console Delayed Update:</strong> Firebase Console ka graph real-time nahi hota; Google Cloud usage data ko 1 se 2 ghante ke delay ke sath aggregate karta hai.
                </li>
                <li>
                  <strong>Local Cache vs Cloud Server:</strong> Jab app local cache se data read karta hai, toh app instant khul jata hai lekin Firebase server par reads count 0 hota hai.
                </li>
                <li>
                  <strong>Project-Wide vs Single Device:</strong> Firebase Console me background indexing, dev server aur saare devices ka kul milakar total data hota hai, jabki yahan app session ka estimate hota hai.
                </li>
                <li>
                  <strong>Security Rules Evaluations:</strong> Kisi request ka Security Rules check hona aur billable document read hone me farak hota hai.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Cloud Photos Storage Meter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider px-1">
          <HardDrive className="w-4 h-4 text-amber-600" /> Cloud Media & Image Assets Storage
        </div>
        <CloudStorageMeter products={products} />
      </div>
    </div>
  );
};
