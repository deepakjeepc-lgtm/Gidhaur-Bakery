import express from 'express';
import path from 'path';
import fs from 'fs';
import { sendOrderNotificationEmail, isMilestoneEmailEnabled } from './src/server/emailHelper.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

async function getSharp() {
  const mod = await import('sharp');
  return (mod as any).default || mod;
}

app.use(express.json({ limit: '10mb' }));

// Dedicated ultra-fast static serving for compressed WebP product images & public assets
const PRODUCT_IMAGES_DIR = path.join(process.cwd(), 'public', 'product-images');
try {
  if (!fs.existsSync(PRODUCT_IMAGES_DIR)) {
    fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create product-images directory:', err);
}
app.use('/product-images', express.static(PRODUCT_IMAGES_DIR, {
  maxAge: '30d',
  immutable: true,
}));
app.use(express.static(path.join(process.cwd(), 'public')));

// Data storage directory and file for persistent cross-device synchronization
const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  role: 'admin' | 'customer';
  orderIds?: string[];
  phone?: string;
  updatedAt: string;
}

interface StoreData {
  bannerSettings: any;
  orders: any[];
  archivedOrders: any[];
  staff: {
    deliveryAgents: any[];
    kitchenStaff: any[];
  };
  settings: any;
  customerEmails: any[];
  vapidKeys?: {
    publicKey: string;
    privateKey: string;
  };
  pushSubscriptions?: PushSubscriptionRecord[];
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
        archivedOrders: Array.isArray(parsed.archivedOrders) ? parsed.archivedOrders : [],
        staff: parsed.staff || { deliveryAgents: [], kitchenStaff: [] },
        settings: parsed.settings || {},
        customerEmails: Array.isArray(parsed.customerEmails) ? parsed.customerEmails : [],
        vapidKeys: parsed.vapidKeys || undefined,
        pushSubscriptions: Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [],
      };
    }
  } catch (err) {
    console.error('Error loading store.json, using defaults:', err);
  }

  const initial: StoreData = {
    bannerSettings: DEFAULT_BANNER_SETTINGS,
    orders: [],
    archivedOrders: [],
    staff: { deliveryAgents: [], kitchenStaff: [] },
    settings: {},
    customerEmails: [],
    pushSubscriptions: [],
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
// Web Push (VAPID) Background Notification Engine (0 Firestore Reads)
// -------------------------------------------------------------
let webPushInitialized = false;
let webPushMod: any = null;

async function getConfiguredWebPush() {
  if (webPushInitialized && webPushMod) return webPushMod;
  try {
    const mod = await import('web-push');
    webPushMod = (mod as any).default || mod;
    if (!store.vapidKeys || !store.vapidKeys.publicKey || !store.vapidKeys.privateKey) {
      const generated = webPushMod.generateVAPIDKeys();
      store.vapidKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
      };
      saveStore(store);
    }
    webPushMod.setVAPIDDetails(
      'mailto:support@gidhaurbakery.com',
      store.vapidKeys.publicKey,
      store.vapidKeys.privateKey
    );
    webPushInitialized = true;
    return webPushMod;
  } catch (err) {
    console.warn('WebPush initialization note:', err);
    return null;
  }
}

// Pre-warm VAPID keys on server startup
getConfiguredWebPush().catch(() => {});

