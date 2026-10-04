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
  CircleDot,
  PartyPopper,
  Gift,
  Boxes
} from 'lucide-react';

export interface IconOption {
  id: string;
  name: string;
  keywords: string[];
  component: React.FC<{ className?: string }>;
}

export const LUCIDE_FOOD_ICONS: IconOption[] = [
  { id: 'Pizza', name: 'Pizza & Garlic Bread', keywords: ['pizza', 'slice', 'italian', 'crust'], component: Pizza },
  { id: 'Sandwich', name: 'Burger & Sandwich', keywords: ['sandwich', 'burger', 'burgers', 'toast', 'bread', 'sub'], component: Sandwich },
  { id: 'Cake', name: 'Cakes & Pastries', keywords: ['cake', 'pastry', 'pastries', 'cupcake', 'dessert', 'birthday', 'sweet'], component: Cake },
  { id: 'Croissant', name: 'Bakery & Croissant', keywords: ['croissant', 'bakery', 'bread', 'pastry', 'french'], component: Croissant },
  { id: 'Wheat', name: 'Artisan Breads & Bakery', keywords: ['bakery', 'wheat', 'flour', 'bread', 'grain'], component: Wheat },
  { id: 'Cookie', name: 'Cookies & Biscuits', keywords: ['cookie', 'cookies', 'bakery', 'biscuit', 'biscuits', 'snack', 'sweet'], component: Cookie },
  { id: 'Coffee', name: 'Hot & Cold Coffee', keywords: ['coffee', 'tea', 'latte', 'espresso', 'cappuccino', 'hot', 'cold coffee'], component: Coffee },
  { id: 'Milk', name: 'Milkshakes & Dairy', keywords: ['milk', 'dairy', 'milkshake', 'milkshakes', 'paneer', 'cheese', 'latte'], component: Milk },
  { id: 'CupSoda', name: 'Soft Drinks & Soda', keywords: ['soda', 'cold drink', 'soft drink', 'soft drinks', 'cold drinks', 'beverages', 'cola', 'fizzy'], component: CupSoda },
  { id: 'GlassWater', name: 'Chilled Juices & Drinks', keywords: ['water', 'juice', 'shake', 'beverage', 'drink'], component: GlassWater },
  { id: 'Zap', name: 'Energy & Sports Drinks', keywords: ['energy', 'sports', 'sting', 'red bull', 'monster', 'boost', 'power'], component: Zap },
  { id: 'Candy', name: 'Chocolates & Candies', keywords: ['candy', 'choclate', 'chocolate', 'chocolates', 'toffee', 'sweet'], component: Candy },
  { id: 'Lollipop', name: 'Traditional Sweets & Mithai', keywords: ['lollipop', 'sweet', 'sweets', 'mithai', 'sugar', 'dessert', 'chamcham', 'barfi'], component: Lollipop },
  { id: 'IceCream', name: 'Ice Creams & Sundaes', keywords: ['ice cream', 'ice creams', 'gelato', 'dessert', 'cone', 'cold', 'sundae'], component: IceCream },
  { id: 'IceCream2', name: 'Sundae & Popsicles', keywords: ['ice cream', 'popsicle', 'sundae', 'dessert'], component: IceCream2 },
  { id: 'Soup', name: 'Fast Food, Noodles & Pasta', keywords: ['soup', 'noodles', 'pasta', 'fast food', 'broth', 'bowl', 'ramen', 'chinese'], component: Soup },
  { id: 'Popcorn', name: 'Snacks & Munchies', keywords: ['popcorn', 'snack', 'snacks', 'samosa', 'munchies', 'crisps', 'namkeen'], component: Popcorn },
  { id: 'Utensils', name: 'Meals & Platters', keywords: ['meals', 'food', 'fork', 'knife', 'dinner', 'lunch', 'main course'], component: Utensils },
  { id: 'UtensilsCrossed', name: 'Rolls, Wraps & Dining', keywords: ['rolls', 'roll', 'wrap', 'wraps', 'dining', 'chef', 'restaurant', 'meals', 'specials'], component: UtensilsCrossed },
  { id: 'PartyPopper', name: 'Balloons & Party Decoration', keywords: ['party', 'decoration', 'balloon', 'balloons', 'celebration', 'jhalar', 'foil'], component: PartyPopper },
  { id: 'Gift', name: 'Birthday & Anniversary Gifts', keywords: ['gift', 'birthday', 'anniversary', 'sash', 'queen', 'surprise', 'party pack'], component: Gift },
  { id: 'Sparkles', name: 'Combos & Best Deals', keywords: ['combo', 'combos', 'special', 'star', 'deal', 'featured', 'decor'], component: Sparkles },
  { id: 'ChefHat', name: 'Chef Specials & Gourmet', keywords: ['chef', 'special', 'signature', 'gourmet'], component: ChefHat },
  { id: 'Package', name: 'Gift Hampers & Boxes', keywords: ['box', 'combo', 'meal box', 'thali', 'package', 'hamper'], component: Package },
  { id: 'ShoppingBag', name: 'Party Packs & Bundles', keywords: ['bag', 'pack', 'bundle', 'party', 'bulk'], component: ShoppingBag },
  { id: 'Salad', name: 'Healthy Salads & Bowls', keywords: ['salad', 'healthy', 'diet', 'greens', 'veg'], component: Salad },
  { id: 'Citrus', name: 'Mocktails & Coolers', keywords: ['lemon', 'lime', 'citrus', 'juice', 'mocktail'], component: Citrus },
  { id: 'Flame', name: 'Spicy & Hot Bites', keywords: ['flame', 'spicy', 'hot', 'tandoori', 'special', 'fire'], component: Flame },
  { id: 'Egg', name: 'Breakfast & Brunch', keywords: ['egg', 'breakfast', 'omelette', 'morning', 'brunch'], component: Egg },
  { id: 'Star', name: 'Bestsellers & Specials', keywords: ['star', 'bestseller', 'top', 'favorite', 'must try'], component: Star },
  { id: 'Award', name: 'Premium Range', keywords: ['award', 'premium', 'signature', 'gold'], component: Award },
  { id: 'Heart', name: 'Customer Favorites', keywords: ['heart', 'favorite', 'loved', 'popular'], component: Heart },
  { id: 'Layers', name: 'All Categories', keywords: ['layers', 'menu', 'category', 'collection'], component: Layers }
];

