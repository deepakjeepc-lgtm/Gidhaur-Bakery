import express from 'express';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import { sendOrderNotificationEmail, buildOrderStatusEmailHtml, isMilestoneEmailEnabled } from './src/server/emailHelper';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Data storage directory and file for persistent cross-device synchronization
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

interface StoreData {
  bannerSettings: any;
  orders: any[];
  staff: {
    deliveryAgents: any[];
    kitchenStaff: any[];
  };
  settings: any;
  customerEmails: any[];
}

const DEFAULT_BANNER_SETTINGS = {
  isEnabled: true,
  autoSlideIntervalSeconds: 5,
  banners: [
    {
      id: 'banner-welcome-1',
      badge: 'SPECIAL OFFER',
      title: 'Artisan Pizzas & Burger Combos',
      description: 'Get flat 20% off on all freshly crafted stone-baked pizzas and gourmet meal combos.',
      couponCode: 'GIDHAUR20',
      discountText: '20% OFF',
      targetCategory: 'Combos',
      buttonText: 'Explore Combos',
      imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'banner-welcome-2',
      badge: "CHEF'S SPECIAL",
      title: 'Signature Desserts & Shakes',
      description: 'Indulge in melt-in-mouth Belgian chocolate brownies, pastries, and thick creamy shakes.',
      couponCode: 'SWEET50',
      discountText: 'FLAT ₹50 OFF',
      targetCategory: 'Desserts',
      buttonText: 'View Desserts',
      imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 2,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'banner-welcome-3',
      badge: 'EXPRESS DELIVERY',
      title: 'Free Delivery on Orders Above ₹199',
      description: 'Order your favorite snacks & meals and get piping-hot delivery right to your doorstep.',
      couponCode: 'FREEDEL',
      discountText: 'FREE DELIVERY',
      targetCategory: 'All',
      buttonText: 'Order Now',
      imageUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=600&q=80',
      isActive: true,
      order: 3,
      createdAt: new Date().toISOString(),
    },
  ],
};

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        bannerSettings: parsed.bannerSettings || DEFAULT_BANNER_SETTINGS,
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        staff: parsed.staff || { deliveryAgents: [], kitchenStaff: [] },
        settings: parsed.settings || {},
        customerEmails: Array.isArray(parsed.customerEmails) ? parsed.customerEmails : [],
      };
    }
  } catch (err) {
    console.error('Error loading store.json, using defaults:', err);
  }

  const initial: StoreData = {
    bannerSettings: DEFAULT_BANNER_SETTINGS,
    orders: [],
    staff: { deliveryAgents: [], kitchenStaff: [] },
    settings: {},
    customerEmails: [],
  };
  saveStore(initial);
  return initial;
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store.json:', err);
  }
}

let store = loadStore();

// SSE Clients Registry for Real-Time Multi-Device Sync (Simulator, iPhone, etc.)
type SSEClient = {
  id: string;
  res: express.Response;
};
let sseClients: SSEClient[] = [];

function broadcastSSE(eventType: string, payload: any) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(data);
    } catch {
      // client disconnected
    }
  });
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// SSE Live Sync Stream for Real-Time Multi-Device Collaboration
app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = Math.random().toString(36).substring(2, 12);
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  // Send initial synchronized state snapshot
  res.write(`event: init\ndata: ${JSON.stringify({
    bannerSettings: store.bannerSettings,
    orders: store.orders,
    settings: store.settings,
    staff: store.staff,
  })}\n\n`);

  // Heartbeat ping every 15 seconds to keep mobile Safari connection active
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Banner Settings endpoints
app.get('/api/settings/banners', (_req, res) => {
  res.json(store.bannerSettings);
});

app.post('/api/settings/banners', (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Invalid banner settings payload' });
  }

  store.bannerSettings = {
    ...store.bannerSettings,
    ...incoming,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);

  // Broadcast to all devices (desktop simulator, iPhone, all open tabs)
  broadcastSSE('banner_settings', store.bannerSettings);

  res.json({ success: true, bannerSettings: store.bannerSettings });
});

