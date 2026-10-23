/**
 * Safe Motion, Animation & Visual Tokens for Frontend Customization
 * 
 * 💡 ANTIGRAVITY & AI DEVELOPER GUIDELINE:
 * Feel free to use and tweak these animation tokens, CSS helper classes, and micro-interactions
 * for any UI button, card, modal, or screen without modifying any underlying data or logic services.
 */

export const MotionTokens = {
  // Transitions
  smoothFast: 'transition-all duration-150 ease-out',
  smoothBase: 'transition-all duration-200 ease-in-out',
  smoothSlow: 'transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)',

  // Card & Button Hover Elevates
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-transform duration-150',
  hoverLiftSoft: 'hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 transition-all duration-150',
  hoverScale: 'hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150',
  activeTap: 'active:scale-95 transition-transform duration-100',

  // Subtle Glows & Shadows
  cardShadow: 'shadow-sm hover:shadow-md transition-shadow duration-200',
  amberGlow: 'hover:shadow-[0_4px_16px_rgba(245,158,11,0.18)] transition-shadow duration-200',
  emeraldGlow: 'hover:shadow-[0_4px_16px_rgba(16,185,129,0.18)] transition-shadow duration-200',
  skyGlow: 'hover:shadow-[0_4px_16px_rgba(14,165,233,0.18)] transition-shadow duration-200',
  violetGlow: 'hover:shadow-[0_4px_16px_rgba(139,92,246,0.18)] transition-shadow duration-200',
  roseGlow: 'hover:shadow-[0_4px_16px_rgba(244,63,94,0.18)] transition-shadow duration-200',

  // Animation Utility Keyframe Classes (tailwind compatible)
  fadeIn: 'animate-fadeIn',
  slideUp: 'animate-slideUp',
  pulseSoft: 'animate-pulse',
} as const;

export type MotionPreset = keyof typeof MotionTokens;
