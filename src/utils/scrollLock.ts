/**
 * Rock-solid Mobile & Desktop Body Scroll Lock Utility
 * Prevents background home screen from scrolling or bouncing on iOS/Android
 * while keeping track of multiple nested modal layers (Cart -> Checkout -> etc).
 */

let lockCount = 0;
let initialScrollY = 0;

export function lockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount === 0) {
    initialScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${initialScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overscrollBehavior = 'none';
  }
  lockCount++;
}

export function unlockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    const scrollY = initialScrollY;

    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overscrollBehavior = '';

    window.scrollTo(0, scrollY);
  }
}
