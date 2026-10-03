import React from 'react';
import {
  Utensils,
  UtensilsCrossed,
  Pizza,
  Coffee,
  Cake,
  IceCream,
  IceCream2,
  Cookie,
  Soup,
  Wine,
  Beer,
  Apple,
  Sandwich,
  Salad,
  Egg,
  Fish,
  Flame,
  Sparkles,
  ChefHat,
  ShoppingBag,
  Package,
  Layers,
  Star,
  Zap,
  Award,
  Milk,
  Citrus,
  CupSoda,
  GlassWater,
  Popcorn,
  Candy,
  Lollipop,
  Cherry,
  Carrot,
  Wheat,
  Croissant,
  Drumstick,
  Heart,
  Grid,
  Store,
  Tag,
  CircleDot
} from 'lucide-react';

export interface IconOption {
  id: string;
  name: string;
  keywords: string[];
  component: React.FC<{ className?: string }>;
}

export const LUCIDE_FOOD_ICONS: IconOption[] = [
  { id: 'Pizza', name: 'Pizza', keywords: ['pizza', 'slice', 'italian', 'crust'], component: Pizza },
  { id: 'Utensils', name: 'Utensils / Meals', keywords: ['meals', 'food', 'fork', 'knife', 'dinner', 'lunch', 'main course'], component: Utensils },
  { id: 'UtensilsCrossed', name: 'Restaurant / Dining', keywords: ['dining', 'chef', 'restaurant', 'meals', 'specials'], component: UtensilsCrossed },
  { id: 'Sandwich', name: 'Sandwich / Burger', keywords: ['sandwich', 'burger', 'toast', 'bread', 'sub'], component: Sandwich },
  { id: 'Coffee', name: 'Coffee / Hot Drinks', keywords: ['coffee', 'tea', 'latte', 'espresso', 'cappuccino', 'hot'], component: Coffee },
  { id: 'CupSoda', name: 'Soda / Soft Drinks', keywords: ['soda', 'cold drink', 'soft drink', 'beverages', 'cola', 'fizzy'], component: CupSoda },
  { id: 'GlassWater', name: 'Cold Beverages', keywords: ['water', 'juice', 'shake', 'beverage', 'drink'], component: GlassWater },
  { id: 'Cake', name: 'Cake / Pastry', keywords: ['cake', 'pastry', 'dessert', 'birthday', 'sweet'], component: Cake },
  { id: 'IceCream', name: 'Ice Cream Cone', keywords: ['ice cream', 'gelato', 'dessert', 'cone', 'cold'], component: IceCream },
  { id: 'IceCream2', name: 'Sundae / Popsicle', keywords: ['ice cream', 'popsicle', 'sundae', 'dessert'], component: IceCream2 },
  { id: 'Cookie', name: 'Cookie / Bakery', keywords: ['cookie', 'bakery', 'biscuit', 'snack', 'sweet'], component: Cookie },
  { id: 'Croissant', name: 'Croissant / Bakery', keywords: ['croissant', 'bakery', 'bread', 'pastry', 'french'], component: Croissant },
  { id: 'Wheat', name: 'Bakery & Bread', keywords: ['bakery', 'wheat', 'flour', 'bread', 'grain'], component: Wheat },
  { id: 'Soup', name: 'Soup & Bowls', keywords: ['soup', 'noodles', 'broth', 'bowl', 'ramen', 'hot'], component: Soup },
  { id: 'Salad', name: 'Salad & Healthy', keywords: ['salad', 'healthy', 'diet', 'greens', 'veg'], component: Salad },
  { id: 'Popcorn', name: 'Popcorn & Snacks', keywords: ['popcorn', 'snack', 'munchies', 'theater', 'crisps'], component: Popcorn },
  { id: 'Candy', name: 'Chocolates & Candy', keywords: ['candy', 'choclate', 'chocolate', 'toffee', 'sweet'], component: Candy },
  { id: 'Lollipop', name: 'Lollipop & Sweets', keywords: ['lollipop', 'sweet', 'sugar', 'dessert'], component: Lollipop },
  { id: 'Apple', name: 'Fresh Fruits', keywords: ['apple', 'fruit', 'healthy', 'fresh'], component: Apple },
  { id: 'Citrus', name: 'Citrus & Mocktails', keywords: ['lemon', 'lime', 'citrus', 'juice', 'mocktail'], component: Citrus },
  { id: 'Milk', name: 'Milkshakes & Dairy', keywords: ['milk', 'dairy', 'milkshake', 'latte'], component: Milk },
  { id: 'Egg', name: 'Eggs & Breakfast', keywords: ['egg', 'breakfast', 'omelette', 'morning'], component: Egg },
  { id: 'Fish', name: 'Fish & Seafood', keywords: ['fish', 'seafood', 'prawns', 'sea'], component: Fish },
  { id: 'Drumstick', name: 'Chicken & Grill', keywords: ['chicken', 'drumstick', 'grill', 'bbq', 'non-veg'], component: Drumstick },
  { id: 'Carrot', name: 'Vegetarian', keywords: ['carrot', 'veg', 'pure veg', 'organic', 'vegetable'], component: Carrot },
  { id: 'Flame', name: 'Spicy & Hot Specials', keywords: ['flame', 'spicy', 'hot', 'tandoori', 'special', 'fire'], component: Flame },
  { id: 'Sparkles', name: 'Combos & Best Deals', keywords: ['combo', 'combos', 'special', 'star', 'deal', 'featured'], component: Sparkles },
  { id: 'ChefHat', name: 'Chef Specials', keywords: ['chef', 'special', 'signature', 'gourmet'], component: ChefHat },
  { id: 'ShoppingBag', name: 'Party Packs & Bundles', keywords: ['bag', 'pack', 'bundle', 'party', 'bulk'], component: ShoppingBag },
  { id: 'Package', name: 'Combos & Boxes', keywords: ['box', 'combo', 'meal box', 'thali', 'package'], component: Package },
  { id: 'Layers', name: 'All Categories', keywords: ['layers', 'menu', 'category', 'collection'], component: Layers },
  { id: 'Star', name: 'Bestsellers', keywords: ['star', 'bestseller', 'top', 'favorite', 'must try'], component: Star },
  { id: 'Award', name: 'Premium Range', keywords: ['award', 'premium', 'signature', 'gold'], component: Award },
  { id: 'Heart', name: 'Customer Favorites', keywords: ['heart', 'favorite', 'loved', 'popular'], component: Heart }
];

