import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  CreditCard,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  Upload,
  Trash2,
  Search,
  Check,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Send,
  Download,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RestaurantSettings, WebsiteBrandingSettings, CustomerEmailRecord } from '../../types';
import { saveRestaurantSettings } from '../../services/staffService';
import { uploadOptimizedImages, deleteStorageImage } from '../../services/storageService';
import { applyWebsiteBrandingToDocument } from '../../utils/branding';
import { AdminAccountsManagement } from './AdminAccountsManagement';
import {
  subscribeToCustomerEmails,
  deleteCustomerEmail,
  clearAllCustomerEmails
} from '../../services/customerEmailService';
import {
  isQuotaExhausted,
  isQuotaTestMode,
  setQuotaTestMode,
  resetQuotaStatus
} from '../../services/quotaService';
import { triggerHaptic } from '../../utils/haptics';

interface PaymentSettingsProps {
  settings: RestaurantSettings;
  onUpdate: (settings: RestaurantSettings) => void;
}

type SettingsSection = 'website' | 'payments' | 'delivery' | 'emails' | 'security';

export const PaymentSettings = React.memo<PaymentSettingsProps>(({ settings, onUpdate }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('website');

  const [fssaiLicenseNumber, setFssaiLicenseNumber] = useState(
    settings.fssaiLicenseNumber || '20426191000010'
  );

  const [isEmailMandatory, setIsEmailMandatory] = useState<boolean>(
    settings.isEmailMandatory === true
  );
  const [enableEmailNotifications, setEnableEmailNotifications] = useState<boolean>(
    settings.enableEmailNotifications !== false
  );
  const [senderEmail, setSenderEmail] = useState(settings.senderEmail || '');
  const [senderEmailPassword, setSenderEmailPassword] = useState(
    settings.senderEmailPassword || ''
  );
  const [senderName, setSenderName] = useState(
    settings.senderName || settings.restaurantName || 'Gidhaur Bakery'
  );
  const [showPassword, setShowPassword] = useState(false);

  const [emailEventToggles, setEmailEventToggles] = useState({
    notifyOrderPlaced: settings.emailEventToggles?.notifyOrderPlaced === true,
    notifyOrderConfirmed: settings.emailEventToggles?.notifyOrderConfirmed !== false,
    notifyKitchenSent: settings.emailEventToggles?.notifyKitchenSent === true,
    notifyOutForDelivery: settings.emailEventToggles?.notifyOutForDelivery !== false,
    notifyDelivered: settings.emailEventToggles?.notifyDelivered !== false,
    notifyCancellationAccepted: settings.emailEventToggles?.notifyCancellationAccepted !== false,
    notifyCancellationDeclined: settings.emailEventToggles?.notifyCancellationDeclined !== false,
  });

  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [customerEmailsList, setCustomerEmailsList] = useState<CustomerEmailRecord[]>([]);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [copiedAllEmails, setCopiedAllEmails] = useState(false);
  const [deletingEmailRecord, setDeletingEmailRecord] = useState<CustomerEmailRecord | null>(null);
  const [isClearingAllEmailsConfirm, setIsClearingAllEmailsConfirm] = useState(false);

  const [quotaTestActive, setQuotaTestActive] = useState<boolean>(isQuotaTestMode());
  const [quotaExhaustedActive, setQuotaExhaustedActive] = useState<boolean>(isQuotaExhausted());
  const [quotaResetToast, setQuotaResetToast] = useState<string | null>(null);

  useEffect(() => {
    const handleQuotaChange = () => {
      setQuotaTestActive(isQuotaTestMode());
      setQuotaExhaustedActive(isQuotaExhausted());
    };
    window.addEventListener('swadeep_quota_status_changed', handleQuotaChange);
    return () => window.removeEventListener('swadeep_quota_status_changed', handleQuotaChange);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCustomerEmails((records) => {
      setCustomerEmailsList(records);
    });
    return () => unsubscribe();
  }, []);

  const [branding, setBranding] = useState<WebsiteBrandingSettings>({
    websiteTitle: settings.websiteTitle || 'Gidhaur Bakery',
    websiteTagline: settings.websiteTagline || 'Freshly Baked Every Morning with Premium Love',
    websiteDescription: settings.websiteDescription || 'Gidhaur Bakery - Order delicious cakes, bakery delicacies, snacks, and beverages directly with quick checkout and live order tracking.',
    faviconUrl: settings.faviconUrl || '',
    searchLogoUrl: settings.searchLogoUrl || settings.faviconUrl || '',
    headerLogoUrl: settings.headerLogoUrl || '',
    headerLogoFit: settings.headerLogoFit || 'contain',
    headerLogoHeight: settings.headerLogoHeight || 38,
    pwaIconUrl: settings.pwaIconUrl || '',
  });

  const [enableOnlinePayment, setEnableOnlinePayment] = useState<boolean>(
    settings.enableOnlinePayment !== false
  );
  const [upiId, setUpiId] = useState(settings.upiId || 'gidhaurbakery@upi');
  const [upiPayeeName, setUpiPayeeName] = useState(settings.upiPayeeName || 'Gidhaur Bakery');

  const [restaurantName] = useState(settings.restaurantName || 'Gidhaur Bakery');
  const [homeScreenMessage] = useState(settings.homeScreenMessage || 'I want to Eat...');
  const [homeHeadlineFont] = useState(settings.homeHeadlineFont || 'Plus Jakarta Sans');
  const [homeHeadlineColor] = useState(settings.homeHeadlineColor || '#0f172a');
  const [homeHeadlineSize] = useState<number>(settings.homeHeadlineSize || 28);
  const [globalTracking] = useState<number>(settings.globalTracking ?? 0.018);
  const [homeCardShape, setHomeCardShape] = useState<'rounded' | 'square'>(
    settings.homeCardShape || 'rounded'
  );
  const [categoryActiveColor] = useState(settings.categoryActiveColor || '#0f172a');
  const [categoryInactiveColor] = useState(settings.categoryInactiveColor || '#64748b');
  const [contactPhone] = useState(settings.contactPhone || '+91 98765 43210');
  const [address] = useState(settings.address || 'Main Road, Gidhaur');
  const [openingHours] = useState(settings.openingHours || '08:00 AM - 10:30 PM (Everyday)');
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(settings.isStoreOpen !== false);
  const [defaultPrepTimeMinutes] = useState<number>(settings.defaultPrepTimeMinutes || 15);
  const [minOrderAmount] = useState<number>(settings.minOrderAmount || 99);

  const [freeDeliveryRadiusKm, setFreeDeliveryRadiusKm] = useState<number>(settings.freeDeliveryRadiusKm || 5);
  const [tier1MaxKm] = useState<number>(settings.tier1MaxKm || 6);
  const [tier1Fee, setTier1Fee] = useState<number>(settings.tier1Fee || 20);
  const [tier2MaxKm] = useState<number>(settings.tier2MaxKm || 8);
  const [tier2Fee, setTier2Fee] = useState<number>(settings.tier2Fee || 20);
  const [beyondTier2PerKmFee] = useState<number>(settings.beyondTier2PerKmFee || 0);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'navbar' | 'browser' | 'google' | 'phone'>('navbar');
  const [previewAmount, setPreviewAmount] = useState('249');

  const headerLogoInputRef = useRef<HTMLInputElement>(null);
  const websiteLogoInputRef = useRef<HTMLInputElement>(null);
  const appIconInputRef = useRef<HTMLInputElement>(null);

  const handleUploadHeaderLogo = async (file: File) => {
    try {
      setIsUploadingLogo('headerLogo');
      setError(null);

      const [res] = await uploadOptimizedImages([file], {
        maxWidth: 1000,
        maxHeight: 400,
        quality: 0.95,
        folder: 'branding',
      });

      if (res?.url) {
        const oldUrl = branding.headerLogoUrl;
        if (oldUrl && (oldUrl.includes('firebasestorage.googleapis.com') || oldUrl.includes('/branding/'))) {
          deleteStorageImage(oldUrl).catch((err) =>
            console.warn('Previous header logo storage cleanup note:', err?.message || err)
          );
        }

        setBranding((prev) => ({
          ...prev,
          headerLogoUrl: res.url,
        }));
        setSuccessMessage('Navbar brand logo uploaded.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload navbar logo: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  const handleRemoveHeaderLogo = async () => {
    const currentUrl = branding.headerLogoUrl;
    if (!currentUrl) return;

    try {
      if (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.includes('/branding/')) {
        await deleteStorageImage(currentUrl);
      }
      setBranding((prev) => ({
        ...prev,
        headerLogoUrl: '',
      }));
      setSuccessMessage('Navbar logo removed.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove navbar logo: ${err?.message || err}`);
    }
  };

  const handleUploadWebsiteLogo = async (file: File) => {
    try {
      setIsUploadingLogo('websiteLogo');
      setError(null);

      const [res] = await uploadOptimizedImages([file], {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.92,
        folder: 'branding',
        cropMode: 'cover',
      });

      if (res?.url) {
        const oldUrls = [branding.faviconUrl, branding.searchLogoUrl].filter(Boolean);
        for (const oldUrl of oldUrls) {
          if (oldUrl && (oldUrl.includes('firebasestorage.googleapis.com') || oldUrl.includes('/branding/'))) {
            deleteStorageImage(oldUrl).catch((err) =>
              console.warn('Previous website logo storage cleanup note:', err?.message || err)
            );
          }
        }

        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            await fetch('/api/update-pwa-icons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64, imageUrl: res.url }),
            }).catch(() => {});
          };
          reader.readAsDataURL(file);
        } catch (_) {}

        setBranding((prev) => ({
          ...prev,
          faviconUrl: res.url,
          searchLogoUrl: res.url,
        }));
        setSuccessMessage('Website & Google Search logo updated.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload website logo: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  const handleRemoveWebsiteLogo = async () => {
    const currentUrl = branding.faviconUrl || branding.searchLogoUrl;
    if (!currentUrl) return;

    try {
      if (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.includes('/branding/')) {
        await deleteStorageImage(currentUrl);
      }
      setBranding((prev) => ({
        ...prev,
        faviconUrl: '',
        searchLogoUrl: '',
      }));
      setSuccessMessage('Website logo removed.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove website logo: ${err?.message || err}`);
    }
  };

  const handleUploadAppIcon = async (file: File) => {
    try {
      setIsUploadingLogo('appIcon');
      setError(null);

      const [res] = await uploadOptimizedImages([file], {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.92,
        folder: 'branding',
        cropMode: 'cover',
      });

      if (res?.url) {
        const oldUrl = branding.pwaIconUrl;
        if (oldUrl && (oldUrl.includes('firebasestorage.googleapis.com') || oldUrl.includes('/branding/'))) {
          deleteStorageImage(oldUrl).catch((err) =>
            console.warn('Previous app icon storage cleanup note:', err?.message || err)
          );
        }

        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            await fetch('/api/update-pwa-icons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64, imageUrl: res.url }),
            }).catch(() => {});
          };
          reader.readAsDataURL(file);
        } catch (_) {}

        setBranding((prev) => ({ ...prev, pwaIconUrl: res.url }));
        setSuccessMessage('Mobile App launcher icon updated.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload app icon: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  const handleRemoveAppIcon = async () => {
    const currentUrl = branding.pwaIconUrl;
    if (!currentUrl) return;

    try {
      if (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.includes('/branding/')) {
        await deleteStorageImage(currentUrl);
      }
      setBranding((prev) => ({ ...prev, pwaIconUrl: '' }));
      setSuccessMessage('Mobile App Icon removed.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove app icon: ${err?.message || err}`);
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = testEmailRecipient.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestEmailFeedback({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }
    if (!senderEmail.trim() || !senderEmailPassword.trim()) {
      setTestEmailFeedback({
        type: 'error',
        text: 'Please enter your Sender Gmail address and Google App Password above first.'
      });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: targetEmail,
          settings: {
            ...settings,
            senderEmail: senderEmail.trim(),
            senderEmailPassword: senderEmailPassword.trim(),
            senderName: senderName.trim() || restaurantName.trim() || 'Gidhaur Bakery',
            fssaiLicenseNumber: fssaiLicenseNumber.trim() || '20426191000010',
            restaurantName: restaurantName.trim() || 'Gidhaur Bakery',
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailFeedback({
          type: 'success',
          text: `Test email sent to ${targetEmail}.`
        });
      } else {
        setTestEmailFeedback({
          type: 'error',
          text: data.message || 'Failed to send test email.'
        });
      }
    } catch (err: any) {
      setTestEmailFeedback({
        type: 'error',
        text: err?.message || 'Network error while contacting email server.'
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleCopyAllEmails = () => {
    if (customerEmailsList.length === 0) return;
    const allEmails = Array.from(new Set(customerEmailsList.map((c) => c.email.trim()))).join(', ');
    navigator.clipboard.writeText(allEmails);
    setCopiedAllEmails(true);
    setTimeout(() => setCopiedAllEmails(false), 3000);
  };

  const handleExportCsv = () => {
    if (customerEmailsList.length === 0) return;
    const headers = 'Name,Email,Phone,Total Orders,Last Order Date\n';
    const rows = customerEmailsList
      .map(
        (c) =>
          `"${(c.name || '').replace(/"/g, '""')}","${c.email}","${c.phone || ''}","${c.totalOrders || 1}","${c.lastOrderDate || ''}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customer_emails_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteCustomerEmail = async (record: CustomerEmailRecord) => {
    try {
      await deleteCustomerEmail(record.id || record.email);
      setCustomerEmailsList((prev) => prev.filter((c) => c.id !== record.id && c.email !== record.email));
      setDeletingEmailRecord(null);
    } catch (err) {
      console.warn('Error deleting customer email:', err);
    }
  };

  const handleClearAllEmails = async () => {
    try {
      await clearAllCustomerEmails();
      setCustomerEmailsList([]);
      setIsClearingAllEmailsConfirm(false);
    } catch (err) {
      console.warn('Error clearing all customer emails:', err);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!upiId.trim() || !upiPayeeName.trim()) {
      setError('UPI ID (VPA) and Business Payee Name are required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const cleanTitle = (branding.websiteTitle && branding.websiteTitle.trim()) || 'Gidhaur Bakery';
      const updated: RestaurantSettings = {
        ...settings,
        ...branding,
        websiteTitle: cleanTitle,
        faviconUrl: branding.faviconUrl || '',
        searchLogoUrl: branding.faviconUrl || '',
        headerLogoUrl: branding.headerLogoUrl || '',
        headerLogoFit: branding.headerLogoFit || 'contain',
        headerLogoHeight: Number(branding.headerLogoHeight) || 38,
        pwaIconUrl: branding.pwaIconUrl || '',
        enableOnlinePayment,
        upiId: upiId.trim(),
        upiPayeeName: upiPayeeName.trim() || 'Gidhaur Bakery',
        restaurantName: restaurantName.trim() || 'Gidhaur Bakery',
        homeScreenMessage: homeScreenMessage.trim() || 'I want to Eat...',
        homeHeadlineFont,
        homeHeadlineColor: homeHeadlineColor.trim() || '#0f172a',
        homeHeadlineSize: Number(homeHeadlineSize) || 28,
        globalTracking: Number(globalTracking) ?? 0.015,
        homeCardShape,
        categoryActiveColor: categoryActiveColor.trim() || '#0f172a',
        categoryInactiveColor: categoryInactiveColor.trim() || '#64748b',
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        openingHours: openingHours.trim(),
        isStoreOpen,
        defaultPrepTimeMinutes: Number(defaultPrepTimeMinutes) || 15,
        minOrderAmount: Number(minOrderAmount) || 99,
        freeDeliveryRadiusKm: Number(freeDeliveryRadiusKm) || 5,
        tier1MaxKm: Number(tier1MaxKm) || 6,
        tier1Fee: Number(tier1Fee) || 20,
        tier2MaxKm: Number(tier2MaxKm) || 8,
        tier2Fee: Number(tier2Fee) || 20,
        beyondTier2PerKmFee: Number(beyondTier2PerKmFee) || 0,
        fssaiLicenseNumber: fssaiLicenseNumber.trim() || '20426191000010',
        isEmailMandatory,
        enableEmailNotifications,
        senderEmail: senderEmail.trim(),
        senderEmailPassword: senderEmailPassword.trim(),
        senderName: senderName.trim() || restaurantName.trim() || 'Gidhaur Bakery',
        emailEventToggles,
      };

      await saveRestaurantSettings(updated);
      try {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        }).catch(() => {});
      } catch {}
      applyWebsiteBrandingToDocument(updated);
      onUpdate(updated);
      setSuccessMessage('All store settings saved.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeUpiId = upiId.trim() || 'gidhaurbakery@upi';
  const activePayeeName = upiPayeeName.trim() || 'Gidhaur Bakery';
  const sampleUpiUri = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(
    activePayeeName
  )}&am=${previewAmount}&tn=Order_Payment&cu=INR`;

  const SECTIONS = [
    {
      id: 'website' as SettingsSection,
      name: 'WEBSITE & LOGOS',
      icon: Globe,
    },
    {
      id: 'payments' as SettingsSection,
      name: 'PAYMENTS & UPI',
      icon: CreditCard,
    },
    {
      id: 'delivery' as SettingsSection,
      name: 'DELIVERY & COVERAGE',
      icon: Truck,
    },
    {
      id: 'emails' as SettingsSection,
      name: 'EMAIL NOTIFICATIONS',
      icon: Mail,
    },
    {
      id: 'security' as SettingsSection,
      name: 'STAFF & SECURITY',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header Bar (LEKHIX Style with breathable spacing) */}
      <div className="pb-4 border-b border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[#FFFFFF]">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-bold uppercase tracking-[0.04em] text-[#FFFFFF] font-['Plus_Jakarta_Sans',sans-serif]">
            SETTINGS
          </h2>
          <span className="px-2 py-0.5 border border-[#FFFFFF] bg-[#0A0A0A] text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.12em]">
            SYSTEM
          </span>
          <span className="text-[11px] font-mono font-medium text-[#A1A1AA] uppercase tracking-[0.14em]">
            STORE CONFIGURATION &amp; PREFERENCES
          </span>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className="px-4 py-2 bg-[#FFFFFF] hover:bg-zinc-200 text-[#0A0A0A] font-mono font-bold text-[11px] uppercase tracking-[0.1em] border border-[#FFFFFF] flex items-center justify-center gap-2 cursor-pointer shrink-0 rounded-none disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'SAVING...' : 'SAVE ALL CHANGES'}</span>
        </button>
      </div>

      {/* LEKHIX Sub-Navigation Filter Pills */}
      <div className="border-b border-[#27272A] pb-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {SECTIONS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`px-3 py-1.5 rounded-none text-[11px] uppercase font-mono tracking-[0.1em] font-bold border cursor-pointer flex items-center gap-2 select-none whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                    : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF] hover:bg-[#242427]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-3 rounded-sm bg-[#18181B] border border-[#10B981]/40 text-xs font-mono text-[#10B981] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-sm bg-[#18181B] border border-[#EF4444]/40 text-xs font-mono text-[#EF4444] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: WEBSITE INFORMATION, LOGOS & STORE STATUS (0ms Persistent Tab) */}
      {/* ========================================================================= */}
      <div className={activeSection === 'website' ? 'block space-y-4' : 'hidden'}>
        {/* Live Store Order Acceptance Status Card */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              STORE ORDER ACCEPTANCE
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm border uppercase tracking-[0.06em] ${
                isStoreOpen
                  ? 'bg-[#0A0A0A] text-[#10B981] border-[#10B981]/40'
                  : 'bg-[#0A0A0A] text-[#F59E0B] border-[#F59E0B]/40'
              }`}
            >
              {isStoreOpen ? 'Accepting Orders' : 'Store Paused'}
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isStoreOpen}
            onClick={() => setIsStoreOpen((prev) => !prev)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
              isStoreOpen ? 'bg-[#10B981] border-[#10B981]' : 'bg-[#0A0A0A] border-[#3F3F46]'
            }`}
            aria-label="Toggle live store order acceptance"
          >
            <span
              className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                isStoreOpen ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 01. Floating Navbar Brand Logo (Wordmark) */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              01. Floating Navbar Brand Logo (Header Wordmark)
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-sm bg-[#0A0A0A] text-[#A1A1AA] border border-[#27272A]">
              WORDMARK
            </span>
          </div>

          {/* Live Interactive Dock Simulation */}
          <div className="p-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2.5">
            <span className="text-[10px] font-mono font-bold text-[#71717A] uppercase tracking-[0.08em] block">
              LIVE PREVIEW:
            </span>

            <div className="rounded-sm bg-[#FFFFFF] border border-[#27272A] px-4 py-2.5 flex items-center justify-between gap-3 max-w-2xl mx-auto overflow-hidden">
              <div className="flex items-center min-w-0 shrink-0">
                {branding.headerLogoUrl ? (
                  <div
                    className="flex items-center justify-start overflow-hidden"
                    style={{ height: `${branding.headerLogoHeight || 38}px` }}
                  >
                    <img
                      src={branding.headerLogoUrl}
                      alt="Navbar Wordmark Logo"
                      loading="lazy"
                      decoding="async"
                      className={`h-full w-auto max-w-[220px] ${
                        branding.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                      style={{ height: `${branding.headerLogoHeight || 38}px` }}
                    />
                  </div>
                ) : (
                  <span className="font-extrabold text-base sm:text-lg text-[#0A0A0A] tracking-tight leading-none select-none">
                    Gidhaur <span className="text-[#71717A]">Bakery</span>
                  </span>
                )}
              </div>

              <div className="hidden sm:flex items-center flex-1 max-w-[200px] rounded-sm bg-neutral-100 border border-neutral-200 px-3 py-1 text-neutral-500 text-xs gap-1.5 select-none font-mono">
                <Search className="w-3.5 h-3.5 text-neutral-400" />
                <span className="truncate">Search...</span>
              </div>

              <div className="flex items-center gap-1.5 select-none shrink-0">
                <span className="px-2.5 py-1 rounded-sm bg-[#0A0A0A] text-[#FFFFFF] text-[10px] font-mono font-bold uppercase tracking-[0.06em]">
                  Menu
                </span>
              </div>
            </div>
          </div>

          {/* Adjustments: Fit vs Fill Mode & Zoom Size Slider */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] block">
                  DISPLAY MODE
                </label>
                <span className="text-[10px] font-mono font-bold text-[#FFFFFF]">
                  {branding.headerLogoFit === 'cover' ? 'FILL' : 'FIT'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBranding((prev) => ({ ...prev, headerLogoFit: 'contain' }))}
                  className={`py-1.5 px-3 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer border ${
                    branding.headerLogoFit !== 'cover'
                      ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                      : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF]'
                  }`}
                >
                  FIT (CONTAIN)
                </button>

                <button
                  type="button"
                  onClick={() => setBranding((prev) => ({ ...prev, headerLogoFit: 'cover' }))}
                  className={`py-1.5 px-3 rounded-sm text-[11px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer border ${
                    branding.headerLogoFit === 'cover'
                      ? 'bg-[#FFFFFF] text-[#0A0A0A] border-[#FFFFFF]'
                      : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:text-[#FFFFFF]'
                  }`}
                >
                  FILL (COVER)
                </button>
              </div>
            </div>

            <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] block">
                  LOGO HEIGHT
                </label>
                <span className="text-[10px] font-mono font-bold text-[#FFFFFF] tabular-nums">
                  {branding.headerLogoHeight || 38}PX
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setBranding((prev) => ({
                      ...prev,
                      headerLogoHeight: Math.max(22, (prev.headerLogoHeight || 38) - 2),
                    }))
                  }
                  className="w-7 h-7 rounded-sm bg-[#18181B] border border-[#27272A] hover:border-[#FFFFFF] flex items-center justify-center text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer shrink-0"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <input
                  type="range"
                  min="22"
                  max="54"
                  step="2"
                  value={branding.headerLogoHeight || 38}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, headerLogoHeight: Number(e.target.value) }))
                  }
                  className="flex-1 accent-[#FF5500] cursor-pointer h-1.5 bg-[#27272A] rounded-sm"
                />

                <button
                  type="button"
                  onClick={() =>
                    setBranding((prev) => ({
                      ...prev,
                      headerLogoHeight: Math.min(54, (prev.headerLogoHeight || 38) + 2),
                    }))
                  }
                  className="w-7 h-7 rounded-sm bg-[#18181B] border border-[#27272A] hover:border-[#FFFFFF] flex items-center justify-center text-[#A1A1AA] hover:text-[#FFFFFF] cursor-pointer shrink-0"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <input
              type="file"
              ref={headerLogoInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadHeaderLogo(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => headerLogoInputRef.current?.click()}
              disabled={isUploadingLogo === 'headerLogo'}
              className="flex-1 py-2 px-4 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] disabled:opacity-40 text-[#FFFFFF] border border-[#27272A] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#FF5500]" />
              <span>
                {isUploadingLogo === 'headerLogo'
                  ? 'UPLOADING...'
                  : branding.headerLogoUrl
                  ? 'REPLACE NAVBAR LOGO'
                  : 'UPLOAD NAVBAR LOGO'}
              </span>
            </button>
            {branding.headerLogoUrl && (
              <button
                type="button"
                onClick={() => handleRemoveHeaderLogo()}
                className="p-2 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#EF4444] border border-[#27272A] cursor-pointer"
                title="Remove Logo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 02 & 03: Website Favicon + Mobile PWA Icon Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 02. Website & Google Search Logo */}
          <div className="rounded-sm bg-[#18181B] border border-[#27272A] p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                  02. Website &amp; Search Logo
                </span>
                <span className="text-[10px] font-mono font-bold uppercase text-[#A1A1AA] bg-[#0A0A0A] px-2 py-0.5 rounded-sm border border-[#27272A]">
                  1:1 SQUARE
                </span>
              </div>

              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center gap-3">
                <div className="w-12 h-12 rounded-sm bg-[#18181B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0 aspect-square">
                  {branding.faviconUrl ? (
                    <img
                      src={branding.faviconUrl}
                      alt="Website Logo"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-[#71717A]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono font-bold text-[#71717A] block uppercase tracking-[0.06em]">
                    STATUS
                  </span>
                  <span className="text-xs font-mono font-bold text-[#FFFFFF] block truncate">
                    {branding.faviconUrl ? 'CUSTOM FAVICON ACTIVE' : 'DEFAULT ICON'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="file"
                ref={websiteLogoInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadWebsiteLogo(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => websiteLogoInputRef.current?.click()}
                disabled={isUploadingLogo === 'websiteLogo'}
                className="flex-1 py-2 px-4 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] disabled:opacity-40 text-[#FFFFFF] border border-[#27272A] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#FF5500]" />
                <span>
                  {isUploadingLogo === 'websiteLogo' ? 'UPLOADING...' : 'UPLOAD WEBSITE LOGO'}
                </span>
              </button>
              {branding.faviconUrl && (
                <button
                  type="button"
                  onClick={() => handleRemoveWebsiteLogo()}
                  className="p-2 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#EF4444] border border-[#27272A] cursor-pointer"
                  title="Remove Logo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 03. Mobile App Icon (PWA) */}
          <div className="rounded-sm bg-[#18181B] border border-[#27272A] p-4 sm:p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                  03. PWA &amp; App Icons
                </span>
                <span className="text-[10px] font-mono font-bold uppercase text-[#A1A1AA] bg-[#0A0A0A] px-2 py-0.5 rounded-sm border border-[#27272A]">
                  6 HD ICONS
                </span>
              </div>

              <div className="p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center gap-3">
                <div className="w-12 h-12 rounded-sm bg-[#18181B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0 aspect-square">
                  <img
                    src={branding.pwaIconUrl || '/icon-192.png?v=3'}
                    alt="PWA Icon"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono font-bold text-[#71717A] block uppercase tracking-[0.06em]">
                    LAUNCHER ICON
                  </span>
                  <span className="text-xs font-mono font-bold text-[#FFFFFF] block truncate">
                    512×512 · 192×192 · iOS
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="file"
                ref={appIconInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAppIcon(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => appIconInputRef.current?.click()}
                disabled={isUploadingLogo === 'appIcon'}
                className="flex-1 py-2 px-4 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] disabled:opacity-40 text-[#FFFFFF] border border-[#27272A] font-mono font-bold text-[11px] uppercase tracking-[0.06em] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#FF5500]" />
                <span>
                  {isUploadingLogo === 'appIcon'
                    ? 'COMPILING...'
                    : 'UPLOAD & SYNC ICONS'}
                </span>
              </button>

              {branding.pwaIconUrl && (
                <button
                  type="button"
                  onClick={() => handleRemoveAppIcon()}
                  className="p-2 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#EF4444] border border-[#27272A] cursor-pointer shrink-0"
                  title="Reset to Default"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 04. Live Visual Simulation & SEO Description */}
        <div className="rounded-sm bg-[#18181B] border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              04. Visual Simulation &amp; SEO Snippet
            </span>

            <div className="inline-flex rounded-sm border border-[#27272A] bg-[#0A0A0A] p-0.5 overflow-x-auto">
              {(['navbar', 'browser', 'google', 'phone'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPreviewTab(tab)}
                  className={`px-3 py-1 rounded-sm text-[10px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer whitespace-nowrap ${
                    previewTab === tab
                      ? 'bg-[#FFFFFF] text-[#0A0A0A]'
                      : 'text-[#A1A1AA] hover:text-[#FFFFFF]'
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {previewTab === 'navbar' && (
            <div className="p-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center">
              <div className="w-full max-w-2xl rounded-sm bg-[#FFFFFF] border border-[#27272A] px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center shrink-0">
                  {branding.headerLogoUrl ? (
                    <div
                      className="flex items-center justify-start overflow-hidden"
                      style={{ height: `${branding.headerLogoHeight || 38}px` }}
                    >
                      <img
                        src={branding.headerLogoUrl}
                        alt="Navbar Logo Preview"
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-auto max-w-[240px] ${
                          branding.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                        }`}
                        style={{ height: `${branding.headerLogoHeight || 38}px` }}
                      />
                    </div>
                  ) : (
                    <span className="font-extrabold text-lg text-[#0A0A0A]">
                      Gidhaur <span className="text-[#71717A]">Bakery</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 select-none shrink-0">
                  <span className="px-3 py-1 rounded-sm bg-[#0A0A0A] text-[#FFFFFF] text-[10px] font-mono font-bold uppercase">
                    Menu
                  </span>
                  <span className="px-3 py-1 rounded-sm bg-neutral-100 text-neutral-800 border border-neutral-200 text-[10px] font-mono font-bold uppercase">
                    Cart (0)
                  </span>
                </div>
              </div>
            </div>
          )}

          {previewTab === 'browser' && (
            <div className="bg-[#0A0A0A] rounded-sm p-2 font-mono select-none border border-[#27272A]">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-t-sm bg-[#18181B] text-[#FFFFFF] text-xs font-medium shrink-0 border-t-2 border-[#FF5500] min-w-[200px]">
                  {branding.faviconUrl ? (
                    <div className="w-4 h-4 rounded-sm overflow-hidden shrink-0">
                      <img src={branding.faviconUrl} alt="Favicon" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-sm bg-[#FFFFFF] text-[#0A0A0A] flex items-center justify-center text-[10px] font-bold shrink-0">
                      G
                    </div>
                  )}
                  <span className="truncate font-bold text-[#FFFFFF]">Gidhaur Bakery</span>
                  <X className="w-3 h-3 text-[#71717A] shrink-0 ml-auto" />
                </div>
              </div>
            </div>
          )}

          {previewTab === 'google' && (
            <div className="bg-[#0A0A0A] rounded-sm p-4 border border-[#27272A] max-w-xl font-sans">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-6 h-6 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                  {branding.faviconUrl ? (
                    <img src={branding.faviconUrl} alt="Search Logo" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-[#FFFFFF]">G</span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#FFFFFF] block leading-tight truncate">
                    Gidhaur Bakery
                  </span>
                </div>
              </div>
              <h5 className="text-[#FF5500] font-bold text-sm leading-snug">
                Gidhaur Bakery
              </h5>
              <div className="text-xs text-[#A1A1AA] mt-1 line-clamp-2">
                {branding.websiteDescription || 'Gidhaur Bakery - Order delicious cakes, bakery delicacies, snacks, and beverages directly.'}
              </div>
            </div>
          )}

          {previewTab === 'phone' && (
            <div className="p-5 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex items-center justify-center text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-sm bg-[#18181B] flex items-center justify-center overflow-hidden border border-[#27272A] aspect-square">
                  {branding.pwaIconUrl || branding.faviconUrl ? (
                    <img
                      src={branding.pwaIconUrl || branding.faviconUrl}
                      alt="PWA Tile"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#FFFFFF] text-[#0A0A0A] flex items-center justify-center font-bold text-lg">
                      GB
                    </div>
                  )}
                </div>
                <span className="text-[#FFFFFF] text-xs font-mono font-bold truncate max-w-[100px]">
                  Gidhaur Bakery
                </span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-[#27272A]">
            <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
              WEBSITE SEO DESCRIPTION (GOOGLE SEARCH SNIPPET)
            </label>
            <textarea
              rows={2}
              value={branding.websiteDescription || ''}
              onChange={(e) => setBranding((prev) => ({ ...prev, websiteDescription: e.target.value }))}
              placeholder="Gidhaur Bakery - Order delicious cakes, bakery delicacies, snacks, and beverages..."
              className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF] resize-none font-sans"
            />
          </div>
        </div>

        {/* 05. Official FSSAI License Number Configuration Card */}
        <div className="p-4 sm:p-5 rounded-sm bg-[#18181B] border border-[#27272A] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              05. Official FSSAI Food Safety License
            </span>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-[#0A0A0A] border border-[#27272A] select-none shrink-0 font-mono">
              <span className="font-black text-xs tracking-tight text-[#A1A1AA] lowercase">
                fssai
              </span>
              <div className="h-3 w-px bg-[#27272A]" />
              <span className="font-bold text-xs text-[#FFFFFF] tabular-nums">
                {fssaiLicenseNumber || '20426191000010'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
              14-DIGIT FSSAI LICENSE NUMBER *
            </label>
            <input
              type="text"
              value={fssaiLicenseNumber}
              onChange={(e) => setFssaiLicenseNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
              placeholder="20426191000010"
              maxLength={14}
              className="w-full max-w-md px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] tracking-[0.06em] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
              id="fssai-license-input"
            />
          </div>
        </div>

        {/* 06. Home Screen Product Card Corner Shape */}
        <div className="p-4 sm:p-5 rounded-sm bg-[#18181B] border border-[#27272A] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#27272A]">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] block">
                06. Home Screen Product Card Shape
              </span>
              <span className="text-[11px] text-[#71717A] font-mono">
                Select card border geometry for storefront catalog cards
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-sm bg-[#0A0A0A] text-[#FFFFFF] border border-[#27272A] shrink-0 self-start sm:self-auto">
              {homeCardShape === 'square' ? 'SQUARE (SHARP 90°)' : 'ROUNDED (CURVED)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Option 1: Rounded */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setHomeCardShape('rounded');
              }}
              className={`p-3.5 rounded-sm border text-left cursor-pointer flex items-start gap-3 relative ${
                homeCardShape === 'rounded'
                  ? 'border-[#FFFFFF] bg-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#0A0A0A]/50 hover:border-[#3F3F46]'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-5 h-5 rounded-md border-2 border-[#FFFFFF]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                    ROUNDED (CURVED)
                  </span>
                  {homeCardShape === 'rounded' && (
                    <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
                  )}
                </div>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">
                  Classic soft rounded corners (24px) with subtle ambient border.
                </p>
              </div>
            </button>

            {/* Option 2: Square */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setHomeCardShape('square');
              }}
              className={`p-3.5 rounded-sm border text-left cursor-pointer flex items-start gap-3 relative ${
                homeCardShape === 'square'
                  ? 'border-[#FFFFFF] bg-[#0A0A0A]'
                  : 'border-[#27272A] bg-[#0A0A0A]/50 hover:border-[#3F3F46]'
              }`}
            >
              <div className="w-10 h-10 rounded-none bg-[#18181B] border border-[#27272A] flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-5 h-5 rounded-none border-2 border-[#FFFFFF]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                    SQUARE (SHARP)
                  </span>
                  {homeCardShape === 'square' && (
                    <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
                  )}
                </div>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">
                  Strict 90° borderless square corners with crisp architectural geometry.
                </p>
              </div>
            </button>
          </div>

          {/* Live Card Mini Simulation */}
          <div className="p-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
            <span className="text-[10px] font-mono font-bold text-[#71717A] uppercase tracking-[0.08em] block">
              LIVE STOREFRONT CARD PREVIEW:
            </span>
            <div className="flex justify-center p-2">
              <div
                className={`bg-[#FFFFFF] p-3 max-w-[210px] w-full ${
                  homeCardShape === 'square'
                    ? 'rounded-none border border-[#27272A]'
                    : 'rounded-2xl border border-[#27272A]'
                }`}
              >
                <div className="w-full aspect-[4/3] rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                  <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-neutral-200 rounded-sm" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-mono font-bold text-[#0A0A0A] tabular-nums">₹349</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#0A0A0A] text-[#FFFFFF] rounded-sm">
                      ADD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: PAYMENTS & UPI (0ms Persistent Tab)                            */}
      {/* ========================================================================= */}
      <div className={activeSection === 'payments' ? 'block space-y-4' : 'hidden'}>
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              01. Payment Collection &amp; UPI QR Setup
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A]">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF] block">
                ENABLE ONLINE UPI PAYMENT AT CHECKOUT
              </span>
              <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-[0.06em] block">
                Customers scan QR or tap intent to pay directly
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enableOnlinePayment}
              onClick={() => setEnableOnlinePayment((prev) => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                enableOnlinePayment ? 'bg-[#FF5500] border-[#FF5500]' : 'bg-[#18181B] border-[#3F3F46]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                  enableOnlinePayment ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
                MERCHANT UPI ID (VPA) *
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. gidhaurbakery@upi"
                className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
                BUSINESS / PAYEE DISPLAY NAME *
              </label>
              <input
                type="text"
                value={upiPayeeName}
                onChange={(e) => setUpiPayeeName(e.target.value)}
                placeholder="Gidhaur Bakery"
                className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
              />
            </div>
          </div>

          <div className="p-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex flex-col sm:flex-row items-center gap-5">
            <div className="p-3 rounded-sm bg-[#FFFFFF] border border-[#27272A] shrink-0">
              <QRCodeSVG
                value={sampleUpiUri}
                size={112}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-2 text-center sm:text-left min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#71717A] uppercase tracking-[0.08em] block">
                LIVE QR CODE VERIFICATION TEST
              </span>
              <h5 className="font-mono font-bold text-sm text-[#FFFFFF]">
                {activePayeeName} ({activeUpiId})
              </h5>

              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 font-mono text-xs">
                <span className="font-bold uppercase tracking-[0.06em] text-[#A1A1AA]">TEST AMOUNT: ₹</span>
                <input
                  type="number"
                  value={previewAmount}
                  onChange={(e) => setPreviewAmount(e.target.value)}
                  className="w-24 px-2.5 py-1 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: DELIVERY & COVERAGE (0ms Persistent Tab)                       */}
      {/* ========================================================================= */}
      <div className={activeSection === 'delivery' ? 'block space-y-4' : 'hidden'}>
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              01. Delivery Range &amp; Distance Tier Charges
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-[#A1A1AA] block">
                01. FREE DELIVERY RADIUS
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={freeDeliveryRadiusKm}
                  onChange={(e) => setFreeDeliveryRadiusKm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
                />
                <span className="text-xs font-mono font-bold text-[#71717A]">KM</span>
              </div>
            </div>

            <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-[#A1A1AA] block">
                02. TIER 1 ({freeDeliveryRadiusKm} TO {tier1MaxKm} KM)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#71717A]">₹</span>
                <input
                  type="number"
                  value={tier1Fee}
                  onChange={(e) => setTier1Fee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-[#A1A1AA] block">
                03. TIER 2 ({tier1MaxKm} TO {tier2MaxKm} KM)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#71717A]">₹</span>
                <input
                  type="number"
                  value={tier2Fee}
                  onChange={(e) => setTier2Fee(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] focus:outline-none focus:border-[#FFFFFF] tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: EMAIL NOTIFICATIONS & CUSTOMER DIRECTORY (0ms Persistent Tab)  */}
      {/* ========================================================================= */}
      <div className={activeSection === 'emails' ? 'block space-y-4' : 'hidden'}>
        {/* Card 1: Sender Gmail & Checkout Rules */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              01. Gmail Sender Configuration &amp; Policy
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A]">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                REAL-TIME ORDER EMAILS
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enableEmailNotifications}
                onClick={() => setEnableEmailNotifications((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                  enableEmailNotifications ? 'bg-[#FF5500] border-[#FF5500]' : 'bg-[#18181B] border-[#3F3F46]'
                }`}
                id="toggle-email-notifications-btn"
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                    enableEmailNotifications ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A]">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                MANDATORY EMAIL AT CHECKOUT
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isEmailMandatory}
                onClick={() => setIsEmailMandatory((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                  isEmailMandatory ? 'bg-[#FF5500] border-[#FF5500]' : 'bg-[#18181B] border-[#3F3F46]'
                }`}
                id="toggle-mandatory-email-btn"
              >
                <span
                  className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                    isEmailMandatory ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
                SENDER GMAIL ADDRESS *
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="yourbakery@gmail.com"
                className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                id="sender-gmail-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
                GOOGLE APP PASSWORD (16 CHARS) *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senderEmailPassword}
                  onChange={(e) => setSenderEmailPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full pl-3 pr-9 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                  id="sender-app-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 text-[#71717A] hover:text-[#FFFFFF] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold text-[#A1A1AA] uppercase tracking-[0.08em] mb-1.5">
                SENDER DISPLAY NAME
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Gidhaur Bakery"
                className="w-full px-3 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-bold text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                id="sender-display-name-input"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              INSTANT LIVE TEST EMAIL
            </span>

            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter recipient email"
                className="w-56 px-3 py-1.5 rounded-sm bg-[#18181B] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
                id="test-email-recipient-input"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail}
                className="px-3.5 py-1.5 rounded-sm bg-[#FF5500] hover:bg-[#E04B00] text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] border border-[#FF5500] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                id="send-test-email-btn"
              >
                {isSendingTestEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSendingTestEmail ? 'SENDING...' : 'SEND TEST'}</span>
              </button>
            </div>
          </div>

          {testEmailFeedback && (
            <div
              className={`p-3 rounded-sm border text-xs font-mono flex items-center gap-2 ${
                testEmailFeedback.type === 'success'
                  ? 'bg-[#0A0A0A] text-[#10B981] border-[#10B981]/40'
                  : 'bg-[#0A0A0A] border-[#EF4444]/40 text-[#EF4444]'
              }`}
            >
              {testEmailFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
              )}
              <span>{testEmailFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Card 2: Notification Events Control */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              02. Notification Milestone Triggers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { key: 'notifyOrderPlaced', label: '01. ORDER PLACED (RECEIPT)' },
              { key: 'notifyOrderConfirmed', label: '02. ORDER CONFIRMED BY STORE' },
              { key: 'notifyKitchenSent', label: '03. ORDER IN PREPARATION' },
              { key: 'notifyOutForDelivery', label: '04. OUT FOR DELIVERY' },
              { key: 'notifyDelivered', label: '05. ORDER DELIVERED' },
              { key: 'notifyCancellationAccepted', label: '06. CANCELLATION ACCEPTED' },
              { key: 'notifyCancellationDeclined', label: '07. CANCELLATION DECLINED' },
            ].map((item) => {
              const isOn = (emailEventToggles as any)[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-sm bg-[#0A0A0A] border border-[#27272A]"
                >
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.06em] pr-2 text-[#FFFFFF]">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    onClick={() =>
                      setEmailEventToggles((prev) => ({
                        ...prev,
                        [item.key]: !(prev as any)[item.key],
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                      isOn ? 'bg-[#FF5500] border-[#FF5500]' : 'bg-[#18181B] border-[#3F3F46]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                        isOn ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Customer Email Audience Directory */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
                03. Customer Email Directory
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#0A0A0A] text-[#A1A1AA] px-2 py-0.5 rounded-sm border border-[#27272A] tabular-nums">
                {customerEmailsList.length} CONTACTS
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap font-mono">
              <button
                type="button"
                onClick={handleCopyAllEmails}
                disabled={customerEmailsList.length === 0}
                className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-bold text-[10px] uppercase tracking-[0.06em] border border-[#27272A] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                id="copy-all-customer-emails-btn"
              >
                {copiedAllEmails ? (
                  <Check className="w-3 h-3 text-[#10B981]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedAllEmails ? 'COPIED' : 'COPY ALL'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={customerEmailsList.length === 0}
                className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-bold text-[10px] uppercase tracking-[0.06em] border border-[#27272A] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                id="export-customer-emails-csv-btn"
              >
                <Download className="w-3 h-3" />
                <span>EXPORT CSV</span>
              </button>

              {customerEmailsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearingAllEmailsConfirm(true)}
                  className="px-3 py-1.5 rounded-sm bg-[#0A0A0A] hover:bg-[#242427] text-[#EF4444] font-bold text-[10px] uppercase tracking-[0.06em] border border-[#EF4444]/40 flex items-center gap-1.5 cursor-pointer"
                  id="clear-all-customer-emails-btn"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>CLEAR ALL</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={emailSearchQuery}
              onChange={(e) => setEmailSearchQuery(e.target.value)}
              placeholder="Filter by customer name, email, or phone..."
              className="w-full pl-9 pr-4 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] text-xs font-mono text-[#FFFFFF] placeholder:text-[#71717A] focus:outline-none focus:border-[#FFFFFF]"
              id="search-customer-emails-input"
            />
          </div>

          {customerEmailsList.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-sm bg-[#0A0A0A] border border-[#27272A] space-y-2">
              <div className="w-8 h-8 rounded-sm bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#71717A] mx-auto">
                <Mail className="w-4 h-4" />
              </div>
              <h4 className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#71717A]">
                NO CUSTOMER EMAILS YET
              </h4>
            </div>
          ) : (
            <div className="divide-y divide-[#27272A] rounded-sm border border-[#27272A] overflow-hidden">
              {customerEmailsList
                .filter((record) => {
                  const q = emailSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    record.email.toLowerCase().includes(q) ||
                    (record.name && record.name.toLowerCase().includes(q)) ||
                    (record.phone && record.phone.includes(q))
                  );
                })
                .map((record) => (
                  <div
                    key={record.id || record.email}
                    className="p-3 bg-[#0A0A0A] hover:bg-[#242427] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-sm bg-[#18181B] text-[#FFFFFF] border border-[#27272A] font-mono font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                        {(record.name || record.email)[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-[#FFFFFF] truncate">
                            {record.name || 'Customer'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#18181B] px-1.5 py-0.5 rounded-sm border border-[#27272A] tabular-nums">
                            {record.totalOrders || 1} ORDERS
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-[#A1A1AA] flex-wrap">
                          <a
                            href={`mailto:${record.email}`}
                            className="text-[#FFFFFF] hover:underline font-semibold"
                          >
                            {record.email}
                          </a>
                          {record.phone && (
                            <>
                              <span>·</span>
                              <span>{record.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <a
                        href={`mailto:${record.email}?subject=${encodeURIComponent(`Special Offer from ${restaurantName || 'Gidhaur Bakery'}`)}`}
                        className="px-2.5 py-1 rounded-sm bg-[#18181B] hover:bg-[#242427] text-[#FFFFFF] text-[10px] font-mono font-bold uppercase tracking-[0.06em] border border-[#27272A]"
                      >
                        EMAIL
                      </a>
                      <button
                        type="button"
                        onClick={() => setDeletingEmailRecord(record)}
                        className="p-1 rounded-sm text-[#71717A] hover:text-[#EF4444] hover:bg-[#18181B] cursor-pointer"
                        title="Delete customer from directory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: STAFF & SECURITY (0ms Persistent Tab)                          */}
      {/* ========================================================================= */}
      <div className={activeSection === 'security' ? 'block space-y-4' : 'hidden'}>
        <AdminAccountsManagement />

        {/* Database & Daily Quota Safeguards Card */}
        <div className="bg-[#18181B] rounded-sm border border-[#27272A] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.06em] text-[#FFFFFF]">
              Daily Limit &amp; WhatsApp Fallback
            </span>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase border ${
                quotaExhaustedActive
                  ? 'bg-[#0A0A0A] text-[#F59E0B] border-[#F59E0B]/40'
                  : 'bg-[#0A0A0A] text-[#10B981] border-[#10B981]/40'
              }`}
            >
              {quotaExhaustedActive ? 'LIMIT FULL (WHATSAPP ACTIVE)' : 'NORMAL BOOKING ACTIVE'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-sm bg-[#0A0A0A] border border-[#27272A]">
            <span className="font-mono font-bold text-xs uppercase tracking-[0.06em] text-[#FFFFFF]">
              SIMULATE DAILY LIMIT FULL (TEST WHATSAPP FALLBACK)
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={quotaTestActive}
              onClick={() => {
                triggerHaptic('selection');
                const nextVal = !quotaTestActive;
                setQuotaTestMode(nextVal);
                setQuotaTestActive(nextVal);
                setQuotaExhaustedActive(isQuotaExhausted());
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-sm border p-0.5 focus:outline-none ${
                quotaTestActive ? 'bg-[#FF5500] border-[#FF5500]' : 'bg-[#18181B] border-[#3F3F46]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-sm bg-[#FFFFFF] ${
                  quotaTestActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <span className="text-xs font-mono text-[#A1A1AA]">
              FALLBACK WHATSAPP:{' '}
              <strong className="text-[#FFFFFF]">
                {contactPhone || '+91 98765 43210'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                resetQuotaStatus();
                setQuotaTestActive(false);
                setQuotaExhaustedActive(false);
                setQuotaResetToast('✓ Daily quota status reset to normal.');
                setTimeout(() => setQuotaResetToast(null), 3000);
              }}
              className="px-3.5 py-1.5 rounded-sm border border-[#27272A] bg-[#0A0A0A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] text-[11px] font-mono font-bold uppercase tracking-[0.06em] cursor-pointer"
            >
              RESET QUOTA STATUS
            </button>
          </div>

          {quotaResetToast && (
            <div className="text-xs font-mono font-bold text-[#10B981]">{quotaResetToast}</div>
          )}
        </div>
      </div>

      {/* MODAL 1: Delete Single Customer Email Confirmation */}
      {deletingEmailRecord && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
                CONFIRM REMOVAL
              </span>
              <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
                REMOVE {deletingEmailRecord.email}?
              </h3>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmailRecord(null)}
                className="flex-1 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomerEmail(deletingEmailRecord)}
                className="flex-1 py-2 rounded-sm bg-[#EF4444] hover:bg-[#DC2626] text-[#FFFFFF] border border-[#EF4444] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                id="confirm-delete-customer-email-btn"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Clear All Customer Emails Confirmation */}
      {isClearingAllEmailsConfirm && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A]/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] rounded-sm border border-[#27272A] max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-[#71717A] block">
                CONFIRM CLEAR ALL
              </span>
              <h3 className="font-bold text-sm uppercase tracking-[0.06em] text-[#FFFFFF]">
                CLEAR ALL {customerEmailsList.length} CUSTOMER EMAILS?
              </h3>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearingAllEmailsConfirm(false)}
                className="flex-1 py-2 rounded-sm bg-[#0A0A0A] border border-[#27272A] hover:bg-[#242427] text-[#A1A1AA] hover:text-[#FFFFFF] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleClearAllEmails}
                className="flex-1 py-2 rounded-sm bg-[#EF4444] hover:bg-[#DC2626] text-[#FFFFFF] border border-[#EF4444] font-mono font-bold text-[11px] uppercase tracking-[0.06em] cursor-pointer"
                id="confirm-clear-all-customer-emails-btn"
              >
                CLEAR ALL ({customerEmailsList.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PaymentSettings.displayName = 'PaymentSettings';
