import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { DeliveryAgent, KitchenStaff, PreparingStaff, RestaurantSettings, StaffSession } from '../types';

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

export const INITIAL_DELIVERY_AGENTS: DeliveryAgent[] = [
  {
    id: 'agent-1',
    name: 'Rahul Kumar',
    phone: '+91 98765 43211',
    email: 'rahul.rider@gidhaurbakery.com',
    password: 'password123',
    vehicleType: 'Bike',
    vehicleNumber: 'DL 01 AB 1234',
    status: 'active',
    activeOrdersCount: 0,
    totalDeliveredCount: 24,
    createdAt: new Date().toISOString()
  },
  {
    id: 'agent-2',
    name: 'Amit Sharma',
    phone: '+91 98765 43212',
    email: 'amit.rider@gidhaurbakery.com',
    password: 'password123',
    vehicleType: 'Scooter',
    vehicleNumber: 'DL 04 CD 5678',
    status: 'active',
    activeOrdersCount: 0,
    totalDeliveredCount: 18,
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_KITCHEN_STAFF: KitchenStaff[] = [
  {
    id: 'chef-1',
    name: 'Chef Vikram Singh',
    phone: '+91 98765 43221',
    email: 'vikram.chef@gidhaurbakery.com',
    password: 'password123',
    role: 'Head Chef / All Stations',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'chef-2',
    name: 'Chef Neha Roy',
    phone: '+91 98765 43222',
    email: 'neha.chef@gidhaurbakery.com',
    password: 'password123',
    role: 'Fast Food & Beverages Specialist',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_PREPARING_STAFF: PreparingStaff[] = [
  {
    id: 'prep-1',
    name: 'Suresh Verma',
    phone: '+91 98765 43231',
    email: 'suresh.prep@gidhaurbakery.com',
    password: 'password123',
    role: 'Lead Packer & Props Specialist',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

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

// Seed Delivery Agents if not present
export async function seedStaffIfEmpty() {
  try {
    const agentsSnap = await getDocs(collection(db, 'delivery_agents'));
    if (agentsSnap.empty) {
      for (const agent of INITIAL_DELIVERY_AGENTS) {
        await setDoc(doc(db, 'delivery_agents', agent.id), {
          ...agent,
          createdAt: serverTimestamp()
        });
      }
    }

    const kitchenSnap = await getDocs(collection(db, 'kitchen_staff'));
    if (kitchenSnap.empty) {
      for (const chef of INITIAL_KITCHEN_STAFF) {
        await setDoc(doc(db, 'kitchen_staff', chef.id), {
          ...chef,
          createdAt: serverTimestamp()
        });
      }
    }

    const settingsDoc = await getDoc(doc(db, 'settings', 'restaurant'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', 'restaurant'), {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.debug('Staff seeding fallback to local cache:', err);
    if (!localStorage.getItem(STORAGE_KEYS.DELIVERY_AGENTS)) {
      localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(INITIAL_DELIVERY_AGENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.KITCHEN_STAFF)) {
      localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(INITIAL_KITCHEN_STAFF));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
  }
}

// Subscribe to Delivery Agents
export function subscribeToDeliveryAgents(callback: (agents: DeliveryAgent[]) => void) {
  try {
    const unsubscribe = onSnapshot(
      collection(db, 'delivery_agents'),
      (snapshot) => {
        if (snapshot.empty) {
          const local = getLocalDeliveryAgents();
          callback(local);
        } else {
          const agents: DeliveryAgent[] = [];
          snapshot.forEach((d) => {
            agents.push({ ...(d.data() as DeliveryAgent), id: d.id });
          });
          localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify(agents));
          callback(agents);
        }
      },
      (error) => {
        console.warn('Firestore delivery agents listener fallback:', error);
        callback(getLocalDeliveryAgents());
      }
    );
    return unsubscribe;
  } catch {
    callback(getLocalDeliveryAgents());
    return () => {};
  }
}

export function getLocalDeliveryAgents(): DeliveryAgent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DELIVERY_AGENTS);
    return data ? JSON.parse(data) : INITIAL_DELIVERY_AGENTS;
  } catch {
    return INITIAL_DELIVERY_AGENTS;
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
  localStorage.setItem(STORAGE_KEYS.DELIVERY_AGENTS, JSON.stringify([newAgent, ...current]));
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
}

// Subscribe to Kitchen Staff
export function subscribeToKitchenStaff(callback: (staff: KitchenStaff[]) => void) {
  try {
    const unsubscribe = onSnapshot(
      collection(db, 'kitchen_staff'),
      (snapshot) => {
        if (snapshot.empty) {
          callback(getLocalKitchenStaff());
        } else {
          const staff: KitchenStaff[] = [];
          snapshot.forEach((d) => {
            staff.push({ ...(d.data() as KitchenStaff), id: d.id });
          });
          localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify(staff));
          callback(staff);
        }
      },
      (error) => {
        console.warn('Firestore kitchen staff listener fallback:', error);
        callback(getLocalKitchenStaff());
      }
    );
    return unsubscribe;
  } catch {
    callback(getLocalKitchenStaff());
    return () => {};
  }
}

export function getLocalKitchenStaff(): KitchenStaff[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.KITCHEN_STAFF);
    return data ? JSON.parse(data) : INITIAL_KITCHEN_STAFF;
  } catch {
    return INITIAL_KITCHEN_STAFF;
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
  localStorage.setItem(STORAGE_KEYS.KITCHEN_STAFF, JSON.stringify([newStaff, ...current]));
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
}

// Subscribe to Preparing Staff (Packing Team)
export function subscribeToPreparingStaff(callback: (staff: PreparingStaff[]) => void) {
  try {
    const unsubscribe = onSnapshot(
      collection(db, 'preparing_staff'),
      (snapshot) => {
        if (snapshot.empty) {
          callback(getLocalPreparingStaff());
        } else {
          const staff: PreparingStaff[] = [];
          snapshot.forEach((d) => {
            staff.push({ ...(d.data() as PreparingStaff), id: d.id });
          });
          localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify(staff));
          callback(staff);
        }
      },
      (error) => {
        console.warn('Firestore preparing staff listener fallback:', error);
        callback(getLocalPreparingStaff());
      }
    );
    return unsubscribe;
  } catch {
    callback(getLocalPreparingStaff());
    return () => {};
  }
}

export function getLocalPreparingStaff(): PreparingStaff[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PREPARING_STAFF);
    return data ? JSON.parse(data) : INITIAL_PREPARING_STAFF;
  } catch {
    return INITIAL_PREPARING_STAFF;
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
  localStorage.setItem(STORAGE_KEYS.PREPARING_STAFF, JSON.stringify([newStaff, ...current]));
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
}

// Settings (UPI ID etc)
export function subscribeToRestaurantSettings(callback: (settings: RestaurantSettings) => void) {
  try {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'restaurant'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as RestaurantSettings;
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
          callback(data);
        } else {
          callback(getLocalRestaurantSettings());
        }
      },
      (error) => {
        console.warn('Firestore settings listener fallback:', error);
        callback(getLocalRestaurantSettings());
      }
    );
    return unsubscribe;
  } catch {
    callback(getLocalRestaurantSettings());
    return () => {};
  }
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