export const POPULAR_FOOD_EMOJIS = [
  { emoji: '🍕', name: 'Pizza', keywords: ['pizza', 'italian', 'slice'] },
  { emoji: '🍔', name: 'Burger', keywords: ['burger', 'hamburger', 'fast food'] },
  { emoji: '🥪', name: 'Sandwich', keywords: ['sandwich', 'toast', 'sub'] },
  { emoji: '🍟', name: 'French Fries', keywords: ['fries', 'potato', 'snack'] },
  { emoji: '🌮', name: 'Taco / Mexican', keywords: ['taco', 'mexican', 'wrap'] },
  { emoji: '🌯', name: 'Burrito / Wrap', keywords: ['wrap', 'roll', 'kathi roll', 'burrito'] },
  { emoji: '🥗', name: 'Salad', keywords: ['salad', 'healthy', 'greens'] },
  { emoji: '🍜', name: 'Noodles / Ramen', keywords: ['noodles', 'maggi', 'chinese', 'ramen', 'pasta'] },
  { emoji: '🍝', name: 'Spaghetti / Pasta', keywords: ['pasta', 'spaghetti', 'italian', 'macaroni'] },
  { emoji: '🍛', name: 'Curry / Rice', keywords: ['curry', 'rice', 'dal', 'biryani', 'meal'] },
  { emoji: '🍲', name: 'Soup / Hot Pot', keywords: ['soup', 'stew', 'broth', 'hot pot'] },
  { emoji: '🍱', name: 'Bento / Thali', keywords: ['thali', 'combo', 'meal', 'bento', 'box'] },
  { emoji: '🥟', name: 'Momos / Dumplings', keywords: ['momos', 'dumpling', 'dimsum'] },
  { emoji: '🥘', name: 'Pan Food / Kadai', keywords: ['kadai', 'paneer', 'gravy', 'curry'] },
  { emoji: '🍨', name: 'Ice Cream', keywords: ['ice cream', 'gelato', 'dessert', 'cold'] },
  { emoji: '🍦', name: 'Soft Serve', keywords: ['ice cream', 'cone', 'vanilla'] },
  { emoji: '🍰', name: 'Cake & Pastry', keywords: ['cake', 'pastry', 'dessert', 'sweet'] },
  { emoji: '🎂', name: 'Birthday Cake', keywords: ['cake', 'celebration', 'bakery'] },
  { emoji: '🧁', name: 'Cupcake', keywords: ['cupcake', 'muffin', 'bakery'] },
  { emoji: '🍩', name: 'Donut', keywords: ['donut', 'doughnut', 'sweet', 'bakery'] },
  { emoji: '🍪', name: 'Cookies', keywords: ['cookie', 'biscuit', 'bakery', 'snack'] },
  { emoji: '🍫', name: 'Chocolate', keywords: ['chocolate', 'choclate', 'cadbury', 'dark'] },
  { emoji: '🍬', name: 'Candy / Sweets', keywords: ['candy', 'sweet', 'mithai', 'sugar'] },
  { emoji: '☕', name: 'Hot Coffee / Tea', keywords: ['coffee', 'tea', 'chai', 'hot', 'cappuccino'] },
  { emoji: '🧋', name: 'Boba / Milk Tea', keywords: ['boba', 'bubble tea', 'shake', 'cold coffee'] },
  { emoji: '🥤', name: 'Cold Drink / Juice', keywords: ['cold drink', 'soda', 'juice', 'shake', 'beverages'] },
  { emoji: '🍹', name: 'Mocktail / Tropical', keywords: ['mocktail', 'cocktail', 'cooler', 'mojito'] },
  { emoji: '🧃', name: 'Juice Box', keywords: ['juice', 'mango', 'orange', 'fresh'] },
  { emoji: '🍿', name: 'Popcorn', keywords: ['popcorn', 'snack', 'munchies'] },
  { emoji: '🥨', name: 'Pretzel / Bakery', keywords: ['pretzel', 'bakery', 'snack'] },
  { emoji: '🥐', name: 'Croissant', keywords: ['croissant', 'bakery', 'french'] },
  { emoji: '🍞', name: 'Bread / Bakery', keywords: ['bread', 'toast', 'bakery', 'loaf'] },
  { emoji: '🧀', name: 'Cheese', keywords: ['cheese', 'cheesy', 'extra cheese'] },
  { emoji: '🍓', name: 'Strawberry', keywords: ['strawberry', 'fruit', 'berry'] },
  { emoji: '🥭', name: 'Mango', keywords: ['mango', 'fruit', 'shake', 'alphonso'] },
  { emoji: '🥑', name: 'Avocado', keywords: ['avocado', 'healthy', 'toast'] },
  { emoji: '✨', name: 'Combos & Specials', keywords: ['special', 'combo', 'bestseller', 'star'] },
  { emoji: '🔥', name: 'Spicy & Sizzlers', keywords: ['spicy', 'hot', 'tandoori', 'chilli'] }
];

