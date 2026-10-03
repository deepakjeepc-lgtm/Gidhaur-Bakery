import { useState, useEffect, useRef, useCallback } from 'react';
import { Order } from '../types';
import {
  playOrderAlertChime,
  getSavedSoundSettings,
  saveSoundPreset,
  saveCustomAudio,
  clearCustomAudio,
  saveSoundEnabled,
  saveVolume,
  sendNativeNotification,
  SoundPreset
} from '../utils/sound';

export function useOrderSoundAlert(orders: Order[], isSoundEnabledProp?: boolean) {
  const [settings, setSettings] = useState(getSavedSoundSettings);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [isSoundTesting, setIsSoundTesting] = useState(false);

  // Set of order IDs that have already been silenced / acknowledged by user in this session
  const acknowledgedOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const alarmStartTimestamp = useRef<number | null>(null);

  // Sync settings
  const refreshSettings = useCallback(() => {
    setSettings(getSavedSoundSettings());
  }, []);

  const toggleSoundEnabled = useCallback(() => {
    const next = !settings.soundEnabled;
    saveSoundEnabled(next);
    setSettings((prev) => ({ ...prev, soundEnabled: next }));
  }, [settings.soundEnabled]);

  const selectPreset = useCallback((preset: SoundPreset) => {
    saveSoundPreset(preset);
    setSettings((prev) => ({ ...prev, preset }));
    playOrderAlertChime(preset);
  }, []);

  const uploadCustomFile = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Audio file size must be less than 5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        saveCustomAudio(dataUrl, file.name);
        refreshSettings();
        playOrderAlertChime('custom');
        resolve();
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }, [refreshSettings]);

  const removeCustomFile = useCallback(() => {
    clearCustomAudio();
    refreshSettings();
  }, [refreshSettings]);

  const updateVolume = useCallback((vol: number) => {
    saveVolume(vol);
    setSettings((prev) => ({ ...prev, volume: vol }));
  }, []);

  const playTestAlert = useCallback((overridePreset?: SoundPreset) => {
    setIsSoundTesting(true);
    playOrderAlertChime(overridePreset);
    setTimeout(() => setIsSoundTesting(false), 1500);
  }, []);

  const silenceAlarm = useCallback(() => {
    // Acknowledge all currently pending orders
    orders
      .filter((o) => o.status === 'pending')
      .forEach((o) => acknowledgedOrderIds.current.add(o.id));
    setIsAlarmRinging(false);
    alarmStartTimestamp.current = null;
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, [orders]);

  // Main Effect: Watch pending orders and run repeating 5-second sound alert for up to 2 minutes
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (orders.length > 0) {
        // First load: mark existing orders as acknowledged so we don't spam upon dashboard opening
        orders.forEach((o) => acknowledgedOrderIds.current.add(o.id));
        initialLoadDone.current = true;
      }
      return;
    }

    // Find new pending orders that haven't been acknowledged
    const unhandledPendingOrders = orders.filter(
      (o) => o.status === 'pending' && !acknowledgedOrderIds.current.has(o.id)
    );

    const hasActivePending = unhandledPendingOrders.length > 0;

    if (hasActivePending) {
      if (!isAlarmRinging) {
        setIsAlarmRinging(true);
        alarmStartTimestamp.current = Date.now();

        // Fire instant initial chime and native push notification
        playOrderAlertChime();
        const firstOrder = unhandledPendingOrders[0];
        sendNativeNotification(
          `🔔 New Order Received! #${firstOrder.orderId}`,
          `${firstOrder.customerName} ordered for ₹${firstOrder.totalAmount}. Tap to review.`
        );

        // Start repeating chime every 5 seconds (5000ms) for up to 2 minutes (120000ms)
        if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);

        repeatIntervalRef.current = setInterval(() => {
          const now = Date.now();
          const elapsed = now - (alarmStartTimestamp.current || now);

          // Stop after 2 minutes (120,000 ms) automatically
          if (elapsed >= 120000) {
            if (repeatIntervalRef.current) {
              clearInterval(repeatIntervalRef.current);
              repeatIntervalRef.current = null;
            }
            setIsAlarmRinging(false);
            return;
          }

          // Play repeating chime
          playOrderAlertChime();
        }, 5000);
      }
    } else {
      // If no pending orders remain (or all were approved/rejected/cancelled)
      if (isAlarmRinging || repeatIntervalRef.current) {
        setIsAlarmRinging(false);
        alarmStartTimestamp.current = null;
        if (repeatIntervalRef.current) {
          clearInterval(repeatIntervalRef.current);
          repeatIntervalRef.current = null;
        }
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [orders, isAlarmRinging]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
      }
    };
  }, []);

  return {
    settings,
    isAlarmRinging,
    isSoundTesting,
    isAlertModalOpen,
    setIsAlertModalOpen,
    toggleSoundEnabled,
    selectPreset,
    uploadCustomFile,
    removeCustomFile,
    updateVolume,
    playTestAlert,
    silenceAlarm,
  };
}
