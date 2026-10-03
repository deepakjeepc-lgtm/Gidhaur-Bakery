import React, { useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Shield,
  ChefHat,
  Bike,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StaffSession } from '../../types';
import {
  getLocalDeliveryAgents,
  getLocalKitchenStaff,
  getLocalAdminAccounts,
  saveStaffSession
} from '../../services/staffService';

interface AdminLoginProps {
  onBackToStore: () => void;
  onStaffLoginSuccess: (session: StaffSession) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onBackToStore, onStaffLoginSuccess }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. Check if matches Delivery Agent registered accounts
    const deliveryAgents = getLocalDeliveryAgents();
    const matchedAgent = deliveryAgents.find(
      (a) =>
        (a.email.toLowerCase() === cleanEmail ||
          a.email.toLowerCase().replace('@swadeep.com', '@gidhaurbakery.com') === cleanEmail ||
          a.email.toLowerCase().replace('@gidhaurbakery.com', '@swadeep.com') === cleanEmail) &&
        (a.password || 'password123') === cleanPassword
    );

    if (matchedAgent) {
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

    // 2. Check if matches Kitchen Staff registered accounts
    const kitchenStaff = getLocalKitchenStaff();
    const matchedChef = kitchenStaff.find(
      (s) =>
        (s.email.toLowerCase() === cleanEmail ||
          s.email.toLowerCase().replace('@swadeep.com', '@gidhaurbakery.com') === cleanEmail ||
          s.email.toLowerCase().replace('@gidhaurbakery.com', '@swadeep.com') === cleanEmail) &&
        (s.password || 'password123') === cleanPassword
    );

    if (matchedChef) {
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

    // 3. Check for Master Admin credentials or registered Admin accounts
    const adminAccounts = getLocalAdminAccounts();
    const matchedAdmin = adminAccounts.find(
      (a) => a.email.toLowerCase() === cleanEmail && (a.password || 'admin123') === cleanPassword
    );

    if (
      matchedAdmin ||
      ((cleanEmail === 'admin@gidhaurbakery.com' || cleanEmail === 'admin@swadeep.com') &&
        (cleanPassword === 'admin123' || cleanPassword === 'admin'))
    ) {
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

    // 4. Try Firebase Auth sign in
    try {
      await signIn(cleanEmail, cleanPassword);
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
    } catch (err: any) {
      console.error('Unified login error:', err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Invalid staff credentials. Please check your email and password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again in a few minutes.');
      } else {
        setError('Login failed. Please verify your credentials or select a quick demo staff account below.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 pt-[max(calc(env(safe-area-inset-top,0px)+1.5rem),2rem)] pb-[max(calc(env(safe-area-inset-bottom,0px)+1.5rem),2rem)]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <button
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors mb-6 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-2xs"
          id="back-to-store-btn"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Menu</span>
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-6 h-6 text-slate-200" />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight">
            Staff & Admin Login
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Unified login for Admin, Kitchen Chefs, and Delivery Riders. Enter your registered staff credentials.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xs rounded-3xl border border-slate-200/80 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Staff Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="admin@gidhaurbakery.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  id="staff-email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  id="staff-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-6 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
              id="staff-login-submit-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in to Dashboard</span>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Helper Strip */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Quick Role Test Fill
            </span>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@gidhaurbakery.com', 'admin123')}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center transition-all flex flex-col items-center gap-1 group"
              >
                <Shield className="w-3.5 h-3.5 text-slate-700 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-slate-800">Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('vikram.chef@gidhaurbakery.com', 'password123')}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center transition-all flex flex-col items-center gap-1 group"
              >
                <ChefHat className="w-3.5 h-3.5 text-slate-700 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-slate-800">Chef</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('rahul.rider@gidhaurbakery.com', 'password123')}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center transition-all flex flex-col items-center gap-1 group"
              >
                <Bike className="w-3.5 h-3.5 text-slate-700 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold text-slate-800">Rider</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
