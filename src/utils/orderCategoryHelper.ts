import { Order, OrderItem } from '../types';

/**
 * Returns true if an item requires Kitchen Cooking/Preparation.
 * Strictly checks if "Specify Kitchen Prep Time" is enabled (prepTimeMinutes > 0 or hasKitchenPrepTime is true).
 */
export function isKitchenItem(item: any): boolean {
  if (!item) return false;
  
  // Explicit flag or positive prep time means this item goes to Kitchen
  if (item.hasKitchenPrepTime === true || item.product?.hasKitchenPrepTime === true) {
    return true;
  }

  const prepTime = Number(item.prepTimeMinutes ?? item.product?.prepTimeMinutes ?? 0);
  if (prepTime > 0) {
    return true;
  }

  return false;
}

/**
 * Returns true if an item goes to the Prep Section (packaging/counter area).
 * All items without kitchen prep time (including ready-made items, bakery, party props, cold items) go to Prep.
 */
export function isPrepSectionItem(item: any): boolean {
  return !isKitchenItem(item);
}

// Aliases for seamless compatibility with existing component code
export function isFoodItem(item: any): boolean {
  return isKitchenItem(item);
}

export function isNonFoodItem(item: any): boolean {
  return isPrepSectionItem(item);
}

/**
 * Classifies an order based on whether items require Kitchen preparation, Prep section packaging, or both.
 * - 'food_only': All items have Kitchen Prep Time ON -> routes directly to Kitchen
 * - 'non_food_only': No items have Kitchen Prep Time -> routes directly to Prep section
 * - 'mixed': Some items have Kitchen Prep Time and others do not -> routes to both Kitchen & Prep
 */
export function getOrderCategoryClassification(order: Order | any): 'food_only' | 'non_food_only' | 'mixed' {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) return 'non_food_only';

  const kitchenItems = items.filter(isKitchenItem);
  const prepItems = items.filter(isPrepSectionItem);

  if (kitchenItems.length > 0 && prepItems.length === 0) return 'food_only';
  if (kitchenItems.length === 0 && prepItems.length > 0) return 'non_food_only';
  if (kitchenItems.length > 0 && prepItems.length > 0) return 'mixed';
  return 'non_food_only';
}

export function getOrderFoodItems(order: Order | any): any[] {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter(isKitchenItem);
}

export function getOrderNonFoodItems(order: Order | any): any[] {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.filter(isPrepSectionItem);
}
