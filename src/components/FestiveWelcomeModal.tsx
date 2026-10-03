import React, { useEffect, useState } from 'react';
import { Sparkles, X, Gift, ArrowRight, Heart, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import { FESTIVALS_DATA, FestivalConfig, FestivalKey } from '../data/festivals';
import { triggerHaptic } from '../utils/haptics';

interface FestiveWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  festivalKey?: FestivalKey;
  customGreeting?: string;
  customSubtitle?: string;
  specialOfferText?: string;
  showConfetti?: boolean;
}

export const fireFestiveConfetti = (confettiColors?: string[]) => {
  const colors = confettiColors || ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#ffd700'];

  // Two-phase burst for high festive excitement
  try {
    // Left cannon
    confetti({
      particleCount: 55,
      angle: 60,
      spread: 60,
      origin: { x: 0.1, y: 0.65 },
      colors,
      zIndex: 99999,
      disableForReducedMotion: true,
    });

    // Right cannon
    confetti({
      particleCount: 55,
      angle: 120,
      spread: 60,
      origin: { x: 0.9, y: 0.65 },
      colors,
      zIndex: 99999,
      disableForReducedMotion: true,
    });

    // Center star shower
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        origin: { x: 0.5, y: 0.4 },
        colors,
        zIndex: 99999,
        disableForReducedMotion: true,
      });
    }, 250);
  } catch (err) {
    console.debug('Confetti error:', err);
  }
};

export const FestiveWelcomeModal: React.FC<FestiveWelcomeModalProps> = ({
  isOpen,
  onClose,
  festivalKey = 'diwali',
  customGreeting,
  customSubtitle,
  specialOfferText,
  showConfetti = true,
}) => {
  const festival: FestivalConfig = FESTIVALS_DATA[festivalKey] || FESTIVALS_DATA.diwali;
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    if (isOpen && showConfetti && !hasCelebrated) {
      setHasCelebrated(true);
      const timer = setTimeout(() => {
        fireFestiveConfetti(festival.confettiColors);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showConfetti, hasCelebrated, festival.confettiColors]);

  // Reset celebration on reopen
  useEffect(() => {
    if (!isOpen) {
      setHasCelebrated(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const title = customGreeting || festival.defaultTitle;
  const subtitle = customSubtitle || festival.defaultSubtitle;
  const offer = specialOfferText || festival.defaultOfferText;

  const handleCelebrateAgain = () => {
    triggerHaptic('success');
    fireFestiveConfetti(festival.confettiColors);
  };

  const handleExplore = () => {
    triggerHaptic('light');
    onClose();
    // Smooth scroll down to food catalog
    const menuEl = document.getElementById('menu-catalog-section');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl sm:rounded-4xl shadow-2xl overflow-hidden border border-amber-200/90 text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        id="festive-welcome-modal"
      >
        {/* Top Glowing Festive Header Banner */}
        <div className={`relative px-6 pt-7 pb-6 bg-gradient-to-br ${festival.bannerGradient} text-white overflow-hidden text-center`}>
          {/* Subtle Decorative Pattern Background */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[size:16px_16px]" />

          {/* Floating Motifs */}
          <div className="absolute top-2 left-4 text-2xl select-none animate-pulse opacity-75">
            {festival.motifs[0] || '✨'}
          </div>
          <div className="absolute top-3 right-4 text-2xl select-none animate-pulse opacity-75 delay-150">
            {festival.motifs[1] || '🪔'}
          </div>
          <div className="absolute -bottom-2 right-8 text-3xl select-none opacity-40">
            {festival.motifs[2] || '🌸'}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
            title="Close"
            id="close-festive-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Central Festival Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[11px] font-extrabold uppercase tracking-wider mb-2.5 shadow-sm">
            <span>{festival.emoji}</span>
            <span>{festival.hindiName} विशेष</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </div>

          {/* Big Festive Emblem */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-4xl sm:text-5xl shadow-lg mb-3 select-none">
            {festival.emoji}
          </div>

          {/* Greeting Headline */}
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight drop-shadow-sm">
            {title}
          </h2>

          <p className="text-white/90 text-xs sm:text-sm font-medium mt-1 max-w-sm mx-auto">
            {festival.tagline}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 bg-gradient-to-b from-amber-50/40 via-white to-white">
          {/* Heartfelt Blessing / Message */}
          <div className="p-4 rounded-2xl bg-amber-500/8 border border-amber-200/80 text-center space-y-1.5">
            <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
              "{subtitle}"
            </p>
            <p className="text-[11px] font-bold text-amber-800 flex items-center justify-center gap-1">
              <Heart className="w-3 h-3 fill-amber-600 text-amber-600" />
              <span>स्वादीप परिवार की ओर से सप्रेम शुभकामनाएं</span>
            </p>
          </div>

          {/* Special Treat & Offer Highlight */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Gift className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-orange-200/80 text-orange-900 px-1.5 py-0.2 rounded-md">
                  Festive Special
                </span>
                <span className="text-[11px] font-bold text-slate-900 truncate">
                  {festival.specialTreat}
                </span>
              </div>
              <p className="text-xs font-semibold text-orange-950 leading-snug">
                {offer}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={handleCelebrateAgain}
              type="button"
              className="w-full sm:w-auto px-4 py-2.5 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Celebrate with confetti again"
              id="celebrate-again-btn"
            >
              <span>🎊</span>
              <span>Celebrate Again</span>
            </button>

            <button
              onClick={handleExplore}
              type="button"
              className={`w-full sm:flex-1 py-3 px-5 rounded-full bg-gradient-to-r ${festival.themeGradient} hover:opacity-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer`}
              id="explore-festive-menu-btn"
            >
              <span>Explore Festive Menu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              onClick={onClose}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors cursor-pointer"
            >
              Continue to Regular Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
