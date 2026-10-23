import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  ChefHat,
  Bike,
  PackageCheck,
  Phone,
  MapPin,
  Volume2,
  VolumeX,
  LogOut,
  Search,
  Bell,
  TrendingUp,
  Store,
  ChevronDown,
  ArrowLeft,
  X,
  Trash2,
  Check,
  Loader2,
  Sliders,
  AlertTriangle,
  Archive,
  Boxes,
  ArrowUpRight
} from 'lucide-react';
import {
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToSharedOrders } from '../../services/orderListenerService';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus, Product, DeliveryAgent, KitchenStaff, RestaurantSettings } from '../../types';
import { ProductManagement } from './ProductManagement';
import { DeliveryAgentsManagement } from './DeliveryAgentsManagement';
import { KitchenStaffManagement } from './KitchenStaffManagement';
import { PreparingStaffManagement } from './PreparingStaffManagement';
import { PaymentSettings } from './PaymentSettings';
import { CloudStorageMeter } from './CloudStorageMeter';
import { DatabaseStatusIndicator } from './DatabaseStatusIndicator';
import { InventoryManagementView } from './InventoryManagementView';
import { deductStockForAcceptedOrder, isItemLowStock } from '../../services/inventoryService';
import { OrderHistoryView } from './OrderHistoryView';
import {
  ARCHIVE_STORAGE_KEYS,
  performDailyOrderRollover,
  partitionDailyOrdersPure,
  getDeletedOrderIds,
  getArchivedOrders,
  deleteArchivedOrder,
  clearAllArchivedOrders,
  archiveSingleOrder,
  recordDeliveredOrderInArchive,
  syncArchivedOrdersFromServer,
  getTodayDateString,
  isOrderFromToday,
  removeCustomerOwnOrder,
  markOrderPermanentlyDeleted,
  clearAllTrackingHistory
} from '../../services/orderArchiveService';
import { KitchenDisplayPage } from '../kitchen/KitchenDisplayPage';
import { PreparingDisplayPage } from '../preparing/PreparingDisplayPage';
import { DeliveryAgentPortal } from '../delivery/DeliveryAgentPortal';
import { SoundSettingsModal } from './SoundSettingsModal';
import { useOrderSoundAlert } from '../../hooks/useOrderSoundAlert';
import {
  subscribeToDeliveryAgents,
  subscribeToKitchenStaff,
  subscribeToPreparingStaff,
  subscribeToRestaurantSettings,
  getLocalRestaurantSettings,
  getLocalPreparingStaff,
  getLocalDeliveryAgents,
  getLocalKitchenStaff
} from '../../services/staffService';
import { PreparingStaff } from '../../types';
import {
  getOrderCategoryClassification,
  isFoodItem,
  isNonFoodItem
} from '../../utils/orderCategoryHelper';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import {
  playOrderAlertChime,
  sendNativeNotification
} from '../../utils/sound';
import {
  saveActiveAdminTab,
  getSavedActiveAdminTab,
  restoreScrollPosition
} from '../../utils/scrollStateStorage';
import { triggerHaptic } from '../../utils/haptics';

interface AdminDashboardProps {
  products: Product[];
  onBackToStore: () => void;
  onLogout?: () => void;
  onUpdateProducts?: (products: Product[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  products,
  onBackToStore,
  onLogout,
  onUpdateProducts
}) => {
  const { user, signOut } = useAuth();
  const [staffSubTab, setStaffSubTab] = useState<'kitchen' | 'preparing' | 'delivery'>(() => {
    const saved = getSavedActiveAdminTab<string>('orders');
    if (saved === 'preparing_staff') return 'preparing';
    if (saved === 'delivery_agents') return 'delivery';
    return 'kitchen';
  });

  const [activeTab, setActiveTabState] = useState<
    'orders' | 'products' | 'staff' | 'delivery_agents' | 'kitchen_staff' | 'preparing_staff' | 'settings' | 'stats' | 'usage'
  >(() => {
    const saved = getSavedActiveAdminTab<string>('orders');
    if (saved === 'kitchen_staff' || saved === 'preparing_staff' || saved === 'delivery_agents') return 'staff';
    if (saved === 'usage') return 'orders';
    return (saved as any) || 'orders';
  });

  const handleTabChange = (
    newTab: 'orders' | 'products' | 'staff' | 'delivery_agents' | 'kitchen_staff' | 'preparing_staff' | 'settings' | 'stats' | 'usage'
  ) => {
    let targetTab = newTab;
    if (newTab === 'kitchen_staff') {
      targetTab = 'staff';
      setStaffSubTab('kitchen');
    } else if (newTab === 'preparing_staff') {
      targetTab = 'staff';
      setStaffSubTab('preparing');
    } else if (newTab === 'delivery_agents') {
      targetTab = 'staff';
      setStaffSubTab('delivery');
    } else if (newTab === 'usage') {
      targetTab = 'orders';
    }

    if (targetTab === activeTab && newTab === targetTab) return;
    try {
      triggerHaptic('selection');
    } catch {}
    setActiveTabState(targetTab);
    saveActiveAdminTab(targetTab);
    if (window.scrollY > 200) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const setActiveTab = handleTabChange;

  // Restore scroll position on initial load of AdminDashboard
  useEffect(() => {
    restoreScrollPosition(`admin_${activeTab}`, 1);
  }, []);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersSubTab, setOrdersSubTab] = useState<'today' | 'history'>('today');
  const [archivedOrders, setArchivedOrders] = useState<Order[]>(() => getArchivedOrders());
  const purgedPastOrderIdsRef = useRef<Set<string>>(new Set());

  // Live Inventory & Catalog Reactive State
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);
  const [analyticsSubView, setAnalyticsSubView] = useState<'stock' | 'revenue'>('stock');

  useEffect(() => {
    setLiveProducts(products);
  }, [products]);