// Orders endpoints
app.get('/api/orders', (_req, res) => {
  res.json(store.orders);
});

app.post('/api/orders', (req, res) => {
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: 'Order must contain an id' });
  }

  const existingIdx = store.orders.findIndex((o) => o.id === newOrder.id || o.orderId === newOrder.orderId);
  if (existingIdx >= 0) {
    store.orders[existingIdx] = { ...store.orders[existingIdx], ...newOrder, updatedAt: new Date().toISOString() };
  } else {
    store.orders.unshift(newOrder);
  }
  saveStore(store);

  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, order: newOrder });
});

app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const orderIdx = store.orders.findIndex(
    (o) => o.id === id || o.orderId === id || o.id?.toLowerCase() === id.toLowerCase() || o.orderId?.toLowerCase() === id.toLowerCase()
  );
  if (orderIdx === -1) {
    const newOrder = {
      id,
      orderId: id,
      ...updates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.orders.unshift(newOrder);
    saveStore(store);
    broadcastSSE('orders_update', store.orders);
    return res.json({ success: true, order: newOrder });
  }

  store.orders[orderIdx] = {
    ...store.orders[orderIdx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);

  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, order: store.orders[orderIdx] });
});

app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  store.orders = store.orders.filter((o) => o.id !== id && o.orderId !== id);
  saveStore(store);

  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, deletedId: id });
});

app.post('/api/orders/clear-archive', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  store.orders = store.orders.filter((o) => {
    const oDate = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
    return oDate === todayStr;
  });
  saveStore(store);

  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, remaining: store.orders.length });
});

app.post('/api/orders/clear-all', (_req, res) => {
  store.orders = [];
  saveStore(store);

  broadcastSSE('orders_update', store.orders);
  res.json({ success: true });
});

// General settings endpoints
app.get('/api/settings', (_req, res) => {
  res.json(store.settings);
});

app.post('/api/settings', (req, res) => {
  store.settings = { ...store.settings, ...req.body };
  saveStore(store);
  broadcastSSE('settings_update', store.settings);
  res.json({ success: true, settings: store.settings });
});

// Cleanup product images from storage tracker endpoint
app.post('/api/cleanup-product-images', (req, res) => {
  const { productId, productName, imageUrls } = req.body || {};
  console.log(`[Storage Cleanup] Triggered image cleanup for product ${productId} (${productName}): ${imageUrls?.length || 0} images`);
  res.json({ success: true, count: imageUrls?.length || 0 });
});

// -------------------------------------------------------------
// Customer Email Notifications & Directory Endpoints
// -------------------------------------------------------------

// Send Order Status Email Endpoint
app.post('/api/send-order-email', async (req, res) => {
  try {
    const { order, status, recipientEmail, settings } = req.body || {};
    const appUrl = `${req.protocol}://${req.get('host')}`;
    const effectiveSettings = { ...store.settings, ...(settings || {}) };

    const targetEmail = recipientEmail || order?.customerEmail;
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'No recipient email specified' });
    }

    const eventStatus = status || order?.status || 'pending';

    // Strictly check if notification for this milestone event is turned ON in Admin Settings
    if (!isMilestoneEmailEnabled(eventStatus, effectiveSettings)) {
      console.log(`[Server /api/send-order-email] Milestone "${eventStatus}" is toggled OFF in Admin Settings. Skipping email.`);
      return res.json({ success: true, skipped: true, message: `Notification for "${eventStatus}" is disabled in settings.` });
    }

    const result = await sendOrderNotificationEmail({
      order,
      status: eventStatus,
      recipientEmail: targetEmail,
      settings: effectiveSettings,
      appUrl,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/send-order-email:', err);
    res.status(500).json({ success: false, message: err?.message || 'Server error sending email' });
  }
});

