import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Tag,
  Save,
  X,
  ExternalLink,
  Image as ImageIcon,
  Clock,
  LayoutGrid,
  Upload,
  Loader2
} from 'lucide-react';
import { BannerSettings, PromotionalBanner } from '../../types';
import { saveBannerSettings, upsertBanner, deleteBanner } from '../../services/bannerService';
import { processAndUploadImage, formatBytes } from '../../utils/image';

interface BannerManagementProps {
  bannerSettings: BannerSettings;
  categories: string[];
  onUpdateSettings: (settings: BannerSettings) => void;
}

const PRESET_IMAGES = [
  {
    name: 'Artisan Pizza',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Gourmet Burger',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Delicious Desserts',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Cool Beverages',
    url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Fast Food Combos',
    url: 'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Express Delivery',
    url: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=600&q=80',
  },
];

export const BannerManagement: React.FC<BannerManagementProps> = ({
  bannerSettings,
  categories,
  onUpdateSettings,
}) => {
  const [isEnabled, setIsEnabled] = useState(bannerSettings.isEnabled !== false);
  const [autoSlideInterval, setAutoSlideInterval] = useState(
    bannerSettings.autoSlideIntervalSeconds || 5
  );

  // Keep local state in sync when bannerSettings prop updates from server/parent
  React.useEffect(() => {
    setIsEnabled(bannerSettings.isEnabled !== false);
  }, [bannerSettings.isEnabled]);

  React.useEffect(() => {
    setAutoSlideInterval(bannerSettings.autoSlideIntervalSeconds || 5);
  }, [bannerSettings.autoSlideIntervalSeconds]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<PromotionalBanner | null>(null);

  // Form states
  const [formBadge, setFormBadge] = useState('SPECIAL OFFER');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCoupon, setFormCoupon] = useState('');
  const [formDiscountText, setFormDiscountText] = useState('');
  const [formCategory, setFormCategory] = useState('All');
  const [formBtnText, setFormBtnText] = useState('Order Now');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setIsUploadingBanner(true);
      const res = await processAndUploadImage(file, {
        maxWidth: 1200,
        maxHeight: 600,
        quality: 0.8,
        folder: 'banners'
      });
      setFormImageUrl(res.url);
      showNotification('✓ Banner photo uploaded successfully!');
    } catch (err: any) {
      showNotification('Could not upload banner: ' + (err?.message || 'Error'), 'error');
    } finally {
      setIsUploadingBanner(false);
      e.target.value = '';
    }
  };

  // Master Settings Save (Toggle or Slide Interval change)
  const handleSaveMasterSettings = async (newEnabled?: boolean, newInterval?: number) => {
    const updated: BannerSettings = {
      ...bannerSettings,
      isEnabled: newEnabled !== undefined ? newEnabled : isEnabled,
      autoSlideIntervalSeconds: newInterval !== undefined ? newInterval : autoSlideInterval,
    };
    // Call parent update immediately for zero latency response
    onUpdateSettings(updated);
    setIsSaving(true);
    try {
      await saveBannerSettings(updated);
      showNotification('Banner settings updated successfully!');
    } catch {
      showNotification('Failed to update banner settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBanner(null);
    setIsUploadingBanner(false);
    setFormBadge('SPECIAL OFFER');
    setFormTitle('');
    setFormDesc('');
    setFormCoupon('');
    setFormDiscountText('');
    setFormCategory('All');
    setFormBtnText('Order Now');
    setFormImageUrl(PRESET_IMAGES[0].url);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (banner: PromotionalBanner) => {
    setEditingBanner(banner);
    setIsUploadingBanner(false);
    setFormBadge(banner.badge || 'SPECIAL OFFER');
    setFormTitle(banner.title);
    setFormDesc(banner.description || '');
    setFormCoupon(banner.couponCode || '');
    setFormDiscountText(banner.discountText || '');
    setFormCategory(banner.targetCategory || 'All');
    setFormBtnText(banner.buttonText || 'Order Now');
    setFormImageUrl(banner.imageUrl || '');
    setFormIsActive(banner.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSubmitBannerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showNotification('Offer title is required', 'error');
      return;
    }

    const bannerToSave: PromotionalBanner = {
      id: editingBanner ? editingBanner.id : `banner-${Date.now()}`,
      badge: formBadge.trim().toUpperCase() || 'SPECIAL OFFER',
      title: formTitle.trim(),
      description: formDesc.trim(),
      couponCode: formCoupon.trim().toUpperCase() || undefined,
      discountText: formDiscountText.trim().toUpperCase() || undefined,
      targetCategory: formCategory || 'All',
      buttonText: formBtnText.trim() || 'Order Now',
      imageUrl: formImageUrl.trim() || undefined,
      isActive: formIsActive,
      order: editingBanner ? editingBanner.order : (bannerSettings.banners.length + 1),
      createdAt: editingBanner?.createdAt || new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      const updated = await upsertBanner(bannerToSave);
      onUpdateSettings(updated);
      setIsModalOpen(false);
      showNotification(editingBanner ? 'Banner updated!' : 'New banner added!');
    } catch {
      showNotification('Could not save banner.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBanner = async (banner: PromotionalBanner) => {
    const updatedBanners = bannerSettings.banners.map((b) =>
      b.id === banner.id ? { ...b, isActive: !b.isActive } : b
    );
    const updatedSettings = { ...bannerSettings, banners: updatedBanners };
    onUpdateSettings(updatedSettings);
    await saveBannerSettings(updatedSettings);
    showNotification(`Banner ${!banner.isActive ? 'activated' : 'deactivated'}.`);
  };

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      const updated = await deleteBanner(bannerId);
      onUpdateSettings(updated);
      setDeletingId(null);
      showNotification('Banner deleted.');
    } catch {
      showNotification('Failed to delete banner.', 'error');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const banners = [...bannerSettings.banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    // Swap
    const temp = banners[index];
    banners[index] = banners[targetIndex];
    banners[targetIndex] = temp;

    // Re-assign order indices
    const reordered = banners.map((b, idx) => ({ ...b, order: idx + 1 }));
    const updatedSettings = { ...bannerSettings, banners: reordered };
    onUpdateSettings(updatedSettings);
    await saveBannerSettings(updatedSettings);
  };

  const activeCount = bannerSettings.banners.filter((b) => b.isActive).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Master Control Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <h2 className="font-heading font-extrabold text-xl text-slate-900">
                Promotional Banners & Offers
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Manage the top promotional carousel on the store home view. Highlight discounts, seasonal specials, and coupon codes.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
            id="admin-add-banner-btn"
          >
            <Plus className="w-4 h-4" />
            <span>Add Banner</span>
          </button>
        </div>

        {/* Master Switches Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* Home View Carousel Toggle */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">Show Carousel on Home View</div>
              <div className="text-[11px] text-slate-500">
                {isEnabled ? 'Live on customer home view' : 'Currently hidden from store'}
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsEnabled(val);
                  handleSaveMasterSettings(val, autoSlideInterval);
                }}
                className="sr-only peer"
                id="carousel-master-toggle"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Auto-Slide Interval Select */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Auto-Slide Speed</span>
              </div>
              <div className="text-[11px] text-slate-500">Rotate to next offer automatically</div>
            </div>

            <select
              value={autoSlideInterval}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAutoSlideInterval(val);
                handleSaveMasterSettings(isEnabled, val);
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
              id="carousel-speed-select"
            >
              <option value={3}>Fast (3s)</option>
              <option value={5}>Standard (5s)</option>
              <option value={8}>Relaxed (8s)</option>
              <option value={10}>Slow (10s)</option>
            </select>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-medium">
          <span>
            Total Banners: <strong className="text-slate-800">{bannerSettings.banners.length}</strong>
          </span>
          <span>•</span>
          <span>
            Active on Store:{' '}
            <strong className="text-emerald-700 font-bold">{activeCount}</strong>
          </span>
          <span>•</span>
          <span>
            Status:{' '}
            <span
              className={`font-bold ${
                isEnabled && activeCount > 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {isEnabled && activeCount > 0 ? 'Live & Displaying' : 'Paused / Inactive'}
            </span>
          </span>
        </div>
      </div>

      {/* Banner Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Configured Offers ({bannerSettings.banners.length})
          </h3>
          <span className="text-[11px] text-slate-400">Drag or use arrows to change display order</span>
        </div>

        {bannerSettings.banners.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 p-6 space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">No Banners Configured Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create promotional banners to showcase discounts, festive treats, and coupons to customers on the home screen.
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Banner</span>
            </button>
          </div>
        ) : (
          bannerSettings.banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                banner.isActive ? 'border-slate-200/90' : 'border-slate-200/60 opacity-70 bg-slate-50/50'
              }`}
              id={`admin-banner-card-${banner.id}`}
            >
              {/* Left Column: Image Thumbnail + Details */}
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                {/* Order Controls */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(index, 'up')}
                    disabled={index === 0}
                    title="Move up"
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(index, 'down')}
                    disabled={index === bannerSettings.banners.length - 1}
                    title="Move down"
                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Thumbnail Image */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  {banner.imageUrl ? (
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Text info */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                      {banner.badge || 'OFFER'}
                    </span>
                    {banner.discountText && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {banner.discountText}
                      </span>
                    )}
                    {banner.targetCategory && banner.targetCategory !== 'All' && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Category: {banner.targetCategory}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {banner.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1 max-w-lg">
                    {banner.description || 'No description provided'}
                  </p>

                  {banner.couponCode && (
                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <Tag className="w-3 h-3 text-slate-400" />
                        Code: {banner.couponCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Active Switch & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                {/* Status Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleBanner(banner)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    banner.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                  }`}
                  title={banner.isActive ? 'Click to hide from store' : 'Click to activate'}
                >
                  {banner.isActive ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hidden</span>
                    </>
                  )}
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(banner)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Edit Banner"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => setDeletingId(banner.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Delete Banner"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Delete Banner Offer?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will immediately remove this offer banner from the customer carousel.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBanner(deletingId)}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Banner Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
                  {editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Offer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBannerForm} className="space-y-4">
              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Badge Label</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="SPECIAL OFFER"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Offer Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Flat 20% OFF on Combos"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Subtitle / Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description / Terms</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Freshly handcrafted stone-baked crusts. Valid on all orders above ₹249."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              {/* Coupon Code & Discount Tag */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Promo Coupon Code</label>
                  <input
                    type="text"
                    value={formCoupon}
                    onChange={(e) => setFormCoupon(e.target.value.toUpperCase())}
                    placeholder="e.g. SWADEEP20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Discount Pill Text</label>
                  <input
                    type="text"
                    value={formDiscountText}
                    onChange={(e) => setFormDiscountText(e.target.value)}
                    placeholder="e.g. 20% OFF or FREE DELIVERY"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Target Category & Button Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Linked Menu Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">CTA Button Text</label>
                  <input
                    type="text"
                    value={formBtnText}
                    onChange={(e) => setFormBtnText(e.target.value)}
                    placeholder="e.g. Order Now"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Image URL, Preset Selection & Device Upload */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Banner Image</label>
                  <span className="text-[10px] text-slate-400 font-medium">Upload photo, pick preset, or paste link</span>
                </div>

                {/* Upload Button & Direct Link Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="cursor-pointer flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl font-bold text-xs transition-all shadow-xs">
                    {isUploadingBanner ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-slate-300" />
                    )}
                    <span>
                      {isUploadingBanner ? 'Uploading...' : 'Upload Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingBanner}
                      onChange={handleBannerFileUpload}
                      className="hidden"
                    />
                  </label>

                  <input
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="Or paste image URL"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>

                {/* Preset Image Quick Pick */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">Or choose a high-resolution preset:</span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setFormImageUrl(preset.url)}
                        className={`group relative rounded-xl overflow-hidden border aspect-square p-0.5 transition-all cursor-pointer ${
                          formImageUrl === preset.url
                            ? 'border-slate-900 ring-2 ring-slate-900'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover rounded-lg" />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-[9px] text-white text-center py-0.5 truncate">
                          {preset.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-800">Activate Banner Immediately</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingBanner ? 'Save Changes' : 'Create Banner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default BannerManagement;
