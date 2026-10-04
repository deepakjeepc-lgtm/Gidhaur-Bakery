import React, { useState, useEffect } from 'react';
import { 
  Search, ArrowLeft, Package, Phone,
  ChefHat, Bike, PackageCheck, Loader2, AlertCircle, 
  RefreshCw, XCircle, ChevronDown, ChevronUp, Clock,
  ShoppingBag, MapPin, FileText, Trash2, CheckCircle2,
  Ban, AlertTriangle, Info
} from 'lucide-react';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Order, OrderStatus } from '../types';
import { calculateDistanceInMeters, formatDistanceAway } from '../utils/distance';
import { subscribeToLiveSync } from '../services/syncService';
import { isOrderFromToday, clearAllTrackingHistory } from '../services/orderArchiveService';
import { triggerHaptic } from '../utils/haptics';

interface TrackOrderPageProps {
  initialOrderId?: string;
  initialPhone?: string;
  onBackToMenu: () => void;
  onReorder?: (items: any[]) => void;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', sublabel: 'Waiting for restaurant', icon: Clock },
  { key: 'accepted', label: 'Confirmed', sublabel: 'Restaurant accepted', icon: PackageCheck },
  { key: 'preparing', label: 'Cooking', sublabel: 'Fresh preparation', icon: ChefHat },
  { key: 'out_for_delivery', label: 'On the Way', sublabel: 'Rider dispatched', icon: Bike },
  { key: 'delivered', label: 'Delivered', sublabel: 'Order completed', icon: PackageCheck },
];

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({
  initialOrderId = '',
  initialPhone = '',
  onBackToMenu,
  onReorder,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [itemsModalOrder, setItemsModalOrder] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(true);
  const [userLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [agentLiveCoords, setAgentLiveCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const agentUnsubscribesRef = React.useRef<Record<string, () => void>>({});

  // Subscribe to live agent documents for active assigned orders
  useEffect(() => {
    const assignedAgentIds = Array.from(
      new Set(orders.map((o) => o.assignedAgentId).filter(Boolean) as string[])
    );

    assignedAgentIds.forEach((agentId) => {
      if (!agentUnsubscribesRef.current[agentId]) {
        const agentDocRef = doc(db, 'delivery_agents', agentId);
        const unsub = onSnapshot(
          agentDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.currentLat && data.currentLng) {
                setAgentLiveCoords((prev) => ({
                  ...prev,
                  [agentId]: { lat: data.currentLat, lng: data.currentLng },
                }));
              }
            }
          },
          (err) => console.warn('Agent live tracking listener note:', err)
        );
        agentUnsubscribesRef.current[agentId] = unsub;
      }
    });

    return () => {
      // Clean up agent unsubscribes that are no longer present
      Object.entries(agentUnsubscribesRef.current).forEach(([id, unsub]) => {
        if (!assignedAgentIds.includes(id)) {
          if (typeof unsub === 'function') unsub();
          delete agentUnsubscribesRef.current[id];
        }
      });
    };
  }, [orders]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      Object.values(agentUnsubscribesRef.current).forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  // Saved device orders & profile
  const [savedDeviceOrders, setSavedDeviceOrders] = useState<any[]>([]);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const normalizeOrder = (data: any): Order => {
    const ordId = data.orderId || data.id || 'ORDER';
    return {
      id: data.id || ordId,
      orderId: ordId,
      customerName: data.customerName || 'Customer',
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      items: Array.isArray(data.items) ? data.items : [],
      subtotal: typeof data.subtotal === 'number' ? data.subtotal : 0,
      deliveryFee: typeof data.deliveryFee === 'number' ? data.deliveryFee : 0,
      totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
      status: (data.status as OrderStatus) || 'pending',
      paymentMethod: data.paymentMethod || 'cod',
      paymentStatus: data.paymentStatus || 'unpaid',
      assignedAgentId: data.assignedAgentId,
      assignedAgentName: data.assignedAgentName,
      assignedAgentPhone: data.assignedAgentPhone,
      customerLocation: data.customerLocation,
      riderLocation: data.riderLocation,
      createdAt: data.createdAt instanceof Date ? data.createdAt : (data.createdAt ? new Date(data.createdAt) : new Date()),
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : (data.updatedAt ? new Date(data.updatedAt) : undefined),
      statusTimestamps: data.statusTimestamps,
      kitchenSentAt: data.kitchenSentAt,
      acceptedAt: data.acceptedAt,
      dispatchedAt: data.dispatchedAt,
      deliveredAt: data.deliveredAt,
      cancellationRequested: data.cancellationRequested,
      cancellationStatus: data.cancellationStatus,
      cancellationReason: data.cancellationReason,
      cancellationRequestedAt: data.cancellationRequestedAt,
      cancellationResolvedAt: data.cancellationResolvedAt,
    };
  };

  const fetchFallbackOrders = async (
    identifier: string,
    isPhone: boolean
  ): Promise<Order[]> => {
    const clean = identifier.trim().toLowerCase();
    const cleanNoHyphen = clean.replace(/-/g, '');
    const cleanDigits = identifier.replace(/\D/g, '');
    const results: Order[] = [];

    // 1. Check local backend Express API (which holds store.json orders)
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const apiOrders = (await res.json()) as any[];
        if (Array.isArray(apiOrders)) {
          apiOrders.forEach((o) => {
            const hasValidItems = Array.isArray(o.items) && o.items.length > 0;
            if (!hasValidItems) return;
            const oPhone = String(o.phone || '').replace(/\D/g, '');
            const oId = String(o.orderId || o.id || '').toLowerCase();
            const oIdNoHyphen = oId.replace(/-/g, '');
            const matches = isPhone
              ? oPhone === cleanDigits || (cleanDigits.length >= 10 && oPhone.endsWith(cleanDigits))
              : oId === clean ||
                oIdNoHyphen === cleanNoHyphen ||
                (cleanDigits.length > 0 && (oId === cleanDigits || oId.endsWith(cleanDigits)));
            if (matches && !results.some((r) => r.orderId === (o.orderId || o.id))) {
              results.push(normalizeOrder(o));
            }
          });
        }
      }
    } catch (err) {
      console.warn('API orders fetch notice:', err);
    }

    // 2. Check localStorage recent orders
    try {
      const saved =
        localStorage.getItem('gidhaur_recent_orders') ||
        localStorage.getItem('swadeep_recent_orders');
      if (saved) {
        const localList = JSON.parse(saved);
        if (Array.isArray(localList)) {
          localList.forEach((o) => {
            const hasValidItems = Array.isArray(o.items) && o.items.length > 0;
            if (!hasValidItems) return;
            const oPhone = String(o.phone || '').replace(/\D/g, '');
            const oId = String(o.orderId || o.id || '').toLowerCase();
            const oIdNoHyphen = oId.replace(/-/g, '');
            const matches = isPhone
              ? oPhone === cleanDigits || (cleanDigits.length >= 10 && oPhone.endsWith(cleanDigits))
              : oId === clean ||
                oIdNoHyphen === cleanNoHyphen ||
                (cleanDigits.length > 0 && (oId === cleanDigits || oId.endsWith(cleanDigits)));
            if (matches && !results.some((r) => r.orderId === (o.orderId || o.id))) {
              results.push(normalizeOrder(o));
            }
          });
        }
      }
    } catch (err) {
      console.warn('LocalStorage orders fallback notice:', err);
    }

    return results;
  };

  // Helper to purge deleted/archived orders from local storage
  const purgeOrderFromLocalCache = (identifier: string, extraKeys: string[] = []) => {
    try {
      const keys = [identifier, ...extraKeys].map((k) => String(k).toLowerCase());
      const cleanStored = (storageKey: string) => {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const updated = list.filter((o: any) => {
              const oId = String(o.orderId || o.id || '').toLowerCase();
              return !keys.includes(oId);
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
            setSavedDeviceOrders(updated);
          }
        }
      };
      cleanStored('swadeep_recent_orders');
      cleanStored('gidhaur_recent_orders');
    } catch (e) {
      console.warn('Error purging order from cache:', e);
    }
  };

  const purgePhoneOrdersFromLocalCache = (phoneDigits: string) => {
    try {
      const cleanStored = (storageKey: string) => {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const updated = list.filter((o: any) => {
              const oPhone = String(o.phone || '').replace(/\D/g, '');
              return oPhone !== phoneDigits && !oPhone.endsWith(phoneDigits);
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
            setSavedDeviceOrders(updated);
          }
        }
      };
      cleanStored('swadeep_recent_orders');
      cleanStored('gidhaur_recent_orders');
    } catch (e) {
      console.warn('Error purging phone orders from cache:', e);
    }
  };

  // Real-time SSE live updates from server engine
  useEffect(() => {
    const unsub = subscribeToLiveSync({
      onOrdersUpdate: (incomingOrders) => {
        if (!Array.isArray(incomingOrders)) return;
        setOrders((prev) => {
          if (prev.length === 0) return prev;
          return prev
            .filter((ord) =>
              incomingOrders.some(
                (io) =>
                  (io.id === ord.id || io.orderId === ord.orderId) &&
                  !io.isArchived &&
                  !io.archivedAt &&
                  (io as any).status !== 'archived'
              )
            )
            .map((ord) => {
              const updated = incomingOrders.find(
                (io) => io.id === ord.id || io.orderId === ord.orderId
              );
              return updated ? normalizeOrder(updated) : ord;
            });
        });
      },
    });

    const handleOrderRemoved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const key = detail.orderId || detail.id;
      if (key) {
        setOrders((prev) => prev.filter((o) => o.orderId !== key && o.id !== key));
        setSavedDeviceOrders((prev) => prev.filter((o) => o.orderId !== key && o.id !== key));
      }
    };
    window.addEventListener('swadeep_order_removed', handleOrderRemoved);

    return () => {
      unsub();
      window.removeEventListener('swadeep_order_removed', handleOrderRemoved);
    };
  }, []);

  const handleClearTrackingHistory = () => {
    clearAllTrackingHistory();
    setOrders([]);
    setSavedDeviceOrders([]);
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setIsSearchBoxOpen(true);
    setSearchInput('');
    setErrorMessage(null);
    setSuccessNotice('Order tracking history cleared successfully.');
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        // Enforce user instruction: clear legacy track history
        if (localStorage.getItem('gidhaur_track_history_cleared_v2') !== 'true') {
          clearAllTrackingHistory();
          localStorage.setItem('gidhaur_track_history_cleared_v2', 'true');
        }

        const savedOrdersStr =
          localStorage.getItem('gidhaur_recent_orders') ||
          localStorage.getItem('swadeep_recent_orders');
        let ordersList: any[] = [];
        if (savedOrdersStr) {
          const parsed = JSON.parse(savedOrdersStr);
          if (Array.isArray(parsed)) {
            // Apply rule: only retain orders from today with valid items (purges 0-item ghost orders)
            ordersList = parsed.filter(
              (o) => o && (o.orderId || o.id) && Array.isArray(o.items) && o.items.length > 0 && isOrderFromToday(o)
            );
            // Auto-persist sanitized list back to storage
            localStorage.setItem('gidhaur_recent_orders', JSON.stringify(ordersList));
            localStorage.setItem('swadeep_recent_orders', JSON.stringify(ordersList));
            if (mounted) setSavedDeviceOrders(ordersList);
          }
        }
        const savedProfileStr =
          localStorage.getItem('gidhaur_customer_profile') ||
          localStorage.getItem('swadeep_customer_profile');
        let pPhone = '';
        if (savedProfileStr) {
          const prof = JSON.parse(savedProfileStr);
          if (prof.phone) {
            pPhone = prof.phone;
            if (mounted) setSavedPhone(prof.phone);
          }
        }

        const phoneToUse = initialPhone || pPhone || (ordersList.length > 0 ? ordersList[0].phone : null);
        const orderIdToUse = initialOrderId || (ordersList.length > 0 ? ordersList[0].orderId : null);

        if (initialOrderId) {
          await subscribeToSingleOrder(initialOrderId);
        } else if (initialPhone) {
          await subscribeToPhoneOrders(initialPhone);
        } else if (orderIdToUse && ordersList.length > 0) {
          await subscribeToSingleOrder(orderIdToUse);
        } else if (phoneToUse && ordersList.length > 0) {
          await subscribeToPhoneOrders(phoneToUse);
        } else {
          if (mounted) setIsSearchBoxOpen(true);
        }
      } catch (e) {
        console.warn('Could not read saved localStorage:', e);
        if (mounted) setIsSearchBoxOpen(true);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [initialOrderId, initialPhone]);

  const mapDocToOrder = (docSnap: any): Order => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      orderId: data.orderId || docSnap.id,
      customerName: data.customerName || 'Customer',
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      items: data.items || [],
      subtotal: data.subtotal || 0,
      deliveryFee: data.deliveryFee || 0,
      totalAmount: data.totalAmount || 0,
      status: data.status || 'pending',
      createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
      updatedAt: data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : undefined),
      acceptedAt: data.acceptedAt?.toDate?.() || (data.acceptedAt ? new Date(data.acceptedAt) : undefined),
      kitchenSentAt: data.kitchenSentAt?.toDate?.() || (data.kitchenSentAt ? new Date(data.kitchenSentAt) : undefined),
      dispatchedAt: data.dispatchedAt?.toDate?.() || (data.dispatchedAt ? new Date(data.dispatchedAt) : undefined),
      deliveredAt: data.deliveredAt?.toDate?.() || (data.deliveredAt ? new Date(data.deliveredAt) : undefined),
      statusTimestamps: data.statusTimestamps || {},
      assignedAgentId: data.assignedAgentId,
      assignedAgentName: data.assignedAgentName,
      assignedAgentPhone: data.assignedAgentPhone,
      assignedAgentVehicle: data.assignedAgentVehicle,
      assignedAgentVehicleNumber: data.assignedAgentVehicleNumber,
      customerLocation: data.customerLocation,
      riderLocation: data.riderLocation,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      cancellationRequested: data.cancellationRequested,
      cancellationStatus: data.cancellationStatus,
      cancellationReason: data.cancellationReason,
      cancellationRequestedAt: data.cancellationRequestedAt,
      cancellationResolvedAt: data.cancellationResolvedAt,
    };
  };

  const getStepTime = (ord: Order, stepKey: string, stepIndex: number, currentStepIndex: number): string | null => {
    // 1. Check statusTimestamps map
    const rawFromMap = ord.statusTimestamps?.[stepKey];
    if (rawFromMap) {
      const d = rawFromMap.toDate ? rawFromMap.toDate() : new Date(rawFromMap);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    }

    // 2. Check dedicated fields
    let directDate: Date | null = null;
    if (stepKey === 'pending') {
      directDate = ord.createdAt instanceof Date ? ord.createdAt : (ord.createdAt ? new Date(ord.createdAt) : null);
    } else if (stepKey === 'accepted') {
      directDate = ord.acceptedAt instanceof Date ? ord.acceptedAt : (ord.acceptedAt ? new Date(ord.acceptedAt) : null);
    } else if (stepKey === 'preparing') {
      directDate = ord.kitchenSentAt instanceof Date ? ord.kitchenSentAt : (ord.kitchenSentAt ? new Date(ord.kitchenSentAt) : null);
    } else if (stepKey === 'out_for_delivery') {
      directDate = ord.dispatchedAt instanceof Date ? ord.dispatchedAt : (ord.dispatchedAt ? new Date(ord.dispatchedAt) : null);
    } else if (stepKey === 'delivered') {
      directDate = ord.deliveredAt instanceof Date ? ord.deliveredAt : (ord.deliveredAt ? new Date(ord.deliveredAt) : null);
    }

    if (directDate && !isNaN(directDate.getTime())) {
      return directDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // 3. If step is completed or current, calculate reasonable offset relative to createdAt if direct date not found
    if (stepIndex <= currentStepIndex) {
      const baseDate = ord.createdAt instanceof Date ? ord.createdAt : (ord.createdAt ? new Date(ord.createdAt) : null);
      if (baseDate && !isNaN(baseDate.getTime())) {
        if (stepIndex === 0) {
          return baseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        // Estimated step delta for smooth historical visual
        const deltaMinutes = stepIndex === 1 ? 2 : stepIndex === 2 ? 6 : stepIndex === 3 ? 14 : 25;
        const simDate = new Date(baseDate.getTime() + deltaMinutes * 60 * 1000);
        return simDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    }

    return null;
  };

  const getLiveDistanceText = (ord: Order) => {
    const riderLat =
      ord.riderLocation?.lat ||
      (ord.assignedAgentId ? agentLiveCoords[ord.assignedAgentId]?.lat : undefined);
    const riderLng =
      ord.riderLocation?.lng ||
      (ord.assignedAgentId ? agentLiveCoords[ord.assignedAgentId]?.lng : undefined);

    if (riderLat && riderLng) {
      const custLat = userLiveCoords?.lat || ord.customerLocation?.lat;
      const custLng = userLiveCoords?.lng || ord.customerLocation?.lng;
      if (custLat && custLng) {
        const meters = calculateDistanceInMeters(custLat, custLng, riderLat, riderLng);
        return formatDistanceAway(meters);
      }
    }
    return 'Rider on the way';
  };

  const subscribeToSingleOrder = async (rawId: string) => {
    const rawClean = rawId.trim();
    if (!rawClean) return;

    const digitsOnly = rawClean.replace(/\D/g, '');
    let cleanId = rawClean.toUpperCase();

    setIsLoading(true);
    setErrorMessage(null);

    // 1. Immediately check local backend and localStorage so user sees their order instantly
    const localMatches = await fetchFallbackOrders(rawClean, false);
    if (localMatches.length > 0) {
      setOrders(localMatches);
      setExpandedOrders(new Set(localMatches.map((o) => o.orderId)));
      setIsSearchBoxOpen(false);
      setIsLoading(false);
      setErrorMessage(null);
    }

    const candidateIds = Array.from(
      new Set([
        rawClean,
        rawClean.replace('#', '').trim(),
        digitsOnly,
        cleanId,
        cleanId.replace(/-/g, ''),
        rawClean.toLowerCase(),
      ])
    ).filter(Boolean);

    // 2. Also listen to Firestore live document updates or query
    try {
      const ordersCol = collection(db, 'orders');
      const q = query(ordersCol, where('orderId', 'in', candidateIds.slice(0, 10)));

      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = onSnapshot(
        q,
        (querySnapshot) => {
          setIsLoading(false);
          if (querySnapshot.empty) {
            // Check direct docSnap with candidateIds
            const directId = candidateIds[0] || rawClean;
            const orderDocRef = doc(db, 'orders', directId);
            getDoc(orderDocRef).then((directSnap) => {
              if (directSnap.exists()) {
                const data = directSnap.data();
                if (data.isArchived || data.archived || data.status === 'archived' || data.isDeleted) {
                  // Archived or deleted by admin
                  setOrders([]);
                  purgeOrderFromLocalCache(rawClean, candidateIds);
                  setIsSearchBoxOpen(true);
                  setErrorMessage(`Order #${rawClean} is no longer active.`);
                  return;
                }
                const order = mapDocToOrder(directSnap);
                setOrders([order]);
                setExpandedOrders(new Set([order.orderId]));
                setIsSearchBoxOpen(false);
                setErrorMessage(null);
              } else {
                // Document deleted by admin
                setOrders([]);
                purgeOrderFromLocalCache(rawClean, candidateIds);
                setIsSearchBoxOpen(true);
                setErrorMessage(`Order #${rawClean} is no longer active.`);
              }
            }).catch(() => {
              setOrders([]);
              purgeOrderFromLocalCache(rawClean, candidateIds);
              setIsSearchBoxOpen(true);
              setErrorMessage(`Order #${rawClean} is no longer active.`);
            });
            return;
          }

          const fetchedOrders: Order[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isArchived || data.archived || data.status === 'archived' || data.isDeleted) return;
            fetchedOrders.push(mapDocToOrder(docSnap));
          });

          if (fetchedOrders.length === 0) {
            setOrders([]);
            purgeOrderFromLocalCache(rawClean, candidateIds);
            setIsSearchBoxOpen(true);
            setErrorMessage(`Order #${rawClean} is no longer active.`);
            return;
          }

          setOrders(fetchedOrders);
          setExpandedOrders(new Set(fetchedOrders.map((o) => o.orderId)));
          setIsSearchBoxOpen(false);
          setErrorMessage(null);
        },
        async (error) => {
          console.warn('Firestore live order listener note (using sync engine):', error);
          setIsLoading(false);
          if (localMatches.length === 0) {
            const recheck = await fetchFallbackOrders(rawClean, false);
            if (recheck.length > 0) {
              setOrders(recheck);
              setExpandedOrders(new Set(recheck.map((o) => o.orderId)));
              setIsSearchBoxOpen(false);
              setErrorMessage(null);
            } else {
              setErrorMessage(`No order found with ID "${rawClean}". Please check your Order ID.`);
            }
          }
        }
      );
    } catch (e) {
      setIsLoading(false);
      if (localMatches.length === 0) {
        setErrorMessage(`No order found with ID "${rawClean}".`);
      }
    }
  };

  const subscribeToPhoneOrders = async (rawPhone: string) => {
    const cleanPhone = rawPhone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) return;

    setIsLoading(true);
    setErrorMessage(null);

    // 1. Immediately check local backend and localStorage so user sees their orders instantly
    const localMatches = await fetchFallbackOrders(cleanPhone, true);
    if (localMatches.length > 0) {
      localMatches.sort((a, b) => {
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });
      setOrders(localMatches);
      setExpandedOrders(new Set([localMatches[0].orderId]));
      setIsSearchBoxOpen(false);
      setIsLoading(false);
      setErrorMessage(null);
    }

    // 2. Also listen to Firestore live query updates
    try {
      const ordersCol = collection(db, 'orders');
      const q = query(ordersCol, where('phone', '==', cleanPhone));

      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = onSnapshot(
        q,
        (querySnapshot) => {
          setIsLoading(false);
          if (querySnapshot.empty) {
            setOrders([]);
            purgePhoneOrdersFromLocalCache(cleanPhone);
            setIsSearchBoxOpen(true);
            setErrorMessage(`No active orders found for mobile "${cleanPhone}".`);
            return;
          }

          const fetchedOrders: Order[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isArchived || data.archived || data.status === 'archived' || data.isDeleted) return;
            fetchedOrders.push(mapDocToOrder(docSnap));
          });

          if (fetchedOrders.length === 0) {
            setOrders([]);
            purgePhoneOrdersFromLocalCache(cleanPhone);
            setIsSearchBoxOpen(true);
            setErrorMessage(`No active orders found for mobile "${cleanPhone}".`);
            return;
          }

          fetchedOrders.sort((a, b) => {
            const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return timeB - timeA;
          });

          setOrders(fetchedOrders);
          setIsSearchBoxOpen(false);
          setErrorMessage(null);

          // Auto-expand latest order
          setExpandedOrders((prev) => {
            const newSet = new Set(prev);
            if (fetchedOrders.length === 1) {
              newSet.add(fetchedOrders[0].orderId);
            } else if (initialOrderId) {
              const found = fetchedOrders.find(
                (o) => o.orderId === initialOrderId || o.id === initialOrderId
              );
              if (found) newSet.add(found.orderId);
            }
            return newSet;
          });
        },
        async (error) => {
          console.warn('Firestore live phone listener note (using sync engine):', error);
          setIsLoading(false);
          if (localMatches.length === 0) {
            const recheck = await fetchFallbackOrders(cleanPhone, true);
            if (recheck.length > 0) {
              recheck.sort((a, b) => {
                const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
                const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
                return timeB - timeA;
              });
              setOrders(recheck);
              setExpandedOrders(new Set([recheck[0].orderId]));
              setIsSearchBoxOpen(false);
              setErrorMessage(null);
            } else {
              setErrorMessage(`No orders found for mobile "${cleanPhone}".`);
            }
          }
        }
      );
    } catch (e) {
      setIsLoading(false);
      if (localMatches.length === 0) {
        setErrorMessage(`No orders found for mobile "${cleanPhone}".`);
      }
    }
  };

  const handleSmartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchInput.trim();
    if (!queryStr) {
      setErrorMessage('Please enter your 5-digit Order ID or 10-digit Phone Number.');
      return;
    }

    const digitsOnly = queryStr.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      await subscribeToPhoneOrders(digitsOnly);
    } else {
      await subscribeToSingleOrder(queryStr);
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleConfirmCancelRequest = async () => {
    if (!orderToCancel) return;
    try {
      setIsCancelling(true);
      triggerHaptic('medium');
      const orderDocRef = doc(db, 'orders', orderToCancel.id);
      await updateDoc(orderDocRef, {
        cancellationRequested: true,
        cancellationStatus: 'requested',
        cancellationRequestedAt: serverTimestamp(),
      });
      setSuccessNotice(`Cancellation requested for Order #${orderToCancel.orderId}. Restaurant is reviewing.`);
      setOrderToCancel(null);
    } catch (error) {
      console.error('Error requesting cancellation:', error);
      setErrorMessage('Failed to send cancellation request. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'delivered': return { text: 'Delivered', bg: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' };
      case 'out_for_delivery': return { text: 'On the Way', bg: 'bg-sky-500/15 text-sky-600 border-sky-500/20' };
      case 'preparing': return { text: 'Cooking', bg: 'bg-amber-500/15 text-amber-600 border-amber-500/20' };
      case 'accepted': return { text: 'Confirmed', bg: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/20' };
      case 'rejected': return { text: 'Cancelled', bg: 'bg-red-500/15 text-red-600 border-red-500/20' };
      default: return { text: 'Order Placed', bg: 'bg-slate-500/15 text-slate-600 border-slate-500/20' };
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 pt-1 sm:pt-4 pb-8 space-y-3">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between bg-white/60 p-1.5 sm:p-2 rounded-full border border-slate-200/70 backdrop-blur-md shadow-2xs mb-3">
        <button
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full text-[13px] font-bold text-slate-700 transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Menu</span>
        </button>

        {orders.length > 0 && (
          <button
            onClick={() => setIsSearchBoxOpen(!isSearchBoxOpen)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all shadow-sm active:scale-95 border cursor-pointer ${
              isSearchBoxOpen
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80'
            }`}
          >
            <Search className={`w-4 h-4 ${isSearchBoxOpen ? 'text-white/70' : 'text-slate-400'}`} />
            <span>{isSearchBoxOpen ? 'Close Search' : 'Track Another'}</span>
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search / Track Box (Expands/Collapses or Shows prominently when no order active) */}
      {(isSearchBoxOpen || orders.length === 0) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl text-center relative overflow-hidden flex flex-col items-center justify-center mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-slate-50 to-white pointer-events-none" />
          
          <div className="relative z-10 w-14 h-14 rounded-full bg-slate-50 text-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
            <Package className="w-6 h-6" />
          </div>

          <h1 className="relative z-10 font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 mb-2">
            Track Your Order
          </h1>
          <p className="relative z-10 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
            Enter your <strong className="text-slate-800 font-semibold">5-Digit Order ID</strong> or <strong className="text-slate-800 font-semibold">Mobile Number</strong>.
          </p>

          <form onSubmit={handleSmartSearch} className="relative z-10 w-full max-w-md mx-auto space-y-3">
            <div className="relative group">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-slate-800 transition-colors" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. 58291 or 9876543210"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 font-medium tracking-wide focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !searchInput.trim()}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Track Status</span>
              )}
            </button>
          </form>

          {errorMessage && (
            <div className="max-w-md mx-auto mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2 text-left w-full">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {orders
          .filter((ord) => ord && ord.orderId && Array.isArray(ord.items) && ord.items.length > 0)
          .map((ord) => {
          const isExpanded = expandedOrders.has(ord.orderId);
          const badge = getStatusBadge(ord.status);
          const isDelivered = ord.status === 'delivered';
          const isCancelled = ord.status === 'rejected';
          const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === ord.status);
          
          return (
            <div 
              key={ord.orderId} 
              className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${isDelivered ? 'border-emerald-200/60 shadow-emerald-900/5' : isCancelled ? 'border-red-200/60 shadow-red-900/5' : 'border-slate-200/80 shadow-slate-900/5'} ${isExpanded ? 'ring-2 ring-slate-900/5 ring-offset-2' : 'hover:border-slate-300/80 hover:shadow-md'}`}
            >
              {/* Order Summary Header */}
              <div 
                className={`p-4 sm:p-5 flex flex-col justify-between gap-2.5 relative overflow-hidden transition-colors ${isDelivered ? 'bg-emerald-50/30' : isCancelled ? 'bg-red-50/30' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-[13px] text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 tracking-wide shadow-xs">
                      #{ord.orderId}
                    </span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-xs ${badge.bg}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-amount font-extrabold text-slate-900 text-lg sm:text-xl">
                      ₹{ord.totalAmount}
                    </span>
                  </div>
                </div>
                
                {/* Polished Interactive Items Capsule & Creation Timestamp */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemsModalOrder(ord);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/90 text-xs font-bold text-slate-800 transition-all active:scale-95 shadow-2xs group cursor-pointer"
                    title="View ordered items popup"
                  >
                    <Package className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 transition-colors" />
                    <span>{ord.items?.length || 0} {ord.items?.length === 1 ? 'item' : 'items'}</span>
                  </button>

                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                     <Clock className="w-3 h-3" />
                     <span className="font-mono">{ord.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                     <span>•</span>
                     <span>{ord.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Cancellation & Reorder Action Bar */}
                <div className="pt-2 border-t border-slate-100/80 flex flex-col gap-2">
                  {/* Status Banner when Cancellation is Requested */}
                  {ord.cancellationStatus === 'requested' && ord.status !== 'rejected' && (
                    <div className="w-full bg-amber-50 border border-amber-200/90 rounded-2xl p-2.5 px-3 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-amber-950 truncate">
                          Cancellation Requested • Waiting for restaurant confirmation
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                        In Review
                      </span>
                    </div>
                  )}

                  {/* Status Banner when Cancellation was Declined by Restaurant */}
                  {ord.cancellationStatus === 'rejected' && ord.status !== 'rejected' && (
                    <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 px-3 flex items-center gap-2 text-xs text-slate-600 animate-in fade-in duration-200">
                      <Info className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Cancellation request was declined by restaurant — your order is being prepared!</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 w-full flex-wrap">
                    {/* Beautiful Capsule Style Cancel Button - ONLY when order placed (pending) or confirmed (accepted) and NOT sent to kitchen (preparing+) */}
                    {(ord.status === 'pending' || ord.status === 'accepted') &&
                      ord.cancellationStatus !== 'requested' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('light');
                            setOrderToCancel(ord);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100/90 text-rose-700 active:scale-95 border border-rose-200/90 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer flex-1 sm:flex-none"
                          id={`cancel-order-btn-${ord.orderId}`}
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                          <span>Cancel Order</span>
                        </button>
                      )}

                    {/* Reorder Button */}
                    {onReorder && ord.items?.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorder(ord.items);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer flex-1 sm:flex-none"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reorder Items</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Tracking Timeline (Clean, unified spacing, scaled 25%) */}
              <div className="border-t border-slate-100 bg-white">
                  
                  {/* Stepper Timeline */}
                  <div className="p-5 sm:p-6 bg-white">
                    {isCancelled ? (
                      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-bold text-sm sm:text-base text-red-900">Order Cancelled</p>
                          <p className="text-xs sm:text-sm text-red-700 mt-0.5 font-medium">This order could not be fulfilled.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[23px] sm:left-[27px] top-5 bottom-6 w-0.5 bg-slate-200 rounded-full" />
                        <div className="space-y-5 sm:space-y-6 relative">
                          {STATUS_STEPS.map((step, index) => {
                            const isCompleted = currentStepIndex >= index;
                            // When delivered, all steps are completed (green). Active pulse is only for in-progress orders.
                            const isCurrent = !isDelivered && currentStepIndex === index;
                            const Icon = step.icon;
                            const stepTime = getStepTime(ord, step.key, index, currentStepIndex);

                            return (
                              <React.Fragment key={step.key}>
                                <div className="flex items-center gap-4 sm:gap-5 relative group">
                                  <div className="relative flex-shrink-0 z-10 flex items-center justify-center">
                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                      isCurrent 
                                        ? 'bg-slate-900 text-white shadow-md ring-3 ring-slate-900/10 scale-105' 
                                        : isCompleted 
                                        ? 'bg-emerald-500 text-white shadow-2xs' 
                                        : 'bg-white text-slate-400 border-2 border-slate-200'
                                    }`}>
                                      <Icon className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                                    </div>
                                    {isCurrent && (
                                      <div className="absolute inset-0 rounded-2xl border-2 border-slate-900 animate-ping opacity-20" />
                                    )}
                                  </div>
                                  <div className={`flex-1 min-w-0 ${isCurrent ? 'opacity-100' : isCompleted ? 'opacity-90' : 'opacity-40'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className={`text-sm sm:text-base font-bold ${isCurrent ? 'text-slate-900 font-extrabold' : isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {step.label}
                                      </h4>
                                      {/* Monospace Timestamp pill next to progress */}
                                      {stepTime && (
                                        <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-500 shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                                          {stepTime}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
                                      {step.sublabel}
                                    </p>
                                  </div>
                                </div>

                                {/* Direct Rider Info & Call Option (between On the Way & Delivered) */}
                                {step.key === 'out_for_delivery' && ord.status === 'out_for_delivery' && (
                                  <div className="ml-16 sm:ml-18 -mt-1 mb-2 flex items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 px-3.5">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                          {ord.assignedAgentName || 'Delivery Partner'}
                                        </span>
                                        {ord.assignedAgentVehicleNumber && (
                                          <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                            {ord.assignedAgentVehicleNumber}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] sm:text-xs text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>Rider is on the way 🛵</span>
                                      </p>
                                    </div>

                                    {ord.assignedAgentPhone && (
                                      <a
                                        href={`tel:${ord.assignedAgentPhone}`}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-2xs transition-all shrink-0"
                                      >
                                        <Phone className="w-3.5 h-3.5 fill-current" />
                                        <span>Call</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Order Items Detail Popup Modal */}
      {itemsModalOrder && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => setItemsModalOrder(null)}
        >
          <div 
            className="relative bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200/80 z-10 flex flex-col my-auto max-h-[90vh] sm:max-h-[85vh] transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900 leading-tight">
                    Order Items
                  </h3>
                  <span className="font-mono text-[11px] font-bold text-slate-500">
                    #{itemsModalOrder.orderId} • {itemsModalOrder.items?.length || 0} {itemsModalOrder.items?.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemsModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shadow-2xs cursor-pointer"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable Itemized List & Pricing Breakdown */}
            <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Dishes list */}
              <div className="space-y-3">
                {itemsModalOrder.items?.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-12 aspect-[4/3] rounded-xl object-contain sm:object-contain border border-slate-200/80 shrink-0 bg-white shadow-2xs p-0.5"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-12 aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 text-slate-400 shadow-2xs">
                          <Package className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-sm text-slate-900 truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                          {item.selectedSize && (
                            <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                              {item.selectedSize}
                            </span>
                          )}
                          <span className="font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                            Qty: {item.quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <span className="font-mono font-extrabold text-sm text-slate-900">
                        ₹{item.price * item.quantity}
                      </span>
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          ₹{item.price} each
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bill summary breakdown */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹{itemsModalOrder.subtotal || itemsModalOrder.totalAmount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {itemsModalOrder.deliveryFee ? `₹${itemsModalOrder.deliveryFee}` : 'FREE'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-sm font-extrabold text-slate-900">
                  <span>Total Payable Amount</span>
                  <span className="font-mono text-base text-slate-900">₹{itemsModalOrder.totalAmount}</span>
                </div>
              </div>

              {/* Delivery Details */}
              {(itemsModalOrder.address || itemsModalOrder.notes) && (
                <div className="space-y-2 text-xs">
                  {itemsModalOrder.address && (
                    <div className="flex items-start gap-2.5 text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-800 block text-[11px]">Delivery Address</span>
                        <span className="leading-relaxed text-slate-600">{itemsModalOrder.address}</span>
                      </div>
                    </div>
                  )}
                  {itemsModalOrder.notes && (
                    <div className="flex items-start gap-2.5 text-slate-600 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/50">
                      <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-900 block text-[11px]">Cooking / Delivery Instructions</span>
                        <span className="text-amber-800 leading-relaxed">{itemsModalOrder.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setItemsModalOrder(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all text-center cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {orderToCancel && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => setOrderToCancel(null)}
        >
          <div
            className="relative bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200/80 z-10 p-5 sm:p-6 text-center space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-2xs border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Cancel Order #{orderToCancel.orderId}?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to cancel this order? The restaurant will review and confirm your cancellation request.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                disabled={isCancelling}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-all cursor-pointer"
              >
                No, Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelRequest}
                disabled={isCancelling}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Yes, Cancel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

