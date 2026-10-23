import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  Image as ImageIcon,
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
  const [stats, setStats] = useState<StorageUsageStats>(() => getInitialStorageUsage(products));
  const [isScanning, setIsScanning] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      ? 'bg-[#EF4444]'
      : stats.status === 'warning'
      ? 'bg-[#F59E0B]'
      : 'bg-[#FF5500]';

  const trackFillWidth = Math.max(stats.percentUsed, 1.5);

  return (
    <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272A] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#A1A1AA] border border-[#27272A]">
            STORAGE
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-sm text-[#FFFFFF]">
              Cloud Storage Meter
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#10B981] border border-[#10B981]/40 flex items-center gap-1 uppercase tabular-nums">
              <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />
              {stats.percentUsed < 1 ? '< 1% USED' : `${stats.percentUsed}% USED`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={refreshStorage}
            disabled={isScanning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-[11px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer disabled:opacity-70 ${
              justRefreshed
                ? 'bg-[#10B981] border-[#10B981] text-[#0A0A0A]'
                : 'bg-[#0A0A0A] hover:bg-[#242427] border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF]'
            }`}
          >
            {justRefreshed ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>UPDATED</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-[#FF5500]' : ''}`} />
                <span>{isScanning ? 'SCANNING...' : 'REFRESH'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0A0A0A] rounded-sm border border-[#27272A] p-3 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#71717A]">
            STORAGE USED
          </span>
          <div className="flex items-baseline gap-1 font-mono tabular-nums">
            <span className="text-sm font-bold text-[#FFFFFF]">{stats.usedFormatted}</span>
            <span className="text-[11px] text-[#71717A]">/ 5.0 GB</span>
          </div>
        </div>

        <div className="bg-[#0A0A0A] rounded-sm border border-[#27272A] p-3 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#71717A] flex items-center gap-1">
            <Cloud className="w-3 h-3 text-[#71717A]" />
            <span>REMAINING FREE</span>
          </span>
          <div className="flex items-baseline gap-1 font-mono tabular-nums">
            <span className="text-sm font-bold text-[#FFFFFF]">{stats.remainingFormatted}</span>
            <span className="text-[11px] text-[#71717A]">({stats.remainingPercent}%)</span>
          </div>
        </div>

        <div className="bg-[#0A0A0A] rounded-sm border border-[#27272A] p-3 flex items-center justify-between sm:flex-col sm:items-start sm:justify-center gap-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#71717A] flex items-center gap-1">
            <ImageIcon className="w-3 h-3 text-[#71717A]" />
            <span>CLOUD PHOTOS</span>
          </span>
          <div className="flex items-baseline gap-1.5 text-xs font-mono text-[#A1A1AA] tabular-nums">
            <span className="font-bold text-[#FFFFFF] text-sm">{stats.cloudPhotosCount}</span>
            <span className="text-[11px] text-[#71717A]">· {stats.totalMenuPhotos} total</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-2 rounded-sm bg-[#0A0A0A] overflow-hidden border border-[#27272A]">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${trackFillWidth}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-[#71717A] uppercase tabular-nums">
          <span>0% (0 MB)</span>
          <span className="text-[#A1A1AA] font-bold hidden sm:inline-block">
            {stats.remainingFormatted} AVAILABLE
          </span>
          <span>100% (5.0 GB)</span>
        </div>
      </div>
    </div>
  );
});

CloudStorageMeter.displayName = 'CloudStorageMeter';
