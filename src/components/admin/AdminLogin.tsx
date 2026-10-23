import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StaffSession } from '../../types';
import {
  getLocalDeliveryAgents,
  getLocalKitchenStaff,
  getLocalPreparingStaff,
  getLocalAdminAccounts,
  saveStaffSession
} from '../../services/staffService';

interface AdminLoginProps {
  onBackToStore: () => void;
  onStaffLoginSuccess: (session: StaffSession) => void;
}

const LOCKOUT_STORAGE_KEY = 'swadeep_login_lockout_until';
const FAILED_ATTEMPTS_STORAGE_KEY = 'swadeep_login_failed_attempts';
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_BEFORE_LOCK = 3;

export const AdminLogin = React.memo<AdminLoginProps>(({ onBackToStore, onStaffLoginSuccess }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  });

  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(LOCKOUT_STORAGE_KEY) || '0', 10) || 0;
      return saved > Date.now() ? saved : 0;
    } catch {
      return 0;
    }
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (lockoutUntil > Date.now()) {
      return Math.ceil((lockoutUntil - Date.now()) / 1000);
    }
    return 0;
  });

  useEffect(() => {
    if (!lockoutUntil || lockoutUntil <= Date.now()) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        setLockoutUntil(0);
        setError(null);
        try {
          localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        } catch {}
      } else {
        setRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [lockoutUntil]);

  const clearLoginPenalty = () => {
    setFailedAttempts(0);
    setLockoutUntil(0);
    setRemainingSeconds(0);
    try {
      localStorage.removeItem(FAILED_ATTEMPTS_STORAGE_KEY);
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    } catch {}
  };

  const recordFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    try {
      localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, String(nextAttempts));
    } catch {}

    if (nextAttempts % MAX_ATTEMPTS_BEFORE_LOCK === 0) {
      const until = Date.now() + LOCKOUT_DURATION_MS;
      setLockoutUntil(until);
      setRemainingSeconds(60);
      setError(null);
      try {
        localStorage.setItem(LOCKOUT_STORAGE_KEY, String(until));
      } catch {}
    } else {
      const attemptsLeft = MAX_ATTEMPTS_BEFORE_LOCK - (nextAttempts % MAX_ATTEMPTS_BEFORE_LOCK);
      setError(`Invalid ID or password (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingSeconds > 0) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Enter ID and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. Check Delivery Agent accounts
    const deliveryAgents = getLocalDeliveryAgents();
    const matchedAgent = deliveryAgents.find(
      (a) =>
        (a.email.toLowerCase() === cleanEmail ||
          a.email.toLowerCase().replace('@swadeep.com', '@gidhaurbakery.com') === cleanEmail ||
          a.email.toLowerCase().replace('@gidhaurbakery.com', '@swadeep.com') === cleanEmail) &&
        (a.password || 'password123') === cleanPassword
    );

    if (matchedAgent) {
      clearLoginPenalty();
      setIsLoading(false);
      const session: StaffSession = {
        role: 'delivery',
        data: {
          id: matchedAgent.id,
          name: matchedAgent.name,
          email: matchedAgent.email,
          phone: matchedAgent.phone
        }
      };
      saveStaffSession(session);
      onStaffLoginSuccess(session);
      return;
    }

    // 2. Check Kitchen Staff accounts
    const kitchenStaff = getLocalKitchenStaff();
    const matchedChef = kitchenStaff.find(
      (s) =>
        (s.email.toLowerCase() === cleanEmail ||
          s.email.toLowerCase().replace('@swadeep.com', '@gidhaurbakery.com') === cleanEmail ||
          s.email.toLowerCase().replace('@gidhaurbakery.com', '@swadeep.com') === cleanEmail) &&
        (s.password || 'password123') === cleanPassword
    );

    if (matchedChef) {
      clearLoginPenalty();
      setIsLoading(false);
      const session: StaffSession = {
        role: 'kitchen',
        data: {
          id: matchedChef.id,
          name: matchedChef.name,
          email: matchedChef.email,
          phone: matchedChef.phone
        }
      };
      saveStaffSession(session);
      onStaffLoginSuccess(session);
      return;
    }

    // 3. Check Preparing & Packing Staff accounts
    const preparingStaff = getLocalPreparingStaff();
    const matchedPrep = preparingStaff.find(
      (s) =>
        (s.email.toLowerCase() === cleanEmail ||
          s.email.toLowerCase().replace('@swadeep.com', '@gidhaurbakery.com') === cleanEmail ||
          s.email.toLowerCase().replace('@gidhaurbakery.com', '@swadeep.com') === cleanEmail) &&
        (s.password || 'password123') === cleanPassword
    );

    if (matchedPrep) {
      clearLoginPenalty();
      setIsLoading(false);
      const session: StaffSession = {
        role: 'preparing',
        data: {
          id: matchedPrep.id,
          name: matchedPrep.name,
          email: matchedPrep.email,
          phone: matchedPrep.phone
        }
      };
      saveStaffSession(session);
      onStaffLoginSuccess(session);
      return;
    }

    // 4. Check Master Admin or registered Admin accounts
    const adminAccounts = getLocalAdminAccounts();
    const matchedAdmin = adminAccounts.find(
      (a) => a.email.toLowerCase() === cleanEmail && (a.password || 'admin123') === cleanPassword
    );

    if (
      matchedAdmin ||
      ((cleanEmail === 'admin@gidhaurbakery.com' || cleanEmail === 'admin@swadeep.com') &&
        (cleanPassword === 'admin123' || cleanPassword === 'admin'))
    ) {
      clearLoginPenalty();
      setIsLoading(false);
      const session: StaffSession = {
        role: 'admin',
        data: {
          id: matchedAdmin?.id || 'admin-master',
          name: matchedAdmin?.name || 'Master Admin',
          email: cleanEmail
        }
      };
      saveStaffSession(session);
      onStaffLoginSuccess(session);
      return;
    }

    // 5. Try Firebase Auth sign in
    try {
      await signIn(cleanEmail, cleanPassword);
      clearLoginPenalty();
      const session: StaffSession = {
        role: 'admin',
        data: {
          id: 'fb-admin',
          name: cleanEmail.split('@')[0],
          email: cleanEmail
        }
      };
      saveStaffSession(session);
      onStaffLoginSuccess(session);
    } catch {
      recordFailedAttempt();
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = remainingSeconds > 0;
  const formattedTimer = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(
    remainingSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <div className="admin-curator-console min-h-screen bg-[#0A0A0A] text-[#FFFFFF] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <button
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] mb-4 px-3 py-1.5 rounded-sm bg-[#18181B] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
          id="back-to-store-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="bg-[#18181B] p-6 sm:p-7 rounded-sm border border-[#27272A] space-y-4">
          {isLocked && (
            <div className="p-3 bg-[#0A0A0A] border border-[#EF4444]/50 rounded-sm text-xs font-mono text-[#EF4444] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span>Locked for 1 min</span>
              </div>
              <span className="font-bold tracking-wider">{formattedTimer}</span>
            </div>
          )}

          {!isLocked && error && (
            <div className="p-3 bg-[#0A0A0A] border border-[#EF4444]/40 rounded-sm text-xs font-mono text-[#EF4444] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div>
              <input
                type="text"
                name="login_id_field"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={isLocked || isLoading}
                placeholder="ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#27272A] rounded-sm text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF] disabled:opacity-40"
                id="staff-email-input"
              />
            </div>

            <div>
              <input
                type="password"
                name="login_password_field"
                autoComplete="new-password"
                required
                disabled={isLocked || isLoading}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#27272A] rounded-sm text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF] disabled:opacity-40"
                id="staff-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full py-2.5 px-6 bg-[#FF5500] hover:bg-[#E04B00] disabled:opacity-40 text-[#FFFFFF] border border-[#FF5500] font-mono font-bold text-xs uppercase tracking-[0.06em] rounded-sm flex items-center justify-center gap-2 cursor-pointer"
              id="staff-login-submit-btn"
            >
              {isLocked ? (
                <span>Wait {formattedTimer}</span>
              ) : isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});

AdminLogin.displayName = 'AdminLogin';

export default AdminLogin;

