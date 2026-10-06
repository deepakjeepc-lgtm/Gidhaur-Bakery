import React, { useState } from 'react';
import {
  PackageCheck,
  Plus,
  Phone,
  Mail,
  KeyRound,
  CheckCircle2,
  Trash2,
  Edit2,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Power,
  Eye,
  Boxes
} from 'lucide-react';
import { PreparingStaff } from '../../types';
import { addPreparingStaff, updatePreparingStaff, deletePreparingStaff } from '../../services/staffService';

interface PreparingStaffManagementProps {
  staffList: PreparingStaff[];
  onDirectViewPrep?: (staff: PreparingStaff) => void;
}

export const PreparingStaffManagement: React.FC<PreparingStaffManagementProps> = ({
  staffList,
  onDirectViewPrep
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PreparingStaff | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<PreparingStaff | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Lead Packer & Props Specialist');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setRole('Lead Packer & Props Specialist');
    setFormError(null);
    setEditingStaff(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (staff: PreparingStaff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setPhone(staff.phone);
    setEmail(staff.email);
    setPassword(staff.password || 'prep123');
    setRole(staff.role);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      setFormError('Please fill in Name, Phone, Email, and Password.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingStaff) {
        await updatePreparingStaff(editingStaff.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role
        });
      } else {
        await addPreparingStaff({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role,
          status: 'active'
        });
      }
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: PreparingStaff) => {
    const nextStatus = staff.status === 'active' ? 'inactive' : 'active';
    await updatePreparingStaff(staff.id, { status: nextStatus });
  };

  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await deletePreparingStaff(deletingStaff.id);
      setDeletingStaff(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete preparing staff');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCredentials = (staff: PreparingStaff) => {
    const text = `Preparing & Packing Staff Login:\nEmail: ${staff.email}\nPassword: ${staff.password || 'prep123'}\nPortal: ${window.location.origin}/preparing`;
    navigator.clipboard.writeText(text);
    setCopiedId(staff.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-indigo-300">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Packing & Prep Department</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading tracking-tight">
            Preparing & Packing Staff
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Staff in this department receive non-food items, party accessories, candles, and balloons on their checklist and pack them safely for delivery riders.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Preparing Staff</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, phone or role..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span className="px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
            Total Staff: <strong>{staffList.length}</strong>
          </span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 shadow-2xs">
            Active: <strong>{staffList.filter((s) => s.status === 'active').length}</strong>
          </span>
        </div>
      </div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Boxes className="w-8 h-8" />
          </div>
          <h3 className="font-heading font-bold text-slate-800 text-base">
            No preparing staff members found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add team members responsible for packaging non-food celebration items, candles, and party props.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-slate-800 transition-all"
          >
            Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => {
            const isActive = staff.status === 'active';

            return (
              <div
                key={staff.id}
                className={`bg-white rounded-3xl border p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                  isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/50 opacity-80'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm shrink-0">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-heading font-black text-sm text-slate-900 leading-tight">
                          {staff.name}
                        </h4>
                        <span className="text-[11px] font-bold text-indigo-600 block mt-0.5">
                          {staff.role}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(staff)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                      title={isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <Power className="w-3 h-3" />
                      <span>{isActive ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 pt-2 text-xs text-slate-600 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a href={`tel:${staff.phone}`} className="hover:text-indigo-600 font-mono font-medium">
                        {staff.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-slate-700">{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-slate-500">
                        PIN: <strong className="text-slate-800">{staff.password || 'prep123'}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-1.5">
                    {onDirectViewPrep && (
                      <button
                        onClick={() => onDirectViewPrep(staff)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-800 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                        title="Open preparing portal for this agent"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Open Portal</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyCredentials(staff)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all border border-slate-200"
                      title="Copy login details"
                    >
                      {copiedId === staff.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(staff)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition-all border border-slate-200"
                      title="Edit staff details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingStaff(staff)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all border border-red-200 cursor-pointer"
                      title="Delete staff"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-black text-base text-slate-900">
                  {editingStaff ? 'Edit Preparing Staff' : 'Add Preparing Staff'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Suresh Verma"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Address (Login ID) *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. suresh.prep@gidhaurbakery.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Login PIN / Password *
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. prep123"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Department Role / Station
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="Lead Packer & Props Specialist">Lead Packer & Props Specialist</option>
                  <option value="Party Accessories & Balloons Packer">Party Accessories & Balloons Packer</option>
                  <option value="Candles & Cutlery Packing Agent">Candles & Cutlery Packing Agent</option>
                  <option value="General Packaging & Dispatch Associate">General Packaging & Dispatch Associate</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (No window.confirm, iframe safe) */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Remove Preparing Staff?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{deletingStaff.name}</strong> ({deletingStaff.role})?
                This staff member will no longer be able to log in to the packaging & dispatch display.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
