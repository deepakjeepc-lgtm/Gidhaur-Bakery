import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  Clock,
  Bike,
  CheckCircle2,
  AlertCircle,
  Bell,
  Volume2,
  VolumeX,
  LogOut,
  Store,
  Check,
  Phone,
  Search,
  Timer
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Order, DeliveryAgent, KitchenStaff } from '../../types';
import { subscribeToDeliveryAgents, getLocalRestaurantSettings } from '../../services/staffService';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import { playOrderAlertChime } from '../../utils/sound';
import {
  saveActiveKitchenTab,
  getSavedActiveKitchenTab,
  saveScrollPosition,
  restoreScrollPosition
} from '../../utils/scrollStateStorage';

interface KitchenDisplayPageProps {
  currentChef: KitchenStaff | { name: string; email: string; role?: string };
  onLogout: () => void;
  onBackToStore: () => void;
}

export const KitchenDisplayPage: React.FC<KitchenDisplayPageProps> = ({
  currentChef,
  onLogout,
  onBackToStore
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<'cooking' | 'dispatched' | 'all'>(() =>
    getSavedActiveKitchenTab('cooking')
  );

  const handleTabChange = (newTab: 'cooking' | 'dispatched' | 'all') => {
    if (newTab === activeTab) return;
    saveScrollPosition(`kitchen_${activeTab}`, window.scrollY);
    setActiveTabState(newTab);
    saveActiveKitchenTab(newTab);
    restoreScrollPosition(`kitchen_${newTab}`);
  };

  const setActiveTab = handleTabChange;

  // Restore scroll position on initial load
  useEffect(() => {
    restoreScrollPosition(`kitchen_${activeTab}`, 6);
  }, []);

  // Save scroll on page scroll
  useEffect(() => {
    const onScroll = () => {
      saveScrollPosition(`kitchen_${activeTab}`, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeTab]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dispatch Modal
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Checked items checklist state per order
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Real-time Orders Sync
  useEffect(() => {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setIsLoading(false);
        const fetched: Order[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Order;
          fetched.push({ ...data, id: d.id, orderId: data.orderId || d.id });
        });
        setOrders(fetched);
      },
      (err) => {
        console.warn('Kitchen orders fetch note (using local cache):', err?.message || err);
        setIsLoading(false);
        try {
          const localOrders = JSON.parse(localStorage.getItem('swadeep_recent_orders') || '[]');
          if (Array.isArray(localOrders)) {
            setOrders(localOrders);
          }
        } catch {}
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time Delivery Agents Sync
  useEffect(() => {
    const unsub = subscribeToDeliveryAgents((agents) => {
      setDeliveryAgents(agents);
      const active = agents.filter((a) => a.status === 'active');
      if (active.length > 0 && !selectedAgentId) {
        setSelectedAgentId(active[0].id);
      }
    });
    return () => unsub();
  }, []);

  const handleStartCooking = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId || o.orderId === orderId ? { ...o, status: 'preparing' as const, kitchenStatus: 'preparing' as const } : o))
    );
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'preparing',
        kitchenStatus: 'preparing',
        kitchenSentAt: serverTimestamp(),
        'statusTimestamps.preparing': serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.warn('Failed to update cooking status in Firestore (updated locally):', err?.message || err);
    }
  };

  const handleOpenDispatchModal = (order: Order) => {
    setSelectedOrderForDispatch(order);
    const active = deliveryAgents.filter((a) => a.status === 'active');
    if (active.length > 0) {
      setSelectedAgentId(active[0].id);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!selectedOrderForDispatch) return;

    setIsDispatching(true);
    const assignedAgent = deliveryAgents.find((a) => a.id === selectedAgentId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderForDispatch.id || o.orderId === selectedOrderForDispatch.orderId
          ? {
              ...o,
              status: 'out_for_delivery' as const,
              kitchenStatus: 'ready' as const,
              assignedAgentId: assignedAgent ? assignedAgent.id : 'unassigned',
              assignedAgentName: assignedAgent ? assignedAgent.name : 'Delivery Rider',
              assignedAgentPhone: assignedAgent ? assignedAgent.phone : ''
            }
          : o
      )
    );

    try {
      const orderRef = doc(db, 'orders', selectedOrderForDispatch.id);
      await updateDoc(orderRef, {
        status: 'out_for_delivery',
        kitchenStatus: 'ready',
        assignedAgentId: assignedAgent ? assignedAgent.id : 'unassigned',
        assignedAgentName: assignedAgent ? assignedAgent.name : 'Delivery Rider',
        assignedAgentPhone: assignedAgent ? assignedAgent.phone : '',
        dispatchedAt: serverTimestamp(),
        'statusTimestamps.out_for_delivery': serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Send branded out_for_delivery email to customer if configured
      if (selectedOrderForDispatch.customerEmail && selectedOrderForDispatch.customerEmail.includes('@')) {
        const curSettings = getLocalRestaurantSettings();
        if (curSettings?.emailEventToggles?.notifyOutForDelivery !== false) {
          sendOrderStatusEmail(
            { ...selectedOrderForDispatch, status: 'out_for_delivery' },
            'out_for_delivery',
            curSettings
          ).catch(() => {});
        }
      }

      if (soundEnabled) {
        playOrderAlertChime();
      }

      setSelectedOrderForDispatch(null);
    } catch (err: any) {
      console.warn('Failed to dispatch order in Firestore (updated locally):', err?.message || err);
      if (soundEnabled) {
        playOrderAlertChime();
      }
      setSelectedOrderForDispatch(null);
    } finally {
      setIsDispatching(false);
    }
  };

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter orders for Kitchen Display
  const kitchenOrders = orders.filter((o) => {
    const matchesSearch =
      o.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'cooking') {
      return o.status === 'preparing' || o.status === 'accepted';
    }
    if (activeTab === 'dispatched') {
      return o.status === 'out_for_delivery';
    }
    return o.status !== 'rejected';
  });

  const cookingCount = orders.filter((o) => o.status === 'preparing' || o.status === 'accepted').length;
  const dispatchedCount = orders.filter((o) => o.status === 'out_for_delivery').length;

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMins < 1) return 'Just now';
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 pb-16 pt-[max(env(safe-area-inset-top,0px),0px)]">
      {/* Top Fixed Floating Kitchen Nav with Notch & Dynamic Island Safe Area */}
      <header className="sticky top-[max(calc(env(safe-area-inset-top,0px)+0.5rem),0.75rem)] z-40 px-3 sm:px-6 max-w-7xl mx-auto mb-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-full border border-slate-200 shadow-sm px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Chef Station */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                  Swa<span className="text-orange-600">deep</span> Kitchen KDS
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase">
                  Live
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 block truncate max-w-[160px] sm:max-w-none">
                {currentChef.name} {currentChef.role ? `• ${currentChef.role}` : ''}
              </span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-full text-xs font-bold transition-colors ${
                soundEnabled ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-400'
              }`}
              title="Sound alert toggle"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onBackToStore}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Store</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sign Out"
              id="kitchen-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 space-y-4">
        {/* Filter Navigation Strip */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('cooking')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'cooking'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              id="kitchen-tab-cooking"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cooking Tickets</span>
              {cookingCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] px-2 py-0.2 rounded-full font-mono">
                  {cookingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dispatched')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'dispatched'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              id="kitchen-tab-dispatched"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Dispatched to Riders ({dispatchedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All History
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticket #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Tickets Grid */}
        {isLoading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-slate-400">
            <p className="text-xs font-medium">Loading kitchen tickets...</p>
          </div>
        ) : kitchenOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-800">
              No orders waiting in kitchen
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When Admin clicks "Send to Kitchen" in the Live Orders dashboard, tickets will pop up here with preparation details.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kitchenOrders.map((order) => {
              const isCooking = order.status === 'preparing';
              const isReadyOrDispatched = order.status === 'out_for_delivery' || order.status === 'delivered';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border shadow-sm p-5 flex flex-col justify-between transition-all ${
                    isCooking
                      ? 'border-slate-950 ring-2 ring-slate-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  id={`kitchen-order-${order.orderId}`}
                >
                  <div className="space-y-4">
                    {/* Ticket Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-base text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                            #{order.orderId}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {order.customerName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{getTimeAgo(order.createdAt)}</span>
                        </span>
                      </div>

                      <div>
                        {order.status === 'accepted' && (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold">
                            Queued
                          </span>
                        )}
                        {order.status === 'preparing' && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                            <Timer className="w-3 h-3 text-amber-600" /> Cooking
                          </span>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold flex items-center gap-1">
                            <Bike className="w-3 h-3 text-indigo-600" /> With Rider
                          </span>
                        )}
                        {order.status === 'delivered' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Cooking Notes / Customizations */}
                    {order.notes && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block uppercase text-[10px] tracking-wider text-amber-800">
                            Chef Instructions:
                          </strong>
                          <span className="font-medium italic">"{order.notes}"</span>
                        </div>
                      </div>
                    )}

                    {/* Food Items Checklist */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Dishes to Prepare ({order.items?.length || 0})
                      </span>
                      <div className="space-y-1.5">
                        {order.items?.map((item, idx) => {
                          const isDone = checkedItems[`${order.id}-${idx}`];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleItemCheck(order.id, idx)}
                              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all ${
                                isDone
                                  ? 'bg-emerald-50/50 border-emerald-200 text-slate-400 line-through'
                                  : 'bg-slate-50 border-slate-200/70 text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                                    isDone
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-slate-300'
                                  }`}
                                >
                                  {isDone && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <span className="text-xs font-bold">
                                  <span className="text-slate-950 font-mono text-sm mr-1">
                                    {item.quantity}x
                                  </span>{' '}
                                  {item.name}
                                </span>
                              </div>

                              {item.selectedSize && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 shrink-0">
                                  {item.selectedSize}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assigned Rider Info (if already dispatched) */}
                    {order.assignedAgentName && (
                      <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4 text-indigo-600" />
                          <span>Rider: <strong>{order.assignedAgentName}</strong></span>
                        </div>
                        {order.assignedAgentPhone && (
                          <a
                            href={`tel:${order.assignedAgentPhone}`}
                            className="p-1 text-indigo-700 hover:text-indigo-950"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleStartCooking(order.id)}
                        className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => handleOpenDispatchModal(order)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                        id={`dispatch-btn-${order.orderId}`}
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>Send to Delivery Agent</span>
                      </button>
                    )}

                    {isReadyOrDispatched && (
                      <div className="text-center py-1 text-xs font-bold text-slate-500">
                        Food Handed to Delivery Rider
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Send to Delivery Agent Dispatch Modal */}
      {selectedOrderForDispatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900">
                    Dispatch Order #{selectedOrderForDispatch.orderId}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Food Ready for Delivery
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDispatch(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
              <p className="text-slate-900 font-bold">
                Customer: {selectedOrderForDispatch.customerName}
              </p>
              <p className="text-slate-600 truncate">
                Address: {selectedOrderForDispatch.address}
              </p>
              <p className="text-slate-800 font-bold font-mono">
                Bill: ₹{selectedOrderForDispatch.totalAmount}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Active Delivery Agent / Rider
              </label>

              {deliveryAgents.length === 0 ? (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No delivery agents registered yet. The order will be dispatched to the general delivery pool.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {deliveryAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedAgentId === agent.id
                          ? 'border-indigo-600 bg-indigo-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="delivery-agent"
                          value={agent.id}
                          checked={selectedAgentId === agent.id}
                          onChange={() => setSelectedAgentId(agent.id)}
                          className="text-indigo-600 focus:ring-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{agent.name}</p>
                          <span className="text-[10px] text-slate-500">
                            {agent.phone} • {agent.vehicleType || 'Bike'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          agent.status === 'active'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderForDispatch(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDispatching}
                onClick={handleConfirmDispatch}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                id="confirm-dispatch-btn"
              >
                <Bike className="w-3.5 h-3.5" />
                <span>{isDispatching ? 'Dispatching...' : 'Dispatch to Rider'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplayPage;
