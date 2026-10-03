import { RestaurantSettings } from '../types';

export interface FontOption {
  id: string;
  name: string;
  category: 'sans' | 'serif' | 'mono' | 'cursive';
  fontFamily: string;
  previewText?: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  // --- Modern Sans-Serif (8) ---
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', category: 'sans', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  { id: 'Inter', name: 'Inter', category: 'sans', fontFamily: "'Inter', sans-serif" },
  { id: 'Roboto', name: 'Roboto', category: 'sans', fontFamily: "'Roboto', sans-serif" },
  { id: 'Poppins', name: 'Poppins', category: 'sans', fontFamily: "'Poppins', sans-serif" },
  { id: 'Montserrat', name: 'Montserrat', category: 'sans', fontFamily: "'Montserrat', sans-serif" },
  { id: 'Outfit', name: 'Outfit', category: 'sans', fontFamily: "'Outfit', sans-serif" },
  { id: 'Open Sans', name: 'Open Sans', category: 'sans', fontFamily: "'Open Sans', sans-serif" },
  { id: 'Lato', name: 'Lato', category: 'sans', fontFamily: "'Lato', sans-serif" },

  // --- Elegant Serifs (4) ---
  { id: 'Playfair Display', name: 'Playfair Display (Luxury Serif)', category: 'serif', fontFamily: "'Playfair Display', serif" },
  { id: 'Merriweather', name: 'Merriweather (Editorial)', category: 'serif', fontFamily: "'Merriweather', serif" },
  { id: 'Lora', name: 'Lora (Contemporary Serif)', category: 'serif', fontFamily: "'Lora', serif" },
  { id: 'Cinzel', name: 'Cinzel (Classical Roman)', category: 'serif', fontFamily: "'Cinzel', serif" },

  // --- Clean & Tech Monospace (3) ---
  { id: 'Roboto Mono', name: 'Roboto Mono (Clean Mono)', category: 'mono', fontFamily: "'Roboto Mono', monospace" },
  { id: 'JetBrains Mono', name: 'JetBrains Mono (Developer)', category: 'mono', fontFamily: "'JetBrains Mono', monospace" },
  { id: 'Space Mono', name: 'Space Mono (Retro Tech)', category: 'mono', fontFamily: "'Space Mono', monospace" },

  // --- Cursive & Handwritten Scripts (5) ---
  { id: 'Pacifico', name: 'Pacifico (Fun Brush Cursive)', category: 'cursive', fontFamily: "'Pacifico', cursive" },
  { id: 'Dancing Script', name: 'Dancing Script (Bouncy Cursive)', category: 'cursive', fontFamily: "'Dancing Script', cursive" },
  { id: 'Caveat', name: 'Caveat (Casual Handwriting)', category: 'cursive', fontFamily: "'Caveat', cursive" },
  { id: 'Great Vibes', name: 'Great Vibes (Luxury Script)', category: 'cursive', fontFamily: "'Great Vibes', cursive" },
  { id: 'Satisfy', name: 'Satisfy (Smooth Chic Brush)', category: 'cursive', fontFamily: "'Satisfy', cursive" },
];

/**
 * Apply CSS variables to :root directly without triggering React component re-renders or loops.
 */
export function applyTypographyVariables(settings: Partial<RestaurantSettings>): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 1. Global tracking (letter-spacing)
  if (typeof settings.globalTracking === 'number') {
    root.style.setProperty('--app-tracking', `${settings.globalTracking}em`);
  }

  // 2. Headline font size
  if (settings.homeHeadlineSize) {
    root.style.setProperty('--home-headline-size', `${settings.homeHeadlineSize}px`);
  }

  // 3. Headline text color
  if (settings.homeHeadlineColor) {
    root.style.setProperty('--home-headline-color', settings.homeHeadlineColor);
  }

  // 4. Headline font family
  if (settings.homeHeadlineFont) {
    const matched = AVAILABLE_FONTS.find((f) => f.id === settings.homeHeadlineFont);
    const family = matched ? matched.fontFamily : settings.homeHeadlineFont;
    root.style.setProperty('--home-headline-font', family);
  }

  // 5. Category active and inactive colors
  if (settings.categoryActiveColor) {
    root.style.setProperty('--category-active-color', settings.categoryActiveColor);
  }
  if (settings.categoryInactiveColor) {
    root.style.setProperty('--category-inactive-color', settings.categoryInactiveColor);
  }
}