  useEffect(() => {
    const handleProductsUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLiveProducts(e.detail);
      }
    };
    window.addEventListener('swadeep_products_updated', handleProductsUpdate);
    return () => window.removeEventListener('swadeep_products_updated', handleProductsUpdate);
  }, []);

  const lowStockCount = useMemo(() => {
    return liveProducts.filter((p) => isItemLowStock(p)).length;
  }, [liveProducts]);

  // Listen to background history updates and sync server archive once on mount
  useEffect(() => {
    syncArchivedOrdersFromServer().then((merged) => {
      setArchivedOrders(merged);
    });
    const handleHistoryUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setArchivedOrders(e.detail);
      } else {
        setArchivedOrders(getArchivedOrders());
      }
    };
    window.addEventListener('gidhaur_order_history_updated', handleHistoryUpdate);
    return () => window.removeEventListener('gidhaur_order_history_updated', handleHistoryUpdate);
  }, []);

  // Daily Order Rollover Rule:
  // As soon as date changes, all orders from previous days (pending, accepted, preparing, out_for_delivery, delivered, rejected)
  // are automatically cleared from today's live queue and moved into the Order History Archive.
  const [currentDateStr, setCurrentDateStr] = useState(() => getTodayDateString());

  // Check every 15 seconds and on tab wake if calendar date rolled over (midnight auto-reset)
  useEffect(() => {
    const checkRollover = () => {
      const today = getTodayDateString();
      if (today !== currentDateStr) {
        setCurrentDateStr(today);
      }
    };
    const timer = setInterval(checkRollover, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkRollover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentDateStr]);

  // Pure render-safe computation of todayOrders (zero synchronous localStorage writes during render)
  const todayOrders = useMemo(() => {
    const { todayOrders: activeToday } = partitionDailyOrdersPure(
      orders,
      currentDateStr,
      getDeletedOrderIds()
    );
    return activeToday;
  }, [orders, currentDateStr]);

  // Side-effect effect: persist rolled-over past-day orders & delivered orders to Archive,
  // and remove previous-day orders from active Firestore queue so they only live in Archive
  useEffect(() => {
    const { archivedOrders: updatedArchive, pastOrderIdsToPurge } = performDailyOrderRollover(orders);
    setArchivedOrders((prev) => {
      if (
        prev.length === updatedArchive.length &&
        (prev[0]?.id === updatedArchive[0]?.id || prev[0]?.orderId === updatedArchive[0]?.orderId) &&
        prev[0]?.status === updatedArchive[0]?.status
      ) {
        return prev;
      }
      return updatedArchive;
    });

    if (pastOrderIdsToPurge.length > 0) {
      const unpurgedIds = pastOrderIdsToPurge.filter(
        (id) => id && !purgedPastOrderIdsRef.current.has(id)
      );
      if (unpurgedIds.length > 0) {
        unpurgedIds.forEach((id) => purgedPastOrderIdsRef.current.add(id));
        unpurgedIds.forEach((docId) => {
          deleteDoc(doc(db, 'orders', docId)).catch(() => {});
          try {
            fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
          } catch {}
        });
      }
    }
  }, [orders, currentDateStr]);

  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [kitchenStaff, setKitchenStaff] = useState<KitchenStaff[]>([]);
  const [preparingStaff, setPreparingStaff] = useState<PreparingStaff[]>(() => getLocalPreparingStaff());
  const [settings, setSettings] = useState<RestaurantSettings>(getLocalRestaurantSettings());

  // Direct Live Screen Preview Mode for Admin
  const [previewAgent, setPreviewAgent] = useState<DeliveryAgent | null>(null);
  const [previewChef, setPreviewChef] = useState<KitchenStaff | null>(null);
  const [previewPreparingStaff, setPreviewPreparingStaff] = useState<PreparingStaff | null>(null);
  const [isScreenSwitcherOpen, setIsScreenSwitcherOpen] = useState(false);

  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // Audio Alerts hook - Handles repeating chime for today's active pending orders
  const soundAlert = useOrderSoundAlert(todayOrders);

  const [notificationTestToast, setNotificationTestToast] = useState<{ message: string; type: 'success' | 'warn' } | null>(null);

  const handleTestNotificationClick = async () => {
    triggerHaptic('medium');
    let perm = soundAlert.permissionStatus;
    if (perm !== 'granted') {
      perm = await soundAlert.handleRequestPermission();
    }

    if (perm === 'granted') {
      try {
        await sendNativeNotification(
          '🔔 Test Order Alert - Gidhaur Bakery',
          'Phone notification & alert sound working! Naya order aane par aisa hi alert aayega.',
          {
            tag: 'admin-test-order-alert',
            vibrate: [500, 250, 500, 250, 500],
          }
        );
      } catch (err) {
        console.warn('Failed to send test notification:', err);
      }
      playOrderAlertChime();
      setNotificationTestToast({
        message: '✓ Test Notification sent! Check phone notification bar and sound.',
        type: 'success',
      });
    } else if (perm === 'denied') {
      setNotificationTestToast({
        message: '⚠️ Notification blocked. Please allow notifications in phone/browser site settings.',
        type: 'warn',
      });
    } else {
      setNotificationTestToast({
        message: 'ℹ️ Notification permission required to ring your phone on new orders.',
        type: 'warn',
      });
    }

    setTimeout(() => {
      setNotificationTestToast(null);
    }, 4500);
  };

  const [dispatchingOrder, setDispatchingOrder] = useState<Order | null>(null);
  const [adminCheckedItems, setAdminCheckedItems] = useState<Record<string, boolean>>({});
  const [adminSelectedRiderId, setAdminSelectedRiderId] = useState<string>('');

  const handleOpenAdminDispatch = (order: Order) => {
    setDispatchingOrder(order);
    const active = deliveryAgents.filter((a) => a.status === 'active');
    setAdminSelectedRiderId(active.length > 0 ? active[0].id : '');

    const initialChecked: Record<string, boolean> = {};
    const items = order.items || [];

    const hasAnyStationProgress =
      order.kitchenReady ||
      order.preparingReady ||
      (Array.isArray(order.kitchenTickedItems) && order.kitchenTickedItems.length > 0) ||
      (Array.isArray(order.preparingTickedItems) && order.preparingTickedItems.length > 0);

    items.forEach((item, idx) => {
      const isKitchen = isFoodItem(item);
      const isPrep = isNonFoodItem(item);
      const itemName = String(item.name || (item as any).product?.name || '').toLowerCase().trim();

      if (hasAnyStationProgress) {
        if (isKitchen) {
          if (order.kitchenReady) {
            initialChecked[`${order.id}-${idx}`] = true;
          } else if (Array.isArray(order.kitchenTickedItems)) {
            initialChecked[`${order.id}-${idx}`] = order.kitchenTickedItems.some(
              (k) => String(k).toLowerCase().trim() === itemName
            );
          } else {
            initialChecked[`${order.id}-${idx}`] = false;
          }
        } else if (isPrep) {
          if (order.preparingReady) {
            initialChecked[`${order.id}-${idx}`] = true;
          } else if (Array.isArray(order.preparingTickedItems)) {
            initialChecked[`${order.id}-${idx}`] = order.preparingTickedItems.some(
              (p) => String(p).toLowerCase().trim() === itemName
            );
          } else {
            initialChecked[`${order.id}-${idx}`] = false;
          }
        } else {
          initialChecked[`${order.id}-${idx}`] = true;
        }
      } else {
        initialChecked[`${order.id}-${idx}`] = true;
      }
    });

    setAdminCheckedItems((prev) => ({ ...prev, ...initialChecked }));
  };

  const toggleAdminItemCheck = (orderId: string, itemIdx: number) => {
    setAdminCheckedItems((prev) => ({
      ...prev,
      [`${orderId}-${itemIdx}`]: !prev[`${orderId}-${itemIdx}`]
    }));
  };

  const handleAdminTickAllItems = (orderId: string, count: number) => {
    setAdminCheckedItems((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) {
        next[`${orderId}-${i}`] = true;
      }
      return next;
    });
  };

  const handleAdminUntickAllItems = (orderId: string, count: number) => {
    setAdminCheckedItems((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) {
        next[`${orderId}-${i}`] = false;
      }
      return next;
    });
  };

  // Deletion and confirmation modals state
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [isClearingAllModalOpen, setIsClearingAllModalOpen] = useState(false);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Stable memoized callbacks to prevent heavy child re-renders on tab switch or dropdown toggle
  const onUpdateProductsRef = useRef(onUpdateProducts);
  useEffect(() => {
    onUpdateProductsRef.current = onUpdateProducts;
  }, [onUpdateProducts]);

  const handleUpdateProductsStable = useCallback((updated: Product[]) => {
    setLiveProducts(updated);
    if (onUpdateProductsRef.current) onUpdateProductsRef.current(updated);
  }, []);

  const handleRefreshCatalogStable = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: liveProducts }));
    } catch {}
  }, [liveProducts]);

  const handleSettingsUpdateStable = useCallback((newSettings: any) => {
    setSettings(newSettings);
  }, []);

  const handlePreviewChefStable = useCallback((chef: any) => setPreviewChef(chef), []);
  const handlePreviewPrepStable = useCallback((st: any) => setPreviewPreparingStaff(st), []);
  const handlePreviewAgentStable = useCallback((ag: any) => setPreviewAgent(ag), []);


  const handleDeleteArchivedOrder = async (orderId: string) => {
    const match =
      orders.find((o) => (o.orderId || o.id) === orderId || o.id === orderId) ||
      archivedOrders.find((o) => (o.orderId || o.id) === orderId || o.id === orderId);
    const docId = match?.id || orderId;
    const displayOrderId = match?.orderId || orderId;

    deleteArchivedOrder(orderId, docId);
    if (displayOrderId !== orderId) {
      deleteArchivedOrder(displayOrderId, docId);
    }
    setArchivedOrders((prev) =>
      prev.filter((o) => o.orderId !== orderId && o.id !== orderId && o.id !== docId)
    );
    setOrders((prev) =>
      prev.filter((o) => o.orderId !== orderId && o.id !== orderId && o.id !== docId)
    );

    try {
      window.dispatchEvent(
        new CustomEvent('swadeep_order_removed', { detail: { orderId: displayOrderId, id: docId } })
      );
    } catch {}

    try {
      fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
      if (displayOrderId && displayOrderId !== docId) {
        fetch(`/api/orders/${displayOrderId}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch {}

    try {
      await deleteDoc(doc(db, 'orders', docId));
      if (displayOrderId && displayOrderId !== docId) {
        await deleteDoc(doc(db, 'orders', displayOrderId)).catch(() => {});
      }
    } catch (e) {
      console.warn('Firestore order deletion note:', e);
    }
  };

  const handleClearAllHistory = async () => {
    const toDelete = [...archivedOrders];
    clearAllArchivedOrders();
    setArchivedOrders([]);
    setOrders((prev) => prev.filter((o) => isOrderFromToday(o)));

    try {
      fetch('/api/orders/clear-archive', { method: 'POST' }).catch(() => {});
    } catch {}

    try {
      const batch = writeBatch(db);
      toDelete.forEach((ord) => {
        const docId = ord.id || ord.orderId;
        if (docId) batch.delete(doc(db, 'orders', docId));
      });
      await batch.commit();
    } catch (e) {
      toDelete.forEach((ord) => {
        const docId = ord.id || ord.orderId;
        if (docId) deleteDoc(doc(db, 'orders', docId)).catch(() => {});
      });
    }
  };

  const handleArchiveSingleOrder = async (order: Order) => {
    archiveSingleOrder(order);
    const orderKey = order.orderId || order.id;
    setOrders((prev) => prev.filter((o) => (o.orderId || o.id) !== orderKey));
    setArchivedOrders((prev) => {
      const filtered = prev.filter((o) => (o.orderId || o.id) !== orderKey);
      return [{ ...order, archivedAt: new Date().toISOString(), isManualArchive: true }, ...filtered];
    });

    // 1. Delete from active Firestore orders collection so customer view updates in real-time
    try {
      const docId = order.id || order.orderId;
      await deleteDoc(doc(db, 'orders', docId));
      if (order.orderId && order.orderId !== order.id) {
        await deleteDoc(doc(db, 'orders', order.orderId)).catch(() => {});
      }
    } catch (e) {
      console.warn('Firestore order archive note:', e);
    }

    // 2. Delete from server backend
    try {
      const docId = order.id || order.orderId;
      fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
      if (order.orderId && order.orderId !== order.id) {
        fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch {}

    // 3. Purge from customer recent orders in local storage
    try {
      removeCustomerOwnOrder(order.orderId || order.id, [order.id, order.orderId]);
      window.dispatchEvent(new CustomEvent('swadeep_order_removed', { detail: { orderId: order.orderId, id: order.id } }));
    } catch {}
  };

  // Initial subscriptions
  useEffect(() => {
    const unsubAgents = subscribeToDeliveryAgents((agents) => {
      setDeliveryAgents(agents);
    });

    const unsubKitchen = subscribeToKitchenStaff((staff) => {
      setKitchenStaff(staff);
    });

    const unsubPrep = subscribeToPreparingStaff((staff) => {
      setPreparingStaff(staff);
    });

    const unsubSettings = subscribeToRestaurantSettings((data) => {
      setSettings(data);
    });

    const handleStaffUpdated = () => {
      setDeliveryAgents(getLocalDeliveryAgents());
      setKitchenStaff(getLocalKitchenStaff());
      setPreparingStaff(getLocalPreparingStaff());
    };
    window.addEventListener('swadeep_staff_updated', handleStaffUpdated);

    return () => {
      unsubAgents();
      unsubKitchen();
      unsubPrep();
      unsubSettings();
      window.removeEventListener('swadeep_staff_updated', handleStaffUpdated);
    };
  }, []);

  // Shared Singleton Real-time listener for Orders (deduplicated, bounded, zero leak)
  useEffect(() => {
    const unsubscribe = subscribeToSharedOrders((fetchedOrders) => {
      setIsLoadingOrders(false);

      // One-time complete clean-slate wipe of legacy Firestore orders & server store
      try {
        if (localStorage.getItem(ARCHIVE_STORAGE_KEYS.FIRESTORE_CLEAN_SLATE_V2) !== 'done') {
          localStorage.setItem(ARCHIVE_STORAGE_KEYS.FIRESTORE_CLEAN_SLATE_V2, 'done');
          clearAllArchivedOrders();
          clearAllTrackingHistory();
          setArchivedOrders([]);
          setOrders([]);
          try {
            fetch('/api/orders/clear-all', { method: 'POST' }).catch(() => {});
          } catch {}
          if (fetchedOrders.length > 0) {
            const batch = writeBatch(db);
            fetchedOrders.forEach((o) => {
              const docId = o.id || o.orderId;
              if (docId) {
                markOrderPermanentlyDeleted(docId, [o.orderId, o.id]);
                batch.delete(doc(db, 'orders', docId));
              }
            });
            batch.commit().catch(() => {});
          }
          return;
        }
      } catch {}

      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    extraUpdates: Record<string, any> = {}
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);

    // 1. Immediate optimistic UI state update for instant 0ms feedback
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderId === orderId ? { ...o, status: nextStatus, ...extraUpdates } : o
      )
    );

    // 2. If marked as delivered, immediately record in Admin Archive for counting & revenue audit
    // while keeping it in Today's Delivered list until midnight
    if (nextStatus === 'delivered' && targetOrder) {
      const updatedArchive = recordDeliveredOrderInArchive({
        ...targetOrder,
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        ...extraUpdates,
      });
      setArchivedOrders(updatedArchive);
    }

    // Sync to backend API immediately
    try {
      fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, ...extraUpdates }),
      }).catch(() => {});
    } catch {}

    try {
      const orderDoc = doc(db, 'orders', orderId);
      const timestampField = 
        nextStatus === 'accepted' ? { acceptedAt: serverTimestamp() } :
        nextStatus === 'preparing' ? { kitchenSentAt: serverTimestamp() } :
        nextStatus === 'out_for_delivery' ? { dispatchedAt: serverTimestamp() } :
        nextStatus === 'delivered' ? { deliveredAt: serverTimestamp() } : {};

      await updateDoc(orderDoc, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        [`statusTimestamps.${nextStatus}`]: serverTimestamp(),
        ...timestampField,
        ...extraUpdates
      });

      // Auto Stock Deduction when order is accepted
      if (nextStatus === 'accepted' && targetOrder) {
        deductStockForAcceptedOrder(targetOrder);
      }

      // Send branded order status update email to customer based on admin notification toggles
      if (targetOrder?.customerEmail) {
        const toggles = settings?.emailEventToggles || {};
        let shouldSend = false;

        if (nextStatus === 'accepted' && toggles.notifyOrderConfirmed !== false) shouldSend = true;
        else if (nextStatus === 'preparing' && toggles.notifyKitchenSent === true) shouldSend = true;
        else if (nextStatus === 'out_for_delivery' && toggles.notifyOutForDelivery !== false) shouldSend = true;
        else if (nextStatus === 'delivered' && toggles.notifyDelivered !== false) shouldSend = true;
        else if (nextStatus === 'rejected' && toggles.notifyCancellationAccepted !== false) shouldSend = true;

        if (shouldSend) {
          sendOrderStatusEmail(
            { ...targetOrder, status: nextStatus, ...extraUpdates },
            nextStatus,
            settings
          ).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('Failed to update order status in Firestore (updated locally):', err?.message || err);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderId === orderId ? { ...o, status: nextStatus, ...extraUpdates } : o
        )
      );
    }
  };

  const handleAcceptCancellation = async (orderId: string) => {
    try {
      const orderDoc = doc(db, 'orders', orderId);
      await updateDoc(orderDoc, {
        status: 'rejected',
        cancellationStatus: 'accepted',
        cancellationResolvedAt: serverTimestamp(),
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        'statusTimestamps.rejected': serverTimestamp(),
      });

      const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);
      if (targetOrder?.customerEmail && settings?.emailEventToggles?.notifyCancellationAccepted !== false) {
        sendOrderStatusEmail({ ...targetOrder, status: 'rejected' }, 'rejected', settings).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Failed to accept cancellation in Firestore:', err);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderId === orderId
            ? { ...o, status: 'rejected', cancellationStatus: 'accepted' }
            : o
        )
      );
    }
  };

  const handleDeclineCancellation = async (orderId: string) => {
    try {
      const orderDoc = doc(db, 'orders', orderId);
      await updateDoc(orderDoc, {
        cancellationStatus: 'rejected',
        cancellationResolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);
      if (targetOrder?.customerEmail && settings?.emailEventToggles?.notifyCancellationDeclined !== false) {
        sendOrderStatusEmail({ ...targetOrder, status: 'cancellation_declined' as any }, 'cancellation_declined' as any, settings).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Failed to decline cancellation in Firestore:', err);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId || o.orderId === orderId
            ? { ...o, cancellationStatus: 'rejected' }
            : o
        )
      );
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    const docId = order.id || order.orderId;
    const ordId = order.orderId || order.id;

    // 1. Immediately mark permanently deleted and remove from local/archive/customer state
    markOrderPermanentlyDeleted(docId, [ordId]);
    deleteArchivedOrder(docId, ordId);
    removeCustomerOwnOrder(docId, [ordId]);
    setOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));
    setArchivedOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));

    try {
      window.dispatchEvent(
        new CustomEvent('swadeep_order_removed', { detail: { orderId: ordId, id: docId } })
      );
    } catch {}

    try {
      setIsDeletingLoading(true);
      // 2. Delete from server backend (which also broadcasts orders_deleted via SSE)
      try {
        fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
        if (ordId && ordId !== docId) {
          fetch(`/api/orders/${ordId}`, { method: 'DELETE' }).catch(() => {});
        }
      } catch {}

      // 3. Delete from Firestore so customer's single-doc onSnapshot immediately fires !snap.exists()
      await deleteDoc(doc(db, 'orders', docId));
      if (ordId && ordId !== docId) {
        await deleteDoc(doc(db, 'orders', ordId)).catch(() => {});
      }
      setDeletingOrder(null);
    } catch (err: any) {
      console.warn('Failed to delete order in Firestore (removed locally):', err?.message || err);
      setDeletingOrder(null);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleClearAllOrders = async () => {
    const allToClear = [...orders, ...archivedOrders];
    allToClear.forEach((o) => {
      markOrderPermanentlyDeleted(o.id || o.orderId, [o.orderId, o.id]);
    });
    clearAllArchivedOrders();
    clearAllTrackingHistory();
    setOrders([]);
    setArchivedOrders([]);

    try {
      setIsDeletingLoading(true);
      try {
        fetch('/api/orders/clear-all', { method: 'POST' }).catch(() => {});
      } catch {}

      const batch = writeBatch(db);
      orders.forEach((o) => {
        const docId = o.id || o.orderId;
        if (docId) batch.delete(doc(db, 'orders', docId));
      });
      await batch.commit();
      setIsClearingAllModalOpen(false);
    } catch (err: any) {
      console.warn('Failed to clear orders in Firestore (clearing locally):', err?.message || err);
      setIsClearingAllModalOpen(false);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  // Memoized Stats Calculations for Today's Active Live Queue (smooth 60fps UI, 0 extra reads/writes)
  const {
    pendingOrders,
    inKitchenOrders,
    outOrders,
    inProgressOrders,
    deliveredOrders,
    rejectedOrders,
    cancellationRequestedOrders,
    totalRevenue,
  } = useMemo(() => {
    const pending: Order[] = [];
    const inKitchen: Order[] = [];
    const out: Order[] = [];
    const inProgress: Order[] = [];
    const delivered: Order[] = [];
    const rejected: Order[] = [];
    const cancelReqs: Order[] = [];
    let revenue = 0;

    for (let i = 0; i < todayOrders.length; i++) {
      const o = todayOrders[i];
      if (o.status === 'pending') pending.push(o);
      else if (o.status === 'accepted' || o.status === 'preparing') {
        inKitchen.push(o);
        inProgress.push(o);
      } else if (o.status === 'out_for_delivery') {
        out.push(o);
        inProgress.push(o);
      } else if (o.status === 'delivered') {
        delivered.push(o);
        revenue += o.totalAmount || 0;
      } else if (o.status === 'rejected') {
        rejected.push(o);
      }
      if (o.cancellationStatus === 'requested' && o.status !== 'rejected') {
        cancelReqs.push(o);
      }
    }

    return {
      pendingOrders: pending,
      inKitchenOrders: inKitchen,
      outOrders: out,
      inProgressOrders: inProgress,
      deliveredOrders: delivered,
      rejectedOrders: rejected,
      cancellationRequestedOrders: cancelReqs,
      totalRevenue: revenue,
    };
  }, [todayOrders]);

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.trim().toLowerCase();
    return todayOrders.filter((o) => {
      const matchesSearch =
        !q ||
        o.orderId?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.phone?.includes(q);

      if (!matchesSearch) return false;
      if (selectedStatusFilter === 'all') return true;
      if (selectedStatusFilter === 'cancellation_requests')
        return o.cancellationStatus === 'requested' && o.status !== 'rejected';
      if (selectedStatusFilter === 'pending') return o.status === 'pending';
      if (selectedStatusFilter === 'kitchen')
        return o.status === 'accepted' || o.status === 'preparing';
      if (selectedStatusFilter === 'out_for_delivery')
        return o.status === 'out_for_delivery';
      if (selectedStatusFilter === 'delivered') return o.status === 'delivered';
      if (selectedStatusFilter === 'rejected') return o.status === 'rejected';

      return true;
    });
  }, [todayOrders, orderSearchQuery, selectedStatusFilter]);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#18181B] text-[#F59E0B] border border-[#F59E0B]/40">
            <span className="w-1.5 h-1.5 bg-[#F59E0B]" />
            <span>PENDING</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#18181B] text-[#FFFFFF] border border-[#3F3F46]">
            <span className="w-1.5 h-1.5 bg-[#FFFFFF]" />
            <span>ACCEPTED</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#18181B] text-[#FF5500] border border-[#FF5500]/40">
            <span className="w-1.5 h-1.5 bg-[#FF5500]" />
            <span>IN KITCHEN</span>
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#18181B] text-[#FFFFFF] border border-[#FFFFFF]">
            <span className="w-1.5 h-1.5 bg-[#FF5500]" />
            <span>DISPATCHED</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/40">
            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
            <span>DELIVERED</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/40">
            <XCircle className="w-3 h-3 text-[#EF4444]" />
            <span>CANCELLED</span>
          </span>
        );
    }
  };

  const adminDisplayName = user?.email ? user.email.split('@')[0] : 'Admin Staff';

  const handleLogoutAction = () => {
    if (onLogout) {
      onLogout();
    } else {
      signOut();
    }
  };

  // 1. Direct Agent Screen View Mode for Admin
  if (previewAgent) {
    return (
      <div className="admin-curator-console min-h-screen bg-[#0A0A0A] text-[#FFFFFF]">
        <div className="sticky top-0 z-50 bg-[#0A0A0A] text-[#FFFFFF] px-3 sm:px-6 h-14 border-b border-[#27272A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 bg-[#FF5500] shrink-0" />
            <div className="flex items-center gap-2 text-xs font-mono truncate">
              <span className="text-[#71717A] hidden xs:inline uppercase tracking-[0.06em] text-[11px]">LIVE RIDER:</span>
              <span className="text-[#FFFFFF] bg-[#18181B] px-2 py-0.5 font-mono font-semibold text-[11px] truncate border border-[#27272A]">
                {previewAgent.name}
              </span>
              <span className="text-[#A1A1AA] font-mono text-[11px] hidden sm:inline">
                ({previewAgent.vehicleType || 'Bike'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1 border border-[#27272A] text-[11px] font-mono">
              <span className="text-[11px] text-[#71717A] uppercase">RIDER:</span>
              <select
                value={previewAgent.id}
                onChange={(e) => {
                  const ag = deliveryAgents.find((a) => a.id === e.target.value);
                  if (ag) setPreviewAgent(ag);
                }}
                className="bg-transparent text-[#FFFFFF] text-[11px] font-mono focus:outline-none cursor-pointer pr-1"
              >
                {deliveryAgents.map((ag) => (
                  <option key={ag.id} value={ag.id} className="bg-[#18181B] text-[#FFFFFF]">
                    {ag.name} ({ag.vehicleType || 'Bike'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewAgent(null)}
              className="px-3 py-1.5 bg-[#FFFFFF] text-[#0A0A0A] text-[11px] font-mono font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        <DeliveryAgentPortal
          currentAgent={previewAgent}
          onLogout={() => setPreviewAgent(null)}
          onBackToStore={() => {
            setPreviewAgent(null);
            onBackToStore();
          }}
        />
      </div>
    );
  }

  // 2. Direct Kitchen Screen View Mode for Admin
  if (previewChef) {
    return (
      <div className="admin-curator-console min-h-screen bg-[#0A0A0A] text-[#FFFFFF]">
        <div className="sticky top-0 z-50 bg-[#0A0A0A] text-[#FFFFFF] px-3 sm:px-6 h-14 border-b border-[#27272A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 bg-[#FF5500] shrink-0" />
            <div className="flex items-center gap-2 text-xs font-mono truncate">
              <span className="text-[#71717A] hidden xs:inline uppercase tracking-[0.06em] text-[11px]">LIVE KITCHEN:</span>
              <span className="text-[#FFFFFF] bg-[#18181B] px-2 py-0.5 font-mono font-semibold text-[11px] truncate border border-[#27272A]">
                {previewChef.name}
              </span>
              <span className="text-[#A1A1AA] text-[11px] hidden sm:inline">
                ({previewChef.role})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1 border border-[#27272A] text-[11px] font-mono">
              <span className="text-[11px] text-[#71717A] uppercase">CHEF:</span>
              <select
                value={previewChef.id}
                onChange={(e) => {
                  const st = kitchenStaff.find((s) => s.id === e.target.value);
                  if (st) setPreviewChef(st);
                }}
                className="bg-transparent text-[#FFFFFF] text-[11px] font-mono focus:outline-none cursor-pointer pr-1"
              >
                {kitchenStaff.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#18181B] text-[#FFFFFF]">
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewChef(null)}
              className="px-3 py-1.5 bg-[#FFFFFF] text-[#0A0A0A] text-[11px] font-mono font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        <KitchenDisplayPage
          currentChef={previewChef}
          onLogout={() => setPreviewChef(null)}
          onBackToStore={() => {
            setPreviewChef(null);
            onBackToStore();
          }}
        />
      </div>
    );
  }

  // 3. Direct Preparing & Packing Screen View Mode for Admin
  if (previewPreparingStaff) {
    return (
      <div className="admin-curator-console min-h-screen bg-[#0A0A0A] text-[#FFFFFF]">
        <div className="sticky top-0 z-50 bg-[#0A0A0A] text-[#FFFFFF] px-3 sm:px-6 h-14 border-b border-[#27272A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 bg-[#FF5500] shrink-0" />
            <div className="flex items-center gap-2 text-xs font-mono truncate">
              <span className="text-[#71717A] hidden xs:inline uppercase tracking-[0.06em] text-[11px]">LIVE PREPARING:</span>
              <span className="text-[#FFFFFF] bg-[#18181B] px-2 py-0.5 font-mono font-semibold text-[11px] truncate border border-[#27272A]">
                {previewPreparingStaff.name}
              </span>
              <span className="text-[#A1A1AA] text-[11px] hidden sm:inline">
                ({previewPreparingStaff.role})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#18181B] px-2.5 py-1 border border-[#27272A] text-[11px] font-mono">
              <span className="text-[11px] text-[#71717A] uppercase">STAFF:</span>
              <select
                value={previewPreparingStaff.id}
                onChange={(e) => {
                  const st = preparingStaff.find((s) => s.id === e.target.value);
                  if (st) setPreviewPreparingStaff(st);
                }}
                className="bg-transparent text-[#FFFFFF] text-[11px] font-mono focus:outline-none cursor-pointer pr-1"
              >
                {preparingStaff.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#18181B] text-[#FFFFFF]">
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewPreparingStaff(null)}
              className="px-3 py-1.5 bg-[#FFFFFF] text-[#0A0A0A] text-[11px] font-mono font-semibold uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        <PreparingDisplayPage
          onBackToAdmin={() => setPreviewPreparingStaff(null)}
          onOpenStore={() => {
            setPreviewPreparingStaff(null);
            onBackToStore();
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin-curator-console min-h-screen bg-[#0A0A0A] text-[#FFFFFF] pb-20 pt-[max(env(safe-area-inset-top,0px),0px)]">
      {/* Top Curator Header Bar — Height 56px, Pure Matte Black #0A0A0A, 1px solid #27272A */}
      <header className="sticky top-0 z-40 h-14 bg-[#0A0A0A] border-b border-[#27272A] mb-5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-full flex items-center justify-between gap-4">
          {/* Left & Center: Horizontal Navigation Tabs (Architectural Uppercase + Extended 0.18em Tracking) */}
          <nav className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center justify-start gap-6 sm:gap-8 lg:gap-10 h-full">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`h-full flex items-center text-[11px] uppercase tracking-[0.18em] whitespace-nowrap cursor-pointer shrink-0 border-b-2 font-['Plus_Jakarta_Sans',sans-serif] transition-none ${
                activeTab === 'products'
                  ? 'text-[#FFFFFF] font-bold border-[#FFFFFF] pb-1'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF] font-bold border-transparent'
              }`}
              id="admin-tab-products"
            >
              <span className="tracking-[0.18em]">CATALOG</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`h-full flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] whitespace-nowrap cursor-pointer shrink-0 border-b-2 font-['Plus_Jakarta_Sans',sans-serif] transition-none ${
                activeTab === 'orders'
                  ? 'text-[#FFFFFF] font-bold border-[#FFFFFF] pb-1'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF] font-bold border-transparent'
              }`}
              id="admin-tab-orders"
            >
              <span className="tracking-[0.18em]">ORDERS</span>
              {pendingOrders.length > 0 && (
                <span className="bg-[#FF5500] text-[#FFFFFF] text-[10px] font-mono font-bold px-1.5 py-0.2 leading-tight tabular-nums tracking-[0.12em]">
                  {pendingOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`h-full flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] whitespace-nowrap cursor-pointer shrink-0 border-b-2 font-['Plus_Jakarta_Sans',sans-serif] transition-none ${
                activeTab === 'staff'
                  ? 'text-[#FFFFFF] font-bold border-[#FFFFFF] pb-1'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF] font-bold border-transparent'
              }`}
              id="admin-tab-staff"
            >
              <span className="tracking-[0.18em]">STAFF</span>
              <span className={`font-mono tabular-nums tracking-[0.12em] text-[11px] ${activeTab === 'staff' ? 'text-[#FFFFFF]' : 'text-[#71717A]'}`}>
                {kitchenStaff.length + preparingStaff.length + deliveryAgents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`h-full flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] whitespace-nowrap cursor-pointer shrink-0 border-b-2 font-['Plus_Jakarta_Sans',sans-serif] transition-none ${
                activeTab === 'stats'
                  ? 'text-[#FFFFFF] font-bold border-[#FFFFFF] pb-1'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF] font-bold border-transparent'
              }`}
              id="admin-tab-stats"
            >
              <span className="tracking-[0.18em]">STOCK</span>
              {lowStockCount > 0 && (
                <span className="bg-[#F59E0B] text-[#0A0A0A] text-[10px] font-mono font-bold px-1.5 py-0.2 leading-tight tabular-nums tracking-[0.12em]">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`h-full flex items-center text-[11px] uppercase tracking-[0.18em] whitespace-nowrap cursor-pointer shrink-0 border-b-2 font-['Plus_Jakarta_Sans',sans-serif] transition-none ${
                activeTab === 'settings'
                  ? 'text-[#FFFFFF] font-bold border-[#FFFFFF] pb-1'
                  : 'text-[#A1A1AA] hover:text-[#FFFFFF] font-bold border-transparent'
              }`}
              id="admin-tab-settings"
            >
              <span className="tracking-[0.18em]">SETTINGS</span>
            </button>
          </nav>

          {/* Right: Tools Popover + Storefront Link + Sign Out */}
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsScreenSwitcherOpen(!isScreenSwitcherOpen)}
                className={`px-3.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  isScreenSwitcherOpen
                    ? 'text-[#FFFFFF]'
                    : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
                }`}
                title="Console Tools, Alerts, Screens & Sync Status"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline tracking-[0.18em]">TOOLS</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>

              {isScreenSwitcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsScreenSwitcherOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#18181B] border border-[#27272A] p-3.5 z-50 space-y-3.5 shadow-2xl">
                    {/* Section 1: Sound & Phone Notification Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#71717A]">
                          ALERTS &amp; AUDIO
                        </span>
                        <DatabaseStatusIndicator />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={handleTestNotificationClick}
                          className="col-span-2 px-3 py-2 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] border border-[#FF5500] text-[11px] font-mono font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-1.5 cursor-pointer"
                          id="admin-test-notification-header-btn"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>
                            {soundAlert.permissionStatus === 'granted' ? 'TEST PHONE ALERT' : 'ALLOW & TEST ALERT'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={soundAlert.toggleSoundEnabled}
                          className="px-2.5 py-1.5 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#FFFFFF] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {soundAlert.settings.soundEnabled ? (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-[#10B981]" />
                              <span className="text-[#10B981]">SOUND: ON</span>
                            </>
                          ) : (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-[#71717A]" />
                              <span className="text-[#71717A]">MUTED</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsScreenSwitcherOpen(false);
                            soundAlert.setIsAlertModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center gap-1.5 cursor-pointer"
                          id="admin-sound-settings-btn"
                        >
                          <Sliders className="w-3.5 h-3.5 text-[#FF5500]" />
                          <span>RINGTONE</span>
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Live Staff Screens Switcher */}
                    <div className="pt-2.5 border-t border-[#27272A] space-y-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#71717A] block">
                        DELIVERY RIDERS ({deliveryAgents.length})
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {deliveryAgents.map((ag) => (
                          <button
                            key={ag.id}
                            onClick={() => {
                              setPreviewAgent(ag);
                              setIsScreenSwitcherOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 bg-[#121212] hover:bg-[#242427] border border-[#27272A] text-xs font-bold text-[#FFFFFF] flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Bike className="w-3.5 h-3.5 text-[#A1A1AA]" />
                              <span>{ag.name}</span>
                            </div>
                            <span className="text-[10px] text-[#A1A1AA] font-mono font-bold uppercase tracking-[0.06em]">
                              {ag.vehicleType || 'Bike'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#27272A] space-y-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#71717A] block">
                        KITCHEN CHEFS ({kitchenStaff.length})
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {kitchenStaff.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              setPreviewChef(st);
                              setIsScreenSwitcherOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 bg-[#121212] hover:bg-[#242427] border border-[#27272A] text-xs font-bold text-[#FFFFFF] flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <ChefHat className="w-3.5 h-3.5 text-[#A1A1AA]" />
                              <span>{st.name}</span>
                            </div>
                            <span className="text-[10px] text-[#A1A1AA] font-mono font-bold truncate max-w-[90px] uppercase tracking-[0.06em]">
                              {st.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#27272A] space-y-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-[#71717A] block">
                        PREPARING &amp; PACKING ({preparingStaff.length})
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {preparingStaff.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              setPreviewPreparingStaff(st);
                              setIsScreenSwitcherOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 bg-[#121212] hover:bg-[#242427] border border-[#27272A] text-xs font-bold text-[#FFFFFF] flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <PackageCheck className="w-3.5 h-3.5 text-[#A1A1AA]" />
                              <span>{st.name}</span>
                            </div>
                            <span className="text-[10px] text-[#A1A1AA] font-mono font-bold truncate max-w-[90px] uppercase tracking-[0.06em]">
                              {st.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Storefront Link (Without right arrow icon, wide architectural letter-spacing) */}
            <button
              type="button"
              onClick={onBackToStore}
              className="px-3 py-1.5 text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-2 cursor-pointer whitespace-nowrap"
              id="admin-to-store-btn"
              title="Return to Customer Storefront"
            >
              <Store className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
              <span className="hidden sm:inline tracking-[0.18em]">STOREFRONT</span>
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => setIsLogoutConfirmOpen(true)}
              className="p-1.5 text-[#71717A] hover:text-[#EF4444] cursor-pointer shrink-0"
              title="Sign Out"
              id="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 space-y-4">
        {/* Test Notification Feedback Toast */}
        {notificationTestToast && (
          <div
            className={`p-3 border text-xs font-mono flex items-center justify-between ${
              notificationTestToast.type === 'success'
                ? 'bg-[#18181B] text-[#10B981] border-[#10B981]/50'
                : 'bg-[#18181B] text-[#F59E0B] border-[#F59E0B]/50'
            }`}
          >
            <span>{notificationTestToast.message}</span>
            <button
              onClick={() => setNotificationTestToast(null)}
              className="p-1 text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Repeating Alarm Notification Banner */}
        {soundAlert.isAlarmRinging && (
          <div className="bg-[#18181B] p-4 border border-[#FF5500] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-9 h-9 bg-[#FF5500] text-[#FFFFFF] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#FFFFFF] tracking-[-0.02em] flex items-center gap-2 uppercase">
                  <span>Incoming Order Alert</span>
                  <span className="font-mono text-xs px-2 py-0.5 bg-[#0A0A0A] text-[#FF5500] border border-[#27272A] font-semibold">
                    {Math.floor(soundAlert.alarmSecondsLeft / 60)}:{(soundAlert.alarmSecondsLeft % 60).toString().padStart(2, '0')}
                  </span>
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  setSelectedStatusFilter('pending');
                  setActiveTab('orders');
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-semibold text-xs uppercase tracking-[0.06em] cursor-pointer"
              >
                Review &amp; Accept ({pendingOrders.length})
              </button>
              <button
                onClick={soundAlert.silenceAlarm}
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono text-xs uppercase tracking-[0.06em] border border-[#27272A] cursor-pointer"
              >
                Mute Alarm
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Live Orders Management & Order History Archive (Persisted in DOM for instant 0ms tab switching) */}
        <div className={activeTab === 'orders' ? 'space-y-4' : 'hidden'}>
          {/* Sub-Navigation Bar: Today's Orders vs Archive (LEKHIX Style with breathable spacing) */}
          <div className="pb-4 border-b border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4 text-[#FFFFFF]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#FFFFFF] font-['Plus_Jakarta_Sans',sans-serif]">
                ORDERS
              </h2>
              <span className="px-2 py-0.5 border border-[#FFFFFF] bg-[#0A0A0A] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.12em]">
                LIVE
              </span>
              <span className="text-[11px] font-mono font-medium text-[#A1A1AA] uppercase tracking-[0.14em]">
                {todayOrders.length} TODAY · {archivedOrders.length} ARCHIVED
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setOrdersSubTab('today')}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.08em] border flex items-center gap-2 cursor-pointer whitespace-nowrap font-bold rounded-none ${
                  ordersSubTab === 'today'
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                    : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
              >
                <span>TODAY&apos;S ORDERS</span>
                <span className={`font-mono tabular-nums tracking-[0.06em] text-[11px] ${ordersSubTab === 'today' ? 'text-[#0A0A0A]' : 'text-[#71717A]'}`}>
                  ({todayOrders.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOrdersSubTab('history')}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.08em] border flex items-center gap-2 cursor-pointer whitespace-nowrap font-bold rounded-none ${
                  ordersSubTab === 'history'
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                    : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
              >
                <span>ARCHIVE</span>
                <span className={`font-mono tabular-nums tracking-[0.06em] text-[11px] ${ordersSubTab === 'history' ? 'text-[#0A0A0A]' : 'text-[#71717A]'}`}>
                  ({archivedOrders.length})
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestNotificationClick}
                className="px-3 py-1.5 bg-[#18181B] hover:bg-[#242427] text-[#E4E4E7] hover:text-[#FFFFFF] border border-[#27272A] text-[10.5px] font-mono uppercase tracking-[0.1em] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer rounded-none"
                title="Test App Notification on Phone"
                id="admin-test-notification-toolbar-btn"
              >
                <Bell className="w-3.5 h-3.5 text-[#FF5500]" />
                <span>TEST ALERT</span>
              </button>

              {orders.length > 0 && (
                <button
                  onClick={() => setIsClearingAllModalOpen(true)}
                  className="px-3 py-1.5 bg-[#18181B] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#EF4444] border border-[#27272A] text-[10.5px] font-mono uppercase tracking-[0.1em] font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer rounded-none"
                  title="Delete all test orders"
                  id="admin-clear-orders-btn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CLEAR ORDERS</span>
                </button>
              )}
            </div>
          </div>

          {/* 0ms Archive History View (Persisted in DOM) */}
          <div className={ordersSubTab === 'history' ? 'block' : 'hidden'}>
            <OrderHistoryView
              archivedOrders={archivedOrders}
              onDeleteArchivedOrder={handleDeleteArchivedOrder}
              onClearAllHistory={handleClearAllHistory}
            />
          </div>

          {/* 0ms Today Orders View (Persisted in DOM) */}
          <div className={ordersSubTab === 'today' ? 'space-y-3' : 'hidden'}>
            {/* Filter Pills & Search (LEKHIX Style with breathable spacing) */}
            <div className="pb-3 border-b border-[#27272A] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-[#FFFFFF]">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-xs">
                <button
                  onClick={() => setSelectedStatusFilter('all')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border font-bold ${
                    selectedStatusFilter === 'all'
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                  }`}
                >
                  ALL ({todayOrders.length})
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('pending')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border flex items-center gap-1.5 font-bold ${
                    selectedStatusFilter === 'pending'
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                  }`}
                >
                  <span>PENDING</span>
                  <span className="px-1.5 py-0.2 font-mono font-bold bg-[#F59E0B] text-[#0A0A0A] tracking-[0.06em]">
                    {pendingOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('kitchen')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border font-bold ${
                    selectedStatusFilter === 'kitchen'
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                  }`}
                >
                  IN KITCHEN ({inKitchenOrders.length})
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('out_for_delivery')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border font-bold ${
                    selectedStatusFilter === 'out_for_delivery'
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                  }`}
                >
                  DISPATCHED ({outOrders.length})
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('delivered')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border font-bold ${
                    selectedStatusFilter === 'delivered'
                      ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                  }`}
                >
                  DELIVERED ({deliveredOrders.length})
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('rejected')}
                  className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border font-bold ${
                    selectedStatusFilter === 'rejected'
                      ? 'border-[#EF4444] bg-[#EF4444] text-[#FFFFFF]'
                      : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#EF4444]'
                  }`}
                >
                  CANCELLED ({rejectedOrders.length})
                </button>

                {cancellationRequestedOrders.length > 0 && (
                  <button
                    onClick={() => setSelectedStatusFilter('cancellation_requests')}
                    className={`px-3 py-1.5 uppercase tracking-[0.1em] whitespace-nowrap cursor-pointer border flex items-center gap-1.5 font-bold ${
                      selectedStatusFilter === 'cancellation_requests'
                        ? 'border-[#EF4444] bg-[#EF4444] text-[#FFFFFF]'
                        : 'border-[#EF4444]/50 bg-[#18181B] text-[#EF4444]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>CANCEL REQUESTS ({cancellationRequestedOrders.length})</span>
                  </button>
                )}
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-72 shrink-0 font-mono">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                <input
                  type="text"
                  placeholder="FILTER ID, CUSTOMER, PHONE..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#121212] border border-[#27272A] focus:border-[#FFFFFF] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none uppercase tracking-[0.1em]"
                />
              </div>
            </div>

            {/* Orders Feed / Ledger */}
            {isLoadingOrders ? (
              <div className="bg-[#18181B] border border-[#27272A] p-12 text-center text-[#71717A]">
                <p className="text-xs font-mono font-bold uppercase tracking-[0.1em]">Loading live orders stream...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-[#18181B] border border-[#27272A] p-12 text-center space-y-2">
                <div className="w-9 h-9 bg-[#121212] text-[#71717A] border border-[#27272A] flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#A1A1AA]">
                  No Active Orders Found
                </h3>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#18181B] hover:bg-[#1E1E1E] p-4 border border-[#27272A] hover:border-[#3F3F46] [content-visibility:auto] [contain-intrinsic-size:160px]"
                    id={`admin-order-card-${order.orderId}`}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 border-b border-[#27272A] pb-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base text-[#FFFFFF] tracking-normal leading-normal truncate">
                            {order.customerName}
                          </h3>
                          <span className="font-mono text-[11px] font-bold tabular-nums tracking-[0.06em] text-[#A1A1AA] bg-[#121212] px-2 py-0.5 border border-[#27272A] shrink-0">
                            #{order.orderId}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA]">
                          <a
                            href={`tel:${order.phone}`}
                            className="inline-flex items-center gap-1 text-[#FFFFFF] hover:text-[#FF5500] font-mono font-bold tabular-nums tracking-[0.06em] text-[11px] bg-[#121212] px-2 py-0.5 border border-[#27272A]"
                          >
                            <Phone className="w-3 h-3 text-[#71717A]" />
                            <span>{order.phone}</span>
                          </a>
                          {order.createdAt && (
                            <span className="text-[11px] text-[#71717A] font-mono font-bold tabular-nums tracking-[0.06em]">
                              · {new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="font-mono font-bold text-lg text-[#FFFFFF] tabular-nums tracking-[0.06em]">
                          ₹{order.totalAmount}
                        </span>
                        {order.cancellationStatus === 'requested' && order.status !== 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.06em] bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>CANCEL REQUESTED</span>
                          </span>
                        ) : (
                          getStatusBadge(order.status)
                        )}
                      </div>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="py-3 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                      {/* Items & Bill Summary Section */}
                      <div className="md:col-span-6 space-y-1.5 flex flex-col h-full">
                        <span className="font-mono text-[#71717A] uppercase tracking-[0.06em] text-[11px] block">
                          ITEMS ORDERED ({order.items?.reduce((s, i) => s + i.quantity, 0) || 0})
                        </span>
                        <div className="bg-[#121212] p-3 border border-[#27272A] flex flex-col h-full">
                          <div className="space-y-2 mb-3">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start text-[#A1A1AA] pb-2 border-b border-[#27272A] last:border-b-0 last:pb-0">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono font-semibold text-[#FFFFFF] bg-[#18181B] px-1.5 py-0.5 border border-[#27272A] text-[11px]">
                                    {item.quantity}x
                                  </span>
                                  <div className="mt-0.5">
                                    <span className="font-semibold text-[#FFFFFF] text-xs">{item.name}</span>
                                    {item.selectedSize && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#18181B] text-[#A1A1AA] border border-[#27272A] ml-1.5 uppercase">
                                        {item.selectedSize}
                                      </span>
                                    )}
                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {item.selectedExtras.map((extra) => (
                                          <span
                                            key={extra.id}
                                            className="text-[10px] font-mono text-[#A1A1AA] bg-[#18181B] px-1.5 py-0.5 border border-[#27272A] leading-none"
                                          >
                                            +{extra.name} (+₹{extra.price})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className="font-mono font-semibold text-[#FFFFFF] shrink-0 ml-2 mt-0.5">
                                  ₹{item.price * item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Bill Summary */}
                          <div className="mt-auto pt-2.5 border-t border-[#27272A] space-y-1 font-mono text-[11px]">
                            {(() => {
                              const subtotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
                              const deliveryFee = order.totalAmount - subtotal;
                              return (
                                <>
                                  <div className="flex justify-between text-[#71717A]">
                                    <span>ITEM TOTAL</span>
                                    <span className="text-[#A1A1AA]">₹{subtotal}</span>
                                  </div>
                                  <div className="flex justify-between text-[#71717A]">
                                    <span>DELIVERY FEE</span>
                                    <span className="text-[#A1A1AA]">
                                      {deliveryFee === 0 ? <span className="text-[#10B981]">FREE</span> : `₹${deliveryFee}`}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Address & Rider Info Section */}
                      <div className="md:col-span-6 space-y-1.5 flex flex-col h-full">
                        <span className="font-mono text-[#71717A] uppercase tracking-[0.06em] text-[11px] block">
                          DELIVERY ADDRESS &amp; LOGISTICS
                        </span>
                        <div className="bg-[#121212] p-3 border border-[#27272A] flex flex-col h-full">
                          <p className="text-[#FFFFFF] flex items-start gap-2 text-xs leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-[#71717A] shrink-0 mt-0.5" />
                            <span>{order.address}</span>
                          </p>

                          {order.notes && (
                            <div className="mt-2.5">
                              <span className="text-[10px] font-mono text-[#F59E0B] uppercase tracking-[0.06em] block mb-1">CUSTOMER NOTES</span>
                              <p className="text-[#FFFFFF] bg-[#18181B] p-2 border border-[#F59E0B]/40 text-xs">
                                &ldquo;{order.notes}&rdquo;
                              </p>
                            </div>
                          )}

                          <div className="mt-auto pt-3">
                            {order.assignedAgentName ? (
                              <div className="pt-2.5 border-t border-[#27272A] flex flex-col gap-1.5">
                                <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">ASSIGNED RIDER</span>
                                <div className="flex items-center justify-between bg-[#18181B] border border-[#27272A] p-2">
                                  <div className="flex items-center gap-2">
                                    <Bike className="w-3.5 h-3.5 text-[#FF5500]" />
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-[#FFFFFF] text-xs leading-none">{order.assignedAgentName}</span>
                                      {order.assignedAgentVehicleNumber && (
                                        <span className="font-mono text-[10px] text-[#71717A] mt-0.5">{order.assignedAgentVehicleNumber}</span>
                                      )}
                                    </div>
                                  </div>
                                  {order.assignedAgentPhone && (
                                    <a href={`tel:${order.assignedAgentPhone}`} className="text-[#FFFFFF] hover:bg-[#242427] font-mono text-[10px] bg-[#121212] px-2.5 py-1 border border-[#27272A] uppercase">
                                      Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2.5 border-t border-[#27272A]">
                                <div className="bg-[#18181B] border border-[#27272A] p-2 flex items-center justify-center gap-1.5 text-[#71717A] font-mono text-[11px] uppercase tracking-[0.06em]">
                                  <Bike className="w-3.5 h-3.5" />
                                  <span>UNASSIGNED</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Customer Cancellation Request Alert Box */}
                    {order.cancellationStatus === 'requested' && order.status !== 'rejected' && (
                      <div className="mb-3 w-full bg-[#121212] border border-[#EF4444] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 bg-[#EF4444] shrink-0" />
                          <span className="text-xs font-mono font-semibold uppercase tracking-[0.06em] text-[#EF4444] truncate">
                            Customer Requested Order Cancellation
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleDeclineCancellation(order.id)}
                            className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-[#A1A1AA] hover:text-[#FFFFFF] bg-[#18181B] border border-[#27272A] cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcceptCancellation(order.id)}
                            className="px-3.5 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#EF4444] hover:bg-red-600 flex items-center gap-1.5 cursor-pointer"
                            id={`accept-cancellation-btn-${order.orderId}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="pt-3 border-t border-[#27272A] flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="uppercase tracking-[0.06em] text-[#71717A]">
                          PAYMENT: <strong className="text-[#FFFFFF]">{order.paymentMethod?.toUpperCase() || 'COD / UPI'}</strong>
                        </span>
                        {order.paymentStatus === 'paid' ? (
                          <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/40 text-[10px] uppercase tracking-[0.06em]">
                            ✓ PAID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/40 text-[10px] uppercase tracking-[0.06em]">
                            PENDING COLLECTION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'rejected')}
                              className="px-3 py-1.5 bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#EF4444] font-mono font-bold text-[11px] uppercase tracking-[0.1em] border border-[#27272A] cursor-pointer"
                              id={`reject-btn-${order.orderId}`}
                            >
                              REJECT
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'accepted')}
                              className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#FF5500]"
                              id={`accept-btn-${order.orderId}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ACCEPT ORDER</span>
                            </button>
                          </>
                        )}

                        {order.status === 'accepted' && (() => {
                          const orderCat = getOrderCategoryClassification(order);
                          const isNonFood = orderCat === 'non_food_only';
                          const isFood = orderCat === 'food_only';

                          if (isNonFood) {
                            return (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(order.id, 'preparing', {
                                    preparingStatus: 'preparing',
                                    preparingSentAt: serverTimestamp()
                                  })
                                }
                                className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#FF5500]"
                                id={`start-preparing-btn-${order.orderId}`}
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>SEND TO PREPARING</span>
                              </button>
                            );
                          }

                          if (isFood) {
                            return (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(order.id, 'preparing', {
                                    kitchenStatus: 'preparing',
                                    kitchenSentAt: serverTimestamp()
                                  })
                                }
                                className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#FF5500]"
                                id={`start-preparing-btn-${order.orderId}`}
                              >
                                <ChefHat className="w-3.5 h-3.5" />
                                <span>SEND TO KITCHEN</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              onClick={() =>
                                handleUpdateStatus(order.id, 'preparing', {
                                  kitchenStatus: 'preparing',
                                  preparingStatus: 'preparing',
                                  kitchenSentAt: serverTimestamp(),
                                  preparingSentAt: serverTimestamp()
                                })
                              }
                              className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#FF5500]"
                              id={`start-preparing-btn-${order.orderId}`}
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>SEND TO KITCHEN &amp; PREP</span>
                            </button>
                          );
                        })()}

                        {order.status === 'preparing' && (
                          <button
                            onClick={() => handleOpenAdminDispatch(order)}
                            className="px-4 py-1.5 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#FF5500]"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>DISPATCH RIDER</span>
                          </button>
                        )}

                        {order.status === 'out_for_delivery' && (
                          <button
                            onClick={() =>
                              handleUpdateStatus(order.id, 'delivered', {
                                paymentStatus: 'paid',
                                deliveredAt: serverTimestamp()
                              })
                            }
                            className="px-4 py-1.5 bg-[#10B981] hover:bg-emerald-600 text-[#0A0A0A] font-mono font-bold text-[11px] uppercase tracking-[0.1em] flex items-center gap-1.5 cursor-pointer border border-[#10B981]"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>MARK DELIVERED</span>
                          </button>
                        )}

                        {order.status === 'delivered' && (
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 border border-[#10B981]/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED
                          </span>
                        )}

                        {order.status === 'rejected' && (
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] bg-[#121212] px-2.5 py-1 border border-[#27272A] flex items-center gap-1 line-through">
                            <XCircle className="w-3.5 h-3.5" /> CANCELLED
                          </span>
                        )}

                        {/* Move to History Archive Button */}
                        <button
                          onClick={() => handleArchiveSingleOrder(order)}
                          className="p-1.5 bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] border border-[#27272A] cursor-pointer"
                          title={`Move Order #${order.orderId} to History Archive`}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        {/* Individual Delete Order Button */}
                        <button
                          onClick={() => setDeletingOrder(order)}
                          className="p-1.5 bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#EF4444] border border-[#27272A] cursor-pointer"
                          title={`Delete Order #${order.orderId}`}
                          id={`delete-order-btn-${order.orderId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 2: Menu & Product Management (Persisted in DOM for instant 0ms tab switching) */}
        <div className={activeTab === 'products' ? 'block' : 'hidden'}>
          <ProductManagement
            products={liveProducts}
            onUpdateProducts={handleUpdateProductsStable}
          />
        </div>

        {/* Tab 3: Unified Staff Operations Hub (Kitchen, Preparing, Delivery) - Persisted in DOM for instant 0ms switching */}
        <div className={activeTab === 'staff' ? 'space-y-4' : 'hidden'}>
          <div className="pb-4 border-b border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4 text-[#FFFFFF]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#FFFFFF] font-['Plus_Jakarta_Sans',sans-serif]">
                STAFF
              </h2>
              <span className="px-2 py-0.5 border border-[#FFFFFF] bg-[#0A0A0A] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.12em]">
                ROSTER
              </span>
              <span className="text-[11px] font-mono font-medium text-[#A1A1AA] uppercase tracking-[0.14em]">
                {kitchenStaff.length + preparingStaff.length + deliveryAgents.length} ACTIVE MEMBERS
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar font-mono text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setStaffSubTab('kitchen');
                  try { triggerHaptic('selection'); } catch {}
                }}
                className={`px-3 py-1.5 uppercase tracking-[0.08em] flex items-center gap-1.5 cursor-pointer whitespace-nowrap border font-bold rounded-none ${
                  staffSubTab === 'kitchen'
                    ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                    : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
                id="staff-subtab-kitchen"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>KITCHEN ({kitchenStaff.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStaffSubTab('preparing');
                  try { triggerHaptic('selection'); } catch {}
                }}
                className={`px-3 py-1.5 uppercase tracking-[0.08em] flex items-center gap-1.5 cursor-pointer whitespace-nowrap border font-bold rounded-none ${
                  staffSubTab === 'preparing'
                    ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                    : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
                id="staff-subtab-preparing"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>PREPARING ({preparingStaff.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStaffSubTab('delivery');
                  try { triggerHaptic('selection'); } catch {}
                }}
                className={`px-3 py-1.5 uppercase tracking-[0.08em] flex items-center gap-1.5 cursor-pointer whitespace-nowrap border font-bold rounded-none ${
                  staffSubTab === 'delivery'
                    ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                    : 'border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
                id="staff-subtab-delivery"
              >
                <Bike className="w-3.5 h-3.5" />
                <span>DELIVERY RIDERS ({deliveryAgents.length})</span>
              </button>
            </div>
          </div>

          <div className={staffSubTab === 'kitchen' ? 'block' : 'hidden'}>
            <KitchenStaffManagement
              staffList={kitchenStaff}
              onDirectViewChef={handlePreviewChefStable}
            />
          </div>

          <div className={staffSubTab === 'preparing' ? 'block' : 'hidden'}>
            <PreparingStaffManagement
              staffList={preparingStaff}
              onDirectViewPrep={handlePreviewPrepStable}
            />
          </div>

          <div className={staffSubTab === 'delivery' ? 'block' : 'hidden'}>
            <DeliveryAgentsManagement
              agents={deliveryAgents}
              onDirectViewAgent={handlePreviewAgentStable}
            />
          </div>
        </div>

        {/* Tab 4: Payment & Restaurant Settings - Persisted in DOM for instant 0ms switching */}
        <div className={activeTab === 'settings' ? 'space-y-4' : 'hidden'}>
          <CloudStorageMeter products={products} />
          <PaymentSettings settings={settings} onUpdate={handleSettingsUpdateStable} />
        </div>

        {/* Tab 5: Stock & Analytics - Persisted in DOM for instant 0ms switching */}
        <div className={activeTab === 'stats' ? 'space-y-4' : 'hidden'}>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18181B] border border-[#27272A] p-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAnalyticsSubView('stock')}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] border flex items-center gap-1.5 cursor-pointer font-bold ${
                  analyticsSubView === 'stock'
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                    : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Smart Stock &amp; Inventory</span>
                {lowStockCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-[#F59E0B] text-[#0A0A0A]">
                    {lowStockCount} Low
                  </span>
                )}
              </button>

              <button
                onClick={() => setAnalyticsSubView('revenue')}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] border flex items-center gap-1.5 cursor-pointer font-bold ${
                  analyticsSubView === 'revenue'
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                    : 'bg-[#121212] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Revenue &amp; Order Metrics</span>
              </button>
            </div>

            <div className="text-[11px] font-mono font-bold text-[#A1A1AA] bg-[#121212] px-2.5 py-1 border border-[#27272A]">
              <span>{adminDisplayName}</span>
              <span className="mx-1.5 text-[#71717A]">·</span>
              <span>UPI: {settings.upiId || 'gidhaurbakery@upi'}</span>
            </div>
          </div>

          {/* Sub-view 1: Smart Stock & Inventory (Persisted in DOM for 0ms toggle) */}
          <div className={analyticsSubView === 'stock' ? 'block' : 'hidden'}>
            <InventoryManagementView
              products={liveProducts}
              onRefreshCatalog={handleRefreshCatalogStable}
            />
          </div>

          {/* Sub-view 2: Business & Order Performance Analytics (Persisted in DOM for 0ms toggle) */}
          <div className={analyticsSubView === 'revenue' ? 'space-y-4' : 'hidden'}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                  TOTAL ORDERS
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-[#FFFFFF]">
                  {orders.length}
                </div>
                <span className="text-[11px] text-[#71717A] block font-mono">
                  Live collection
                </span>
              </div>

              <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                  PENDING ACTION
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-[#F59E0B]">
                  {pendingOrders.length}
                </div>
                <span className="text-[11px] text-[#71717A] block font-mono">
                  Needs approval
                </span>
              </div>

              <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                  IN KITCHEN / OUT
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-[#FFFFFF]">
                  {inProgressOrders.length}
                </div>
                <span className="text-[11px] text-[#71717A] block font-mono">
                  Active prep &amp; dispatch
                </span>
              </div>

              <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                  DELIVERED
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-[#10B981]">
                  {deliveredOrders.length}
                </div>
                <span className="text-[11px] text-[#71717A] block font-mono">
                  Completed today
                </span>
              </div>

              <div className="bg-[#18181B] border border-[#27272A] p-4 space-y-1 col-span-2 md:col-span-1">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                  TODAY REVENUE
                </span>
                <div className="font-mono font-bold text-2xl sm:text-3xl text-[#FF5500]">
                  ₹{totalRevenue}
                </div>
                <span className="text-[11px] text-[#71717A] block font-mono">
                  Collected on delivery
                </span>
              </div>
            </div>

            <div className="bg-[#18181B] p-5 border border-[#27272A] space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-[-0.02em] text-[#FFFFFF]">
                Performance Metrics &amp; Operations
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-[#121212] border border-[#27272A] space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A]">Completion Rate</span>
                  <p className="font-mono font-bold text-2xl text-[#FFFFFF]">
                    {orders.length > 0
                      ? `${Math.round((deliveredOrders.length / orders.length) * 100)}%`
                      : '100%'}
                  </p>
                  <span className="text-[11px] text-[#71717A] font-mono">{deliveredOrders.length} delivered</span>
                </div>

                <div className="p-4 bg-[#121212] border border-[#27272A] space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A]">Average Order Value</span>
                  <p className="font-mono font-bold text-2xl text-[#FFFFFF]">
                    ₹{orders.length > 0 ? Math.round(totalRevenue / (deliveredOrders.length || 1)) : 0}
                  </p>
                  <span className="text-[11px] text-[#71717A] font-mono">Per delivered order</span>
                </div>

                <div className="p-4 bg-[#121212] border border-[#27272A] space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A]">Active Menu Items</span>
                  <p className="font-mono font-bold text-2xl text-[#FFFFFF]">
                    {liveProducts.filter((p) => p.available).length} / {liveProducts.length}
                  </p>
                  <span className="text-[11px] text-[#71717A] font-mono">Available in store</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#27272A]">
                <div className="p-4 bg-[#121212] border border-[#27272A] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A]">Registered Delivery Riders</span>
                    <p className="font-mono font-bold text-xl text-[#FFFFFF]">{deliveryAgents.length}</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('staff');
                      setStaffSubTab('delivery');
                    }}
                    className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#18181B] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="p-4 bg-[#121212] border border-[#27272A] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#71717A]">Registered Kitchen Chefs</span>
                    <p className="font-mono font-bold text-xl text-[#FFFFFF]">{kitchenStaff.length}</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('staff');
                      setStaffSubTab('kitchen');
                    }}
                    className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#18181B] hover:bg-[#242427] border border-[#27272A] cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Select Rider & Item Verification Dispatch Modal */}
      {dispatchingOrder && (() => {
        const orderItems = dispatchingOrder.items || [];
        const totalItems = orderItems.length;
        const checkedCount = orderItems.filter((_, idx) => adminCheckedItems[`${dispatchingOrder.id}-${idx}`]).length;
        const allDone = totalItems > 0 && checkedCount === totalItems;

        let liveAdminSubtotal = 0;
        orderItems.forEach((item, idx) => {
          const isTicked = checkedCount > 0 ? !!adminCheckedItems[`${dispatchingOrder.id}-${idx}`] : true;
          if (isTicked) {
            const price = (item as any).selectedVariant?.price ?? (item as any).product?.price ?? item.price ?? 0;
            liveAdminSubtotal += price * (item.quantity || 1);
          }
        });
        const deliveryFee = Number(dispatchingOrder.deliveryFee) || 0;
        const liveAdminTotal = liveAdminSubtotal + deliveryFee;

        const executeAdminDispatch = (agent?: DeliveryAgent) => {
          const tickedItems = orderItems.filter((_, idx) => adminCheckedItems[`${dispatchingOrder.id}-${idx}`]);
          const untickedItems = orderItems.filter((_, idx) => !adminCheckedItems[`${dispatchingOrder.id}-${idx}`]);

          const dispatchedList = tickedItems.length > 0 ? tickedItems : orderItems;
          const excludedList = tickedItems.length > 0 ? untickedItems : [];

          const dispatchedItemNames = dispatchedList.map((i) => i.name || (i as any).product?.name || 'Item');
          const untickedItemNames = excludedList.map((i) => i.name || (i as any).product?.name || 'Item');
          const dispatchedIndices = orderItems
            .map((_, idx) => idx)
            .filter((idx) => (tickedItems.length > 0 ? !!adminCheckedItems[`${dispatchingOrder.id}-${idx}`] : true));

          let dispatchedSubtotal = 0;
          dispatchedList.forEach((item: any) => {
            const price = item.selectedVariant?.price ?? (item as any).product?.price ?? item.price ?? 0;
            const qty = item.quantity || 1;
            dispatchedSubtotal += price * qty;
          });

          const deliveryFee = Number(dispatchingOrder.deliveryFee) || 0;
          const dispatchedTotalAmount = dispatchedSubtotal + deliveryFee;

          const payload: any = {
            kitchenStatus: 'ready',
            preparingStatus: 'dispatched',
            kitchenReady: true,
            preparingReady: true,
            subtotal: dispatchedSubtotal,
            totalAmount: dispatchedTotalAmount,
            originalTotalAmount: dispatchingOrder.originalTotalAmount || dispatchingOrder.totalAmount,
            originalSubtotal: dispatchingOrder.originalSubtotal || dispatchingOrder.subtotal,
            dispatchedItems: dispatchedItemNames,
            untickedItems: untickedItemNames,
            dispatchedItemIndices: dispatchedIndices,
            dispatchedAt: serverTimestamp(),
          };

          if (agent) {
            payload.assignedAgentId = agent.id;
            payload.assignedAgentName = agent.name;
            payload.assignedAgentPhone = agent.phone || '';
            payload.assignedAgentVehicle = agent.vehicleType || 'Bike';
            payload.assignedAgentVehicleNumber = agent.vehicleNumber || '';
          } else {
            payload.assignedAgentId = 'unassigned';
            payload.assignedAgentName = 'Available Delivery Partner';
          }

          handleUpdateStatus(dispatchingOrder.id, 'out_for_delivery', payload);
          setDispatchingOrder(null);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#18181B] border border-[#27272A] max-w-lg w-full p-5 space-y-4 max-h-[92vh] flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#FF5500] text-[#FFFFFF] flex items-center justify-center">
                    <Bike className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-[-0.01em] text-[#FFFFFF]">
                      DISPATCH TO DELIVERY AGENT
                    </h3>
                    <span className="text-[11px] text-[#A1A1AA] font-mono">
                      Order #{dispatchingOrder.orderId} · {dispatchingOrder.customerName}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setDispatchingOrder(null)}
                  className="w-7 h-7 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                {allDone ? (
                  <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/40 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    <h4 className="text-xs font-mono uppercase tracking-[0.06em] text-[#10B981]">
                      All Items Verified &amp; Packed ({checkedCount}/{totalItems})
                    </h4>
                  </div>
                ) : (
                  <div className="p-3 bg-[#121212] border border-[#27272A] flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                      <h4 className="text-xs font-mono uppercase tracking-[0.06em] text-[#F59E0B]">
                        {checkedCount === 0 ? 'No Items Ticked Yet' : `Partial Packing (${checkedCount}/${totalItems})`}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdminTickAllItems(dispatchingOrder.id, totalItems)}
                      className="px-2.5 py-1 bg-[#FFFFFF] text-[#0A0A0A] font-mono font-semibold text-[10px] uppercase tracking-[0.06em] cursor-pointer shrink-0"
                    >
                      ✓ Tick All
                    </button>
                  </div>
                )}

                {/* Live Bill Amount Box */}
                <div className="p-3 bg-[#121212] border border-[#27272A] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] block">Bill Amount to Collect</span>
                    <span className="font-bold text-[#FFFFFF] text-base font-mono">₹{liveAdminTotal}</span>
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] font-mono">
                    {checkedCount}/{totalItems} items in parcel
                  </span>
                </div>

                {/* Items Checklist Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                      Parcel Item Verification ({checkedCount}/{totalItems})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {checkedCount < totalItems && totalItems > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdminTickAllItems(dispatchingOrder.id, totalItems)}
                          className="text-[10px] font-mono text-[#FFFFFF] bg-[#121212] hover:bg-[#242427] px-2 py-0.5 border border-[#27272A] cursor-pointer uppercase"
                        >
                          ✓ Tick All
                        </button>
                      )}
                      {checkedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdminUntickAllItems(dispatchingOrder.id, totalItems)}
                          className="text-[10px] font-mono text-[#A1A1AA] bg-[#121212] hover:bg-[#242427] px-2 py-0.5 border border-[#27272A] cursor-pointer uppercase"
                        >
                          Untick All
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {orderItems.map((item, idx) => {
                      const isTicked = adminCheckedItems[`${dispatchingOrder.id}-${idx}`];
                      const isKitchen = isFoodItem(item);
                      const prepTime = Number(item.prepTimeMinutes || (item as any).product?.prepTimeMinutes || 0);

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleAdminItemCheck(dispatchingOrder.id, idx)}
                          className={`p-2.5 border flex items-center justify-between text-xs cursor-pointer ${
                            isTicked
                              ? 'bg-[#121212] border-[#FFFFFF] text-[#FFFFFF] font-semibold'
                              : 'bg-[#0A0A0A] border-[#27272A] text-[#71717A]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                                isTicked ? 'bg-[#FFFFFF] border-[#FFFFFF] text-[#0A0A0A]' : 'bg-[#121212] border-[#3F3F46]'
                              }`}
                            >
                              {isTicked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="truncate block max-w-[200px] sm:max-w-[240px]">
                                {item.quantity}x {item.name || (item as any).product?.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {isKitchen ? (
                                  <span className="text-[9px] font-mono text-[#A1A1AA] uppercase">
                                    Kitchen {prepTime > 0 ? `(${prepTime}m)` : ''}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono text-[#A1A1AA] uppercase">
                                    Prep Section
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 border uppercase tracking-[0.06em] shrink-0 ${
                              isTicked ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF] font-semibold' : 'bg-[#121212] text-[#71717A] border-[#27272A]'
                            }`}
                          >
                            {isTicked ? '✓ IN PARCEL' : 'EXCLUDED'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rider Assignment List */}
                <div className="space-y-2 pt-2 border-t border-[#27272A]">
                  <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                    Choose Delivery Rider ({deliveryAgents.length} available)
                  </span>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {deliveryAgents.map((agent) => {
                      const isSelected = adminSelectedRiderId === agent.id;
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setAdminSelectedRiderId(agent.id)}
                          className={`p-2.5 border flex items-center justify-between text-left cursor-pointer ${
                            isSelected
                              ? 'border-[#FFFFFF] bg-[#121212] text-[#FFFFFF]'
                              : 'border-[#27272A] hover:border-[#3F3F46] bg-[#0A0A0A] text-[#A1A1AA]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="adminDeliveryAgent"
                              checked={isSelected}
                              onChange={() => setAdminSelectedRiderId(agent.id)}
                              className="w-3.5 h-3.5 accent-[#FF5500]"
                            />
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-[#FFFFFF]">
                                {agent.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] font-mono">
                                <span>{agent.vehicleType || 'Bike'}</span>
                                {agent.vehicleNumber && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono text-[#A1A1AA]">
                                      {agent.vehicleNumber}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              executeAdminDispatch(agent);
                            }}
                            className="text-[10px] font-mono font-semibold uppercase tracking-[0.06em] text-[#FFFFFF] bg-[#FF5500] hover:bg-[#e04b00] px-3 py-1.5 cursor-pointer"
                          >
                            Assign &amp; Send
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-[#27272A] flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => executeAdminDispatch(undefined)}
                  className="text-xs font-mono text-[#A1A1AA] hover:text-[#FFFFFF] underline cursor-pointer"
                >
                  Dispatch unassigned
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchingOrder(null)}
                    className="px-4 py-2 bg-[#121212] border border-[#27272A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedAgent = deliveryAgents.find((a) => a.id === adminSelectedRiderId);
                      executeAdminDispatch(matchedAgent);
                    }}
                    className="px-4 py-2 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-semibold text-[11px] uppercase tracking-[0.06em] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Single Order Confirmation Modal */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] max-w-sm w-full p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#EF4444] block">
                PERMANENT DELETION
              </span>
              <h3 className="font-bold text-base text-[#FFFFFF]">
                Delete Order #{deletingOrder.orderId}?
              </h3>
              <p className="text-xs text-[#A1A1AA] font-mono">
                {deletingOrder.customerName} (₹{deletingOrder.totalAmount})
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setDeletingOrder(null)}
                className="flex-1 py-2 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono text-[11px] uppercase tracking-[0.06em] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => handleDeleteOrder(deletingOrder)}
                className="flex-1 py-2 bg-[#EF4444] hover:bg-red-600 text-[#FFFFFF] font-mono font-semibold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                id="confirm-delete-order-btn"
              >
                {isDeletingLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Test Orders Modal */}
      {isClearingAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] max-w-sm w-full p-6 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#EF4444] block">
                BULK DELETION
              </span>
              <h3 className="font-bold text-base text-[#FFFFFF]">
                Clear All ({orders.length}) Orders?
              </h3>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setIsClearingAllModalOpen(false)}
                className="flex-1 py-2 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono text-[11px] uppercase tracking-[0.06em] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={handleClearAllOrders}
                className="flex-1 py-2 bg-[#EF4444] hover:bg-red-600 text-[#FFFFFF] font-mono font-semibold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                id="confirm-clear-all-orders-btn"
              >
                {isDeletingLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Clear All ({orders.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Sound Alert & Custom Audio Settings Modal */}
      <SoundSettingsModal
        isOpen={soundAlert.isAlertModalOpen}
        onClose={() => soundAlert.setIsAlertModalOpen(false)}
        settings={soundAlert.settings}
        onToggleSound={soundAlert.toggleSoundEnabled}
        onSelectPreset={soundAlert.selectPreset}
        onUploadCustomFile={soundAlert.uploadCustomFile}
        onRemoveCustomFile={soundAlert.removeCustomFile}
        onUpdateVolume={soundAlert.updateVolume}
        onStartTest={soundAlert.startTestAlert}
        onStopTest={soundAlert.stopTestAlert}
        isTesting={soundAlert.isSoundTesting}
        testSecondsLeft={soundAlert.testSecondsLeft}
        permissionStatus={soundAlert.permissionStatus}
        onRequestPermission={soundAlert.handleRequestPermission}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsLogoutConfirmOpen(false)}
        >
          <div
            className="bg-[#18181B] border border-[#27272A] max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#71717A] block">
                SESSION SECURITY
              </span>
              <h3 id="logout-dialog-title" className="text-base font-bold text-[#FFFFFF]">
                Confirm Sign Out?
              </h3>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2 px-4 border border-[#27272A] bg-[#121212] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                id="cancel-logout-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  handleLogoutAction();
                }}
                className="flex-1 py-2 px-4 bg-[#FF5500] hover:bg-[#e04b00] text-[#FFFFFF] font-mono font-semibold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-1.5 cursor-pointer"
                id="confirm-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
