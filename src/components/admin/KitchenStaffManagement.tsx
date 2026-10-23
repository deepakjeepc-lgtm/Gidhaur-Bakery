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

export const KitchenStaffManagement = React.memo<KitchenStaffManagementProps>(({
  staffList,
  onDirectViewChef
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<KitchenStaff | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<KitchenStaff | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await deleteKitchenStaff(deletingStaff.id);
      setDeletingStaff(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete kitchen staff');
    } finally {
      setIsDeleting(false);
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
      <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#FF5500] flex items-center justify-center shrink-0">
            <ChefHat className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm uppercase tracking-[-0.02em] text-[#FFFFFF]">
            KITCHEN CHEFS &amp; STAFF
          </h2>
          <span className="font-mono text-xs font-bold text-[#FFFFFF] bg-[#0A0A0A] border border-[#27272A] px-2 py-0.5 rounded-sm tabular-nums">
            {staffList.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="Filter chef, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
            />
          </div>

          {onDirectViewChef && staffList.length > 0 && (
            <button
              onClick={() => onDirectViewChef(staffList[0])}
              className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Directly view live kitchen screen"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span className="hidden md:inline">OPEN KDS</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 shrink-0 cursor-pointer"
            id="add-kitchen-staff-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD CHEF</span>
          </button>
        </div>
      </div>

      {/* Staff Cards Grid */}
      {filteredStaff.length === 0 ? (
        <div className="bg-[#18181B] p-10 text-center rounded-sm border border-[#27272A] space-y-3">
          <div className="w-10 h-10 rounded-sm bg-[#0A0A0A] text-[#71717A] border border-[#27272A] flex items-center justify-center mx-auto">
            <ChefHat className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF] font-mono">
            NO KITCHEN STAFF REGISTERED
          </h3>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
          >
            + ADD FIRST CHEF
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStaff.map((staff) => (
            <div
              key={staff.id}
              className={`bg-[#18181B] p-4 rounded-sm border flex flex-col justify-between ${
                staff.status === 'active'
                  ? 'border-[#27272A] hover:border-[#3F3F46]'
                  : 'border-[#27272A] opacity-60 bg-[#121212]'
              }`}
              id={`staff-card-${staff.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#FFFFFF] flex items-center justify-center font-bold text-xs shrink-0">
                      <ChefHat className="w-4 h-4 text-[#FF5500]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#FFFFFF]">
                        {staff.name}
                      </h3>
                      <span className="inline-block px-1.5 py-0.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[10px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] mt-0.5">
                        {staff.role}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(staff)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer border ${
                      staff.status === 'active'
                        ? 'bg-[#0A0A0A] text-[#10B981] border-[#10B981]/40'
                        : 'bg-[#0A0A0A] text-[#71717A] border-[#27272A]'
                    }`}
                  >
                    <Power className="w-2.5 h-2.5" />
                    <span>{staff.status === 'active' ? 'ACTIVE' : 'INACTIVE'}</span>
                  </button>
                </div>

                <div className="space-y-1.5 bg-[#0A0A0A] p-3 rounded-sm border border-[#27272A] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <Phone className="w-3 h-3" /> Phone
                    </span>
                    <a href={`tel:${staff.phone}`} className="font-mono font-bold text-[#FFFFFF] hover:underline">
                      {staff.phone}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <Mail className="w-3 h-3" /> Email
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#A1A1AA] truncate max-w-[160px]">
                      {staff.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#27272A]">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <KeyRound className="w-3 h-3" /> PIN
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#18181B] px-2 py-0.5 rounded-sm border border-[#27272A]">
                      {staff.password || 'chef123'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#27272A] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onDirectViewChef && (
                    <button
                      onClick={() => onDirectViewChef(staff)}
                      className="px-2.5 py-1.5 rounded-sm bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#0A0A0A] text-[10px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>OPEN KDS</span>
                    </button>
                  )}

                  <button
                    onClick={() => copyCredentials(staff)}
                    className="px-2.5 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] text-[10px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === staff.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#10B981]" />
                        <span className="text-[#10B981]">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(staff)}
                    className="p-1.5 rounded-sm text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
                    title="Edit Staff"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingStaff(staff)}
                    className="p-1.5 rounded-sm text-[#71717A] hover:text-[#EF4444] bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18181B] max-w-md w-full p-5 rounded-sm border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#FF5500] flex items-center justify-center">
                  <ChefHat className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-[0.06em] font-mono text-[#FFFFFF]">
                  {editingStaff ? 'EDIT KITCHEN STAFF' : 'ADD KITCHEN CHEF'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#71717A] hover:text-[#FFFFFF] p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#EF4444]/40 text-xs font-mono text-[#EF4444] font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                  FULL NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                    PHONE NUMBER *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                    STATION / ROLE
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Head Chef"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-[#FFFFFF]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>PORTAL CREDENTIALS</span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                    LOGIN EMAIL *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="chef.vikram@gidhaurbakery.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                    PASSWORD *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="chef123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingStaff ? 'UPDATE' : 'CREATE'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71717A] font-mono block">
                CONFIRM REMOVAL
              </span>
              <h4 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
                REMOVE {deletingStaff.name}?
              </h4>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-2 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#EF4444] hover:bg-[#DC2626] border border-[#EF4444] cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

KitchenStaffManagement.displayName = 'KitchenStaffManagement';
