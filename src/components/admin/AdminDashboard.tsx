import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  Bike,
  PackageCheck,
  Phone,
  MapPin,
  FileText,
  Volume2,
  VolumeX,
  LogOut,
  Search,
  Bell,
  Utensils,
  TrendingUp,
  Store,
  Shield,
  Calendar,
  Layers,
  ChevronDown,
  Settings as SettingsGearIcon,
  Users,
  Eye,
  Smartphone,
  UtensilsCrossed,
  MonitorPlay,
  ArrowLeft,
  X,
  Trash2,
  Play,
  Check,
  Loader2,
  Sliders,
  AlertTriangle,
  Archive,
  Activity,
  Boxes
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  limit,
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
import { OperationType, handleFirestoreError } from '../../firebase/errors';
import { ProductManagement } from './ProductManagement';
import { DeliveryAgentsManagement } from './DeliveryAgentsManagement';
import { KitchenStaffManagement } from './KitchenStaffManagement';
import { PreparingStaffManagement } from './PreparingStaffManagement';
import { PaymentSettings } from './PaymentSettings';
import { CloudStorageMeter } from './CloudStorageMeter';
import { FirebaseQuotaUsageView } from './FirebaseQuotaUsageView';
import { InventoryManagementView } from './InventoryManagementView';
import { deductStockForAcceptedOrder, isItemLowStock } from '../../services/inventoryService';
import { OrderHistoryView } from './OrderHistoryView';
import {
  performDailyOrderRollover,
  getArchivedOrders,
  deleteArchivedOrder,
  clearAllArchivedOrders,
  archiveSingleOrder,
  getTodayDateString,
  isOrderFromToday
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
  getLocalKitchenStaff,
  seedStaffIfEmpty
} from '../../services/staffService';
import { PreparingStaff } from '../../types';
import {
  getOrderCategoryClassification,
  getOrderFoodItems,
  getOrderNonFoodItems,
  isFoodItem,
  isNonFoodItem
} from '../../utils/orderCategoryHelper';
import { sendOrderStatusEmail } from '../../services/customerEmailService';
import {
  playOrderAlertChime,
  shouldNotifyNewOrder,
  markInitialOrdersAsSeen,
  sendNativeNotification
} from '../../utils/sound';
import {
  saveActiveAdminTab,
  getSavedActiveAdminTab,
  saveScrollPosition,
  restoreScrollPosition
} from '../../utils/scrollStateStorage';

