import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { DeliveryAgent, KitchenStaff, PreparingStaff, RestaurantSettings, StaffSession } from '../types';
import { guardedGetDoc, guardedGetDocs } from './firestoreReadGuard';
import { getSessionCached, setSessionCached, invalidateSessionCache } from './sessionCache';

export const DEFAULT_SETTINGS: RestaurantSettings = {
  enableOnlinePayment: true,
  upiId: 'gidhaurbakery@upi',
  upiPayeeName: 'Gidhaur Bakery',
  restaurantName: 'Gidhaur Bakery',
  contactPhone: '+91 98765 43210',
  address: 'Main Market, Gidhaur',
  openingHours: '08:00 AM - 10:30 PM (Everyday)',
  isStoreOpen: true,
  minOrderAmount: 99,
  defaultPrepTimeMinutes: 15,
  websiteTitle: 'Gidhaur Bakery',
  websiteTagline: 'Freshly Baked Every Morning with Premium Love',
  websiteDescription: 'Order freshly baked artisan cakes, hot pizzas, gourmet burgers, snacks and beverages with lightning-fast delivery in Gidhaur.',
  faviconUrl: '',
  searchLogoUrl: '',
  headerLogoUrl: '',
  pwaIconUrl: '',
  freeDeliveryRadiusKm: 5,
  tier1MaxKm: 6,
  tier1Fee: 20,
  tier2MaxKm: 8,
  tier2Fee: 20,
  beyondTier2PerKmFee: 0,
  restaurantLat: 25.6127,
  restaurantLng: 85.1240,
  festivalMode: {
    isEnabled: false,
    activeFestival: 'diwali',
    showConfettiCelebration: true,
    ambientDecorEnabled: true,
  },
  fssaiLicenseNumber: '20426191000010',
  isEmailMandatory: false,
  enableEmailNotifications: true,
  senderEmail: '',
  senderEmailPassword: '',
  senderName: 'Gidhaur Bakery',
  emailEventToggles: {
    notifyOrderPlaced: false, // Default false as requested: email starts at confirmed
    notifyOrderConfirmed: true,
    notifyKitchenSent: false, // Default false: no email when sent to kitchen
    notifyOutForDelivery: true,
    notifyDelivered: true,
    notifyCancellationAccepted: true,
    notifyCancellationDeclined: true,
  },
};

export const INITIAL_DELIVERY_AGENTS: DeliveryAgent[] = [];
export const INITIAL_KITCHEN_STAFF: KitchenStaff[] = [];
export const INITIAL_PREPARING_STAFF: PreparingStaff[] = [];

// Blacklist of hardcoded demo/dummy staff members that must NEVER be reloaded
export const HARDCODED_STAFF_IDS = new Set<string>([
  'agent-1',
  'agent-2',
  'chef-1',
  'chef-2',
  'prep-1'
]);

export const HARDCODED_STAFF_EMAILS = new Set<string>([
  'rahul.rider@gidhaurbakery.com',
  'rahul.rider@swadeep.com',
  'amit.rider@gidhaurbakery.com',
  'amit.rider@swadeep.com',
  'vikram.chef@gidhaurbakery.com',
  'vikram.chef@swadeep.com',
  'neha.chef@gidhaurbakery.com',
  'neha.chef@swadeep.com',
  'suresh.prep@gidhaurbakery.com',
  'suresh.prep@swadeep.com'
]);

export function isHardcodedStaff(staff: { id?: string; email?: string } | null | undefined): boolean {
  if (!staff) return false;
  if (staff.id && HARDCODED_STAFF_IDS.has(staff.id)) return true;
  if (staff.email && HARDCODED_STAFF_EMAILS.has(staff.email.trim().toLowerCase())) return true;
  return false;
}

// Local storage keys for resilient persistence
const STORAGE_KEYS = {
  DELIVERY_AGENTS: 'swadeep_delivery_agents',
  KITCHEN_STAFF: 'swadeep_kitchen_staff',
  PREPARING_STAFF: 'swadeep_preparing_staff',
  SETTINGS: 'swadeep_restaurant_settings',
  ACTIVE_STAFF_SESSION: 'swadeep_active_staff_session',
  ADMIN_ACCOUNTS: 'gidhaur_admin_accounts'
};

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'master_admin' | 'admin' | 'manager';
  phone?: string;
  createdAt: string;
}

