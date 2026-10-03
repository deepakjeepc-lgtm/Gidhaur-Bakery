import React from 'react';
import { Sparkles, Gift } from 'lucide-react';
import { FESTIVALS_DATA, FestivalKey } from '../data/festivals';
import { fireFestiveConfetti } from './FestiveWelcomeModal';
import { triggerHaptic } from '../utils/haptics';

interface FestiveTopRibbonProps {
  festivalKey?: FestivalKey;
  customGreeting?: string;
  specialOfferText?: string;
}

export const FestiveTopRibbon: React.FC<FestiveTopRibbonProps> = ({
  festivalKey = 'diwali',
  customGreeting,
  specialOfferText,
}) => {
  const festival = FESTIVALS_DATA[festivalKey] || FESTIVALS_DATA.diwali;

  const handleCelebrate = () => {
    triggerHaptic('light');
    fireFestiveConfetti();
  };

  return (
    <div
      onClick={handleCelebrate}
      className={`w-full bg-gradient-to-r ${festival.bannerGradient} text-white px-3 py-1.5 sm:py-2 text-xs font-medium flex items-center justify-between gap-2 shadow-xs cursor-pointer select-none transition-all hover:brightness-105 active:scale-[0.99]`}
      role="banner"
      title="Click to celebrate with festive sparkles!"
      id="festive-top-ribbon"
    >
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <span className="text-base sm:text-lg animate-bounce leading-none select-none">
            {festival.emoji}
          </span>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-extrabold tracking-wide text-[11px] sm:text-xs bg-white/20 px-2 py-0.5 rounded-full border border-white/30 truncate">
              {festival.hindiName}
            </span>
            <span className="text-white/95 text-[11px] sm:text-xs font-semibold truncate hidden xs:inline">
              {customGreeting || festival.defaultTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {specialOfferText ? (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-amber-200 bg-black/20 px-2 py-0.5 rounded-full">
              <Gift className="w-3 h-3 text-amber-300" />
              <span className="truncate max-w-[200px]">{specialOfferText}</span>
            </div>
          ) : (
            <span className="hidden sm:inline text-[11px] text-white/90">
              {festival.tagline}
            </span>
          )}

          <div className="flex items-center gap-1 bg-white/90 hover:bg-white text-slate-900 font-extrabold text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>🎉 Celebrate</span>
          </div>
        </div>
      </div>
    </div>
  );
};
