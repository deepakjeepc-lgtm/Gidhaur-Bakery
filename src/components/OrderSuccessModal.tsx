import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Compass,
  QrCode,
  Smartphone,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, RestaurantSettings } from '../types';
import { getLocalRestaurantSettings, subscribeToRestaurantSettings } from '../services/staffService';
import { triggerHaptic } from '../utils/haptics';

interface OrderSuccessModalProps {
  order: Order | null;
  onClose: () => void;
  onTrackOrder: (orderId: string, phone: string) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  order,
  onClose,
  onTrackOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isPaidLocally, setIsPaidLocally] = useState(false);
  const [settings, setSettings] = useState<RestaurantSettings>(() => getLocalRestaurantSettings());
  const [countdown, setCountdown] = useState(5);

  // Bulletproof iOS Safari & Android body scroll lock
  useEffect(() => {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // 5-Second Countdown to auto-navigate to Track Order
  useEffect(() => {
    if (!order) return;
    if (countdown <= 0) {
      triggerHaptic('medium');
      onClose();
      onTrackOrder(order.orderId, order.phone);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, order?.orderId, order?.phone, onClose, onTrackOrder]);

  useEffect(() => {
    const unsub = subscribeToRestaurantSettings((newSettings) => {
      setSettings(newSettings);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (order) {
      setIsPaidLocally(order.paymentStatus === 'paid');
      triggerHaptic('success');
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#10b981', '#0f172a', '#64748b'],
        });
      } catch (e) {
        console.warn('Confetti trigger failed:', e);
      }
    }
  }, [order]);

  if (!order) return null;

  const handleCopyOrderId = () => {
    triggerHaptic('light');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(order.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUpiOrder = order.paymentMethod === 'upi';
  const upiId = settings.upiId || 'gidhaurbakery@upi';
  const upiPayeeName = settings.upiPayeeName || 'Gidhaur Bakery';

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    upiPayeeName
  )}&am=${order.totalAmount}&cu=INR&tn=${encodeURIComponent(`Gidhaur Bakery Order ${order.orderId}`)}`;

  const handleMarkAsPaid = async () => {
    triggerHaptic('success');
    setIsPaidLocally(true);
    try {
      const orderRef = doc(db, 'orders', order.orderId);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paymentMethod: 'upi',
        paidAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not update order payment status:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-y-auto select-none animate-in fade-in duration-150"
      id="order-success-fullscreen-view"
    >
      <div
        className="relative w-full max-w-lg mx-auto flex-1 flex flex-col justify-center px-4 py-8 sm:py-10 space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
          <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
            Order Confirmed!
          </span>
          <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 pt-1">
            Thank you, {order.customerName}!
          </h2>
          <p className="text-slate-500 text-xs max-w-xs mx-auto">
            Your order is confirmed and sent to our kitchen for preparation.
          </p>
        </div>

        {/* UPI Payment Banner if UPI Payment was selected */}
        {isUpiOrder && (
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Online UPI Payment</span>
              </div>
              {isPaidLocally ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Paid Successfully
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Payment Pending
                </span>
              )}
            </div>

            {!isPaidLocally && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-600">
                  Pay <strong>₹{order.totalAmount}</strong> directly via any UPI app (GPay / PhonePe / Paytm) or QR.
                </p>

                <div className="flex items-center gap-2">
                  <a
                    href={upiUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => triggerHaptic('medium')}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay ₹{order.totalAmount} Now</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowQr(!showQr);
                    }}
                    className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                    {showQr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showQr && (
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center space-y-2 text-center animate-in fade-in duration-150">
                    <QRCodeSVG value={upiUri} size={130} level="M" includeMargin={true} />
                    <span className="text-[10px] font-mono text-slate-600 font-semibold">{upiId}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleMarkAsPaid}
                  className="w-full py-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition-colors underline cursor-pointer"
                >
                  Already paid? Tap here to confirm
                </button>
              </div>
            )}
          </div>
        )}

        {/* Order ID Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Tracking ID
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full uppercase">
              {order.paymentMethod === 'upi' ? 'Online / UPI' : 'Pay on Delivery'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs">
            <span className="font-mono font-extrabold text-lg sm:text-xl text-slate-900 tracking-wider">
              {order.orderId}
            </span>
            <button
              onClick={handleCopyOrderId}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
              id="copy-order-id-btn"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Order Details Brief */}
        <div className="bg-slate-50 rounded-2xl p-3.5 text-left text-xs space-y-2 border border-slate-100">
          <div className="flex justify-between font-bold text-slate-800 border-b border-slate-200/60 pb-1.5">
            <span>Items Ordered ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
            <span className="font-amount font-extrabold text-sm text-slate-900">₹{order.totalAmount}</span>
          </div>
          <div className="space-y-1 text-slate-600">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="truncate pr-2">
                  {item.quantity}x {item.name}
                  {item.selectedSize ? ` (${item.selectedSize})` : ''}
                </span>
                <span className="font-amount font-bold text-slate-800 shrink-0">₹{item.price * item.quantity}</span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-[10px] text-slate-400 italic">
                + {order.items.length - 3} more items
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-2">
          <button
            onClick={() => {
              triggerHaptic('medium');
              onClose();
              onTrackOrder(order.orderId, order.phone);
            }}
            className="w-full py-3.5 px-6 bg-slate-950 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-full shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="track-order-modal-btn"
          >
            <Compass className="w-4 h-4" />
            <span>Track Order Status</span>
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-white/20 text-[11px] font-mono font-bold text-white ml-0.5">
              {countdown}s
            </span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