export const INITIAL_ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    id: 'admin-master',
    name: 'Master Admin',
    email: 'admin@gidhaurbakery.com',
    password: 'admin123',
    role: 'master_admin',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export function getLocalAdminAccounts(): AdminAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_ADMIN_ACCOUNTS;
}

export function saveLocalAdminAccounts(admins: AdminAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_ACCOUNTS, JSON.stringify(admins));
    window.dispatchEvent(new CustomEvent('gidhaur_admins_updated', { detail: admins }));
  } catch (err) {
    console.warn('Could not save admin accounts:', err);
  }
}

export async function addAdminAccount(admin: Omit<AdminAccount, 'id' | 'createdAt'>): Promise<AdminAccount> {
  const current = getLocalAdminAccounts();
  const newAccount: AdminAccount = {
    ...admin,
    id: `admin-${Date.now()}`,
    createdAt: new Date().toISOString()
  };
  const updated = [...current, newAccount];
  saveLocalAdminAccounts(updated);
  return newAccount;
}

export async function updateAdminAccount(id: string, updates: Partial<AdminAccount>): Promise<void> {
  const current = getLocalAdminAccounts();
  const updated = current.map((a) => (a.id === id ? { ...a, ...updates } : a));
  saveLocalAdminAccounts(updated);
}

export async function deleteAdminAccount(id: string): Promise<boolean> {
  const current = getLocalAdminAccounts();
  // Protection: master admin cannot be deleted
  const target = current.find((a) => a.id === id);
  if (!target || target.role === 'master_admin' || target.id === 'admin-master') {
    return false;
  }
  const updated = current.filter((a) => a.id !== id);
  saveLocalAdminAccounts(updated);
  return true;
}

// Clean no-op: strictly NO automatic reads or writes on page load
export async function seedStaffIfEmpty(): Promise<void> {
  return;
}

// Subscribe to Delivery Agents with 24-hour session cache (NO 180s polling)
export function subscribeToDeliveryAgents(callback: (agents: DeliveryAgent[]) => void): () => void {
  // 1. Immediately provide cached data
  callback(getLocalDeliveryAgents());

  // 2. Listen to local updates
  const handleUpdate = () => {
    callback(getLocalDeliveryAgents());
  };
  window.addEventListener('swadeep_staff_updated', handleUpdate);

  // 3. Read ONCE per 24h session via IndexedDB (NO interval polling)
  getSessionCached<DeliveryAgent[]>('delivery_agents', 24 * 60 * 60 * 1000).then((cached) => {
    if (cached && Array.isArray(cached) && cached.length > 0) {
      callback(cached);
      return;
    }
    guardedGetDocs(collection(db, 'delivery_agents'), 'staffService.deliveryAgents')
      .then((snapshot) => {
        const agents: DeliveryAgent[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as DeliveryAgent), id: d.id };
          if (!isHardcodedStaff(item)) {
            agents.push(item);
          }
        });
        localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(agents));
        setSessionCached('delivery_agents', agents);
        callback(agents);
      })
      .catch((error) => {
        console.warn('Delivery agents fetch note (using local cache):', error?.message || error);
      });
  });

  return () => {
    window.removeEventListener('swadeep_staff_updated', handleUpdate);
  };
}