async function dispatchWebPushNotifications(
  filterFn: (sub: PushSubscriptionRecord) => boolean,
  payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    role?: 'admin' | 'customer';
    orderId?: string;
    status?: string;
    vibrate?: number[];
  }
) {
  try {
    const wp = await getConfiguredWebPush();
    if (!wp) return;
    const subs = Array.isArray(store.pushSubscriptions) ? store.pushSubscriptions : [];
    const targets = subs.filter(filterFn);
    if (targets.length === 0) return;

    const expiredEndpoints = new Set<string>();
    const messageStr = JSON.stringify(payload);

    await Promise.allSettled(
      targets.map(async (sub) => {
        try {
          await wp.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            messageStr,
            {
              TTL: 86400,
              urgency: 'high',
            }
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            expiredEndpoints.add(sub.endpoint);
          }
        }
      })
    );

    if (expiredEndpoints.size > 0) {
      store.pushSubscriptions = (store.pushSubscriptions || []).filter(
        (s) => !expiredEndpoints.has(s.endpoint)
      );
      saveStore(store);
    }
  } catch (err) {
    console.warn('dispatchWebPushNotifications note:', err);
  }
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Web Push Public Key & Subscription Endpoints
app.get('/api/push/vapid-public-key', async (_req, res) => {
  try {
    await getConfiguredWebPush();
    res.json({ publicKey: store.vapidKeys?.publicKey || '' });
  } catch {
    res.json({ publicKey: '' });
  }
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { subscription, role = 'customer', orderIds = [], phone = '' } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Valid push subscription required' });
    }
    if (!Array.isArray(store.pushSubscriptions)) {
      store.pushSubscriptions = [];
    }

    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanOrderIds = Array.isArray(orderIds)
      ? orderIds.map((id: any) => String(id || '').trim()).filter(Boolean)
      : [];

    const existingIdx = store.pushSubscriptions.findIndex(
      (s) => s.endpoint === subscription.endpoint && s.role === role
    );

    if (existingIdx >= 0) {
      const existing = store.pushSubscriptions[existingIdx];
      const mergedOrders = Array.from(
        new Set([...(existing.orderIds || []), ...cleanOrderIds])
      ).slice(-30);
      store.pushSubscriptions[existingIdx] = {
        ...existing,
        keys: subscription.keys,
        role: role === 'admin' ? 'admin' : 'customer',
        orderIds: mergedOrders,
        phone: cleanPhone || existing.phone || '',
        updatedAt: new Date().toISOString(),
      };
    } else {
      store.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        role: role === 'admin' ? 'admin' : 'customer',
        orderIds: cleanOrderIds.slice(-30),
        phone: cleanPhone,
        updatedAt: new Date().toISOString(),
      });
      // Keep max 500 active subscriptions
      if (store.pushSubscriptions.length > 500) {
        store.pushSubscriptions = store.pushSubscriptions.slice(-500);
      }
    }

    saveStore(store);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save push subscription' });
  }
});

app.post('/api/push/test', async (req, res) => {
  try {
    const { role = 'admin' } = req.body || {};
    await dispatchWebPushNotifications(
      (s) => s.role === role,
      {
        title: '🔔 Test Order Alert - Gidhaur Bakery',
        body: 'Background & closed-app push notification is active and working!',
        tag: 'test-order-alert',
        url: role === 'admin' ? '/#admin' : '/#track',
        role: role === 'admin' ? 'admin' : 'customer',
        vibrate: [500, 250, 500, 250, 500],
      }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Push test failed' });
  }
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

// Products endpoints (for resilient offline & high-speed zero-latency caching)
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

function loadProducts(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p) =>
            p &&
            p.id !== 'gjpphaGqAsJ8G0obkGpn' &&
            String(p.name || '').trim().toLowerCase() !== 'aabbcc'
        );
      }
    }
  } catch (err) {
    console.warn('Could not read products.json:', err);
  }
  return [];
}

function saveProducts(prods: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(prods, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving products.json:', err);
  }
}

