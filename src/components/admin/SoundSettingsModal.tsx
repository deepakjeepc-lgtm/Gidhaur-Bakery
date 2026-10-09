import React, { useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Bell,
  Upload,
  Trash2,
  Play,
  Check,
  Music,
  X,
  Sparkles,
  Info,
  Clock,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Square
} from 'lucide-react';
import { SoundPreset } from '../../utils/sound';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    preset: SoundPreset;
    customAudio: string | null;
    customName: string | null;
    volume: number;
    soundEnabled: boolean;
  };
  onToggleSound: () => void;
  onSelectPreset: (preset: SoundPreset) => void;
  onUploadCustomFile: (file: File) => Promise<void>;
  onRemoveCustomFile: () => void;
  onUpdateVolume: (volume: number) => void;
  onStartTest: () => void;
  onStopTest: () => void;
  isTesting: boolean;
  testSecondsLeft?: number;
  permissionStatus: 'granted' | 'denied' | 'default' | 'unsupported';
  onRequestPermission: () => Promise<string>;
}

// Exactly ONE default preset as requested by user
const PRESET_OPTIONS: { id: SoundPreset; name: string; desc: string; icon: string }[] = [
  {
    id: 'restaurant_chime',
    name: 'Dining Bell Chime (Default)',
    desc: 'Classic 3-tone pleasant dinner bell chime',
    icon: '🛎️'
  }
];

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onToggleSound,
  onSelectPreset,
  onUploadCustomFile,
  onRemoveCustomFile,
  onUpdateVolume,
  onStartTest,
  onStopTest,
  isTesting,
  testSecondsLeft = 120,
  permissionStatus,
  onRequestPermission,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      setUploadError('Please select a valid audio file (MP3, WAV, OGG, M4A)');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      await onUploadCustomFile(file);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to load audio file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-700 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                Order Sound Alert Settings
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Default chime, phone ring alerts & custom audio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Sound Switch & Volume */}
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-500" />
              )}
              <span className="font-bold text-xs sm:text-sm text-slate-900">
                Order Audio Alerts
              </span>
            </div>

            <button
              onClick={onToggleSound}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                settings.soundEnabled
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {settings.soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Alert Volume</span>
              <span className="font-mono font-bold text-slate-800">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.volume}
              onChange={(e) => onUpdateVolume(parseFloat(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
          </div>
        </div>

        {/* Lock Screen & Phone Ring Status Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 border border-amber-200/90 shadow-2xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                  Phone Lock-Screen Ring & Background Alert
                </h4>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Jab app band ho ya phone lock ho, ek baar phone ring & vibration aayega.
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                permissionStatus === 'granted'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : permissionStatus === 'denied'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              {permissionStatus === 'granted'
                ? 'Active ✅'
                : permissionStatus === 'denied'
                ? 'Blocked ❌'
                : 'Allow Needed 🔔'}
            </span>
          </div>

          {/* Explanation badge */}
          <div className="text-[11px] text-slate-600 bg-white/90 p-2.5 rounded-xl border border-amber-200/70 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
              <Clock className="w-3.5 h-3.5" /> 2-Minute Reminder Alarm
            </div>
            <p className="text-slate-500">
              App kholte hi <strong>2 minute tak reminder sound</strong> bajta rahega, jab tak aap order accept ya reject na kar dein ya manual band na karein.
            </p>
          </div>

          {/* Test & Permission Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {permissionStatus !== 'granted' && (
              <button
                type="button"
                onClick={onRequestPermission}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                Allow Notification Permission
              </button>
            )}

            {!isTesting ? (
              <button
                type="button"
                onClick={onStartTest}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-current" />
                Test Phone Ring & 2-Min Alarm
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopTest}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 animate-pulse"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop Test Alarm ({formatSeconds(testSecondsLeft)})
              </button>
            )}
          </div>
        </div>

        {/* Single Built-in Default Preset */}
        <div className="space-y-2">
          <label className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
            Default Ringtone
          </label>
          <div className="grid grid-cols-1 gap-2">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = settings.preset === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectPreset(opt.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-950 text-white border-slate-950 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{opt.icon}</span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm leading-tight">
                        {opt.name}
                      </h4>
                      <p
                        className={`text-[11px] ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Audio File Upload Section (Stored locally on this device) */}
        <div className="space-y-2">
          <label className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
            Custom Audio Sound (Your Device Audio / MP3)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a"
            onChange={handleFileChange}
            className="hidden"
          />

          {settings.customAudio ? (
            <div
              onClick={() => onSelectPreset('custom')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                settings.preset === 'custom'
                  ? 'bg-slate-950 text-white border-slate-950 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-400 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-xs sm:text-sm truncate">
                      {settings.customName || 'Custom Audio File'}
                    </h4>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Active
                    </span>
                  </div>
                  <p
                    className={`text-[11px] truncate ${
                      settings.preset === 'custom' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Stored locally on this phone/device
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {settings.preset === 'custom' && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center mr-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomFile();
                  }}
                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                  title="Remove custom audio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2 text-slate-500">
                <Upload className="w-4 h-4" />
              </div>
              <h5 className="font-bold text-xs text-slate-800">
                {isUploading ? 'Loading Audio...' : 'Upload Custom MP3 / Audio Tone'}
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supported: MP3, WAV, OGG, M4A (Max 5MB) • Stored on this device only
              </p>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
          )}
        </div>

        {/* Local Storage Privacy Note */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Uploaded audio files and volume levels are stored <strong>locally on this phone/browser</strong>. Doosre staff ya customer devices par ye audio bina permission ke play nahi hoga.
          </span>
        </div>

      </div>
    </div>
  );
};
