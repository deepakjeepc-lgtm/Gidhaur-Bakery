import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent unhandled rejection crashes when browser backgrounds tab or closes IndexedDB
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = typeof reason === 'string' ? reason : reason?.message || '';
    if (message.includes('Database is closing') || message.includes('closing/hidden')) {
      event.preventDefault();
      console.debug('Suppressed background database closure event');
    }
  });

  window.addEventListener('error', (event) => {
    const message = event?.message || '';
    if (message.includes('Database is closing') || message.includes('closing/hidden')) {
      event.preventDefault();
      console.debug('Suppressed background database closure event');
    }
  });
}

// Purge any stale Vite or node_modules dependencies accidentally cached by older SW
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      caches.open(key).then((cache) => {
        cache.keys().then((requests) => {
          requests.forEach((req) => {
            if (req.url.includes('/.vite/') || req.url.includes('/node_modules/')) {
              cache.delete(req);
            }
          });
        });
      });
    });
  });
}

// Register PWA service worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