export function getLocalDeliveryAgents(): DeliveryAgent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DELIVERY_AGENTS);
    if (data !== null) {
      const parsed: DeliveryAgent[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((a) => !isHardcodedStaff(a));
        localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(cleaned));
        return cleaned;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Add Delivery Agent
export async function addDeliveryAgent(agentData: Omit<DeliveryAgent, 'id' | 'createdAt'>): Promise<string> {
  const id = `agent-${Date.now()}`;
  const newAgent: DeliveryAgent = {
    ...agentData,
    id,
    status: 'active',
    activeOrdersCount: 0,
    totalDeliveredCount: 0,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'delivery_agents', id), {
      ...newAgent,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local save for delivery agent:', err);
  }

  // Update local storage
  const current = getLocalDeliveryAgents();
  const updated = [newAgent, ...current.filter((a) => a.id !== id)];
  localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
  return id;
}

// Update Delivery Agent
export async function updateDeliveryAgent(id: string, updates: Partial<DeliveryAgent>): Promise<void> {
  try {
    await updateDoc(doc(db, 'delivery_agents', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local update for delivery agent:', err);
  }

  const current = getLocalDeliveryAgents().map((a) => (a.id === id ? { ...a, ...updates } : a));
  localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Delete Delivery Agent
export async function deleteDeliveryAgent(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'delivery_agents', id));
  } catch (err) {
    console.debug('Direct local delete for delivery agent:', err);
  }

  const current = getLocalDeliveryAgents().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Subscribe to Kitchen Staff with 24-hour session cache (NO 180s polling)
export function subscribeToKitchenStaff(callback: (staff: KitchenStaff[]) => void): () => void {
  // 1. Immediately provide cached data
  callback(getLocalKitchenStaff());

  // 2. Listen to local updates
  const handleUpdate = () => {
    callback(getLocalKitchenStaff());
  };
  window.addEventListener('swadeep_staff_updated', handleUpdate);

  // 3. Read ONCE per 24h session via IndexedDB (NO interval polling)
  getSessionCached<KitchenStaff[]>('kitchen_staff', 24 * 60 * 60 * 1000).then((cached) => {
    if (cached && Array.isArray(cached) && cached.length > 0) {
      callback(cached);
      return;
    }
    guardedGetDocs(collection(db, 'kitchen_staff'), 'staffService.kitchenStaff')
      .then((snapshot) => {
        const staff: KitchenStaff[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as KitchenStaff), id: d.id };
          if (!isHardcodedStaff(item)) {
            staff.push(item);
          }
        });
        localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(staff));
        setSessionCached('kitchen_staff', staff);
        callback(staff);
      })
      .catch((error) => {
        console.warn('Kitchen staff fetch note (using local cache):', error?.message || error);
      });
  });

  return () => {
    window.removeEventListener('swadeep_staff_updated', handleUpdate);
  };
}

export function getLocalKitchenStaff(): KitchenStaff[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.KITCHEN_STAFF);
    if (data !== null) {
      const parsed: KitchenStaff[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s) => !isHardcodedStaff(s));
        localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(cleaned));
        return cleaned;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Add Kitchen Staff
export async function addKitchenStaff(staffData: Omit<KitchenStaff, 'id' | 'createdAt'>): Promise<string> {
  const id = `chef-${Date.now()}`;
  const newStaff: KitchenStaff = {
    ...staffData,
    id,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'kitchen_staff', id), {
      ...newStaff,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local save for kitchen staff:', err);
  }

  const current = getLocalKitchenStaff();
  const updated = [newStaff, ...current.filter((s) => s.id !== id)];
  localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
  return id;
}

// Update Kitchen Staff
export async function updateKitchenStaff(id: string, updates: Partial<KitchenStaff>): Promise<void> {
  try {
    await updateDoc(doc(db, 'kitchen_staff', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local update for kitchen staff:', err);
  }

  const current = getLocalKitchenStaff().map((s) => (s.id === id ? { ...s, ...updates } : s));
  localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Delete Kitchen Staff
export async function deleteKitchenStaff(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'kitchen_staff', id));
  } catch (err) {
    console.debug('Direct local delete for kitchen staff:', err);
  }

  const current = getLocalKitchenStaff().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Subscribe to Preparing Staff (Packing Team) with 24-hour session cache (NO 180s polling)
export function subscribeToPreparingStaff(callback: (staff: PreparingStaff[]) => void): () => void {
  // 1. Immediately provide cached data
  callback(getLocalPreparingStaff());

  // 2. Listen to local updates
  const handleUpdate = () => {
    callback(getLocalPreparingStaff());
  };
  window.addEventListener('swadeep_staff_updated', handleUpdate);

  // 3. Read ONCE per 24h session via IndexedDB (NO interval polling)
  getSessionCached<PreparingStaff[]>('preparing_staff', 24 * 60 * 60 * 1000).then((cached) => {
    if (cached && Array.isArray(cached) && cached.length > 0) {
      callback(cached);
      return;
    }
    guardedGetDocs(collection(db, 'preparing_staff'), 'staffService.preparingStaff')
      .then((snapshot) => {
        const staff: PreparingStaff[] = [];
        snapshot.forEach((d) => {
          const item = { ...(d.data() as PreparingStaff), id: d.id };
          if (!isHardcodedStaff(item)) {
            staff.push(item);
          }
        });
        localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(staff));
        setSessionCached('preparing_staff', staff);
        callback(staff);
      })
      .catch((error) => {
        console.warn('Preparing staff fetch note (using local cache):', error?.message || error);
      });
  });

  return () => {
    window.removeEventListener('swadeep_staff_updated', handleUpdate);
  };
}

