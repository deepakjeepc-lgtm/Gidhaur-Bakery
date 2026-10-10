import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Cloud,
  Check
} from 'lucide-react';
import { Product } from '../../types';
import {
  getStorageUsage,
  getInitialStorageUsage,
  StorageUsageStats
} from '../../services/storageUsageService';
import { triggerHaptic } from '../../utils/haptics';

interface CloudStorageMeterProps {
  products: Product[];
}

export const CloudStorageMeter = React.memo<CloudStorageMeterProps>(({ products }) => {
  // Instant initialization: ZERO delay on mount, reads from cache or instant catalog computation
  const [stats, setStats] = useState<StorageUsageStats>(() => getInitialStorageUsage(products));
  const [isScanning, setIsScanning] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update immediately when products list changes
  useEffect(() => {
    setStats((prev) => {
      const updated = getInitialStorageUsage(products);
      return {
        ...updated,
        cloudPhotosCount: Math.max(prev.cloudPhotosCount, updated.cloudPhotosCount),
        usedBytes: Math.max(prev.usedBytes, updated.usedBytes),
        usedFormatted: prev.usedBytes > updated.usedBytes ? prev.usedFormatted : updated.usedFormatted,
      };
    });
  }, [products]);

  // Refresh handler: Guaranteed to finish in <= 1.2 seconds, never hangs
  const refreshStorage = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setJustRefreshed(false);
    triggerHaptic('light');

    try {
      const result = await getStorageUsage(products);
      if (isMountedRef.current) {
        setStats(result);
        setJustRefreshed(true);
        triggerHaptic('success');
        setTimeout(() => {
          if (isMountedRef.current) setJustRefreshed(false);
        }, 2500);
      }
    } catch (e) {
      console.warn('Storage refresh error caught:', e);
    } finally {
      if (isMountedRef.current) {
        setIsScanning(false);
      }
    }
  }, [products, isScanning]);

  const barColor =
    stats.status === 'critical'
      ? 'bg-rose-500'
      : stats.status === 'warning'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const trackFillWidth = Math.max(stats.percentUsed, 1.2);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/90 shadow-2xs p-4 sm:p-5 transition-all">
      {/* Top Header: Responsive for Phone & Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title & Status Badges */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-700 shadow-2xs">
            <HardDrive className="w-5 h-5 text-amber-600" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading font-black text-sm sm:text-base text-stone-900 tracking-tight">
                Storage Usage Meter
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />
                {stats.percentUsed < 1 ? '< 1% Used' : `${stats.percentUsed}% Used`}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              Firebase Storage Spark Free Tier (5.0 GB Quota)
            </p>
          </div>
        </div>

        {/* Action Buttons: Refresh & Details */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={refreshStorage}
            disabled={isScanning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-70 ${
              justRefreshed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700 shadow-2xs'
            }`}
            title="Scan cloud storage for live byte count"
          >
            {justRefreshed ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span>Updated</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-600' : 'text-stone-500'}`} />
                <span>{isScanning ? 'Scanning...' : 'Refresh'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsExpanded((prev) => !prev);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50/70 hover:bg-amber-100/70 transition-colors cursor-pointer border border-amber-200/60"
          >
            <span>{isExpanded ? 'Less' : 'Details'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Responsive Stat Pills Grid: Stacks cleanly on Mobile without horizontal collisions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
        {/* Card 1: Used vs Total */}
        <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">
            Storage Used
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-extrabold text-stone-900">{stats.usedFormatted}</span>
            <span className="text-[11px] text-stone-500 font-medium">/ 5.0 GB</span>
          </div>
        </div>

        {/* Card 2: Remaining Free Space (User's specific requested label) */}
        <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-2.5 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 flex items-center gap-1">
            <Cloud className="w-3 h-3 text-blue-500" />
            <span>Remaining Free</span>
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-extrabold text-blue-900">{stats.remainingFormatted}</span>
            <span className="text-[11px] text-blue-700/80 font-semibold">({stats.remainingPercent}% free)</span>
          </div>
        </div>

        {/* Card 3: Cloud Photos Count */}
        <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-2.5 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-amber-500" />
            <span>Uploads & Catalog</span>
          </span>
          <div className="flex items-baseline gap-1.5 text-xs text-stone-700 font-semibold">
            <span className="font-extrabold text-stone-900 text-sm">{stats.cloudPhotosCount}</span>
            <span className="text-[11px] text-stone-500">cloud • {stats.totalMenuPhotos} total</span>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar (0% to 100% Capacity) */}
      <div className="mt-4 pt-1">
        <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200/70 p-0.5 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} shadow-xs`}
            style={{ width: `${trackFillWidth}%` }}
          />
        </div>

        {/* Clean labels below bar: Clean 2-column layout to prevent any mobile collision */}
        <div className="flex items-center justify-between mt-1.5 text-[11px] font-semibold text-stone-400">
          <span>0% (0 MB)</span>
          <span className="text-stone-600 font-bold hidden sm:inline-block">
            {stats.remainingFormatted} available space
          </span>
          <span>100% (5.0 GB)</span>
        </div>
      </div>

      {/* Expandable Explanation Details */}
      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-stone-200/80 text-xs text-stone-600 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950 text-xs">
                40% Compression Applied on Uploads
              </p>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                Images uploaded from your device are compressed at <strong>40% compression level</strong> (preserving 60% high-fidelity crisp quality in modern WebP format). This keeps photos sharp while saving massive storage space.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-stone-50 p-3 rounded-xl border border-stone-200/70">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-stone-900 text-xs">
                Firebase 5.0 GB Free Tier Breakdown
              </p>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                You have used <strong>{stats.usedFormatted}</strong> out of <strong>5,120 MB (5 GB)</strong>. You have <strong>{stats.remainingFormatted}</strong> free space remaining, allowing you to comfortably host thousands of product photos with zero hosting cost.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CloudStorageMeter.displayName = 'CloudStorageMeter';