async function saveBase64ImageToServer(dataUrl: string, nameHint: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  try {
    const parts = dataUrl.split(',');
    if (!parts[1]) return dataUrl;
    const buffer = Buffer.from(parts[1], 'base64');
    const safeName = String(nameHint || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
    const filename = `${Date.now()}-${safeName}.webp`;
    const target = path.join(PRODUCT_IMAGES_DIR, filename);
    const sharp = await getSharp();
    await sharp(buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(target);
    return `/product-images/${filename}`;
  } catch (err) {
    console.warn('Failed to convert base64 image on server:', err);
    return dataUrl;
  }
}

app.get('/api/products', (_req, res) => {
  res.json(loadProducts());
});

app.post('/api/upload-image', async (req, res) => {
  try {
    const { dataUrl, name } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid data:image/ string required' });
    }
    const url = await saveBase64ImageToServer(dataUrl, name || 'uploaded');
    res.json({ success: true, url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const item = req.body;
  if (!item || !item.name) {
    return res.status(400).json({ error: 'Product payload required' });
  }

  // Convert any embedded base64 images into static webp files
  if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
    item.imageUrl = await saveBase64ImageToServer(item.imageUrl, item.name || item.id);
  }
  if (Array.isArray(item.images)) {
    for (let i = 0; i < item.images.length; i++) {
      if (item.images[i] && item.images[i].startsWith('data:image/')) {
        item.images[i] = await saveBase64ImageToServer(item.images[i], `${item.name || item.id}-img${i}`);
      }
    }
  }

  const prods = loadProducts();
  const id = item.id || `item-${Date.now()}`;
  const newItem = { ...item, id, updatedAt: new Date().toISOString() };
  const idx = prods.findIndex((p) => p.id === id);
  if (idx >= 0) {
    prods[idx] = { ...prods[idx], ...newItem };
  } else {
    prods.unshift(newItem);
  }
  saveProducts(prods);
  broadcastSSE('products_update', prods);
  res.json({ success: true, product: newItem });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const prods = loadProducts().filter((p) => p.id !== id);
  saveProducts(prods);
  broadcastSSE('products_update', prods);
  res.json({ success: true });
});

app.post('/api/products/batch-stock', (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Array of updates required' });
  }
  const prods = loadProducts();
  const updateMap = new Map(updates.map((u: any) => [u.id, u]));
  let changed = false;
  const updatedProds = prods.map((p: any) => {
    const upd = updateMap.get(p.id);
    if (upd) {
      changed = true;
      return {
        ...p,
        stockQuantity: typeof upd.stockQuantity === 'number' ? upd.stockQuantity : p.stockQuantity,
        available: typeof upd.available === 'boolean' ? upd.available : p.available,
        ...(typeof upd.lowStockThreshold === 'number' ? { lowStockThreshold: upd.lowStockThreshold } : {}),
        lastStockUpdated: new Date().toISOString()
      };
    }
    return p;
  });
  if (changed) {
    saveProducts(updatedProds);
    broadcastSSE('products_update', updatedProds);
  }
  res.json({ success: true, count: updates.length });
});

app.post('/api/products/reorder', (req, res) => {
  const { orders } = req.body;
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'Array of orders required' });
  }
  const prods = loadProducts();
  const orderMap = new Map(orders.map((o: any) => [o.id, o.sortOrder]));
  let changed = false;
  const updatedProds = prods.map((p: any) => {
    if (orderMap.has(p.id)) {
      const nextSort = orderMap.get(p.id);
      if (p.sortOrder !== nextSort) {
        changed = true;
        return { ...p, sortOrder: nextSort };
      }
    }
    return p;
  });
  if (changed) {
    saveProducts(updatedProds);
    broadcastSSE('products_update', updatedProds);
  }
  res.json({ success: true, count: orders.length });
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

function getServerDateStr(input?: any): string {
  try {
    const d = input ? new Date(input) : new Date();
    if (isNaN(d.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

function upsertIntoServerArchive(order: any, extraMeta: Record<string, any> = {}) {
  if (!order || (!order.id && !order.orderId)) return;
  if (!Array.isArray(store.archivedOrders)) store.archivedOrders = [];
  const key = String(order.orderId || order.id).toLowerCase();
  const idx = store.archivedOrders.findIndex(
    (o) => String(o.orderId || o.id).toLowerCase() === key
  );
  const archivedRecord = {
    ...order,
    ...extraMeta,
    archivedAt: order.archivedAt || extraMeta.archivedAt || new Date().toISOString(),
  };
  if (idx >= 0) {
    store.archivedOrders[idx] = { ...store.archivedOrders[idx], ...archivedRecord };
  } else {
    store.archivedOrders.unshift(archivedRecord);
  }
}

function enforceServerDailyRollover(): boolean {
  const todayStr = getServerDateStr();
  const remainingToday: any[] = [];
  let rolledOver = false;

  for (const ord of store.orders) {
    if (!ord || (!ord.id && !ord.orderId)) continue;
    const ordDateStr = getServerDateStr(ord.createdAt);
    if (ord.isArchived || ord.status === 'archived' || ordDateStr !== todayStr) {
      upsertIntoServerArchive(ord, {
        isPreviousDayArchive: ordDateStr !== todayStr,
      });
      rolledOver = true;
    } else {
      remainingToday.push(ord);
    }
  }

  if (rolledOver) {
    store.orders = remainingToday;
    saveStore(store);
  }
  return rolledOver;
}

// Orders endpoints
app.get('/api/orders/archive', (_req, res) => {
  enforceServerDailyRollover();
  res.json(store.archivedOrders || []);
});

app.post('/api/orders/archive', (req, res) => {
  const { order, orders: batchOrders } = req.body || {};
  if (Array.isArray(batchOrders)) {
    batchOrders.forEach((o) => upsertIntoServerArchive(o));
  } else if (order && (order.id || order.orderId)) {
    upsertIntoServerArchive(order);
  }
  saveStore(store);
  res.json({ success: true, archivedOrders: store.archivedOrders });
});

app.get('/api/orders', (_req, res) => {
  enforceServerDailyRollover();
  res.json(store.orders);
});

app.post('/api/orders', (req, res) => {
  enforceServerDailyRollover();
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: 'Order must contain an id' });
  }

  const existingIdx = store.orders.findIndex((o) => o.id === newOrder.id || o.orderId === newOrder.orderId);
  const isBrandNewOrder = existingIdx === -1;
  if (existingIdx >= 0) {
    store.orders[existingIdx] = { ...store.orders[existingIdx], ...newOrder, updatedAt: new Date().toISOString() };
  } else {
    store.orders.unshift(newOrder);
  }

  if (newOrder.status === 'delivered') {
    upsertIntoServerArchive(newOrder, { deliveredAt: newOrder.deliveredAt || new Date().toISOString() });
  }

  saveStore(store);

  broadcastSSE('orders_update', store.orders);

  // Trigger background Web Push notification to all Admin devices when a new order arrives
  if (isBrandNewOrder) {
    const ordId = String(newOrder.orderId || newOrder.id || '');
    dispatchWebPushNotifications(
      (s) => s.role === 'admin',
      {
        title: `🔔 New Order Received! #${ordId}`,
        body: `${newOrder.customerName || 'Customer'} placed an order for ₹${newOrder.totalAmount || 0}. Tap to view & accept.`,
        tag: `admin-order-${ordId}`,
        url: '/#admin',
        role: 'admin',
        orderId: ordId,
        status: 'pending',
        vibrate: [500, 250, 500, 250, 500],
      }
    ).catch(() => {});
  }

  res.json({ success: true, order: newOrder });
});

app.get('/api/orders/:id', (req, res) => {
  enforceServerDailyRollover();
  const { id } = req.params;
  const clean = id.trim().toLowerCase();
  const digitsOnly = clean.replace(/\D/g, '');
  const order = store.orders.find(
    (o) =>
      o.id?.toLowerCase() === clean ||
      o.orderId?.toLowerCase() === clean ||
      (digitsOnly && o.orderId?.replace(/\D/g, '') === digitsOnly)
  );
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.get('/api/orders/phone/:phone', (req, res) => {
  enforceServerDailyRollover();
  const { phone } = req.params;
  const clean = phone.replace(/\D/g, '');
  const matches = store.orders.filter((o) => (o.phone || '').replace(/\D/g, '') === clean);
  res.json(matches);
});

app.patch('/api/orders/:id', (req, res) => {
  enforceServerDailyRollover();
  const { id } = req.params;
  const updates = req.body || {};
  const orderIdx = store.orders.findIndex(
    (o) => o.id === id || o.orderId === id || o.id?.toLowerCase() === id.toLowerCase() || o.orderId?.toLowerCase() === id.toLowerCase()
  );

  // If marked archived/completed, move to archive and remove from active orders
  if (updates.isArchived || updates.status === 'archived' || updates.status === 'completed') {
    if (orderIdx !== -1) {
      const target = { ...store.orders[orderIdx], ...updates, updatedAt: new Date().toISOString() };
      upsertIntoServerArchive(target, { isManualArchive: true });
      const removedId = target.id || id;
      const removedOrderId = target.orderId || id;
      store.orders.splice(orderIdx, 1);
      saveStore(store);
      broadcastSSE('orders_deleted', { deletedIds: [removedId, removedOrderId] });
      broadcastSSE('orders_update', store.orders);
      return res.json({ success: true, order: target });
    }
  }

  const prevOrder = orderIdx !== -1 ? store.orders[orderIdx] : null;
  const prevStatus = prevOrder?.status;
  const prevCancelStatus = prevOrder?.cancellationStatus;

  if (orderIdx === -1) {
    const newOrder = {
      id,
      orderId: id,
      ...updates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.orders.unshift(newOrder);
    if (newOrder.status === 'delivered') {
      upsertIntoServerArchive(newOrder, { deliveredAt: new Date().toISOString() });
    }
    saveStore(store);
    broadcastSSE('orders_update', store.orders);
    return res.json({ success: true, order: newOrder });
  }

  store.orders[orderIdx] = {
    ...store.orders[orderIdx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const updatedOrder = store.orders[orderIdx];

  if (updatedOrder.status === 'delivered') {
    upsertIntoServerArchive(updatedOrder, {
      deliveredAt: updatedOrder.deliveredAt || new Date().toISOString(),
    });
  }

  saveStore(store);

  broadcastSSE('orders_update', store.orders);

  const ordId = String(updatedOrder.orderId || updatedOrder.id || id);
  const cleanOrderPhone = String(updatedOrder.phone || '').replace(/\D/g, '');

  // 1. If Customer requested cancellation, notify Admin in background
  if (
    updates.cancellationStatus === 'requested' &&
    prevCancelStatus !== 'requested'
  ) {
    dispatchWebPushNotifications(
      (s) => s.role === 'admin',
      {
        title: `⚠️ Cancellation Request #${ordId}`,
        body: `${updatedOrder.customerName || 'Customer'} requested to cancel order #${ordId}. Tap to review.`,
        tag: `admin-cancel-${ordId}`,
        url: '/#admin',
        role: 'admin',
        orderId: ordId,
        vibrate: [500, 250, 500],
      }
    ).catch(() => {});
  }

  // 2. If Order Status transitioned, notify matching Customer devices in background (even when app is closed!)
  if (updates.status && updates.status !== prevStatus) {
    const nextStatus = updates.status;
    let title = '';
    let body = '';
    if (nextStatus === 'accepted') {
      title = `🎉 Order Confirmed! #${ordId}`;
      body = `Gidhaur Bakery accepted your order. Kitchen preparation will begin shortly!`;
    } else if (nextStatus === 'preparing') {
      title = `👨‍🍳 Fresh in the Kitchen! #${ordId}`;
      body = `Your delicious items are now being baked and prepared fresh.`;
    } else if (nextStatus === 'out_for_delivery') {
      title = `🛵 Out For Delivery! #${ordId}`;
      body = `Your order is on the way! Delivery rider is en route to your address.`;
    } else if (nextStatus === 'delivered') {
      title = `✅ Order Delivered! #${ordId}`;
      body = `Your order from Gidhaur Bakery has been delivered. Enjoy your delicious treats!`;
    } else if (nextStatus === 'rejected') {
      title = `⚠️ Order Update #${ordId}`;
      body = `Your order #${ordId} was declined or cancelled. Tap to view details.`;
    }

    if (title) {
      dispatchWebPushNotifications(
        (s) => {
          if (s.role !== 'customer') return false;
          const matchesId =
            Array.isArray(s.orderIds) &&
            s.orderIds.some((oid) => String(oid).toLowerCase() === ordId.toLowerCase());
          const matchesPhone =
            Boolean(cleanOrderPhone && cleanOrderPhone.length >= 10 && s.phone === cleanOrderPhone);
          return matchesId || matchesPhone;
        },
        {
          title,
          body,
          tag: `customer-order-${ordId}-${nextStatus}`,
          url: '/#track',
          role: 'customer',
          orderId: ordId,
          status: nextStatus,
          vibrate: [300, 150, 300],
        }
      ).catch(() => {});
    }
  }

  res.json({ success: true, order: updatedOrder });
});

app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const cleanId = id.toLowerCase();
  store.orders = store.orders.filter(
    (o) => String(o.id || '').toLowerCase() !== cleanId && String(o.orderId || '').toLowerCase() !== cleanId
  );
  if (Array.isArray(store.archivedOrders)) {
    store.archivedOrders = store.archivedOrders.filter(
      (o) => String(o.id || '').toLowerCase() !== cleanId && String(o.orderId || '').toLowerCase() !== cleanId
    );
  }
  saveStore(store);

  broadcastSSE('orders_deleted', { deletedIds: [id] });
  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, deletedId: id });
});

app.post('/api/orders/clear-archive', (_req, res) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const removedIds: string[] = [];
  store.orders = store.orders.filter((o) => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt);
    const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const keep = oDate === todayStr;
    if (!keep) {
      if (o.id) removedIds.push(o.id);
      if (o.orderId) removedIds.push(o.orderId);
    }
    return keep;
  });
  store.archivedOrders = [];
  saveStore(store);

  if (removedIds.length > 0) {
    broadcastSSE('orders_deleted', { deletedIds: removedIds });
  }
  broadcastSSE('orders_update', store.orders);
  res.json({ success: true, remaining: store.orders.length });
});

app.post('/api/orders/clear-all', (_req, res) => {
  store.orders = [];
  store.archivedOrders = [];
  saveStore(store);

  broadcastSSE('orders_deleted', { clearAll: true });
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

// Staff endpoints (0 Firestore reads)
app.get('/api/staff', (_req, res) => {
  res.json(store.staff || { deliveryAgents: [], kitchenStaff: [] });
});

app.post('/api/staff', (req, res) => {
  const { staff } = req.body;
  if (staff) {
    store.staff = { ...store.staff, ...staff };
    saveStore(store);
    broadcastSSE('staff_update', store.staff);
  }
  res.json({ success: true, staff: store.staff });
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

    const sharp = await getSharp();

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
  const distPath = path.join(process.cwd(), 'dist');
  const hasBuiltDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isDev =
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' && !hasBuiltDist);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
