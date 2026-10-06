import React, { useState, useEffect, useRef } from 'react';
import {
  PackageCheck,
  Clock,
  Bike,
  CheckCircle2,
  AlertCircle,
  Phone,
  Search,
  Volume2,
  VolumeX,
  LogOut,
  ArrowLeft,
  Store,
  Boxes,
  Check,
  AlertTriangle,
  UserCheck,
  ChefHat,
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
import { Order, DeliveryAgent, PreparingStaff } from '../../types';
import {
  subscribeToDeliveryAgents,
  subscribeToPreparingStaff,
  getSavedStaffSession,
  saveStaffSession,
  clearStaffSession,
  getLocalRestaurantSettings
} from '../../services/staffService';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import {
  getOrderNonFoodItems,
  getOrderFoodItems,
  getOrderCategoryClassification,
  isNonFoodItem,
  isFoodItem
} from '../../utils/orderCategoryHelper';

interface PreparingDisplayPageProps {
  onBackToAdmin?: () => void;
  onOpenStore?: () => void;
}

export const PreparingDisplayPage: React.FC<PreparingDisplayPageProps> = ({
  onBackToAdmin,
  onOpenStore
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [staffList, setStaffList] = useState<PreparingStaff[]>([]);
  const [activeStaff, setActiveStaff] = useState<PreparingStaff | null>(null);

  // Sound & Filter State
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'dispatched' | 'all'>('active');

  // Interactive Checklist Tracking (Persisted locally per order)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('swadeep_preparing_checked_items');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal States
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Audio for incoming order notification
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousOrdersCountRef = useRef<number>(0);

  // Initialize active staff session
  useEffect(() => {
    const session = getSavedStaffSession();
    const staffId = session?.data?.id || (session as any)?.staffId;
    if (session && (session.role === 'preparing' || session.role === 'kitchen') && staffList.length > 0) {
      // Find matching staff
      const found = staffList.find((s) => s.id === staffId);
      if (found) setActiveStaff(found);
    } else if (staffList.length > 0 && !activeStaff) {
      setActiveStaff(staffList[0]);
    }
  }, [staffList]);

  // Subscribe to Delivery Agents
  useEffect(() => {
    const unsub = subscribeToDeliveryAgents((agents) => {
      setDeliveryAgents(agents.filter((a) => a.status === 'active'));
    });
    return () => unsub();
  }, []);

  // Subscribe to Preparing Staff
  useEffect(() => {
    const unsub = subscribeToPreparingStaff((staff) => {
      setStaffList(staff);
      if (!activeStaff && staff.length > 0) {
        setActiveStaff(staff[0]);
      }
    });
    return () => unsub();
  }, []);

  // Sound chime helper
  const playAlertChime = () => {
    if (isMuted) return;
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  // Subscribe to Realtime Orders
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as Order), id: d.id });
      });

      // Filter only orders that contain NON-FOOD items!
      const nonFoodOrders = list.filter((ord) => {
        const nonFoodItems = getOrderNonFoodItems(ord);
        return nonFoodItems.length > 0;
      });

      // Check if new preparing order arrived
      const activePending = nonFoodOrders.filter(
        (o) => o.status === 'accepted' || o.status === 'preparing'
      );
      if (
        previousOrdersCountRef.current > 0 &&
        activePending.length > previousOrdersCountRef.current
      ) {
        playAlertChime();
      }
      previousOrdersCountRef.current = activePending.length;

      setOrders(nonFoodOrders);
    });

    return () => unsub();
  }, [isMuted]);

  // Toggle item checkmark
  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('swadeep_preparing_checked_items', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Quick tick all items in order
  const handleTickAllItems = (orderId: string, itemsCount: number) => {
    setCheckedItems((prev) => {
      const next = { ...prev };
      for (let i = 0; i < itemsCount; i++) {
        next[`${orderId}-${i}`] = true;
      }
      try {
        localStorage.setItem('swadeep_preparing_checked_items', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Check if all non-food items in an order are ticked
  const getOrderItemsProgress = (order: Order) => {
    const items = getOrderNonFoodItems(order);
    if (items.length === 0) return { total: 0, checked: 0, allDone: true };

    let checked = 0;
    items.forEach((_, idx) => {
      if (checkedItems[`${order.id}-${idx}`]) {
        checked++;
      }
    });

    return {
      total: items.length,
      checked,
      allDone: checked === items.length
    };
  };

  // Mark Prep items as ready for mixed order (I Finished button)
  const handlePrepMarkFinished = async (order: Order) => {
    const nonFoodItems = getOrderNonFoodItems(order);
    handleTickAllItems(order.id, nonFoodItems.length);

    try {
      const tickedNames = nonFoodItems.map((i) => i.name || (i as any).product?.name || 'Item');
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        preparingReady: true,
        preparingStatus: 'ready',
        preparingTickedItems: tickedNames,
        updatedAt: serverTimestamp()
      });

      if (!isMuted) {
        playAlertChime();
      }
    } catch (err: any) {
      console.warn('Failed to mark prep ready:', err?.message || err);
    }
  };

  // Click on "Send to Delivery Agent" - Always opens confirmation modal with packing checklist status
  const handleInitiateDispatch = (order: Order) => {
    setDispatchOrder(order);
    const active = deliveryAgents.filter((a) => a.status === 'active');
    if (active.length > 0 && !selectedAgentId) {
      setSelectedAgentId(active[0].id);
    }
  };

  // Execute Dispatch with full item-level audit and strict price recalculation
  const handleExecuteDispatch = async () => {
    if (!dispatchOrder) return;
    setIsDispatching(true);

    try {
      const allItems = dispatchOrder.items || [];
      const nonFoodItems = getOrderNonFoodItems(dispatchOrder);

      // Check which items are ticked:
      // For non-food items: checkedItems[`${dispatchOrder.id}-${nfIdx}`]
      // For food items: if already in kitchenTickedItems or order.kitchenReady
      const isTicked = (item: any, _originalIdx: number) => {
        if (isNonFoodItem(item)) {
          const nfIdx = nonFoodItems.indexOf(item);
          if (nfIdx >= 0) {
            if (checkedItems[`${dispatchOrder.id}-${nfIdx}`] !== undefined) {
              return !!checkedItems[`${dispatchOrder.id}-${nfIdx}`];
            }
            return true;
          }
        }
        // For food items:
        if (Array.isArray(dispatchOrder.kitchenTickedItems) && dispatchOrder.kitchenTickedItems.length > 0) {
          const n = String(item.name || (item as any).product?.name || '').toLowerCase().trim();
          return dispatchOrder.kitchenTickedItems.some((k) => String(k).toLowerCase().trim() === n);
        }
        return true;
      };

      const tickedItems = allItems.filter((item, idx) => isTicked(item, idx));
      const untickedItems = allItems.filter((item, idx) => !isTicked(item, idx));

      const dispatchedList = tickedItems.length > 0 ? tickedItems : allItems;
      const excludedList = tickedItems.length > 0 ? untickedItems : [];

      // Calculate subtotal of ONLY dispatched items (unticked items excluded from bill!)
      let dispatchedSubtotal = 0;
      dispatchedList.forEach((item: any) => {
        const price = item.selectedVariant?.price ?? (item as any).product?.price ?? item.price ?? 0;
        const qty = item.quantity || 1;
        dispatchedSubtotal += price * qty;
      });

      const deliveryFee = Number(dispatchOrder.deliveryFee) || 0;
      const dispatchedTotalAmount = dispatchedSubtotal + deliveryFee;

      const dispatchedItemNames = dispatchedList.map((i) => i.name || (i as any).product?.name || 'Item');
      const untickedItemNames = excludedList.map((i) => i.name || (i as any).product?.name || 'Item');
      const dispatchedIndices = allItems
        .map((_, idx) => idx)
        .filter((idx) => isTicked(allItems[idx], idx));

      const assignedAgent = deliveryAgents.find((a) => a.id === selectedAgentId);
      const updates: any = {
        status: 'out_for_delivery',
        preparingStatus: 'dispatched',
        kitchenStatus: 'ready',
        kitchenReady: true,
        preparingReady: true,
        subtotal: dispatchedSubtotal,
        totalAmount: dispatchedTotalAmount,
        originalTotalAmount: dispatchOrder.originalTotalAmount || dispatchOrder.totalAmount,
        originalSubtotal: dispatchOrder.originalSubtotal || dispatchOrder.subtotal,
        dispatchedAt: serverTimestamp(),
        dispatchedItems: dispatchedItemNames,
        untickedItems: untickedItemNames,
        dispatchedItemIndices: dispatchedIndices,
        'statusTimestamps.out_for_delivery': serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (assignedAgent) {
        updates.assignedAgentId = assignedAgent.id;
        updates.assignedAgentName = assignedAgent.name;
        updates.assignedAgentPhone = assignedAgent.phone;
        updates.assignedAgentVehicle = assignedAgent.vehicleType;
        updates.assignedAgentVehicleNumber = assignedAgent.vehicleNumber;
      }

      await updateDoc(doc(db, 'orders', dispatchOrder.id), updates);

      // Send Customer Out for Delivery Email with only dispatched items charged!
      if (dispatchOrder.customerEmail && dispatchOrder.customerEmail.includes('@')) {
        const curSettings = getLocalRestaurantSettings();
        if (curSettings?.emailEventToggles?.notifyOutForDelivery !== false) {
          sendOrderStatusEmail(
            {
              ...dispatchOrder,
              status: 'out_for_delivery',
              subtotal: dispatchedSubtotal,
              totalAmount: dispatchedTotalAmount,
              originalTotalAmount: dispatchOrder.originalTotalAmount || dispatchOrder.totalAmount,
              originalSubtotal: dispatchOrder.originalSubtotal || dispatchOrder.subtotal,
              dispatchedItems: dispatchedItemNames,
              untickedItems: untickedItemNames,
              dispatchedItemIndices: dispatchedIndices,
              assignedAgentName: assignedAgent?.name,
              assignedAgentPhone: assignedAgent?.phone
            },
            'out_for_delivery',
            curSettings
          ).catch(() => {});
        }
      }

      setDispatchOrder(null);
    } catch (err) {
      console.error('Dispatch error:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  // Mark status as preparing (start packing)
  const handleStartPacking = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'preparing',
        preparingStatus: 'preparing',
        preparingSentAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Start packing error:', err);
    }
  };

  // Filter orders based on active tab and search
  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      order.orderId.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.phone.includes(q);

    if (!matchesSearch) return false;

    if (activeTab === 'active') {
      return order.status === 'accepted' || order.status === 'preparing';
    }
    if (activeTab === 'dispatched') {
      return order.status === 'out_for_delivery' || order.status === 'delivered';
    }
    return true;
  });

  const activePreparingCount = orders.filter(
    (o) => o.status === 'accepted' || o.status === 'preparing'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-black text-base sm:text-lg tracking-tight">
                  Preparing & Packing Station
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-500/30">
                  Live
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {activeStaff ? `${activeStaff.name} • ${activeStaff.role}` : 'Packing Department'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
              title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {onOpenStore && (
              <button
                onClick={onOpenStore}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all border border-slate-700 cursor-pointer"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
              </button>
            )}

            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-all shadow-xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 space-y-4">
        {/* Sub-Header Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Active Orders ({activePreparingCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('dispatched')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'dispatched'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Dispatched</span>
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-black transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All History
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Tickets Grid */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto">
              <Boxes className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-bold text-slate-800 text-base">
              No orders waiting in preparing station
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When customer places orders for non-food items (like balloons, candles, party sashes, or props), tickets will pop up here with packaging checklist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const nonFoodItems = getOrderNonFoodItems(order);
              const { total, checked, allDone } = getOrderItemsProgress(order);
              const isPreparing = order.status === 'preparing';
              const isDispatched = order.status === 'out_for_delivery' || order.status === 'delivered';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border p-5 flex flex-col justify-between transition-all shadow-sm ${
                    isPreparing
                      ? 'border-indigo-500 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  id={`prep-ticket-${order.orderId}`}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                            #{order.orderId}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                            {order.customerName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                        </span>
                      </div>

                      <div>
                        {order.status === 'accepted' && (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold">
                            Queued
                          </span>
                        )}
                        {order.status === 'preparing' && (
                          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                            <PackageCheck className="w-3 h-3 text-indigo-600" /> Preparing
                          </span>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-extrabold flex items-center gap-1">
                            <Bike className="w-3 h-3 text-sky-600" /> With Rider
                          </span>
                        )}
                        {order.status === 'delivered' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Multi-Station Prep Status Banner for Mixed Orders */}
                    {(() => {
                      const orderCat = getOrderCategoryClassification(order);
                      const isMixed = orderCat === 'mixed';
                      const isKitchenReady = !!order.kitchenReady;

                      if (!isMixed) return null;

                      return (
                        <div className="mb-2 p-2.5 rounded-2xl border text-xs flex items-center justify-between transition-all bg-amber-50/70 border-amber-200/80 text-amber-950">
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {isKitchenReady ? (
                                <strong>✓ Kitchen finished cooking dishes! Food is ready.</strong>
                              ) : (
                                <span>Chef is cooking food items in the kitchen...</span>
                              )}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isKitchenReady
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isKitchenReady ? '✓ Food Ready' : 'Cooking'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Customer Notes */}
                    {order.notes && (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-[10px] uppercase text-amber-800">Packing Note:</span>
                          <span className="font-medium italic">"{order.notes}"</span>
                        </div>
                      </div>
                    )}

                    {/* Packaging Checklist */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Items to Pack ({checked}/{total})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!allDone && total > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTickAllItems(order.id, total);
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 transition-colors cursor-pointer"
                            >
                              ✓ Tick All
                            </button>
                          )}
                          {allDone && total > 0 && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✓ Ready to Dispatch
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {nonFoodItems.map((item, idx) => {
                          const isDone = checkedItems[`${order.id}-${idx}`];
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => toggleItemCheck(order.id, idx)}
                              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-400 line-through'
                                  : 'bg-slate-50 border-slate-200/80 text-slate-900 hover:bg-indigo-50/50 hover:border-indigo-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                    isDone
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-slate-300'
                                  }`}
                                >
                                  {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-bold">
                                  <span className="text-indigo-950 font-mono text-sm mr-1 font-black">
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

                    {/* Assigned Rider Info (if already out for delivery) */}
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

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleStartPacking(order.id)}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Start Packing</span>
                      </button>
                    )}

                    {/* Send to Delivery Agent & Coordinated Multi-Station Flow */}
                    {!isDispatched && (() => {
                      const orderCat = getOrderCategoryClassification(order);
                      const isMixed = orderCat === 'mixed';
                      const isKitchenReady = !!order.kitchenReady;
                      const isPrepReady = !!order.preparingReady;

                      if (!isMixed) {
                        // Non-food only: Prep directly sends to delivery agent
                        return (
                          <button
                            onClick={() => handleInitiateDispatch(order)}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                            id={`prep-dispatch-btn-${order.orderId}`}
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Send to Delivery Agent</span>
                          </button>
                        );
                      }

                      // Mixed order logic:
                      // Whichever finishes first sees "I Finished".
                      // Whichever finishes second (or when other is ready) sees "Send to Delivery Agent"!
                      if (!isPrepReady && !isKitchenReady) {
                        return (
                          <button
                            onClick={() => handlePrepMarkFinished(order)}
                            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                          >
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>I Finished (Items Packed)</span>
                          </button>
                        );
                      }

                      if (isPrepReady && !isKitchenReady) {
                        return (
                          <div className="space-y-1.5">
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 font-bold">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>I Finished! Waiting for Kitchen to finish dishes...</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled
                              className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-full cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Timer className="w-3.5 h-3.5" />
                              <span>Waiting for Kitchen</span>
                            </button>
                          </div>
                        );
                      }

                      // Kitchen has finished! Prep is finishing second (or both ready) -> Send to Delivery Agent!
                      return (
                        <button
                          onClick={() => handleInitiateDispatch(order)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                          id={`prep-dispatch-btn-${order.orderId}`}
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Send to Delivery Agent</span>
                        </button>
                      );
                    })()}

                    {isDispatched && (
                      <div className="text-center py-1 text-xs font-bold text-slate-500">
                        Package Handed to Delivery Rider
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Unified Dispatch Confirmation & Rider Assignment Modal */}
      {dispatchOrder && (() => {
        const nonFoodItems = getOrderNonFoodItems(dispatchOrder);
        const { total, checked, allDone } = getOrderItemsProgress(dispatchOrder);
        const untickedCount = total - checked;

        const allItems = dispatchOrder.items || [];
        const isItemTicked = (item: any, _originalIdx: number) => {
          if (isNonFoodItem(item)) {
            const nfIdx = nonFoodItems.indexOf(item);
            if (nfIdx >= 0) {
              if (checkedItems[`${dispatchOrder.id}-${nfIdx}`] !== undefined) {
                return !!checkedItems[`${dispatchOrder.id}-${nfIdx}`];
              }
              return true;
            }
          }
          if (Array.isArray(dispatchOrder.kitchenTickedItems) && dispatchOrder.kitchenTickedItems.length > 0) {
            const n = String(item.name || (item as any).product?.name || '').toLowerCase().trim();
            return dispatchOrder.kitchenTickedItems.some((k) => String(k).toLowerCase().trim() === n);
          }
          return true;
        };

        let liveSubtotal = 0;
        allItems.forEach((item, idx) => {
          if (isItemTicked(item, idx)) {
            const price = (item as any).selectedVariant?.price ?? (item as any).product?.price ?? item.price ?? 0;
            liveSubtotal += price * (item.quantity || 1);
          }
        });
        const deliveryFee = Number(dispatchOrder.deliveryFee) || 0;
        const liveTotal = liveSubtotal + deliveryFee;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 space-y-4 max-h-[90vh] flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Bike className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-base text-slate-900">
                      Send to Delivery Agent
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Order #{dispatchOrder.orderId} • {dispatchOrder.customerName}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDispatchOrder(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                {/* Status Alert Banner */}
                {allDone ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">
                        All Items Verified & Packed ({checked}/{total})
                      </h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        Every non-food item is ticked. The complete order is ready to hand over to the delivery partner.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-amber-950">
                          {checked === 0 ? 'No Items Ticked Yet' : `Partial Order Packing (${checked}/${total} Packed)`}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleTickAllItems(dispatchOrder.id, nonFoodItems.length)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer"
                        >
                          ✓ Tick All Items
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        {checked === 0
                          ? 'Zero items are ticked. If you proceed now, all items will be assumed packed. Otherwise, tick individual items or click "Tick All Items".'
                          : `${untickedCount} item(s) are NOT ticked. Unticked items will NOT be dispatched with this rider. Only ticked items will be charged (₹${liveTotal}).`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Live Bill Amount Box */}
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bill Amount to Collect</span>
                    <span className="font-extrabold text-slate-900 text-base font-mono">₹{liveTotal}</span>
                    {untickedCount > 0 && (
                      <span className="text-[10px] text-amber-700 block font-semibold mt-0.5">
                        (Unticked items excluded from bill & not charged)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    {checked}/{total} prep items packed
                  </span>
                </div>

                {/* Items Breakdown Checklist */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Parcel Item Verification
                  </span>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {nonFoodItems.map((item, idx) => {
                      const isTicked = checkedItems[`${dispatchOrder.id}-${idx}`];
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemCheck(dispatchOrder.id, idx)}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isTicked
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-900 font-semibold'
                              : 'bg-slate-50 border-slate-200/80 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isTicked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isTicked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate max-w-[240px]">
                              {item.quantity}x {item.name}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isTicked
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isTicked ? '✓ In Parcel' : 'Pending / Unticked'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Select Delivery Rider */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assign Delivery Rider
                  </span>

                  {deliveryAgents.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                      No active delivery agents found in system. The parcel will be placed into the general delivery queue.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {deliveryAgents.map((agent) => (
                        <label
                          key={agent.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            selectedAgentId === agent.id
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="deliveryAgent"
                              checked={selectedAgentId === agent.id}
                              onChange={() => setSelectedAgentId(agent.id)}
                              className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-900 block leading-tight">
                                {agent.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {agent.vehicleType || 'Bike'} • {agent.phone}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Available
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setDispatchOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDispatching}
                  onClick={handleExecuteDispatch}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>{isDispatching ? 'Dispatching...' : 'Confirm & Send to Delivery Agent'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PreparingDisplayPage;

