import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Trash2,
  Edit2,
  KeyRound,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  AdminAccount,
  getLocalAdminAccounts,
  addAdminAccount,
  updateAdminAccount,
  deleteAdminAccount
} from '../../services/staffService';

export const AdminAccountsManagement = React.memo(() => {
  const [admins, setAdmins] = useState<AdminAccount[]>(() => getLocalAdminAccounts());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AdminAccount | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager'>('admin');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#A1A1AA] border border-[#27272A]">
            SECURITY
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[#FFFFFF]">
              Admin Accounts
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#FFFFFF] border border-[#27272A] tabular-nums">
              {admins.length}
            </span>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] border border-[#FF5500] cursor-pointer self-start sm:self-auto shrink-0"
          id="add-admin-btn"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Admin</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#10B981]/40 text-xs font-mono text-[#10B981] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
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
              className="p-3.5 rounded-sm border border-[#27272A] hover:border-[#3F3F46] bg-[#0A0A0A]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-sm border border-[#27272A] bg-[#18181B] text-[#FFFFFF] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    {admin.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#FFFFFF] truncate">
                        {admin.name}
                      </span>
                      {isMaster ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#FFFFFF] text-[#0A0A0A] border border-[#FFFFFF] uppercase tracking-[0.06em]">
                          MASTER
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-[#18181B] text-[#A1A1AA] border border-[#27272A] uppercase tracking-[0.06em]">
                          {admin.role === 'manager' ? 'MANAGER' : 'ADMIN'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#A1A1AA] mt-0.5 truncate">
                      <Mail className="w-3 h-3 text-[#71717A] shrink-0" />
                      <span className="truncate">{admin.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(admin)}
                    className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#18181B] hover:border-[#FFFFFF] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer"
                    title="Edit Admin"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  {!isMaster && (
                    <button
                      onClick={() => setDeletingAdmin(admin)}
                      className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#18181B] hover:border-[#EF4444] text-[#71717A] hover:text-[#EF4444] flex items-center justify-center cursor-pointer"
                      title="Delete Admin"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#27272A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-3 h-3 text-[#71717A]" />
                  <span className="text-[#71717A] text-[10px] font-mono uppercase tracking-[0.06em]">PIN:</span>
                  <span className="font-mono text-[#FFFFFF] font-bold">
                    {isPwVisible ? (admin.password || 'admin123') : '••••••••'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(admin.id)}
                  className="text-[#71717A] hover:text-[#FFFFFF] p-1 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#71717A] block">
                  ADMINISTRATION
                </span>
                <h4 className="font-bold text-base text-[#FFFFFF]">
                  {editingAdmin ? 'Edit Administrator' : 'Add Administrator'}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#0A0A0A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#EF4444]/40 text-xs font-mono text-[#EF4444] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikash Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
                  Login Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. vikash@swadeep.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
                  Login Password / PIN
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                  <input
                    type="text"
                    required
                    placeholder="Min 4 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] cursor-pointer"
                  >
                    <option value="admin">Full Admin</option>
                    <option value="manager">Store Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.08em] text-[#A1A1AA] mb-1">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] border border-[#FF5500] cursor-pointer"
                >
                  {editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#71717A] block">
                CONFIRM REMOVAL
              </span>
              <h4 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
                Delete {deletingAdmin.name}?
              </h4>
              <p className="text-xs text-[#A1A1AA]">This user will lose access to the console immediately.</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="flex-1 py-2 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#EF4444] hover:bg-[#DC2626] border border-[#EF4444] cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AdminAccountsManagement.displayName = 'AdminAccountsManagement';
