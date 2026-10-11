/**
 * WhatsApp Order Helper
 * Formats full customer order details into an elegant WhatsApp message.
 */

export interface WhatsAppOrderItem {
  name: string;
  selectedSize?: string;
  selectedExtras?: Array<{ name: string; price: number }>;
  quantity: number;
  price: number;
}

export interface WhatsAppOrderDetails {
  restaurantName?: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  items: WhatsAppOrderItem[];
  subtotal: number;
  totalAmount: number;
  paymentMethod: 'upi' | 'cod';
}

/**
 * Standardizes a phone number for the WhatsApp wa.me link.
 * Defaults to 91 prefix for 10-digit Indian numbers.
 */
export function formatWhatsAppPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '919876543210';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Builds the readable text message with bold formatting and dividers for WhatsApp.
 */
export function buildWhatsAppOrderMessage(order: WhatsAppOrderDetails): string {
  const storeName = order.restaurantName || 'Gidhaur Bakery';
  const payLabel = order.paymentMethod === 'upi' ? 'Online UPI' : 'Cash on Delivery (COD)';

  let msg = `🎂 *${storeName} - New Order*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `👤 *Customer Details:*\n`;
  msg += `• Name: ${order.customerName || 'Customer'}\n`;
  msg += `• Phone: ${order.phone}\n`;
  msg += `• Delivery Address: ${order.address}\n`;
  if (order.notes && order.notes.trim()) {
    msg += `• Cooking / Delivery Note: ${order.notes.trim()}\n`;
  }

  msg += `\n🛍️ *Items Ordered:*\n`;
  order.items.forEach((item) => {
    let itemLine = `• ${item.quantity}x ${item.name}`;
    if (item.selectedSize) {
      itemLine += ` (${item.selectedSize})`;
    }
    itemLine += ` - ₹${item.price * item.quantity}`;
    msg += `${itemLine}\n`;

    if (item.selectedExtras && item.selectedExtras.length > 0) {
      item.selectedExtras.forEach((extra) => {
        msg += `   └ +${extra.name} (₹${extra.price})\n`;
      });
    }
  });

  msg += `\n💰 *Bill Summary:*\n`;
  if (order.subtotal !== order.totalAmount) {
    msg += `• Subtotal: ₹${order.subtotal}\n`;
  }
  msg += `• Total Amount: ₹${order.totalAmount}\n`;
  msg += `• Payment Mode: ${payLabel}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_(Order placed via WhatsApp Direct Checkout)_`;

  return msg;
}

/**
 * Generates the full WhatsApp URL.
 */
export function createWhatsAppCheckoutUrl(
  storePhone: string,
  order: WhatsAppOrderDetails
): string {
  const cleanPhone = formatWhatsAppPhoneNumber(storePhone);
  const message = buildWhatsAppOrderMessage(order);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