export const POPULAR_FOOD_EMOJIS = [
  { emoji: '🍕', name: 'Pizza', keywords: ['pizza', 'italian', 'slice'] },
  { emoji: '🍔', name: 'Burger', keywords: ['burger', 'burgers', 'hamburger', 'fast food'] },
  { emoji: '🥪', name: 'Sandwich', keywords: ['sandwich', 'toast', 'sub'] },
  { emoji: '🍟', name: 'French Fries', keywords: ['fries', 'potato', 'snack'] },
  { emoji: '🌮', name: 'Taco / Mexican', keywords: ['taco', 'mexican', 'wrap'] },
  { emoji: '🌯', name: 'Burrito / Wrap', keywords: ['wrap', 'roll', 'kathi roll', 'burrito'] },
  { emoji: '🥗', name: 'Salad', keywords: ['salad', 'healthy', 'greens'] },
  { emoji: '🍜', name: 'Noodles / Chinese', keywords: ['noodles', 'maggi', 'chinese', 'ramen', 'pasta', 'fast food'] },
  { emoji: '🍝', name: 'Spaghetti / Pasta', keywords: ['pasta', 'spaghetti', 'italian', 'macaroni'] },
  { emoji: '🍛', name: 'Curry / Rice', keywords: ['curry', 'rice', 'dal', 'biryani', 'meal'] },
  { emoji: '🍲', name: 'Soup / Hot Pot', keywords: ['soup', 'stew', 'broth', 'hot pot'] },
  { emoji: '🍱', name: 'Bento / Thali', keywords: ['thali', 'combo', 'meal', 'bento', 'box'] },
  { emoji: '🥟', name: 'Momos / Dumplings', keywords: ['momos', 'dumpling', 'dimsum'] },
  { emoji: '🍨', name: 'Ice Cream', keywords: ['ice cream', 'ice creams', 'gelato', 'dessert', 'cold'] },
  { emoji: '🍦', name: 'Soft Serve', keywords: ['ice cream', 'cone', 'vanilla'] },
  { emoji: '🍰', name: 'Cake & Pastry', keywords: ['cake', 'cakes', 'pastry', 'pastries', 'dessert', 'sweet'] },
  { emoji: '🎂', name: 'Birthday Cake', keywords: ['cake', 'celebration', 'bakery', 'birthday'] },
  { emoji: '🧁', name: 'Cupcake', keywords: ['cupcake', 'muffin', 'bakery'] },
  { emoji: '🍩', name: 'Donut', keywords: ['donut', 'doughnut', 'sweet', 'bakery'] },
  { emoji: '🍪', name: 'Cookies', keywords: ['cookie', 'cookies', 'biscuit', 'bakery', 'snack'] },
  { emoji: '🍫', name: 'Chocolate', keywords: ['chocolate', 'chocolates', 'choclate', 'cadbury', 'dark'] },
  { emoji: '🍬', name: 'Candy / Sweets', keywords: ['candy', 'sweet', 'sweets', 'mithai', 'sugar'] },
  { emoji: '☕', name: 'Hot Coffee / Tea', keywords: ['coffee', 'tea', 'chai', 'hot', 'cappuccino'] },
  { emoji: '🧋', name: 'Milkshakes & Boba', keywords: ['milkshake', 'milkshakes', 'boba', 'shake', 'cold coffee'] },
  { emoji: '🥤', name: 'Cold Drink & Soda', keywords: ['cold drink', 'cold drinks', 'soft drink', 'soft drinks', 'soda', 'juice', 'beverages'] },
  { emoji: '⚡', name: 'Energy Drink', keywords: ['energy', 'sports drink', 'sting', 'red bull', 'monster'] },
  { emoji: '🎈', name: 'Party Balloons & Decor', keywords: ['balloon', 'balloons', 'decoration', 'decor', 'party'] },
  { emoji: '🎉', name: 'Party & Celebration', keywords: ['party', 'celebration', 'anniversary', 'birthday', 'popper'] },
  { emoji: '🎁', name: 'Gift Hampers', keywords: ['gift', 'hamper', 'combo', 'birthday', 'anniversary'] },
  { emoji: '🍹', name: 'Mocktail / Cooler', keywords: ['mocktail', 'cooler', 'mojito'] },
  { emoji: '🍿', name: 'Popcorn & Munchies', keywords: ['popcorn', 'snack', 'snacks', 'munchies'] },
  { emoji: '🥐', name: 'Croissant / Bakery', keywords: ['croissant', 'bakery', 'bread'] },
  { emoji: '🍞', name: 'Bread / Loaf', keywords: ['bread', 'toast', 'bakery', 'loaf'] },
  { emoji: '🧀', name: 'Paneer & Cheese', keywords: ['paneer', 'cheese', 'dairy'] },
  { emoji: '✨', name: 'Combos & Specials', keywords: ['special', 'combo', 'bestseller', 'star'] },
  { emoji: '🔥', name: 'Spicy & Hot', keywords: ['spicy', 'hot', 'tandoori', 'chilli'] }
];

