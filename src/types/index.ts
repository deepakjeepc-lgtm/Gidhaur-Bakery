export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'rejected';

export interface ProductColorVariant {
  id?: string;
  name: string; // e.g. "Red", "Yellow", "Orange", "White", "Golden"
  colorCode?: string; // Hex color code e.g. "#EF4444"
  imageUrl?: string; // Dedicated photo for this specific color
  price: number;
  imageFit?: 'cover' | 'contain';
}

export interface ProductVariant {
  name: string; // e.g. "Small", "Medium", "Large", "Regular", "King Size", "Number 4"
  price: number;
  colorName?: string;
  colorCode?: string;
  imageUrl?: string;
  imageFit?: 'cover' | 'contain';
  available?: boolean; // In-stock status (default: true)
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  images?: string[];
  available: boolean;
  createdAt?: any;
  updatedAt?: any;
  isVegetarian?: boolean;
  isNonFood?: boolean;
  prepTimeMinutes?: number;
  imageFit?: 'cover' | 'contain';
  imageFits?: Record<string, 'cover' | 'contain'>;
  variants?: ProductVariant[];
  variantType?: 'size' | 'color';
  variantPresetType?: 'sizes' | 'plates' | 'weights' | 'portions' | 'drinks' | 'pieces' | 'colors' | 'flavours' | 'numbers' | 'custom';
  variantCustomLabel?: string;
  showVariantsSeparately?: boolean;
  defaultVariantIndex?: number;
  realProductId?: string;
  colorVariants?: ProductColorVariant[];
  groupId?: string;
  groupName?: string;
  groupVariantLabel?: string;
  selectedColorName?: string;
  selectedColorCode?: string;
  sortOrder?: number;
  isFeatured?: boolean;
  isPinnedToFront?: boolean;
}

export type PriceRangePreset = 'all' | 'under-200' | '200-400' | 'above-400' | 'custom';

export interface SearchFiltersState {
  searchQuery: string;
  priceRange: PriceRangePreset;
  customMinPrice?: number;
  customMaxPrice?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  selectedSize?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: string;
  isNonFood?: boolean;
  prepTimeMinutes?: number;
  hasKitchenPrepTime?: boolean;
}

export interface Order {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt?: any;
  // Multi-role workflow fields
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentPhone?: string;
  assignedAgentVehicle?: string;
  assignedAgentVehicleNumber?: string;
  kitchenStatus?: 'queued' | 'preparing' | 'ready' | 'dispatched';
  preparingStatus?: 'queued' | 'preparing' | 'ready' | 'dispatched';
  preparingSentAt?: any;
  preparedItems?: string[];
  dispatchedItems?: string[];
  dispatchedItemIndices?: number[];
  untickedItems?: string[];
  kitchenReady?: boolean;
  preparingReady?: boolean;
  kitchenTickedItems?: string[];
  preparingTickedItems?: string[];
  originalTotalAmount?: number;
  originalSubtotal?: number;
  paymentStatus?: 'unpaid' | 'paid';
  paymentMethod?: 'cod' | 'cash' | 'upi';
  upiTransactionRef?: string;
  paidAt?: any;
  kitchenSentAt?: any;
  acceptedAt?: any;
  dispatchedAt?: any;
  deliveredAt?: any;
  statusTimestamps?: Record<string, any>;
  deliveredAmount?: number;
  customerLocation?: { lat: number; lng: number };
  riderLocation?: { lat: number; lng: number; updatedAt?: any };
  deliveryFee?: number;
  distanceKm?: number;
  subtotal?: number;
  archivedAt?: string;
  isPreviousDayArchive?: boolean;
  isManualArchive?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  cancellationRequested?: boolean;
  cancellationStatus?: 'requested' | 'accepted' | 'rejected';
  cancellationReason?: string;
  cancellationRequestedAt?: any;
  cancellationResolvedAt?: any;
  customerEmail?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  selectedVariant?: ProductVariant;
  quantity: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  notes: string;
  email?: string;
}

export interface CustomerEmailRecord {
  id: string; // phone or normalized email
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  lastOrderDate: string;
  lastOrderId?: string;
  createdAt: string;
}

export interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  status: 'active' | 'inactive' | 'on_delivery';
  activeOrdersCount?: number;
  totalDeliveredCount?: number;
  createdAt?: any;
}

export interface KitchenStaff {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  role: string; // e.g. "Head Chef", "Fast Food Specialist", "Pastry Chef"
  status: 'active' | 'inactive';
  createdAt?: any;
}

