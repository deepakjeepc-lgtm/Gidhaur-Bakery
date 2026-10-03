import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserPlus,
  Trash2,
  Edit2,
  KeyRound,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock
} from 'lucide-react';
import {
  AdminAccount,
  getLocalAdminAccounts,
  addAdminAccount,
  updateAdminAccount,
  deleteAdminAccount
} from '../../services/staffService';

export const AdminAccountsManagement: React.FC = () => {
  const [admins, setAdmins] = useState<AdminAccount[]>(() => getLocalAdminAccounts());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminAccount | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager'>('admin');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Password visibility map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setAdmins(e.detail);
      } else {
        setAdmins(getLocalAdminAccounts());
      }
    };
    window.addEventListener('gidhaur_admins_updated', handleUpdate);
    return () => window.removeEventListener('gidhaur_admins_updated', handleUpdate);
  }, []);

  const togglePasswordVisibility = (adminId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };

  const openAddModal = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('admin');
    setPhone('');
    setFormError(null);
    setEditingAdmin(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (admin: AdminAccount) => {
    setName(admin.name);
    setEmail(admin.email);
    setPassword(admin.password || '');
    setRole(admin.role === 'manager' ? 'manager' : 'admin');
    setPhone(admin.phone || '');
    setFormError(null);
    setEditingAdmin(admin);
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName) {
      setFormError('Admin name is required.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 4) {
      setFormError('Password must be at least 4 characters long.');
      return;
    }

    try {
      if (editingAdmin) {
        await updateAdminAccount(editingAdmin.id, {
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          role: editingAdmin.role === 'master_admin' ? 'master_admin' : role,
          phone: phone.trim()
        });
        setSuccessMessage(`Admin "${cleanName}" updated successfully!`);
      } else {
        // Check for duplicate email
        const exists = admins.some((a) => a.email.toLowerCase() === cleanEmail);
        if (exists) {
          setFormError('An admin with this email already exists.');
          return;
        }
        await addAdminAccount({
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          role,
          phone: phone.trim()
        });
        setSuccessMessage(`New admin "${cleanName}" created successfully!`);
      }

      setAdmins(getLocalAdminAccounts());
      setIsAddModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save admin account.');
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;
    const success = await deleteAdminAccount(deletingAdmin.id);
    if (success) {
      setSuccessMessage(`Admin "${deletingAdmin.name}" removed successfully.`);
      setAdmins(getLocalAdminAccounts());
    } else {
      setFormError('Primary Master Admin account cannot be deleted.');
    }
    setDeletingAdmin(null);
    setTimeout(() => {
      setSuccessMessage(null);
      setFormError(null);
    }, 3500);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Manage Admin Accounts
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {admins.length} {admins.length === 1 ? 'Admin' : 'Admins'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Create new admin accounts, update credentials, or manage existing administrator logins.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer self-start sm:self-auto shrink-0"
          id="add-admin-btn"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add New Admin</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Admin Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {admins.map((admin) => {
          const isMaster = admin.role === 'master_admin' || admin.id === 'admin-master';
          const isPwVisible = visiblePasswords[admin.id];

          return (
            <div
              key={admin.id}
              className={`p-4 rounded-2xl border transition-all ${
                isMaster
                  ? 'bg-slate-50/70 border-slate-200/90 shadow-2xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-heading font-extrabold text-sm shrink-0 ${
                      isMaster
                        ? 'bg-amber-100 text-amber-900 border border-amber-300/60'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {admin.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-sm text-slate-900 truncate">
                        {admin.name}
                      </span>
                      {isMaster ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider">
                          Primary Master
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                          {admin.role === 'manager' ? 'Store Manager' : 'Admin'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{admin.email}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(admin)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Admin"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!isMaster && (
                    <button
                      onClick={() => setDeletingAdmin(admin)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Admin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password & Credentials line */}
              <div className="mt-3 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400 text-[11px] font-medium">Password:</span>
                  <span className="font-mono text-slate-700 font-semibold">
                    {isPwVisible ? (admin.password || 'admin123') : '••••••••'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(admin.id)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
                  title={isPwVisible ? 'Hide password' : 'Show password'}
                >
                  {isPwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h4 className="font-heading font-extrabold text-base text-slate-900">
                  {editingAdmin ? 'Edit Administrator' : 'Add New Administrator'}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikash Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Login Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikash@gidhaurbakery.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Login Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Set secure password (min 4 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role & Permissions
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900 cursor-pointer"
                  >
                    <option value="admin">Full Admin</option>
                    <option value="manager">Store Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {editingAdmin ? 'Save Changes' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Delete Admin Account?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{deletingAdmin.name}</strong> ({deletingAdmin.email})?
                This administrator will immediately lose access to the console.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
