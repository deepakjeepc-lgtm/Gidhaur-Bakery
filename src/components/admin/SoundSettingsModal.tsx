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
  Info,
  Clock,
  Smartphone,
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

const PRESET_OPTIONS: { id: SoundPreset; name: string; desc: string; icon: string }[] = [
  {
    id: 'restaurant_chime',
    name: 'Dining Bell Chime (Default)',
    desc: 'Classic 3-tone pleasant dinner bell chime',
    icon: '🛎️'
  }
];

export const SoundSettingsModal = React.memo<SoundSettingsModalProps>(({
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
    <div className="fixed inset-0 z-50 bg-[#0A0A0A]/85 flex items-center justify-center p-4">
      <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#FF5500] border border-[#27272A]">
              AUDIO
            </span>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-[-0.02em] text-[#FFFFFF] leading-tight">
                Order Sound Alert Settings
              </h3>
              <p className="text-xs text-[#A1A1AA] font-normal">
                Default chime, phone ring alerts &amp; custom audio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#0A0A0A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Master Sound Switch & Volume */}
        <div className="bg-[#0A0A0A] p-4 rounded-sm border border-[#27272A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#10B981]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#71717A]" />
              )}
              <span className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#FFFFFF]">
                Order Audio Alerts
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              onClick={onToggleSound}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                settings.soundEnabled ? 'bg-[#10B981] border-[#10B981]' : 'bg-[#18181B] border-[#3F3F46]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                  settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-[#A1A1AA] font-mono tabular-nums">
              <span>ALERT VOLUME</span>
              <span className="font-bold text-[#FFFFFF]">
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
              className="w-full accent-[#FF5500] cursor-pointer h-1.5 bg-[#27272A] rounded-sm appearance-none"
            />
          </div>
        </div>

        {/* Lock Screen & Phone Ring Status Card */}
        <div className="p-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-sm border border-[#27272A] bg-[#18181B] text-[#FFFFFF] flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-[#FF5500]" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[#FFFFFF]">
                  Phone Lock-Screen Ring &amp; Background Alert
                </h4>
                <p className="text-[11px] text-[#A1A1AA] leading-tight">
                  Jab app band ho ya phone lock ho, ek baar phone ring &amp; vibration aayega.
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] border ${
                permissionStatus === 'granted'
                  ? 'bg-[#18181B] text-[#10B981] border-[#10B981]/40'
                  : 'bg-[#18181B] text-[#F59E0B] border-[#F59E0B]/40'
              }`}
            >
              {permissionStatus === 'granted'
                ? 'Active'
                : permissionStatus === 'denied'
                ? 'Blocked'
                : 'Allow Needed'}
            </span>
          </div>

          <div className="text-[11px] text-[#A1A1AA] bg-[#18181B] p-3 rounded-sm border border-[#27272A] space-y-1">
            <div className="flex items-center gap-1.5 text-[#FFFFFF] font-mono font-bold text-[10px] uppercase tracking-[0.06em]">
              <Clock className="w-3.5 h-3.5 text-[#FF5500]" /> 2-Minute Reminder Alarm
            </div>
            <p className="text-[#A1A1AA]">
              App kholte hi <strong className="text-[#FFFFFF]">2 minute tak reminder sound</strong> bajta rahega, jab tak aap order accept ya reject na kar dein ya manual band na karein.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {permissionStatus !== 'granted' && (
              <button
                type="button"
                onClick={onRequestPermission}
                className="px-3.5 py-1.5 rounded-sm bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#0A0A0A] text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                Allow Notification Permission
              </button>
            )}

            {!isTesting ? (
              <button
                type="button"
                onClick={onStartTest}
                className="px-3.5 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer tabular-nums"
              >
                <Play className="w-3 h-3 fill-current" />
                Test Alarm ({formatSeconds(testSecondsLeft)})
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopTest}
                className="px-3.5 py-1.5 rounded-sm bg-[#EF4444] hover:bg-[#DC2626] border border-[#EF4444] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer tabular-nums"
              >
                <Square className="w-3 h-3 fill-current" />
                Stop Test Alarm ({formatSeconds(testSecondsLeft)})
              </button>
            )}
          </div>
        </div>

        {/* Single Built-in Default Preset */}
        <div className="space-y-2">
          <label className="font-mono font-bold text-[#71717A] uppercase tracking-[0.08em] text-[10px] block">
            Default Ringtone
          </label>
          <div className="grid grid-cols-1 gap-2">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = settings.preset === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectPreset(opt.id)}
                  className={`p-3.5 rounded-sm border cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#FFFFFF]'
                      : 'bg-[#0A0A0A] border-[#27272A] hover:border-[#3F3F46] text-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{opt.icon}</span>
                    <div>
                      <h4 className="font-bold text-xs text-[#FFFFFF] leading-tight">
                        {opt.name}
                      </h4>
                      <p className="text-[11px] text-[#71717A]">
                        {opt.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected && (
                      <div className="w-4 h-4 rounded-sm bg-[#FF5500] text-[#FFFFFF] flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Audio File Upload Section */}
        <div className="space-y-2">
          <label className="font-mono font-bold text-[#71717A] uppercase tracking-[0.08em] text-[10px] block">
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
              className={`p-3.5 rounded-sm border cursor-pointer flex items-center justify-between gap-3 ${
                settings.preset === 'custom'
                  ? 'bg-[#0A0A0A] text-[#FFFFFF] border-[#FFFFFF]'
                  : 'bg-[#0A0A0A] border-[#27272A] hover:border-[#3F3F46] text-[#A1A1AA]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-sm border border-[#27272A] bg-[#18181B] text-[#FF5500] flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-xs text-[#FFFFFF] truncate">
                      {settings.customName || 'Custom Audio File'}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#18181B] text-[#10B981] border border-[#10B981]/40 text-[10px] font-mono">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] truncate text-[#71717A]">
                    Stored locally on this phone/device
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {settings.preset === 'custom' && (
                  <div className="w-4 h-4 rounded-sm bg-[#FF5500] text-[#FFFFFF] flex items-center justify-center mr-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomFile();
                  }}
                  className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#18181B] hover:border-[#EF4444] text-[#71717A] hover:text-[#EF4444] flex items-center justify-center cursor-pointer"
                  title="Remove custom audio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#3F3F46] hover:border-[#FFFFFF] rounded-sm p-4 text-center cursor-pointer bg-[#0A0A0A] hover:bg-[#121212]"
            >
              <div className="w-8 h-8 rounded-sm border border-[#27272A] flex items-center justify-center mx-auto mb-2 text-[#FF5500] bg-[#18181B]">
                <Upload className="w-4 h-4" />
              </div>
              <h5 className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#FFFFFF]">
                {isUploading ? 'Loading Audio...' : 'Upload Custom MP3 / Audio Tone'}
              </h5>
              <p className="text-[11px] text-[#71717A] mt-0.5 font-mono">
                Supported: MP3, WAV, OGG, M4A (Max 5MB) · Stored locally
              </p>
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-[#EF4444] font-mono">{uploadError}</p>
          )}
        </div>

        {/* Local Storage Privacy Note */}
        <div className="bg-[#0A0A0A] p-3 rounded-sm border border-[#27272A] flex items-start gap-2 text-[11px] text-[#A1A1AA]">
          <Info className="w-3.5 h-3.5 text-[#71717A] shrink-0 mt-0.5" />
          <span>
            Uploaded audio files and volume levels are stored <strong className="text-[#FFFFFF]">locally on this phone/browser</strong>.
          </span>
        </div>

      </div>
    </div>
  );
});

SoundSettingsModal.displayName = 'SoundSettingsModal';