// Admin Test Email Endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { recipientEmail, settings, orderType = 'food' } = req.body || {};
    const appUrl = `${req.protocol}://${req.get('host')}`;
    const effectiveSettings = { ...store.settings, ...(settings || {}) };

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required for test' });
    }

    const isNonFoodTest = orderType === 'non_food';
    const dummyOrder = {
      orderId: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
      customerName: 'Store Administrator',
      totalAmount: isNonFoodTest ? 149 : 299,
      subtotal: isNonFoodTest ? 149 : 299,
      address: 'Main Market, Gidhaur (Sample Delivery Address)',
      paymentMethod: 'UPI',
      paymentStatus: 'paid',
      items: [
        {
          name: isNonFoodTest ? 'Birthday Celebration Candles & Party Caps' : 'Fresh Artisan Cake / Pizza',
          isNonFood: isNonFoodTest,
          category: isNonFoodTest ? 'Party Accessories' : 'Cakes & Bakery',
          product: {
            name: isNonFoodTest ? 'Birthday Celebration Candles & Party Caps' : 'Fresh Artisan Cake / Pizza',
            price: isNonFoodTest ? 149 : 299,
            isNonFood: isNonFoodTest,
            category: isNonFoodTest ? 'Party Accessories' : 'Cakes & Bakery',
          },
          quantity: 1,
        },
      ],
    };

    const result = await sendOrderNotificationEmail({
      order: dummyOrder,
      status: 'pending',
      recipientEmail,
      settings: effectiveSettings,
      appUrl,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Test email failed' });
  }
});

// Customer Emails Directory Endpoints
app.get('/api/customer-emails', (_req, res) => {
  res.json(store.customerEmails || []);
});

