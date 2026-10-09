// Audio chime & notification sound manager for Swadeep Admin Console
// Supports Web Audio API synthesized tones, preset ringtones, and custom uploaded audio files (MP3/WAV)

const STORAGE_KEYS = {
  PRESET: 'swadeep_admin_sound_preset',
  CUSTOM_AUDIO: 'swadeep_admin_custom_audio',
  CUSTOM_NAME: 'swadeep_admin_custom_audio_name',
  VOLUME: 'swadeep_admin_sound_volume',
  SOUND_ENABLED: 'swadeep_admin_sound_enabled',
};

export type SoundPreset = 'restaurant_chime' | 'kitchen_beep' | 'marimba' | 'urgent_melody' | 'custom';

let audioCtx: AudioContext | null = null;
let currentPlayingAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API not supported or blocked:', e);
    return null;
  }
}

// Preset 1: Restaurant Chime (Pleasant 3-tone dining bell)
export function playSynthesizedChime(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const playBellTone = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.998, start + duration);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(gainVal * volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // A5 (880Hz) -> C#6 (1108Hz) -> E6 (1318Hz)
    playBellTone(880, now, 0.55, 0.4);
    playBellTone(1760, now, 0.35, 0.15);

    playBellTone(1108.73, now + 0.16, 0.75, 0.45);
    playBellTone(2217.46, now + 0.16, 0.45, 0.18);

    playBellTone(1318.51, now + 0.32, 0.95, 0.4);
  } catch (err) {
    console.warn('Could not play synthesized chime:', err);
  }
}

// Preset 2: Kitchen Double Beep (Digital KDS style)
export function playKitchenBeep(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const playBeep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.4 * volume, start + 0.01);
      gain.gain.setValueAtTime(0.4 * volume, start + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    playBeep(987.77, now, 0.12); // B5
    playBeep(1318.51, now + 0.16, 0.18); // E6
    playBeep(1318.51, now + 0.38, 0.22); // E6 long
  } catch (err) {
    console.warn('Could not play kitchen beep:', err);
  }
}

// Preset 3: Soft Marimba Tone
export function playMarimbaTone(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.35 * volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch (err) {
    console.warn('Could not play marimba tone:', err);
  }
}

// Preset 4: Urgent Melody Tone
export function playUrgentMelody(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [783.99, 880, 987.77, 1174.66]; // G5, A5, B5, D6

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.4 * volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch (err) {
    console.warn('Could not play urgent melody:', err);
  }
}

// Get saved audio settings
export function getSavedSoundSettings(): {
  preset: SoundPreset;
  customAudio: string | null;
  customName: string | null;
  volume: number;
  soundEnabled: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      preset: 'restaurant_chime',
      customAudio: null,
      customName: null,
      volume: 0.9,
      soundEnabled: true,
    };
  }

  const preset = (localStorage.getItem(STORAGE_KEYS.PRESET) as SoundPreset) || 'restaurant_chime';
  const customAudio = localStorage.getItem(STORAGE_KEYS.CUSTOM_AUDIO);
  const customName = localStorage.getItem(STORAGE_KEYS.CUSTOM_NAME);
  const volume = parseFloat(localStorage.getItem(STORAGE_KEYS.VOLUME) || '0.9');
  const soundEnabled = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED) !== 'false';

  return {
    preset: customAudio && preset === 'custom' ? 'custom' : preset,
    customAudio,
    customName,
    volume,
    soundEnabled,
  };
}

// Save sound settings
export function saveSoundPreset(preset: SoundPreset) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PRESET, preset);
  }
}

export function saveCustomAudio(dataUrl: string, name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO, dataUrl);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_NAME, name);
    localStorage.setItem(STORAGE_KEYS.PRESET, 'custom');
  }
}

export function clearCustomAudio() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_NAME);
    localStorage.setItem(STORAGE_KEYS.PRESET, 'restaurant_chime');
  }
}

export function saveSoundEnabled(enabled: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  }
}

export function saveVolume(vol: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.VOLUME, String(vol));
  }
}

// Master Play Function (Plays Selected Preset or Custom Uploaded Audio)
export function playOrderAlertChime(presetOverride?: SoundPreset) {
  const settings = getSavedSoundSettings();
  if (!settings.soundEnabled && !presetOverride) return;

  const activePreset = presetOverride || settings.preset;

  if (activePreset === 'custom' && settings.customAudio) {
    try {
      if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
      }
      const audio = new Audio(settings.customAudio);
      audio.volume = Math.min(Math.max(settings.volume, 0.1), 1.0);
      currentPlayingAudio = audio;
      audio.play().catch((err) => {
        console.warn('Custom audio playback failed, falling back to synthesized chime:', err);
        playSynthesizedChime(settings.volume);
      });
      return;
    } catch (e) {
      console.warn('Custom audio error:', e);
    }
  }

  // Built-in synthesized presets
  switch (activePreset) {
    case 'kitchen_beep':
      playKitchenBeep(settings.volume);
      break;
    case 'marimba':
      playMarimbaTone(settings.volume);
      break;
    case 'urgent_melody':
      playUrgentMelody(settings.volume);
      break;
    case 'restaurant_chime':
    default:
      playSynthesizedChime(settings.volume);
      break;
  }
}

// Track already alerted order IDs
const notifiedOrderIds = new Set<string>();

export function shouldNotifyNewOrder(orderId: string): boolean {
  if (notifiedOrderIds.has(orderId)) {
    return false;
  }
  notifiedOrderIds.add(orderId);
  return true;
}

export function markInitialOrdersAsSeen(orderIds: string[]) {
  orderIds.forEach((id) => notifiedOrderIds.add(id));
}

// Request and fire browser notification if allowed (with lock-screen & background Service Worker support)
export async function sendNativeNotification(
  title: string,
  body: string,
  options?: {
    tag?: string;
    url?: string;
    vibrate?: number[];
  }
) {
  if (typeof window === 'undefined') return;

  const vibratePattern = options?.vibrate || [500, 250, 500, 250, 500];

  // Hardware vibration on mobile devices
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(vibratePattern);
    }
  } catch {}

  if (!('Notification' in window)) return;

  try {
    let perm = Notification.permission;
    if (perm !== 'granted' && perm !== 'denied') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') return;

    // Use ServiceWorker registration when available (shows on lock-screen & when app is background/closed)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: options?.tag || 'gidhaur-order-alert',
            vibrate: vibratePattern,
            requireInteraction: true,
            data: { url: options?.url || '/' },
          } as any);
          return;
        }
      } catch (swErr) {
        console.warn('SW notification fallback to window Notification:', swErr);
      }
    }

    // Standard Notification fallback
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: options?.tag || 'gidhaur-order-alert',
    });
  } catch (e) {
    console.warn('Browser notification error:', e);
  }
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export function stopCurrentlyPlayingAudio() {
  if (currentPlayingAudio) {
    try {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
    } catch {}
    currentPlayingAudio = null;
  }
}