export interface PreparingStaff {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  role: string; // e.g. "Lead Packer", "Party Props Specialist", "Packing Agent"
  status: 'active' | 'inactive';
  createdAt?: any;
}

export interface FestivalSettings {
  isEnabled: boolean;
  activeFestival?: string;
  showConfettiCelebration?: boolean;
  ambientDecorEnabled?: boolean;
}

export interface WebsiteBrandingSettings {
  websiteTitle?: string; // Browser tab title
  websiteTagline?: string; // Tagline e.g. "Freshly Baked Every Morning"
  websiteDescription?: string; // Meta description for search engines
  faviconUrl?: string; // Browser tab favicon (e.g. Google Flow / ChatGPT / AI Studio tab icon)
  searchLogoUrl?: string; // Search engine result logo (e.g. Flipkart logo on Google search results)
  headerLogoUrl?: string; // Main store logo shown when website opens in navbar
  headerLogoFit?: 'contain' | 'cover'; // Fit vs Fill display mode for the floating navbar logo
  headerLogoHeight?: number; // Zoom / height in pixels (24px to 54px, default 38px)
  pwaIconUrl?: string; // Add to home screen / mobile app icon (192x192 / 512x512)
}

export interface RestaurantSettings extends WebsiteBrandingSettings {
  homeScreenMessage?: string; // Headline shown on mobile home screen (e.g. "I want to Eat...")
  homeHeadlineFont?: string; // Font family name e.g. 'Plus Jakarta Sans', 'Roboto Mono', 'Pacifico', etc.
  homeHeadlineColor?: string; // Hex color e.g. '#0f172a'
  homeHeadlineSize?: number; // Size in px (e.g. 24, 28, 32)
  globalTracking?: number; // Global letter-spacing in em (e.g. 0.015)
  categoryActiveColor?: string; // Active category icon and text color
  categoryInactiveColor?: string; // Inactive category icon and text color
  enableOnlinePayment?: boolean;
  festivalMode?: boolean | FestivalSettings;
  upiId: string;
  upiPayeeName: string;
  restaurantName: string;
  contactPhone?: string;
  address?: string;
  openingHours?: string;
  isStoreOpen?: boolean;
  minOrderAmount?: number;
  defaultPrepTimeMinutes?: number;
  // Distance-Based Dynamic Delivery Fee Configuration
  freeDeliveryRadiusKm?: number; // default 5 (0-5 km: Free Delivery)
  tier1MaxKm?: number; // default 6 (5-6 km: ₹25)
  tier1Fee?: number; // default 25
  tier2MaxKm?: number; // default 8 (6-8 km: ₹30)
  tier2Fee?: number; // default 30
  beyondTier2PerKmFee?: number; // default 10 per additional km
  restaurantLat?: number;
  restaurantLng?: number;
  // FSSAI License Number (default: 20426191000010)
  fssaiLicenseNumber?: string;
  // Email Notifications & Checkout requirement settings
  isEmailMandatory?: boolean;
  enableEmailNotifications?: boolean;
  senderEmail?: string;
  senderEmailPassword?: string;
  senderName?: string;
  emailEventToggles?: {
    notifyOrderPlaced?: boolean;
    notifyOrderConfirmed?: boolean;
    notifyKitchenSent?: boolean;
    notifyOutForDelivery?: boolean;
    notifyDelivered?: boolean;
    notifyCancellationAccepted?: boolean;
    notifyCancellationDeclined?: boolean;
  };
}

export type StaffRole = 'admin' | 'kitchen' | 'preparing' | 'delivery';

export interface StaffSession {
  role: StaffRole;
  data: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

export interface PromotionalBanner {
  id: string;
  badge: string; // e.g., "Special Offer", "Flat 20% OFF", "Chef's Special"
  title: string; // e.g., "Artisan Pizzas & Burger Combos"
  description: string; // e.g., "Get 20% off on all freshly crafted pizzas and gourmet combos."
  couponCode?: string; // e.g., "SWADEEP20"
  discountText?: string; // e.g., "20% OFF" or "FREE DELIVERY"
  targetCategory?: string; // e.g., "Combos", "Desserts", "Pizzas" or "All"
  targetProductId?: string; // Optional direct product link
  buttonText?: string; // e.g., "Order Now", "Explore Combos"
  imageUrl?: string; // Food photography or illustration
  isActive: boolean;
  order: number;
  createdAt?: string;
}

export interface BannerSettings {
  isEnabled: boolean; // Master toggle to show/hide carousel
  autoSlideIntervalSeconds: number; // e.g., 5 seconds
  banners: PromotionalBanner[];
}
