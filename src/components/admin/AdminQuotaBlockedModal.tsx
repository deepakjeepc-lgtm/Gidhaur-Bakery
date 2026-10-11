import React from 'react';
import { AlertTriangle, X, ShieldAlert, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { isQuotaTestMode } from '../../services/quotaService';

interface AdminQuotaBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminQuotaBlockedModal: React.FC<AdminQuotaBlockedModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  const isSimulated = isQuotaTestMode();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-6 py-5 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex-1 pr-6">
            <h2 className="font-heading font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
              Firestore Daily Limit Active
            </h2>
            <p className="text-amber-800 text-xs mt-0.5 font-medium leading-relaxed">
              दैनिक कोटा पूरा हो चुका है • बदलाव सुरक्षित रखे गए हैं
            </p>
          </div>
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-4 space-y-2 text-slate-700">
            <p className="font-bold text-slate-900">
              नए उत्पाद जोड़ना या एडिट करना आज के लिए लॉक है:
            </p>
            <p className="text-slate-600 text-xs leading-relaxed">
              Firestore की दैनिक मुफ्त सीमा (50,000 reads / 20,000 writes) समाप्त होने के कारण, नए उत्पाद या संपादन सीधे डेटाबेस में सेव नहीं हो सकेंगे। डेटा करप्शन और असंगति (mismatch) से बचने के लिए इसे आज के लिए सुरक्षित रूप से लॉक कर दिया गया है।
            </p>
          </div>

          {isSimulated && (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-sky-900">
              <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Test Mode Active:</span> यह सीमा एडमिन सेटिंग्स के 'Simulate Daily Limit Full' टॉगल के कारण सक्रिय है। आप इसे <strong>Settings &gt; Security</strong> में जाकर कभी भी बंद कर सकते हैं।
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-500 space-y-1">
            <p>• ग्राहक अभी भी WhatsApp के माध्यम से सीधे ऑर्डर भेज सकते हैं।</p>
            <p>• डेटाबेस कोटा कल सुबह स्वतः रीसेट हो जाएगा।</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-slate-950 hover:bg-slate-900 text-white font-heading font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            I Understand (समझ गया)
          </button>
        </div>
      </div>
    </div>
  );
};
