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
  Timer,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';
import {
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToSharedOrders } from '../../services/orderListenerService';
import { Order, DeliveryAgent, KitchenStaff } from '../../types';
import { subscribeToDeliveryAgents, getLocalRestaurantSettings } from '../../services/staffService';
import { deductStockForAcceptedOrder } from '../../services/inventoryService';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import { playOrderAlertChime } from '../../utils/sound';
import {
  isFoodItem,
  isNonFoodItem,
  getOrderFoodItems,
  getOrderNonFoodItems,
  getOrderCategoryClassification
} from '../../utils/orderCategoryHelper';
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

  // Real-time Orders Sync via Singleton Shared Listener
  useEffect(() => {
    const unsubscribe = subscribeToSharedOrders((fetched) => {
      setIsLoading(false);
      setOrders(fetched);
    });

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
    const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);
    if (targetOrder) {
      deductStockForAcceptedOrder(targetOrder);
    }

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

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTickAllFoodItems = (order: Order) => {
    const foodItemsWithIndex = (order.items || [])
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => isFoodItem(item));

    setCheckedItems((prev) => {
      const next = { ...prev };
      foodItemsWithIndex.forEach(({ originalIndex }) => {
        next[`${order.id}-${originalIndex}`] = true;
      });
      return next;
    });
  };

  const handleKitchenMarkFinished = async (order: Order) => {
    const foodItemsWithIndex = (order.items || [])
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => isFoodItem(item));

    // Ensure food dishes are marked ticked
    const tickedDishes = foodItemsWithIndex.map(
      ({ item }) => item.name || (item as any).product?.name || 'Dish'
    );

    setCheckedItems((prev) => {
      const next = { ...prev };
      foodItemsWithIndex.forEach(({ originalIndex }) => {
        next[`${order.id}-${originalIndex}`] = true;
      });
      return next;
    });

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        kitchenReady: true,
        kitchenStatus: 'ready',
        kitchenTickedItems: tickedDishes,
        updatedAt: serverTimestamp()
      });

      if (soundEnabled) {
        playOrderAlertChime();
      }
    } catch (err: any) {
      console.warn('Failed to mark kitchen ready:', err?.message || err);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!selectedOrderForDispatch) return;

    setIsDispatching(true);
    const assignedAgent = deliveryAgents.find((a) => a.id === selectedAgentId);

    const allItems = selectedOrderForDispatch.items || [];
    
    // Check which items are ticked:
    // For food items: checkedItems[id-idx]
    // For prep non-food items: if already in preparingTickedItems or checked in checkedItems
    const isTicked = (item: any, idx: number) => {
      if (checkedItems[`${selectedOrderForDispatch.id}-${idx}`] !== undefined) {
        return !!checkedItems[`${selectedOrderForDispatch.id}-${idx}`];
      }
      if (isNonFoodItem(item) && Array.isArray(selectedOrderForDispatch.preparingTickedItems)) {
        const n = String(item.name || (item as any).product?.name || '').toLowerCase().trim();
        return selectedOrderForDispatch.preparingTickedItems.some(
          (p) => String(p).toLowerCase().trim() === n
        );
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

    const deliveryFee = Number(selectedOrderForDispatch.deliveryFee) || 0;
    const dispatchedTotalAmount = dispatchedSubtotal + deliveryFee;

    const dispatchedItemNames = dispatchedList.map((i) => i.name || (i as any).product?.name || 'Dish');
    const untickedItemNames = excludedList.map((i) => i.name || (i as any).product?.name || 'Dish');
    const dispatchedIndices = allItems
      .map((_, idx) => idx)
      .filter((idx) => isTicked(allItems[idx], idx));

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderForDispatch.id || o.orderId === selectedOrderForDispatch.orderId
          ? {
              ...o,
              status: 'out_for_delivery' as const,
              kitchenStatus: 'ready' as const,
              kitchenReady: true,
              preparingReady: true,
              subtotal: dispatchedSubtotal,
              totalAmount: dispatchedTotalAmount,
              originalTotalAmount: selectedOrderForDispatch.originalTotalAmount || selectedOrderForDispatch.totalAmount,
              originalSubtotal: selectedOrderForDispatch.originalSubtotal || selectedOrderForDispatch.subtotal,
              dispatchedItems: dispatchedItemNames,
              untickedItems: untickedItemNames,
              dispatchedItemIndices: dispatchedIndices,
              assignedAgentId: assignedAgent ? assignedAgent.id : 'unassigned',
              assignedAgentName: assignedAgent ? assignedAgent.name : 'Delivery Rider',
              assignedAgentPhone: assignedAgent ? assignedAgent.phone : ''
            }
          : o
      )
    );

    setSelectedOrderForDispatch(null);

    if (soundEnabled) {
      playOrderAlertChime();
    }

    try {
      const orderRef = doc(db, 'orders', selectedOrderForDispatch.id);
      updateDoc(orderRef, {
        status: 'out_for_delivery',
        kitchenStatus: 'ready',
        kitchenReady: true,
        preparingReady: true,
        assignedAgentId: assignedAgent ? assignedAgent.id : 'unassigned',
        assignedAgentName: assignedAgent ? assignedAgent.name : 'Delivery Rider',
        assignedAgentPhone: assignedAgent ? assignedAgent.phone : '',
        dispatchedAt: serverTimestamp(),
        dispatchedItems: dispatchedItemNames,
        untickedItems: untickedItemNames,
        dispatchedItemIndices: dispatchedIndices,
        subtotal: dispatchedSubtotal,
        totalAmount: dispatchedTotalAmount,
        originalTotalAmount: selectedOrderForDispatch.originalTotalAmount || selectedOrderForDispatch.totalAmount,
        originalSubtotal: selectedOrderForDispatch.originalSubtotal || selectedOrderForDispatch.subtotal,
        'statusTimestamps.out_for_delivery': serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((err) => console.warn('Kitchen updateDoc notice:', err));

      // Send branded out_for_delivery email to customer with only dispatched items charged!
      if (selectedOrderForDispatch.customerEmail && selectedOrderForDispatch.customerEmail.includes('@')) {
        const curSettings = getLocalRestaurantSettings();
        if (curSettings?.emailEventToggles?.notifyOutForDelivery !== false) {
          sendOrderStatusEmail(
            {
              ...selectedOrderForDispatch,
              status: 'out_for_delivery',
              subtotal: dispatchedSubtotal,
              totalAmount: dispatchedTotalAmount,
              originalTotalAmount: selectedOrderForDispatch.originalTotalAmount || selectedOrderForDispatch.totalAmount,
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
    } catch (err: any) {
      console.error('Kitchen dispatch error:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  // Filter orders for Kitchen Display - ONLY orders containing food items to cook!
  const kitchenOrders = orders.filter((o) => {
    // 1. MUST contain food items (non-food only orders belong in Preparing Station!)
    const foodItems = getOrderFoodItems(o);
    if (foodItems.length === 0) return false;

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

  const cookingCount = orders.filter(
    (o) => (o.status === 'preparing' || o.status === 'accepted') && getOrderFoodItems(o).length > 0
  ).length;
  const dispatchedCount = orders.filter(
    (o) => o.status === 'out_for_delivery' && getOrderFoodItems(o).length > 0
  ).length;

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

                    {/* Multi-Station Prep Status Banner for Mixed Orders */}
                    {(() => {
                      const orderCat = getOrderCategoryClassification(order);
                      const isMixed = orderCat === 'mixed';
                      const isKitchenReady = !!order.kitchenReady;
                      const isPrepReady = !!order.preparingReady;

                      if (!isMixed) return null;

                      return (
                        <div className="mb-2 p-2.5 rounded-2xl border text-xs flex items-center justify-between transition-all bg-indigo-50/70 border-indigo-100 text-indigo-950">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>
                              {isPrepReady ? (
                                <strong>✓ Preparing Station finished packing items!</strong>
                              ) : (
                                <span>Preparing Station is packing non-food items...</span>
                              )}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPrepReady
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {isPrepReady ? '✓ Prep Ready' : 'Packing'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Food Items Checklist - ONLY FOOD ITEMS ARE SHOWN IN KITCHEN KDS */}
                    {(() => {
                      const foodItemsWithIndex = (order.items || [])
                        .map((item, originalIndex) => ({ item, originalIndex }))
                        .filter(({ item }) => isFoodItem(item));

                      const totalDishes = foodItemsWithIndex.length;
                      const checkedDishes = foodItemsWithIndex.filter(
                        ({ originalIndex }) => checkedItems[`${order.id}-${originalIndex}`]
                      ).length;
                      const allDone = checkedDishes === totalDishes && totalDishes > 0;

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Dishes to Prepare ({checkedDishes}/{totalDishes})
                            </span>
                            <div className="flex items-center gap-1.5">
                              {!allDone && totalDishes > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTickAllFoodItems(order);
                                  }}
                                  className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition-colors cursor-pointer"
                                >
                                  ✓ Tick All Dishes
                                </button>
                              )}
                              {allDone && totalDishes > 0 && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  ✓ Cooked & Ready
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {foodItemsWithIndex.map(({ item, originalIndex }) => {
                              const isDone = checkedItems[`${order.id}-${originalIndex}`];
                              return (
                                <button
                                  key={originalIndex}
                                  type="button"
                                  onClick={() => toggleItemCheck(order.id, originalIndex)}
                                  className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
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
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold">
                                        <span className="text-slate-950 font-mono text-sm mr-1">
                                          {item.quantity}x
                                        </span>{' '}
                                        {item.name}
                                      </span>
                                      {item.selectedExtras && item.selectedExtras.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                          {item.selectedExtras.map((extra: any) => (
                                            <span
                                              key={extra.id}
                                              className="text-[9px] font-extrabold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80 leading-none not-italic"
                                            >
                                              +{extra.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
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
                      );
                    })()}

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

                  {/* Action Buttons with Multi-Station Coordination */}
                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleStartCooking(order.id)}
                        className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {!isReadyOrDispatched && (() => {
                      const orderCat = getOrderCategoryClassification(order);
                      const isMixed = orderCat === 'mixed';
                      const isKitchenReady = !!order.kitchenReady;
                      const isPrepReady = !!order.preparingReady;

                      if (!isMixed) {
                        // Food-only order: Kitchen directly dispatches to Delivery Agent
                        return (
                          <button
                            onClick={() => handleOpenDispatchModal(order)}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                            id={`dispatch-btn-${order.orderId}`}
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Send to Delivery Agent</span>
                          </button>
                        );
                      }

                      // Mixed order logic: Whichever finishes first sees "I Finished", whichever finishes second sees "Send to Delivery Agent"!
                      if (!isKitchenReady && !isPrepReady) {
                        return (
                          <button
                            onClick={() => handleKitchenMarkFinished(order)}
                            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                          >
                            <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                            <span>I Finished (Dishes Cooked)</span>
                          </button>
                        );
                      }

                      if (isKitchenReady && !isPrepReady) {
                        return (
                          <div className="space-y-1.5">
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 font-bold">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>I Finished! Waiting for Preparing Station to pack...</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled
                              className="w-full py-2.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-full cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Timer className="w-3.5 h-3.5" />
                              <span>Waiting for Preparing Station</span>
                            </button>
                          </div>
                        );
                      }

                      // Preparing Station has finished! Kitchen is finishing second (or both ready) -> Send to Delivery Agent button!
                      return (
                        <button
                          onClick={() => handleOpenDispatchModal(order)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                          id={`dispatch-btn-${order.orderId}`}
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Send to Delivery Agent</span>
                        </button>
                      );
                    })()}

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

      {/* Send to Delivery Agent Dispatch & Confirmation Modal with Live Bill Recalculation */}
      {selectedOrderForDispatch && (() => {
        const allItems = selectedOrderForDispatch.items || [];
        const isTicked = (item: any, idx: number) => {
          if (checkedItems[`${selectedOrderForDispatch.id}-${idx}`] !== undefined) {
            return !!checkedItems[`${selectedOrderForDispatch.id}-${idx}`];
          }
          if (isNonFoodItem(item) && Array.isArray(selectedOrderForDispatch.preparingTickedItems)) {
            const n = String(item.name || (item as any).product?.name || '').toLowerCase().trim();
            return selectedOrderForDispatch.preparingTickedItems.some(
              (p) => String(p).toLowerCase().trim() === n
            );
          }
          return true;
        };

        const foodItemsWithIndex = allItems
          .map((item, originalIndex) => ({ item, originalIndex }))
          .filter(({ item }) => isFoodItem(item));

        const totalDishes = foodItemsWithIndex.length;
        const checkedDishes = foodItemsWithIndex.filter(({ originalIndex }) => isTicked(allItems[originalIndex], originalIndex)).length;
        const allDone = checkedDishes === totalDishes && totalDishes > 0;
        const untickedCount = totalDishes - checkedDishes;

        // Calculate live dispatched subtotal
        let liveSubtotal = 0;
        allItems.forEach((item, idx) => {
          if (isTicked(item, idx)) {
            const price = (item as any).selectedVariant?.price ?? (item as any).product?.price ?? item.price ?? 0;
            liveSubtotal += price * (item.quantity || 1);
          }
        });
        const deliveryFee = Number(selectedOrderForDispatch.deliveryFee) || 0;
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
                      Order #{selectedOrderForDispatch.orderId} • {selectedOrderForDispatch.customerName}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrderForDispatch(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                {/* Status Alert Banner */}
                {allDone ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">
                        All Items Verified & Ready ({checkedDishes}/{totalDishes})
                      </h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        Every item in this order is verified and ready for dispatch.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-amber-950">
                          {checkedDishes === 0 ? 'No Items Ticked Yet' : `Partial Order Dispatch (${checkedDishes}/${totalDishes} Ready)`}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckedItems((prev) => {
                              const next = { ...prev };
                              allItems.forEach((_, idx) => {
                                next[`${selectedOrderForDispatch.id}-${idx}`] = true;
                              });
                              return next;
                            });
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer"
                        >
                          ✓ Tick All Items
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        {checkedDishes === 0
                          ? 'Zero items are ticked. If you dispatch now, all items will be assumed ready.'
                          : `${untickedCount} item(s) are NOT ticked. Unticked items will NOT be dispatched or charged! Only ticked items will be billed (₹${liveTotal}).`}
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
                    {checkedDishes}/{totalDishes} items in parcel
                  </span>
                </div>

                {/* Food Dishes Verification Checklist - ONLY Food Items in Kitchen KDS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Dishes Verification ({checkedDishes}/{totalDishes})
                    </span>
                    {totalDishes > 0 && !allDone && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckedItems((prev) => {
                            const next = { ...prev };
                            foodItemsWithIndex.forEach(({ originalIndex }) => {
                              next[`${selectedOrderForDispatch.id}-${originalIndex}`] = true;
                            });
                            return next;
                          });
                        }}
                        className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-200 cursor-pointer"
                      >
                        ✓ Tick All Food Dishes
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {foodItemsWithIndex.map(({ item, originalIndex }) => {
                      const isT = isTicked(item, originalIndex);
                      return (
                        <div
                          key={originalIndex}
                          onClick={() => toggleItemCheck(selectedOrderForDispatch.id, originalIndex)}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isT
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-900 font-semibold'
                              : 'bg-slate-50 border-slate-200/80 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isT
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {isT && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate max-w-[240px]">
                              {item.quantity}x {item.name || (item as any).product?.name}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isT
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isT ? '✓ In Parcel' : 'Pending / Unticked'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mixed Order Prep Note */}
                  {getOrderCategoryClassification(selectedOrderForDispatch) === 'mixed' && (
                    <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex items-center justify-between">
                      <span className="font-semibold">Non-food items status (Preparing Station):</span>
                      <span className="font-extrabold text-indigo-700">
                        {selectedOrderForDispatch.preparingReady ? '✓ Packed & Ready' : 'Packing in Progress'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Select Delivery Rider */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assign Delivery Rider
                  </span>

                  {deliveryAgents.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                      No delivery agents registered yet. The order will be dispatched to the general delivery pool.
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
                              name="delivery-agent"
                              value={agent.id}
                              checked={selectedAgentId === agent.id}
                              onChange={() => setSelectedAgentId(agent.id)}
                              className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-900 block leading-tight">
                                {agent.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
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
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDispatch(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isDispatching}
                  onClick={handleConfirmDispatch}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
                  id="confirm-dispatch-btn"
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

export default KitchenDisplayPage;
