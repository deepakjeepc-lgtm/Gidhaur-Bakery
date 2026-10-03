import React, { useState } from 'react';
import {
  ChefHat,
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
  UtensilsCrossed
} from 'lucide-react';
import { KitchenStaff } from '../../types';
import { addKitchenStaff, updateKitchenStaff, deleteKitchenStaff } from '../../services/staffService';

interface KitchenStaffManagementProps {
  staffList: KitchenStaff[];
  onDirectViewChef?: (staff: KitchenStaff) => void;
}

export const KitchenStaffManagement: React.FC<KitchenStaffManagementProps> = ({
  staffList,
  onDirectViewChef
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<KitchenStaff | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Head Chef / All Stations');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setRole('Head Chef / All Stations');
    setFormError(null);
    setEditingStaff(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (staff: KitchenStaff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setPhone(staff.phone);
    setEmail(staff.email);
    setPassword(staff.password || 'chef123');
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
        await updateKitchenStaff(editingStaff.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          role
        });
      } else {
        await addKitchenStaff({
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
      setFormError(err.message || 'Failed to save kitchen staff.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: KitchenStaff) => {
    const nextStatus = staff.status === 'active' ? 'inactive' : 'active';
    await updateKitchenStaff(staff.id, { status: nextStatus });
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (window.confirm(`Are you sure you want to remove kitchen chef "${staffName}"?`)) {
      await deleteKitchenStaff(id);
    }
  };

  const copyCredentials = (staff: KitchenStaff) => {
    const text = `Gidhaur Bakery Kitchen Portal Login:\nEmail: ${staff.email}\nPassword: ${staff.password || 'chef123'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(staff.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <h2 className="font-heading font-extrabold text-xl text-slate-900">
              Kitchen Chefs & Staff Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Add kitchen chefs and cooks. They log in with their credentials to view the live kitchen screen and dispatch food to riders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search chef name, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {onDirectViewChef && staffList.length > 0 && (
            <button
              onClick={() => onDirectViewChef(staffList[0])}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 shrink-0"
              title="Directly view live kitchen screen"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden md:inline">Open Kitchen (KDS)</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
            id="add-kitchen-staff-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Kitchen Staff</span>
          </button>
        </div>
      </div>

      {/* Staff Cards Grid */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ChefHat className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-slate-800">
            No kitchen staff registered yet
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your chefs and kitchen staff here so they can view the live cooking tickets on their kitchen tablets/phones.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-950 text-white font-bold text-xs rounded-full shadow-xs"
          >
            + Add First Chef
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => (
            <div
              key={staff.id}
              className={`bg-white rounded-2xl sm:rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                staff.status === 'active'
                  ? 'border-slate-200/80 hover:border-slate-300'
                  : 'border-slate-200 opacity-60 bg-slate-50/50'
              }`}
              id={`staff-card-${staff.id}`}
            >
              <div className="space-y-3">
                {/* Status & Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-900 flex items-center justify-center font-bold text-sm">
                      <ChefHat className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900">
                        {staff.name}
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700">
                        {staff.role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(staff)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      staff.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                    title="Click to toggle status"
                  >
                    <Power className="w-2.5 h-2.5" />
                    <span>{staff.status === 'active' ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                {/* Contact & Credentials Info */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:
                    </span>
                    <a href={`tel:${staff.phone}`} className="font-bold hover:underline">
                      {staff.phone}
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      {staff.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Password:
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {staff.password || 'chef123'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onDirectViewChef && (
                    <button
                      onClick={() => onDirectViewChef(staff)}
                      className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                      title={`Open live kitchen screen for ${staff.name}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open KDS</span>
                    </button>
                  )}

                  <button
                    onClick={() => copyCredentials(staff)}
                    className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedId === staff.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                    title="Edit Staff"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(staff.id, staff.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Delete Staff"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Kitchen Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <ChefHat className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-extrabold text-lg text-slate-900">
                  {editingStaff ? 'Edit Kitchen Staff' : 'Add Kitchen Chef / Staff'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kitchen Role / Station
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Chef, Tandoor & Grill"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kitchen Portal Login Credentials</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="chef.vikram@swadeep.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. chef123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingStaff ? 'Update Staff' : 'Create Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
