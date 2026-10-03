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
  Smartphone,
  Laptop,
  Store,
  Sliders,
  Check,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Users,
  Send,
  AlertTriangle,
  Download,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RestaurantSettings, WebsiteBrandingSettings, CustomerEmailRecord } from '../../types';
import { saveRestaurantSettings } from '../../services/staffService';
import { uploadOptimizedImages, deleteStorageImage } from '../../services/storageService';
import { applyWebsiteBrandingToDocument } from '../../utils/branding';
import { AVAILABLE_FONTS } from '../../utils/fontList';
import { AdminAccountsManagement } from './AdminAccountsManagement';
import {
  subscribeToCustomerEmails,
  deleteCustomerEmail,
  clearAllCustomerEmails
} from '../../services/customerEmailService';

interface PaymentSettingsProps {
  settings: RestaurantSettings;
  onUpdate: (settings: RestaurantSettings) => void;
}

type SettingsSection = 'website' | 'store' | 'payments' | 'delivery' | 'emails' | 'security';

export const PaymentSettings: React.FC<PaymentSettingsProps> = ({ settings, onUpdate }) => {
  // Active Sub-Navigation Tab
  const [activeSection, setActiveSection] = useState<SettingsSection>('website');

  // FSSAI State
  const [fssaiLicenseNumber, setFssaiLicenseNumber] = useState(
    settings.fssaiLicenseNumber || '20426191000010'
  );

  // Email Settings State
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

  // Granular Notification Event Toggles State
  const [emailEventToggles, setEmailEventToggles] = useState({
    notifyOrderPlaced: settings.emailEventToggles?.notifyOrderPlaced === true,
    notifyOrderConfirmed: settings.emailEventToggles?.notifyOrderConfirmed !== false,
    notifyKitchenSent: settings.emailEventToggles?.notifyKitchenSent === true,
    notifyOutForDelivery: settings.emailEventToggles?.notifyOutForDelivery !== false,
    notifyDelivered: settings.emailEventToggles?.notifyDelivered !== false,
    notifyCancellationAccepted: settings.emailEventToggles?.notifyCancellationAccepted !== false,
    notifyCancellationDeclined: settings.emailEventToggles?.notifyCancellationDeclined !== false,
  });

  // Test email state
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Customer Emails Directory State
  const [customerEmailsList, setCustomerEmailsList] = useState<CustomerEmailRecord[]>([]);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [copiedAllEmails, setCopiedAllEmails] = useState(false);
  const [deletingEmailRecord, setDeletingEmailRecord] = useState<CustomerEmailRecord | null>(null);
  const [isClearingAllEmailsConfirm, setIsClearingAllEmailsConfirm] = useState(false);

  // Subscribe to live customer emails list
  useEffect(() => {
    const unsubscribe = subscribeToCustomerEmails((records) => {
      setCustomerEmailsList(records);
    });
    return () => unsubscribe();
  }, []);

  // Website Information & Logos State
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

  // Payments State
  const [enableOnlinePayment, setEnableOnlinePayment] = useState<boolean>(
    settings.enableOnlinePayment !== false
  );
  const [upiId, setUpiId] = useState(settings.upiId || 'gidhaurbakery@upi');
  const [upiPayeeName, setUpiPayeeName] = useState(settings.upiPayeeName || 'Gidhaur Bakery');

  // Store Profile State
  const [restaurantName, setRestaurantName] = useState(settings.restaurantName || 'Gidhaur Bakery');
  const [homeScreenMessage, setHomeScreenMessage] = useState(settings.homeScreenMessage || 'I want to Eat...');
  const [homeHeadlineFont, setHomeHeadlineFont] = useState(settings.homeHeadlineFont || 'Plus Jakarta Sans');
  const [homeHeadlineColor, setHomeHeadlineColor] = useState(settings.homeHeadlineColor || '#0f172a');
  const [homeHeadlineSize, setHomeHeadlineSize] = useState<number>(settings.homeHeadlineSize || 28);
  const [globalTracking, setGlobalTracking] = useState<number>(settings.globalTracking ?? 0.018);
  const [categoryActiveColor, setCategoryActiveColor] = useState(settings.categoryActiveColor || '#0f172a');
  const [categoryInactiveColor, setCategoryInactiveColor] = useState(settings.categoryInactiveColor || '#64748b');

  // Real-time dynamic CSS variable updates directly on :root (zero re-render overhead)
  const handleTrackingChange = (val: number) => {
    setGlobalTracking(val);
    document.documentElement.style.setProperty('--app-tracking', `${val}em`);
  };

  const handleHeadlineSizeChange = (val: number) => {
    setHomeHeadlineSize(val);
    document.documentElement.style.setProperty('--home-headline-size', `${val}px`);
  };

  const handleHeadlineColorChange = (val: string) => {
    setHomeHeadlineColor(val);
    document.documentElement.style.setProperty('--home-headline-color', val);
  };

  const handleHeadlineFontChange = (val: string) => {
    setHomeHeadlineFont(val);
    const matched = AVAILABLE_FONTS.find((f) => f.id === val);
    const family = matched ? matched.fontFamily : val;
    document.documentElement.style.setProperty('--home-headline-font', family);
  };

  const handleActiveCategoryColorChange = (val: string) => {
    setCategoryActiveColor(val);
    document.documentElement.style.setProperty('--category-active-color', val);
  };

  const handleInactiveCategoryColorChange = (val: string) => {
    setCategoryInactiveColor(val);
    document.documentElement.style.setProperty('--category-inactive-color', val);
  };
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '+91 98765 43210');
  const [address, setAddress] = useState(settings.address || 'Main Road, Gidhaur');
  const [openingHours, setOpeningHours] = useState(settings.openingHours || '08:00 AM - 10:30 PM (Everyday)');
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(settings.isStoreOpen !== false);
  const [defaultPrepTimeMinutes, setDefaultPrepTimeMinutes] = useState<number>(settings.defaultPrepTimeMinutes || 15);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(settings.minOrderAmount || 99);

  // Delivery & Coverage State
  const [freeDeliveryRadiusKm, setFreeDeliveryRadiusKm] = useState<number>(settings.freeDeliveryRadiusKm || 5);
  const [tier1MaxKm, setTier1MaxKm] = useState<number>(settings.tier1MaxKm || 6);
  const [tier1Fee, setTier1Fee] = useState<number>(settings.tier1Fee || 20);
  const [tier2MaxKm, setTier2MaxKm] = useState<number>(settings.tier2MaxKm || 8);
  const [tier2Fee, setTier2Fee] = useState<number>(settings.tier2Fee || 20);
  const [beyondTier2PerKmFee, setBeyondTier2PerKmFee] = useState<number>(settings.beyondTier2PerKmFee || 0);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'navbar' | 'browser' | 'google' | 'phone'>('navbar');

  // UPI test state
  const [previewAmount, setPreviewAmount] = useState('249');

  // Dedicated file input refs for logos
  const headerLogoInputRef = useRef<HTMLInputElement>(null);
  const websiteLogoInputRef = useRef<HTMLInputElement>(null);
  const appIconInputRef = useRef<HTMLInputElement>(null);

  // LOGO 1: Upload Floating Navbar Brand Logo (Header Wordmark)
  const handleUploadHeaderLogo = async (file: File) => {
    try {
      setIsUploadingLogo('headerLogo');
      setError(null);

      // Keep original aspect ratio for wordmark (contain/cover selectable)
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
        setSuccessMessage('Floating Navbar brand logo uploaded! Use the Fit/Fill & Zoom controls to tune it.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload navbar logo: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  // LOGO 1: Remove Floating Navbar Brand Logo
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
      setSuccessMessage('Navbar logo removed. Floating dock will show default "Gidhaur Bakery" text.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove navbar logo: ${err?.message || err}`);
    }
  };

  // LOGO 2: Upload Website & Search Logo (Favicon + Google Search Snippet)
  const handleUploadWebsiteLogo = async (file: File) => {
    try {
      setIsUploadingLogo('websiteLogo');
      setError(null);

      const [res] = await uploadOptimizedImages([file], {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.92,
        folder: 'branding',
        cropMode: 'cover', // STRICT FILL: 100% edge-to-edge square canvas fill without letterboxing
      });

      if (res?.url) {
        // Delete previous image from Firebase Storage to save storage
        const oldUrls = [branding.faviconUrl, branding.searchLogoUrl].filter(Boolean);
        for (const oldUrl of oldUrls) {
          if (oldUrl && (oldUrl.includes('firebasestorage.googleapis.com') || oldUrl.includes('/branding/'))) {
            deleteStorageImage(oldUrl).catch((err) =>
              console.warn('Previous website logo storage cleanup note:', err?.message || err)
            );
          }
        }

        // Sync to server PWA icon files
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
        setSuccessMessage('Website & Google Search logo updated successfully in Fill mode!');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload website logo: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  // LOGO 2: Remove Website & Search Logo
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
      setSuccessMessage('Website & Google Search logo removed and storage freed.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove website logo: ${err?.message || err}`);
    }
  };

  // LOGO 3: Upload Mobile App Icon (Add to Home Screen)
  const handleUploadAppIcon = async (file: File) => {
    try {
      setIsUploadingLogo('appIcon');
      setError(null);

      const [res] = await uploadOptimizedImages([file], {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.92,
        folder: 'branding',
        cropMode: 'cover', // STRICT FILL: 100% edge-to-edge square canvas fill without letterboxing
      });

      if (res?.url) {
        const oldUrl = branding.pwaIconUrl;
        if (oldUrl && (oldUrl.includes('firebasestorage.googleapis.com') || oldUrl.includes('/branding/'))) {
          deleteStorageImage(oldUrl).catch((err) =>
            console.warn('Previous app icon storage cleanup note:', err?.message || err)
          );
        }

        // Sync to server PWA icon files
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
        setSuccessMessage('Mobile App launcher icon updated successfully in Fill mode!');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      setError(`Failed to upload app icon: ${err?.message || err}`);
    } finally {
      setIsUploadingLogo(null);
    }
  };

  // LOGO 3: Remove Mobile App Icon
  const handleRemoveAppIcon = async () => {
    const currentUrl = branding.pwaIconUrl;
    if (!currentUrl) return;

    try {
      if (currentUrl.includes('firebasestorage.googleapis.com') || currentUrl.includes('/branding/')) {
        await deleteStorageImage(currentUrl);
      }
      setBranding((prev) => ({ ...prev, pwaIconUrl: '' }));
      setSuccessMessage('Mobile App Icon removed and storage freed.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(`Failed to remove app icon: ${err?.message || err}`);
    }
  };

  // Email handlers
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
          text: `Success! Test email sent to ${targetEmail}. Check your inbox (and spam folder).`
        });
      } else {
        setTestEmailFeedback({
          type: 'error',
          text: data.message || 'Failed to send test email. Please check your Gmail credentials and App Password.'
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
      setSuccessMessage('All store settings saved successfully!');
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
      name: 'Website & Logos',
      shortName: 'Website & Logos',
      icon: Globe,
    },
    {
      id: 'store' as SettingsSection,
      name: 'Store Profile',
      shortName: 'Store Profile',
      icon: Store,
    },
    {
      id: 'payments' as SettingsSection,
      name: 'Payments & UPI',
      shortName: 'Payments & UPI',
      icon: CreditCard,
    },
    {
      id: 'delivery' as SettingsSection,
      name: 'Delivery & Coverage',
      shortName: 'Delivery & Coverage',
      icon: Truck,
    },
    {
      id: 'emails' as SettingsSection,
      name: 'Email Notifications',
      shortName: 'Email Notifications',
      icon: Mail,
    },
    {
      id: 'security' as SettingsSection,
      name: 'Staff & Security',
      shortName: 'Staff & Security',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Card - Clean & Modern matching Admin style */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0 font-bold">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
              Store & System Settings
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage website identity, brand logos, UPI payments, store hours, and delivery coverage.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSave()}
          disabled={isSaving}
          className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl sm:rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* Sub-Navigation Switcher Bar - Pristine Single-Row Capsule Dock (Icon + Title Only) */}
      <div className="bg-slate-100/90 rounded-full p-1.5 border border-slate-200/80 shadow-2xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
          {SECTIONS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full transition-all cursor-pointer select-none whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-transparent hover:bg-white/80 text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-600 border border-slate-200/80 shadow-2xs'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold">
                  {tab.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Feedback */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200/90 rounded-2xl text-xs text-rose-700 flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: WEBSITE INFORMATION & LOGOS */}
      {/* ========================================================================= */}
      {activeSection === 'website' && (
        <div className="space-y-6 animate-fadeIn">
          {/* FEATURED: Floating Navbar Brand Logo (Wordmark) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:border-amber-300/80 transition-colors p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-extrabold text-sm shadow-2xs shrink-0">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-heading font-bold text-base text-slate-900">
                      Floating Navbar Brand Logo (Header Wordmark)
                    </h4>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                      Floating Dock · Wordmark
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    This logo appears on the customer website's floating top bar, directly replacing the text "Gidhaur Bakery".
                  </p>
                </div>
              </div>
            </div>

            {/* Live Interactive Dock Capsule Preview */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Floating Dock Live Simulation:
              </span>

              <div className="bg-white rounded-full border border-slate-200/90 shadow-md px-4 py-2.5 flex items-center justify-between gap-3 max-w-2xl mx-auto overflow-hidden">
                {/* Logo Area */}
                <div className="flex items-center min-w-0 shrink-0">
                  {branding.headerLogoUrl ? (
                    <div
                      className="flex items-center justify-start overflow-hidden rounded-md transition-all"
                      style={{ height: `${branding.headerLogoHeight || 38}px` }}
                    >
                      <img
                        src={branding.headerLogoUrl}
                        alt="Navbar Wordmark Logo"
                        className={`h-full w-auto max-w-[220px] transition-all ${
                          branding.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                        }`}
                        style={{ height: `${branding.headerLogoHeight || 38}px` }}
                      />
                    </div>
                  ) : (
                    <span className="font-heading font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none select-none">
                      Gidhaur <span className="text-amber-600">Bakery</span>
                    </span>
                  )}
                </div>

                {/* Mock Search Bar */}
                <div className="hidden sm:flex items-center flex-1 max-w-[200px] bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-slate-400 text-xs gap-1.5 select-none">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">Search sweets...</span>
                </div>

                {/* Mock Pill Buttons */}
                <div className="flex items-center gap-1.5 select-none shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold">
                    Menu
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold hidden sm:inline-block">
                    Cart
                  </span>
                </div>
              </div>
            </div>

            {/* Adjustments: Fit vs Fill Mode & Zoom Size Slider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Option 1: Fit vs Fill Mode */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Display Mode: Fit vs Fill
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70">
                    {branding.headerLogoFit === 'cover' ? 'Fill (Cover)' : 'Fit (Contain - Recommended)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBranding((prev) => ({ ...prev, headerLogoFit: 'contain' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      branding.headerLogoFit !== 'cover'
                        ? 'bg-white text-slate-900 border-amber-400 shadow-2xs ring-1 ring-amber-500/25'
                        : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <span>Fit (Contain)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBranding((prev) => ({ ...prev, headerLogoFit: 'cover' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      branding.headerLogoFit === 'cover'
                        ? 'bg-white text-slate-900 border-amber-400 shadow-2xs ring-1 ring-amber-500/25'
                        : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <span>Fill (Cover)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  {branding.headerLogoFit === 'cover'
                    ? 'Fill stretches/crops image to fill height edge-to-edge.'
                    : 'Fit shows the complete typography wordmark without cutting off any curves.'}
                </p>
              </div>

              {/* Option 2: Zoom / Height Size Slider */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Logo Zoom / Height Size
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70">
                    {branding.headerLogoHeight || 38}px Height
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
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shadow-2xs shrink-0"
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
                    className="flex-1 accent-amber-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setBranding((prev) => ({
                        ...prev,
                        headerLogoHeight: Math.min(54, (prev.headerLogoHeight || 38) + 2),
                      }))
                    }
                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shadow-2xs shrink-0"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Slide or click (+)/(-) to adjust size so your wordmark looks perfectly balanced in the header.
                </p>
              </div>
            </div>

            {/* Upload & Remove Controls */}
            <div className="pt-2 flex items-center gap-2">
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
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:bg-amber-900 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-100" />
                <span>
                  {isUploadingLogo === 'headerLogo'
                    ? 'Uploading Wordmark...'
                    : branding.headerLogoUrl
                    ? 'Replace Floating Navbar Logo'
                    : 'Upload Floating Navbar Brand Logo'}
                </span>
              </button>
              {branding.headerLogoUrl && (
                <button
                  type="button"
                  onClick={() => handleRemoveHeaderLogo()}
                  className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  title="Remove Logo & Restore Brand Text"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* TWO ADDITIONAL LOGO UPLOAD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 2. Website & Google Search Logo */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:border-amber-300/80 transition-colors p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-extrabold text-xs shadow-2xs">
                      2
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-sm text-slate-900">
                        Website & Google Search Logo
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Browser Tab Favicon & Google Search Snippet
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                    Square 1:1 · Strict Fill
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-normal mb-3 font-medium">
                  Displayed as the browser tab favicon and left-side brand icon in Google Search results.
                </p>

                {/* Preview Box - STRICT FILL / COVER (object-cover, edge-to-edge fill) */}
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0 relative">
                    {branding.faviconUrl ? (
                      <img
                        src={branding.faviconUrl}
                        alt="Website Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-1">
                        <Globe className="w-5 h-5 text-amber-500 mx-auto" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 block">
                          Default
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-amber-900/80 block uppercase tracking-wider">
                      Current Logo
                    </span>
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {branding.faviconUrl ? 'Custom Logo Active (Edge-to-Edge Fill)' : 'Default Site Icon'}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Automatically cropped to 1:1 square fill on upload
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload & Remove Controls */}
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
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:bg-amber-900 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-100" />
                  <span>
                    {isUploadingLogo === 'websiteLogo' ? 'Uploading (Fill Mode)...' : 'Upload Website Logo'}
                  </span>
                </button>
                {branding.faviconUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveWebsiteLogo()}
                    className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                    title="Remove Logo & Free Storage"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. PWA & MOBILE APP ICONS STUDIO (HD MULTI-RESOLUTION AUTO-GENERATOR) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:border-amber-300/80 transition-colors p-5 space-y-4 flex flex-col justify-between md:col-span-2">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                      3
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-extrabold text-base text-slate-900">
                          Master PWA & Mobile App Store Icon (HD Auto-Generator)
                        </h4>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                          Multi-Resolution Sync Engine
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                        One upload automatically compiles all 6 exact HD icon files for Android APK, PWABuilder, iOS & Google Play.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Requirements Subtitle Checklist Box */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 mb-4 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 font-black text-[10px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-800 block text-[11px]">Recommended Size:</strong>
                      <span className="text-[10px] text-slate-500 font-medium">512×512 px or 1024×1024 px Square 1:1</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 font-black text-[10px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-800 block text-[11px]">Formats Supported:</strong>
                      <span className="text-[10px] text-slate-500 font-medium">PNG (Solid / Transparent), WebP, JPG, SVG</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 font-black text-[10px] flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-800 block text-[11px]">Auto-Compiled Files:</strong>
                      <span className="text-[10px] text-slate-500 font-medium">512px, 192px, 180px iOS, Adaptive Maskable</span>
                    </div>
                  </div>
                </div>

                {/* Multi-Device Live Interactive Preview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Variant 1: Android Adaptive Squircle */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Android Launcher
                    </span>
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center overflow-hidden relative group">
                      <img
                        src={branding.pwaIconUrl || '/icon-192.png'}
                        alt="Android Icon"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500">
                      Adaptive Squircle
                    </span>
                  </div>

                  {/* Variant 2: iOS Continuous Rounded Tile */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      iPhone / iPad
                    </span>
                    <div className="w-14 h-14 rounded-[18px] bg-white border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={branding.pwaIconUrl || '/apple-touch-icon.png'}
                        alt="iOS Icon"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500">
                      180×180 iOS Tile
                    </span>
                  </div>

                  {/* Variant 3: Google Play Store Master */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Google Play Store
                    </span>
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={branding.pwaIconUrl || '/icon-512.png'}
                        alt="Master 512 Icon"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500">
                      512×512 HD Master
                    </span>
                  </div>

                  {/* Variant 4: Browser Tab Favicon */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center text-center space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Browser Tab Favicon
                    </span>
                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-xs overflow-hidden shadow-2xs">
                        <img
                          src={branding.faviconUrl || branding.pwaIconUrl || '/icon-192.png'}
                          alt="Favicon"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500">
                      Tab Icon
                    </span>
                  </div>
                </div>

                {/* Generated Files Verified Badges */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Compiled Files:
                  </span>
                  {['icon-512.png', 'pwa-512x512.png', 'icon-192.png', 'pwa-192x192.png', 'icon-maskable-512.png', 'apple-touch-icon.png'].map((f) => (
                    <span key={f} className="text-[9px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200/70">
                      ✓ {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Upload & Actions Control Bar */}
              <div className="pt-3 flex flex-col sm:flex-row items-center gap-2.5">
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
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 active:bg-amber-950 disabled:bg-slate-300 text-white font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-md shadow-amber-600/25 transition-all active:scale-95 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-100" />
                  <span>
                    {isUploadingLogo === 'appIcon'
                      ? 'Compiling & Generating 6 HD App Icons...'
                      : 'Upload & Auto-Generate All 6 HD Icons'}
                  </span>
                </button>

                {branding.pwaIconUrl && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAppIcon()}
                    className="py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Reset to Default"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Live Previews - Refined Artisanal Theme */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-heading font-extrabold text-base text-slate-900">
                  Live Visual Simulation & Previews
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Real-time preview across floating navbar, browser tabs, Google search, and mobile screens.
                </p>
              </div>

              {/* Segmented Preview Mode Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setPreviewTab('navbar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    previewTab === 'navbar'
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Floating Navbar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('browser')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    previewTab === 'browser'
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5 text-amber-600" />
                  <span>Browser Tab</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('google')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    previewTab === 'google'
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-amber-600" />
                  <span>Google Result</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('phone')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    previewTab === 'phone'
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                  <span>Mobile App Tile</span>
                </button>
              </div>
            </div>

            {/* PREVIEW 0: Floating Navbar Dock Simulation */}
            {previewTab === 'navbar' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Customer Website Floating Navbar (Live View):
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Mode: <strong className="text-slate-800">{branding.headerLogoFit === 'cover' ? 'Fill' : 'Fit'}</strong> · Height: <strong className="text-slate-800">{branding.headerLogoHeight || 38}px</strong>
                  </span>
                </div>

                <div className="p-6 bg-gradient-to-br from-slate-100 via-amber-50/20 to-slate-200/70 rounded-3xl border border-slate-200 flex items-center justify-center">
                  <div className="w-full max-w-3xl bg-white rounded-full border border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.06)] px-4 py-2 sm:px-6 sm:py-3 flex items-center justify-between gap-4 transition-all">
                    {/* Brand Logo in Floating Dock */}
                    <div className="flex items-center shrink-0">
                      {branding.headerLogoUrl ? (
                        <div
                          className="flex items-center justify-start overflow-hidden rounded-lg transition-all"
                          style={{ height: `${branding.headerLogoHeight || 38}px` }}
                        >
                          <img
                            src={branding.headerLogoUrl}
                            alt="Navbar Logo Preview"
                            className={`h-full w-auto max-w-[240px] transition-all ${
                              branding.headerLogoFit === 'cover' ? 'object-cover' : 'object-contain'
                            }`}
                            style={{ height: `${branding.headerLogoHeight || 38}px` }}
                          />
                        </div>
                      ) : (
                        <span className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight block leading-none select-none">
                          Gidhaur <span className="text-amber-600">Bakery</span>
                        </span>
                      )}
                    </div>

                    {/* Mock Search Bar */}
                    <div className="hidden sm:flex items-center flex-1 max-w-[260px] bg-slate-50 border border-slate-200/90 rounded-full px-4 py-2 text-slate-400 text-xs gap-2 select-none">
                      <Search className="w-4 h-4 text-slate-400" />
                      <span className="truncate">Search sweets, bakery & fresh treats...</span>
                    </div>

                    {/* Mock Actions */}
                    <div className="flex items-center gap-2 select-none shrink-0">
                      <span className="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xs">
                        Menu
                      </span>
                      <span className="px-3.5 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hidden md:inline-block">
                        My Orders
                      </span>
                      <span className="px-3.5 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hidden md:inline-block">
                        Admin
                      </span>
                      <span className="px-3.5 py-2 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5">
                        Cart (0)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 1: Desktop Browser Tab Strip */}
            {previewTab === 'browser' && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Desktop Browser Tab Strip (Chrome / Safari / Edge):
                </span>
                <div className="bg-[#dee1e6] rounded-2xl p-2 font-sans select-none border border-slate-300/80 shadow-2xs">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {/* Inactive Tab 1 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-300/50 text-slate-600 text-xs shrink-0 max-w-[170px] truncate">
                      <div className="w-3.5 h-3.5 rounded-xs bg-slate-400/30 flex items-center justify-center shrink-0">
                        <Search className="w-2.5 h-2.5 text-slate-600" />
                      </div>
                      <span className="truncate">Google Search</span>
                      <X className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
                    </div>

                    {/* ACTIVE TAB: Gidhaur Bakery with uploaded Favicon (FILL / COVER) */}
                    <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg bg-white text-slate-900 text-xs font-medium shadow-xs shrink-0 border-t-2 border-amber-600 min-w-[210px] max-w-[270px]">
                      {branding.faviconUrl ? (
                        <div className="w-4 h-4 rounded-xs overflow-hidden shrink-0">
                          <img
                            src={branding.faviconUrl}
                            alt="Favicon"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-xs bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          G
                        </div>
                      )}
                      <span className="truncate font-bold text-slate-900">
                        Gidhaur Bakery
                      </span>
                      <X className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
                    </div>

                    {/* Inactive Tab 2 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-300/50 text-slate-600 text-xs shrink-0 max-w-[170px] truncate">
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-400/40 flex items-center justify-center shrink-0 text-[8px] text-slate-700 font-bold">
                        M
                      </div>
                      <span className="truncate">Gmail - Inbox</span>
                      <X className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW 2: Google Search Result (Flipkart / Amazon Style, STRICT FILL / COVER) */}
            {previewTab === 'google' && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Google Search Snippet Preview:
                </span>
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs max-w-xl font-sans">
                  {/* Site Header with Logo on Left (STRICT FILL / COVER) */}
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                      {branding.faviconUrl ? (
                        <img
                          src={branding.faviconUrl}
                          alt="Search Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-amber-700">
                          G
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block leading-tight truncate">
                        Gidhaur Bakery
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">
                        https://www.gidhaurbakery.com
                      </span>
                    </div>
                  </div>

                  {/* Search Result Title */}
                  <h5 className="text-amber-800 hover:text-amber-900 hover:underline font-medium text-base sm:text-lg leading-snug cursor-pointer font-heading">
                    Gidhaur Bakery
                  </h5>

                  {/* Search Meta Description */}
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed line-clamp-2">
                    {branding.websiteDescription ||
                      'Gidhaur Bakery - Order delicious cakes, bakery delicacies, snacks, and beverages directly with quick checkout and live order tracking.'}
                  </p>
                </div>
              </div>
            )}

            {/* PREVIEW 3: Smartphone Home Screen App Tile (STRICT FILL / COVER) */}
            {previewTab === 'phone' && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Mobile "Add to Home Screen" Icon Preview:
                </span>
                <div className="p-6 bg-gradient-to-br from-amber-50/40 via-slate-50 to-amber-100/30 rounded-3xl border border-amber-200/50 flex items-center justify-center text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center overflow-hidden border border-slate-200 relative">
                      {branding.pwaIconUrl || branding.faviconUrl ? (
                        <img
                          src={branding.pwaIconUrl || branding.faviconUrl}
                          alt="PWA Tile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center font-heading font-black text-xl">
                          GB
                        </div>
                      )}
                    </div>
                    <span className="text-slate-900 text-xs font-bold truncate max-w-[100px]">
                      Gidhaur Bakery
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Website SEO Details Form */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Website SEO Description (Google Search Snippet)
                </label>
                <textarea
                  rows={2}
                  value={branding.websiteDescription || ''}
                  onChange={(e) => setBranding((prev) => ({ ...prev, websiteDescription: e.target.value }))}
                  placeholder="Gidhaur Bakery - Order delicious cakes, bakery delicacies, snacks, and beverages directly with quick checkout and live order tracking."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: PAYMENTS & UPI */}
      {/* ========================================================================= */}
      {activeSection === 'payments' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <CreditCard className="w-3 h-3 text-amber-600" />
                <span>UPI & Digital Payments</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Payment Collection & QR Code Setup
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Collect direct online customer payments via Google Pay, PhonePe, Paytm, and BHIM UPI.
              </p>
            </div>

            {/* Online Payment Enable Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Enable Online UPI Payment at Checkout
                </span>
                <p className="text-[11px] text-slate-500 font-medium">
                  Enable instant UPI payments via QR code & UPI apps. When disabled, only Pay on Delivery is offered.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEnableOnlinePayment((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableOnlinePayment ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableOnlinePayment ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* UPI ID & Payee Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Merchant UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. gidhaurbakery@upi"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Customer payments are settled directly into the bank account linked with this VPA.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Business / Payee Display Name *
                </label>
                <input
                  type="text"
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value)}
                  placeholder="Gidhaur Bakery"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Business name visible on customer payment confirmation screens.
                </span>
              </div>
            </div>

            {/* Live QR Code Verification Box */}
            <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs shrink-0">
                <QRCodeSVG
                  value={sampleUpiUri}
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-1.5 text-center sm:text-left min-w-0">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Live QR Code Verification Test
                </span>
                <h5 className="font-heading font-extrabold text-sm text-slate-900">
                  {activePayeeName} ({activeUpiId})
                </h5>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Scan this sample QR code with any UPI application to test real-time payment handling.
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="text-xs text-slate-600 font-semibold">Test Amount: ₹</span>
                  <input
                    type="number"
                    value={previewAmount}
                    onChange={(e) => setPreviewAmount(e.target.value)}
                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: STORE PROFILE & TIMINGS */}
      {/* ========================================================================= */}
      {activeSection === 'store' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <Store className="w-3 h-3 text-amber-600" />
                <span>Store Profile & Operations</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Store Information & Operational Status
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Store name, contact info, operational timings, and live order acceptance status.
              </p>
            </div>

            {/* Store Open/Close Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Store Currently Accepting Orders (Live Open/Closed)
                </span>
                <p className="text-[11px] text-slate-500 font-medium">
                  Toggle store offline during off-hours or maintenance to pause incoming customer orders.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsStoreOpen((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isStoreOpen ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isStoreOpen ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Store Name *
                </label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Gidhaur Bakery"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Home Screen Message / Headline
                </label>
                <input
                  type="text"
                  value={homeScreenMessage}
                  onChange={(e) => setHomeScreenMessage(e.target.value)}
                  placeholder="I want to Eat..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">Appears above categories on mobile home screen (default: "I want to Eat...")</p>
              </div>

              {/* Global Typography & Headline Customizer (CSS Variables - Zero Re-render) */}
              <div className="sm:col-span-2 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 border border-slate-200/90 rounded-2xl p-5 shadow-2xs mt-1">
                <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-600" />
                      Global Typography & Headline Styling
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Adjust global text tracking (letter-spacing) and customize the home headline with 20 fonts (including Roboto Mono & Cursive). Powered by instant CSS variables.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live CSS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Global Tracking (Letter Spacing) Slider */}
                  <div className="sm:col-span-2 bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        Global Tracking (Letter Spacing)
                      </label>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {globalTracking > 0 ? `+${globalTracking.toFixed(3)}` : globalTracking.toFixed(3)}em
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-0.02"
                      max="0.08"
                      step="0.005"
                      value={globalTracking}
                      onChange={(e) => handleTrackingChange(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>Tight (-0.02em)</span>
                      <span>Default (+0.015em)</span>
                      <span>Spacious (+0.08em)</span>
                    </div>
                    <p
                      style={{ letterSpacing: `${globalTracking}em` }}
                      className="text-xs text-slate-700 mt-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 select-none font-medium truncate"
                    >
                      Sample: The quick brown fox jumps over the lazy dog (₹249)
                    </p>
                  </div>

                  {/* 2. Headline Font Family (20 Google Fonts List) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Headline Font (20 Curated Fonts)
                    </label>
                    <select
                      value={homeHeadlineFont}
                      onChange={(e) => handleHeadlineFontChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    >
                      <optgroup label="Modern Sans-Serif (8)">
                        {AVAILABLE_FONTS.filter((f) => f.category === 'sans').map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Elegant Serifs (4)">
                        {AVAILABLE_FONTS.filter((f) => f.category === 'serif').map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Monospace & Code (3)">
                        {AVAILABLE_FONTS.filter((f) => f.category === 'mono').map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="Cursive & Handwritten Scripts (5)">
                        {AVAILABLE_FONTS.filter((f) => f.category === 'cursive').map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Includes Roboto Mono & 5 Cursive styles</p>
                  </div>

                  {/* 3. Headline Font Size Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Headline Font Size
                      </label>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {homeHeadlineSize}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="18"
                      max="44"
                      step="1"
                      value={homeHeadlineSize}
                      onChange={(e) => handleHeadlineSizeChange(Number(e.target.value))}
                      className="w-full accent-slate-900 cursor-pointer mt-1"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                      <span>18px</span>
                      <span>Default (28px)</span>
                      <span>44px</span>
                    </div>
                  </div>

                  {/* 4. Headline Text Color */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Headline Text Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={homeHeadlineColor}
                        onChange={(e) => handleHeadlineColorChange(e.target.value)}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={homeHeadlineColor}
                        onChange={(e) => handleHeadlineColorChange(e.target.value)}
                        placeholder="#0f172a"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 5. Active Category Color */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Active Category Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={categoryActiveColor}
                        onChange={(e) => setCategoryActiveColor(e.target.value)}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={categoryActiveColor}
                        onChange={(e) => setCategoryActiveColor(e.target.value)}
                        placeholder="#0f172a"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 6. Inactive Category Color */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Inactive Category Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={categoryInactiveColor}
                        onChange={(e) => setCategoryInactiveColor(e.target.value)}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={categoryInactiveColor}
                        onChange={(e) => setCategoryInactiveColor(e.target.value)}
                        placeholder="#64748b"
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Real-time Headline Live Preview */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
                  <div className="overflow-hidden">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Live Preview
                    </span>
                    <h3
                      style={{
                        fontFamily: AVAILABLE_FONTS.find((f) => f.id === homeHeadlineFont)?.fontFamily || homeHeadlineFont,
                        fontSize: `${homeHeadlineSize}px`,
                        color: homeHeadlineColor,
                        letterSpacing: `${globalTracking}em`,
                      }}
                      className="font-extrabold leading-none truncate max-w-sm sm:max-w-md"
                    >
                      {homeScreenMessage || 'I want to Eat...'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      style={{ color: categoryActiveColor }}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100/80"
                    >
                      Active Tab
                    </span>
                    <span
                      style={{ color: categoryInactiveColor }}
                      className="text-xs font-medium opacity-70"
                    >
                      Inactive Tab
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Support Phone / WhatsApp *
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Store Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Main Road, Gidhaur"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Daily Opening Hours
                </label>
                <input
                  type="text"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder="08:00 AM - 10:30 PM (Everyday)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Average Food Preparation Time (Minutes)
                </label>
                <input
                  type="number"
                  value={defaultPrepTimeMinutes}
                  onChange={(e) => setDefaultPrepTimeMinutes(Number(e.target.value))}
                  placeholder="15"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Minimum Order Amount (₹)
                </label>
                <input
                  type="number"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  placeholder="99"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Official FSSAI License Number Configuration Card */}
              <div className="sm:col-span-2 p-4 sm:p-5 bg-gradient-to-br from-amber-50/50 via-slate-50 to-white rounded-2xl border border-amber-200/80 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 shadow-2xs flex items-center justify-center shrink-0">
                      <span className="font-heading font-black text-sky-800 text-sm lowercase">fssai</span>
                    </div>
                    <div>
                      <h4 className="font-heading font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>Official FSSAI Food Safety License</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Government Registered
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        This 14-digit license number is officially displayed with the FSSAI logo in the website footer and email notifications.
                      </p>
                    </div>
                  </div>

                  {/* Live Badge Preview */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs select-none shrink-0 self-start sm:self-auto">
                    <span className="font-heading font-black text-[13px] tracking-tight text-sky-800 lowercase">
                      fssai
                    </span>
                    <div className="h-3 w-px bg-slate-200" />
                    <div className="flex items-baseline gap-1 text-[11px]">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lic. No.</span>
                      <span className="font-mono font-extrabold text-slate-900 tracking-wide">
                        {fssaiLicenseNumber || '20426191000010'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    14-Digit FSSAI License Number *
                  </label>
                  <div className="relative flex items-center max-w-md">
                    <input
                      type="text"
                      value={fssaiLicenseNumber}
                      onChange={(e) => setFssaiLicenseNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 14))}
                      placeholder="20426191000010"
                      maxLength={14}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-extrabold text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      id="fssai-license-input"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    Registered FSSAI Number: <span className="font-mono font-bold text-slate-700">20426191000010</span> (You can edit and click "Save All Changes")
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* SECTION 4: DELIVERY & COVERAGE */}
      {/* ========================================================================= */}
      {activeSection === 'delivery' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <Truck className="w-3 h-3 text-amber-600" />
                <span>Distance-Based Delivery Fees</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Delivery Range & Distance Tier Charges
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Configure free delivery radius, distance slabs, and beyond-range per kilometer delivery fees.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  1. Free Delivery Radius
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={freeDeliveryRadiusKm}
                    onChange={(e) => setFreeDeliveryRadiusKm(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-500">KM</span>
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Orders within this radius get 100% Free Delivery.
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  2. Tier 1 ({freeDeliveryRadiusKm} to {tier1MaxKm} KM)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    value={tier1Fee}
                    onChange={(e) => setTier1Fee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Delivery fee applied up to {tier1MaxKm} KM.
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  3. Tier 2 ({tier1MaxKm} to {tier2MaxKm} KM)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    value={tier2Fee}
                    onChange={(e) => setTier2Fee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  Delivery fee applied up to {tier2MaxKm} KM.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: EMAIL NOTIFICATIONS & CUSTOMER DIRECTORY                         */}
      {/* ========================================================================= */}
      {activeSection === 'emails' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Card 1: Sender Gmail & Checkout Rules */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <Mail className="w-3 h-3 text-sky-600" />
                <span>Automated Gmail Notifications & Rules</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Gmail Sender Configuration & Checkout Policy
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Configure your Gmail account so customers receive real-time, beautifully formatted order emails from Placed to Delivered.
              </p>
            </div>

            {/* Toggles Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Toggle 1: Enable Email Notifications */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-bold text-slate-900 block">
                    Real-Time Order Emails
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Send automated emails when order is placed, cooking, out for delivery, and delivered.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEnableEmailNotifications((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enableEmailNotifications ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  id="toggle-email-notifications-btn"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      enableEmailNotifications ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: Make Email Mandatory at Checkout */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>Mandatory Email at Checkout</span>
                    {isEmailMandatory && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                        Required
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium">
                    When enabled, customers MUST enter their email to place orders. When off, email is optional.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEmailMandatory((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEmailMandatory ? 'bg-amber-600' : 'bg-slate-300'
                  }`}
                  id="toggle-mandatory-email-btn"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isEmailMandatory ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Gmail Account Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sender Gmail Address *
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="e.g. yourbakery@gmail.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:bg-white"
                    id="sender-gmail-input"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">The Gmail address used to dispatch customer emails</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Google App Password (16 Letters) *
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={senderEmailPassword}
                    onChange={(e) => setSenderEmailPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:bg-white"
                    id="sender-app-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Google 16-letter App Password (not standard account password)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Gidhaur Bakery"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:bg-white"
                  id="sender-display-name-input"
                />
                <p className="text-[10px] text-slate-400 mt-1">Shown as sender in customer inbox</p>
              </div>
            </div>

            {/* Google App Password Help Guide */}
            <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-sky-900 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>How to get a Google App Password in 60 seconds:</span>
              </div>
              <ol className="text-[11px] text-sky-800 space-y-1 list-decimal list-inside font-medium leading-relaxed">
                <li>Go to your Google Account at <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">myaccount.google.com</span>.</li>
                <li>Go to the <span className="font-bold">Security</span> tab and make sure <span className="font-bold">2-Step Verification</span> is turned ON.</li>
                <li>In the top search bar, type <span className="font-bold">"App passwords"</span> and click on it.</li>
                <li>Type App name as <span className="font-bold">"Gidhaur Bakery"</span> and click <span className="font-bold">Create</span>.</li>
                <li>Copy the generated 16-character code and paste it in the box above.</li>
              </ol>
            </div>

            {/* Test Email Verification Box */}
            <div className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-heading font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-600" />
                    <span>Instant Live Test Email</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Send a test sample order confirmation email to verify your Gmail connection immediately.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="Enter your email to test"
                    className="w-56 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    id="test-email-recipient-input"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={isSendingTestEmail}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                    id="send-test-email-btn"
                  >
                    {isSendingTestEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isSendingTestEmail ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </div>
              </div>

              {testEmailFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    testEmailFeedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {testEmailFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testEmailFeedback.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 1.5: Granular Notification Events Control Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  <Sliders className="w-3 h-3 text-amber-600" />
                  <span>Granular Milestone Controls</span>
                </div>
                <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
                  Notification Events Control
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Select which order milestones should automatically dispatch an email to the customer.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto border border-slate-200">
                7 Milestone Triggers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Trigger 1: Order Placed */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block">1. Order Placed (Initial Receipt)</span>
                  <span className="text-[11px] text-slate-500 block">Email sent as soon as customer places order.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyOrderPlaced: !prev.notifyOrderPlaced }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyOrderPlaced ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyOrderPlaced ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 2: Order Confirmed */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>2. Order Confirmed by Store</span>
                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">Recommended</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block">Email sent when Admin confirms & accepts order.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyOrderConfirmed: !prev.notifyOrderConfirmed }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyOrderConfirmed ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyOrderConfirmed ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 3: Send to Kitchen (Default OFF as requested) */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block">3. Send to Kitchen (Cooking)</span>
                  <span className="text-[11px] text-slate-500 block">Email sent when order moves to preparing station.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyKitchenSent: !prev.notifyKitchenSent }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyKitchenSent ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyKitchenSent ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 4: Out for Delivery */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>4. Out for Delivery (Rider Dispatched)</span>
                    <span className="text-[9px] font-extrabold text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded">Recommended</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block">Email sent when rider leaves store on the way.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyOutForDelivery: !prev.notifyOutForDelivery }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyOutForDelivery ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyOutForDelivery ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 5: Delivered */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>5. Order Delivered</span>
                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">Recommended</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block">Email sent when delivery is marked complete.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyDelivered: !prev.notifyDelivered }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyDelivered ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyDelivered ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 6: Cancellation Accepted */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block">6. Cancellation Accepted</span>
                  <span className="text-[11px] text-slate-500 block">Email sent when Admin approves cancel request.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyCancellationAccepted: !prev.notifyCancellationAccepted }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyCancellationAccepted ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyCancellationAccepted ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Trigger 7: Cancellation Declined */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 sm:col-span-2">
                <div className="pr-3">
                  <span className="text-xs font-bold text-slate-900 block">7. Cancellation Declined</span>
                  <span className="text-[11px] text-slate-500 block">Email sent when Admin declines cancel request (food is already in prep).</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailEventToggles((prev) => ({ ...prev, notifyCancellationDeclined: !prev.notifyCancellationDeclined }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailEventToggles.notifyCancellationDeclined ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    emailEventToggles.notifyCancellationDeclined ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Branded Customer Email Template Showcase (Original Clean Palette with 60 Soft Corners) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block mb-0.5">
                  Original Brand Palette • Soft 60 Curved iPhone Layout
                </span>
                <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
                  Customer Email Template Preview
                </h4>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Gidhaur Bakery Original Palette
              </span>
            </div>

            {/* Email Preview Mockup (Clean single card, soft 60 corners, no square gaps, no live track button) */}
            <div className="max-w-xl mx-auto bg-slate-100/90 p-2 sm:p-5 rounded-[44px] border border-slate-200/80 shadow-inner">
              <div className="bg-white text-slate-900 rounded-[38px] sm:rounded-[40px] border border-slate-200 shadow-md overflow-hidden">
                {/* Brand Header Banner: Original Clean Bakery Palette */}
                <div className="bg-white p-6 sm:p-7 text-center border-b border-slate-100">
                  <span className="block text-[11px] font-extrabold tracking-widest text-amber-700 uppercase mb-1">
                    ★ {restaurantName || 'GIDHAUR BAKERY'} ★
                  </span>
                  <h3 className="font-heading font-black text-2xl text-slate-900 tracking-tight">
                    Order Confirmed
                  </h3>
                  <div className="mt-2.5">
                    <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                      Order #ORD-58492 • Confirmed
                    </span>
                  </div>
                </div>

                {/* Email Body: Clean, Light, Beautiful Original Typography */}
                <div className="p-5 sm:p-6 space-y-4 text-xs">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      Hi Store Administrator,
                    </h4>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                      Great news! Our chef has accepted your order and is freshly preparing your items.
                    </p>
                  </div>

                  {/* Clean Hairline Table inside Soft-Corner Box */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="pb-2">ITEM</th>
                          <th className="text-center pb-2">QTY</th>
                          <th className="text-right pb-2">PRICE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 font-medium text-slate-800">
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-900">Artisan Chocolate Truffle Cake (500g)</td>
                          <td className="text-center py-2.5 text-slate-600 font-bold">× 1</td>
                          <td className="text-right py-2.5 font-bold font-mono text-slate-900">₹499</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-900">Paneer Tikka Stuffed Garlic Bread</td>
                          <td className="text-center py-2.5 text-slate-600 font-bold">× 2</td>
                          <td className="text-right py-2.5 font-bold font-mono text-slate-900">₹298</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Bill Breakdown */}
                    <div className="mt-3 pt-3 border-t border-dashed border-slate-300 space-y-1.5">
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>Items Subtotal</span>
                        <span className="font-mono text-slate-800 font-semibold">₹797</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Delivery Fee</span>
                        <span className="font-bold text-emerald-600">FREE</span>
                      </div>
                      <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                        <span>Total Amount</span>
                        <span className="font-mono text-slate-900 text-lg font-black">₹797</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                        <span>Payment Method</span>
                        <span className="font-bold text-slate-700 uppercase">UPI (PAID)</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Section (Soft rounded box) */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                      📍 DELIVERY ADDRESS
                    </span>
                    <span className="text-xs text-slate-800 font-semibold leading-relaxed block">
                      Main Market Road, Gidhaur (Sample Delivery Address)
                    </span>
                  </div>
                </div>

                {/* Email Footer with FSSAI Official Badge */}
                <div className="bg-slate-50 p-5 border-t border-slate-200 text-center space-y-2 text-[11px] text-slate-500">
                  {/* Official FSSAI Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-slate-300 select-none shadow-2xs">
                    <span className="font-heading font-black text-sky-600 text-xs lowercase">fssai</span>
                    <div className="h-3 w-px bg-slate-300" />
                    <div className="flex items-baseline gap-1 text-[11px]">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Lic. No.</span>
                      <span className="font-mono font-bold text-slate-900 tracking-wide">
                        {fssaiLicenseNumber || '20426191000010'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-600 text-xs">
                    {address || 'Main Market Road, Gidhaur'} • Helpline: <span className="text-sky-600 font-bold">{contactPhone || '+91 98765 43210'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    100% Quality & Hygiene Assured • Thank you for choosing {restaurantName || 'Gidhaur Bakery'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Customer Email Directory & Marketing Audience */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  <Users className="w-3 h-3 text-emerald-600" />
                  <span>Collected Customer Directory</span>
                </div>
                <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 flex items-center gap-2">
                  <span>Customer Email Audience</span>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {customerEmailsList.length} Contacts
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Every customer who enters their email is saved here automatically. Use this audience for festival offers and promotional announcements.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyAllEmails}
                  disabled={customerEmailsList.length === 0}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Copy all emails for BCC mass marketing blast"
                  id="copy-all-customer-emails-btn"
                >
                  {copiedAllEmails ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedAllEmails ? 'Copied to Clipboard!' : 'Copy All Emails (BCC)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={customerEmailsList.length === 0}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Export customer list as CSV"
                  id="export-customer-emails-csv-btn"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                {customerEmailsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearingAllEmailsConfirm(true)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Clear customer emails directory"
                    id="clear-all-customer-emails-btn"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={emailSearchQuery}
                onChange={(e) => setEmailSearchQuery(e.target.value)}
                placeholder="Search by customer name, email address, or phone..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                id="search-customer-emails-input"
              />
            </div>

            {/* Customers List / Table */}
            {customerEmailsList.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mx-auto shadow-2xs">
                  <Mail className="w-6 h-6" />
                </div>
                <h4 className="font-heading font-extrabold text-sm text-slate-800">
                  No Customer Emails Yet
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When customers enter their email in the checkout field ("Email for order status"), their contact details will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
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
                      className="p-3.5 sm:p-4 bg-white hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0 uppercase shadow-2xs">
                          {(record.name || record.email)[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {record.name || 'Customer'}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                              {record.totalOrders || 1} {record.totalOrders === 1 ? 'Order' : 'Orders'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                            <a
                              href={`mailto:${record.email}`}
                              className="text-sky-700 hover:underline font-mono font-medium"
                            >
                              {record.email}
                            </a>
                            {record.phone && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{record.phone}</span>
                              </>
                            )}
                            {record.lastOrderDate && (
                              <>
                                <span>•</span>
                                <span>Active: {new Date(record.lastOrderDate).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <a
                          href={`mailto:${record.email}?subject=${encodeURIComponent(`Special Offer from ${restaurantName || 'Gidhaur Bakery'}`)}`}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors"
                          title="Compose direct email"
                        >
                          Email
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeletingEmailRecord(record)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete customer from directory"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: STAFF & SECURITY */}
      {/* ========================================================================= */}
      {activeSection === 'security' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Admin & Staff Access</span>
              </div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Staff Credentials & Security
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Manage owner and manager authentication credentials.
              </p>
            </div>

            <AdminAccountsManagement />
          </div>
        </div>
      )}

      {/* MODAL 1: Delete Single Customer Email Confirmation */}
      {deletingEmailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Remove Customer Email?
              </h3>
              <p className="text-xs text-slate-600 font-medium font-mono">
                {deletingEmailRecord.email}
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                This customer record ({deletingEmailRecord.name}) will be removed from your marketing audience.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEmailRecord(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCustomerEmail(deletingEmailRecord)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                id="confirm-delete-customer-email-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Clear All Customer Emails Confirmation */}
      {isClearingAllEmailsConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Clear All Customer Emails?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete all{' '}
                <span className="font-bold text-slate-900">{customerEmailsList.length}</span> collected customer emails from your directory?
              </p>
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                This action cannot be undone. Future orders will re-populate new emails as customers order.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearingAllEmailsConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllEmails}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                id="confirm-clear-all-customer-emails-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All ({customerEmailsList.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
