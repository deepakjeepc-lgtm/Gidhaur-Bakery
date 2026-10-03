import React, { useState, useEffect, useRef } from 'react';
import {
  Bike,
  Phone,
  MapPin,
  QrCode,
  IndianRupee,
  CheckCircle2,
  Navigation,
  Check,
  Volume2,
  VolumeX,
  LogOut,
  Store,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PackageCheck,
  Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Order, DeliveryAgent, RestaurantSettings } from '../../types';
import { subscribeToRestaurantSettings, getLocalRestaurantSettings } from '../../services/staffService';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import { playOrderAlertChime } from '../../utils/sound';
import { calculateDistanceInMeters, formatDistanceAway } from '../../utils/distance';
import { SwipeToDeliver } from './SwipeToDeliver';
import {
  saveActiveDeliveryTab,
  getSavedActiveDeliveryTab,
  saveScrollPosition,
  restoreScrollPosition
} from '../../utils/scrollStateStorage';

interface DeliveryAgentPortalProps {
  currentAgent: DeliveryAgent | { id: string; name: string; email: string; phone?: string };
  onLogout: () => void;
  onBackToStore: () => void;
}

export const DeliveryAgentPortal: React.FC<DeliveryAgentPortalProps> = ({
  currentAgent,
  onLogout,
  onBackToStore
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings>(getLocalRestaurantSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<'active' | 'completed'>(() =>
    getSavedActiveDeliveryTab('active')
  );

  const handleTabChange = (newTab: 'active' | 'completed') => {
    if (newTab === activeTab) return;
    saveScrollPosition(`delivery_${activeTab}`, window.scrollY);
    setActiveTabState(newTab);
    saveActiveDeliveryTab(newTab);
    restoreScrollPosition(`delivery_${newTab}`);
  };

  const setActiveTab = handleTabChange;

  // Restore scroll position on initial load
  useEffect(() => {
    restoreScrollPosition(`delivery_${activeTab}`, 6);
  }, []);

  // Save scroll on page scroll
  useEffect(() => {
    const onScroll = () => {
      saveScrollPosition(`delivery_${activeTab}`, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeTab]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Payment UI state per order
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<Record<string, 'upi' | 'cash'>>({});
  const [cashTendered, setCashTendered] = useState<Record<string, string>>({});
  
  // Card Expansion State: Default collapsed
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Item Checklist per Order: Record<orderId, Record<itemIndex, boolean>> (default true)
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, Record<number, boolean>>>({});
  
  // Custom Rider Delivery Charge per order (default 0)
  const [riderDeliveryCharges, setRiderDeliveryCharges] = useState<Record<string, string>>({});
  
  const [isProcessingDelivery, setIsProcessingDelivery] = useState<string | null>(null);

  // Real-time Orders Sync for this agent
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
        console.warn('Rider orders fetch note (using local cache):', err?.message || err);
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

  // Filter orders for this agent
  const myActiveOrders = orders.filter((o) => {
    if (o.status !== 'out_for_delivery') return false;
    if (!o.assignedAgentId || o.assignedAgentId === 'unassigned') return true;
    return o.assignedAgentId === currentAgent.id || o.assignedAgentName === currentAgent.name;
  });

  const myCompletedOrders = orders.filter((o) => {
    if (o.status !== 'delivered') return false;
    return o.assignedAgentId === currentAgent.id || o.assignedAgentName === currentAgent.name;
  });

  const totalCollectedToday = myCompletedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Keep fresh refs to prevent stale closure captures in GPS watch callbacks
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const currentAgentRef = useRef(currentAgent);
  currentAgentRef.current = currentAgent;

  // Real-time GPS location sharing for active deliveries
  useEffect(() => {
    if (!isOnline || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    const pushLocation = async (lat: number, lng: number) => {
      setRiderCoords({ lat, lng });

      // 1. Update rider's agent document in Firestore
      try {
        const agentRef = doc(db, 'delivery_agents', currentAgentRef.current.id);
        await setDoc(
          agentRef,
          {
            id: currentAgentRef.current.id,
            name: currentAgentRef.current.name,
            phone: currentAgentRef.current.phone || '',
            currentLat: lat,
            currentLng: lng,
            isOnline: true,
            lastSeen: serverTimestamp(),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (e) {
        // Ignore background agent update issues
      }

      // 2. Push current rider coordinates to all active orders assigned to this agent in Firestore
      const activeOrds = ordersRef.current.filter((ord) => {
        if (ord.status !== 'out_for_delivery') return false;
        if (!ord.assignedAgentId || ord.assignedAgentId === 'unassigned') return true;
        return (
          ord.assignedAgentId === currentAgentRef.current.id ||
          ord.assignedAgentName === currentAgentRef.current.name
        );
      });

      for (const ord of activeOrds) {
        try {
          const orderRef = doc(db, 'orders', ord.id);
          await updateDoc(orderRef, {
            riderLocation: {
              lat,
              lng,
              updatedAt: Date.now(),
            },
          });
        } catch (err) {
          // Ignore transient background update issues
        }
      }
    };

    // Immediate single GPS fetch
    navigator.geolocation.getCurrentPosition(
      (pos) => pushLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => console.warn('Rider immediate GPS warning:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    // Continuous watch
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        pushLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn('Rider geolocation watch error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Toggle item selection for a specific order
  const toggleItemSelection = (orderId: string, itemIdx: number) => {
    setSelectedItemsMap((prev) => {
      const orderItems = prev[orderId] || {};
      const currentVal = orderItems[itemIdx] !== false; // default true
      return {
        ...prev,
        [orderId]: {
          ...orderItems,
          [itemIdx]: !currentVal
        }
      };
    });
  };

  // Select all or Deselect all items
  const setAllItemsSelection = (order: Order, selectAll: boolean) => {
    const newItems: Record<number, boolean> = {};
    order.items?.forEach((_, idx) => {
      newItems[idx] = selectAll;
    });
    setSelectedItemsMap((prev) => ({
      ...prev,
      [order.id]: newItems
    }));
  };

  // Calculate base dishes amount from selected items
  const getOrderDishesAmount = (order: Order) => {
    if (!order.items || order.items.length === 0) return order.subtotal || order.totalAmount || 0;
    const orderSelections = selectedItemsMap[order.id] || {};
    
    let sum = 0;
    let anyExplicit = false;

    order.items.forEach((item, idx) => {
      const isSelected = orderSelections[idx] !== false; // default true
      if (orderSelections[idx] !== undefined) anyExplicit = true;
      if (isSelected) {
        sum += (item.price || 0) * (item.quantity || 1);
      }
    });

    if (!anyExplicit) return order.subtotal || order.totalAmount || 0;
    return sum;
  };

  // Calculate total delivery amount (Dishes + Custom Rider Delivery Charge)
  const getOrderDeliveryAmount = (order: Order) => {
    const dishesAmount = getOrderDishesAmount(order);
    const customChargeStr = riderDeliveryCharges[order.id];
    const customCharge = customChargeStr !== undefined && customChargeStr !== '' ? Math.max(0, parseInt(customChargeStr, 10) || 0) : 0;
    return dishesAmount + customCharge;
  };

  const getSelectedItemsCount = (order: Order) => {
    if (!order.items || order.items.length === 0) return 0;
    const orderSelections = selectedItemsMap[order.id] || {};
    return order.items.filter((_, idx) => orderSelections[idx] !== false).length;
  };

  const handleMarkDelivered = async (order: Order, paymentType: 'upi' | 'cash') => {
    const finalAmount = getOrderDeliveryAmount(order);
    const customChargeStr = riderDeliveryCharges[order.id];
    const customDeliveryFee = customChargeStr !== undefined && customChargeStr !== '' ? Math.max(0, parseInt(customChargeStr, 10) || 0) : 0;
    const selectedCount = getSelectedItemsCount(order);
    
    if (selectedCount === 0) {
      alert('Please select at least 1 item to deliver.');
      return;
    }

    setIsProcessingDelivery(order.id);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'delivered',
        paymentStatus: 'paid',
        paymentMethod: paymentType,
        deliveredAmount: finalAmount,
        deliveryFee: customDeliveryFee,
        totalAmount: finalAmount,
        deliveredAt: serverTimestamp(),
        'statusTimestamps.delivered': serverTimestamp(),
        assignedAgentId: currentAgent.id,
        assignedAgentName: currentAgent.name,
        assignedAgentPhone: currentAgent.phone || '',
        assignedAgentVehicle: ('vehicleType' in currentAgent ? currentAgent.vehicleType : '') || 'Bike',
        assignedAgentVehicleNumber: ('vehicleNumber' in currentAgent ? currentAgent.vehicleNumber : '') || '',
        updatedAt: serverTimestamp()
      });

      // Send branded delivery completion email to customer if configured
      if (order.customerEmail && order.customerEmail.includes('@')) {
        const curSettings = getLocalRestaurantSettings();
        if (curSettings?.emailEventToggles?.notifyDelivered !== false) {
          sendOrderStatusEmail({ ...order, status: 'delivered' }, 'delivered', curSettings).catch(() => {});
        }
      }

      // Joyful Confetti Feedback
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });

      if (soundEnabled) {
        playOrderAlertChime();
      }
    } catch (err: any) {
      console.warn('Failed to mark order as delivered in Firestore (updated locally):', err?.message || err);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
      if (soundEnabled) {
        playOrderAlertChime();
      }
    } finally {
      setIsProcessingDelivery(null);
    }
  };

  const getUpiDeepLink = (order: Order, amount: number) => {
    const upiId = settings.upiId || 'gidhaurbakery@upi';
    const payee = settings.upiPayeeName || 'Gidhaur Bakery';
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
      payee
    )}&am=${amount}&tn=Gidhaur_Order_${order.orderId}&cu=INR`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 pt-[max(env(safe-area-inset-top,0px),0px)]">
      {/* Mobile Floating App Header with Notch & Dynamic Island Safe Area */}
      <header className="sticky top-[max(calc(env(safe-area-inset-top,0px)+0.5rem),0.75rem)] z-40 px-3 sm:px-6 max-w-2xl mx-auto mb-3">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* White circle with subtle border and black SVG icon */}
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200/90 text-slate-900 flex items-center justify-center shrink-0 shadow-2xs">
              <Bike className="w-5 h-5 text-slate-900 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-heading font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                  {currentAgent.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold uppercase shrink-0">
                  Rider
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 block truncate">
                {currentAgent.phone || 'Active on Duty'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            <button
              onClick={onBackToStore}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors active:scale-95"
              title="Store View"
            >
              <Store className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors active:scale-95"
              title="Sign Out"
              id="rider-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-3 sm:px-6 space-y-3">
        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Deliveries
            </span>
            <div className="font-heading font-extrabold text-2xl text-slate-900">
              {myActiveOrders.length}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Ready for drop-off</span>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-0.5">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Completed Today
            </span>
            <div className="font-heading font-extrabold text-2xl text-emerald-600 font-amount">
              ₹{totalCollectedToday}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {myCompletedOrders.length} orders delivered
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-1 flex items-center shadow-2xs">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="rider-tab-active"
          >
            <Bike className="w-3.5 h-3.5" />
            <span>Active Deliveries ({myActiveOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'completed'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="rider-tab-completed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered History ({myCompletedOrders.length})</span>
          </button>
        </div>

        {/* Active Deliveries List */}
        {activeTab === 'active' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="bg-white rounded-3xl p-10 text-center text-slate-400 text-xs font-medium">
                Syncing assigned orders...
              </div>
            ) : myActiveOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 space-y-2">
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-900 flex items-center justify-center mx-auto shadow-2xs">
                  <Bike className="w-6 h-6 text-slate-900 stroke-[2.2]" />
                </div>
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No active orders right now
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  When the kitchen finishes cooking and dispatches dishes, your delivery cards will appear here.
                </p>
              </div>
            ) : (
              myActiveOrders.map((order) => {
                const currentPayment = selectedPaymentMethod[order.id] || 'upi';
                const isExpanded = !!expandedOrderIds[order.id];
                const dishesAmount = getOrderDishesAmount(order);
                const activeDeliveryAmount = getOrderDeliveryAmount(order);
                const customChargeStr = riderDeliveryCharges[order.id] ?? '0';
                const customCharge = customChargeStr !== '' ? Math.max(0, parseInt(customChargeStr, 10) || 0) : 0;
                const selectedCount = getSelectedItemsCount(order);
                const totalItemsCount = order.items?.length || 0;
                const upiLink = getUpiDeepLink(order, activeDeliveryAmount);
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  order.address
                )}`;

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all"
                    id={`rider-order-card-${order.orderId}`}
                  >
                    {/* TOP CARD SECTION (Always Visible Compact Overview) */}
                    <div className="p-4 sm:p-5 space-y-3.5">
                      {/* Customer Name, Order ID, and Total Amount */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                              #{order.orderId}
                            </span>
                            <span className="font-heading font-extrabold text-base text-slate-900 truncate">
                              {order.customerName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Bill Amount
                          </span>
                          <span className="font-amount font-extrabold text-lg text-emerald-700">
                            ₹{order.totalAmount}
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Call & Navigation Quick Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${order.phone}`}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                          id={`call-btn-${order.orderId}`}
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>Call Customer</span>
                        </a>

                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
                          id={`maps-btn-${order.orderId}`}
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                          <span>Google Maps</span>
                        </a>
                      </div>

                      {/* Compact Address Line */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs space-y-1.5">
                        <div className="flex items-start gap-1.5 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed truncate">{order.address}</span>
                        </div>
                        {order.notes && (
                          <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-1.5 text-[11px] text-amber-900 italic truncate">
                            Note: "{order.notes}"
                          </div>
                        )}
                        {/* Live Distance to Customer */}
                        {order.customerLocation?.lat && riderCoords && (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 text-[11px] text-emerald-700 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>Customer is {formatDistanceAway(calculateDistanceInMeters(riderCoords.lat, riderCoords.lng, order.customerLocation.lat, order.customerLocation.lng))}</span>
                          </div>
                        )}
                      </div>

                      {/* Toggle Expand Card Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between active:scale-98 ${
                          isExpanded
                            ? 'bg-slate-100 border-slate-300 text-slate-900'
                            : 'bg-indigo-50/70 hover:bg-indigo-50 border-indigo-200 text-indigo-950'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-indigo-600" />
                          <span>
                            {isExpanded
                              ? 'Hide items & payment'
                              : `View ${totalItemsCount} items & Collect Payment`}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>
                    </div>

                    {/* EXPANDED SECTION: Items Checklist + Payment + Swipe Slider */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                        {/* 1. Item Selection Checklist */}
                        <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-1.5">
                              <PackageCheck className="w-4 h-4 text-slate-700" />
                              <span className="text-xs font-extrabold text-slate-900">
                                Select Items to Deliver
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setAllItemsSelection(order, true)}
                                className="text-slate-600 hover:text-slate-900 font-bold underline"
                              >
                                All
                              </button>
                              <span className="text-slate-300">•</span>
                              <button
                                type="button"
                                onClick={() => setAllItemsSelection(order, false)}
                                className="text-slate-400 hover:text-slate-700 font-bold"
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {/* Items Checklist Rows */}
                          <div className="space-y-1.5">
                            {order.items?.map((item, idx) => {
                              const isChecked = selectedItemsMap[order.id]?.[idx] !== false; // default true
                              return (
                                <label
                                  key={idx}
                                  className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                    isChecked
                                      ? 'bg-slate-50/90 border-slate-200 text-slate-900'
                                      : 'bg-white border-dashed border-slate-200 text-slate-400 line-through'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleItemSelection(order.id, idx)}
                                      className="w-4 h-4 text-slate-900 rounded focus:ring-0 cursor-pointer"
                                    />
                                    <span className="font-semibold truncate">
                                      {item.quantity}x {item.name}
                                      {item.selectedSize && ` (${item.selectedSize})`}
                                    </span>
                                  </div>
                                  <span className="font-amount font-bold shrink-0 ml-2">
                                    ₹{item.price * item.quantity}
                                  </span>
                                </label>
                              );
                            })}
                          </div>

                          {/* Selected Total Summary Banner */}
                          <div className="flex items-center justify-between pt-1 text-xs">
                            <span className="text-slate-500 font-medium">
                              Delivering: <strong>{selectedCount}</strong> of {totalItemsCount} dishes
                            </span>
                            <div className="text-right">
                              <span className="text-slate-500 text-[11px] mr-1">To Collect:</span>
                              <span className="font-amount font-extrabold text-sm text-emerald-700">
                                ₹{activeDeliveryAmount}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Receive Payment Module */}
                        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3">
                          {/* Rider Delivery Charge Input */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Bike className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Delivery Charge (₹)</span>
                              </label>
                              <div className="flex items-center gap-1.5 w-32 shrink-0">
                                <span className="text-xs font-bold text-slate-500">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="500"
                                  placeholder="0"
                                  value={riderDeliveryCharges[order.id] !== undefined ? riderDeliveryCharges[order.id] : '0'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRiderDeliveryCharges((prev) => ({
                                      ...prev,
                                      [order.id]: val
                                    }));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/80">
                              <span className="text-slate-500 font-medium">
                                Food: ₹{dishesAmount} + Delivery: ₹{customCharge}
                              </span>
                              <span className="font-extrabold text-emerald-700 text-xs font-amount">
                                Total Bill: ₹{activeDeliveryAmount}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              Payment Mode
                            </span>
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200/60">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPaymentMethod((prev) => ({ ...prev, [order.id]: 'upi' }))
                                }
                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                                  currentPayment === 'upi'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                UPI QR
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPaymentMethod((prev) => ({ ...prev, [order.id]: 'cash' }))
                                }
                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                                  currentPayment === 'cash'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Cash (COD)
                              </button>
                            </div>
                          </div>

                          {/* UPI QR Display View */}
                          {currentPayment === 'upi' ? (
                            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col items-center justify-center text-center space-y-2.5">
                              <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                                <QRCodeSVG
                                  value={upiLink}
                                  size={140}
                                  level="M"
                                  includeMargin={true}
                                />
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-xs font-bold text-slate-900 block">
                                  Scan to Pay ₹{activeDeliveryAmount}
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 block">
                                  {settings.upiId || 'gidhaurbakery@upi'}
                                </span>
                              </div>

                              <div className="w-full flex items-center justify-center pt-0.5">
                                <a
                                  href={upiLink}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open in GPay / PhonePe / Paytm</span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            /* Cash Mode View */
                            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 font-medium">Cash to Collect:</span>
                                <span className="font-amount font-extrabold text-base text-slate-900">
                                  ₹{activeDeliveryAmount}
                                </span>
                              </div>

                              {/* Quick Change Calculator */}
                              <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Cash Received Calculator
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="Amount received from customer"
                                    value={cashTendered[order.id] || ''}
                                    onChange={(e) =>
                                      setCashTendered((prev) => ({
                                        ...prev,
                                        [order.id]: e.target.value
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                                  />
                                </div>
                                {Number(cashTendered[order.id] || 0) >= activeDeliveryAmount && (
                                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between">
                                    <span>Return Change:</span>
                                    <span className="font-amount text-sm font-extrabold">
                                      ₹{Number(cashTendered[order.id]) - activeDeliveryAmount}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. Swipe To Deliver Interactive Slider */}
                        <div className="pt-1">
                          <SwipeToDeliver
                            amount={activeDeliveryAmount}
                            disabled={selectedCount === 0 || isProcessingDelivery === order.id}
                            isLoading={isProcessingDelivery === order.id}
                            label={`Slide to Deliver (₹${activeDeliveryAmount})`}
                            onConfirm={() => handleMarkDelivered(order, currentPayment)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Completed History List */}
        {activeTab === 'completed' && (
          <div className="space-y-3">
            {myCompletedOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No completed deliveries yet
                </h3>
                <p className="text-xs text-slate-500">
                  Your delivered orders for today will be recorded here with payment timestamps.
                </p>
              </div>
            ) : (
              myCompletedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl sm:rounded-3xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        #{order.orderId}
                      </span>
                      <h4 className="font-heading font-bold text-sm text-slate-900">
                        {order.customerName}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[200px] sm:max-w-none">
                      {order.address}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold uppercase">
                      Paid via {order.paymentMethod?.toUpperCase() || 'UPI/CASH'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-amount font-extrabold text-base text-emerald-700 block">
                      ₹{order.deliveredAmount || order.totalAmount}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Delivered</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DeliveryAgentPortal;
