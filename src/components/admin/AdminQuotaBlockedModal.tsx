import React from 'react';
import { Sparkles } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { isQuotaTestMode } from '../../services/quotaService';

interface AdminQuotaBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminQuotaBlockedModal = React.memo<AdminQuotaBlockedModalProps>(({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  const isSimulated = isQuotaTestMode();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-[#18181B] rounded-sm border border-[#27272A] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-[#27272A] px-5 py-4 flex items-start justify-between gap-3.5 bg-[#0A0A0A]">
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm bg-[#18181B] text-[#F59E0B] border border-[#F59E0B]/40 mt-0.5 shrink-0">
              LIMIT
            </span>
            <div>
              <h2 className="font-bold text-[#FFFFFF] text-sm uppercase tracking-[-0.02em] leading-tight">
                Firestore Daily Limit Active
              </h2>
              <p className="text-[#A1A1AA] text-xs mt-0.5 font-normal">
                दैनिक कोटा पूरा हो चुका है · बदलाव सुरक्षित रखे गए हैं
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-7 h-7 rounded-sm border border-[#27272A] bg-[#18181B] text-[#A1A1AA] hover:text-[#FFFFFF] hover:bg-[#242427] flex items-center justify-center font-bold cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-[#A1A1AA] text-xs leading-relaxed">
          <div className="bg-[#0A0A0A] border border-[#27272A] rounded-sm p-4 space-y-2 text-[#A1A1AA]">
            <p className="font-bold text-[#FFFFFF]">
              नए उत्पाद जोड़ना या एडिट करना आज के लिए लॉक है:
            </p>
            <p className="text-[#A1A1AA] text-xs leading-relaxed">
              Firestore की दैनिक मुफ्त सीमा (50,000 reads / 20,000 writes) समाप्त होने के कारण, नए उत्पाद या संपादन सीधे डेटाबेस में सेव नहीं हो सकेंगे। डेटा करप्शन और असंगति (mismatch) से बचने के लिए इसे आज के लिए सुरक्षित रूप से लॉक कर दिया गया है।
            </p>
          </div>

          {isSimulated && (
            <div className="bg-[#0A0A0A] border border-[#FF5500]/40 rounded-sm p-3.5 flex items-start gap-2.5 text-xs text-[#FFFFFF] font-mono">
              <Sparkles className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#FF5500]">Test Mode Active:</span> यह सीमा एडमिन सेटिंग्स के 'Simulate Daily Limit Full' टॉगल के कारण सक्रिय है। आप इसे <strong>Settings &gt; Security</strong> में जाकर कभी भी बंद कर सकते हैं।
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#71717A] space-y-1 font-mono">
            <p>· ग्राहक अभी भी WhatsApp के माध्यम से सीधे ऑर्डर भेज सकते हैं।</p>
            <p>· डेटाबेस कोटा कल सुबह स्वतः रीसेट हो जाएगा।</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0A0A0A] border-t border-[#27272A] flex justify-end">
          <button
            onClick={() => {
              triggerHaptic('selection');
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] border border-[#FF5500] text-[#FFFFFF] font-mono font-bold text-xs uppercase tracking-[0.06em] cursor-pointer"
          >
            I Understand (समझ गया)
          </button>
        </div>
      </div>
    </div>
  );
});

AdminQuotaBlockedModal.displayName = 'AdminQuotaBlockedModal';
