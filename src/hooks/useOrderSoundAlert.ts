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
  getNotificationPermissionStatus,
  requestNotificationPermission,
  stopCurrentlyPlayingAudio,
  SoundPreset
} from '../utils/sound';

export function useOrderSoundAlert(orders: Order[], isSoundEnabledProp?: boolean) {
  const [settings, setSettings] = useState(getSavedSoundSettings);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [alarmSecondsLeft, setAlarmSecondsLeft] = useState(120);
  const [isSoundTesting, setIsSoundTesting] = useState(false);
  const [testSecondsLeft, setTestSecondsLeft] = useState(120);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(
    getNotificationPermissionStatus
  );

  // Set of order IDs that have already been acknowledged / silenced by the user
  const acknowledgedOrderIds = useRef<Set<string>>(new Set());
  // Set of order IDs that already fired the 1-time background/lock-screen notification
  const outsideNotifiedOrderIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  // Interval & timeout refs
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const alarmStartTimestamp = useRef<number | null>(null);

  // Refresh settings from localStorage
  const refreshSettings = useCallback(() => {
    setSettings(getSavedSoundSettings());
    setPermissionStatus(getNotificationPermissionStatus());
  }, []);

  const toggleSoundEnabled = useCallback(() => {
    const next = !settings.soundEnabled;
    saveSoundEnabled(next);
    setSettings((prev) => ({ ...prev, soundEnabled: next }));
    if (!next) {
      stopCurrentlyPlayingAudio();
    }
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

  // Request browser / mobile notification permission
  const handleRequestPermission = useCallback(async () => {
    const res = await requestNotificationPermission();
    setPermissionStatus(res);
    return res;
  }, []);

  // Silence currently active alarm
  const silenceAlarm = useCallback(() => {
    // Acknowledge all currently pending orders so they won't trigger the alarm again
    orders
      .filter((o) => o.status === 'pending')
      .forEach((o) => acknowledgedOrderIds.current.add(o.id));

    setIsAlarmRinging(false);
    alarmStartTimestamp.current = null;
    stopCurrentlyPlayingAudio();

    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAlarmSecondsLeft(120);
  }, [orders]);

  // Start 2-minute ringing reminder loop
  const startRingingAlarm = useCallback(() => {
    if (isAlarmRinging) return;
    setIsAlarmRinging(true);
    setAlarmSecondsLeft(120);
    alarmStartTimestamp.current = Date.now();

    // Play immediate first chime / custom audio
    playOrderAlertChime();

    // Clear existing intervals
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Audio chime repeats every 3.5 seconds
    repeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (alarmStartTimestamp.current || now);
      if (elapsed >= 120000) {
        // 2 minutes expired
        silenceAlarm();
        return;
      }
      playOrderAlertChime();
    }, 3500);

    // Countdown second by second for up to 120s
    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - (alarmStartTimestamp.current || now)) / 1000);
      const remaining = Math.max(0, 120 - elapsed);
      setAlarmSecondsLeft(remaining);
      if (remaining <= 0) {
        silenceAlarm();
      }
    }, 1000);
  }, [isAlarmRinging, silenceAlarm]);

  // Test Phone Notification & 2-Minute Alarm
  const startTestAlert = useCallback(async () => {
    // Request permission if not already granted
    let perm = getNotificationPermissionStatus();
    if (perm !== 'granted') {
      perm = await handleRequestPermission();
    }

    // Send single test notification with vibration for phone
    sendNativeNotification(
      '🔔 Test Order Alert - Gidhaur Bakery',
      'Test order for ₹280. Phone ring & notification test successful!',
      {
        tag: 'test-order-alert',
        vibrate: [500, 250, 500, 250, 500],
      }
    );

    // Start 2-minute test audio alarm
    setIsSoundTesting(true);
    setTestSecondsLeft(120);
    const testStart = Date.now();

    playOrderAlertChime();

    if (testIntervalRef.current) clearInterval(testIntervalRef.current);
    if (testCountdownRef.current) clearInterval(testCountdownRef.current);

    testIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - testStart >= 120000) {
        stopTestAlert();
        return;
      }
      playOrderAlertChime();
    }, 3500);

    testCountdownRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - testStart) / 1000);
      const remaining = Math.max(0, 120 - elapsed);
      setTestSecondsLeft(remaining);
      if (remaining <= 0) {
        stopTestAlert();
      }
    }, 1000);
  }, [handleRequestPermission]);

  const stopTestAlert = useCallback(() => {
    setIsSoundTesting(false);
    setTestSecondsLeft(120);
    stopCurrentlyPlayingAudio();
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    if (testCountdownRef.current) {
      clearInterval(testCountdownRef.current);
      testCountdownRef.current = null;
    }
  }, []);

  // Main Effect: Watch pending orders
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (orders.length > 0) {
        // Mark existing orders as acknowledged so we don't spam upon page load
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
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

      // 1. If phone is locked or app is in background / closed: send ONE notification per order
      unhandledPendingOrders.forEach((ord) => {
        if (!outsideNotifiedOrderIds.current.has(ord.id)) {
          outsideNotifiedOrderIds.current.add(ord.id);
          sendNativeNotification(
            `🔔 New Order Received! #${ord.orderId}`,
            `${ord.customerName} placed order for ₹${ord.totalAmount}. Tap to view and accept.`,
            {
              tag: `order-${ord.orderId}`,
              vibrate: [500, 250, 500, 250, 500],
            }
          );
        }
      });

      // 2. If app is visible (open), start the continuous 2-minute alarm reminder!
      if (!isHidden && !isAlarmRinging) {
        startRingingAlarm();
      }
    } else {
      // If no pending orders remain (all were approved, rejected, or cancelled)
      if (isAlarmRinging) {
        silenceAlarm();
      }
    }
  }, [orders, isAlarmRinging, startRingingAlarm, silenceAlarm]);

  // Listener for when user returns to app / unlocks phone: start ringing if pending orders exist!
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const unhandled = orders.filter(
          (o) => o.status === 'pending' && !acknowledgedOrderIds.current.has(o.id)
        );
        if (unhandled.length > 0 && !isAlarmRinging) {
          startRingingAlarm();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [orders, isAlarmRinging, startRingingAlarm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (testIntervalRef.current) clearInterval(testIntervalRef.current);
      if (testCountdownRef.current) clearInterval(testCountdownRef.current);
      stopCurrentlyPlayingAudio();
    };
  }, []);

  return {
    settings,
    isAlarmRinging,
    alarmSecondsLeft,
    isSoundTesting,
    testSecondsLeft,
    permissionStatus,
    isAlertModalOpen,
    setIsAlertModalOpen,
    toggleSoundEnabled,
    selectPreset,
    uploadCustomFile,
    removeCustomFile,
    updateVolume,
    startTestAlert,
    stopTestAlert,
    silenceAlarm,
    handleRequestPermission,
    refreshSettings,
  };
}
