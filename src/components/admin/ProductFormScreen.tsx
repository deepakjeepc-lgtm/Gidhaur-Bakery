import React, { useState, useEffect, memo } from 'react';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  Layers,
  Leaf,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Check,
  Search,
  ExternalLink,
  Link2,
  X,
  Ruler,
  UtensilsCrossed,
  Scale,
  Coffee,
  Boxes,
  Palette,
  Hash,
  Tag,
  Package
} from 'lucide-react';
import { Product, ProductVariant } from '../../types';
import { uploadOptimizedImages } from '../../services/storageService';
import { findFoodImagesOnline, DetectedFoodImage } from '../../utils/foodImageFinder';

interface ProductFormScreenProps {
  product: Product | null; // null when creating new
  categories: string[];
  onBack: () => void;
  onSave: (payload: {
    id?: string;
    productPayload: Partial<Product>;
    isFeatured: boolean;
  }) => Promise<void>;
}

export const ProductFormScreen: React.FC<ProductFormScreenProps> = memo(({
  product,
  categories,
  onBack,
  onSave
}) => {
  // Local isolated state - typing will NEVER re-render the parent product table!
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [category, setCategory] = useState(categories[0] || 'Bakery');
  const [customCategory, setCustomCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [available, setAvailable] = useState(true);
  const [isVegetarian, setIsVegetarian] = useState(true);
  const [isNonFood, setIsNonFood] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('cover');
  const [imageFits, setImageFits] = useState<Record<string, 'cover' | 'contain'>>({});
  const [hasPrepTime, setHasPrepTime] = useState(false);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | ''>(15);

  // Sizes & Variants Mode ('single' | 'size')
  const [variantMode, setVariantMode] = useState<'single' | 'size'>('single');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Image Upload & Compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; stage?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-Detect Images state
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [detectedImages, setDetectedImages] = useState<DetectedFoodImage[]>([]);
  const [selectedDetectedUrls, setSelectedDetectedUrls] = useState<string[]>([]);
  const [isDetectPanelOpen, setIsDetectPanelOpen] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchSuccessFeedback, setSearchSuccessFeedback] = useState<string | null>(null);
  const [replaceExistingOnSave, setReplaceExistingOnSave] = useState(false);

  // Initialize form state whenever product changes
  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setBasePrice(product.price || '');
      if (categories.includes(product.category)) {
        setCategory(product.category);
        setCustomCategory('');
      } else {
        setCategory('Custom');
        setCustomCategory(product.category || '');
      }

      const rawProdsImages = (product.images && product.images.length > 0)
        ? product.images.filter((img) => img && !img.includes('photo-1546069901-ba9599a7e63c'))
        : product.imageUrl && !product.imageUrl.includes('photo-1546069901-ba9599a7e63c')
        ? [product.imageUrl]
        : [];
      setImages(rawProdsImages);
      setImageUrlInput('');
      setAvailable(product.available !== false);
      setIsVegetarian(product.isVegetarian !== false);
      setIsNonFood(Boolean(product.isNonFood));
      setIsFeatured(Boolean(product.isFeatured || product.isPinnedToFront));
      setImageFit(product.imageFit === 'contain' ? 'contain' : 'cover');
      const initialFits: Record<string, 'cover' | 'contain'> = {};
      rawProdsImages.forEach((img, i) => {
        const val = product.imageFits?.[String(i)] || (product.imageFits as any)?.[img] || product.imageFit || 'cover';
        initialFits[String(i)] = val === 'contain' ? 'contain' : 'cover';
      });
      setImageFits(initialFits);

      if (typeof product.prepTimeMinutes === 'number' && product.prepTimeMinutes > 0) {
        setHasPrepTime(true);
        setPrepTimeMinutes(product.prepTimeMinutes);
      } else {
        setHasPrepTime(false);
        setPrepTimeMinutes(15);
      }

      if (product.variants && product.variants.length > 0) {
        setVariantMode('size');
        setHasVariants(true);
        setVariants(
          product.variants.map((v) => ({
            ...v,
            available: v.available !== false,
          }))
        );
      } else if (product.colorVariants && product.colorVariants.length > 0) {
        setVariantMode('size');
        setHasVariants(true);
        setVariants(
          product.colorVariants.map((c) => ({
            name: c.name,
            price: c.price,
            imageUrl: c.imageUrl,
            imageFit: c.imageFit || 'cover',
            available: true,
          }))
        );
      } else {
        setVariantMode('single');
        setHasVariants(false);
        setVariants([]);
      }
    } else {
      // New Product Defaults
      setName('');
      setDescription('');
      setBasePrice('');
      setCategory(categories[0] || 'Bakery');
      setCustomCategory('');
      setImages([]);
      setImageUrlInput('');
      setAvailable(true);
      setIsVegetarian(true);
      setIsNonFood(false);
      setIsFeatured(false);
      setImageFit('cover');
      setImageFits({});
      setHasPrepTime(false);
      setPrepTimeMinutes(15);
      setVariantMode('single');
      setHasVariants(false);
      setVariants([]);
    }

    setIsCompressing(false);
    setUploadProgress(null);
    setFormError(null);
    setIsSearchingImages(false);
    setDetectedImages([]);
    setSelectedDetectedUrls([]);
    setIsDetectPanelOpen(false);
    setCustomSearchQuery('');
    setSearchSuccessFeedback(null);
  }, [product, categories]);

  // Handle uploading local image files
  const handleMultipleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    try {
      setIsCompressing(true);
      setFormError(null);
      setUploadProgress({ current: 0, total: files.length, stage: 'Preparing photos...' });

      const results = await uploadOptimizedImages(files, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.78,
        folder: 'products',
        onProgress: (current, total) => {
          setUploadProgress({
            current,
            total,
            stage: `Uploading photo ${current} of ${total}...`,
          });
        },
      });

      const newUrls = results.map((r) => r.url).filter(Boolean);
      setImages((prev) => {
        const startIdx = prev.length;
        const combined = [...prev, ...newUrls];
        setImageFits((prevFits) => {
          const updated = { ...prevFits };
          newUrls.forEach((_, i) => {
            updated[String(startIdx + i)] = 'cover';
          });
          return updated;
        });
        return combined;
      });
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setFormError('Failed to upload image. Please check file format.');
    } finally {
      setIsCompressing(false);
      setUploadProgress(null);
    }
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const trimmed = imageUrlInput.trim();
    if (images.includes(trimmed)) {
      setFormError('This image is already added');
      return;
    }
    const nextIdx = images.length;
    setImages((prev) => [...prev, trimmed]);
    setImageFits((prev) => ({ ...prev, [String(nextIdx)]: 'cover' }));
    setImageUrlInput('');
    setFormError(null);
  };

  const handleUpdateImageFit = (index: number, fit: 'cover' | 'contain') => {
    setImageFits((prev) => ({
      ...prev,
      [String(index)]: fit,
    }));
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      setImageFits((prevFits) => {
        const updated: Record<string, 'cover' | 'contain'> = {};
        filtered.forEach((_, newIdx) => {
          const oldIdx = newIdx >= index ? newIdx + 1 : newIdx;
          updated[String(newIdx)] = prevFits[String(oldIdx)] || 'cover';
        });
        return updated;
      });
      return filtered;
    });
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [selected] = copy.splice(index, 1);
      const updatedImages = [selected, ...copy];

      setImageFits((prevFits) => {
        const updated: Record<string, 'cover' | 'contain'> = {};
        updated['0'] = prevFits[String(index)] || 'cover';
        let newIdx = 1;
        prev.forEach((_, oldIdx) => {
          if (oldIdx !== index) {
            updated[String(newIdx)] = prevFits[String(oldIdx)] || 'cover';
            newIdx++;
          }
        });
        return updated;
      });

      return updatedImages;
    });
  };

  // Auto-Find Online Images
  const handleAutoFindImages = async (customQueryOverride?: string) => {
    const searchTerm = (typeof customQueryOverride === 'string' ? customQueryOverride : customSearchQuery).trim() || name.trim();
    if (!searchTerm) {
      setFormError('Please enter a Product Name first to search relevant photos.');
      return;
    }

    try {
      setIsSearchingImages(true);
      setFormError(null);
      setSearchSuccessFeedback(null);

      const currentCat = category === 'Custom' ? customCategory : category;
      const results = await findFoodImagesOnline(searchTerm, currentCat);

      setDetectedImages(results);
      setSelectedDetectedUrls(results.map((r) => r.url));
      setIsDetectPanelOpen(true);
      setSearchSuccessFeedback(`Found ${results.length} studio photos for "${searchTerm}"!`);
    } catch (err) {
      console.error('Failed to auto-detect images:', err);
      setFormError('Could not fetch photos automatically. Try uploading manually or pasting a URL.');
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleToggleSelectDetectedImage = (url: string) => {
    setSelectedDetectedUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleApplyDetectedImages = () => {
    if (selectedDetectedUrls.length === 0) {
      setFormError('Please select at least one photo to apply.');
      return;
    }
    if (replaceExistingOnSave) {
      setImages(selectedDetectedUrls);
      const newFits: Record<string, 'cover' | 'contain'> = {};
      selectedDetectedUrls.forEach((_, i) => {
        newFits[String(i)] = 'cover';
      });
      setImageFits(newFits);
    } else {
      const startIdx = images.length;
      const combined = [...images];
      const newlyAddedCount: number[] = [];
      selectedDetectedUrls.forEach((u) => {
        if (!combined.includes(u)) {
          combined.push(u);
          newlyAddedCount.push(startIdx + newlyAddedCount.length);
        }
      });
      setImages(combined);
      setImageFits((prev) => {
        const updated = { ...prev };
        newlyAddedCount.forEach((idx) => {
          updated[String(idx)] = 'cover';
        });
        return updated;
      });
    }
    setIsDetectPanelOpen(false);
    setSearchSuccessFeedback(`Applied ${selectedDetectedUrls.length} photos!`);
    setTimeout(() => setSearchSuccessFeedback(null), 3000);
  };

  // Numbers & Sizes Variants Management
  const [variantPresetType, setVariantPresetType] = useState<
    'sizes' | 'plates' | 'weights' | 'portions' | 'drinks' | 'pieces' | 'colors' | 'flavours' | 'numbers' | 'custom'
  >(product?.variantPresetType || 'sizes');
  const [variantCustomLabel, setVariantCustomLabel] = useState<string>(product?.variantCustomLabel || '');
  const [showVariantsSeparately, setShowVariantsSeparately] = useState<boolean>(
    Boolean(product?.showVariantsSeparately)
  );

  const [variantUploadingIdx, setVariantUploadingIdx] = useState<number | null>(null);
  const [linkInputVariantIdx, setLinkInputVariantIdx] = useState<number | null>(null);
  const [linkInputValue, setLinkInputValue] = useState('');

  const handleVariantFileUpload = async (variantIdx: number, file: File) => {
    try {
      setVariantUploadingIdx(variantIdx);
      setFormError(null);
      const results = await uploadOptimizedImages([file], {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.78,
        folder: 'variants',
      });
      if (results[0]?.url) {
        handleUpdateVariant(variantIdx, 'imageUrl', results[0].url);
        if (!variants[variantIdx]?.imageFit) {
          handleUpdateVariant(variantIdx, 'imageFit', 'contain');
        }
      }
    } catch (err: any) {
      console.error('Variant photo upload failed:', err);
      setFormError('Failed to upload option photo. Please try again.');
    } finally {
      setVariantUploadingIdx(null);
    }
  };

  const handleAddVariant = () => {
    const defaultPrice = typeof basePrice === 'number' && basePrice > 0 ? basePrice : 99;
    setVariants((prev) => [
      ...prev,
      {
        name: `Option ${prev.length + 1}`,
        price: defaultPrice,
        imageUrl: '',
        imageFit: 'contain',
        available: true,
      },
    ]);
  };

  const handleSelectPresetSizes = (
    presetName: 'sizes' | 'plates' | 'weights' | 'portions' | 'drinks' | 'pieces' | 'colors' | 'flavours' | 'numbers'
  ) => {
    const defaultP = typeof basePrice === 'number' && basePrice > 0 ? basePrice : 120;
    setVariantPresetType(presetName);

    let presets: { name: string; mult: number }[] = [];
    let defaultLabel = 'Select Size / Option:';

    switch (presetName) {
      case 'sizes':
        defaultLabel = 'Select Size / Portion:';
        presets = [
          { name: 'Small', mult: 0.8 },
          { name: 'Medium', mult: 1.0 },
          { name: 'Large', mult: 1.35 },
        ];
        break;
      case 'plates':
        defaultLabel = 'Select Portion / Plate:';
        presets = [
          { name: 'Half Plate', mult: 0.65 },
          { name: 'Full Plate', mult: 1.0 },
        ];
        break;
      case 'weights':
        defaultLabel = 'Select Weight / Pack:';
        presets = [
          { name: '250g', mult: 0.3 },
          { name: '500g', mult: 0.55 },
          { name: '1 Kg', mult: 1.0 },
        ];
        break;
      case 'portions':
        defaultLabel = 'Select Size / Option:';
        presets = [
          { name: 'Regular', mult: 1.0 },
          { name: 'Jumbo / Special', mult: 1.4 },
        ];
        break;
      case 'drinks':
        defaultLabel = 'Select Volume / Drink:';
        presets = [
          { name: '250ml', mult: 0.5 },
          { name: '500ml', mult: 0.85 },
          { name: '750ml', mult: 1.2 },
        ];
        break;
      case 'pieces':
        defaultLabel = 'Select Quantity / Pcs:';
        presets = [
          { name: '2 Pcs', mult: 0.5 },
          { name: '4 Pcs', mult: 0.85 },
          { name: '6 Pcs', mult: 1.2 },
          { name: '10 Pcs', mult: 1.8 },
        ];
        break;
      case 'colors':
        defaultLabel = 'Select Color / Shade:';
        presets = [
          { name: 'Red', mult: 1.0 },
          { name: 'Blue', mult: 1.0 },
          { name: 'Golden', mult: 1.0 },
          { name: 'Silver', mult: 1.0 },
          { name: 'Black', mult: 1.0 },
          { name: 'Pink', mult: 1.0 },
        ];
        break;
      case 'flavours':
        defaultLabel = 'Select Flavour / Taste:';
        presets = [
          { name: 'Classic / Original', mult: 1.0 },
          { name: 'Watermelon', mult: 1.0 },
          { name: 'Berry', mult: 1.0 },
          { name: 'Tropical', mult: 1.0 },
          { name: 'Sugarfree', mult: 1.0 },
        ];
        break;
      case 'numbers':
        defaultLabel = 'Select Number / Digit:';
        presets = [
          { name: 'Number 0', mult: 1.0 },
          { name: 'Number 1', mult: 1.0 },
          { name: 'Number 2', mult: 1.0 },
          { name: 'Number 3', mult: 1.0 },
          { name: 'Number 4', mult: 1.0 },
          { name: 'Number 5', mult: 1.0 },
          { name: 'Number 6', mult: 1.0 },
          { name: 'Number 7', mult: 1.0 },
          { name: 'Number 8', mult: 1.0 },
          { name: 'Number 9', mult: 1.0 },
        ];
        break;
    }

    setVariantCustomLabel(defaultLabel);

    setVariants(
      presets.map((p) => ({
        name: p.name,
        price: Math.round(defaultP * p.mult),
        imageUrl: '',
        imageFit: 'contain',
        available: true,
      }))
    );
  };

  const handleUpdateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Product name is required');
      return;
    }

    const finalCategory = category === 'Custom' ? customCategory.trim() : category;
    if (!finalCategory) {
      setFormError('Category is required');
      return;
    }

    let calculatedPrice = typeof basePrice === 'number' ? basePrice : 0;

    if (variantMode === 'size' && variants.length > 0) {
      calculatedPrice = Math.min(...variants.map((v) => v.price));
    }

    if (calculatedPrice <= 0 && (!variants || variants.length === 0)) {
      setFormError('Please enter a valid price for the product or sizes');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const primaryCoverFit = imageFits['0'] || imageFit || 'cover';

    // Strictly ensure imageFits only contains clean string index keys ('0', '1', '2'...) - NEVER raw URLs with dots/slashes
    const cleanImageFits: Record<string, 'cover' | 'contain'> = {};
    images.forEach((_, idx) => {
      cleanImageFits[String(idx)] = imageFits[String(idx)] || imageFit || 'cover';
    });

    const productPayload: Partial<Product> = {
      name: name.trim(),
      description: description.trim(),
      price: calculatedPrice,
      category: finalCategory,
      imageUrl: images[0] || '',
      images: images,
      available,
      isVegetarian: isNonFood ? false : isVegetarian,
      isNonFood,
      isFeatured,
      isPinnedToFront: isFeatured,
      imageFit: primaryCoverFit,
      imageFits: cleanImageFits,
      prepTimeMinutes: hasPrepTime && typeof prepTimeMinutes === 'number' ? prepTimeMinutes : undefined,
      variants:
        variantMode === 'size' && variants.length > 0
          ? variants.map((v) => ({
              ...v,
              name: v.name.trim() || 'Option',
              price: typeof v.price === 'number' ? v.price : Number(v.price) || 0,
              imageUrl: v.imageUrl?.trim() || undefined,
              imageFit: v.imageFit || 'contain',
              available: v.available !== false,
            }))
          : [],
      variantPresetType: variantMode === 'size' ? variantPresetType : undefined,
      variantCustomLabel: variantMode === 'size' && variantCustomLabel.trim() ? variantCustomLabel.trim() : undefined,
      showVariantsSeparately: variantMode === 'size' ? showVariantsSeparately : false,
      colorVariants: product?.colorVariants || [],
      groupId: product?.groupId,
      groupName: product?.groupName,
      groupVariantLabel: product?.groupVariantLabel,
    };

    try {
      await onSave({
        id: product?.id,
        productPayload,
        isFeatured,
      });
      onBack();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setFormError(err?.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-fadeIn">
      {/* Top Header Bar with Menu-Style Back Button */}
      <div className="bg-white/90 backdrop-blur-md sticky top-0 z-30 -mx-3 sm:mx-0 px-3 sm:px-0 py-2.5 sm:py-3 border-b border-slate-200/80 mb-2">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 max-w-4xl mx-auto">
          {/* Left: Back Button + Title */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full text-xs sm:text-[13px] font-bold text-slate-700 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
              id="product-form-back-btn"
              title="Back to Catalog"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Back</span>
            </button>

            <div className="min-w-0">
              <h2 className="font-heading font-extrabold text-sm sm:text-lg text-slate-900 tracking-tight leading-tight truncate">
                {product ? 'Edit Food Item' : 'Add Food Product'}
              </h2>
              <p className="hidden sm:block text-xs text-slate-500 font-medium truncate mt-0.5">
                {product
                  ? `Update details, portions & photos for "${product.name}"`
                  : 'Configure item pricing, sizes, and photos'}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="hidden sm:inline-flex px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit as any}
              disabled={isSubmitting || isCompressing}
              className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              id="save-product-top-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden xs:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{product ? 'Update' : 'Save Item'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-5">
        {formError && (
          <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-700 text-xs flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{formError}</span>
          </div>
        )}

        {/* SECTION 1: Basic Details Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/80 shadow-xs space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-extrabold text-xs">
                1
              </div>
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
                Basic Details
              </h3>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Required Info
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Product Title / Item Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Farmhouse Special Pizza, Choco Lava Cake"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Custom">+ Custom Category</option>
              </select>
              {category === 'Custom' && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom category name"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-slate-900"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Base Price (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  required={variantMode === 'single'}
                  placeholder="e.g. 199"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Status Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* Non-Food Item Toggle */}
            <label className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
              isNonFood ? 'bg-indigo-50/80 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
            }`}>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Package className={`w-4 h-4 ${isNonFood ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>Non-Food Item</span>
              </span>
              <input
                type="checkbox"
                checked={isNonFood}
                onChange={(e) => setIsNonFood(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-600 w-4 h-4 cursor-pointer"
              />
            </label>

            {/* 100% Pure Veg (Only for food items) */}
            <label className={`p-3.5 rounded-2xl border flex items-center justify-between transition-colors ${
              isNonFood
                ? 'bg-slate-50/50 border-slate-200/50 opacity-40 cursor-not-allowed'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 cursor-pointer'
            }`}>
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <span>100% Pure Veg</span>
              </span>
              <input
                type="checkbox"
                disabled={isNonFood}
                checked={!isNonFood && isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
                className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>

            <label className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 flex items-center justify-between cursor-pointer transition-colors">
              <span className="text-xs font-bold text-slate-700">In Stock & Ready</span>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 flex items-center justify-between cursor-pointer transition-colors">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Featured / Front</span>
              </span>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
          {isNonFood && (
            <p className="text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-200/60 rounded-xl px-3 py-1.5 font-medium -mt-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
              <span>Non-food item selected: Veg / Non-Veg tag will not appear on this product photo.</span>
            </p>
          )}

          {/* Preparation Time */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasPrepTime}
                onChange={(e) => setHasPrepTime(e.target.checked)}
                className="rounded text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Specify Kitchen Prep Time</span>
              </span>
            </label>

            {hasPrepTime && (
              <div className="flex items-center gap-2 pl-6 pt-1">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={prepTimeMinutes}
                  onChange={(e) => setPrepTimeMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <span className="text-xs font-semibold text-slate-500">minutes to prepare</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Description / Ingredients (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Freshly prepared with authentic ingredients..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
            />
          </div>
        </div>

        {/* SECTION 2: Portions & Sizes Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/80 shadow-xs space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-extrabold text-xs">
                2
              </div>
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
                Portions & Sizes
              </h3>
            </div>

            {/* Segmented Switch */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setVariantMode('single');
                  setHasVariants(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  variantMode === 'single'
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Price
              </button>
              <button
                type="button"
                onClick={() => {
                  setVariantMode('size');
                  setHasVariants(true);
                  if (variants.length === 0) handleAddVariant();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  variantMode === 'size'
                    ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Numbers / Sizes
              </button>
            </div>
          </div>

          {variantMode === 'single' ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600">
              Product has a flat price of <strong className="text-slate-900">₹{basePrice || 0}</strong>. Switch to <strong>Numbers / Sizes</strong> above to offer portions, weights, or custom options.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Presets Bar with Clean SVG Icons */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Quick Presets:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('sizes')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Ruler className="w-3.5 h-3.5 text-indigo-600" />
                    <span>S / M / L</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('plates')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Half / Full</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('weights')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Scale className="w-3.5 h-3.5 text-cyan-600" />
                    <span>250g / 500g / 1kg</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('drinks')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-600" />
                    <span>250ml / 500ml</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('pieces')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Boxes className="w-3.5 h-3.5 text-violet-600" />
                    <span>Pieces (2, 4, 6)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('colors')}
                    className="px-2.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-900 border border-pink-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Palette className="w-3.5 h-3.5 text-pink-600" />
                    <span>Colors (Red, Gold...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('flavours')}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Flavours (Watermelon...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPresetSizes('numbers')}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Hash className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Numbers (0..9)</span>
                  </button>
                </div>
              </div>

              {/* Option Title & Home Screen Separation Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col justify-center space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Option Section Title:</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Select Size:, Select Flavour:, Select Color:"
                    value={variantCustomLabel}
                    onChange={(e) => setVariantCustomLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 pr-2">
                      Show options as separate cards on Home Screen
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showVariantsSeparately}
                      onClick={() => setShowVariantsSeparately((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        showVariantsSeparately ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          showVariantsSeparately ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Options only appear as separate cards when photos are uploaded for them below.
                  </p>
                </div>
              </div>

              {/* Variants Rows */}
              <div className="space-y-2.5">
                {variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 sm:p-3 rounded-2xl border space-y-2 transition-all ${
                      variant.available === false
                        ? 'bg-rose-50/40 border-rose-200'
                        : 'bg-slate-50 border-slate-200/90'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
                      {/* Index badge */}
                      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-extrabold text-[11px] sm:text-xs shrink-0 ${
                        variant.available === false ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {idx + 1}
                      </div>

                      {/* Photo preview OR Upload / Link SVG Icon buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {variant.imageUrl ? (
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            {/* 4:3 Aspect Ratio Thumbnail Preview */}
                            <div className="relative w-12 h-9 sm:w-14 sm:h-10.5 rounded-lg overflow-hidden bg-white border border-slate-300 shadow-2xs group shrink-0">
                              <img
                                src={variant.imageUrl}
                                alt={variant.name || `Option ${idx + 1}`}
                                className={`w-full h-full ${
                                  variant.imageFit === 'contain' ? 'object-contain p-0.5 bg-white' : 'object-cover'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateVariant(idx, 'imageUrl', '')}
                                className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                                title="Remove photo"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {/* Fit / Fill toggle button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateVariant(
                                  idx,
                                  'imageFit',
                                  variant.imageFit === 'contain' ? 'cover' : 'contain'
                                )
                              }
                              className={`px-1.5 sm:px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer border ${
                                variant.imageFit === 'contain'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                              }`}
                              title="Toggle image Fit or Fill"
                            >
                              {variant.imageFit === 'contain' ? 'Fit' : 'Fill'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {/* Upload from device SVG icon button */}
                            <label
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
                              title="Upload photo from device"
                            >
                              {variantUploadingIdx === idx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleVariantFileUpload(idx, e.target.files[0]);
                                  }
                                }}
                              />
                            </label>

                            {/* Add photo via link SVG icon button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (linkInputVariantIdx === idx) {
                                  setLinkInputVariantIdx(null);
                                  setLinkInputValue('');
                                } else {
                                  setLinkInputVariantIdx(idx);
                                  setLinkInputValue('');
                                }
                              }}
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0 ${
                                linkInputVariantIdx === idx
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                              }`}
                              title="Enter photo web link"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Option Name Input */}
                      <div className="flex-1 min-w-[80px]">
                        <input
                          type="text"
                          placeholder={`Option ${idx + 1} (e.g. Small, Red)`}
                          value={variant.name}
                          onChange={(e) => handleUpdateVariant(idx, 'name', e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>

                      {/* Price Input */}
                      <div className="w-20 sm:w-24 relative shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="1"
                          placeholder="Price"
                          value={variant.price}
                          onChange={(e) =>
                            handleUpdateVariant(
                              idx,
                              'price',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          className="w-full pl-6 pr-2 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>

                      {/* Separate In Stock / Out of Stock Status Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateVariant(
                            idx,
                            'available',
                            variant.available === false ? true : false
                          )
                        }
                        className={`px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer select-none ${
                          variant.available !== false
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 shadow-2xs'
                        }`}
                        title={
                          variant.available !== false
                            ? 'Click to mark Out of Stock'
                            : 'Click to mark In Stock'
                        }
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            variant.available !== false ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span>{variant.available !== false ? 'In Stock' : 'Out of Stock'}</span>
                      </button>

                      {/* Remove option button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Remove Option"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>

                    {/* Inline URL Link Input popup when Link icon clicked */}
                    {linkInputVariantIdx === idx && (
                      <div className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-200 rounded-xl animate-fadeIn">
                        <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <input
                          type="url"
                          placeholder="Paste image URL (https://...)"
                          value={linkInputValue}
                          onChange={(e) => setLinkInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (linkInputValue.trim()) {
                                handleUpdateVariant(idx, 'imageUrl', linkInputValue.trim());
                                if (!variant.imageFit) handleUpdateVariant(idx, 'imageFit', 'contain');
                                setLinkInputVariantIdx(null);
                                setLinkInputValue('');
                              }
                            }
                          }}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (linkInputValue.trim()) {
                              handleUpdateVariant(idx, 'imageUrl', linkInputValue.trim());
                              if (!variant.imageFit) handleUpdateVariant(idx, 'imageFit', 'contain');
                              setLinkInputVariantIdx(null);
                              setLinkInputValue('');
                            }
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Set
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLinkInputVariantIdx(null);
                            setLinkInputValue('');
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddVariant}
                className="w-full py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Option</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: Photos & Gallery Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 border border-slate-200/80 shadow-xs space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-extrabold text-xs">
                3
              </div>
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
                Photos & Gallery
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline-block">
              Choose Fit or Fill individually for each photo below
            </span>
          </div>

          {/* Auto Find Photos Online Button */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-heading font-extrabold text-sm text-slate-900">
                  Instant Studio Photos
                </h4>
                <p className="text-xs text-slate-600">
                  Find appetizing, high-resolution food photos automatically for this dish.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAutoFindImages()}
              disabled={isSearchingImages}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
            >
              {isSearchingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Find Photos Online</span>
                </>
              )}
            </button>
          </div>

          {searchSuccessFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{searchSuccessFeedback}</span>
            </div>
          )}

          {/* Auto-detected images gallery selector */}
          {isDetectPanelOpen && detectedImages.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Found {detectedImages.length} High-Res Photos. Tap to select:
                </span>
                <button
                  type="button"
                  onClick={() => setIsDetectPanelOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {detectedImages.map((item, idx) => {
                  const isSelected = selectedDetectedUrls.includes(item.url);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleSelectDetectedImage(item.url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-slate-950 ring-2 ring-slate-950/20 scale-100 shadow-sm'
                          : 'border-slate-200 opacity-60 hover:opacity-100 scale-95'
                      }`}
                    >
                      <img
                        src={item.url}
                        alt={`Found food photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-950 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExistingOnSave}
                    onChange={(e) => setReplaceExistingOnSave(e.target.checked)}
                    className="rounded text-slate-900"
                  />
                  <span>Replace current photos</span>
                </label>

                <button
                  type="button"
                  onClick={handleApplyDetectedImages}
                  className="px-4 py-1.5 bg-slate-950 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
                >
                  Apply Selected Photos ({selectedDetectedUrls.length})
                </button>
              </div>
            </div>
          )}

          {/* Upload or paste URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-slate-700 transition-colors mb-2" />
              <span className="text-xs font-bold text-slate-800">
                Upload from Computer / Phone
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                PNG, JPG, WEBP (auto-compressed & saved to Cloud)
              </span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleMultipleImageFiles}
                className="hidden"
              />
            </label>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Paste Image Link</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Direct image URL from web
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Compression Progress */}
          {isCompressing && uploadProgress && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <span className="text-xs font-bold text-amber-900">{uploadProgress.stage}</span>
            </div>
          )}

          {/* Photo Gallery Grid */}
          {images.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-700 block">
                Active Gallery ({images.length} photos) — First photo is Primary Cover:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4 max-w-3xl">
                {images.map((img, idx) => {
                  const currentFit = imageFits[String(idx)] || imageFit || 'cover';

                  return (
                    <div
                      key={idx}
                      className="flex flex-col bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-2xs space-y-1.5 transition-all"
                    >
                      {/* Photo Thumbnail in 4:3 Aspect Ratio */}
                      <div className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-white flex items-center justify-center">
                        <img
                          src={img}
                          alt={`Photo ${idx + 1}`}
                          className={`w-full h-full ${currentFit === 'contain' ? 'object-contain p-1.5 bg-white' : 'object-cover'}`}
                        />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 backdrop-blur-md bg-white/65 hover:bg-white/80 border border-white/80 text-black/80 font-black text-[9px] tracking-wider px-2 py-0.5 rounded-lg shadow-[0_2px_8px_rgba(255,255,255,0.25)] select-none uppercase">
                            COVER
                          </span>
                        )}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)}
                              className="px-2 py-1 bg-white text-slate-900 rounded-lg text-[10px] font-extrabold cursor-pointer hover:bg-slate-100"
                              title="Make Cover"
                            >
                              Cover
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 bg-rose-600 text-white rounded-lg cursor-pointer hover:bg-rose-700"
                            title="Delete photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Individual Fit / Fill Toggle for THIS photo */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => handleUpdateImageFit(idx, 'cover')}
                          className={`py-1 rounded-md transition-all text-center cursor-pointer select-none ${
                            currentFit === 'cover'
                              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Fill (Cover): Crops/zooms image to fill the card frame"
                        >
                          Fill
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateImageFit(idx, 'contain')}
                          className={`py-1 rounded-md transition-all text-center cursor-pointer select-none ${
                            currentFit === 'contain'
                              ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          title="Fit (Contain): Shows entire photo without cropping"
                        >
                          Fit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Card */}
        <div className="flex items-center justify-between p-4 bg-slate-100 rounded-3xl border border-slate-200">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isCompressing}
            className="px-7 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 disabled:bg-slate-300 text-white font-heading font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            id="save-product-bottom-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Product...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{product ? 'Update Food Product' : 'Save & Publish Product'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
});