app.post('/api/customer-emails', (req, res) => {
  const record = req.body;
  if (!record || !record.email) {
    return res.status(400).json({ success: false, message: 'Email required' });
  }

  const cleanEmail = (record.email || '').trim().toLowerCase();
  const existingIdx = (store.customerEmails || []).findIndex(
    (c: any) => c.email.toLowerCase() === cleanEmail
  );

  if (existingIdx !== -1) {
    store.customerEmails[existingIdx] = {
      ...store.customerEmails[existingIdx],
      ...record,
      email: cleanEmail,
      totalOrders: (store.customerEmails[existingIdx].totalOrders || 1) + 1,
      lastOrderDate: new Date().toISOString(),
    };
  } else {
    store.customerEmails = [
      {
        ...record,
        email: cleanEmail,
        totalOrders: 1,
        lastOrderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      ...(store.customerEmails || []),
    ];
  }

  saveStore(store);
  res.json({ success: true, count: store.customerEmails.length });
});

app.delete('/api/customer-emails/:id', (req, res) => {
  const { id } = req.params;
  const cleanId = id.toLowerCase();
  store.customerEmails = (store.customerEmails || []).filter(
    (c: any) => c.id !== id && c.email.toLowerCase() !== cleanId
  );
  saveStore(store);
  res.json({ success: true, remaining: store.customerEmails.length });
});

app.post('/api/customer-emails/clear', (_req, res) => {
  store.customerEmails = [];
  saveStore(store);
  res.json({ success: true });
});

// Dynamic PWA Icons sync endpoint: updates public icon PNG files with the user's custom uploaded logo
app.post('/api/update-pwa-icons', async (req, res) => {
  try {
    const { imageBase64, imageUrl } = req.body;
    let buffer: Buffer | null = null;
    if (imageBase64) {
      const clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(clean, 'base64');
    } else if (imageUrl) {
      const response = await fetch(imageUrl);
      const arrayBuf = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    }

    if (!buffer) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // 1. Generate 512x512 PNG icons (High quality lanczos3 resampler)
    await sharp(buffer)
      .resize(512, 512, { fit: 'cover', kernel: 'lanczos3' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'icon-512.png'));
    await sharp(buffer)
      .resize(512, 512, { fit: 'cover', kernel: 'lanczos3' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'pwa-512x512.png'));

    // 2. Generate 192x192 PNG icons
    await sharp(buffer)
      .resize(192, 192, { fit: 'cover', kernel: 'lanczos3' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'icon-192.png'));
    await sharp(buffer)
      .resize(192, 192, { fit: 'cover', kernel: 'lanczos3' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'pwa-192x192.png'));

    // 3. Generate 180x180 iOS Apple Touch Icon
    await sharp(buffer)
      .resize(180, 180, { fit: 'cover', kernel: 'lanczos3' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));

    // 4. Generate 512x512 Maskable Icon with 15% safe-zone margin
    const innerSize = Math.round(512 * 0.82);
    const inner = await sharp(buffer).resize(innerSize, innerSize, { fit: 'cover', kernel: 'lanczos3' }).toBuffer();
    
    // Sample dominant or corner color for seamless background padding
    const stats = await sharp(buffer).stats();
    const dominant = stats.dominant || { r: 128, g: 11, b: 26 };

    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: dominant.r, g: dominant.g, b: dominant.b, alpha: 1 }
      }
    })
    .composite([{ input: inner, top: Math.round((512 - innerSize) / 2), left: Math.round((512 - innerSize) / 2) }])
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

    fs.copyFileSync(path.join(publicDir, 'icon-maskable-512.png'), path.join(publicDir, 'pwa-maskable-512x512.png'));

    // 5. Generate high quality base64-embedded SVGs so public/icon-*.svg also show the exact real logo
    const png512Base64 = fs.readFileSync(path.join(publicDir, 'icon-512.png')).toString('base64');
    const svg512Content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><image width="512" height="512" href="data:image/png;base64,${png512Base64}"/></svg>`;
    fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svg512Content, 'utf-8');

    const png192Base64 = fs.readFileSync(path.join(publicDir, 'icon-192.png')).toString('base64');
    const svg192Content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192"><image width="192" height="192" href="data:image/png;base64,${png192Base64}"/></svg>`;
    fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svg192Content, 'utf-8');

    // Also sync to dist/ if build exists
    const distDir = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      const filesToSync = [
        'icon-512.png',
        'pwa-512x512.png',
        'icon-192.png',
        'pwa-192x192.png',
        'apple-touch-icon.png',
        'icon-maskable-512.png',
        'pwa-maskable-512x512.png',
        'icon-512.svg',
        'icon-192.svg',
      ];
      for (const file of filesToSync) {
        const srcFile = path.join(publicDir, file);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, path.join(distDir, file));
        }
      }
    }

    res.json({
      success: true,
      message: 'All 6 PWA, iOS & Android HD App Icons generated and updated successfully from your original logo!',
      timestamp: new Date().toISOString(),
      generatedFiles: [
        'icon-512.png (512x512 Master)',
        'pwa-512x512.png (512x512 PWA)',
        'icon-192.png (192x192 Medium)',
        'pwa-192x192.png (192x192 PWA)',
        'apple-touch-icon.png (180x180 iOS)',
        'icon-maskable-512.png (512x512 Android Adaptive)',
        'icon-512.svg & icon-192.svg (Vector Wrappers)',
      ],
    });
  } catch (err: any) {
    console.error('Error updating PWA icons:', err);
    res.status(500).json({ error: err.message || 'Failed to update PWA icons' });
  }
});

// Digital Asset Links for Android TWA Fullscreen Verification
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const assetLinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
  if (fs.existsSync(assetLinksPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(assetLinksPath);
  } else {
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.vercel.gidhaur_bakery.twa',
          sha256_cert_fingerprints: [
            '25:3B:30:6E:B8:3C:11:CA:E5:37:F7:BC:F2:ED:20:E4:65:A8:70:57:E1:98:B6:D2:77:A8:5C:4C:AC:23:5C:F6',
          ],
        },
      },
    ]);
  }
});

// -------------------------------------------------------------
// Vite middleware integration (Vite in dev, static files in prod)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 4 wildcard
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Swadeep Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