export function getLocalPreparingStaff(): PreparingStaff[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PREPARING_STAFF);
    if (data !== null) {
      const parsed: PreparingStaff[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s) => !isHardcodedStaff(s));
        localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(cleaned));
        return cleaned;
      }
    }
    return [];
  } catch {
    return [];
  }
}

// Add Preparing Staff
export async function addPreparingStaff(staffData: Omit<PreparingStaff, 'id' | 'createdAt'>): Promise<string> {
  const id = `prep-${Date.now()}`;
  const newStaff: PreparingStaff = {
    ...staffData,
    id,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'preparing_staff', id), {
      ...newStaff,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local save for preparing staff:', err);
  }

  const current = getLocalPreparingStaff();
  const updated = [newStaff, ...current.filter((s) => s.id !== id)];
  localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
  return id;
}

// Update Preparing Staff
export async function updatePreparingStaff(id: string, updates: Partial<PreparingStaff>): Promise<void> {
  try {
    await updateDoc(doc(db, 'preparing_staff', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local update for preparing staff:', err);
  }

  const current = getLocalPreparingStaff().map((s) => (s.id === id ? { ...s, ...updates } : s));
  localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Delete Preparing Staff
export async function deletePreparingStaff(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'preparing_staff', id));
  } catch (err) {
    console.debug('Direct local delete for preparing staff:', err);
  }

  const current = getLocalPreparingStaff().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('swadeep_staff_updated'));
}

// Settings (UPI ID etc) with 24-hour session cache (NO 180s polling)
export function subscribeToRestaurantSettings(callback: (settings: RestaurantSettings) => void): () => void {
  // 1. Immediately provide cached settings
  callback(getLocalRestaurantSettings());

  // 2. Listen to local updates
  const handleUpdate = () => {
    callback(getLocalRestaurantSettings());
  };
  window.addEventListener('swadeep_settings_updated', handleUpdate);

  // 3. Read ONCE per 24h session via IndexedDB (NO interval polling)
  getSessionCached<RestaurantSettings>('restaurant_settings', 24 * 60 * 60 * 1000).then((cached) => {
    if (cached) {
      callback(cached);
      return;
    }
    guardedGetDoc(doc(db, 'settings', 'restaurant'), 'staffService.restaurantSettings')
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as RestaurantSettings;
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
          setSessionCached('restaurant_settings', data);
          callback(data);
        }
      })
      .catch((error) => {
        console.warn('Restaurant settings fetch note (using local cache):', error?.message || error);
      });
  });

  return () => {
    window.removeEventListener('swadeep_settings_updated', handleUpdate);
  };
}

export function getLocalRestaurantSettings(): RestaurantSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveRestaurantSettings(settings: RestaurantSettings): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'restaurant'), {
      ...settings,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.debug('Direct local save for settings:', err);
  }
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  invalidateSessionCache('restaurant_settings');
  try {
    window.dispatchEvent(new CustomEvent('swadeep_settings_updated'));
  } catch {}
}

// Staff Session Management (Rider / Kitchen / Admin)
export function getSavedStaffSession(): StaffSession | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_STAFF_SESSION);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveStaffSession(session: StaffSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_STAFF_SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_STAFF_SESSION);
    }
  } catch {
    // ignore
  }
}

export function clearStaffSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_STAFF_SESSION);
  } catch {
    // ignore
  }
}
