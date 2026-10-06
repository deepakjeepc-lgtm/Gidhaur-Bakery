import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { CustomerEmailRecord, Order, OrderStatus, RestaurantSettings } from '../types';

const STORAGE_KEY = 'swadeep_customer_emails';

export function getLocalCustomerEmails(): CustomerEmailRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalCustomerEmails(records: CustomerEmailRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function subscribeToCustomerEmails(callback: (records: CustomerEmailRecord[]) => void) {
  try {
    const colRef = collection(db, 'customer_emails');
    const q = query(colRef, orderBy('lastOrderDate', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: CustomerEmailRecord[] = [];
        snapshot.forEach((d) => {
          records.push({ ...(d.data() as CustomerEmailRecord), id: d.id });
        });
        saveLocalCustomerEmails(records);
        callback(records);
      },
      (err) => {
        console.warn('Customer emails firestore subscription note:', err);
        // Fallback to local storage or backend
        fetch('/api/customer-emails')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              saveLocalCustomerEmails(data);
              callback(data);
            } else {
              callback(getLocalCustomerEmails());
            }
          })
          .catch(() => callback(getLocalCustomerEmails()));
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToCustomerEmails error:', err);
    callback(getLocalCustomerEmails());
    return () => {};
  }
}

export async function recordCustomerEmail(data: {
  name: string;
  email: string;
  phone: string;
  orderId?: string;
}): Promise<void> {
  const cleanEmail = (data.email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return;

  const cleanPhone = (data.phone || '').trim();
  const cleanName = (data.name || 'Valued Customer').trim();
  const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

  const now = new Date().toISOString();
  const currentList = getLocalCustomerEmails();
  const existing = currentList.find((r) => r.email.toLowerCase() === cleanEmail);

  const updatedRecord: CustomerEmailRecord = {
    id: docId,
    name: cleanName || existing?.name || 'Customer',
    email: cleanEmail,
    phone: cleanPhone || existing?.phone || '',
    totalOrders: (existing?.totalOrders || 0) + 1,
    lastOrderDate: now,
    lastOrderId: data.orderId || existing?.lastOrderId || '',
    createdAt: existing?.createdAt || now,
  };

  // 1. Update local cache
  const filtered = currentList.filter((r) => r.email.toLowerCase() !== cleanEmail);
  const nextList = [updatedRecord, ...filtered];
  saveLocalCustomerEmails(nextList);

  // 2. Sync to Backend
  try {
    fetch('/api/customer-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecord),
    }).catch(() => {});
  } catch {}

  // 3. Save to Firestore
  try {
    await setDoc(
      doc(db, 'customer_emails', docId),
      {
        ...updatedRecord,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore recordCustomerEmail note:', err);
  }
}

export async function deleteCustomerEmail(idOrEmail: string): Promise<void> {
  const cleanId = idOrEmail.includes('@')
    ? idOrEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')
    : idOrEmail;

  // 1. Local cache
  const current = getLocalCustomerEmails();
  const next = current.filter(
    (r) => r.id !== cleanId && r.email.toLowerCase() !== idOrEmail.toLowerCase()
  );
  saveLocalCustomerEmails(next);

  // 2. Backend
  try {
    fetch(`/api/customer-emails/${cleanId}`, { method: 'DELETE' }).catch(() => {});
  } catch {}

  // 3. Firestore
  try {
    await deleteDoc(doc(db, 'customer_emails', cleanId));
  } catch (err) {
    console.warn('Firestore deleteCustomerEmail note:', err);
  }
}

export async function clearAllCustomerEmails(): Promise<void> {
  saveLocalCustomerEmails([]);

  // 1. Backend
  try {
    fetch('/api/customer-emails/clear', { method: 'POST' }).catch(() => {});
  } catch {}

  // 2. Firestore batch delete
  try {
    const colRef = collection(db, 'customer_emails');
    const snap = await getDocs(colRef);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('Firestore clearAllCustomerEmails note:', err);
  }
}

export function shouldSendEmailForStatus(
  status: OrderStatus | string,
  settings?: RestaurantSettings
): boolean {
  if (!settings) return true;
  if (settings.enableEmailNotifications === false) return false;

  const toggles = settings.emailEventToggles || {};
  switch (status) {
    case 'pending':
      return toggles.notifyOrderPlaced === true;
    case 'accepted':
      return toggles.notifyOrderConfirmed !== false;
    case 'preparing':
      return toggles.notifyKitchenSent === true;
    case 'out_for_delivery':
      return toggles.notifyOutForDelivery !== false;
    case 'delivered':
      return toggles.notifyDelivered !== false;
    case 'rejected':
      return toggles.notifyCancellationAccepted !== false;
    case 'cancellation_declined':
      return toggles.notifyCancellationDeclined !== false;
    default:
      return true;
  }
}

export async function sendOrderStatusEmail(
  order: Order,
  status: OrderStatus,
  settings?: RestaurantSettings
): Promise<{ success: boolean; message?: string; skipped?: boolean }> {
  const recipientEmail = order.customerEmail?.trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return { success: false, message: 'No customer email provided for this order' };
  }

  // Pre-check client settings toggles before making network request
  if (!shouldSendEmailForStatus(status, settings)) {
    console.log(`[sendOrderStatusEmail] Skipped sending "${status}" email because toggle is OFF in Admin Settings.`);
    return { success: true, skipped: true, message: `Notification for "${status}" is disabled in settings.` };
  }

  try {
    const res = await fetch('/api/send-order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order,
        status,
        recipientEmail,
        settings,
      }),
    });
    const result = await res.json();
    return result;
  } catch (err: any) {
    console.warn('sendOrderStatusEmail error:', err);
    return { success: false, message: err?.message || 'Network error sending email' };
  }
}
