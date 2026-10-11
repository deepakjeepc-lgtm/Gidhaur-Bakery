import React from 'react';
import { MessageSquare, MapPin, Clock, X, Store, AlertTriangle } from 'lucide-react';
import { WhatsAppOrderDetails, createWhatsAppCheckoutUrl } from '../utils/whatsappOrder';
import { triggerHaptic } from '../utils/haptics';

interface QuotaExhaustedModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: WhatsAppOrderDetails;
  storePhone?: string;
  storeAddress?: string;
}

export const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
  isOpen,
  onClose,
  orderDetails,
  storePhone = '+91 98765 43210',
  storeAddress = 'Main Market Road, Gidhaur',
}) => {
  if (!isOpen) return null;

  const handleWhatsAppCheckout = () => {
    triggerHaptic('success');
    const url = createWhatsAppCheckoutUrl(storePhone, orderDetails);
    window.location.href = url;
  };

  const totalItemCount = orderDetails.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header Notice Banner */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-extrabold text-slate-900 text-sm sm:text-base md:text-lg leading-snug">
              Online Orders Full for Today
            </h2>
          </div>
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Explanation Text */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3 sm:p-3.5 text-slate-600 text-xs sm:text-sm leading-relaxed">
            <p>
              प्रिय ग्राहक, सिस्टम की दैनिक ऑनलाइन बुकिंग क्षमता आज समाप्त हो गई है। आप हमारी दुकान पर सीधे विजिट कर सकते हैं, या <strong>बिना किसी परेशानी के तुरंत WhatsApp पर ऑर्डर भेज सकते हैं</strong>।
            </p>
          </div>

          {/* Quick Cart Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <span>Your Prepared Order</span>
              <span>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="divide-y divide-slate-200/60 max-h-32 sm:max-h-36 overflow-y-auto pr-1">
              {orderDetails.items.map((item, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between text-xs gap-2">
                  <span className="text-slate-800 font-medium truncate flex-1">
                    {item.quantity}x {item.name} {item.selectedSize ? `(${item.selectedSize})` : ''}
                  </span>
                  <span className="text-slate-900 font-bold shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-slate-800">Total Amount:</span>
              <span className="font-heading font-black text-slate-950 text-sm sm:text-base">
                ₹{orderDetails.totalAmount}
              </span>
            </div>
          </div>

          {/* Bakery Visit Alternative Box */}
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 sm:gap-3 text-xs text-amber-900">
            <Store className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-slate-900">Visit Our Bakery In Person:</p>
              <div className="flex items-center gap-1.5 text-slate-600 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{storeAddress}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Open: 8:00 AM – 11:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          {/* Main WhatsApp Checkout Button - Tall & Squary */}
          <button
            onClick={handleWhatsAppCheckout}
            className="w-full sm:flex-1 min-h-[52px] sm:min-h-[54px] py-3.5 px-5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:bg-[#1caa4f] text-white font-heading font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 border border-[#1eb855] shadow-sm active:scale-[0.99] transition-all cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 fill-white stroke-none shrink-0" />
            <span>Checkout through WhatsApp</span>
          </button>

          {/* Cancel Button - Matching squary rounded-xl styling */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[54px] py-3 px-6 rounded-xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-sm sm:text-base transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
