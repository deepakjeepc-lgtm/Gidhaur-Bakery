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

// Register PWA service worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
