import { RestaurantSettings } from '../types';
import { applyTypographyVariables } from './fontList';

/**
 * Dynamically updates document title, favicon, apple-touch-icon, and meta tags
 * whenever settings are changed or loaded.
 */
export function applyWebsiteBrandingToDocument(settings: Partial<RestaurantSettings>): void {
  if (typeof document === 'undefined') return;

  // Apply CSS variables for typography directly to :root (zero re-render overhead)
  applyTypographyVariables(settings);

  // 1. Document / Browser Tab Title (Clean exact brand name)
  const title = (settings.websiteTitle && settings.websiteTitle.trim()) || 'Gidhaur Bakery';
  document.title = title;

  // Helper to ensure meta tag exists and set its attribute
  const setMetaTag = (attribute: string, attrValue: string, content: string) => {
    let el = document.querySelector(`meta[${attribute}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attribute, attrValue);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  // Helper to ensure link tag exists and set its href
  const setLinkTag = (rel: string, href: string, type?: string) => {
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
    if (type) el.type = type;
  };

  // 2. Favicon (Browser Tab Icon - Cache Busted)
  const activeFavicon = (settings.faviconUrl && settings.faviconUrl.trim()) || '/icon-192.png?v=3';
  setLinkTag('icon', activeFavicon, 'image/png');
  setLinkTag('shortcut icon', activeFavicon, 'image/png');

  // 3. Apple Touch Icon & PWA Mobile Icon (Add to Home Screen)
  const pwaIcon = (settings.pwaIconUrl && settings.pwaIconUrl.trim()) || (settings.faviconUrl && settings.faviconUrl.trim()) || '/apple-touch-icon.png?v=3';
  setLinkTag('apple-touch-icon', pwaIcon);

  // 4. Meta Description & SEO Title
  if (settings.websiteDescription) {
    setMetaTag('name', 'description', settings.websiteDescription);
    setMetaTag('property', 'og:description', settings.websiteDescription);
  }

  setMetaTag('property', 'og:title', title);
  setMetaTag('name', 'application-name', settings.restaurantName || 'Gidhaur Bakery');
  setMetaTag('name', 'apple-mobile-web-app-title', settings.restaurantName || 'Gidhaur Bakery');

  // 5. OpenGraph Search Image (e.g. Google Search Result / Share card)
  if (settings.searchLogoUrl || settings.headerLogoUrl || settings.faviconUrl) {
    const ogImg = settings.searchLogoUrl || settings.headerLogoUrl || settings.faviconUrl;
    if (ogImg) {
      setMetaTag('property', 'og:image', ogImg);
      setMetaTag('name', 'twitter:image', ogImg);
    }
  }
}
