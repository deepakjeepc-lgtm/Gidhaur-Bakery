import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, CartItem, ProductVariant, ProductExtra } from '../types';
import { useLocation } from './LocationContext';
import { triggerHaptic } from '../utils/haptics';

interface CartContextType {
  items: CartItem[];
  addToCart: (
    product: Product,
    quantity?: number,
    selectedVariant?: ProductVariant,
    selectedExtras?: ProductExtra[]
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  distanceKm: number | null;
  feeTierText: string;
  isFreeDelivery: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  getItemQuantity: (productId: string, variantName?: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'swadeep_cart_v2';

export function CartProvider({ children }: { children: ReactNode }) {
  const { deliveryFee, distanceKm, feeTierText, isFreeDelivery } = useLocation();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          id: item.id || `${item.product.id}-${item.selectedVariant?.name || 'default'}`,
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [items]);

  const handleSetIsCartOpen = (open: boolean) => {
    triggerHaptic(open ? 'medium' : 'selection');
    setIsCartOpen(open);
  };

  const addToCart = (
    product: Product,
    quantity: number = 1,
    selectedVariant?: ProductVariant,
    selectedExtras?: ProductExtra[]
  ) => {
    triggerHaptic('medium');
    const variant = selectedVariant || (product.variants && product.variants.length > 0 ? product.variants[0] : undefined);
    const extrasKey = selectedExtras && selectedExtras.length > 0
      ? selectedExtras.map((e) => e.id).sort().join('_')
      : 'no_extras';
    const cartItemId = `${product.id}-${variant?.name || 'default'}-${extrasKey}`;

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === cartItemId);
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: cartItemId,
          product,
          selectedVariant: variant,
          selectedExtras: selectedExtras && selectedExtras.length > 0 ? selectedExtras : undefined,
          quantity
        }
      ];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    triggerHaptic('heavy');
    setItems((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    triggerHaptic('light');
    setItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    triggerHaptic('heavy');
    setItems([]);
  };

  const getItemQuantity = (productId: string, variantName?: string): number => {
    if (variantName) {
      const targetId = `${productId}-${variantName}`;
      const found = items.find((i) => i.id === targetId);
      return found ? found.quantity : 0;
    }
    return items
      .filter((i) => i.product.id === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => {
    const basePrice = item.selectedVariant ? item.selectedVariant.price : item.product.price;
    const extrasTotal = item.selectedExtras && item.selectedExtras.length > 0
      ? item.selectedExtras.reduce((eSum, ex) => eSum + (Number(ex.price) || 0), 0)
      : 0;
    const unitPrice = basePrice + extrasTotal;
    return sum + unitPrice * item.quantity;
  }, 0);

  const effectiveDeliveryFee = items.length === 0 ? 0 : deliveryFee;
  const totalAmount = subtotal + effectiveDeliveryFee;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        deliveryFee: effectiveDeliveryFee,
        totalAmount,
        distanceKm,
        feeTierText,
        isFreeDelivery,
        isCartOpen,
        setIsCartOpen: handleSetIsCartOpen,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
