import React from 'react';
import { Clock, Phone, Lock, ShieldCheck } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { useLocation } from '../context/LocationContext';

interface FooterProps {
  onGoToAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onGoToAdmin }) => {
  const { settings } = useLocation();
  const fssaiNumber = settings?.fssaiLicenseNumber || '20426191000010';

  return (
    <footer className="w-full mt-10 py-6 px-4 sm:px-6 border-t border-slate-200/70 bg-white/60 backdrop-blur-xs relative z-10">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        
        {/* Brand, Timings & Contact */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 sm:gap-x-4 gap-y-1.5 text-slate-500 font-medium text-[11px] sm:text-xs">
          {/* Brand Name */}
          <span className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
            {settings?.restaurantName || 'Gidhaur Bakery'}
          </span>

          <span className="text-slate-300 select-none">•</span>

          {/* Operating Hours */}
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>8:00 AM – 11:00 PM</span>
          </div>

          <span className="text-slate-300 select-none">•</span>

          {/* Phone Number Link */}
          <a
            href={`tel:${settings?.contactPhone || '+919876543210'}`}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{settings?.contactPhone || '+91 98765 43210'}</span>
          </a>
        </div>

        {/* Right Section: Official FSSAI License Badge & Admin Lock */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          {/* Official FSSAI Certified Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs select-none"
            title="Food Safety and Standards Authority of India (FSSAI) Registered"
          >
            <span className="font-heading font-black text-[13px] tracking-tight text-sky-800 lowercase">
              fssai
            </span>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-baseline gap-1 text-[11px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lic. No.</span>
              <span className="font-mono font-extrabold text-slate-900 tracking-wide">
                {fssaiNumber}
              </span>
            </div>
          </div>

          {/* Minimal Admin Lock SVG Button */}
          {onGoToAdmin && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onGoToAdmin();
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100/90 hover:bg-slate-200 active:scale-90 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
              title="Staff & Admin Portal"
              aria-label="Staff & Admin Portal"
              id="footer-admin-lock-btn"
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Clean Copyright & 100% Quality Assurance */}
      <div className="max-w-5xl mx-auto mt-3.5 pt-2.5 border-t border-slate-100/80 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[10px] sm:text-[11px] text-slate-400 text-center sm:text-left">
        <p>© {new Date().getFullYear()} {settings?.restaurantName || 'Gidhaur Bakery'}. All rights reserved.</p>
        <p className="flex items-center gap-1 text-slate-500 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
          <span>FSSAI Quality & Hygiene Compliant</span>
        </p>
      </div>
    </footer>
  );
};
