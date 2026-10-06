import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft as ArrowLeftIcon,
  X as XIcon,
  Phone as PhoneIcon,
  User as UserIcon,
  MessageSquare as MessageSquareIcon,
  AlertCircle as AlertCircleIcon,
  Loader2 as Loader2Icon,
  Check as CheckIcon,
  Banknote as BanknoteIcon,
  MapPin as MapPinIcon,
  Clock as ClockIcon,
  QrCode as QrCodeIcon,
  Smartphone as SmartphoneIcon,
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  Ban,
  Mail as MailIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateDailyOrderId } from '../utils/orderIdGenerator';
import { useCart } from '../context/CartContext';
import { useLocation } from '../context/LocationContext';
import { Order } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';
import { recordCustomerEmail, sendOrderStatusEmail } from '../services/customerEmailService';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

const QUICK_NOTES = [
  'Less spicy 🌶️',
  'Extra spoons 🥄',
  'Ring doorbell 🔔',
  'Call before delivery 📞',
  'Leave at door 🚪',
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
}) => {
  const { items, subtotal, clearCart } = useCart();
  const { userLocation, settings } = useLocation();

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Payment method: NONE selected by default as required
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | null>(null);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiUnavailableNotice, setUpiUnavailableNotice] = useState(false);
  const [paymentErrorGlow, setPaymentErrorGlow] = useState(false);
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const deliveryFee = 0;
  const grandTotal = subtotal + deliveryFee;

  const isOnlinePaymentEnabled =
    settings?.enableOnlinePayment !== false && Boolean(settings?.upiId?.trim());
  const upiId = settings?.upiId?.trim() || 'gidhaurbakery@upi';
  const upiPayeeName = settings?.upiPayeeName?.trim() || 'Gidhaur Bakery';

  // Auto-fill saved customer profile from this device (Name, Phone, Address, Email ONLY).
  // Cooking/delivery notes box must ALWAYS start fresh & empty for every order!
  useEffect(() => {
    if (isOpen) {
      triggerHaptic('medium');
      // Reset payment method selection to null every time modal opens
      setPaymentMethod(null);
      setPaymentErrorGlow(false);
      setShowUpiQr(false);
      setUpiUnavailableNotice(false);
      setNotes(''); // Strictly reset cooking/delivery note box to empty
      try {
        const savedProfileStr = localStorage.getItem('swadeep_customer_profile');
        if (savedProfileStr) {
          const profile = JSON.parse(savedProfileStr);
          if (profile.customerName) setCustomerName(profile.customerName);
          if (profile.phone) setPhone(profile.phone);
          if (profile.address) setAddress(profile.address);
          if (profile.customerEmail) setCustomerEmail(profile.customerEmail);

          // Purge legacy saved notes from stored profile so it never reappears
          if (profile.notes) {
            delete profile.notes;
            localStorage.setItem('swadeep_customer_profile', JSON.stringify(profile));
          }
        }
      } catch (e) {
        console.warn('Could not read saved profile:', e);
      }
    }
  }, [isOpen]);

  // Prevent background home screen from scrolling while checkout is open
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  const handleCloseNavigation = useCallback(() => {
    triggerHaptic('light');
    if (window.history.state?.modal === 'checkout') {
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!customerName.trim() || customerName.trim().length < 2) {
      errs.customerName = 'Please enter your name';
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Enter valid 10-digit number';
    }

    if (!address.trim() || address.trim().length < 5) {
      errs.address = 'Please enter complete delivery address';
    }

    const isEmailMandatory = settings?.isEmailMandatory === true;
    const cleanEmail = customerEmail.trim();

    if (isEmailMandatory) {
      if (!cleanEmail) {
        errs.customerEmail = 'Email is required for order status updates';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errs.customerEmail = 'Please enter a valid email address';
      }
    } else if (cleanEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errs.customerEmail = 'Please enter a valid email address';
      }
    }

    if (!paymentMethod) {
      errs.paymentMethod = 'required';
      setPaymentErrorGlow(true);
      setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } else {
      setPaymentErrorGlow(false);
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      triggerHaptic('error');
      return false;
    }
    return true;
  };

  const handleAddQuickNote = (noteText: string) => {
    triggerHaptic('light');
    setNotes((prev) => {
      if (!prev.trim()) return noteText;
      if (prev.includes(noteText)) return prev;
      return `${prev.trim()}, ${noteText}`;
    });
  };

  const handleCopyUpiId = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleSelectUpiOption = () => {
    if (!isOnlinePaymentEnabled) {
      triggerHaptic('error');
      setUpiUnavailableNotice(true);
      setTimeout(() => setUpiUnavailableNotice(false), 4000);
      return;
    }
    triggerHaptic('selection');
    setPaymentErrorGlow(false);
    setUpiUnavailableNotice(false);
    setPaymentMethod('upi');
    if (errors.paymentMethod) setErrors((prev) => ({ ...prev, paymentMethod: '' }));
  };

  const executeOrderPlacement = async () => {
    if (!validate()) return;

    if (items.length === 0) {
      triggerHaptic('error');
      setServerError('Your cart is empty.');
      return;
    }

    triggerHaptic('heavy');
    setIsSubmitting(true);
    setServerError(null);

    // Generate 5-digit random order ID as requested
    let generatedOrderId = String(Math.floor(10000 + Math.random() * 90000));
    try {
      generatedOrderId = await generateDailyOrderId();
    } catch {
      generatedOrderId = String(Math.floor(10000 + Math.random() * 90000));
    }
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanName = customerName.trim();
    const cleanAddress = address.trim();
    const cleanEmail = customerEmail.trim();
    const cleanNotes = notes.trim();

    // Auto-save ONLY permanent identity details (Name, Phone, Address, Email) for future checkout.
    // Cooking/delivery note is per-order only and is excluded so the note box stays completely fresh and empty.
    try {
      localStorage.setItem(
        'swadeep_customer_profile',
        JSON.stringify({
          customerName: cleanName,
          phone: cleanPhone,
          address: cleanAddress,
          customerEmail: cleanEmail,
          lastUpdated: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn('LocalStorage profile save error:', e);
    }

    const orderItems = items.map((cartItem) => {
      const basePrice = cartItem.selectedVariant ? cartItem.selectedVariant.price : cartItem.product.price;
      const extrasTotal = cartItem.selectedExtras && cartItem.selectedExtras.length > 0
        ? cartItem.selectedExtras.reduce((sum, e) => sum + (Number(e.price) || 0), 0)
        : 0;
      const unitPrice = basePrice + extrasTotal;

      let itemName = cartItem.product.name;
      if (cartItem.selectedVariant && !itemName.toLowerCase().includes(cartItem.selectedVariant.name.toLowerCase())) {
        itemName = `${itemName} (${cartItem.selectedVariant.name})`;
      }

      const prepTime =
        typeof cartItem.product.prepTimeMinutes === 'number' && cartItem.product.prepTimeMinutes > 0
          ? cartItem.product.prepTimeMinutes
          : undefined;

      return {
        productId: cartItem.product.id,
        name: itemName,
        selectedSize: cartItem.selectedVariant?.name,
        selectedExtras: cartItem.selectedExtras && cartItem.selectedExtras.length > 0 ? cartItem.selectedExtras : undefined,
        price: unitPrice,
        quantity: cartItem.quantity,
        imageUrl: cartItem.selectedVariant?.imageUrl || cartItem.product.imageUrl || '',
        category: cartItem.product.category,
        prepTimeMinutes: prepTime,
        hasKitchenPrepTime: typeof prepTime === 'number' && prepTime > 0,
        isNonFood: !(typeof prepTime === 'number' && prepTime > 0),
      };
    });

    const chosenPaymentMethod = paymentMethod === 'upi' ? 'upi' : 'cod';

    const orderPayload = {
      orderId: generatedOrderId,
      customerName: cleanName,
      phone: cleanPhone,
      customerEmail: cleanEmail || undefined,
      address: cleanAddress,
      notes: cleanNotes,
      paymentMethod: chosenPaymentMethod,
      paymentStatus: 'unpaid' as const,
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      totalAmount: grandTotal,
      status: 'pending' as const,
      customerLocation: userLocation || null,
      createdAt: new Date().toISOString(),
    };

    // Record email into directory and send notification email if enabled by admin
    if (cleanEmail) {
      recordCustomerEmail({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        orderId: generatedOrderId,
      });
      if (settings?.emailEventToggles?.notifyOrderPlaced === true) {
        sendOrderStatusEmail(orderPayload as any, 'pending', settings);
      }
    }

    const sanitizedOrderPayload = JSON.parse(JSON.stringify(orderPayload));

    // Save recent order to localStorage immediately for instant persistence
    const fullRecentOrder = {
      id: generatedOrderId,
      orderId: generatedOrderId,
      phone: cleanPhone,
      customerName: cleanName,
      address: cleanAddress,
      notes: cleanNotes,
      createdAt: new Date().toISOString(),
      totalAmount: grandTotal,
      subtotal,
      deliveryFee: 0,
      paymentMethod: chosenPaymentMethod,
      paymentStatus: 'unpaid',
      status: 'pending',
      items: orderItems,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
    };

    try {
      const recentOrders = JSON.parse(localStorage.getItem('gidhaur_recent_orders') || localStorage.getItem('swadeep_recent_orders') || '[]');
      const updated = [fullRecentOrder, ...recentOrders.filter((o: any) => o.orderId !== generatedOrderId && o.id !== generatedOrderId)];
      localStorage.setItem('gidhaur_recent_orders', JSON.stringify(updated.slice(0, 15)));
      localStorage.setItem('swadeep_recent_orders', JSON.stringify(updated.slice(0, 15)));
    } catch (e) {
      console.warn('LocalStorage recent orders error:', e);
    }

    // Sync to backend Express server immediately
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sanitizedOrderPayload,
          id: generatedOrderId,
        }),
      }).catch(() => {});
    } catch {}

    try {
      const orderRef = doc(db, 'orders', generatedOrderId);
      // Persist to Firestore
      setDoc(orderRef, sanitizedOrderPayload).catch((err) => {
        console.warn('Firestore background order sync notice:', err);
      });

      const confirmedOrderData: Order = {
        id: generatedOrderId,
        orderId: generatedOrderId,
        customerName: cleanName,
        phone: cleanPhone,
        customerEmail: cleanEmail || undefined,
        address: cleanAddress,
        notes: cleanNotes,
        paymentMethod: chosenPaymentMethod,
        paymentStatus: 'unpaid',
        items: orderItems,
        subtotal,
        deliveryFee: 0,
        totalAmount: grandTotal,
        status: 'pending',
        customerLocation: userLocation || undefined,
        createdAt: new Date(),
      };

      // If user selected UPI, try opening the UPI Intent Deep link automatically on mobile devices
      if (chosenPaymentMethod === 'upi') {
        const upiIntentUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
          upiPayeeName
        )}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent(`Gidhaur Bakery Order ${generatedOrderId}`)}`;
        
        try {
          if (typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
            window.location.href = upiIntentUri;
          }
        } catch (e) {
          console.warn('UPI intent invoke:', e);
        }
      }

      clearCart();
      setNotes('');
      setIsSubmitting(false);
      triggerHaptic('success');
      try {
        if (window.history.state?.modal) {
          window.history.replaceState(null, '');
        }
      } catch {}
      onClose();
      onOrderSuccess(confirmedOrderData);
    } catch (err: any) {
      console.warn('Order sync note: placing order locally (Firestore network/permission fallback):', err?.message || err);
      // Fallback in case of local firestore error
      const fallbackOrderData: Order = {
        id: generatedOrderId,
        orderId: generatedOrderId,
        customerName: cleanName,
        phone: cleanPhone,
        customerEmail: cleanEmail || undefined,
        address: cleanAddress,
        notes: cleanNotes,
        paymentMethod: chosenPaymentMethod,
        paymentStatus: 'unpaid',
        items: orderItems,
        subtotal,
        deliveryFee: 0,
        totalAmount: grandTotal,
        status: 'pending',
        customerLocation: userLocation || undefined,
        createdAt: new Date(),
      };

      try {
        fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...fallbackOrderData,
            createdAt: new Date().toISOString(),
          }),
        }).catch(() => {});

        const recentOrders = JSON.parse(localStorage.getItem('gidhaur_recent_orders') || localStorage.getItem('swadeep_recent_orders') || '[]');
        const updated = [{ ...fallbackOrderData, createdAt: new Date().toISOString() }, ...recentOrders.filter((o: any) => o.orderId !== generatedOrderId && o.id !== generatedOrderId)];
        localStorage.setItem('gidhaur_recent_orders', JSON.stringify(updated.slice(0, 10)));
        localStorage.setItem('swadeep_recent_orders', JSON.stringify(updated.slice(0, 10)));
      } catch {}

      clearCart();
      setNotes('');
      setIsSubmitting(false);
      triggerHaptic('success');
      try {
        if (window.history.state?.modal) {
          window.history.replaceState(null, '');
        }
      } catch {}
      onClose();
      onOrderSuccess(fallbackOrderData);
    }
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    executeOrderPlacement();
  };

  // Active UPI deep link for current grand total
  const activeUpiDeeplink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    upiPayeeName
  )}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent('Gidhaur Bakery Order')}`;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
      id="checkout-fullscreen-view"
    >
      {/* Full Screen Dedicated View on Mobile & Desktop - Zero popup lag, Zero backdrop stutter */}
      <div
        className="relative bg-[#f8fafc] w-full h-full max-w-2xl mx-auto flex flex-col overflow-hidden sm:border-x sm:border-slate-200/80 sm:shadow-sm"
        onClick={(e) => e.stopPropagation()}
        id="checkout-modal"
      >
        {/* Header */}
        <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCloseNavigation}
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-2xs"
              aria-label="Back to Cart"
              id="checkout-back-btn"
            >
              <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div>
              <h2 className="font-heading font-black text-lg sm:text-xl text-slate-900 tracking-tight leading-none flex items-center gap-2">
                <span>Order Confirmation</span>
                <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                  {items.reduce((s, i) => s + i.quantity, 0)} Items
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Delivery details & payment
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseNavigation}
            className="hidden sm:flex w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 items-center justify-center transition-all hover:scale-105 active:scale-90 border border-slate-200/80 cursor-pointer shadow-2xs"
            aria-label="Close modal"
          >
            <XIcon className="w-4.5 h-4.5 stroke-[2.2]" />
          </button>
        </header>

        {/* Form Body with Smooth Native Scroll */}
        <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 select-text pb-32 sm:pb-36">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* SECTION 1: Delivery Details */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Delivery Details
              </span>
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Fast & Verified
              </span>
            </div>

            {/* Grid for Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Name Field */}
              <div>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={customerName}
                    onFocus={() => triggerHaptic('selection')}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: '' }));
                    }}
                    placeholder="Full Name *"
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all ${
                      errors.customerName ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    id="checkout-name-input"
                  />
                </div>
                {errors.customerName && (
                  <p className="text-[10px] text-red-500 font-medium mt-1 pl-1">{errors.customerName}</p>
                )}
              </div>

              {/* Phone Field */}
              <div>
                <div className="relative flex items-center">
                  <PhoneIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onFocus={() => triggerHaptic('selection')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(val);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                    placeholder="10-digit Mobile *"
                    maxLength={10}
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all ${
                      errors.phone ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    id="checkout-phone-input"
                  />
                </div>
                {errors.phone && (
                  <p className="text-[10px] text-red-500 font-medium mt-1 pl-1">{errors.phone}</p>
                )}
              </div>
            </div>

            {/* Address Field */}
            <div>
              <div className="relative">
                <MapPinIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <textarea
                  value={address}
                  onFocus={() => triggerHaptic('selection')}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (errors.address) setErrors((prev) => ({ ...prev, address: '' }));
                  }}
                  placeholder="Complete Delivery Address (House No, Flat/Street, Landmark) *"
                  rows={2}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all resize-none leading-relaxed ${
                    errors.address ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  id="checkout-address-input"
                />
              </div>
              {errors.address && (
                <p className="text-[10px] text-red-500 font-medium mt-1 pl-1">{errors.address}</p>
              )}
            </div>

            {/* Email Field with fadeout placeholder text "Email for order status" */}
            <div>
              <div className="relative flex items-center">
                <MailIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="email"
                  value={customerEmail}
                  onFocus={() => triggerHaptic('selection')}
                  onChange={(e) => {
                    setCustomerEmail(e.target.value);
                    if (errors.customerEmail) setErrors((prev) => ({ ...prev, customerEmail: '' }));
                  }}
                  placeholder={settings?.isEmailMandatory ? "Email for order status *" : "Email for order status"}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all ${
                    errors.customerEmail ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  id="checkout-email-input"
                />
              </div>
              {errors.customerEmail && (
                <p className="text-[10px] text-red-500 font-medium mt-1 pl-1">{errors.customerEmail}</p>
              )}
            </div>

            {/* Notes Field & Horizontal Quick Chips */}
            <div className="space-y-1.5">
              <div className="relative flex items-center">
                <MessageSquareIcon className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={notes}
                  onFocus={() => triggerHaptic('selection')}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cooking / delivery note (optional)"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                  id="checkout-notes-input"
                />
              </div>

              {/* Horizontal Scrollable Quick Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {QUICK_NOTES.map((qNote) => (
                  <button
                    key={qNote}
                    type="button"
                    onClick={() => handleAddQuickNote(qNote)}
                    className="text-[10px] font-semibold whitespace-nowrap px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200/80 transition-all cursor-pointer shrink-0"
                  >
                    + {qNote}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery ETA Pill */}
          <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/70 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
              <ClockIcon className="w-3.5 h-3.5 text-slate-400" /> Estimated delivery time:
            </span>
            <span className="font-bold text-slate-900 font-mono text-xs">20–30 mins</span>
          </div>

          {/* SECTION 2: Bill Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span>Items Subtotal</span>
                <span className="font-amount font-semibold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  Delivery Fee <span className="text-[10px] text-slate-400">(0–5 km)</span>
                </span>
                <span className="text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                  FREE
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                To Pay
              </span>
              <span className="font-heading font-black text-xl text-slate-950">
                ₹{grandTotal}
              </span>
            </div>
          </div>

          {/* SECTION 3: Payment Method Selection (Default: None selected) */}
          <div ref={paymentSectionRef} className="space-y-2 scroll-mt-24" id="checkout-payment-selection-section">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span>Payment Method</span>
                <span className="text-red-500 font-bold">*</span>
              </span>
              {!paymentMethod ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  paymentErrorGlow 
                    ? 'text-red-700 bg-red-50 border-red-300' 
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                  Select 1 option
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckIcon className="w-2.5 h-2.5 stroke-[3]" /> Selected
                </span>
              )}
            </div>

            {/* Payment Option Cards */}
            <div className="grid grid-cols-1 gap-2">
              {/* Option 1: Pay on Delivery */}
              <div
                onClick={() => {
                  triggerHaptic('selection');
                  setPaymentMethod('cod');
                  setPaymentErrorGlow(false);
                  setUpiUnavailableNotice(false);
                  if (errors.paymentMethod) setErrors((prev) => ({ ...prev, paymentMethod: '' }));
                }}
                className={`py-3 px-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  paymentMethod === 'cod'
                    ? 'border-slate-900 bg-slate-900/[0.04] ring-1.5 ring-slate-900 shadow-2xs'
                    : paymentErrorGlow && !paymentMethod
                    ? 'border-red-400 bg-red-50/15'
                    : 'border-slate-200/90 bg-white hover:bg-slate-50/80'
                }`}
                id="payment-method-cod-btn"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      paymentMethod === 'cod'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <BanknoteIcon className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Pay on Delivery</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-200/80">
                    CASH / UPI
                  </span>
                  <div
                    className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
                      paymentMethod === 'cod'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {paymentMethod === 'cod' && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Option 2: Pay Online / UPI Option */}
              <div
                onClick={handleSelectUpiOption}
                className={`py-3 px-3.5 rounded-2xl border transition-all select-none space-y-2.5 ${
                  !isOnlinePaymentEnabled
                    ? paymentErrorGlow && !paymentMethod
                      ? 'border-red-400/80 bg-slate-50/60 cursor-pointer'
                      : 'border-slate-200/80 bg-slate-50/60 cursor-pointer hover:bg-slate-100/60'
                    : paymentMethod === 'upi'
                    ? 'border-blue-600 bg-blue-50/40 ring-1.5 ring-blue-600 shadow-2xs cursor-pointer'
                    : paymentErrorGlow && !paymentMethod
                    ? 'border-red-400 bg-red-50/15 cursor-pointer'
                    : 'border-slate-200/90 bg-white hover:bg-slate-50/80 cursor-pointer'
                }`}
                id="payment-method-upi-btn"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        !isOnlinePaymentEnabled
                          ? 'bg-slate-200/80 text-slate-400'
                          : paymentMethod === 'upi'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <SmartphoneIcon className="w-4.5 h-4.5" />
                    </div>
                    <span className={`text-xs font-bold ${!isOnlinePaymentEnabled ? 'text-slate-600' : 'text-slate-900'}`}>
                      Pay Online / UPI
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isOnlinePaymentEnabled ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full border border-slate-300/60 flex items-center gap-1">
                        <Ban className="w-2.5 h-2.5" /> Unavailable
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-blue-600 fill-blue-600" /> Fast
                        </span>
                        <div
                          className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
                            paymentMethod === 'upi'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {paymentMethod === 'upi' && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Notice when Online Payment is Toggled OFF and user tries to select it */}
                {!isOnlinePaymentEnabled && upiUnavailableNotice && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in duration-150">
                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Currently unavailable. Please select <strong>Pay on Delivery</strong>.</span>
                  </div>
                )}

                {/* Refined UPI Action Box when selected and enabled */}
                {isOnlinePaymentEnabled && paymentMethod === 'upi' && (
                  <div className="pt-2 border-t border-blue-200/60 space-y-2 animate-in fade-in duration-150">
                    {/* Copy UPI VPA chip */}
                    <div className="flex items-center justify-between text-[11px] bg-white p-2 rounded-xl border border-blue-200/80 shadow-2xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-500 text-[10px] font-medium">UPI VPA:</span>
                        <span className="font-mono font-bold text-slate-900 text-[11px] truncate">{upiId}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpiId}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedUpi ? (
                          <>
                            <CheckIcon className="w-3 h-3 text-emerald-600 stroke-[3]" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Pay with App & Toggle QR Controls */}
                    <div className="flex items-center gap-2">
                      <a
                        href={activeUpiDeeplink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                        }}
                        className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                        <span>Pay ₹{grandTotal} with UPI App</span>
                      </a>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          setShowUpiQr(!showUpiQr);
                        }}
                        className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <QrCodeIcon className="w-3.5 h-3.5 text-slate-600" />
                        <span>{showUpiQr ? 'Hide QR' : 'Show QR'}</span>
                        {showUpiQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {/* Expandable Clean QR Code Card */}
                    {showUpiQr && (
                      <div className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-1.5 text-center animate-in fade-in duration-150">
                        <QRCodeSVG
                          value={activeUpiDeeplink}
                          size={120}
                          level="M"
                          includeMargin={true}
                        />
                        <p className="text-[10px] text-slate-500 font-medium">
                          Scan with Google Pay, PhonePe, Paytm or BHIM
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Floating Clean Bottom CTA Footer - Single Unified White Frosted Glass Capsule Button */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none p-2.5 sm:p-3.5 pb-[max(env(safe-area-inset-bottom,0.75rem),1.15rem)] flex items-center justify-center">
          <button
            type="button"
            onClick={executeOrderPlacement}
            disabled={isSubmitting}
            onPointerDown={() => {
              if (!isSubmitting) triggerHaptic('heavy');
            }}
            className={`pointer-events-auto max-w-xl w-full h-16 px-6 sm:px-8 active:scale-[0.98] backdrop-blur-xl rounded-full border transition-all duration-200 cursor-pointer group select-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-between ${
              paymentMethod
                ? 'bg-slate-950 hover:bg-slate-900 text-white border-slate-900 shadow-[0_14px_38px_rgba(15,23,42,0.35),0_2px_8px_rgba(15,23,42,0.12)] ring-1.5 ring-slate-800'
                : 'bg-white/45 hover:bg-white/65 text-slate-800 border-white/60 shadow-[0_12px_36px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.02)]'
            }`}
            id="checkout-confirm-btn"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center w-full gap-2.5 py-0.5">
                <Loader2Icon className={`w-5 h-5 animate-spin ${paymentMethod ? 'text-white' : 'text-slate-800'}`} />
                <span className={`text-sm sm:text-base font-extrabold tracking-wide ${paymentMethod ? 'text-white' : 'text-slate-950'}`}>Placing order...</span>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-3 font-heading font-black text-sm sm:text-base ${paymentMethod ? 'text-white' : 'text-slate-950'}`}>
                  <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                    paymentMethod 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 shadow-xs' 
                      : 'bg-slate-900/5 border border-slate-900/10 text-slate-900'
                  }`}>
                    <CheckIcon className="w-4 h-4 stroke-[3]" />
                  </span>
                  <span className="tracking-tight font-black">
                    Place Order
                  </span>
                </div>
                <div className={`flex items-baseline gap-1 font-heading font-black text-xl tracking-tight ${paymentMethod ? 'text-white' : 'text-slate-950'}`}>
                  <span className={`text-sm font-bold select-none ${paymentMethod ? 'text-slate-400' : 'text-slate-600'}`}>₹</span>
                  <span>{grandTotal}</span>
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