// Helper to render Category Icon dynamically
export interface CategoryVisual {
  iconType?: 'emoji' | 'lucide' | 'svg' | 'custom_svg';
  iconValue?: string;
}

export const renderCategoryIcon = (
  visual?: CategoryVisual | null,
  categoryName?: string,
  className = 'w-3.5 h-3.5 shrink-0'
): React.ReactNode => {
  if (!visual || !visual.iconValue) {
    // Automatic fallback icon based on category name
    const lower = (categoryName || '').toLowerCase();
    if (lower.includes('pizza')) return <Pizza className={className} />;
    if (lower.includes('burger')) return <Sandwich className={className} />;
    if (lower.includes('sandwich') || lower.includes('toast')) return <Sandwich className={className} />;
    if (lower.includes('ice cream') || lower.includes('gelato')) return <IceCream className={className} />;
    if (lower.includes('cake') || lower.includes('pastry')) return <Cake className={className} />;
    if (lower.includes('dessert') || lower.includes('sweet')) return <Cake className={className} />;
    if (lower.includes('choc')) return <Candy className={className} />;
    if (lower.includes('beverage') || lower.includes('drink') || lower.includes('shake')) return <CupSoda className={className} />;
    if (lower.includes('coffee') || lower.includes('tea') || lower.includes('chai')) return <Coffee className={className} />;
    if (lower.includes('bakery') || lower.includes('bread') || lower.includes('cookie')) return <Cookie className={className} />;
    if (lower.includes('snack') || lower.includes('munch')) return <Popcorn className={className} />;
    if (lower.includes('meal') || lower.includes('thali') || lower.includes('rice')) return <Utensils className={className} />;
    if (lower.includes('combo')) return <Sparkles className={className} />;
    return null;
  }

  // 1. Emoji Type
  if (visual.iconType === 'emoji' || (!visual.iconType && visual.iconValue.length <= 4)) {
    return <span className="text-sm leading-none shrink-0 select-none">{visual.iconValue}</span>;
  }

  // 2. Lucide Icon Type
  if (visual.iconType === 'lucide') {
    const found = LUCIDE_FOOD_ICONS.find((i) => i.id.toLowerCase() === visual.iconValue?.toLowerCase());
    if (found) {
      const Comp = found.component;
      return <Comp className={className} />;
    }
  }

  // 3. Custom SVG String or Data
  if (visual.iconType === 'custom_svg' || visual.iconType === 'svg') {
    if (visual.iconValue.trim().startsWith('<svg')) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full ${className}`}
          dangerouslySetInnerHTML={{ __html: visual.iconValue }}
        />
      );
    }
    // If it is an image URL
    if (visual.iconValue.startsWith('http') || visual.iconValue.startsWith('data:image')) {
      return (
        <img
          src={visual.iconValue}
          alt={categoryName || 'category icon'}
          className={`${className} object-contain`}
          referrerPolicy="no-referrer"
        />
      );
    }
  }

  // Fallback try matching Lucide icon id
  const directLucide = LUCIDE_FOOD_ICONS.find((i) => i.id.toLowerCase() === visual.iconValue?.toLowerCase());
  if (directLucide) {
    const Comp = directLucide.component;
    return <Comp className={className} />;
  }

  return null;
};
