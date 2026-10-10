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

  // Form State
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
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Bike className="w-4 h-4" />
            </div>
            <h2 className="font-heading font-extrabold text-xl text-slate-900">
              Delivery Agents Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Add riders with login credentials. Riders log in from the main login screen to access their delivery phone app.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search rider name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {onDirectViewAgent && agents.length > 0 && (
            <button
              onClick={() => onDirectViewAgent(agents[0])}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 shrink-0"
              title="Directly view rider screen"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden md:inline">Open Live Screen</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
            id="add-delivery-agent-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Delivery Agent</span>
          </button>
        </div>
      </div>

      {/* Agents Cards Grid */}
      {filteredAgents.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Bike className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-slate-800">
            No delivery agents found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your delivery riders here so they can log in on their phones and receive orders directly.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-slate-950 text-white font-bold text-xs rounded-full shadow-xs"
          >
            + Add First Rider
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-white rounded-2xl sm:rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                agent.status === 'active'
                  ? 'border-slate-200/80 hover:border-slate-300'
                  : 'border-slate-200 opacity-60 bg-slate-50/50'
              }`}
              id={`agent-card-${agent.id}`}
            >
              <div className="space-y-3">
                {/* Status & Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-900 border border-slate-200/80 flex items-center justify-center font-bold text-sm shrink-0">
                      <Bike className="w-5 h-5 text-slate-800 stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900">
                        {agent.name}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {agent.vehicleType || 'Bike'} {agent.vehicleNumber ? `• ${agent.vehicleNumber}` : ''}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(agent)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      agent.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                    title="Click to toggle status"
                  >
                    <Power className="w-2.5 h-2.5" />
                    <span>{agent.status === 'active' ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                {/* Contact & Credentials Info */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:
                    </span>
                    <a href={`tel:${agent.phone}`} className="font-bold hover:underline">
                      {agent.phone}
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      {agent.email}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" /> Password:
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {agent.password || 'password123'}
                    </span>
                  </div>
                </div>

                {/* Delivery Stats */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Delivered</span>
                    <span className="font-heading font-extrabold text-sm text-slate-900">
                      {agent.totalDeliveredCount || 0} orders
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Active Now</span>
                    <span className="font-heading font-extrabold text-sm text-blue-600">
                      {agent.activeOrdersCount || 0} active
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onDirectViewAgent && (
                    <button
                      onClick={() => onDirectViewAgent(agent)}
                      className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                      title={`Open live screen for ${agent.name}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Screen</span>
                    </button>
                  )}

                  <button
                    onClick={() => copyCredentials(agent)}
                    className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedId === agent.id ? (
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
                    onClick={() => handleOpenEdit(agent)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
                    title="Edit Agent"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingAgent(agent)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Bike className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-extrabold text-lg text-slate-900">
                  {editingAgent ? 'Edit Delivery Agent' : 'Add Delivery Agent'}
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
                  placeholder="e.g. Rahul Kumar"
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
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="Bike">Motorcycle / Bike</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Electric Vehicle">Electric Bike / EV</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vehicle Number Plate (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL 01 AB 1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Rider App Login Credentials</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Login Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rider.rahul@gidhaurbakery.com"
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
                    placeholder="e.g. rider123"
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
                  <span>{editingAgent ? 'Update Agent' : 'Create Agent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (No window.confirm, iframe safe) */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Remove Delivery Agent?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{deletingAgent.name}</strong> ({deletingAgent.email})?
                This rider will no longer be able to log in to the delivery portal.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
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
                {isDeleting ? 'Deleting...' : 'Delete Rider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DeliveryAgentsManagement.displayName = 'DeliveryAgentsManagement';
