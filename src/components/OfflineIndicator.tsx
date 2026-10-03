import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [showRestoredBanner, setShowRestoredBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredBanner(true);
      const timer = setTimeout(() => {
        setShowRestoredBanner(false);
      }, 3200);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If online and not showing the restored toast, render nothing
  if (isOnline && !showRestoredBanner) {
    return null;
  }

  return (
    <div
      className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center px-4 w-full max-w-sm transition-all duration-300 ease-out"
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        /* Subtle Offline Capsule */
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/95 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] border border-slate-700/80 animate-bottom-popup">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-slate-100">
            You are offline • Menu saved locally
          </span>
          <button
            onClick={() => window.location.reload()}
            className="ml-1 p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            title="Retry connection"
            aria-label="Retry connection"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      ) : showRestoredBanner ? (
        /* Back Online Subtle Pill */
        <div className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/95 text-emerald-100 shadow-[0_8px_24px_rgba(0,0,0,0.18)] border border-emerald-700/60 animate-bottom-popup">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-white">
            Connection restored
          </span>
        </div>
      ) : null}
    </div>
  );
};
