import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Store, Phone, MapPin, Sparkles, AlertCircle, ChefHat } from 'lucide-react';
import { getTimeUntilQuotaReset } from '../services/quotaTrackerService';

interface BakeryClosedQuotaScreenProps {
  onRefresh?: () => void;
  customMessage?: string;
}

export const BakeryClosedQuotaScreen: React.FC<BakeryClosedQuotaScreenProps> = ({
  onRefresh,
  customMessage
}) => {
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilQuotaReset());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilQuotaReset());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  return (
    <div className="w-full my-6 bg-gradient-to-b from-amber-50/70 via-white to-stone-50/80 rounded-3xl border border-amber-200/80 shadow-sm p-6 sm:p-10 text-center overflow-hidden relative">
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
        {/* Bakery Icon Badge */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 ring-4 ring-amber-100">
            <Store className="w-10 h-10 stroke-[1.8]" />
          </div>
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md border-2 border-white">
            <Clock className="w-4 h-4" />
          </span>
        </div>

        {/* Title */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider mb-2">
          <ChefHat className="w-3.5 h-3.5 text-amber-700" /> Gidhaur Bakery Kitchen
        </span>
        <h2 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
          Bakery Closed For Online Orders
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
          {customMessage ||
            'Daily ordering quota limit has been reached for today. Our kitchen is resting and preparing fresh batches for tomorrow morning!'}
        </p>

        {/* Live Countdown Timer Box */}
        <div className="w-full bg-white rounded-2xl border border-amber-200/90 shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Daily Quota Resets In
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xs sm:max-w-sm mx-auto">
            {/* Hours */}
            <div className="flex flex-col items-center justify-center bg-stone-900 text-white rounded-xl py-3 px-2 shadow-inner">
              <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-amber-400">
                {timeLeft.hours.toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-0.5">
                Hours
              </span>
            </div>

            {/* Minutes */}
            <div className="flex flex-col items-center justify-center bg-stone-900 text-white rounded-xl py-3 px-2 shadow-inner">
              <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-amber-400">
                {timeLeft.minutes.toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-0.5">
                Minutes
              </span>
            </div>

            {/* Seconds */}
            <div className="flex flex-col items-center justify-center bg-stone-900 text-white rounded-xl py-3 px-2 shadow-inner">
              <span className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-rose-400">
                {timeLeft.seconds.toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-0.5">
                Seconds
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-3 font-medium">
            Reset Schedule: Daily at <span className="text-slate-600 font-bold">12:30 PM IST (07:00 UTC / Midnight PT)</span>
          </p>
        </div>

        {/* Physical Store & Help info */}
        <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Physical Store Is Still Open!</h4>
              <p className="text-[11px] text-slate-600">Gidhaur, Jamui (Walk-in takeaway available 8:00 AM – 11:00 PM)</p>
            </div>
          </div>
          <a
            href="tel:9508922247"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all shrink-0 shadow-2xs"
          >
            <Phone className="w-3.5 h-3.5 text-amber-700" /> Call Bakery
          </a>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Checking Status...' : 'Check If Quota Restored'}
        </button>
      </div>
    </div>
  );
};