// Helper to render Category Icon dynamically with guaranteed fallback
export interface CategoryVisual {
  iconType?: 'emoji' | 'lucide' | 'svg' | 'custom_svg';
  iconValue?: string;
}

export const renderCategoryIcon = (
  visual?: CategoryVisual | null,
  categoryName?: string,
  className = 'w-3.5 h-3.5 shrink-0'
): React.ReactNode => {
  // If visual is provided and valid
  if (visual && visual.iconValue) {
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

    // Direct Lucide name match
    const directLucide = LUCIDE_FOOD_ICONS.find((i) => i.id.toLowerCase() === visual.iconValue?.toLowerCase());
    if (directLucide) {
      const Comp = directLucide.component;
      return <Comp className={className} />;
    }
  }

  // Automatic smart icon matching based on category name
  const lower = (categoryName || '').toLowerCase().trim();
  if (lower.includes('pizza')) return <Pizza className={className} />;
  if (lower.includes('burger')) return <Sandwich className={className} />;
  if (lower.includes('sandwich') || lower.includes('toast') || lower.includes('sub')) return <Sandwich className={className} />;
  if (lower.includes('cake') || lower.includes('cupcake')) return <Cake className={className} />;
  if (lower.includes('pastry') || lower.includes('pastries') || lower.includes('tart')) return <Cake className={className} />;
  if (lower.includes('cookie') || lower.includes('biscuit')) return <Cookie className={className} />;
  if (lower.includes('croissant')) return <Croissant className={className} />;
  if (lower.includes('bakery') || lower.includes('bread')) return <Wheat className={className} />;
  if (lower.includes('coffee') || lower.includes('cafe')) return <Coffee className={className} />;
  if (lower.includes('tea') || lower.includes('chai')) return <Coffee className={className} />;
  if (lower.includes('energy') || lower.includes('sport')) return <Zap className={className} />;
  if (lower.includes('shake') || lower.includes('milkshake')) return <Milk className={className} />;
  if (lower.includes('soda') || lower.includes('soft drink') || lower.includes('cold drink')) return <CupSoda className={className} />;
  if (lower.includes('beverage') || lower.includes('drink') || lower.includes('juice')) return <GlassWater className={className} />;
  if (lower.includes('choc')) return <Candy className={className} />;
  if (lower.includes('sweet') || lower.includes('mithai') || lower.includes('barfi')) return <Lollipop className={className} />;
  if (lower.includes('ice cream') || lower.includes('gelato') || lower.includes('sundae')) return <IceCream className={className} />;
  if (lower.includes('dessert') || lower.includes('pudding')) return <IceCream2 className={className} />;
  if (lower.includes('decor') || lower.includes('balloon') || lower.includes('jhalar') || lower.includes('foil')) return <PartyPopper className={className} />;
  if (lower.includes('birthday') || lower.includes('anniversary') || lower.includes('gift') || lower.includes('sash')) return <Gift className={className} />;
  if (lower.includes('noodle') || lower.includes('pasta') || lower.includes('soup') || lower.includes('chinese') || lower.includes('chow')) return <Soup className={className} />;
  if (lower.includes('fast food') || lower.includes('hot dog') || lower.includes('momos')) return <UtensilsCrossed className={className} />;
  if (lower.includes('snack') || lower.includes('samosa') || lower.includes('munch')) return <Popcorn className={className} />;
  if (lower.includes('paneer') || lower.includes('dairy') || lower.includes('cheese')) return <Milk className={className} />;
  if (lower.includes('salad') || lower.includes('bowl')) return <Salad className={className} />;
  if (lower.includes('roll') || lower.includes('wrap')) return <UtensilsCrossed className={className} />;
  if (lower.includes('breakfast') || lower.includes('brunch') || lower.includes('egg')) return <Egg className={className} />;
  if (lower.includes('combo') || lower.includes('deal') || lower.includes('special')) return <Sparkles className={className} />;
  if (lower.includes('chef') || lower.includes('gourmet')) return <ChefHat className={className} />;
  if (lower.includes('package') || lower.includes('box') || lower.includes('hamper')) return <Package className={className} />;

  // Guaranteed fallback: NEVER return null, always display a sleek icon!
  return <Layers className={className} />;
};
