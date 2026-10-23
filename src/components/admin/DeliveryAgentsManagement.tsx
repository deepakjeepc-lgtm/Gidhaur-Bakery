import React, { useState } from 'react';
import {
  Bike,
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
  Smartphone
} from 'lucide-react';
import { DeliveryAgent } from '../../types';
import { addDeliveryAgent, updateDeliveryAgent, deleteDeliveryAgent } from '../../services/staffService';

interface DeliveryAgentsManagementProps {
  agents: DeliveryAgent[];
  onDirectViewAgent?: (agent: DeliveryAgent) => void;
}

export const DeliveryAgentsManagement = React.memo<DeliveryAgentsManagementProps>(({
  agents,
  onDirectViewAgent
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<DeliveryAgent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<DeliveryAgent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('Bike');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setVehicleType('Bike');
    setVehicleNumber('');
    setFormError(null);
    setEditingAgent(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (agent: DeliveryAgent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setPhone(agent.phone);
    setEmail(agent.email);
    setPassword(agent.password || 'password123');
    setVehicleType(agent.vehicleType || 'Bike');
    setVehicleNumber(agent.vehicleNumber || '');
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
      if (editingAgent) {
        await updateDeliveryAgent(editingAgent.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          vehicleType,
          vehicleNumber: vehicleNumber.trim()
        });
      } else {
        await addDeliveryAgent({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          vehicleType,
          vehicleNumber: vehicleNumber.trim(),
          status: 'active'
        });
      }
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save delivery agent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (agent: DeliveryAgent) => {
    const nextStatus = agent.status === 'active' ? 'inactive' : 'active';
    await updateDeliveryAgent(agent.id, { status: nextStatus });
  };

  const handleConfirmDelete = async () => {
    if (!deletingAgent) return;
    setIsDeleting(true);
    try {
      await deleteDeliveryAgent(deletingAgent.id);
      setDeletingAgent(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to delete delivery agent');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyCredentials = (agent: DeliveryAgent) => {
    const text = `Gidhaur Bakery Delivery Portal Login:\nEmail: ${agent.email}\nPassword: ${agent.password || 'password123'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(agent.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.phone.includes(searchQuery) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#FF5500] flex items-center justify-center shrink-0">
            <Bike className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm uppercase tracking-[-0.02em] text-[#FFFFFF]">
            DELIVERY AGENTS
          </h2>
          <span className="font-mono text-xs font-bold text-[#FFFFFF] bg-[#0A0A0A] border border-[#27272A] px-2 py-0.5 rounded-sm tabular-nums">
            {agents.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
            <input
              type="text"
              placeholder="Filter rider, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
            />
          </div>

          {onDirectViewAgent && agents.length > 0 && (
            <button
              onClick={() => onDirectViewAgent(agents[0])}
              className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Directly view rider screen"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">LIVE SCREEN</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 shrink-0 cursor-pointer"
            id="add-delivery-agent-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD RIDER</span>
          </button>
        </div>
      </div>

      {/* Agents Cards Grid */}
      {filteredAgents.length === 0 ? (
        <div className="bg-[#18181B] p-10 text-center rounded-sm border border-[#27272A] space-y-3">
          <div className="w-10 h-10 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#71717A] flex items-center justify-center mx-auto">
            <Bike className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF] font-mono">
            NO DELIVERY AGENTS FOUND
          </h3>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
          >
            + ADD FIRST RIDER
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-[#18181B] p-4 rounded-sm border flex flex-col justify-between ${
                agent.status === 'active'
                  ? 'border-[#27272A] hover:border-[#3F3F46]'
                  : 'border-[#27272A] opacity-60 bg-[#121212]'
              }`}
              id={`agent-card-${agent.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-sm bg-[#0A0A0A] text-[#FF5500] border border-[#27272A] flex items-center justify-center font-bold text-xs shrink-0">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#FFFFFF]">
                        {agent.name}
                      </h3>
                      <span className="inline-block px-1.5 py-0.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.06em] mt-0.5">
                        {agent.vehicleType || 'Bike'} {agent.vehicleNumber ? `· ${agent.vehicleNumber}` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(agent)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer border ${
                      agent.status === 'active'
                        ? 'bg-[#0A0A0A] text-[#10B981] border-[#10B981]/40'
                        : 'bg-[#0A0A0A] text-[#71717A] border-[#27272A]'
                    }`}
                  >
                    <Power className="w-2.5 h-2.5" />
                    <span>{agent.status === 'active' ? 'ACTIVE' : 'INACTIVE'}</span>
                  </button>
                </div>

                <div className="space-y-1.5 bg-[#0A0A0A] p-3 rounded-sm border border-[#27272A] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <Phone className="w-3 h-3" /> Phone
                    </span>
                    <a href={`tel:${agent.phone}`} className="font-mono font-bold text-[#FFFFFF] hover:underline">
                      {agent.phone}
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <Mail className="w-3 h-3" /> Email
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#A1A1AA] truncate max-w-[160px]">
                      {agent.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-[#27272A]">
                    <span className="flex items-center gap-1.5 text-[#71717A] text-[10px] uppercase tracking-[0.06em] font-mono">
                      <KeyRound className="w-3 h-3" /> PIN
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#FFFFFF] bg-[#18181B] px-2 py-0.5 rounded-sm border border-[#27272A]">
                      {agent.password || 'password123'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-[#0A0A0A] p-2 rounded-sm border border-[#27272A]">
                    <span className="text-[9px] text-[#71717A] font-bold block uppercase tracking-[0.06em] font-mono">DELIVERED</span>
                    <span className="font-mono font-bold text-sm text-[#FFFFFF] tabular-nums">
                      {agent.totalDeliveredCount || 0}
                    </span>
                  </div>
                  <div className="bg-[#0A0A0A] p-2 rounded-sm border border-[#27272A]">
                    <span className="text-[9px] text-[#71717A] font-bold block uppercase tracking-[0.06em] font-mono">ACTIVE NOW</span>
                    <span className="font-mono font-bold text-sm text-[#10B981] tabular-nums">
                      {agent.activeOrdersCount || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-[#27272A] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onDirectViewAgent && (
                    <button
                      onClick={() => onDirectViewAgent(agent)}
                      className="px-2.5 py-1.5 rounded-sm bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#0A0A0A] text-[10px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>OPEN SCREEN</span>
                    </button>
                  )}

                  <button
                    onClick={() => copyCredentials(agent)}
                    className="px-2.5 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] text-[#A1A1AA] hover:text-[#FFFFFF] text-[10px] font-mono font-bold uppercase tracking-[0.06em] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === agent.id ? (
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
                    onClick={() => handleOpenEdit(agent)}
                    className="p-1.5 rounded-sm text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
                    title="Edit Agent"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingAgent(agent)}
                    className="p-1.5 rounded-sm text-[#71717A] hover:text-[#EF4444] bg-[#0A0A0A] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Delivery Agent Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#18181B] max-w-md w-full p-5 rounded-sm border border-[#27272A] space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-[#FF5500] flex items-center justify-center">
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-[0.06em] font-mono text-[#FFFFFF]">
                  {editingAgent ? 'EDIT DELIVERY AGENT' : 'ADD DELIVERY AGENT'}
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
                  placeholder="e.g. Rahul Kumar"
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
                    VEHICLE TYPE
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF]"
                  >
                    <option value="Bike">Motorcycle / Bike</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Electric Vehicle">Electric Bike / EV</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                  VEHICLE NUMBER PLATE (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BR 46 A 1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                />
              </div>

              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-[#FFFFFF]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#FF5500]" />
                  <span>RIDER LOGIN CREDENTIALS</span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1">
                    LOGIN EMAIL *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rider.rahul@gidhaurbakery.com"
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
                    placeholder="rider123"
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
                  <span>{editingAgent ? 'UPDATE' : 'CREATE'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#71717A] font-mono block">
                CONFIRM REMOVAL
              </span>
              <h4 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
                REMOVE {deletingAgent.name}?
              </h4>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
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

DeliveryAgentsManagement.displayName = 'DeliveryAgentsManagement';
