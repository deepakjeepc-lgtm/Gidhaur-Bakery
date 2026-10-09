/**
 * customerNotificationService.ts
 * Manages native push / web notifications for customers as their order status progresses:
 * Placed -> Confirmed -> Preparing -> Out for Delivery -> Delivered
 */

import { Order, OrderStatus } from '../types';
import { sendNativeNotification, playSynthesizedChime } from '../utils/sound';

const STORAGE_KEY_CUSTOMER_NOTIFIED = 'gidhaur_customer_notified_statuses_v1';
const STORAGE_KEY_CUSTOMER_ORDERS = 'gidhaur_customer_active_order_ids_v1';

// Get notified statuses map: { [orderId]: Set of statuses already notified }
function getNotifiedStatuses(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_NOTIFIED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotifiedStatus(orderId: string, status: OrderStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotifiedStatuses();
    const existing = current[orderId] || [];
    if (!existing.includes(status)) {
      current[orderId] = [...existing, status];
      localStorage.setItem(STORAGE_KEY_CUSTOMER_NOTIFIED, JSON.stringify(current));
    }
  } catch {}
}

/**
 * Register an order to be tracked for customer notifications
 */
export function registerCustomerOrderForNotifications(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_ORDERS);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (!existing.includes(orderId)) {
      existing.push(orderId);
      localStorage.setItem(STORAGE_KEY_CUSTOMER_ORDERS, JSON.stringify(existing.slice(-20))); // Keep last 20
    }
  } catch {}
}

export function getCustomerTrackedOrderIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOMER_ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Check and notify customer if their order status has progressed
 */
export function checkAndNotifyCustomerOrderStatus(order: Order): void {
  if (!order || !order.id || !order.status) return;

  const orderId = order.orderId || order.id;
  const status = order.status;

  const notifiedMap = getNotifiedStatuses();
  const alreadyNotified = notifiedMap[orderId] || [];

  if (alreadyNotified.includes(status)) {
    return; // Already notified for this status
  }

  // Record that we're notifying this status
  saveNotifiedStatus(orderId, status);

  // Status-specific customer message
  let title = '';
  let body = '';

  switch (status) {
    case 'accepted':
      title = `🎉 Order Confirmed! #${orderId}`;
      body = `Gidhaur Bakery accepted your order. Kitchen preparation will begin shortly!`;
      break;

    case 'preparing':
      title = `👨‍🍳 Fresh in the Kitchen! #${orderId}`;
      body = `Your delicious items are now being baked and prepared fresh.`;
      break;

    case 'out_for_delivery':
      title = `🛵 Out For Delivery! #${orderId}`;
      body = `Your order is on the way! Delivery rider is en route to your address.`;
      break;

    case 'delivered':
      title = `✅ Order Delivered! #${orderId}`;
      body = `Your order from Gidhaur Bakery has been delivered. Enjoy your delicious treats!`;
      break;

    case 'rejected':
      title = `⚠️ Order Update #${orderId}`;
      body = `Your order #${orderId} was declined or updated. Tap to view details.`;
      break;

    default:
      return;
  }

  // Play pleasant chime
  playSynthesizedChime(0.7);

  // Send native phone notification with vibration
  sendNativeNotification(title, body, {
    tag: `customer-order-${orderId}-${status}`,
    url: `/`,
    vibrate: [300, 150, 300],
  });
}
