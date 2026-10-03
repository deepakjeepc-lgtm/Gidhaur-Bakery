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
  Clock
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
  onPlayTest: (preset?: SoundPreset) => void;
  isTesting: boolean;
}

const PRESET_OPTIONS: { id: SoundPreset; name: string; desc: string; icon: string }[] = [
  {
    id: 'restaurant_chime',
    name: 'Dining Bell Chime (Default)',
    desc: 'Classic 3-tone pleasant dinner bell chime',
    icon: '🛎️'
  },
  {
    id: 'kitchen_beep',
    name: 'Kitchen KDS Beep',
    desc: 'Short crisp electronic kitchen beeps',
    icon: '📟'
  },
  {
    id: 'marimba',
    name: 'Warm Marimba',
    desc: 'Melodic acoustic marimba bell harmony',
    icon: '🎵'
  },
  {
    id: 'urgent_melody',
    name: 'Urgent Alert Tone',
    desc: 'Energetic ascending four-tone alert',
    icon: '⚡'
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
  onPlayTest,
  isTesting,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Bell className="w-5 h-5 text-slate-900 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                Order Sound Alert Settings
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Choose preset ringtones or upload your custom sound
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

        {/* Built-in Presets */}
        <div className="space-y-2.5">
          <label className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
            Select Ringtone Preset
          </label>
          <div className="grid grid-cols-1 gap-2">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = settings.preset === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => onSelectPreset(opt.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTest(opt.id);
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Preview this sound"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span className="text-[11px]">Play</span>
                    </button>
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

        {/* Custom Audio File Upload Section */}
        <div className="space-y-2.5">
          <label className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
            Custom Audio Sound (Your Own Audio / MP3)
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
                      Custom
                    </span>
                  </div>
                  <p
                    className={`text-[11px] truncate ${
                      settings.preset === 'custom' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Active custom sound from your device
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayTest('custom');
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
                    settings.preset === 'custom'
                      ? 'bg-white/20 hover:bg-white/30 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span className="text-[11px]">Play</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCustomFile();
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                  title="Remove custom audio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {settings.preset === 'custom' && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ml-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-900 bg-slate-50/60 hover:bg-white transition-all flex flex-col items-center justify-center gap-1 text-center group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-600 flex items-center justify-center transition-colors">
                <Upload className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-slate-900">
                {isUploading ? 'Loading audio file...' : 'Upload Custom MP3 / Audio Tone'}
              </span>
              <span className="text-[10px] text-slate-400">
                Supported formats: MP3, WAV, OGG, M4A (Max 5MB)
              </span>
            </button>
          )}

          {uploadError && (
            <p className="text-xs text-rose-600 font-medium px-1">
              {uploadError}
            </p>
          )}
        </div>

        {/* 2-Minute & 5-Second Interval Explanation Note */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
          <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900">
              Continuous 5s Alert Logic:
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When a new order is received, the sound will repeat <strong>every 5 seconds for up to 2 minutes</strong> until you approve (Accept) or reject/cancel the order.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onPlayTest()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-full transition-all flex items-center gap-1.5"
          >
            <Play className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Playing Test...' : 'Test Selected Sound'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