interface AdminDashboardProps {
  products: Product[];
  onBackToStore: () => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ products, onBackToStore, onLogout }) => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTabState] = useState<
    'orders' | 'products' | 'delivery_agents' | 'kitchen_staff' | 'preparing_staff' | 'settings' | 'stats' | 'usage'
  >(() => getSavedActiveAdminTab('orders') as any);

  const handleTabChange = (newTab: 'orders' | 'products' | 'delivery_agents' | 'kitchen_staff' | 'preparing_staff' | 'settings' | 'stats' | 'usage') => {
    if (newTab === activeTab) return;
    saveScrollPosition(`admin_${activeTab}`, window.scrollY);
    setActiveTabState(newTab);
    saveActiveAdminTab(newTab);
    restoreScrollPosition(`admin_${newTab}`);
  };

  const setActiveTab = handleTabChange;

  // Restore scroll position on initial load of AdminDashboard
  useEffect(() => {
    restoreScrollPosition(`admin_${activeTab}`, 6);
  }, []);

  // Save scroll on page scroll
  useEffect(() => {
    const onScroll = () => {
      saveScrollPosition(`admin_${activeTab}`, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeTab]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersSubTab, setOrdersSubTab] = useState<'today' | 'history'>('today');
  const [archivedOrders, setArchivedOrders] = useState<Order[]>(() => getArchivedOrders());

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

  // Listen to background history updates
  useEffect(() => {
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
  // As soon as date changes, all orders from previous days (pending, accepted, delivered, unapproved)
  // are automatically cleared from today's live queue and moved into the Order History Archive.
  const [currentDateStr, setCurrentDateStr] = useState(() => getTodayDateString());

  // Check every 20 seconds if calendar date rolled over (midnight auto-reset)
  useEffect(() => {
    const timer = setInterval(() => {
      const today = getTodayDateString();
      if (today !== currentDateStr) {
        setCurrentDateStr(today);
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [currentDateStr]);

  const { todayOrders, archivedOrders: currentArchived } = useMemo(() => {
    return performDailyOrderRollover(orders);
  }, [orders, currentDateStr]);

  useEffect(() => {
    if (currentArchived.length > 0) {
      setArchivedOrders(currentArchived);
    }
  }, [currentArchived]);

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

  const handleDeleteArchivedOrder = async (orderId: string) => {
    deleteArchivedOrder(orderId);
    setArchivedOrders((prev) => prev.filter((o) => (o.orderId || o.id) !== orderId));
    setOrders((prev) => prev.filter((o) => (o.orderId || o.id) !== orderId));

    try {
      fetch(`/api/orders/${orderId}`, { method: 'DELETE' }).catch(() => {});
    } catch {}

    try {
      const match = orders.find((o) => (o.orderId || o.id) === orderId) ||
                    archivedOrders.find((o) => (o.orderId || o.id) === orderId);
      const docId = match?.id || orderId;
      await deleteDoc(doc(db, 'orders', docId));
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
      const recent = JSON.parse(localStorage.getItem('swadeep_recent_orders') || '[]');
      const updatedRecent = recent.filter((o: any) => o.orderId !== order.orderId && o.id !== order.id);
      localStorage.setItem('swadeep_recent_orders', JSON.stringify(updatedRecent));
      localStorage.setItem('gidhaur_recent_orders', JSON.stringify(updatedRecent));
      window.dispatchEvent(new CustomEvent('swadeep_order_removed', { detail: { orderId: order.orderId, id: order.id } }));
    } catch {}
  };

  // Initial seed and subscriptions
  useEffect(() => {
    seedStaffIfEmpty();

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
      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    extraUpdates: Record<string, any> = {}
  ) => {
    // 1. Immediate optimistic UI state update for instant 0ms feedback
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderId === orderId ? { ...o, status: nextStatus, ...extraUpdates } : o
      )
    );

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
      if (nextStatus === 'accepted') {
        const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);
        if (targetOrder) {
          deductStockForAcceptedOrder(targetOrder);
        }
      }

      // Send branded order status update email to customer based on admin notification toggles
      const targetOrder = orders.find((o) => o.id === orderId || o.orderId === orderId);
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
      try {
        const recent = JSON.parse(localStorage.getItem('swadeep_recent_orders') || '[]');
        const updatedRecent = recent.map((o: any) =>
          o.orderId === orderId ? { ...o, status: nextStatus, ...extraUpdates } : o
        );
        localStorage.setItem('swadeep_recent_orders', JSON.stringify(updatedRecent));
      } catch {}
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
    try {
      setIsDeletingLoading(true);
      const docId = order.id || order.orderId;
      await deleteDoc(doc(db, 'orders', docId));
      if (order.orderId && order.orderId !== order.id) {
        await deleteDoc(doc(db, 'orders', order.orderId)).catch(() => {});
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));
      setArchivedOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));
      try {
        fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
        if (order.orderId && order.orderId !== order.id) {
          fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' }).catch(() => {});
        }
        deleteArchivedOrder(order.id);
        deleteArchivedOrder(order.orderId);
        const recent = JSON.parse(localStorage.getItem('swadeep_recent_orders') || '[]');
        const updatedRecent = recent.filter((o: any) => o.orderId !== order.orderId && o.id !== order.id);
        localStorage.setItem('swadeep_recent_orders', JSON.stringify(updatedRecent));
        localStorage.setItem('gidhaur_recent_orders', JSON.stringify(updatedRecent));
        window.dispatchEvent(new CustomEvent('swadeep_order_removed', { detail: { orderId: order.orderId, id: order.id } }));
      } catch {}
      setDeletingOrder(null);
    } catch (err: any) {
      console.warn('Failed to delete order in Firestore (removed locally):', err?.message || err);
      setOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));
      setArchivedOrders((prev) => prev.filter((o) => o.id !== order.id && o.orderId !== order.orderId));
      try {
        const docId = order.id || order.orderId;
        fetch(`/api/orders/${docId}`, { method: 'DELETE' }).catch(() => {});
        if (order.orderId && order.orderId !== order.id) {
          fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' }).catch(() => {});
        }
        deleteArchivedOrder(order.id);
        deleteArchivedOrder(order.orderId);
        const recent = JSON.parse(localStorage.getItem('swadeep_recent_orders') || '[]');
        const updatedRecent = recent.filter((o: any) => o.orderId !== order.orderId && o.id !== order.id);
        localStorage.setItem('swadeep_recent_orders', JSON.stringify(updatedRecent));
        localStorage.setItem('gidhaur_recent_orders', JSON.stringify(updatedRecent));
        window.dispatchEvent(new CustomEvent('swadeep_order_removed', { detail: { orderId: order.orderId, id: order.id } }));
      } catch {}
      setDeletingOrder(null);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleClearAllOrders = async () => {
    try {
      setIsDeletingLoading(true);
      const batch = writeBatch(db);
      orders.forEach((o) => {
        batch.delete(doc(db, 'orders', o.id));
      });
      await batch.commit();
      setOrders([]);
      setArchivedOrders([]);
      clearAllArchivedOrders();
      try {
        fetch('/api/orders/clear-all', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('swadeep_recent_orders');
        localStorage.removeItem('gidhaur_recent_orders');
      } catch {}
      setIsClearingAllModalOpen(false);
    } catch (err: any) {
      console.warn('Failed to clear orders in Firestore (clearing locally):', err?.message || err);
      setOrders([]);
      setArchivedOrders([]);
      clearAllArchivedOrders();
      try {
        fetch('/api/orders/clear-all', { method: 'POST' }).catch(() => {});
        localStorage.removeItem('swadeep_recent_orders');
        localStorage.removeItem('gidhaur_recent_orders');
      } catch {}
      setIsClearingAllModalOpen(false);
    } finally {
      setIsDeletingLoading(false);
    }
  };

  // Stats Calculations for Today's Active Live Queue
  const pendingOrders = todayOrders.filter((o) => o.status === 'pending');
  const inKitchenOrders = todayOrders.filter((o) => o.status === 'preparing' || o.status === 'accepted');
  const outOrders = todayOrders.filter((o) => o.status === 'out_for_delivery');
  const inProgressOrders = todayOrders.filter((o) =>
    ['accepted', 'preparing', 'out_for_delivery'].includes(o.status)
  );
  const deliveredOrders = todayOrders.filter((o) => o.status === 'delivered');
  const rejectedOrders = todayOrders.filter((o) => o.status === 'rejected');
  const cancellationRequestedOrders = todayOrders.filter(
    (o) => o.cancellationStatus === 'requested' && o.status !== 'rejected'
  );

  const totalRevenue = todayOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const filteredOrders = todayOrders.filter((o) => {
    const matchesSearch =
      o.orderId?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.phone?.includes(orderSearchQuery);

    if (selectedStatusFilter === 'all') return matchesSearch;
    if (selectedStatusFilter === 'cancellation_requests')
      return matchesSearch && o.cancellationStatus === 'requested' && o.status !== 'rejected';
    if (selectedStatusFilter === 'pending') return matchesSearch && o.status === 'pending';
    if (selectedStatusFilter === 'kitchen')
      return matchesSearch && (o.status === 'accepted' || o.status === 'preparing');
    if (selectedStatusFilter === 'out_for_delivery')
      return matchesSearch && o.status === 'out_for_delivery';
    if (selectedStatusFilter === 'delivered') return matchesSearch && o.status === 'delivered';
    if (selectedStatusFilter === 'rejected') return matchesSearch && o.status === 'rejected';

    return matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>Pending Approval</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Accepted</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <ChefHat className="w-3.5 h-3.5 text-slate-700" />
            <span>In Kitchen</span>
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80">
            <Bike className="w-3.5 h-3.5 text-indigo-600" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivered</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Cancelled</span>
          </span>
        );
    }
  };

  const adminDisplayName = user?.email ? user.email.split('@')[0] : 'Admin Staff';
  const adminInitials = adminDisplayName.substring(0, 2).toUpperCase();

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
      <div className="min-h-screen bg-[#f8fafc] text-slate-900">
        {/* Fixed Top Admin Live Simulator Banner */}
        <div className="sticky top-0 z-50 bg-slate-950 text-white px-3 sm:px-6 py-2 shadow-md border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                <span className="text-slate-400 hidden xs:inline">LIVE RIDER:</span>
                <span className="text-white bg-slate-800/90 px-2 py-0.5 rounded-full font-extrabold text-[11px] truncate">
                  {previewAgent.name}
                </span>
                <span className="text-slate-400 font-mono text-[10px] hidden sm:inline">
                  ({previewAgent.vehicleType || 'Bike'})
                </span>
              </div>
            </div>

            <button
              onClick={() => setPreviewAgent(null)}
              className="sm:hidden px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-full text-[11px] font-extrabold transition-all shadow-xs active:scale-95 flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {/* Quick Switcher dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/80 text-[11px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Switch:</span>
              <select
                value={previewAgent.id}
                onChange={(e) => {
                  const ag = deliveryAgents.find((a) => a.id === e.target.value);
                  if (ag) setPreviewAgent(ag);
                }}
                className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer pr-1"
              >
                {deliveryAgents.map((ag) => (
                  <option key={ag.id} value={ag.id} className="bg-slate-900 text-white">
                    {ag.name} ({ag.vehicleType || 'Bike'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewAgent(null)}
              className="hidden sm:flex px-3 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-full text-xs font-extrabold transition-all shadow-xs active:scale-95 items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Console</span>
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
      <div className="min-h-screen bg-[#f8fafc] text-slate-900">
        {/* Fixed Top Admin Live Kitchen Simulator Banner */}
        <div className="sticky top-0 z-50 bg-slate-950 text-white px-3 sm:px-6 py-2 shadow-md border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                <span className="text-slate-400 hidden xs:inline">LIVE KITCHEN:</span>
                <span className="text-white bg-slate-800/90 px-2 py-0.5 rounded-full font-extrabold text-[11px] truncate">
                  {previewChef.name}
                </span>
                <span className="text-slate-400 text-[10px] hidden sm:inline">
                  ({previewChef.role})
                </span>
              </div>
            </div>

            <button
              onClick={() => setPreviewChef(null)}
              className="sm:hidden px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-full text-[11px] font-extrabold transition-all shadow-xs active:scale-95 flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {/* Quick Switcher dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/80 text-[11px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Switch:</span>
              <select
                value={previewChef.id}
                onChange={(e) => {
                  const st = kitchenStaff.find((s) => s.id === e.target.value);
                  if (st) setPreviewChef(st);
                }}
                className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer pr-1"
              >
                {kitchenStaff.map((st) => (
                  <option key={st.id} value={st.id} className="bg-slate-900 text-white">
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewChef(null)}
              className="hidden sm:flex px-3 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-full text-xs font-extrabold transition-all shadow-xs active:scale-95 items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Console</span>
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
      <div className="min-h-screen bg-[#f8fafc] text-slate-900">
        {/* Fixed Top Admin Live Preparing Simulator Banner */}
        <div className="sticky top-0 z-50 bg-slate-950 text-white px-3 sm:px-6 py-2 shadow-md border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                <span className="text-slate-400 hidden xs:inline">LIVE PREPARING:</span>
                <span className="text-white bg-slate-800/90 px-2 py-0.5 rounded-full font-extrabold text-[11px] truncate">
                  {previewPreparingStaff.name}
                </span>
                <span className="text-slate-400 text-[10px] hidden sm:inline">
                  ({previewPreparingStaff.role})
                </span>
              </div>
            </div>

            <button
              onClick={() => setPreviewPreparingStaff(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800/80 transition-colors"
            >
              Exit Live Mode
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/80 text-[11px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Switch:</span>
              <select
                value={previewPreparingStaff.id}
                onChange={(e) => {
                  const st = preparingStaff.find((s) => s.id === e.target.value);
                  if (st) setPreviewPreparingStaff(st);
                }}
                className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer pr-1"
              >
                {preparingStaff.map((st) => (
                  <option key={st.id} value={st.id} className="bg-slate-900 text-white">
                    {st.name} ({st.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setPreviewPreparingStaff(null)}
              className="hidden sm:flex px-3 py-1 bg-white hover:bg-slate-100 text-slate-950 rounded-full text-xs font-extrabold transition-all shadow-xs active:scale-95 items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Console</span>
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 pt-[max(env(safe-area-inset-top,0px),0px)]">

      {/* Top Refined Floating Header / Dock */}
      <header className="sticky top-[max(calc(env(safe-area-inset-top,0px)+0.5rem),0.75rem)] z-40 px-2 sm:px-6 max-w-7xl mx-auto mb-4 sm:mb-5">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-full border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)] px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3 transition-all max-w-full">
          {/* Floating Pill Navigation Tabs - Cleanly utilizing full space without bulky brand/admin badge */}
          <nav className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center gap-0.5 sm:gap-1 py-0.5">
            <div className="flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200/70 shadow-2xs gap-0.5 shrink-0">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'orders'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-orders"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Orders</span>
                {pendingOrders.length > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center leading-tight">
                    {pendingOrders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('products')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'products'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-products"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Menu</span>
              </button>

              <button
                onClick={() => setActiveTab('kitchen_staff')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'kitchen_staff'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-kitchen"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Kitchen</span>
                {kitchenStaff.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      activeTab === 'kitchen_staff'
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {kitchenStaff.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('preparing_staff')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'preparing_staff'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-preparing"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Preparing</span>
                {preparingStaff.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      activeTab === 'preparing_staff'
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {preparingStaff.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('delivery_agents')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'delivery_agents'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-delivery-agents"
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Delivery</span>
                {deliveryAgents.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      activeTab === 'delivery_agents'
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {deliveryAgents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-settings"
              >
                <SettingsGearIcon className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'stats'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-stats"
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Analytics & Stock</span>
                {lowStockCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('usage')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === 'usage'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                }`}
                id="admin-tab-usage"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Usage</span>
              </button>
            </div>
          </nav>

          {/* Right Action Controls - Fixed width elements strictly with shrink-0 so they never clip or go outside screen */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
            {/* Quick Live Screens Dropdown Launcher */}
            <div className="relative">
              <button
                onClick={() => setIsScreenSwitcherOpen(!isScreenSwitcherOpen)}
                className="px-2 sm:px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-full flex items-center gap-1 sm:gap-1.5 transition-all active:scale-95 border border-slate-200/70 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                title="Directly view any Rider or Kitchen screen"
              >
                <MonitorPlay className="w-3.5 h-3.5 text-slate-700" />
                <span className="hidden sm:inline">Screens</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isScreenSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>

              {isScreenSwitcherOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-0.5">
                      Delivery Riders ({deliveryAgents.length})
                    </span>
                    <div className="space-y-0.5 mt-1">
                      {deliveryAgents.map((ag) => (
                        <button
                          key={ag.id}
                          onClick={() => {
                            setPreviewAgent(ag);
                            setIsScreenSwitcherOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Bike className="w-3.5 h-3.5 text-slate-500" />
                            <span>{ag.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {ag.vehicleType || 'Bike'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-0.5">
                      Kitchen Chefs ({kitchenStaff.length})
                    </span>
                    <div className="space-y-0.5 mt-1">
                      {kitchenStaff.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setPreviewChef(st);
                            setIsScreenSwitcherOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <ChefHat className="w-3.5 h-3.5 text-slate-500" />
                            <span>{st.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                            {st.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2 py-0.5">
                      Preparing & Packing ({preparingStaff.length})
                    </span>
                    <div className="space-y-0.5 mt-1">
                      {preparingStaff.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setPreviewPreparingStaff(st);
                            setIsScreenSwitcherOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <PackageCheck className="w-3.5 h-3.5 text-slate-500" />
                            <span>{st.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                            {st.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sound & Custom Audio Settings Modal Trigger */}
            <button
              onClick={() => soundAlert.setIsAlertModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-full text-xs font-bold transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60 cursor-pointer shadow-2xs shrink-0"
              title="Configure Sound Alert & Custom Audio"
              id="admin-sound-settings-btn"
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
            </button>

            {/* Sound Mute/Unmute Toggle */}
            <button
              onClick={soundAlert.toggleSoundEnabled}
              className={`p-1.5 sm:p-2 rounded-full text-xs font-bold transition-colors border border-slate-200/60 cursor-pointer shadow-2xs shrink-0 ${
                soundAlert.settings.soundEnabled
                  ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              title={soundAlert.settings.soundEnabled ? 'Order sound alerts: ON' : 'Order sound alerts: MUTED'}
            >
              {soundAlert.settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              )}
            </button>

            {/* Back to Customer Store */}
            <button
              onClick={onBackToStore}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-full flex items-center gap-1.5 transition-colors border border-slate-200/60 cursor-pointer shadow-2xs shrink-0"
              id="admin-to-store-btn"
              title="Return to Customer Store"
            >
              <Store className="w-3.5 h-3.5 text-slate-700" />
              <span className="hidden sm:inline">Store</span>
            </button>

            {/* Sign Out Button with Confirmation Prompt */}
            <button
              onClick={() => setIsLogoutConfirmOpen(true)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer shrink-0"
              title="Sign Out"
              id="admin-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 space-y-4">
        {/* Active Repeating Alarm Notification Banner */}
        {soundAlert.isAlarmRinging && (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl p-3.5 shadow-xl border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in ring-2 ring-amber-500/20">
            <div className="flex items-center gap-3 w-full sm:w-auto pl-1">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                <Bell className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white tracking-wide flex items-center gap-2">
                  <span>🔔 Naya Order Ringing!</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                    {Math.floor(soundAlert.alarmSecondsLeft / 60)}:{(soundAlert.alarmSecondsLeft % 60).toString().padStart(2, '0')} remaining
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  2 minute tak continuous reminder bajta rahega, jab tak accept ya reject na ho jaye.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={() => {
                  setSelectedStatusFilter('pending');
                  setActiveTab('orders');
                }}
                className="flex-1 sm:flex-initial px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs rounded-full transition-all shadow-md shadow-amber-500/20"
              >
                Review & Accept ({pendingOrders.length})
              </button>
              <button
                onClick={soundAlert.silenceAlarm}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-full transition-all border border-slate-700"
              >
                🔕 Mute / Stop Ringing
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Live Orders Management & Order History Archive */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Orders Sub-tab switcher: Full-width expanded modern segmented bar (NO empty gap on right) */}
            <div className="w-full bg-white p-1.5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrdersSubTab('today')}
                className={`flex-1 py-2.5 sm:py-3 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-heading font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  ordersSubTab === 'today'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                }`}
              >
                <Clock className={`w-4 h-4 ${ordersSubTab === 'today' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>TODAY'S</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  ordersSubTab === 'today' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-slate-100 text-slate-700'
                }`}>
                  {todayOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOrdersSubTab('history')}
                className={`flex-1 py-2.5 sm:py-3 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-heading font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  ordersSubTab === 'history'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                }`}
              >
                <FileText className={`w-4 h-4 ${ordersSubTab === 'history' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>Archive</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  ordersSubTab === 'history' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-100 text-slate-700'
                }`}>
                  {archivedOrders.length}
                </span>
              </button>
            </div>

            {ordersSubTab === 'history' ? (
              <OrderHistoryView
                archivedOrders={archivedOrders}
                onDeleteArchivedOrder={handleDeleteArchivedOrder}
                onClearAllHistory={handleClearAllHistory}
              />
            ) : (
              <>
                {/* Filter Pill Strip & Search */}
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar py-0.5">
                    <button
                      onClick={() => setSelectedStatusFilter('all')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                        selectedStatusFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({todayOrders.length})
                    </button>

                <button
                  onClick={() => setSelectedStatusFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedStatusFilter === 'pending'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>Pending</span>
                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {pendingOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('kitchen')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedStatusFilter === 'kitchen'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5 text-slate-500" />
                  <span>In Kitchen ({inKitchenOrders.length})</span>
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('out_for_delivery')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    selectedStatusFilter === 'out_for_delivery'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5 text-slate-500" />
                  <span>Out for Delivery ({outOrders.length})</span>
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('delivered')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedStatusFilter === 'delivered'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Delivered ({deliveredOrders.length})
                </button>

                <button
                  onClick={() => setSelectedStatusFilter('rejected')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    selectedStatusFilter === 'rejected'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cancelled ({rejectedOrders.length})
                </button>

                {cancellationRequestedOrders.length > 0 && (
                  <button
                    onClick={() => setSelectedStatusFilter('cancellation_requests')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 animate-pulse ${
                      selectedStatusFilter === 'cancellation_requests'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Cancel Requests ({cancellationRequestedOrders.length})</span>
                  </button>
                )}
              </div>

              {/* Search & Bulk Test Reset Controls */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ID, customer, phone..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 text-slate-900 transition-colors"
                  />
                </div>

                {orders.length > 0 && (
                  <button
                    onClick={() => setIsClearingAllModalOpen(true)}
                    className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                    title="Delete all test orders"
                    id="admin-clear-orders-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Clear Test Orders</span>
                  </button>
                )}
              </div>
            </div>

            {/* Orders Feed / Ledger */}
            {isLoadingOrders ? (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 space-y-3">
                <p className="text-xs font-medium">Loading live orders stream...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No orders found in this view
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {orders.length === 0
                    ? 'No orders placed yet. Place a test order from the store!'
                    : 'No orders match your current filter or search.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border shadow-xs transition-all ${
                      order.status === 'pending'
                        ? 'border-slate-900 ring-2 ring-slate-100'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                    id={`admin-order-card-${order.orderId}`}
                  >
                    {/* Header Row: Customer Name First, Order ID Tag, Phone & Timestamp, Status & Amount */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 truncate">
                            {order.customerName}
                          </h3>
                          <span className="font-mono font-extrabold text-[11px] text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/80 shrink-0">
                            #{order.orderId}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <a
                            href={`tel:${order.phone}`}
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 font-semibold bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{order.phone}</span>
                          </a>
                          {order.createdAt && (
                            <span className="text-[11px] text-slate-400">
                              • {new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-amount font-extrabold text-lg sm:text-xl text-slate-950">
                          ₹{order.totalAmount}
                        </span>
                        {order.cancellationStatus === 'requested' && order.status !== 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancel Requested</span>
                          </span>
                        ) : (
                          getStatusBadge(order.status)
                        )}
                      </div>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="py-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 text-xs">
                      {/* Items & Bill Summary Section */}
                      <div className="md:col-span-6 space-y-1.5 flex flex-col h-full">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                          ITEMS ORDERED ({order.items?.reduce((s, i) => s + i.quantity, 0) || 0})
                        </span>
                        <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100/90 flex flex-col h-full">
                          <div className="space-y-2 mb-3">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start text-slate-700 pb-2 border-b border-slate-200/40 last:border-b-0 last:pb-0">
                                <div className="flex items-start gap-2.5">
                                  <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200/60 text-[11px] shadow-xs">
                                    {item.quantity}x
                                  </span>
                                  <div className="mt-0.5">
                                    <span className="font-semibold text-slate-800 text-xs">{item.name}</span>
                                    {item.selectedSize && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-sm ml-1.5 tracking-wide uppercase">
                                        {item.selectedSize}
                                      </span>
                                    )}
                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                        {item.selectedExtras.map((extra) => (
                                          <span
                                            key={extra.id}
                                            className="text-[9px] font-bold text-amber-900 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/80 leading-none"
                                          >
                                            +{extra.name} (+₹{extra.price})
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className="font-amount font-bold text-slate-900 shrink-0 ml-2 mt-0.5">
                                  ₹{item.price * item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Bill Summary - Pushed to bottom of the cell */}
                          <div className="mt-auto pt-3 border-t border-slate-200/70 space-y-1.5">
                            {(() => {
                              const subtotal = order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
                              const deliveryFee = order.totalAmount - subtotal;
                              return (
                                <>
                                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                    <span>Item Total</span>
                                    <span className="font-amount font-semibold text-slate-700">₹{subtotal}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                    <span>Delivery Fee</span>
                                    <span className="font-amount font-semibold text-slate-700">
                                      {deliveryFee === 0 ? <span className="text-emerald-600">Free</span> : `₹${deliveryFee}`}
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
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                          DELIVERY ADDRESS & LOGISTICS
                        </span>
                        <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100/90 flex flex-col h-full">
                          <p className="text-slate-800 flex items-start gap-2 text-xs font-semibold leading-relaxed">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span>{order.address}</span>
                          </p>

                          {order.notes && (
                            <div className="mt-3">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Customer Notes</span>
                              <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200/60 text-[11px] bg-amber-50/30">
                                "{order.notes}"
                              </p>
                            </div>
                          )}

                          <div className="mt-auto pt-3">
                            {order.assignedAgentName ? (
                              <div className="pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Rider</span>
                                <div className="flex items-center justify-between bg-white border border-slate-200/60 p-2 rounded-xl shadow-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                                      <Bike className="w-3.5 h-3.5 text-slate-700" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-900 text-xs leading-none">{order.assignedAgentName}</span>
                                      {order.assignedAgentVehicleNumber && (
                                        <span className="font-mono text-[9px] text-slate-500 mt-0.5">{order.assignedAgentVehicleNumber}</span>
                                      )}
                                    </div>
                                  </div>
                                  {order.assignedAgentPhone && (
                                    <a href={`tel:${order.assignedAgentPhone}`} className="text-slate-600 hover:text-slate-900 font-mono text-[10px] font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                      Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="pt-3 border-t border-slate-200/60">
                                <div className="bg-slate-100/50 border border-slate-200 border-dashed p-3 rounded-xl flex items-center justify-center gap-1.5 text-slate-400 text-xs">
                                  <Bike className="w-3.5 h-3.5" />
                                  <span>No rider assigned yet</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Customer Cancellation Request Alert Box with Red Accept / Neutral Decline Buttons */}
                    {order.cancellationStatus === 'requested' && order.status !== 'rejected' && (
                      <div className="mb-3 w-full bg-rose-50/90 border border-rose-200/90 rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-200 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 animate-pulse" />
                          <span className="text-xs sm:text-sm font-extrabold text-rose-950 truncate">
                            Customer Requested Order Cancellation
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleDeclineCancellation(order.id)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcceptCancellation(order.id)}
                            className="px-4 py-1.5 rounded-full text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap cursor-pointer"
                            id={`accept-cancellation-btn-${order.orderId}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Order</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span>Payment: <strong>{order.paymentMethod?.toUpperCase() || 'COD / UPI'}</strong></span>
                        {order.paymentStatus === 'paid' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/60 text-[11px]">
                            ✓ PAID
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200/60 text-[11px]">
                            Pending Collection
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'rejected')}
                              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-full border border-rose-200 transition-colors"
                              id={`reject-btn-${order.orderId}`}
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'accepted')}
                              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                              id={`accept-btn-${order.orderId}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accept Order</span>
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
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                id={`start-preparing-btn-${order.orderId}`}
                              >
                                <PackageCheck className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Send to Preparing</span>
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
                                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                id={`start-preparing-btn-${order.orderId}`}
                              >
                                <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                                <span>Send to Kitchen</span>
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
                              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                              id={`start-preparing-btn-${order.orderId}`}
                            >
                              <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Send to Kitchen & Prep</span>
                            </button>
                          );
                        })()}

                        {order.status === 'preparing' && (
                          <button
                            onClick={() => handleOpenAdminDispatch(order)}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span>Send to Delivery Agent</span>
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
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Mark Delivered</span>
                          </button>
                        )}

                        {order.status === 'delivered' && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
                          </span>
                        )}

                        {order.status === 'rejected' && (
                          <span className="text-xs font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200/60 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Cancelled
                          </span>
                        )}

                        {/* Move to History Archive Button */}
                        <button
                          onClick={() => handleArchiveSingleOrder(order)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors active:scale-95 cursor-pointer"
                          title={`Move Order #${order.orderId} to History Archive`}
                        >
                          <Archive className="w-4 h-4" />
                        </button>

                        {/* Individual Delete Order Button */}
                        <button
                          onClick={() => setDeletingOrder(order)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors active:scale-95 cursor-pointer"
                          title={`Delete Order #${order.orderId}`}
                          id={`delete-order-btn-${order.orderId}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Menu & Product Management (Persisted in DOM for instant 0ms tab switching) */}
        <div className={activeTab === 'products' ? 'block' : 'hidden'}>
          <ProductManagement products={products} />
        </div>

        {/* Tab 3: Kitchen Staff Management */}
        {activeTab === 'kitchen_staff' && (
          <KitchenStaffManagement
            staffList={kitchenStaff}
            onDirectViewChef={(chef) => setPreviewChef(chef)}
          />
        )}

        {/* Tab 4: Preparing Staff Management */}
        {activeTab === 'preparing_staff' && (
          <PreparingStaffManagement
            staffList={preparingStaff}
            onDirectViewPrep={(st) => setPreviewPreparingStaff(st)}
          />
        )}

        {/* Tab 5: Delivery Agents Management */}
        {activeTab === 'delivery_agents' && (
          <DeliveryAgentsManagement
            agents={deliveryAgents}
            onDirectViewAgent={(agent) => setPreviewAgent(agent)}
          />
        )}

        {/* Tab 5: Payment & Restaurant Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <CloudStorageMeter products={products} />
            <PaymentSettings settings={settings} onUpdate={(newSettings) => setSettings(newSettings)} />
          </div>
        )}

        {/* Tab 6: Analytics & Summary */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Top Hero / Admin Banner Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  <span>Gidhaur Bakery Management Console</span>
                </div>
                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 capitalize">
                  {adminDisplayName}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-700">ADMIN</span>
                  <span>•</span>
                  <span>Live Kitchen & Delivery Coordination</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-full flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="text-slate-400">UPI ID:</span>
                  <span className="font-mono text-slate-900">{settings.upiId || 'gidhaurbakery@upi'}</span>
                </div>
              </div>
            </div>

            {/* Sub-view Switcher: [📦 Smart Stock & Inventory] | [📊 Revenue & Order Metrics] */}
            <div className="flex items-center p-1.5 bg-slate-100/90 rounded-2xl w-full sm:w-fit border border-slate-200/80 shadow-2xs gap-1">
              <button
                onClick={() => setAnalyticsSubView('stock')}
                className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  analyticsSubView === 'stock'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className={`w-4 h-4 ${analyticsSubView === 'stock' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span>Smart Stock & Inventory</span>
                {lowStockCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                    {lowStockCount} Low
                  </span>
                )}
              </button>

              <button
                onClick={() => setAnalyticsSubView('revenue')}
                className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  analyticsSubView === 'revenue'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className={`w-4 h-4 ${analyticsSubView === 'revenue' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>Revenue & Order Metrics</span>
              </button>
            </div>

            {/* Sub-view 1: Smart Stock & Inventory */}
            {analyticsSubView === 'stock' && (
              <InventoryManagementView
                products={liveProducts}
                onRefreshCatalog={() => {
                  try {
                    window.dispatchEvent(new CustomEvent('swadeep_products_updated', { detail: liveProducts }));
                  } catch {}
                }}
              />
            )}

            {/* Sub-view 2: Business & Order Performance Analytics */}
            {analyticsSubView === 'revenue' && (
              <div className="space-y-4 animate-fade-in">
                {/* 5 Clean Stat Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      TOTAL ORDERS
                    </span>
                    <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
                      {orders.length}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Live collection
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      PENDING ACTION
                    </span>
                    <div className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
                      {pendingOrders.length}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Needs approval
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      IN KITCHEN / OUT
                    </span>
                    <div className="font-heading font-extrabold text-2xl sm:text-3xl text-blue-600">
                      {inProgressOrders.length}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Active prep & dispatch
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      DELIVERED
                    </span>
                    <div className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-600">
                      {deliveredOrders.length}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Completed orders
                    </span>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-1 col-span-2 md:col-span-1">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                      TOTAL REVENUE
                    </span>
                    <div className="font-amount font-extrabold text-2xl sm:text-3xl text-emerald-700">
                      ₹{totalRevenue}
                    </div>
                    <span className="text-[10px] text-emerald-600 block font-medium">
                      Collected on delivery
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                  <h3 className="font-heading font-extrabold text-xl text-slate-900">
                    Performance Metrics & Revenue
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-xs text-slate-500 font-medium">Completion Rate</span>
                      <p className="font-heading font-bold text-2xl text-slate-900">
                        {orders.length > 0
                          ? `${Math.round((deliveredOrders.length / orders.length) * 100)}%`
                          : '100%'}
                      </p>
                      <span className="text-[11px] text-slate-400">{deliveredOrders.length} delivered</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-xs text-slate-500 font-medium">Average Order Value</span>
                      <p className="font-heading font-bold text-2xl text-slate-900 font-mono">
                        ₹{orders.length > 0 ? Math.round(totalRevenue / (deliveredOrders.length || 1)) : 0}
                      </p>
                      <span className="text-[11px] text-slate-400">Per delivered order</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-xs text-slate-500 font-medium">Active Menu Items</span>
                      <p className="font-heading font-bold text-2xl text-slate-900">
                        {liveProducts.filter((p) => p.available).length} / {liveProducts.length}
                      </p>
                      <span className="text-[11px] text-slate-400">Available in store</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 font-medium">Registered Delivery Riders</span>
                        <p className="font-heading font-bold text-xl text-slate-900">{deliveryAgents.length}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('delivery_agents')}
                        className="px-3 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-full cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 font-medium">Registered Kitchen Chefs</span>
                        <p className="font-heading font-bold text-xl text-slate-900">{kitchenStaff.length}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('kitchen_staff')}
                        className="px-3 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-full cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Firebase Daily Consumption & Quota Tracker */}
        {activeTab === 'usage' && (
          <FirebaseQuotaUsageView
            products={products}
          />
        )}
      </main>

      {/* Select Rider & Item Verification Dispatch Modal */}
      {dispatchingOrder && (() => {
        const orderItems = dispatchingOrder.items || [];
        const totalItems = orderItems.length;
        const checkedCount = orderItems.filter((_, idx) => adminCheckedItems[`${dispatchingOrder.id}-${idx}`]).length;
        const allDone = totalItems > 0 && checkedCount === totalItems;
        const untickedCount = totalItems - checkedCount;

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

          // Calculate subtotal of ONLY dispatched items (unticked items excluded from bill!)
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
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-scaleUp max-h-[92vh] flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                    <Bike className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-slate-900">
                      Send to Delivery Agent
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Order #{dispatchingOrder.orderId} • {dispatchingOrder.customerName}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setDispatchingOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                {/* Confirmation Status Alert Banner */}
                {allDone ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">
                        All Items Verified & Packed ({checkedCount}/{totalItems})
                      </h4>
                      <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                        Every item is ticked. The full order is ready to hand over to the delivery partner.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-amber-950">
                          {checkedCount === 0 ? 'No Items Ticked Yet' : `Partial Order Packing (${checkedCount}/${totalItems} Packed)`}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleAdminTickAllItems(dispatchingOrder.id, totalItems)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs cursor-pointer"
                        >
                          ✓ Tick All Items
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        {checkedCount === 0
                          ? 'Zero items are ticked. If you proceed now, all items will be assumed packed. Otherwise, tick individual items or click "Tick All Items".'
                          : `${untickedCount} item(s) are NOT ticked. Unticked items will NOT be dispatched with this rider. The customer will be informed that only ticked items are in this delivery parcel.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Live Bill Amount Box */}
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Bill Amount to Collect</span>
                    <span className="font-extrabold text-slate-900 text-base font-mono">₹{liveAdminTotal}</span>
                    {untickedCount > 0 && checkedCount > 0 && (
                      <span className="text-[10px] text-amber-700 block font-semibold mt-0.5">
                        (Unticked items excluded from bill & not charged)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    {checkedCount}/{totalItems} items in parcel
                  </span>
                </div>

                {/* Items Checklist Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Parcel Item Verification ({checkedCount}/{totalItems})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {checkedCount < totalItems && totalItems > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdminTickAllItems(dispatchingOrder.id, totalItems)}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 transition-colors cursor-pointer"
                        >
                          ✓ Tick All
                        </button>
                      )}
                      {checkedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAdminUntickAllItems(dispatchingOrder.id, totalItems)}
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
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
                          className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isTicked
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-900 font-semibold'
                              : 'bg-slate-50 border-slate-200/80 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isTicked ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300'
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
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-200/60">
                                    🍳 Kitchen {prepTime > 0 ? `(${prepTime}m)` : ''}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded border border-indigo-200/60">
                                    📦 Prep Section
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              isTicked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isTicked ? '✓ In Parcel' : 'Excluded'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rider Assignment List */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Choose Delivery Rider ({deliveryAgents.length} available)
                  </span>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {deliveryAgents.map((agent) => {
                      const isSelected = adminSelectedRiderId === agent.id;
                      return (
                        <div
                          key={agent.id}
                          onClick={() => setAdminSelectedRiderId(agent.id)}
                          className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between text-left cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="adminDeliveryAgent"
                              checked={isSelected}
                              onChange={() => setAdminSelectedRiderId(agent.id)}
                              className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                                {agent.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <span>{agent.vehicleType || 'Bike'}</span>
                                {agent.vehicleNumber && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded">
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
                            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full transition-colors cursor-pointer shadow-xs active:scale-95"
                          >
                            Assign & Send
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => executeAdminDispatch(undefined)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-semibold underline cursor-pointer"
                >
                  Dispatch without specific rider
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchingOrder(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedAgent = deliveryAgents.find((a) => a.id === adminSelectedRiderId);
                      executeAdminDispatch(matchedAgent);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>Confirm & Send to Delivery Agent</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Single Order Confirmation Modal */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Delete Order #{deletingOrder.orderId}?
              </h3>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-semibold text-slate-800">{deletingOrder.customerName}</span> (₹{deletingOrder.totalAmount})
              </p>
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                This test order will be permanently deleted from the database.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setDeletingOrder(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => handleDeleteOrder(deletingOrder)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Clear All Test Orders?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete all <span className="font-bold text-slate-900">{orders.length}</span> orders from the system?
              </p>
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                This will wipe out all past test records so you can start testing from a clean slate.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={() => setIsClearingAllModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingLoading}
                onClick={handleClearAllOrders}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
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
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsLogoutConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-2xs">
              <LogOut className="w-5 h-5" />
            </div>

            <div className="space-y-1.5">
              <h3 id="logout-dialog-title" className="text-base font-bold text-slate-900">
                Confirm Sign Out
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[280px] mx-auto">
                Are you sure you want to log out of the admin panel? You will need your PIN to sign back in.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-colors cursor-pointer"
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
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
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
