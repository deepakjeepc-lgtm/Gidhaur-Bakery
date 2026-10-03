import React, { useEffect } from 'react';
import { fireFestiveConfetti } from './FestiveWelcomeModal';
import { triggerHaptic } from '../utils/haptics';

interface FestiveDiwaliBackdropProps {
  customGreeting?: string;
  customSubtitle?: string;
}

/**
 * FestiveDiwaliBackdrop
 * 
 * Renders the authentic Diwali festive ambiance matching the reference visual:
 * - Hanging golden chains with glowing burning diyas (top left & right)
 * - Intricate golden rangoli / mandala line-art watermarks (sides)
 * - Golden sparkler bursts and fireworks rays
 * - Animated celebratory Diwali greeting text with celebration sparkles & confetti
 */
export const FestiveDiwaliBackdrop: React.FC<FestiveDiwaliBackdropProps> = ({
  customGreeting = 'Happy Diwali!',
  customSubtitle = 'दीपों और मिठास का पावन प्रकाशोत्सव • Celebrate with Joy & Sweet Delights',
}) => {
  // Fire subtle joyful celebratory burst upon viewing the page (once per session)
  useEffect(() => {
    try {
      const welcomed = sessionStorage.getItem('swadeep_diwali_welcomed');
      if (!welcomed) {
        sessionStorage.setItem('swadeep_diwali_welcomed', 'true');
        const timer = setTimeout(() => {
          fireFestiveConfetti(['#f59e0b', '#fbbf24', '#d97706', '#ec4899', '#9333ea']);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleCelebrateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    fireFestiveConfetti(['#f59e0b', '#fbbf24', '#d97706', '#ec4899', '#9333ea']);
  };
  return (
    <div className="relative w-full pointer-events-none select-none">
      {/* 1. Hanging Diyas & Ceiling Chains - Top Left & Right */}
      <div className="absolute top-0 left-0 right-0 w-full pointer-events-none overflow-hidden z-10 h-44 sm:h-56">
        {/* Left Hanging Diya */}
        <div className="absolute left-2 sm:left-6 lg:left-12 top-0 flex flex-col items-center animate-diwali-sway origin-top">
          {/* Beaded Chain */}
          <div className="w-[1.5px] h-16 sm:h-24 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-600 shadow-[0_0_2px_rgba(245,158,11,0.5)]" />
          {/* Small connector ring */}
          <div className="w-2 h-2 rounded-full border border-amber-500 bg-amber-200 shadow-xs -mt-0.5" />
          {/* Second Chain Link */}
          <div className="w-[1.5px] h-6 sm:h-10 bg-gradient-to-b from-amber-500 to-amber-600 shadow-[0_0_2px_rgba(245,158,11,0.5)]" />
          
          {/* Diya & Flame */}
          <div className="relative -mt-1 flex flex-col items-center">
            {/* Flickering Flame with warm glow */}
            <div className="relative flex items-center justify-center">
              <div className="absolute w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-400/30 blur-md animate-pulse" />
              <div className="w-2 sm:w-2.5 h-4 sm:h-5 bg-gradient-to-t from-orange-600 via-amber-400 to-yellow-100 rounded-full animate-diwali-flicker shadow-[0_0_8px_#f59e0b]" />
            </div>
            {/* Terracotta/Brass Diya Body */}
            <svg
              className="w-8 h-4 sm:w-11 sm:h-5 text-amber-700 drop-shadow-md -mt-1"
              viewBox="0 0 44 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 5C6 14 18 19 22 19C26 19 38 14 42 5C38 8 30 11 22 11C14 11 6 8 2 5Z"
                fill="url(#diyaBodyGradLeft)"
              />
              <ellipse cx="22" cy="5" rx="20" ry="3" fill="#b45309" stroke="#fef3c7" strokeWidth="0.75" />
              <defs>
                <linearGradient id="diyaBodyGradLeft" x1="2" y1="5" x2="42" y2="19" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9a3412" />
                  <stop offset="0.5" stopColor="#d97706" />
                  <stop offset="1" stopColor="#78350f" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Secondary Left Smaller Hanging Diya (for depth) */}
        <div className="hidden md:flex absolute left-24 lg:left-36 top-0 flex-col items-center opacity-85 origin-top">
          <div className="w-[1px] h-10 sm:h-14 bg-gradient-to-b from-amber-700 to-amber-500" />
          <div className="relative -mt-0.5 flex flex-col items-center">
            <div className="w-1.5 h-3 bg-gradient-to-t from-orange-500 to-yellow-200 rounded-full animate-diwali-flicker shadow-[0_0_6px_#f59e0b]" />
            <svg className="w-6 h-3 text-amber-700 drop-shadow-xs -mt-0.5" viewBox="0 0 44 20" fill="none">
              <path d="M2 5C6 14 18 19 22 19C26 19 38 14 42 5C38 8 30 11 22 11C14 11 6 8 2 5Z" fill="#b45309" />
              <ellipse cx="22" cy="5" rx="20" ry="3" fill="#d97706" />
            </svg>
          </div>
        </div>

        {/* Right Hanging Diya */}
        <div className="absolute right-2 sm:right-6 lg:right-12 top-0 flex flex-col items-center animate-diwali-sway origin-top [animation-delay:0.5s]">
          {/* Beaded Chain */}
          <div className="w-[1.5px] h-16 sm:h-24 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-600 shadow-[0_0_2px_rgba(245,158,11,0.5)]" />
          <div className="w-2 h-2 rounded-full border border-amber-500 bg-amber-200 shadow-xs -mt-0.5" />
          <div className="w-[1.5px] h-6 sm:h-10 bg-gradient-to-b from-amber-500 to-amber-600 shadow-[0_0_2px_rgba(245,158,11,0.5)]" />
          
          {/* Diya & Flame */}
          <div className="relative -mt-1 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-amber-400/30 blur-md animate-pulse" />
              <div className="w-2 sm:w-2.5 h-4 sm:h-5 bg-gradient-to-t from-orange-600 via-amber-400 to-yellow-100 rounded-full animate-diwali-flicker shadow-[0_0_8px_#f59e0b]" />
            </div>
            <svg
              className="w-8 h-4 sm:w-11 sm:h-5 text-amber-700 drop-shadow-md -mt-1"
              viewBox="0 0 44 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 5C6 14 18 19 22 19C26 19 38 14 42 5C38 8 30 11 22 11C14 11 6 8 2 5Z"
                fill="url(#diyaBodyGradRight)"
              />
              <ellipse cx="22" cy="5" rx="20" ry="3" fill="#b45309" stroke="#fef3c7" strokeWidth="0.75" />
              <defs>
                <linearGradient id="diyaBodyGradRight" x1="2" y1="5" x2="42" y2="19" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9a3412" />
                  <stop offset="0.5" stopColor="#d97706" />
                  <stop offset="1" stopColor="#78350f" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Secondary Right Smaller Hanging Diya */}
        <div className="hidden md:flex absolute right-24 lg:right-36 top-0 flex-col items-center opacity-85 origin-top">
          <div className="w-[1px] h-12 sm:h-16 bg-gradient-to-b from-amber-700 to-amber-500" />
          <div className="relative -mt-0.5 flex flex-col items-center">
            <div className="w-1.5 h-3 bg-gradient-to-t from-orange-500 to-yellow-200 rounded-full animate-diwali-flicker shadow-[0_0_6px_#f59e0b]" />
            <svg className="w-6 h-3 text-amber-700 drop-shadow-xs -mt-0.5" viewBox="0 0 44 20" fill="none">
              <path d="M2 5C6 14 18 19 22 19C26 19 38 14 42 5C38 8 30 11 22 11C14 11 6 8 2 5Z" fill="#b45309" />
              <ellipse cx="22" cy="5" rx="20" ry="3" fill="#d97706" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Side Rangoli / Mandala Watermark Art (Fixed left and right margins) */}
      <div className="fixed left-0 top-1/3 -translate-y-1/2 -translate-x-1/2 pointer-events-none opacity-[0.18] sm:opacity-[0.22] z-0">
        <svg className="w-64 h-64 sm:w-96 sm:h-96 text-amber-600" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="15" fill="currentColor" opacity="0.4" />
          {/* Floral Petal Spokes */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 100 100)`}>
              <path d="M100 25 C92 45 92 65 100 75 C108 65 108 45 100 25 Z" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="18" r="2.5" fill="currentColor" />
            </g>
          ))}
        </svg>
      </div>

      <div className="fixed right-0 top-1/3 -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-[0.18] sm:opacity-[0.22] z-0">
        <svg className="w-64 h-64 sm:w-96 sm:h-96 text-amber-600" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="1" />
          <circle cx="100" cy="100" r="15" fill="currentColor" opacity="0.4" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 100 100)`}>
              <path d="M100 25 C92 45 92 65 100 75 C108 65 108 45 100 25 Z" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="18" r="2.5" fill="currentColor" />
            </g>
          ))}
        </svg>
      </div>

      {/* 3. Golden Fireworks Sparkler Ray Motifs behind the Hero Section */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-4xl pointer-events-none opacity-40 overflow-hidden h-40">
        {/* Left Burst */}
        <div className="absolute left-6 sm:left-20 top-2">
          <svg className="w-24 h-24 sm:w-32 sm:h-32 text-amber-500" viewBox="0 0 100 100" fill="none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="50"
                y1="50"
                x2={50 + 40 * Math.cos((deg * Math.PI) / 180)}
                y2={50 + 40 * Math.sin((deg * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            ))}
            {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
              <circle
                key={deg}
                cx={50 + 35 * Math.cos((deg * Math.PI) / 180)}
                cy={50 + 35 * Math.sin((deg * Math.PI) / 180)}
                r="1.5"
                fill="currentColor"
              />
            ))}
          </svg>
        </div>
        {/* Right Burst */}
        <div className="absolute right-6 sm:right-20 top-2">
          <svg className="w-24 h-24 sm:w-32 sm:h-32 text-amber-500" viewBox="0 0 100 100" fill="none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="50"
                y1="50"
                x2={50 + 40 * Math.cos((deg * Math.PI) / 180)}
                y2={50 + 40 * Math.sin((deg * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            ))}
            {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
              <circle
                key={deg}
                cx={50 + 35 * Math.cos((deg * Math.PI) / 180)}
                cy={50 + 35 * Math.sin((deg * Math.PI) / 180)}
                r="1.5"
                fill="currentColor"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* 4. Central Animated Hero Diwali Greeting */}
      <div className="relative pt-2 pb-2 text-center px-4 max-w-2xl mx-auto pointer-events-auto">
        {/* Main Title: Animated Shimmering "Happy Diwali! ✨" with interactive celebration on click */}
        <h1
          onClick={handleCelebrateClick}
          className="cursor-pointer group font-heading font-black text-3xl sm:text-4xl md:text-5xl text-[#2d0c42] tracking-tight leading-tight flex items-center justify-center gap-2 drop-shadow-xs select-none"
          title="Click to celebrate!"
        >
          <span className="bg-gradient-to-r from-[#2d0c42] via-[#851e5e] to-[#2d0c42] bg-clip-text text-transparent animate-festive-shimmer">
            {customGreeting}
          </span>
          <span className="text-amber-500 animate-bounce text-2xl sm:text-3xl select-none group-hover:scale-125 transition-transform">✨</span>
        </h1>

        {/* Subtitle / Festive Greeting message */}
        <p className="mt-1.5 text-xs sm:text-sm md:text-base font-medium text-[#5c3e6b] max-w-lg mx-auto leading-relaxed">
          {customSubtitle}
        </p>
      </div>
    </div>
  );
};
