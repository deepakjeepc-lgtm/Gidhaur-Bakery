import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { readGuard } from '../services/firestoreReadGuard';

export const ReadLimitProtectionBanner: React.FC = () => {
  const [isActive, setIsActive] = useState(() => readGuard.isRateLimited());
  const [remainingSecs, setRemainingSecs] = useState(() => readGuard.getBlockedRemainingSeconds());
  const [isEmergency, setIsEmergency] = useState(() => readGuard.isEmergencyDisabled());

  useEffect(() => {
    const handleEvent = (e: any) => {
      const detail = e.detail || {};
      setIsActive(Boolean(detail.isActive));
      setRemainingSecs(detail.blockedRemainingSeconds || 0);
      setIsEmergency(Boolean(detail.isEmergency));
    };

    window.addEventListener('fs_read_protection_changed', handleEvent);
    const interval = setInterval(() => {
      if (readGuard.isRateLimited()) {
        setIsActive(true);
        setRemainingSecs(readGuard.getBlockedRemainingSeconds());
        setIsEmergency(readGuard.isEmergencyDisabled());
      } else if (isActive) {
        setIsActive(false);
      }
    }, 2000);

    return () => {
      window.removeEventListener('fs_read_protection_changed', handleEvent);
      clearInterval(interval);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-stone-900 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
      <ShieldAlert className="w-4 h-4 text-stone-950 shrink-0" />
      <span>
        Read limit protection active
        {isEmergency
          ? ' (FS_READS_DISABLED=1 emergency switch)'
          : remainingSecs > 0
          ? ` (Blocked for ${Math.ceil(remainingSecs / 60)}m to preserve quota)`
          : ''}
      </span>
    </div>
  );
};
