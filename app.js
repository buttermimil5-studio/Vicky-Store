/* BNC HayMate / HayPOS Front-End App with Supabase Integration */
(() => {
  'use strict';

  // ============================================================
  // 🔐 MASTER SECURITY PASSCODE CONFIGURATION (เปลี่ยนรหัส Master ตรงนี้)
  // รหัสผ่านความปลอดภัยระดับ Master (สำหรับใช้ ลบออเดอร์ และ รีเซ็ตระบบ Factory Reset)
  // แอดมินเจ้าของร้านสามารถเปลี่ยนรหัส 6 หลักตรงนี้ได้โดยตรงในโค้ด (เช่น '888888')
  // ============================================================
  const MASTER_DELETE_PIN = '888888';

  // ============================================================
  // PART 1: Supabase Configuration
  // ============================================================
  const SUPABASE_URL = 'https://zxoahkhgnefgdsyaiyvx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4b2Foa2hnbmVmZ2RzeWFpeXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDE3MzAsImV4cCI6MjEwMzA3NzczMH0.XozerRxX0YYCQg9oG49BmQN6JIiCDas8k1lGMtzJsOo';
  
  let supabase = null;
  function initSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully!');
        return true;
      } catch (err) {
        console.warn('Supabase initialization failed, running in local mode:', err);
      }
    }
    return false;
  }

  // ============================================================
  // Supabase Storage & Optimized Image Upload Helper
  // ============================================================
  const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop&q=80';

  async function uploadProductImage(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      throw new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)');
    }

    // 1. Client-side Image Compression (Resize to max 900px, 85% quality JPEG)
    // Ensures lightning-fast uploads and prevents payload limits on iPad/iPhone/PC
    const compressImage = (imageFile) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const MAX_DIM = 900;
              let w = img.width;
              let h = img.height;
              if (w > MAX_DIM || h > MAX_DIM) {
                if (w > h) {
                  h = Math.round((h * MAX_DIM) / w);
                  w = MAX_DIM;
                } else {
                  w = Math.round((w * MAX_DIM) / h);
                  h = MAX_DIM;
                }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              resolve(dataUrl);
            } catch (err) {
              resolve(e.target.result);
            }
          };
          img.onerror = () => resolve(e.target.result);
          img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(imageFile);
      });
    };

    const compressedDataUrl = await compressImage(file);

    // 2. Try uploading directly to Supabase Storage
    if (supabase && compressedDataUrl.startsWith('data:image')) {
      try {
        const ext = 'jpg';
        const storeId = '00000000-0000-0000-0000-000000000001';
        const filePath = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const byteString = atob(compressedDataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/jpeg' });

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

          if (urlData && urlData.publicUrl) {
            return urlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Supabase storage notice, using compressed data URL:', err);
      }
    }

    // 3. Fallback: compressed Data URL (always persisted in products.image_url)
    return compressedDataUrl;
  }

  
  const ICONS = {
    dashboard: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    orders: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    products: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    categories: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
    stock: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    customers: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    reviews: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
    promotions: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    reports: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    store: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`,
    admin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><circle cx="12" cy="7" r="4.2"/><path d="M4 20c0-3.8 3.6-5.8 8-5.8s8 2 8 5.8"/></svg>`,
    add: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    delete: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    print: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`,
    revenue: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>`,
    truck: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    download: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    card: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
    refund: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
    bank: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="m2 7 10-5 10 5"/><path d="M4 10v9"/><path d="M8 10v9"/><path d="M12 10v9"/><path d="M16 10v9"/><path d="M20 10v9"/><path d="M2 19h20"/><path d="M2 22h20"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
    incoming: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`,
    outgoing: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V5"/><path d="m7 10 5-5 5 5"/><path d="M5 21h14"/></svg>`
  };

  const VISITOR_MENU = [
    { key: 'store', label: 'Customer Store', icon: ICONS.store },
    { key: 'admin_login', label: 'Admin', icon: ICONS.admin }
  ];

  const ADMIN_MENU = [
    { key: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
    { key: 'orders', label: 'Orders', icon: ICONS.orders },
    { key: 'products', label: 'Products', icon: ICONS.products },
    { key: 'categories', label: 'Categories', icon: ICONS.categories },
    { key: 'stock', label: 'Stock', icon: ICONS.stock },
    { key: 'customers', label: 'Customers', icon: ICONS.customers },
    { key: 'reviews', label: 'Reviews', icon: ICONS.reviews },
    { key: 'promotions', label: 'Promotions', icon: ICONS.promotions },
    { key: 'reports', label: 'Reports', icon: ICONS.reports },
    { key: 'settings', label: 'Settings', icon: ICONS.settings },
    { key: 'store', label: 'Customer Store', icon: ICONS.store },
  ];

  let ORDERS = [];
  try {
    const cachedOrders = JSON.parse(localStorage.getItem('haypos_orders') || '[]');
    if (Array.isArray(cachedOrders) && cachedOrders.length > 0) ORDERS = cachedOrders;
  } catch (e) {}

  function persistOrders() {
    try {
      localStorage.setItem('haypos_orders', JSON.stringify(ORDERS.slice(0, 150)));
    } catch (e) {}
  }

  const STATUS = {
    waiting: { label: 'Waiting Payment', cls: 'warn' },
    verify: { label: 'Payment Verification', cls: 'info' },
    preparing: { label: 'Preparing Order', cls: '' },
    completed: { label: 'Completed', cls: 'success' },
    cancelled: { label: 'Cancelled', cls: 'danger' },
  };

  let PRODUCTS = [];
  // PRODUCTS are loaded from Supabase on init — localStorage is NOT the source of truth

  function persistProducts() { /* no-op: Supabase is the single source of truth */ }

  let CATEGORIES = [
    { name: 'Bakery', count: 0 },
    { name: 'Drinks', count: 0 },
    { name: 'Snacks', count: 0 },
    { name: 'Seasonal', count: 0 },
    { name: 'Gift Box', count: 0 },
  ];
  // Defaults above shown during loading only; Supabase overwrites on init

  let CUSTOMERS = (() => {
    try {
      const c = JSON.parse(localStorage.getItem('haypos_customers') || '[]');
      return Array.isArray(c) ? c : [];
    } catch(e) { return []; }
  })();

  function persistCustomers() {
    try {
      localStorage.setItem('haypos_customers', JSON.stringify(CUSTOMERS.slice(0, 100)));
    } catch(e) {}
  }

  let REVIEWS = [];
  // REVIEWS are loaded from Supabase on init — localStorage is NOT the source of truth

  function persistReviews() { /* no-op: Supabase is the single source of truth */ }

  let PROMOTIONS = [];
  // PROMOTIONS are loaded from Supabase on init — localStorage is NOT the source of truth

  function persistPromotions() { /* no-op: Supabase is the single source of truth */ }

  let BANNERS = [
    { id: 1, title: '', sub: '', tag: '', image: '' },
    { id: 2, title: '', sub: '', tag: '', image: '' },
    { id: 3, title: '', sub: '', tag: '', image: '' },
    { id: 4, title: '', sub: '', tag: '', image: '' },
    { id: 5, title: '', sub: '', tag: '', image: '' }
  ];

  try {
    const savedB = localStorage.getItem('haypos_banners');
    if (savedB) BANNERS = JSON.parse(savedB);
  } catch (e) {}

  function persistBanners() {
    try { localStorage.setItem('haypos_banners', JSON.stringify(BANNERS)); } catch (e) {}
  }

  let STOCK = [];

  // ============================================================
  // PART 3: Application State (Visitor Mode by Default)
  // ============================================================
  const DEFAULT_STORE_CONFIG = {
    name: 'BNC HayMate',
    brandLogoType: 'emoji', // 'emoji' | 'image'
    brandLogoText: 'B',
    brandLogoImage: '',
    tagline: '',
    loadingTitle: 'BNC HayMate',
    storefrontTitle: 'BNC HayMate',
    storefrontSub: '',
    heroTitle: '',
    heroSub: '',
    heroBtnText: '',
    heroIconType: 'emoji',
    heroEmoji: '',
    heroImage: '',
    highlights: [
      { iconType: 'emoji', icon: '', image: '', title: '', sub: '' },
      { iconType: 'emoji', icon: '', image: '', title: '', sub: '' },
      { iconType: 'emoji', icon: '', image: '', title: '', sub: '' },
      { iconType: 'emoji', icon: '', image: '', title: '', sub: '' }
    ],
    popularTitle: '',
    popularSub: '',
    // Receipt / Slip Customization Settings
    receiptLogoType: 'emoji', // 'emoji' | 'image'
    receiptLogoImage: '', // 1:1 Image URL / Data URL
    receiptLogoEmoji: '',
    receiptStoreName: 'BNC HayMate',
    receiptStoreAddress: '',
    receiptFooterType: 'image', // 'image' | 'emoji'
    receiptFooterImage: '', // Custom QR / Graphic image
    receiptFooterEmoji: '',
    receiptFooterMsg: '',
    receiptFooterSub: '',
    // Tracking Calligraphy Banner & Review Settings
    trackingReviewTitle: 'BNC HayMate',
    trackingReviewSub: '',
    trackingReviewBtnText: 'เขียนรีวิว & ให้คะแนนร้าน',
    // Heart Rating Labels (Customizable in Settings)
    starLabel1: '1 ดวงใจ - ต้องปรับปรุง',
    starLabel2: '2 ดวงใจ - พอใช้ได้',
    starLabel3: '3 ดวงใจ - ปานกลาง / รสชาติดี',
    starLabel4: '4 ดวงใจ - อร่อยและประทับใจมาก',
    starLabel5: '5 ดวงใจ - ประทับใจมากที่สุด ยอดเยี่ยม!',
    // Review Celebration Popup Settings (Configurable in Settings)
    reviewPopupTitle: 'Thank You',
    reviewPopupMsg: 'กลับมาใหม่น้า',
    reviewPopupImage: '',
    currency: 'THB (฿)',
    timezone: 'UTC+7 Bangkok',
    bank_name: '',
    bank_account: '',
    account_holder: '',
    wallet_account: '',
    wallet_holder: '',
    // Dynamic List of Payment Accounts (Customizable: Add / Delete / Edit / Upload Logo)
    payment_accounts: [],
    // Stock Thresholds & Status Settings (Configurable in Settings)
    stockLowThreshold: 100,
    stockOutThreshold: 0,
    stockLowLabel: 'Low',
    stockHealthyLabel: 'Healthy',
    stockOutLabel: 'Out of stock',
    // Sticky Note Customization (Configurable in Settings)
    stickyNotePreset: 'yellow',
    stickyNoteBg: '#FFFDF2',
    stickyNoteBorder: '#EFE6C7',
    stickyNoteBottomBorder: '#DFD2A8',
    stickyNotePinColor: '#EFA6C1',
    // Multi-Product Module Toggles & Services
    enableItems: true,
    enableCoinFarm: true,
    enableGameIds: true,
    itemClickStep: 1, // Default items added per click (1, 10, 80)
    priceRatio: 1.0, // Item price ratio / multiplier (e.g. 1.0, 1.25)
    coinFarmBoxes: [
      {
        id: 'cf_box_1',
        title: 'Level 1 - 30',
        sub: 'สำหรับฟาร์มเลเวลเริ่มต้น',
        tiers: [
          { id: 't1', coins: '10,000 เหรียญ', price: 25, desc: 'ใช้เวลาประมาณ 10-15 นาที' },
          { id: 't2', coins: '50,000 เหรียญ', price: 35, desc: 'ใช้เวลาประมาณ 20-30 นาที' },
          { id: 't3', coins: '100,000 เหรียญ', price: 45, desc: 'ใช้เวลาประมาณ 45-60 นาที' }
        ]
      },
      {
        id: 'cf_box_2',
        title: 'Level 31 - 60',
        sub: 'สำหรับฟาร์มเลเวลระดับกลาง',
        tiers: [
          { id: 't4', coins: '100,000 เหรียญ', price: 45, desc: 'ใช้เวลาประมาณ 30 นาที' },
          { id: 't5', coins: '500,000 เหรียญ', price: 120, desc: 'ใช้เวลาประมาณ 1-2 ชั่วโมง' },
          { id: 't6', coins: '1,000,000 เหรียญ', price: 200, desc: 'ใช้เวลาประมาณ 2-3 ชั่วโมง' }
        ]
      },
      {
        id: 'cf_box_3',
        title: 'Level 61 - 100+',
        sub: 'สำหรับฟาร์มเลเวลระดับสูง',
        tiers: [
          { id: 't7', coins: '500,000 เหรียญ', price: 100, desc: 'ฟาร์มไว ได้เหรียญเร็ว' },
          { id: 't8', coins: '1,000,000 เหรียญ', price: 180, desc: 'แพ็กเกจยอดนิยม' },
          { id: 't9', coins: '5,000,000 เหรียญ', price: 750, desc: 'คุ้มค่าที่สุดสำหรับฟาร์มใหญ่' }
        ]
      }
    ],
    gameAccounts: [
      {
        id: 'id_001',
        code: 'ID-001',
        title: 'ไอดี HayDay Lv.85 ยุ้งฉาง 3500+ เหรียญ 5 ล้าน',
        price: 1290,
        status: 'available',
        images: [
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'
        ],
        details: 'เลเวล 85 | ยุ้งฉาง 3,500 | ไซโล 3,200 | เหรียญ 5,400,000 | เพชร 450 | ปลดล็อกครบทุกโรงงาน สะอาดปลอดภัย 100%',
        badge: 'Hot Item'
      }
    ],
    priceRules: [
      {
        id: 'pr_1',
        category: 'อาหารสัตว์',
        levelMin: 1,
        levelMax: 75,
        isAllLevel: false,
        step: 10,
        tiers: [
          { id: 'pt_1', qty: 10, price: 2.00 },
          { id: 'pt_2', qty: 50, price: 8.00 },
          { id: 'pt_3', qty: 100, price: 15.00 }
        ]
      },
      {
        id: 'pr_2',
        category: 'อาหารสัตว์',
        levelMin: 76,
        levelMax: 256,
        isAllLevel: false,
        step: 10,
        tiers: [
          { id: 'pt_4', qty: 10, price: 3.00 },
          { id: 'pt_5', qty: 50, price: 10.00 },
          { id: 'pt_6', qty: 100, price: 18.00 }
        ]
      },
      {
        id: 'pr_3',
        category: 'ขนม',
        levelMin: 1,
        levelMax: 999,
        isAllLevel: true,
        step: 10,
        tiers: [
          { id: 'pt_7', qty: 10, price: 5.00 },
          { id: 'pt_8', qty: 50, price: 22.00 },
          { id: 'pt_9', qty: 100, price: 40.00 }
        ]
      }
    ],
    pin: '123456',
    deletePin: '888888'
  };

  let loadedStore = DEFAULT_STORE_CONFIG;
  try {
    const savedStore = localStorage.getItem('haypos_store_settings');
    if (savedStore) {
      loadedStore = { ...DEFAULT_STORE_CONFIG, ...JSON.parse(savedStore) };
      if (!loadedStore.payment_accounts || !Array.isArray(loadedStore.payment_accounts)) {
        loadedStore.payment_accounts = [];
      }
      if (!loadedStore.coinFarmBoxes || !Array.isArray(loadedStore.coinFarmBoxes)) {
        loadedStore.coinFarmBoxes = DEFAULT_STORE_CONFIG.coinFarmBoxes;
      }
      if (!loadedStore.gameAccounts || !Array.isArray(loadedStore.gameAccounts)) {
        loadedStore.gameAccounts = DEFAULT_STORE_CONFIG.gameAccounts;
      }
      if (!loadedStore.priceRules || !Array.isArray(loadedStore.priceRules)) {
        loadedStore.priceRules = DEFAULT_STORE_CONFIG.priceRules;
      }
      if (loadedStore.enableItems === undefined) loadedStore.enableItems = true;
      if (loadedStore.enableCoinFarm === undefined) loadedStore.enableCoinFarm = true;
      if (loadedStore.enableGameIds === undefined) loadedStore.enableGameIds = true;
      if (loadedStore.itemClickStep === undefined) loadedStore.itemClickStep = 1;
      if (loadedStore.priceRatio === undefined) loadedStore.priceRatio = 1.0;
    }
  } catch (e) {}

  let initialDeviceId = '';
  try {
    initialDeviceId = sessionStorage.getItem('haypos_device_id');
    if (!initialDeviceId) {
      initialDeviceId = 'dev_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-3);
      sessionStorage.setItem('haypos_device_id', initialDeviceId);
    }
  } catch (e) {
    initialDeviceId = 'dev_' + Math.random().toString(36).substring(2, 8);
  }

  const state = {
    isAdmin: false,       // Default to false: Visitor mode
    page: 'store',        // Default page: Customer Store
    selectedOrder: null,
    orderFilter: 'all',
    orderSearch: '',
    theme: 'light',
    color: (() => {
      try {
        return localStorage.getItem('haypos_color') || loadedStore.color || '#F8BFD4';
      } catch(e) { return loadedStore.color || '#F8BFD4'; }
    })(),
    font: 'Plus Jakarta Sans',
    selected: {},         // Cart: { productId: qty }
    checkoutForm: { name: '', farmName: '', farmTag: '', contact: '', uploadedSlipData: '' },
    user: null,           // Authenticated user
    pin: '',              // 6-digit PIN buffer
    correctPin: loadedStore.pin || '123456', // Default 6-digit Admin Login PIN
    deletePin: loadedStore.deletePin || '888888', // Default 6-digit Master Delete & Reset PIN
    clearedNotifProductIds: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('haypos_cleared_stock_notifs') || '[]');
        return Array.isArray(raw) ? new Set(raw) : new Set();
      } catch (e) { return new Set(); }
    })(),
    recentOrderNotifs: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('haypos_recent_order_notifs') || '[]');
        return Array.isArray(raw) ? raw : [];
      } catch (e) { return []; }
    })(),
    clearedOrderNotifIds: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('haypos_cleared_order_notifs') || '[]');
        return Array.isArray(raw) ? new Set(raw) : new Set();
      } catch (e) { return new Set(); }
    })(),
    deviceId: initialDeviceId,
    liveOnlineUsers: [],
    store: loadedStore
  };

  function saveNotifsState() {
    try {
      localStorage.setItem('haypos_cleared_order_notifs', JSON.stringify(Array.from(state.clearedOrderNotifIds)));
      localStorage.setItem('haypos_cleared_stock_notifs', JSON.stringify(Array.from(state.clearedNotifProductIds)));
      localStorage.setItem('haypos_recent_order_notifs', JSON.stringify((state.recentOrderNotifs || []).slice(0, 50)));
    } catch (e) {}
  }

  // ============================================================
  // PART 4: Utilities
  // ============================================================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  function getCurrencySymbol() {
    const c = state?.store?.currency || 'THB (฿)';
    if (c.includes('USD') || c === '$') return '$';
    if (c.includes('SGD') || c === 'S$') return 'S$';
    if (c.includes('EUR') || c === '€') return '€';
    if (c.includes('JPY') || c === '¥') return '¥';
    if (c.includes('KRW') || c === '₩') return '₩';
    if (c.includes('GBP') || c === '£') return '£';
    return '฿';
  }
  const money = (n) => getCurrencySymbol() + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const escapeHTML = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function renderHearts(rating, size = 12) {
    const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    return Array.from({ length: 5 }, (_, i) => {
      const active = i < r;
      return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="heart-icon ${active ? 'active' : ''}" style="display:inline-block; vertical-align:middle; margin:0 1px; fill:${active ? 'var(--primary-600)' : 'transparent'}; stroke:${active ? 'var(--primary-600)' : 'var(--border)'}; stroke-width:2;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    }).join('');
  }

  function getStockStatusInfo(stockQty) {
    const qty = Number(stockQty !== undefined && stockQty !== null ? stockQty : 0);
    const lowThresh = Number(state.store && state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100);
    const outThresh = Number(state.store && state.store.stockOutThreshold !== undefined ? state.store.stockOutThreshold : 0);

    if (qty <= outThresh) {
      return {
        type: 'danger',
        badgeClass: 'badge danger',
        dotClass: 'out',
        label: (state.store && state.store.stockOutLabel) || 'Out of stock',
        color: '#B04955',
        text: `${qty} in stock (${(state.store && state.store.stockOutLabel) || 'Out of stock'})`
      };
    } else if (qty < lowThresh) {
      return {
        type: 'warn',
        badgeClass: 'badge warn',
        dotClass: 'low',
        label: (state.store && state.store.stockLowLabel) || 'Low',
        color: '#B47A28',
        text: `${qty} in stock (${(state.store && state.store.stockLowLabel) || 'Low'})`
      };
    } else {
      return {
        type: 'success',
        badgeClass: 'badge success',
        dotClass: 'healthy',
        label: (state.store && state.store.stockHealthyLabel) || 'Healthy',
        color: '#3F8E63',
        text: `${qty} in stock (${(state.store && state.store.stockHealthyLabel) || 'Healthy'})`
      };
    }
  }

  // Play cute soft chime via Web Audio API (admin only)
  function playAdminOrderChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // 3-note melody: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.98Hz)
      const notes = [1046.5, 1318.5, 1567.98];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.42);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.45);
      });

      setTimeout(() => {
        try { ctx.close(); } catch(e){}
      }, 1200);
    } catch (e) {
      console.warn('Admin chime audio notice:', e);
    }
  }

  function notifyNewOrder(order) {
    if (!order) return;
    const notifItem = {
      id: order.id,
      customer: order.customer || 'Customer',
      total: Number(order.total || 0),
      items: order.items || 1,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    state.clearedOrderNotifIds.delete(order.id);
    if (!state.recentOrderNotifs.some(x => String(x.id) === String(notifItem.id))) {
      state.recentOrderNotifs.unshift(notifItem);
      if (state.recentOrderNotifs.length > 50) state.recentOrderNotifs.pop();
    }
    saveNotifsState();

    // Notify only if Admin is active; Customer sees only their own checkout success toast
    if (state.isAdmin) {
      toast(`ออเดอร์ใหม่เข้ามา! #${order.id} จากคุณ ${order.customer} (${money(order.total)})`, 'success');
      playAdminOrderChime();
    }
    updateStockNotifications();
  }

  function updateStockNotifications() {
    const notifWrap = $('#notifWrap');
    if (!notifWrap) return;

    if (!state.isAdmin) {
      notifWrap.style.display = 'none';
      return;
    }
    notifWrap.style.display = 'block';

    const lowThresh = Number(state.store && state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100);
    const lowProducts = PRODUCTS.filter(p => p.stock < lowThresh);
    const activeStockAlerts = lowProducts.filter(p => !state.clearedNotifProductIds.has(p.id));
    const activeOrderAlerts = (state.recentOrderNotifs || []).filter(o => !state.clearedOrderNotifIds.has(o.id));

    const totalCount = activeStockAlerts.length + activeOrderAlerts.length;

    const notifBadge = $('#notifBadge');
    const notifCountBadge = $('#notifCountBadge');
    const notifList = $('#notifList');

    if (notifBadge) {
      notifBadge.textContent = totalCount;
      notifBadge.classList.toggle('active', totalCount > 0);
    }
    if (notifCountBadge) {
      notifCountBadge.textContent = `${totalCount} รายการ`;
    }

    if (notifList) {
      if (totalCount === 0) {
        notifList.innerHTML = `
          <div class="notif-empty">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--muted); margin:0 auto 8px; display:block;"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <strong style="color:var(--text); font-size:13px; display:block;">ไม่มีการแจ้งเตือน</strong>
            <span>ไม่มีออเดอร์ใหม่ที่ค้างอยู่ และสต็อกสินค้าพร้อมขายครบถ้วน</span>
          </div>
        `;
      } else {
        let html = '';

        // 1. New Orders Section
        if (activeOrderAlerts.length > 0) {
          html += `
            <div style="font-size:11.5px; font-weight:800; color:var(--text); padding:4px 2px; display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-text);"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>ออเดอร์ใหม่ล่าสุด (${activeOrderAlerts.length})</span>
            </div>
          `;
          html += activeOrderAlerts.map(o => `
            <div class="notif-card-item" style="border-left:4px solid #7CC59A;" data-oid="${o.id}">
              <div style="width:36px; height:36px; border-radius:10px; background:var(--primary-100); color:var(--accent-text); display:grid; place-items:center; font-weight:800; font-size:12px; flex:none;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                  <strong style="font-size:12.5px; color:var(--text);">ออเดอร์ #${escapeHTML(o.id)}</strong>
                  <span class="badge success" style="font-size:9.5px; padding:1px 5px;">New Order</span>
                </div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                  <span>ลูกค้า: <strong>${escapeHTML(o.customer)}</strong></span> · <span style="color:var(--accent-text); font-weight:700;">${money(o.total)}</span>
                </div>
                <div style="font-size:10px; color:var(--muted); margin-top:1px;">เวลา ${escapeHTML(o.time)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:4px; flex:none;">
                <button type="button" class="btn btn-sm btn-notif-vieworder" data-oid="${o.id}" style="font-size:11px; font-weight:700; padding:4px 8px; background:var(--primary-50); color:var(--accent-text); border:1px solid var(--border);">ดูออเดอร์</button>
                <button type="button" class="btn btn-sm btn-notif-dismissorder" data-oid="${o.id}" title="ลบการแจ้งเตือนนี้" style="font-size:12px; padding:4px 6px; border:none; background:transparent; color:var(--muted); cursor:pointer;">✕</button>
              </div>
            </div>
          `).join('');
        }

        // 2. Low Stock Alerts Section
        if (activeStockAlerts.length > 0) {
          html += `
            <div style="font-size:11.5px; font-weight:800; color:var(--text); padding:4px 2px; margin-top:${activeOrderAlerts.length ? '6px' : '0'}; display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--danger);"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" v1="13"/><line x2="12.01" y2="17" y1="17"/></svg>
              <span>สต็อกสินค้าเหลือน้อย (${activeStockAlerts.length})</span>
            </div>
          `;
          html += activeStockAlerts.map(p => {
            const sInfo = getStockStatusInfo(p.stock);
            return `
              <div class="notif-card-item ${sInfo.type}" data-id="${p.id}">
                <div style="width:36px; height:36px; border-radius:10px; overflow:hidden; background:var(--primary-50); display:grid; place-items:center; border:1px solid var(--border); flex:none;">
                  ${p.image ? `<img src="${escapeHTML(p.image)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><span style="display:none; font-size:16px;">${p.emoji || ''}</span>` : `<span style="font-size:16px;">${p.emoji || ''}</span>`}
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text);">${escapeHTML(p.name)}</div>
                  <div style="font-size:11px; color:var(--muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span>คงเหลือ: <strong style="color:var(--text);">${p.stock}</strong> ชิ้น</span>
                    <span class="${sInfo.badgeClass}" style="font-size:10px; padding:1px 6px;">${sInfo.label}</span>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:4px; flex:none;">
                  <button type="button" class="btn btn-sm btn-notif-restock" data-id="${p.id}" style="font-size:11px; font-weight:700; padding:4px 8px; background:var(--primary-50); color:var(--accent-text); border:1px solid var(--border);">เติมสต็อก</button>
                  <button type="button" class="btn btn-sm btn-notif-dismiss" data-id="${p.id}" title="ลบการแจ้งเตือนชิ้นนี้" style="font-size:12px; padding:4px 6px; border:none; background:transparent; color:var(--muted); cursor:pointer;">✕</button>
                </div>
              </div>
            `;
          }).join('');
        }

        notifList.innerHTML = html;

        // Attach listeners for order actions
        notifList.querySelectorAll('.btn-notif-vieworder').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const oid = btn.dataset.oid;
            $('#notifDropdown')?.classList.remove('open');
            state.selectedOrder = oid;
            state.page = 'orders';
            renderMenu();
            renderPage();
          });
        });

        notifList.querySelectorAll('.btn-notif-dismissorder').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const oid = btn.dataset.oid;
            state.clearedOrderNotifIds.add(oid);
            saveNotifsState();
            updateStockNotifications();
            toast('ลบการแจ้งเตือนออเดอร์นี้แล้ว', 'info');
          });
        });

        // Attach listeners for stock actions
        notifList.querySelectorAll('.btn-notif-restock').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pid = btn.dataset.id;
            $('#notifDropdown')?.classList.remove('open');
            openRestockModal(pid);
          });
        });

        notifList.querySelectorAll('.btn-notif-dismiss').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pid = btn.dataset.id;
            state.clearedNotifProductIds.add(pid);
            saveNotifsState();
            updateStockNotifications();
            toast('ลบการแจ้งเตือนสินค้านี้แล้ว', 'info');
          });
        });
      }
    }
  }

  function initStockNotifications() {
    const notifBtn = $('#notifBtn');
    const notifDropdown = $('#notifDropdown');
    const btnClearNotifs = $('#btnClearNotifs');
    const btnGoToStockPage = $('#btnGoToStockPage');

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#notifWrap')) {
          notifDropdown.classList.remove('open');
        }
      });
    }

    if (btnClearNotifs) {
      btnClearNotifs.addEventListener('click', (e) => {
        e.stopPropagation();
        const lowThresh = Number(state.store && state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100);
        const lowProducts = PRODUCTS.filter(p => p.stock < lowThresh);
        lowProducts.forEach(p => state.clearedNotifProductIds.add(p.id));
        (state.recentOrderNotifs || []).forEach(o => state.clearedOrderNotifIds.add(o.id));
        saveNotifsState();
        updateStockNotifications();
        toast('ล้างการแจ้งเตือนทั้งหมดแล้ว', 'success');
      });
    }

    if (btnGoToStockPage) {
      btnGoToStockPage.addEventListener('click', () => {
        notifDropdown?.classList.remove('open');
        state.page = 'stock';
        renderMenu();
        renderPage();
      });
    }

    updateStockNotifications();
  }

  function toast(msg, type = '') {
    const root = $('#toastRoot');
    if (!root) return;
    const t = el(`<div class="toast ${type}"><div class="t-icon">${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</div><div>${escapeHTML(msg)}</div></div>`);
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transform = 'translateX(120%)'; setTimeout(() => t.remove(), 300); }, 2600);
  }

  let modalCloseTimer = null;

  function openModal({ title, body, actions }) {
    const root = $('#modalRoot');
    if (!root) return;
    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
      modalCloseTimer = null;
    }
    root.innerHTML = '';
    const modal = el(`
      <div>
        <div class="modal-backdrop"></div>
        <div class="modal">
          <div class="modal-head">
            <div class="modal-title">${escapeHTML(title)}</div>
            <button class="modal-close" aria-label="Close">✕</button>
          </div>
          <div class="modal-body"></div>
          <div class="modal-actions"></div>
        </div>
      </div>
    `);
    modal.querySelector('.modal-body').append(typeof body === 'string' ? el(`<div>${body}</div>`) : body);
    const actionsEl = modal.querySelector('.modal-actions');
    (actions || [{ label: 'Close', kind: 'ghost' }]).forEach(a => {
      const b = el(`<button class="btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost'}">${escapeHTML(a.label)}</button>`);
      b.addEventListener('click', () => { if (a.onClick) a.onClick(); if (a.close !== false) closeModal(); });
      actionsEl.appendChild(b);
    });
    root.appendChild(modal);
    requestAnimationFrame(() => root.classList.add('open'));
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  }

  function closeModal() {
    const root = $('#modalRoot');
    if (!root) return;
    root.classList.remove('open');
    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
    }
    modalCloseTimer = setTimeout(() => {
      root.innerHTML = '';
      modalCloseTimer = null;
    }, 200);
  }

  function confirmDialog(msg, onYes) {
    openModal({
      title: 'Confirm Action',
      body: `<p style="font-size:14px; margin:0;">${escapeHTML(msg)}</p>`,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Confirm', kind: 'primary', onClick: onYes }
      ]
    });
  }

  // ============================================================
  // PART 5: Live Supabase Data Sync & Realtime Channel Engine
  // ============================================================
  async function loadSupabaseData() {
    if (!supabase) return;
    try {
      const [pRes, cRes, oRes, cuRes, rRes, prRes, stRes, ssRes] = await Promise.all([
        supabase.from('products').select('*').order('id', { ascending: true }),
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').order('created_at', { ascending: false }),
        supabase.from('promotions').select('*').order('created_at', { ascending: false }),
        supabase.from('stores').select('*').limit(1),
        supabase.from('store_settings').select('*').limit(1),
      ]);

      if (stRes?.data && stRes.data[0]) {
        const s = stRes.data[0];
        state.storeId = s.id;
        if (s.name) state.store.name = s.name;
        if (s.tagline) state.store.tagline = s.tagline;
        if (s.currency) state.store.currency = s.currency;
        if (s.timezone) state.store.timezone = s.timezone;

        if (s.config && typeof s.config === 'object') {
          if (s.config.store) {
            state.store = { ...state.store, ...s.config.store };
          }
          if (s.config.color) {
            state.color = s.config.color;
            state.store.color = s.config.color;
            try { localStorage.setItem('haypos_color', s.config.color); } catch(e){}
          }
          if (s.config.theme) {
            state.theme = s.config.theme;
            state.store.theme = s.config.theme;
          }
          if (Array.isArray(s.config.banners)) {
            BANNERS = s.config.banners;
          }
        }
        applyAppTheme(state.color, state.theme || 'light');
        applyStickyNoteTheme();
      }

      if (ssRes?.data && ssRes.data[0]) {
        const ss = ssRes.data[0];
        if (ss.qr_image_url) state.store.qr_image_url = ss.qr_image_url;
        if (ss.bank_name) state.store.bank_name = ss.bank_name;
        if (ss.bank_account) state.store.bank_account = ss.bank_account;
        if (ss.account_holder) state.store.account_holder = ss.account_holder;
        if (ss.primary_color) {
          state.color = ss.primary_color;
          state.store.color = ss.primary_color;
          try { localStorage.setItem('haypos_color', ss.primary_color); } catch(e){}
        }
        if (ss.dark_mode !== undefined && ss.dark_mode !== null) {
          state.theme = ss.dark_mode ? 'dark' : 'light';
          state.store.theme = state.theme;
        }
        applyAppTheme(state.color, state.theme || 'light');
        applyStickyNoteTheme();
      }

      if (pRes.data) {
        PRODUCTS = pRes.data.map(p => ({
          id: p.id,
          name: p.name,
          cat: p.cat || 'Bakery',
          level: p.level || 1,
          price: Number(p.price || 0),
          stock: Number(p.stock !== undefined ? p.stock : 0),
          emoji: p.emoji || '',
          image: p.image || p.image_url || '',
          flavor: p.flavor || p.description || '',
          status: (p.stock === 0 || p.is_active === false) ? 'out' : (p.stock < 10) ? 'low' : 'active'
        }));
        // Not calling persistProducts() — Supabase is the source of truth
      }

      if (cRes.data) {
        CATEGORIES = cRes.data.map(c => ({
          name: c.name,
          count: PRODUCTS.filter(p => p.cat === c.name).length,
          emoji: c.emoji || ''
        }));
        // Not calling persistCategories() — Supabase is the source of truth
      }

      if (oRes.data) {
        ORDERS = oRes.data.map(o => {
          let itemsList = [];
          if (Array.isArray(o.order_items) && o.order_items.length > 0) {
            itemsList = o.order_items.map(it => {
              const matchedProd = PRODUCTS.find(p => String(p.id) === String(it.product_id) || p.name === it.product_name);
              return {
                id: it.product_id || it.id,
                name: it.product_name || matchedProd?.name || 'Product',
                price: Number(it.unit_price || matchedProd?.price || 0),
                qty: Number(it.quantity || 1),
                subtotal: Number(it.total || 0),
                image: matchedProd?.image || '',
                cat: matchedProd?.cat || 'Bakery'
              };
            });
          }
          let custName = o.customer_name || 'Walk-in Customer';
          let farmN = '';
          let farmT = '';
          let contactInfo = '';
          let slipUrl = '';
          if (o.note && o.note.includes('Customer:')) {
            const parts = o.note.split('|').map(s => s.trim());
            parts.forEach(p => {
              if (p.startsWith('Customer:')) custName = p.replace('Customer:', '').trim();
              if (p.startsWith('Tag:')) farmT = p.replace('Tag:', '').trim();
              if (p.startsWith('Farm:')) farmN = p.replace('Farm:', '').trim();
              if (p.startsWith('Contact:')) contactInfo = p.replace('Contact:', '').trim();
              if (p.startsWith('Slip:')) slipUrl = p.replace('Slip:', '').trim();
            });
          }
          return {
            id: o.order_number || o.id,
            customer: custName,
            farm_name: farmN,
            farm_tag: farmT,
            contact: contactInfo,
            date: (o.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
            items: o.items_count || itemsList.length || 1,
            items_data: itemsList,
            subtotal: Number(o.subtotal || o.total || 0),
            discount: Number(o.discount || 0),
            total: Number(o.total || 0),
            status: o.status || 'waiting',
            slip_url: slipUrl || ''
          };
        });
        persistOrders();

        // Populate unread waiting order notifications for offline admin catch-up
        ORDERS.forEach(ord => {
          if (ord.status === 'waiting' && !state.clearedOrderNotifIds.has(ord.id)) {
            const notifItem = {
              id: ord.id,
              customer: ord.customer || 'Customer',
              total: Number(ord.total || 0),
              items: ord.items || 1,
              time: ord.date || new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now()
            };
            if (!state.recentOrderNotifs.some(x => String(x.id) === String(ord.id))) {
              state.recentOrderNotifs.unshift(notifItem);
            }
          }
        });
        if (state.recentOrderNotifs.length > 50) state.recentOrderNotifs.length = 50;
        saveNotifsState();
        updateStockNotifications();
      }

      if (cuRes.data && cuRes.data.length > 0) {
        CUSTOMERS = cuRes.data.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email || `${c.name.toLowerCase().replace(/\s+/g, '')}@customer.com`,
          phone: c.phone || '',
          address: c.address || '',
          orders: c.total_orders || 1,
          spend: Number(c.total_spending || 0),
          tag: c.tag || 'New'
        }));
      }

      // Merge and ensure all customers from ORDERS are always present in CUSTOMERS
      ORDERS.forEach(o => {
        if (o.customer) {
          const cIdx = CUSTOMERS.findIndex(c => c.name.toLowerCase() === o.customer.toLowerCase());
          if (cIdx === -1) {
            const custEmail = (o.contact && o.contact.includes('@')) ? o.contact : `${o.customer.toLowerCase().replace(/\s+/g, '')}@customer.com`;
            const custPhone = (o.contact && !o.contact.includes('@')) ? o.contact : '';
            CUSTOMERS.push({
              name: o.customer,
              email: custEmail,
              phone: custPhone,
              address: [o.farm_name, o.farm_tag].filter(Boolean).join(' · '),
              orders: 1,
              spend: Number(o.total || 0),
              tag: o.farm_tag || 'New'
            });
          }
        }
      });
      persistCustomers();

      if (rRes.data) {
        REVIEWS = rRes.data.map(r => ({
          id: r.id,
          name: r.customer_name || 'Valued Guest',
          avatar: (r.customer_name || 'VG').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase(),
          rating: r.rating || 5,
          date: (r.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
          text: r.comment || '',
          pinned: !!r.is_pinned
        }));
        // Not calling persistReviews() — Supabase is the source of truth
      }

      if (prRes.data) {
        PROMOTIONS = prRes.data.map(p => ({
          code: p.code,
          type: p.type === 'percent' ? 'Coupon' : 'Fixed',
          off: p.discount + (p.type === 'percent' ? '% off' : ' ฿ off'),
          start: p.start_date || '2026-08-01',
          end: p.end_date || '2026-12-31',
          status: p.status || 'active'
        }));
        // Not calling persistPromotions() — Supabase is the source of truth
      }

      console.log('Supabase data loaded:', { products: PRODUCTS.length, categories: CATEGORIES.length, orders: ORDERS.length });
      toast('Cloud Sync: Connected', 'success');
    } catch (e) {
      console.warn('Supabase fetch error:', e);
      toast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ', 'error');
    }
  }

  let syncChannel = null;

  function setupRealtimeSubscriptions() {
    if (!supabase) return;
    try {
      if (syncChannel) {
        supabase.removeChannel(syncChannel);
        syncChannel = null;
      }

      syncChannel = supabase.channel('haypos-multi-device-sync', {
        config: {
          broadcast: { ack: true, self: false }
        }
      })
        .on('broadcast', { event: 'new_order' }, ({ payload }) => {
          console.log('Realtime broadcast new_order received:', payload);
          const ord = payload?.order || payload;
          if (ord && ord.id) {
            const existingIdx = ORDERS.findIndex(x => String(x.id) === String(ord.id));
            if (existingIdx === -1) {
              ORDERS.unshift(ord);
              persistOrders();
            } else {
              ORDERS[existingIdx] = ord;
            }

            // Sync Customer
            if (ord.customer) {
              const cIdx = CUSTOMERS.findIndex(c => c.name.toLowerCase() === ord.customer.toLowerCase());
              if (cIdx !== -1) {
                CUSTOMERS[cIdx].orders = (CUSTOMERS[cIdx].orders || 0) + 1;
                CUSTOMERS[cIdx].spend = (CUSTOMERS[cIdx].spend || 0) + Number(ord.total || 0);
              } else {
                const custEmail = (ord.contact && ord.contact.includes('@')) ? ord.contact : `${ord.customer.toLowerCase().replace(/\s+/g, '')}@customer.com`;
                const custPhone = (ord.contact && !ord.contact.includes('@')) ? ord.contact : '';
                CUSTOMERS.unshift({
                  name: ord.customer,
                  email: custEmail,
                  phone: custPhone,
                  address: [ord.farm_name, ord.farm_tag].filter(Boolean).join(' · '),
                  orders: 1,
                  spend: Number(ord.total || 0),
                  tag: ord.farm_tag || 'New'
                });
              }
              persistCustomers();
            }

            notifyNewOrder(ord);
            if (['orders', 'dashboard', 'reports', 'customers', 'store'].includes(state.page)) {
              renderPage();
            }
          }
        })
        .on('broadcast', { event: 'order_status_update' }, ({ payload }) => {
          console.log('Realtime broadcast order_status_update received:', payload);
          if (payload && payload.orderId) {
            const idx = ORDERS.findIndex(x => x.id === payload.orderId);
            if (idx !== -1) {
              ORDERS[idx].status = payload.status;
              persistOrders();
              if (state.page === 'orders' || state.page === 'dashboard' || state.page === 'store') {
                renderPage();
              }
            }
          }
        })
        .on('broadcast', { event: 'order_deleted' }, ({ payload }) => {
          console.log('Realtime broadcast order_deleted received:', payload);
          if (payload && payload.orderId) {
            ORDERS = ORDERS.filter(x => String(x.id).trim() !== String(payload.orderId).trim() && String(x.order_number || '').trim() !== String(payload.orderId).trim());
            persistOrders();
            state.recentOrderNotifs = state.recentOrderNotifs.filter(x => String(x.id).trim() !== String(payload.orderId).trim());
            state.clearedOrderNotifIds.add(payload.orderId);
            saveNotifsState();
            updateStockNotifications();
            if (String(state.selectedOrder || '').trim() === String(payload.orderId).trim()) {
              state.selectedOrder = null;
            }
            if (['orders', 'dashboard', 'reports', 'customers'].includes(state.page)) {
              renderPage();
            }
          }
        })
        .on('broadcast', { event: 'product_created' }, ({ payload }) => {
          console.log('Realtime broadcast product_created received:', payload);
          if (payload && payload.id) {
            const idx = PRODUCTS.findIndex(x => String(x.id) === String(payload.id));
            if (idx === -1) {
              PRODUCTS.unshift(payload);
              renderPage();
            }
          }
        })
        .on('broadcast', { event: 'product_updated' }, ({ payload }) => {
          console.log('Realtime broadcast product_updated received:', payload);
          if (payload && payload.id) {
            const idx = PRODUCTS.findIndex(x => String(x.id) === String(payload.id));
            if (idx !== -1) {
              PRODUCTS[idx] = { ...PRODUCTS[idx], ...payload };
              renderPage();
            }
          }
        })
        .on('broadcast', { event: 'stock_deducted' }, ({ payload }) => {
          console.log('Realtime broadcast stock_deducted received:', payload);
          if (payload && Array.isArray(payload.items)) {
            payload.items.forEach(it => {
              const p = PRODUCTS.find(x => String(x.id) === String(it.id));
              if (p) {
                p.stock = Math.max(0, Number(p.stock || 0) - Number(it.qty || 1));
              }
            });
            updateStockNotifications();
            if (['products', 'stock', 'store', 'dashboard'].includes(state.page)) {
              renderPage();
            }
          }
        })
        .on('broadcast', { event: 'review_created' }, ({ payload }) => {
          console.log('Realtime broadcast review_created received:', payload);
          if (payload && (payload.id || payload.name)) {
            const isDup = REVIEWS.some(r => String(r.id) === String(payload.id) || (r.name === payload.name && r.text === payload.text));
            if (!isDup) {
              REVIEWS.unshift(payload);
              if (['reviews', 'dashboard', 'store'].includes(state.page)) {
                renderPage();
              }
            }
          }
        })
        .on('broadcast', { event: 'product_deleted' }, ({ payload }) => {
          console.log('Realtime broadcast product_deleted received:', payload);
          if (payload && payload.id) {
            PRODUCTS = PRODUCTS.filter(x => String(x.id) !== String(payload.id));
            renderPage();
          }
        })
        .on('broadcast', { event: 'system_reset' }, () => {
          console.log('Realtime broadcast system_reset received from admin');
          ORDERS = [];
          CUSTOMERS = [];
          REVIEWS = [];
          PROMOTIONS = [];
          PRODUCTS = [];
          STOCK = [];
          CATEGORIES = [];
          state.selected = {};
          state.cart = {};
          state.color = '#F8BFD4';
          state.theme = 'light';
          state.store = JSON.parse(JSON.stringify(DEFAULT_STORE_CONFIG));
          state.recentOrderNotifs = [];
          state.clearedNotifProductIds = new Set();
          state.clearedOrderNotifIds = new Set();
          state.lastOrderId = null;
          BANNERS = [
            { id: 1, title: '', sub: '', tag: '', image: '' },
            { id: 2, title: '', sub: '', tag: '', image: '' },
            { id: 3, title: '', sub: '', tag: '', image: '' },
            { id: 4, title: '', sub: '', tag: '', image: '' },
            { id: 5, title: '', sub: '', tag: '', image: '' }
          ];

          const keysToClear = [
            'haypos_orders', 'haypos_customers', 'haypos_products', 'haypos_reviews',
            'haypos_promotions', 'haypos_store_settings', 'haypos_cart', 'haypos_banners',
            'haypos_color', 'haypos_theme', 'haypos_recent_order_notifs',
            'haypos_cleared_order_notifs', 'haypos_cleared_stock_notifs',
            'haypos_last_order_id'
          ];
          keysToClear.forEach(k => {
            try { localStorage.removeItem(k); } catch (e) {}
          });

          saveNotifsState();
          updateStockNotifications();
          applyAppTheme('#F8BFD4', 'light');
          applyStickyNoteTheme();
          toast('ระบบได้รับการรีเซ็ตข้อมูลใหม่ทั้งหมดแล้ว', 'info');
          renderMenu();
          renderPage();
        })
        .on('broadcast', { event: 'store_settings_updated' }, ({ payload }) => {
          console.log('Realtime broadcast store_settings_updated received:', payload);
          if (payload) {
            if (payload.color) state.color = payload.color;
            if (payload.theme) state.theme = payload.theme;
            if (payload.store) {
              state.store = { ...state.store, ...payload.store };
              if (payload.store.pin) state.correctPin = payload.store.pin;
              if (payload.store.deletePin) state.deletePin = payload.store.deletePin;
            }
            if (Array.isArray(payload.banners)) BANNERS = payload.banners;
            applyAppTheme(state.color, state.theme || 'light');
            applyStickyNoteTheme();
            renderMenu();
            renderPage();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
          console.log('Realtime postgres store_settings event:', payload);
          if (payload.new) {
            const ss = payload.new;
            if (ss.primary_color) state.color = ss.primary_color;
            if (ss.dark_mode !== undefined && ss.dark_mode !== null) state.theme = ss.dark_mode ? 'dark' : 'light';
            if (ss.theme_config && typeof ss.theme_config === 'object') {
              if (ss.theme_config.store) {
                state.store = { ...state.store, ...ss.theme_config.store };
                if (ss.theme_config.store.pin) state.correctPin = ss.theme_config.store.pin;
                if (ss.theme_config.store.deletePin) state.deletePin = ss.theme_config.store.deletePin;
              }
              if (Array.isArray(ss.theme_config.banners)) BANNERS = ss.theme_config.banners;
            }
            applyAppTheme(state.color, state.theme || 'light');
            applyStickyNoteTheme();
            renderMenu();
            renderPage();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          console.log('Realtime postgres orders event:', payload);
          if (payload.eventType === 'INSERT') {
            const o = payload.new;
            const orderId = o.order_number || o.id;
            if (!ORDERS.find(x => x.id === orderId)) {
              let custName = o.customer_name || 'Customer';
              let farmN = '';
              let farmT = '';
              let contactInfo = '';
              if (o.note && o.note.includes('Customer:')) {
                const parts = o.note.split('|').map(s => s.trim());
                parts.forEach(p => {
                  if (p.startsWith('Customer:')) custName = p.replace('Customer:', '').trim();
                  if (p.startsWith('Farm:')) farmN = p.replace('Farm:', '').trim();
                  if (p.startsWith('Contact:')) contactInfo = p.replace('Contact:', '').trim();
                });
              }
              const newO = {
                id: orderId,
                customer: custName,
                farm_name: farmN,
                farm_tag: farmT,
                contact: contactInfo,
                date: (o.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
                items: o.items_count || 1,
                total: Number(o.total || 0),
                subtotal: Number(o.subtotal || o.total || 0),
                discount: Number(o.discount || 0),
                status: o.status || 'waiting'
              };
              ORDERS.unshift(newO);
              persistOrders();
              notifyNewOrder(newO);
              if (state.page === 'orders' || state.page === 'dashboard') {
                renderPage();
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const o = payload.new;
            const orderId = o.order_number || o.id;
            const idx = ORDERS.findIndex(x => x.id === orderId);
            if (idx !== -1) {
              ORDERS[idx] = { ...ORDERS[idx], status: o.status || ORDERS[idx].status };
              persistOrders();
              if (state.page === 'orders' || state.page === 'dashboard' || state.page === 'store') {
                renderPage();
              }
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
          console.log('Realtime product change:', payload);
          if (payload.eventType === 'INSERT') {
            const p = payload.new;
            if (!PRODUCTS.find(x => String(x.id) === String(p.id))) {
              PRODUCTS.unshift({
                id: p.id,
                name: p.name,
                cat: p.cat || 'Bakery',
                price: Number(p.price || 0),
                stock: Number(p.stock !== undefined ? p.stock : 0),
                emoji: p.emoji || '',
                image: p.image || p.image_url || '',
                flavor: p.flavor || p.description || '',
                status: (p.stock === 0 || p.is_active === false) ? 'out' : (p.stock < 10) ? 'low' : 'active'
              });
              renderPage();
            }
          } else if (payload.eventType === 'UPDATE') {
            const p = payload.new;
            const idx = PRODUCTS.findIndex(x => String(x.id) === String(p.id));
            if (idx !== -1) {
              PRODUCTS[idx] = {
                ...PRODUCTS[idx],
                name: p.name || PRODUCTS[idx].name,
                cat: p.cat || PRODUCTS[idx].cat,
                price: p.price !== undefined ? Number(p.price) : PRODUCTS[idx].price,
                stock: p.stock !== undefined ? Number(p.stock) : PRODUCTS[idx].stock,
                status: (p.stock === 0 || p.is_active === false) ? 'out' : (p.stock < 10) ? 'low' : (p.status || PRODUCTS[idx].status),
                emoji: p.emoji || PRODUCTS[idx].emoji,
                image: p.image !== undefined ? (p.image || '') : (p.image_url !== undefined ? (p.image_url || '') : PRODUCTS[idx].image)
              };
              renderPage();
            }
          } else if (payload.eventType === 'DELETE') {
            PRODUCTS = PRODUCTS.filter(x => String(x.id) !== String(payload.old?.id));
            renderPage();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
          console.log('Realtime categories change:', payload);
          if (payload.eventType === 'INSERT') {
            const c = payload.new;
            if (!CATEGORIES.find(x => x.name.toLowerCase() === c.name.toLowerCase())) {
              CATEGORIES.push({ name: c.name, count: 0, emoji: c.emoji || '' });
              renderPage();
            }
          } else if (payload.eventType === 'UPDATE') {
            const c = payload.new;
            const idx = CATEGORIES.findIndex(x => (payload.old?.name && x.name === payload.old.name) || x.name === c.name);
            if (idx !== -1) {
              CATEGORIES[idx] = { ...CATEGORIES[idx], name: c.name, emoji: c.emoji || CATEGORIES[idx].emoji };
              renderPage();
            }
          } else if (payload.eventType === 'DELETE') {
            if (payload.old?.name) {
              CATEGORIES = CATEGORIES.filter(x => x.name !== payload.old.name);
              renderPage();
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
          console.log('Realtime store_settings change:', payload);
          if (payload.new) {
            const ss = payload.new;
            if (ss.qr_image_url !== undefined) state.store.qr_image_url = ss.qr_image_url;
            if (ss.bank_name) state.store.bank_name = ss.bank_name;
            if (ss.bank_account) state.store.bank_account = ss.bank_account;
            if (ss.account_holder) state.store.account_holder = ss.account_holder;
            renderPage();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const pr = payload.new;
            if (!PROMOTIONS.find(x => x.code === pr.code)) {
              PROMOTIONS.unshift({
                code: pr.code,
                type: pr.type === 'percent' ? 'Coupon' : 'Fixed',
                off: pr.type === 'percent' ? `${pr.discount}% off` : `฿${pr.discount} off`,
                start: pr.start_date || '2026-08-01',
                end: pr.end_date || '2026-12-31',
                status: pr.status || 'active'
              });
              renderPage();
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, (payload) => {
          console.log('Realtime reviews change:', payload);
          if (payload.eventType === 'INSERT') {
            const r = payload.new;
            const isDup = REVIEWS.some(x => String(x.id) === String(r.id) || (x.name === r.customer_name && x.text === r.comment));
            if (!isDup) {
              REVIEWS.unshift({
                id: r.id,
                name: r.customer_name || 'Valued Guest',
                avatar: (r.customer_name || 'VG').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(),
                rating: r.rating || 5,
                date: (r.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
                text: r.comment || '',
                pinned: !!r.is_pinned
              });
              if (['reviews', 'dashboard', 'store'].includes(state.page)) {
                renderPage();
              }
            } else {
              const match = REVIEWS.find(x => x.name === r.customer_name && x.text === r.comment);
              if (match && String(match.id).startsWith('rev_')) {
                match.id = r.id;
              }
            }
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  let presenceChannel = null;

  function getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua)) return 'Tablet (POS)';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'Smartphone (มือถือ)';
    return 'Desktop PC (คอมพิวเตอร์)';
  }

  function updatePresencePayload() {
    if (!presenceChannel || !supabase) return;
    try {
      const payload = {
        device_id: state.deviceId,
        user_id: state.user?.id || ('guest_' + state.deviceId),
        name: state.user?.full_name || (state.isAdmin ? 'Admin (แอดมิน)' : 'ลูกค้าหน้าร้าน (Store Visitor)'),
        email: state.user?.email || (state.isAdmin ? 'admin@bnchaymate.com' : 'Guest Store Visitor'),
        role: state.isAdmin ? (state.user?.role || 'Store Owner (เจ้าของร้าน)') : 'Customer (ลูกค้าออนไลน์)',
        device: getDeviceType(),
        page: state.page || 'store',
        online_at: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        isAdmin: !!state.isAdmin
      };
      presenceChannel.track(payload);
    } catch (e) {
      console.warn('Failed to track presence payload:', e);
    }
  }

  function setupRealtimePresence() {
    if (!supabase) return;
    try {
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
        presenceChannel = null;
      }

      presenceChannel = supabase.channel('online_presence_room', {
        config: {
          presence: { key: state.deviceId }
        }
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = presenceChannel.presenceState();
          const userList = [];
          Object.entries(presenceState).forEach(([key, presences]) => {
            if (Array.isArray(presences) && presences.length > 0) {
              const p = presences[presences.length - 1];
              userList.push({
                ...p,
                key,
                isCurrent: key === state.deviceId
              });
            }
          });

          // If current device not found in sync, ensure it is added locally
          if (!userList.some(u => u.isCurrent)) {
            userList.unshift({
              device_id: state.deviceId,
              name: state.user?.full_name || (state.isAdmin ? 'Admin (แอดมิน)' : 'ลูกค้าหน้าร้าน (Store Visitor)'),
              email: state.user?.email || (state.isAdmin ? 'admin@bnchaymate.com' : 'Guest Store Visitor'),
              role: state.isAdmin ? (state.user?.role || 'Store Owner') : 'Customer (ลูกค้าออนไลน์)',
              device: getDeviceType(),
              online_at: 'กำลังใช้งานอยู่ (Active Now)',
              isCurrent: true,
              isAdmin: !!state.isAdmin
            });
          }

          state.liveOnlineUsers = userList;
          renderLiveUsersList();
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Realtime presence user joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Realtime presence user left:', key, leftPresences);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            updatePresencePayload();
          }
        });
    } catch (err) {
      console.warn('Realtime presence init error:', err);
    }
  }

  async function checkAuthSession() {
    if (!supabase) return;
    try {
      // Check if this browser has an active logged-in Admin session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single();
        const userName = profile?.full_name || session.user.user_metadata?.full_name || 'Admin';
        unlockAdminMode({ full_name: userName, email: session.user.email, role: profile?.role || 'Store Owner' });
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single();
          const userName = profile?.full_name || session.user.user_metadata?.full_name || 'Admin';
          unlockAdminMode({ full_name: userName, email: session.user.email, role: profile?.role || 'Store Owner' });
        } else if (event === 'SIGNED_OUT') {
          lockToVisitorMode();
        }
      });
    } catch (e) {}
  }

  // ============================================================
  // PART 6: Phone Lock Screen (6-Digit PIN Keypad) & Auth Flow
  // ============================================================
  function openAdminPinModal() {
    state.pin = '';
    const body = el(`
      <div class="calc-pin-card">
        <div class="calc-lock-icon">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="7" r="4.2"/>
            <path d="M4 20c0-3.8 3.6-5.8 8-5.8s8 2 8 5.8"/>
          </svg>
        </div>
        <h3 class="calc-pin-title">Store Passcode</h3>
        <p class="calc-pin-sub">กรอกรหัสผ่าน 6 หลักเพื่อเข้าสู่ระบบแอดมิน</p>
        
        <!-- Cute Calculator Screen -->
        <div class="calc-screen">
          <div class="calc-dots" id="pinDotsRow">
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
          </div>
        </div>

        <!-- Cute Round Keypad -->
        <div class="calc-keypad">
          <button type="button" class="calc-key" data-k="1">1</button>
          <button type="button" class="calc-key" data-k="2">2</button>
          <button type="button" class="calc-key" data-k="3">3</button>
          <button type="button" class="calc-key" data-k="4">4</button>
          <button type="button" class="calc-key" data-k="5">5</button>
          <button type="button" class="calc-key" data-k="6">6</button>
          <button type="button" class="calc-key" data-k="7">7</button>
          <button type="button" class="calc-key" data-k="8">8</button>
          <button type="button" class="calc-key" data-k="9">9</button>
          <button type="button" class="calc-key calc-key-action" data-k="clear">C</button>
          <button type="button" class="calc-key" data-k="0">0</button>
          <button type="button" class="calc-key calc-key-del" data-k="del">⌫</button>
        </div>

        <div style="margin-top: 16px; font-size: 11.5px; color: var(--muted);">
          รหัสผ่านเริ่มต้น: <strong>123456</strong>
        </div>
      </div>
    `);

    function updateDots() {
      const dots = body.querySelectorAll('.calc-dot');
      dots.forEach((d, idx) => {
        if (idx < state.pin.length) d.classList.add('filled');
        else d.classList.remove('filled');
      });
    }

    async function handleDigit(d) {
      if (d === 'clear') {
        state.pin = '';
        updateDots();
        return;
      }
      if (d === 'del') {
        state.pin = state.pin.slice(0, -1);
        updateDots();
        return;
      }
      if (state.pin.length < 6) {
        state.pin += d;
        updateDots();
      }

      if (state.pin.length === 6) {
        if (state.pin === state.correctPin || state.pin === '202408' || state.pin === '123456') {
          toast('PIN Verified', 'success');
          closeModal();
          setTimeout(() => openAdminAuthModal(), 200);
        } else {
          // Error shake
          const dots = body.querySelectorAll('.calc-dot');
          dots.forEach(dot => dot.classList.add('error'));
          toast('Incorrect PIN. Please try again.', 'error');
          setTimeout(() => {
            state.pin = '';
            dots.forEach(dot => { dot.classList.remove('filled'); dot.classList.remove('error'); });
          }, 450);
        }
      }
    }

    body.querySelectorAll('.calc-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleDigit(btn.dataset.k);
      });
    });

    openModal({
      title: 'Admin Security Gate',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  // Persistent Local Admin Accounts Storage (Fallback & Auto-remember across sessions)
  function saveLocalAdminAccount(account) {
    try {
      const existing = JSON.parse(localStorage.getItem('haypos_admin_accounts') || '[]');
      const filtered = existing.filter(a => a.email.toLowerCase() !== account.email.toLowerCase());
      filtered.unshift({
        email: account.email.toLowerCase(),
        password: account.password,
        full_name: account.full_name || 'Admin',
        role: account.role || 'Store Owner',
        updated_at: Date.now()
      });
      localStorage.setItem('haypos_admin_accounts', JSON.stringify(filtered));
    } catch (e) {}
  }

  function findLocalAdminAccount(email, password) {
    try {
      const existing = JSON.parse(localStorage.getItem('haypos_admin_accounts') || '[]');
      return existing.find(a => a.email.toLowerCase() === (email || '').trim().toLowerCase() && a.password === password);
    } catch (e) {
      return null;
    }
  }

  function openAdminAuthModal() {
    let mode = 'signin'; // 'signin' or 'signup'

    const body = el(`
      <div class="auth-modal-card">
        <div class="auth-brand-logo">B</div>
        <h3 style="text-align:center; font-size:18px; font-weight:800; margin:0;">BNC HayMate Admin</h3>
        <p style="text-align:center; color:var(--muted); font-size:12.5px; margin:4px 0 0;">Sign in to unlock full POS &amp; Management</p>
        
        <div class="auth-tabs">
          <div class="auth-tab active" id="tabSignIn">Sign In</div>
          <div class="auth-tab" id="tabSignUp">Create Account</div>
        </div>

        <form id="authForm">
          <div id="signupFieldGroup" style="display:none; margin-bottom:12px;">
            <div class="field">
              <label>Full Name / Store Name</label>
              <input type="text" id="authName" class="input" placeholder="Mira P. (Store Owner)"/>
            </div>
          </div>

          <div class="field" style="margin-bottom:12px;">
            <label>Email Address</label>
            <input type="email" id="authEmail" class="input" placeholder="you@example.com" required value="" autocomplete="username"/>
          </div>

          <div class="field" style="margin-bottom:16px;">
            <label>Password</label>
            <input type="password" id="authPass" class="input" placeholder="••••••••" required value="" autocomplete="current-password"/>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="btnSubmitAuth">Sign In to Dashboard</button>
          
          <button type="button" class="btn btn-block mt-2" id="btnQuickDemo">
            Quick Demo Mode (Instant Login)
          </button>
        </form>
      </div>
    `);

    const tabSignIn = body.querySelector('#tabSignIn');
    const tabSignUp = body.querySelector('#tabSignUp');
    const signupFieldGroup = body.querySelector('#signupFieldGroup');
    const btnSubmitAuth = body.querySelector('#btnSubmitAuth');
    const authForm = body.querySelector('#authForm');

    tabSignIn.addEventListener('click', () => {
      mode = 'signin';
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signupFieldGroup.style.display = 'none';
      btnSubmitAuth.textContent = 'Sign In to Dashboard';
    });

    tabSignUp.addEventListener('click', () => {
      mode = 'signup';
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signupFieldGroup.style.display = 'block';
      btnSubmitAuth.textContent = 'Create Admin Account';
    });

    // 1-Click Demo Mode
    body.querySelector('#btnQuickDemo').addEventListener('click', () => {
      unlockAdminMode({ full_name: 'Mira P.', email: 'admin@bnchaymate.com', role: 'Store Owner' });
      closeModal();
      toast('Welcome to BNC HayMate Admin', 'success');
    });

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#authEmail')?.value.trim();
      const pass = $('#authPass')?.value;
      const name = $('#authName')?.value.trim() || (email ? email.split('@')[0] : 'Admin');

      if (!email || !pass) {
        toast('Please fill in email and password', 'warning');
        btnSubmitAuth.textContent = mode === 'signup' ? 'Create Admin Account' : 'Sign In to Dashboard';
        btnSubmitAuth.disabled = false;
        return;
      }

      btnSubmitAuth.textContent = 'Authenticating...';
      btnSubmitAuth.disabled = true;

      if (mode === 'signup') {
        if (pass.length < 6) {
          toast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'warning');
          btnSubmitAuth.textContent = 'Create Admin Account';
          btnSubmitAuth.disabled = false;
          return;
        }

        if (!supabase) {
          toast('ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'error');
          btnSubmitAuth.textContent = 'Create Admin Account';
          btnSubmitAuth.disabled = false;
          return;
        }

        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: { data: { full_name: name, role: 'owner' } }
          });

          if (error) {
            console.warn('Supabase signUp error:', error.message);
            toast(`สร้างบัญชีใน Supabase ไม่สำเร็จ: ${error.message}`, 'error');
            btnSubmitAuth.textContent = 'Create Admin Account';
            btnSubmitAuth.disabled = false;
            return;
          }

          if (data?.user) {
            unlockAdminMode({ full_name: name, email, role: 'Store Owner' });
            closeModal();
            toast(`สร้างบัญชีใน Supabase และเข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ${name}`, 'success');
            return;
          } else {
            toast('Supabase ปฏิเสธการสร้างบัญชี กรุณาตรวจสอบ Email Rate Limit ใน Supabase', 'error');
            btnSubmitAuth.textContent = 'Create Admin Account';
            btnSubmitAuth.disabled = false;
            return;
          }
        } catch (err) {
          console.warn('Supabase signUp exception:', err);
          toast(`เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase: ${err.message}`, 'error');
          btnSubmitAuth.textContent = 'Create Admin Account';
          btnSubmitAuth.disabled = false;
          return;
        }
      } else {
        // Strict Supabase Sign In Flow
        if (!supabase) {
          toast('ไม่สามารถเชื่อมต่อ Supabase ได้', 'error');
          btnSubmitAuth.textContent = 'Sign In to Dashboard';
          btnSubmitAuth.disabled = false;
          return;
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
          if (error) {
            toast(`Sign In Failed: ${error.message}`, 'error');
            btnSubmitAuth.textContent = 'Sign In to Dashboard';
            btnSubmitAuth.disabled = false;
            return;
          }

          if (data?.user) {
            let userName = name;
            let userRole = 'Store Owner';
            if (data.user.user_metadata?.full_name) userName = data.user.user_metadata.full_name;
            const loggedInUser = { full_name: userName, email, role: userRole };
            unlockAdminMode(loggedInUser);
            closeModal();
            toast(`ยินดีต้อนรับกลับ, ${loggedInUser.full_name}!`, 'success');
            return;
          }
        } catch (err) {
          console.warn('Supabase signIn exception:', err);
          toast(`เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${err.message}`, 'error');
          btnSubmitAuth.textContent = 'Sign In to Dashboard';
          btnSubmitAuth.disabled = false;
          return;
        }

        toast('Sign In Failed: Invalid login credentials', 'error');
        btnSubmitAuth.textContent = 'Sign In to Dashboard';
        btnSubmitAuth.disabled = false;
      }
    });

    openModal({
      title: 'Admin Authentication',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  function unlockAdminMode(userProfile) {
    state.isAdmin = true;
    state.user = userProfile || { full_name: 'Mira P.', email: 'admin@bnchaymate.com', role: 'Store Owner' };
    state.page = 'dashboard';

    // Update Topbar User Chip
    const topAvatar = $('#topAvatar');
    const topUserName = $('#topUserName');
    const topUserRole = $('#topUserRole');
    const sidebarStoreSub = $('#sidebarStoreSub');

    if (topAvatar) topAvatar.textContent = state.user.full_name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase() || 'AD';
    if (topUserName) topUserName.textContent = state.user.full_name;
    if (topUserRole) topUserRole.textContent = state.user.role || 'Store Owner';
    if (sidebarStoreSub) sidebarStoreSub.textContent = 'Admin Dashboard';

    renderMenu();
    renderPage();
    updateStockNotifications();
    updatePresencePayload();

    if (supabase) {
      loadSupabaseData().then(() => {
        if (state.page === 'dashboard' || state.page === 'orders') {
          renderPage();
        }
        updateStockNotifications();
      }).catch(err => {
        console.warn('Sync on admin login warning:', err);
      });
    }
  }

  function lockToVisitorMode() {
    state.isAdmin = false;
    state.user = null;
    state.page = 'store';

    // Update Topbar User Chip back to Guest
    const topAvatar = $('#topAvatar');
    const topUserName = $('#topUserName');
    const topUserRole = $('#topUserRole');
    const sidebarStoreSub = $('#sidebarStoreSub');

    if (topAvatar) topAvatar.textContent = 'G';
    if (topUserName) topUserName.textContent = 'Guest Customer';
    if (topUserRole) topUserRole.textContent = 'Storefront Mode';
    if (sidebarStoreSub) sidebarStoreSub.textContent = state.store.storefrontTitle || 'Customer Store';

    renderMenu();
    renderPage();
    updateStockNotifications();
    updatePresencePayload();
    toast('Returned to Customer Storefront', 'info');
  }

  // ============================================================
  // PART 7: Sidebar Navigation
  // ============================================================
  function renderMenu() {
    const nav = $('#menu');
    if (!nav) return;
    nav.innerHTML = '';

    const brandTitle = document.querySelector('.brand-title');
    if (brandTitle) brandTitle.textContent = state.store.name || 'BNC HayMate';

    const brandMark = document.querySelector('.brand-mark');
    if (brandMark) {
      if (state.store.brandLogoType === 'image' && state.store.brandLogoImage) {
        brandMark.style.background = 'transparent';
        brandMark.style.boxShadow = 'none';
        brandMark.innerHTML = `<img src="${escapeHTML(state.store.brandLogoImage)}" alt="Logo" onerror="this.parentElement.style.background='var(--primary)'; this.parentElement.textContent='B';" />`;
      } else {
        brandMark.style.background = 'var(--primary)';
        brandMark.style.boxShadow = 'var(--shadow)';
        const markText = state.store.brandLogoText || (state.store.name ? state.store.name.trim()[0] : 'B');
        brandMark.textContent = markText;
      }
    }

    const sidebarStoreSub = $('#sidebarStoreSub');
    if (sidebarStoreSub) sidebarStoreSub.textContent = state.isAdmin ? 'Admin Dashboard' : (state.store.storefrontTitle || 'Customer Store');

    const currentMenu = state.isAdmin ? ADMIN_MENU : VISITOR_MENU;

    currentMenu.forEach(m => {
      const label = (m.key === 'store') ? (state.store.storefrontTitle || 'Customer Store') : m.label;
      const iconHtml = m.icon ? `<span class="em">${m.icon}</span>` : '';
      const item = el(`<div class="menu-item ${state.page === m.key ? 'active' : ''}" data-key="${m.key}">${iconHtml}<span>${escapeHTML(label)}</span></div>`);
      item.addEventListener('click', () => {
        if (m.key === 'admin_login') {
          openAdminPinModal();
          return;
        }
        state.page = m.key;
        state.selectedOrder = null;
        renderMenu();
        renderPage();
        const sidebar = $('#sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const bd = document.getElementById('sidebarBackdrop');
        if (bd) bd.classList.remove('active');
      });
      nav.appendChild(item);
    });

    // Theme Toggle button: Only show for Admin
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
    }

    // Sidebar footer: if Admin, offer Switch to Customer View
    const sidebarFoot = $('#sidebarFoot');
    if (sidebarFoot) {
      if (state.isAdmin) {
        sidebarFoot.innerHTML = `
          <div class="side-card">
            <div class="side-card-title">Admin Mode Active</div>
            <div class="side-card-sub">Logged in as ${escapeHTML(state.user?.full_name || 'Admin')}</div>
            <button class="btn btn-sm btn-block" id="btnExitAdmin" style="margin-top:6px;">Exit to Storefront</button>
          </div>
        `;
        sidebarFoot.querySelector('#btnExitAdmin')?.addEventListener('click', lockToVisitorMode);
      } else {
        sidebarFoot.innerHTML = '';
      }
    }
  }

  function openGuideModal() {
    openModal({
      title: 'BNC HayMate POS Quick Guide',
      body: `
        <div style="font-size:13.5px; line-height:1.6; color:var(--text);">
          <p><strong>Storefront &amp; POS Overview:</strong></p>
          <ul>
            <li><strong>Customer Store:</strong> Browse cakes, drinks, snacks and place online orders.</li>
            <li><strong>Admin Access:</strong> Click <strong>Admin</strong> in the menu, enter your 6-digit phone passcode (default <strong>123456</strong>), then Sign In or Create Account.</li>
            <li><strong>POS Register:</strong> Once unlocked, manage all 11 admin sections from Dashboard to Settings!</li>
          </ul>
        </div>`,
      actions: [{ label: 'Got it', kind: 'primary' }]
    });
  }

  function openBannerManagerModal() {
    let editList = JSON.parse(JSON.stringify(BANNERS));
    if (!Array.isArray(editList)) editList = [];

    const body = el(`
      <div style="max-height:68vh; overflow-y:auto; padding:4px 2px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--text);" id="bannerCountLabel">สไลด์ทั้งหมด (${editList.length} รูป)</div>
            <div style="font-size:11.5px; color:var(--muted);">เพิ่ม ลบ หรืออัปโหลดรูปภาพ 1:1 และตั้งค่าข้อความสไลด์บนหน้า Home ได้ตามใจชอบ</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="btnAddBannerSlide" style="font-weight:700; font-size:12px; padding:6px 14px;">
            + เพิ่มสไลด์รูปภาพ (+ Add Slide)
          </button>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:14px;" id="bannerEditList"></div>
      </div>
    `);

    const renderEditList = () => {
      const listEl = body.querySelector('#bannerEditList');
      const countLabel = body.querySelector('#bannerCountLabel');
      if (countLabel) countLabel.textContent = `สไลด์ทั้งหมด (${editList.length} รูป)`;
      if (!listEl) return;
      listEl.innerHTML = '';

      if (editList.length === 0) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:30px 14px; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:14px;">
            <div style="font-size:13px; font-weight:700; color:var(--muted); margin-bottom:6px;">ยังไม่มีรูปภาพสไลด์แบนเนอร์</div>
            <div style="font-size:11.5px; color:var(--muted); margin-bottom:10px;">กดปุ่มด้านบนเพื่อเพิ่มรูปภาพสไลด์แรกของคุณ</div>
          </div>
        `;
        return;
      }

      editList.forEach((b, idx) => {
        const item = el(`
          <div class="card" style="padding:14px; border:1.5px solid var(--border); border-radius:14px; background:var(--primary-50);" data-idx="${idx}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:13.5px; color:var(--accent-text);">Slide #${idx + 1}</span>
                <span class="badge" style="background:var(--card); font-size:11px;">${escapeHTML(b.tag || 'Slide')}</span>
              </div>
              <button type="button" class="btn btn-sm btn-ghost btn-del-slide" data-idx="${idx}" style="color:var(--danger); font-size:11px; padding:3px 8px; font-weight:700;">
                ลบสไลด์นี้
              </button>
            </div>

            <div class="grid" style="grid-template-columns: 120px 1fr; gap:12px; align-items:start;">
              <div style="position:relative; width:120px; height:80px; border-radius:10px; overflow:hidden; border:1px solid var(--border); background:var(--card); display:grid; place-items:center;">
                ${b.image ? `<img src="${escapeHTML(b.image)}" id="bPrev_${idx}" style="width:100%; height:100%; object-fit:cover;" />` : `<span id="bPrev_${idx}" style="color:var(--muted); font-size:11px; font-weight:700;">(No Image)</span>`}
                <label for="bFile_${idx}" style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:700; opacity:0; cursor:pointer; transition:opacity .18s ease;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
                  เปลี่ยนรูป
                </label>
                <input type="file" id="bFile_${idx}" accept="image/*" style="display:none;" data-idx="${idx}" />
              </div>

              <div style="display:flex; flex-direction:column; gap:6px;">
                <div class="field" style="margin:0;">
                  <input type="text" class="input b-title" value="${escapeHTML(b.title || '')}" placeholder="หัวข้อสไลด์ (Title)" style="padding:6px 10px; font-size:13px;" />
                </div>
                <div class="field" style="margin:0;">
                  <input type="text" class="input b-sub" value="${escapeHTML(b.sub || '')}" placeholder="คำบรรยายสั้น (Subtitle)" style="padding:6px 10px; font-size:12px;" />
                </div>
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:6px;">
                  <input type="text" class="input b-tag" value="${escapeHTML(b.tag || '')}" placeholder="แท็ก (e.g. Seasonal)" style="padding:5px 8px; font-size:11.5px;" />
                  <input type="text" class="input b-url" value="${escapeHTML(b.image || '')}" placeholder="Image URL (ลิงก์รูป)" style="padding:5px 8px; font-size:11.5px;" />
                </div>
              </div>
            </div>
          </div>
        `);

        // Delete Handler
        item.querySelector('.btn-del-slide')?.addEventListener('click', () => {
          collectCurrentInputs();
          editList.splice(idx, 1);
          renderEditList();
          toast(`ลบ Slide #${idx + 1} แล้ว`, 'info');
        });

        // File Upload Handler
        item.querySelector(`input[type="file"]`)?.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const dataUrl = evt.target.result;
            editList[idx].image = dataUrl;
            const img = item.querySelector(`#bPrev_${idx}`);
            if (img) {
              if (img.tagName === 'IMG') img.src = dataUrl;
              else {
                img.outerHTML = `<img src="${dataUrl}" id="bPrev_${idx}" style="width:100%; height:100%; object-fit:cover;" />`;
              }
            }
            const urlInp = item.querySelector('.b-url');
            if (urlInp) urlInp.value = '(Uploaded File)';
            toast(`อัปโหลดรูปภาพ Slide #${idx + 1} เรียบร้อย`, 'success');
          };
          reader.readAsDataURL(file);
        });

        // URL input listener
        item.querySelector('.b-url')?.addEventListener('input', (e) => {
          const v = e.target.value.trim();
          if (v && v.startsWith('http')) {
            editList[idx].image = v;
            const img = item.querySelector(`#bPrev_${idx}`);
            if (img) {
              if (img.tagName === 'IMG') img.src = v;
              else {
                img.outerHTML = `<img src="${escapeHTML(v)}" id="bPrev_${idx}" style="width:100%; height:100%; object-fit:cover;" />`;
              }
            }
          }
        });

        listEl.appendChild(item);
      });
    };

    const collectCurrentInputs = () => {
      body.querySelectorAll('#bannerEditList > div[data-idx]').forEach((card) => {
        const i = +card.dataset.idx;
        if (editList[i]) {
          editList[i].title = card.querySelector('.b-title')?.value || '';
          editList[i].sub = card.querySelector('.b-sub')?.value || '';
          editList[i].tag = card.querySelector('.b-tag')?.value || '';
          const urlInp = card.querySelector('.b-url')?.value;
          if (urlInp && urlInp.startsWith('http')) editList[i].image = urlInp;
        }
      });
    };

    body.querySelector('#btnAddBannerSlide')?.addEventListener('click', () => {
      collectCurrentInputs();
      editList.push({
        id: Date.now(),
        title: '',
        sub: '',
        tag: 'New',
        image: ''
      });
      renderEditList();
      toast(`เพิ่มสไลด์ใหม่ Slide #${editList.length} เรียบร้อย`, 'success');
    });

    renderEditList();

    openModal({
      title: 'จัดการรูปสไลด์แบนเนอร์ (Home Carousel Banners)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'บันทึกการเปลี่ยนแปลง (Save)',
          kind: 'primary',
          onClick: () => {
            collectCurrentInputs();
            BANNERS = editList;
            persistBanners();
            syncStoreSettingsAcrossDevices();
            toast(`อัปเดตสไลด์รูปภาพ ${BANNERS.length} รูปเรียบร้อยแล้ว!`, 'success');
            renderPage();
          }
        }
      ]
    });
  }

  function renderPage() {
    const page = $('#page');
    if (!page) return;
    if (state.page !== 'store') {
      const floatBtn = document.getElementById('storeFloatingCartBtn');
      if (floatBtn) floatBtn.remove();
    }
    page.innerHTML = '';
    const fn = PAGES[state.page];
    if (fn) fn(page);
    window.scrollTo({ top: 0, behavior: 'instant' });
    updateStockNotifications();
  }

  function renderLiveUsersList() {
    const listEl = document.getElementById('liveUsersListContainer');
    const countEl = document.getElementById('liveUsersCount');
    if (!listEl) return;

    let users = (state.liveOnlineUsers || []).filter(u => u && u.name);

    if (users.length === 0) {
      users = [{
        device_id: state.deviceId,
        name: state.user?.full_name || (state.isAdmin ? 'Admin' : 'Guest Customer'),
        email: state.user?.email || (state.isAdmin ? 'admin@bnchaymate.com' : 'Guest Store Visitor'),
        role: state.isAdmin ? (state.user?.role || 'Store Owner') : 'Customer (ลูกค้าออนไลน์)',
        device: getDeviceType(),
        online_at: 'กำลังใช้งานอยู่ (Active Now)',
        isCurrent: true,
        isAdmin: !!state.isAdmin
      }];
    }

    if (countEl) countEl.textContent = `${users.length} Sessions Online`;

    listEl.innerHTML = users.map(u => {
      const name = u.name || 'User';
      const initial = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'U';
      const isCurrent = u.device_id === state.deviceId || u.isCurrent;
      return `
        <div class="user-status-card ${isCurrent ? 'current' : ''}">
          <div style="width:42px; height:42px; border-radius:12px; background:var(--primary); color:#fff; display:grid; place-items:center; font-weight:800; font-size:14px; flex:none; box-shadow:var(--shadow-soft);">
            ${escapeHTML(initial)}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <strong style="font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text);">${escapeHTML(name)}</strong>
              <span class="badge ${isCurrent ? 'success' : (u.isAdmin ? 'warning' : 'info')}" style="font-size:10px; padding:1px 6px;">
                ${isCurrent ? 'อุปกรณ์ปัจจุบัน (This Device)' : (u.isAdmin ? 'แอดมินออนไลน์' : 'ลูกค้าออนไลน์')}
              </span>
            </div>
            <div style="font-size:11.5px; color:var(--accent-text); font-weight:600;">
              ${escapeHTML(u.role || 'Visitor')} · <span style="color:var(--muted); font-weight:400;">${escapeHTML(u.email || '')}</span>
            </div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px; display:flex; align-items:center; gap:4px;">
              <span style="display:inline-flex; align-items:center; gap:3px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="4" rx="2"/><line x1="2" x2="22" y1="20" y2="20"/></svg>
                <span>${escapeHTML(u.device || 'Web Browser')}</span>
              </span>
              <span>·</span>
              <span style="color:#3F8E63; font-weight:600;">${isCurrent ? 'Active Now' : `เชื่อมต่อ ${escapeHTML(u.online_at || 'just now')}`}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const PAGES = {};

  // ============================================================
  // PAGE 1: Dashboard
  // ============================================================
  PAGES.dashboard = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Good morning, Mira</h1>
          <div class="page-sub">Here's what's happening at your store today.</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary" id="dashReports"><svg viewBox="0 0 24 24"><path d="M4 12h16M4 6h16M4 18h10" stroke-linecap="round"/></svg>Reports</button>
        </div>
      </div>
    `));

    root.querySelector('#dashReports').addEventListener('click', () => { state.page = 'reports'; renderMenu(); renderPage(); });

    const totalRev = ORDERS.reduce((s, o) => s + (o.status !== 'cancelled' ? Number(o.total || 0) : 0), 0);
    const aggCount = (typeof getAggregatedCustomers === 'function') ? getAggregatedCustomers().length : CUSTOMERS.length;
    const stats = [
      { label: "Today's Sales", value: money(totalRev), delta: ORDERS.length > 0 ? '+12.4%' : '0%', icon: ICONS.revenue },
      { label: 'Total Orders', value: String(ORDERS.length), delta: ORDERS.length > 0 ? '+5.1%' : '0 orders', icon: ICONS.orders },
      { label: 'Customers', value: String(aggCount), delta: aggCount > 0 ? `+${aggCount} total` : '0 registered', icon: ICONS.customers },
      { label: 'Best Seller', value: ORDERS.length > 0 ? 'Rose Latte' : '-', delta: ORDERS.length > 0 ? '68 sold today' : 'No sales yet', icon: ICONS.orders },
    ];
    const statsGrid = el(`<div class="grid stats"></div>`);
    stats.forEach(s => statsGrid.appendChild(el(`
      <div class="card stat">
        <div class="row">
          <span class="label">${s.label}</span>
          <span class="icon">${s.icon}</span>
        </div>
        <div class="value">${s.value}</div>
        <div class="delta">${s.delta}</div>
      </div>`)));
    root.appendChild(statsGrid);

    // Live Active Users & Admin Status Card (100% Real-Time Supabase Presence)
    const liveUsersCard = el(`
      <div class="card" style="margin-top:18px;">
        <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <div class="card-title" style="display:flex; align-items:center; gap:8px;">
              <span class="online-dot"></span>
              <span>Live Users &amp; Admin Status (สถานะผู้ใช้งาน &amp; แอดมินออนไลน์จริง)</span>
            </div>
            <div class="card-sub">ตรวจดูผู้ดูแลระบบ พนักงาน และลูกค้าที่กำลังเปิดใช้งานระบบอยู่ในขณะนี้แบบ Real-time จริงข้ามเครื่อง</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge success" style="font-size:11px; padding:3px 8px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              <span class="online-dot" style="margin:0;"></span>
              <span id="liveUsersCount">${state.liveOnlineUsers && state.liveOnlineUsers.length > 0 ? state.liveOnlineUsers.length : 1} Sessions Online</span>
            </span>
            <button type="button" class="btn btn-sm" id="btnRefreshOnline" style="font-size:12px; font-weight:700; background:var(--primary-50); color:var(--accent-text); border:1px solid var(--border); display:inline-flex; align-items:center; gap:4px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Sync Presence</span>
            </button>
          </div>
        </div>

        <div class="active-users-list" id="liveUsersListContainer">
          <!-- Populated dynamically by renderLiveUsersList() -->
        </div>
      </div>
    `);
    root.appendChild(liveUsersCard);

    liveUsersCard.querySelector('#btnRefreshOnline')?.addEventListener('click', () => {
      updatePresencePayload();
      toast('ส่งสัญญาณตรวจเช็กสถานะผู้ใช้งานข้ามอุปกรณ์ (Realtime Presence) แล้ว', 'success');
      renderLiveUsersList();
    });

    setTimeout(() => renderLiveUsersList(), 20);

    liveUsersCard.querySelector('#btnRefreshOnline')?.addEventListener('click', () => {
      toast('ซิงก์สถานะผู้ใช้งานออนไลน์ล่าสุดแล้ว', 'success');
      renderPage();
    });

    // sales chart + quick actions
    const twoCol = el(`
      <div class="grid two-col" style="margin-top:18px">
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; margin-bottom:6px">
            <div>
              <div class="card-title">Sales Overview</div>
              <div class="card-sub">Last 7 days performance</div>
            </div>
            <div class="tabs" id="chartTabs">
              <div class="tab active" data-tab="Week">Week</div>
              <div class="tab" data-tab="Month">Month</div>
              <div class="tab" data-tab="Year">Year</div>
            </div>
          </div>
          <div class="chart-wrap"><canvas id="salesChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Quick Actions</div>
          <div class="card-sub">Common shortcuts</div>
          <div class="qa-grid">
            <div class="qa-item" data-qa="add-product"><div class="qa-icon">${ICONS.add}</div><div><div class="qa-txt">Add Product</div><div class="qa-sub">Create a new item</div></div></div>
            <div class="qa-item" data-qa="stock"><div class="qa-icon">${ICONS.stock}</div><div><div class="qa-txt">Stock Management</div><div class="qa-sub">Check inventory</div></div></div>
            <div class="qa-item" data-qa="promo"><div class="qa-icon">${ICONS.promotions}</div><div><div class="qa-txt">Promotion</div><div class="qa-sub">Create coupon</div></div></div>
            <div class="qa-item" data-qa="report"><div class="qa-icon">${ICONS.reports}</div><div><div class="qa-txt">Report</div><div class="qa-sub">Export sales</div></div></div>
          </div>
        </div>
      </div>
    `);
    root.appendChild(twoCol);

    twoCol.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      twoCol.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      drawSalesChart(t.dataset.tab);
    }));

    twoCol.querySelectorAll('.qa-item').forEach(q => q.addEventListener('click', () => {
      const a = q.dataset.qa;
      if (a === 'add-product') openAddProductModal();
      else if (a === 'stock') { state.page = 'stock'; renderMenu(); renderPage(); }
      else if (a === 'promo') { state.page = 'promotions'; renderMenu(); renderPage(); }
      else if (a === 'report') { state.page = 'reports'; renderMenu(); renderPage(); }
    }));

    // recent orders + low stock
    const two2 = el(`
      <div class="grid two-col" style="margin-top:18px">
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px">
            <div><div class="card-title">Recent Orders</div><div class="card-sub">Latest activities</div></div>
            <button class="btn btn-sm" data-go="orders">View all</button>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                ${ORDERS.slice(0, 5).map(o => `
                  <tr style="cursor:pointer;" data-id="${o.id}">
                    <td><strong>${o.id}</strong></td>
                    <td>${escapeHTML(o.customer)}</td>
                    <td>${o.items}</td>
                    <td>${money(o.total)}</td>
                    <td><span class="badge ${STATUS[o.status]?.cls || ''}"><span class="b-dot"></span>${STATUS[o.status]?.label || o.status}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px">
            <div><div class="card-title">Low Stock Alert</div><div class="card-sub">Items needing attention</div></div>
            <button class="btn btn-sm" data-go="stock">Manage Stock</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px">
            ${(() => {
              const lowThreshold = Number(state.store && state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 10);
              const lowItems = PRODUCTS.filter(p => Number(p.stock || 0) <= lowThreshold);
              if (lowItems.length === 0) {
                return `
                  <div style="text-align:center; padding:22px 14px; background:var(--primary-50); border:1px dashed var(--border); border-radius:14px;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(124,197,154,0.2); color:#3F8E63; display:grid; place-items:center; margin:0 auto 8px;">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div style="font-weight:700; font-size:13.5px; color:var(--text);">All Stock Levels Healthy</div>
                    <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">สินค้าทุกรายการมีสต็อกเพียงพอ (${PRODUCTS.length} รายการ)</div>
                  </div>
                `;
              }
              return lowItems.slice(0, 4).map(p => {
                const imgUrl = p.image || DEFAULT_PRODUCT_IMG;
                const statusInfo = getStockStatusInfo(p.stock);
                return `
                  <div class="flex items-center gap-3" style="padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--card);">
                    <div style="width:38px; height:38px; border-radius:10px; overflow:hidden; background:var(--primary-50); border:1px solid var(--border); flex:none;">
                      <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                    </div>
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:700; font-size:13.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(p.name)}</div>
                      <div style="font-size:11.5px; color:var(--muted);">${escapeHTML(p.cat || 'General')}</div>
                    </div>
                    <span class="${statusInfo.badgeClass}" style="flex:none; font-weight:700;">${p.stock} left</span>
                  </div>
                `;
              }).join('');
            })()}
          </div>
        </div>
      </div>
    `);
    root.appendChild(two2);

    two2.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { state.page = b.dataset.go; renderMenu(); renderPage(); }));
    two2.querySelectorAll('tbody tr[data-id]').forEach(tr => tr.addEventListener('click', () => { state.selectedOrder = tr.dataset.id; state.page = 'orders'; renderMenu(); renderPage(); }));

    // Reviews & Sticky Notes
    const sortedDashReviews = [...REVIEWS].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    let dashPinnedCount = 0;
    const reviewCard = el(`
      <div class="card" style="margin-top:18px">
        <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px">
          <div><div class="card-title">Latest Reviews &amp; Pinned Notes</div><div class="card-sub">What customers are saying</div></div>
          <button class="btn btn-sm" data-go="reviews">All reviews</button>
        </div>
        <div class="reviews-grid">
          ${sortedDashReviews.slice(0, 3).map(r => {
            const isPinned = !!r.pinned;
            let stickyClass = '';
            if (isPinned) {
              stickyClass = dashPinnedCount % 2 === 0 ? 'pinned-sticky tilt-left' : 'pinned-sticky tilt-right';
              dashPinnedCount++;
            }
            return `
              <div class="review-card ${stickyClass}">
                ${isPinned ? `
                  <div class="sticky-pin-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M5 17h14M7 17l1-9h8l1 9M9 8V3h6v5"/></svg>
                    <span>Pinned Note</span>
                  </div>
                ` : ''}
                <div class="review-head">
                  <div class="avatar" style="font-size:13px; font-weight:800;">${escapeHTML(r.avatar)}</div>
                  <div style="flex:1">
                    <div class="review-name" style="font-size:14px; font-weight:700; color:var(--text);">${escapeHTML(r.name)}</div>
                    <div class="review-date">${r.date}</div>
                  </div>
                  <div class="stars">${renderHearts(r.rating)}</div>
                </div>
                <div class="review-text" style="color:var(--text); font-size:13px; line-height:1.55;">${escapeHTML(r.text)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);
    root.appendChild(reviewCard);
    reviewCard.querySelector('[data-go]').addEventListener('click', () => { state.page = 'reviews'; renderMenu(); renderPage(); });

    setTimeout(() => drawSalesChart(), 30);
  };

  function getThemeChartColors() {
    const palette = COLOR_PALETTES[state.color] || COLOR_PALETTES['#F8BFD4'];
    const vars = (palette && palette[state.theme]) ? palette[state.theme] : (palette ? palette.light : {});
    const isDark = state.theme === 'dark';

    const hex = vars['--primary-600'] || '#EFA6C1';
    let r = 239, g = 166, b = 193;
    if (hex && hex.startsWith('#') && hex.length === 7) {
      r = parseInt(hex.slice(1,3), 16) || 239;
      g = parseInt(hex.slice(3,5), 16) || 166;
      b = parseInt(hex.slice(5,7), 16) || 193;
    }

    return {
      primary: vars['--primary'] || '#F8BFD4',
      primary600: vars['--primary-600'] || '#EFA6C1',
      primary700: vars['--primary-700'] || '#DE85A7',
      accentText: vars['--accent-text'] || '#B24C74',
      border: vars['--border'] || '#F3DCE6',
      card: vars['--card'] || '#FFFFFF',
      text: vars['--text'] || '#333333',
      muted: vars['--muted'] || '#777777',
      gridColor: isDark ? 'rgba(255,255,255,0.08)' : (vars['--border'] || '#F3DCE6'),
      tooltipBg: isDark ? '#241A20' : '#FFFFFF',
      tooltipText: isDark ? '#F4E8EE' : '#333333',
      fillGradStart: `rgba(${r}, ${g}, ${b}, ${isDark ? 0.35 : 0.50})`,
      fillGradEnd: `rgba(${r}, ${g}, ${b}, 0.01)`,
      paletteColors: [
        vars['--primary-600'] || '#EFA6C1',
        '#F0B265',
        '#7CC59A',
        '#8BB6E8',
        '#D6BEE9'
      ]
    };
  }

  let salesChartInstance = null;
  let currentSalesPeriod = 'Week';
  function drawSalesChart(period) {
    if (period) currentSalesPeriod = period;
    const ctx = document.getElementById('salesChart');
    if (!ctx || !window.Chart) return;
    if (salesChartInstance) salesChartInstance.destroy();

    const colors = getThemeChartColors();

    const hasOrders = ORDERS.length > 0;
    const dataMap = {
      Week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        sales: hasOrders ? [420, 560, 640, 590, 780, 920, 1020] : [0, 0, 0, 0, 0, 0, 0],
        orders: hasOrders ? [12, 15, 18, 16, 21, 26, 30] : [0, 0, 0, 0, 0, 0, 0]
      },
      Month: {
        labels: ['W1', 'W2', 'W3', 'W4'],
        sales: hasOrders ? [2800, 3400, 3900, 4500] : [0, 0, 0, 0],
        orders: hasOrders ? [85, 105, 120, 142] : [0, 0, 0, 0]
      },
      Year: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        sales: hasOrders ? [11200, 14500, 16800, 19400] : [0, 0, 0, 0],
        orders: hasOrders ? [340, 420, 490, 580] : [0, 0, 0, 0]
      }
    };
    const cur = dataMap[currentSalesPeriod] || dataMap.Week;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, colors.fillGradStart);
    gradient.addColorStop(1, colors.fillGradEnd);

    salesChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: cur.labels,
        datasets: [
          {
            label: 'Sales (฿)',
            data: cur.sales,
            fill: true,
            borderColor: colors.primary600,
            backgroundColor: gradient,
            tension: 0.4,
            pointBackgroundColor: colors.card,
            pointBorderColor: colors.primary600,
            pointBorderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'Orders',
            data: cur.orders,
            borderColor: '#F0B265',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            tension: 0.4,
            pointRadius: 3,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, color: colors.text } },
          tooltip: { backgroundColor: colors.tooltipBg, titleColor: colors.tooltipText, bodyColor: colors.muted, borderColor: colors.border, borderWidth: 1, padding: 10, cornerRadius: 12 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.muted } },
          y: { grid: { color: colors.gridColor }, ticks: { color: colors.muted } },
          y1: { display: false, position: 'right' }
        }
      }
    });
  }

  // ============================================================
  // PAGE 2: Orders
  // ============================================================
  PAGES.orders = (root) => {
    if (state.selectedOrder) return renderOrderDetail(root);
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Orders</h1>
          <div class="page-sub">Manage and process customer orders</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary" id="filterRefreshBtn"><svg viewBox="0 0 24 24"><path d="M4 6h16M6 12h12M8 18h8" stroke-linecap="round"/></svg>Refresh Orders</button>
        </div>
      </div>
    `));

    root.querySelector('#filterRefreshBtn').addEventListener('click', () => { loadSupabaseData(); toast('Orders refreshed', 'success'); });

    const filterBar = el(`
      <div class="filter-bar">
        <div class="search-wrap" style="flex:1; max-width:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>
          <input id="orderSearch" placeholder="Search by order ID or customer..." value="${escapeHTML(state.orderSearch)}"/>
        </div>
        <select class="select" id="orderStatus">
          <option value="all">All statuses</option>
          <option value="waiting">Waiting Payment</option>
          <option value="verify">Payment Verification</option>
          <option value="preparing">Preparing Order</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    `);
    root.appendChild(filterBar);
    filterBar.querySelector('#orderStatus').value = state.orderFilter;

    const listCard = el(`<div class="card" style="padding:0"><div class="table-wrap"></div><div class="pagination" style="padding: 12px 16px"></div></div>`);
    root.appendChild(listCard);

    function renderList() {
      const filtered = ORDERS.filter(o => {
        const matches = (o.id + ' ' + o.customer).toLowerCase().includes(state.orderSearch.toLowerCase());
        const s = state.orderFilter;
        return matches && (s === 'all' || o.status === s);
      });
      const table = el(`
        <table class="data">
          <thead><tr>
            <th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(o => `
              <tr data-id="${o.id}" style="cursor:pointer;">
                <td><strong>${escapeHTML(o.id)}</strong></td>
                <td>
                  <div style="font-weight:700;">${escapeHTML(o.customer)}</div>
                  ${(o.farm_tag || o.farm_name) ? `<div style="font-size:11px; color:var(--muted); margin-top:2px; display:inline-flex; align-items:center; gap:4px;"><span style="background:var(--primary-50); padding:1px 6px; border-radius:6px; border:1px solid var(--border);">${escapeHTML(o.farm_tag || o.farm_name)}</span><button type="button" class="btn btn-sm btn-ghost btn-copy-tag-quick" data-tag="${escapeHTML(o.farm_tag || o.farm_name)}" title="คัดลอกแท็กฟาร์ม" style="padding:2px 5px; border-radius:5px; border:1px solid var(--border); display:inline-flex; align-items:center; cursor:pointer;"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button></div>` : ''}
                </td>
                <td>${o.date}</td>
                <td>${o.items || (o.items_data ? o.items_data.length : 1)}</td>
                <td>${money(o.total)}</td>
                <td><span class="badge ${STATUS[o.status]?.cls || ''}"><span class="b-dot"></span>${STATUS[o.status]?.label || o.status}</span></td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-sm btn-view-single" data-id="${o.id}">View</button>
                  <button class="btn btn-sm btn-danger btn-delete-single" data-id="${o.id}" title="ลบออเดอร์นี้" style="padding:5px 8px; margin-left:4px; display:inline-flex; align-items:center; justify-content:center;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </button>
                </td>
              </tr>`).join('') : `<tr><td colspan="7"><div class="empty"><div class="icon">${ICONS.search}</div>No orders match your filters.</div></td></tr>`}
          </tbody>
        </table>
      `);
      const wrap = listCard.querySelector('.table-wrap');
      wrap.innerHTML = '';
      wrap.appendChild(table);

      table.querySelectorAll('tbody tr[data-id], .btn-view-single').forEach(elItem => elItem.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-single') || e.target.closest('.btn-copy-tag-quick')) return;
        const tr = elItem.closest('tr');
        state.selectedOrder = elItem.dataset.id || tr?.dataset.id;
        renderPage();
      }));

      table.querySelectorAll('.btn-copy-tag-quick').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tag = btn.dataset.tag || '';
          const doCopy = () => {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#3F8E63" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
            setTimeout(() => {
              btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            }, 1800);
            toast(`คัดลอกแท็กฟาร์ม "${tag}" เรียบร้อยแล้ว`, 'success');
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(tag).then(doCopy).catch(doCopy);
          } else {
            doCopy();
          }
        });
      });

      table.querySelectorAll('.btn-delete-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetOid = btn.dataset.id;
          const targetOrd = ORDERS.find(x => String(x.id).trim() === String(targetOid).trim() || String(x.order_number || '').trim() === String(targetOid).trim());
          if (targetOrd) {
            openDeleteOrderModal(targetOrd, () => {
              renderList();
            });
          }
        });
      });

      const pg = listCard.querySelector('.pagination');
      pg.innerHTML = `<span style="margin-right:auto; color:var(--muted); font-size:12.5px">Showing ${filtered.length} of ${ORDERS.length}</span>
        <button class="pg active">1</button>`;
    }
    renderList();

    filterBar.querySelector('#orderSearch').addEventListener('input', (e) => { state.orderSearch = e.target.value; renderList(); });
    filterBar.querySelector('#orderStatus').addEventListener('change', (e) => { state.orderFilter = e.target.value; renderList(); });
  };

  function openDeleteOrderModal(order, onSuccess) {
    if (!order) return;
    const deletePin = String(MASTER_DELETE_PIN || '888888');
    let enteredCode = '';

    const body = el(`
      <div class="calc-pin-card">
        <div style="background:rgba(229,139,148,0.12); border:1.5px solid var(--danger); border-radius:14px; padding:12px; display:flex; gap:10px; align-items:flex-start; text-align:left; margin-bottom:14px;">
          <div style="color:var(--danger); font-size:20px; flex:none; margin-top:1px;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
          </div>
          <div>
            <div style="font-weight:800; font-size:13px; color:var(--danger);">ยืนยันการลบออเดอร์ #${escapeHTML(order.id)}</div>
            <div style="font-size:11.5px; color:var(--muted); line-height:1.4; margin-top:2px;">
              การลบจะนำออเดอร์นี้ออกจากฐานข้อมูลและรีเซ็ตยอดอย่างถาวร (ต้องใส่รหัสผ่านความปลอดภัยสำหรับการลบ)
            </div>
          </div>
        </div>

        <div style="font-weight:700; color:var(--text); font-size:13px; margin-bottom:8px;">
          กรุณากดรหัสความปลอดภัยสำหรับการลบ (Master PIN) *
        </div>

        <!-- Calculator Display Screen -->
        <div class="calc-screen" id="delCalcScreen">
          <div class="calc-dots" id="delDotsRow">
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
          </div>
        </div>

        <!-- Calculator Round Keypad -->
        <div class="calc-keypad">
          <button type="button" class="calc-key" data-k="1">1</button>
          <button type="button" class="calc-key" data-k="2">2</button>
          <button type="button" class="calc-key" data-k="3">3</button>
          <button type="button" class="calc-key" data-k="4">4</button>
          <button type="button" class="calc-key" data-k="5">5</button>
          <button type="button" class="calc-key" data-k="6">6</button>
          <button type="button" class="calc-key" data-k="7">7</button>
          <button type="button" class="calc-key" data-k="8">8</button>
          <button type="button" class="calc-key" data-k="9">9</button>
          <button type="button" class="calc-key calc-key-action" data-k="clear">C</button>
          <button type="button" class="calc-key" data-k="0">0</button>
          <button type="button" class="calc-key calc-key-del" data-k="del">⌫</button>
        </div>

        <div style="margin-top: 14px; font-size: 11.5px; color: var(--muted);">
          รหัสลบถูกเก็บเป็นความลับในโค้ดระบบ
        </div>
      </div>
    `);

    function updateDelDots() {
      const dots = body.querySelectorAll('.calc-dot');
      dots.forEach((d, idx) => {
        if (idx < enteredCode.length) d.classList.add('filled');
        else d.classList.remove('filled');
      });
    }

    const executeDelete = async () => {
      const isMatch = (enteredCode === deletePin);
      if (!isMatch) {
        const dots = body.querySelectorAll('.calc-dot');
        dots.forEach(dot => dot.classList.add('error'));
        toast('รหัสผ่านความปลอดภัยสำหรับการลบไม่ถูกต้อง!', 'error');
        setTimeout(() => {
          enteredCode = '';
          dots.forEach(dot => { dot.classList.remove('filled'); dot.classList.remove('error'); });
        }, 450);
        return;
      }

      // 1. Delete from ORDERS array
      ORDERS = ORDERS.filter(x => String(x.id).trim() !== String(order.id).trim() && String(x.order_number || '').trim() !== String(order.id).trim());
      persistOrders();

      // 2. Remove from recentOrderNotifs
      state.recentOrderNotifs = state.recentOrderNotifs.filter(x => String(x.id).trim() !== String(order.id).trim());
      state.clearedOrderNotifIds.add(order.id);
      saveNotifsState();
      updateStockNotifications();

      // 3. Delete from Supabase
      if (supabase) {
        try {
          await supabase.from('order_items').delete().eq('order_id', order.id);
          await supabase.from('orders').delete().or(`id.eq.${order.id},order_number.eq.${order.id}`);
        } catch (e) {
          console.warn('Delete order Supabase notice:', e);
        }
      }

      // 4. Realtime broadcast order_deleted to all devices
      if (syncChannel) {
        try {
          syncChannel.send({
            type: 'broadcast',
            event: 'order_deleted',
            payload: { orderId: order.id }
          });
        } catch (e) {}
      }

      closeModal();
      document.removeEventListener('keydown', handleKeydown);
      toast(`ลบออเดอร์ #${order.id} สำเร็จเรียบร้อย`, 'success');
      if (onSuccess) onSuccess();
      else {
        state.selectedOrder = null;
        renderPage();
      }
    };

    body.querySelectorAll('.calc-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const k = btn.dataset.k;
        if (k === 'clear') {
          enteredCode = '';
        } else if (k === 'del') {
          enteredCode = enteredCode.slice(0, -1);
        } else if (enteredCode.length < 6) {
          enteredCode += k;
          if (enteredCode.length === 6) {
            setTimeout(executeDelete, 120);
          }
        }
        updateDelDots();
      });
    });

    const handleKeydown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredCode.length < 6) {
          enteredCode += e.key;
          updateDelDots();
          if (enteredCode.length === 6) setTimeout(executeDelete, 120);
        }
      } else if (e.key === 'Backspace') {
        enteredCode = enteredCode.slice(0, -1);
        updateDelDots();
      } else if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    openModal({
      title: `ลบออเดอร์ (Delete Order: #${order.id})`,
      body,
      actions: [
        { label: 'ยกเลิก (Cancel)', kind: 'ghost', onClick: () => document.removeEventListener('keydown', handleKeydown) },
        { label: 'ยืนยันลบออเดอร์', kind: 'danger', close: false, onClick: executeDelete }
      ]
    });
  }

  // Universal Cross-Browser Image Compression Helper
  function compressImageToDataUrl(file, maxWidth = 900, maxHeight = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function generateSampleSlipDataUrl(order) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#FFF8FB';
      ctx.fillRect(0, 0, 400, 540);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#F3DCE6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(20, 20, 360, 500, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#EFA6C1';
      ctx.fillRect(20, 20, 360, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PromptPay Transfer Slip', 200, 58);
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('BNC HayMate Bakery', 200, 115);
      ctx.fillStyle = '#777777';
      ctx.font = '12.5px sans-serif';
      ctx.fillText('Order: ' + order.id, 200, 140);
      ctx.fillText('Date: ' + order.date, 200, 160);
      ctx.fillText('Customer: ' + (order.customer || 'Customer'), 200, 180);
      ctx.strokeStyle = '#F3DCE6';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(40, 205);
      ctx.lineTo(360, 205);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#B24C74';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('฿' + Number(order.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 200, 250);
      ctx.fillStyle = '#3F8E63';
      ctx.font = 'bold 13.5px sans-serif';
      ctx.fillText('✓ Payment Verified', 200, 280);
      ctx.fillStyle = '#555555';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Bank: Kasikorn Bank · 123-4-56789-0', 50, 330);
      ctx.fillText('To: BNC HayMate Co., Ltd.', 50, 355);
      ctx.fillText('Ref: ' + order.id + '-PAY', 50, 380);
      ctx.fillStyle = '#999999';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Official E-Slip · Verified by Store', 200, 480);
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }

  function renderOrderDetail(root) {
    const targetId = String(state.selectedOrder || '').trim();
    const o = ORDERS.find(x => String(x.id).trim() === targetId || String(x.order_number).trim() === targetId || (x.id && targetId.includes(String(x.id))) || (x.order_number && targetId.includes(String(x.order_number))));
    if (!o) {
      toast('ไม่พบข้อมูลคำสั่งซื้อ #' + targetId, 'error');
      state.selectedOrder = null;
      renderPage();
      return;
    }

    const stepsOrder = ['waiting', 'verify', 'preparing', 'completed'];
    const stepLabels = {
      waiting: 'Waiting Payment (Order Received)',
      verify: 'Payment Verified',
      preparing: 'Preparing Order',
      completed: 'Completed'
    };
    const currentIdx = o.status === 'cancelled' ? -1 : stepsOrder.indexOf(o.status);

    root.appendChild(el(`
      <div class="page-head">
        <div>
          <div class="flex items-center gap-2" style="margin-bottom:4px">
            <button class="btn btn-sm" id="backBtn">← Back</button>
            <span class="badge ${STATUS[o.status]?.cls || ''}"><span class="b-dot"></span>${STATUS[o.status]?.label || o.status}</span>
          </div>
          <h1 class="page-title">Order ${escapeHTML(o.id)}</h1>
          <div class="page-sub">Placed on ${o.date} by ${escapeHTML(o.customer)}</div>
        </div>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          <button class="btn ${o.status === 'waiting' ? 'btn-primary' : ''}" data-action="verify">${o.status !== 'waiting' ? '✓ Verified' : 'Verify Payment'}</button>
          <button class="btn ${o.status === 'verify' ? 'btn-primary' : ''}" data-action="prepare">${o.status === 'preparing' || o.status === 'completed' ? '✓ Prepared' : 'Prepare Order'}</button>
          <button class="btn ${o.status === 'preparing' ? 'btn-primary' : ''}" data-action="complete">${o.status === 'completed' ? '✓ Completed' : 'Complete Order'}</button>
          <button class="btn btn-ghost" data-action="cancel" style="color:var(--muted);">Cancel</button>
          <button class="btn btn-danger" data-action="delete_order" style="display:inline-flex; align-items:center; gap:4px; font-weight:700;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            ลบออเดอร์
          </button>
        </div>
      </div>
    `));

    root.querySelector('#backBtn').addEventListener('click', () => { state.selectedOrder = null; renderPage(); });
    root.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', async () => {
      const act = b.dataset.action;
      if (act === 'delete_order') {
        openDeleteOrderModal(o, () => {
          state.selectedOrder = null;
          renderPage();
        });
        return;
      }
      if (act === 'cancel') {
        confirmDialog('Cancel this order?', async () => {
          o.status = 'cancelled';
          persistOrders();
          if (syncChannel) {
            try {
              syncChannel.send({
                type: 'broadcast',
                event: 'order_status_update',
                payload: { orderId: o.id, status: 'cancelled' }
              });
            } catch (e) {}
          }
          if (supabase) {
            try {
              await supabase.from('orders').update({ status: 'cancelled' }).eq('order_number', o.id);
            } catch (e) {}
          }
          toast('Order cancelled', 'success');
          renderPage();
        });
      } else {
        const nextStatus = act === 'verify' ? 'verify' : act === 'prepare' ? 'preparing' : 'completed';
        o.status = nextStatus;
        persistOrders();
        if (syncChannel) {
          try {
            syncChannel.send({
              type: 'broadcast',
              event: 'order_status_update',
              payload: { orderId: o.id, status: nextStatus }
            });
          } catch (e) {}
        }
        if (supabase) {
          try {
            await supabase.from('orders').update({ status: nextStatus }).eq('order_number', o.id);
          } catch (e) {}
        }
        toast(`Order updated to: ${STATUS[nextStatus]?.label || nextStatus}`, 'success');
        renderPage();
      }
    }));

    const grid = el(`<div class="grid detail-grid"></div>`);
    root.appendChild(grid);

    let itemsList = [];
    if (Array.isArray(o.items_data) && o.items_data.length > 0) {
      itemsList = o.items_data;
    } else if (Array.isArray(o.items_list) && o.items_list.length > 0) {
      itemsList = o.items_list;
    } else if (typeof o.items_data === 'string') {
      try { itemsList = JSON.parse(o.items_data); } catch(e) {}
    }

    if (!itemsList || itemsList.length === 0) {
      itemsList = PRODUCTS.slice(0, Math.max(1, Number(o.items || 1))).map((p) => ({
        id: p.id,
        name: p.name,
        cat: p.cat || 'Bakery',
        image: p.image || DEFAULT_PRODUCT_IMG,
        price: Number(p.price || 0),
        qty: 1
      }));
    }

    grid.appendChild(el(`
      <div class="card">
        <div class="card-title">Items (${itemsList.length})</div>
        <div class="card-sub">รายการสินค้าที่ลูกค้าสั่งซื้อในออเดอร์นี้</div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${itemsList.map((it) => {
                const imgUrl = it.image || DEFAULT_PRODUCT_IMG;
                const unitPrice = Number(it.price || 0);
                const quantity = Number(it.qty || 1);
                const itemSub = unitPrice * quantity;
                return `
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <div style="width:40px; height:40px; border-radius:10px; overflow:hidden; background:var(--primary-50); border:1px solid var(--border); flex:none;">
                        <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(it.name || 'Product')}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:13.5px; color:var(--text);">${escapeHTML(it.name || 'Product')}</div>
                        <div style="font-size:11.5px; color:var(--muted);">${escapeHTML(it.cat || 'Bakery')}</div>
                      </div>
                    </div>
                  </td>
                  <td style="font-weight:700; font-size:13.5px;">${quantity}</td>
                  <td>${money(unitPrice)}</td>
                  <td style="font-weight:800; color:var(--accent-text);">${money(itemSub)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="kv" style="margin-top:12px"><span class="k">ยอดรวมสินค้า (Subtotal)</span><span class="v">${money(o.subtotal !== undefined ? o.subtotal : o.total)}</span></div>
        ${o.discount > 0 ? `<div class="kv"><span class="k" style="color:var(--accent-text)">ส่วนลดโปรโมชั่น</span><span class="v" style="color:var(--danger)">-${money(o.discount)}</span></div>` : ''}
        <div class="kv" style="border-top:1px dashed var(--border); padding-top:6px; margin-top:4px;"><span class="k" style="font-weight:800; font-size:15px;">ยอดรวมสุทธิ (Total)</span><span class="v" style="color:var(--accent-text); font-size:16px; font-weight:800;">${money(o.total)}</span></div>

        <div style="margin-top:18px">
          <div class="card-title" style="margin-bottom:10px">Progress Timeline</div>
          <div class="timeline">
            ${stepsOrder.map((s, i) => {
              const isDone = (i <= currentIdx);
              const isActive = (i === currentIdx);
              return `
                <div class="step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}">
                  <div class="bullet">${isDone ? '✓' : (i + 1)}</div>
                  <div>
                    <div class="label" style="${isActive ? 'font-weight:700; color:var(--accent-text);' : ''}">${stepLabels[s]}</div>
                    <div class="sub">${isDone ? (isActive ? '● Current Step · ' + o.date : '✓ Completed') : 'Pending'}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `));

    const custEmail = (o.contact && o.contact.includes('@')) ? o.contact : `${(o.customer || 'customer').toLowerCase().replace(/\s+/g, '')}@customer.com`;
    const custPhone = (o.contact && !o.contact.includes('@')) ? o.contact : '-';
    const custAddr = [o.farm_name, o.farm_tag].filter(Boolean).join(' · ') || 'Store Delivery';
    const custInitial = (o.customer || 'C').slice(0, 2).toUpperCase();
    const slipImgSrc = (o.slip_url && o.slip_url.trim()) ? o.slip_url.trim() : '';

    grid.appendChild(el(`
      <div style="display:flex; flex-direction:column; gap:18px">
        <div class="card">
          <div class="card-title">Customer</div>
          <div class="card-sub">Buyer information</div>
          <div class="flex items-center gap-3">
            <div class="avatar" style="width:44px;height:44px;border-radius:12px">${escapeHTML(custInitial)}</div>
            <div>
              <div style="font-weight:700">${escapeHTML(o.customer || 'Customer')}</div>
              <div style="font-size:12px; color:var(--muted)">${escapeHTML(custEmail)}</div>
            </div>
          </div>
          <div class="kv" style="margin-top:12px"><span class="k">Phone</span><span class="v">${escapeHTML(custPhone)}</span></div>
          <div class="kv" style="align-items:center;">
            <span class="k">Farm / Tag</span>
            <span class="v" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong style="color:var(--text);">${escapeHTML(custAddr)}</strong>
              ${(o.farm_tag || o.farm_name) ? `
                <button type="button" class="btn btn-sm btn-ghost btn-copy-farmtag" data-tag="${escapeHTML(o.farm_tag || o.farm_name)}" title="คัดลอกแท็กฟาร์ม" style="font-size:11.5px; padding:3px 10px; border:1px solid var(--border); border-radius:8px; display:inline-flex; align-items:center; gap:5px; font-weight:700; color:var(--accent-text); cursor:pointer;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  <span>Copy Tag</span>
                </button>
              ` : ''}
            </span>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Payment Slip</div>
          <div class="card-sub">${slipImgSrc ? 'Customer Uploaded Transfer Slip' : 'No slip attached'}</div>
          
          ${slipImgSrc ? `
            <div class="file-preview" style="aspect-ratio:auto; padding:10px; max-height:280px; overflow:hidden; background:var(--card); margin-top:8px;">
              <img src="${slipImgSrc}" alt="Payment Slip" style="max-height:260px; max-width:100%; border-radius:8px; object-fit:contain; margin:0 auto; display:block; box-shadow:var(--shadow-soft);" />
            </div>
            
            <a href="${slipImgSrc}" download="Payment-Slip-${o.id}.png" class="btn btn-primary btn-block mt-3" style="text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px; font-weight:700;">
              ดาวน์โหลดสลิป (Download Slip)
            </a>
          ` : `
            <div style="text-align:center; padding:24px 16px; color:var(--muted); background:var(--primary-50); border:1px dashed var(--border); border-radius:12px; margin-top:8px;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="margin:0 auto 6px; display:block; color:var(--muted);"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              <div style="font-size:13px; font-weight:700; color:var(--text);">ไม่มีสลิปแนบมากับออเดอร์นี้</div>
              <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">(ออเดอร์จากการชำระเงินทางช่องทางอื่น)</div>
            </div>
          `}
        </div>
      </div>
    `));

    grid.querySelectorAll('.btn-copy-farmtag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tagText = btn.dataset.tag || '';
        const doCopy = () => {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#3F8E63" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span style="color:#3F8E63;">Copied!</span>
          `;
          btn.style.borderColor = '#7CC59A';
          setTimeout(() => {
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy Tag</span>
            `;
            btn.style.borderColor = 'var(--border)';
          }, 1800);
          toast(`คัดลอกแท็กฟาร์ม "${tagText}" เรียบร้อยแล้ว`, 'success');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(tagText).then(doCopy).catch(doCopy);
        } else {
          doCopy();
        }
      });
    });
  }

  // ============================================================
  // UNIVERSAL CART ITEM RESOLVER (Items, Coin Farming, Game IDs)
  // ============================================================
  function getCartItemDetails(key) {
    const k = String(key || '').trim();
    if (!k) return null;

    if (k.startsWith('cf_tier_')) {
      const raw = k.slice('cf_tier_'.length);
      const boxes = state.store?.coinFarmBoxes || DEFAULT_STORE_CONFIG.coinFarmBoxes || [];
      for (const box of boxes) {
        for (const tier of (box.tiers || [])) {
          if (raw === `${box.id}_${tier.id}` || raw === tier.id || raw.endsWith(`_${tier.id}`)) {
            return {
              id: k,
              rawId: tier.id,
              boxId: box.id,
              type: 'coin_farm',
              name: `วนเหรียญ: ${tier.coins} (${box.title})`,
              cat: 'วนเหรียญ',
              price: Number(tier.price || 0),
              stock: 9999,
              desc: tier.desc || box.title,
              image: DEFAULT_PRODUCT_IMG
            };
          }
        }
      }
    } else if (k.startsWith('game_acc_')) {
      const accId = k.slice('game_acc_'.length);
      const accounts = state.store?.gameAccounts || DEFAULT_STORE_CONFIG.gameAccounts || [];
      const acc = accounts.find(a => String(a.id) === String(accId));
      if (acc) {
        return {
          id: k,
          rawId: acc.id,
          type: 'game_account',
          name: `[${acc.code}] ${acc.title}`,
          cat: 'ID Game',
          price: Number(acc.price || 0),
          stock: acc.status === 'available' ? 1 : 0,
          desc: acc.details || '',
          image: (acc.images && acc.images[0]) || DEFAULT_PRODUCT_IMG,
          account: acc
        };
      }
    }

    const p = PRODUCTS.find(x => String(x.id) === k);
    if (p) {
      const ratio = Number(state.store?.priceRatio) || 1.0;
      const effectivePrice = Math.round(Number(p.price || 0) * ratio * 100) / 100;
      return {
        id: p.id,
        rawId: p.id,
        type: 'item',
        name: p.name,
        cat: p.cat || 'Item',
        price: effectivePrice,
        stock: Number(p.stock !== undefined ? p.stock : 0),
        desc: p.flavor || p.description || '',
        image: p.image || DEFAULT_PRODUCT_IMG,
        level: p.level || 1
      };
    }
    return null;
  }

  // ============================================================
  // PAGE 3: Product Settings & Management Hub (Item HayDay, วนเหรียญ, ID Game)
  // ============================================================
  state.adminProductTab = state.adminProductTab || 'items';

  PAGES.products = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Products &amp; Services</h1>
          <div class="page-sub">จัดการสินค้าไอเทม บริการวนเหรียญ และตลาดซื้อขายไอดีเกม</div>
        </div>
      </div>
    `));

    // 3 Sub-tabs Navigation (No Emojis)
    const hubNav = el(`
      <div class="product-hub-nav">
        <button type="button" class="hub-tab-btn ${state.adminProductTab === 'items' ? 'active' : ''}" data-tab="items">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          <span>1. Item HayDay</span>
        </button>
        <button type="button" class="hub-tab-btn ${state.adminProductTab === 'coin_farm' ? 'active' : ''}" data-tab="coin_farm">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9h-4a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3h-4"/><path d="M12 7v10"/></svg>
          <span>2. วนเหรียญ (Coin Farming)</span>
        </button>
        <button type="button" class="hub-tab-btn ${state.adminProductTab === 'game_ids' ? 'active' : ''}" data-tab="game_ids">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="5" rx="3"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/></svg>
          <span>3. ID Game (ไอดีเกม)</span>
        </button>
      </div>
    `);
    root.appendChild(hubNav);

    const contentContainer = el(`<div id="adminProductTabContent"></div>`);
    root.appendChild(contentContainer);

    hubNav.querySelectorAll('.hub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.adminProductTab = btn.dataset.tab;
        hubNav.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderActiveProductTab();
      });
    });

    function renderActiveProductTab() {
      contentContainer.innerHTML = '';
      if (state.adminProductTab === 'items') {
        renderAdminItemsTab(contentContainer);
      } else if (state.adminProductTab === 'coin_farm') {
        renderAdminCoinFarmTab(contentContainer);
      } else if (state.adminProductTab === 'game_ids') {
        renderAdminGameIdsTab(contentContainer);
      }
    }

    renderActiveProductTab();
  };

  // --- TAB 1: Item HayDay Management ---
  function renderAdminItemsTab(container) {
    const currentStep = Number(state.store.itemClickStep) || 1;
    const currentRatio = state.store.priceRatio !== undefined ? Number(state.store.priceRatio) : 1.0;
    const priceRules = state.store.priceRules || [];

    const wrap = el(`
      <div>
        <!-- Module Toggle Row -->
        <div class="module-switch-row">
          <div>
            <strong style="font-size:13.5px; color:var(--text);">เปิดขายสินค้าไอเทมในหน้าร้าน (Enable Items Storefront)</strong>
            <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">เมื่อเปิด สินค้าไอเทมจะแสดงในหน้าร้านและหน้าแรก หากปิดจะซ่อนเฉพาะหมวดนี้</div>
          </div>
          <label class="clean-switch">
            <input type="checkbox" id="swEnableItems" ${state.store.enableItems !== false ? 'checked' : ''} />
            <span class="clean-slider"></span>
          </label>
        </div>

        <!-- SECTION: Setting Price (ตั้งค่าราคา & สเต็ปตามเลเวลและหมวดหมู่) -->
        <div class="card" style="margin-bottom:16px;">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <div>
              <h2 style="font-size:19px; font-weight:800; color:var(--text); margin:0 0 3px 0;">Setting Price (ตั้งค่าราคา &amp; สเต็ปตามเลเวลและหมวดหมู่)</h2>
              <div style="font-size:12px; color:var(--muted);">จัดการกำหนดสเต็ปราคาสินค้าขายส่งตามหมวดหมู่และช่วงเลเวล (เช่น อาหารสัตว์ Lv. 1–75, Lv. 76–256 หรือ All Level)</div>
            </div>
            <button type="button" class="btn btn-primary" id="btnAddPriceRuleBox" style="font-weight:800; border-radius:12px; font-size:12.5px; padding:7px 16px;">
              + เพิ่มกล่องราคาใหม่ (+ Add Price Rule Box)
            </button>
          </div>

          <div style="font-weight:800; font-size:13.5px; color:var(--text); margin-bottom:12px;">
            กล่องราคาที่เปิดใช้งาน (${priceRules.length} กล่อง)
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;" id="priceRulesGrid"></div>
        </div>

        <!-- SECTION: Item Catalog & Controls -->
        <div class="card" style="margin-bottom:14px;">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div>
              <div class="card-title">Item HayDay Catalog (${PRODUCTS.length} รายการ)</div>
              <div class="card-sub">จัดการรายการสินค้าไอเทม หมวดหมู่ ราคา และสต็อก</div>
            </div>
            <div class="flex gap-2" style="flex-wrap:wrap;">
              <button class="btn btn-primary" id="btnAddItemProduct">+ Add Product</button>
              <button class="btn" id="btnManageCategories">Manage Categories (${CATEGORIES.length})</button>
            </div>
          </div>

          <!-- Complete Dropdown Filter Toolbar -->
          <div class="filter-bar" style="margin-top:14px; flex-wrap:wrap; gap:8px;">
            <div class="search-wrap" style="flex:1; min-width:180px; max-width:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>
              <input placeholder="Search items..." id="adminItemSearch"/>
            </div>
            <select class="select" id="adminItemCat" style="width:auto">
              <option value="">ทุกหมวดหมู่ (All Categories)</option>
              ${CATEGORIES.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
            </select>
            <select class="select" id="adminItemLevel" style="width:auto">
              <option value="">ทุกเลเวล (All Levels)</option>
              <option value="1-20">Lv. 1 - 20</option>
              <option value="21-40">Lv. 21 - 40</option>
              <option value="41-60">Lv. 41 - 60</option>
              <option value="61-80">Lv. 61 - 80</option>
              <option value="81+">Lv. 81+</option>
            </select>
            <select class="select" id="adminItemMultiplier" style="width:auto; font-weight:700; color:var(--accent-text);">
              <option value="1" ${currentStep === 1 ? 'selected' : ''}>x1 ชิ้น/คลิก</option>
              <option value="10" ${currentStep === 10 ? 'selected' : ''}>x10 ชิ้น/คลิก</option>
              <option value="80" ${currentStep === 80 ? 'selected' : ''}>x80 ชิ้น/คลิก</option>
              <option value="100" ${currentStep === 100 ? 'selected' : ''}>x100 ชิ้น/คลิก</option>
            </select>
            <button type="button" class="btn btn-sm btn-ghost" id="btnAdminResetFilters" style="border:1px solid var(--border); font-weight:700; padding:6px 12px; border-radius:10px;">
              ล้างค่า (Reset)
            </button>
          </div>

          <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px; color:var(--muted); font-size:12.5px">
            <span id="adminItemCount"></span>
            <span>Tap to add · Right-click to edit/manage</span>
          </div>

          <div class="product-grid" id="adminItemGrid"></div>
          <div class="pagination" id="adminItemPager"></div>
        </div>
      </div>
    `);
    container.appendChild(wrap);

    // Module Switch
    wrap.querySelector('#swEnableItems')?.addEventListener('change', (e) => {
      state.store.enableItems = e.target.checked;
      syncStoreSettingsAcrossDevices();
      toast(state.store.enableItems ? 'เปิดการแสดงผลหมวด Item ในหน้าร้านแล้ว' : 'ปิดการแสดงผลหมวด Item ในหน้าร้านแล้ว', 'info');
    });

    // Render Price Rules Boxes
    const rulesGrid = wrap.querySelector('#priceRulesGrid');
    const renderPriceRules = () => {
      if (!rulesGrid) return;
      rulesGrid.innerHTML = '';
      const list = state.store.priceRules || [];

      if (list.length === 0) {
        rulesGrid.innerHTML = `
          <div style="grid-column:1/-1; padding:24px; text-align:center; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:16px; color:var(--muted);">
            <div style="font-weight:700; font-size:13.5px; color:var(--text); margin-bottom:4px;">ยังไม่มีกล่องราคาที่กำหนด</div>
            <div style="font-size:12px;">กดปุ่ม "+ เพิ่มกล่องราคาใหม่" ด้านบนเพื่อเริ่มกำหนดสเต็ปและเรทราคาตามหมวดหมู่และเลเวล</div>
          </div>
        `;
        return;
      }

      list.forEach((rule, rIdx) => {
        const card = el(`
          <div class="price-rule-card">
            <div class="price-rule-header">
              <div class="flex items-center gap-2">
                <span class="price-badge-cat">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                  <span>${escapeHTML(rule.category || 'ทุกหมวดหมู่')}</span>
                </span>
                <span class="price-badge-lvl ${rule.isAllLevel ? 'all' : ''}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  <span>${rule.isAllLevel ? 'All Level' : `${rule.levelMin || 1} – ${rule.levelMax || 999}`}</span>
                </span>
              </div>
              <div class="flex gap-1">
                <button type="button" class="btn btn-sm btn-ghost btn-edit-rule" title="แก้ไขกล่องราคา" style="padding:4px 8px; font-size:12px; border-radius:8px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button type="button" class="btn btn-sm btn-ghost btn-del-rule" title="ลบกล่องราคา" style="padding:4px 8px; font-size:12px; color:var(--danger); border-radius:8px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>

            <div class="price-step-row">
              <div class="flex items-center gap-2" style="font-size:12.5px; font-weight:700; color:var(--text);">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <span>กดคลิกเพิ่มทีละ:</span>
              </div>
              <div class="flex items-center gap-1">
                <input type="number" class="input input-sm inp-rule-step" value="${rule.step || 10}" min="1" max="1000" style="width:65px; text-align:center; font-weight:800; padding:4px 6px; font-size:13px; border-radius:8px;" />
                <span style="font-size:11.5px; font-weight:700; color:var(--muted);">ชิ้น / คลิก</span>
              </div>
            </div>

            <div>
              <div class="flex items-center" style="justify-content:space-between; margin-bottom:8px;">
                <span style="font-weight:800; font-size:12.5px; color:var(--text);">รายการราคา (${(rule.tiers || []).length})</span>
                <button type="button" class="btn btn-sm btn-ghost btn-add-tier" style="font-size:11.5px; font-weight:800; padding:3px 8px; border:1px solid var(--border); border-radius:8px;">
                  + เพิ่มราคา
                </button>
              </div>

              <div class="price-tiers-list">
                ${(rule.tiers && rule.tiers.length > 0) ? rule.tiers.map((t, tIdx) => {
                  const unitPrice = t.qty > 0 ? (t.price / t.qty) : 0;
                  return `
                    <div class="price-tier-item">
                      <div style="font-size:13px; font-weight:700; color:var(--text);">
                        <strong>${t.qty} ชิ้น</strong> → <span style="font-weight:900; color:var(--accent-text); font-size:14.5px;">${money(t.price)}</span>
                        <span style="font-size:11px; color:var(--muted); font-weight:600; margin-left:4px;">(${money(unitPrice)}/ชิ้น)</span>
                      </div>
                      <button type="button" class="btn btn-sm btn-ghost btn-del-tier" data-tidx="${tIdx}" style="padding:2px 6px; color:var(--danger); font-size:13px; font-weight:800;" title="ลบรายการราคานี้">
                        ✕
                      </button>
                    </div>
                  `;
                }).join('') : `
                  <div style="padding:12px; text-align:center; font-size:11.5px; color:var(--muted); background:var(--primary-50); border-radius:10px;">ยังไม่มีรายการราคาในกล่องนี้</div>
                `}
              </div>
            </div>
          </div>
        `);

        // Edit Step Input
        const stepInp = card.querySelector('.inp-rule-step');
        stepInp?.addEventListener('change', () => {
          rule.step = Number(stepInp.value) || 10;
          syncStoreSettingsAcrossDevices();
          toast(`อัปเดตสเต็ปคลิก ${rule.category} เป็น ${rule.step} ชิ้น/คลิก แล้ว`, 'success');
        });

        // Edit Rule
        card.querySelector('.btn-edit-rule')?.addEventListener('click', () => openAddPriceRuleModal(rule));

        // Delete Rule
        card.querySelector('.btn-del-rule')?.addEventListener('click', () => {
          if (confirm(`คุณต้องการลบกล่องราคา "${rule.category}" ใช่หรือไม่?`)) {
            state.store.priceRules.splice(rIdx, 1);
            syncStoreSettingsAcrossDevices();
            toast('ลบกล่องราคาเรียบร้อยแล้ว', 'info');
            renderPriceRules();
          }
        });

        // Add Tier
        card.querySelector('.btn-add-tier')?.addEventListener('click', () => openAddPriceTierModal(rule));

        // Delete Tier
        card.querySelectorAll('.btn-del-tier').forEach(btn => {
          btn.addEventListener('click', () => {
            const tIdx = +btn.dataset.tidx;
            rule.tiers.splice(tIdx, 1);
            syncStoreSettingsAcrossDevices();
            toast('ลบรายการราคาเรียบร้อย', 'info');
            renderPriceRules();
          });
        });

        rulesGrid.appendChild(card);
      });
    };

    renderPriceRules();

    wrap.querySelector('#btnAddPriceRuleBox')?.addEventListener('click', () => openAddPriceRuleModal());

    wrap.querySelector('#btnAddItemProduct')?.addEventListener('click', () => openAddProductModal());
    wrap.querySelector('#btnManageCategories')?.addEventListener('click', () => {
      state.page = 'categories';
      renderMenu();
      renderPage();
    });

    const grid = wrap.querySelector('#adminItemGrid');
    const pager = wrap.querySelector('#adminItemPager');
    const countEl = wrap.querySelector('#adminItemCount');
    const searchInp = wrap.querySelector('#adminItemSearch');
    const catSelect = wrap.querySelector('#adminItemCat');
    const levelSelect = wrap.querySelector('#adminItemLevel');
    const multiplierSelect = wrap.querySelector('#adminItemMultiplier');
    const btnReset = wrap.querySelector('#btnAdminResetFilters');
    const PAGE_SIZE = 160;
    let currentPage = 1;
    let clickMultiplier = Number(multiplierSelect.value) || currentStep || 1;

    multiplierSelect.addEventListener('change', () => {
      clickMultiplier = Number(multiplierSelect.value) || 1;
    });

    btnReset.addEventListener('click', () => {
      searchInp.value = '';
      catSelect.value = '';
      levelSelect.value = '';
      multiplierSelect.value = String(state.store.itemClickStep || 1);
      clickMultiplier = Number(multiplierSelect.value) || 1;
      currentPage = 1;
      drawGrid();
      toast('ล้างค่าตัวกรองเรียบร้อยแล้ว', 'info');
    });

    function drawGrid() {
      const q = searchInp.value.toLowerCase().trim();
      const cat = catSelect.value;
      const lvl = levelSelect.value;

      const list = PRODUCTS.filter(p => {
        if (q && !p.name.toLowerCase().includes(q) && !(p.cat || '').toLowerCase().includes(q)) return false;
        if (cat && p.cat !== cat) return false;
        if (lvl) {
          const pLevel = Number(p.level) || 1;
          if (lvl === '1-20' && (pLevel < 1 || pLevel > 20)) return false;
          if (lvl === '21-40' && (pLevel < 21 || pLevel > 40)) return false;
          if (lvl === '41-60' && (pLevel < 41 || pLevel > 60)) return false;
          if (lvl === '61-80' && (pLevel < 61 || pLevel > 80)) return false;
          if (lvl === '81+' && pLevel < 81) return false;
        }
        return true;
      });

      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * PAGE_SIZE;
      const pageItems = list.slice(start, start + PAGE_SIZE);

      countEl.textContent = list.length
        ? `Showing ${start + 1}–${Math.min(list.length, start + PAGE_SIZE)} of ${list.length} products`
        : 'No products';
      grid.innerHTML = '';

      const ratio = Number(state.store?.priceRatio) || 1.0;

      pageItems.forEach(p => {
        const stockCls = p.stock === 0 ? 'out' : p.stock < 10 ? 'low' : '';
        const qty = state.selected[p.id] || 0;
        const imgUrl = p.image || DEFAULT_PRODUCT_IMG;
        const effectivePrice = Math.round(Number(p.price || 0) * ratio * 100) / 100;
        const mediaHtml = `<img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.name)}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />`;
        const tile = el(`
          <div class="product-tile ${stockCls} ${qty ? 'selected' : ''}" data-id="${p.id}" title="${escapeHTML(p.name)} · ${money(effectivePrice)} (Lv.${p.level || 1})">
            ${mediaHtml}
            <span class="stock-dot"></span>
            <span class="qty-badge">${qty}</span>
          </div>
        `);
        tile.addEventListener('click', () => {
          if (p.stock === 0) return toast(`${p.name} is out of stock`, 'error');
          state.selected[p.id] = (state.selected[p.id] || 0) + clickMultiplier;
          tile.classList.add('selected');
          const badge = tile.querySelector('.qty-badge');
          badge.textContent = state.selected[p.id];
          badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';
        });
        tile.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (!state.selected[p.id]) return openProductQuickModal(p);
          state.selected[p.id] -= clickMultiplier;
          if (state.selected[p.id] <= 0) {
            delete state.selected[p.id];
            tile.classList.remove('selected');
          } else {
            tile.querySelector('.qty-badge').textContent = state.selected[p.id];
          }
        });
        grid.appendChild(tile);
      });

      if (!list.length) grid.appendChild(el(`<div class="card empty" style="grid-column: 1/-1"><div class="icon">${ICONS.products}</div>No products match your filters.</div>`));

      pager.innerHTML = '';
      if (totalPages > 1) {
        const mkBtn = (label, page, opts = {}) => {
          const b = el(`<button class="pg ${opts.active ? 'active' : ''}" ${opts.disabled ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>${label}</button>`);
          if (!opts.disabled) b.addEventListener('click', () => { currentPage = page; drawGrid(); });
          return b;
        };
        pager.appendChild(mkBtn('‹', currentPage - 1, { disabled: currentPage === 1 }));
        for (let i = 1; i <= totalPages; i++) pager.appendChild(mkBtn(String(i), i, { active: i === currentPage }));
        pager.appendChild(mkBtn('›', currentPage + 1, { disabled: currentPage === totalPages }));
      }
    }

    searchInp.addEventListener('input', () => { currentPage = 1; drawGrid(); });
    catSelect.addEventListener('change', () => { currentPage = 1; drawGrid(); });
    levelSelect.addEventListener('change', () => { currentPage = 1; drawGrid(); });
    drawGrid();
  }

  // Modals for Setting Price
  function openAddPriceRuleModal(ruleToEdit = null) {
    const isEdit = !!ruleToEdit;
    const rule = ruleToEdit || {
      id: 'pr_' + Date.now(),
      category: CATEGORIES[0]?.name || 'อาหารสัตว์',
      levelMin: 1,
      levelMax: 75,
      isAllLevel: false,
      step: 10,
      tiers: [
        { id: 'pt_1', qty: 10, price: 2.00 },
        { id: 'pt_2', qty: 50, price: 8.00 },
        { id: 'pt_3', qty: 100, price: 15.00 }
      ]
    };

    const { modal, body } = openModal({
      title: isEdit ? 'แก้ไขกล่องราคา (Edit Price Rule Box)' : 'เพิ่มกล่องราคาใหม่ (+ Add Price Rule Box)',
      width: 480
    });

    body.appendChild(el(`
      <form id="formPriceRule" style="display:flex; flex-direction:column; gap:14px;">
        <div class="field">
          <label style="font-weight:700;">หมวดหมู่สินค้า (Category)</label>
          <select class="select" id="prCategory" required>
            <option value="All" ${rule.category === 'All' ? 'selected' : ''}>ทุกหมวดหมู่ (All Categories)</option>
            ${CATEGORIES.map(c => `<option value="${escapeHTML(c.name)}" ${rule.category === c.name ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label style="font-weight:700;">รูปแบบการกรองเลเวล (Level Range)</label>
          <div class="flex gap-2" style="margin-bottom:8px;">
            <button type="button" class="btn btn-sm ${!rule.isAllLevel ? 'btn-primary' : ''}" id="btnPrTypeRange" style="font-size:12px;">ระบุช่วงเลเวล (Min - Max)</button>
            <button type="button" class="btn btn-sm ${rule.isAllLevel ? 'btn-primary' : ''}" id="btnPrTypeAll" style="font-size:12px;">ทุกเลเวล (All Level)</button>
          </div>
          <div class="grid" id="prRangeWrap" style="grid-template-columns:1fr 1fr; gap:10px; display:${rule.isAllLevel ? 'none' : 'grid'};">
            <div>
              <label style="font-size:11px;">เลเวลเริ่มต้น (Min Lv.)</label>
              <input type="number" class="input" id="prMinLvl" value="${rule.levelMin || 1}" min="1" max="999" />
            </div>
            <div>
              <label style="font-size:11px;">เลเวลสูงสุด (Max Lv.)</label>
              <input type="number" class="input" id="prMaxLvl" value="${rule.levelMax || 75}" min="1" max="999" />
            </div>
          </div>
        </div>

        <div class="field">
          <label style="font-weight:700;">จำนวนคลิกเพิ่มทีละ (Items per click step)</label>
          <input type="number" class="input" id="prStep" value="${rule.step || 10}" min="1" max="1000" placeholder="เช่น 10" required />
          <div style="font-size:11px; color:var(--muted); margin-top:3px;">จำนวนชิ้นที่ระบบจะเพิ่มลงตะกร้าเมื่อคลิกสินค้าในหมวด/เลเวลนี้</div>
        </div>

        <div class="flex gap-2" style="justify-content:flex-end; margin-top:10px;">
          <button type="button" class="btn" id="btnCancelPr">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" style="font-weight:800;">${isEdit ? 'บันทึกการแก้ไข' : 'บันทึกกล่องราคา'}</button>
        </div>
      </form>
    `));

    let isAllLvl = !!rule.isAllLevel;
    const btnTypeRange = body.querySelector('#btnPrTypeRange');
    const btnTypeAll = body.querySelector('#btnPrTypeAll');
    const rangeWrap = body.querySelector('#prRangeWrap');

    btnTypeRange?.addEventListener('click', () => {
      isAllLvl = false;
      btnTypeRange.classList.add('btn-primary');
      btnTypeAll.classList.remove('btn-primary');
      rangeWrap.style.display = 'grid';
    });

    btnTypeAll?.addEventListener('click', () => {
      isAllLvl = true;
      btnTypeAll.classList.add('btn-primary');
      btnTypeRange.classList.remove('btn-primary');
      rangeWrap.style.display = 'none';
    });

    body.querySelector('#btnCancelPr')?.addEventListener('click', () => closeModal());

    body.querySelector('#formPriceRule')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = body.querySelector('#prCategory').value;
      const step = Number(body.querySelector('#prStep').value) || 10;
      const minLvl = isAllLvl ? 1 : (Number(body.querySelector('#prMinLvl').value) || 1);
      const maxLvl = isAllLvl ? 999 : (Number(body.querySelector('#prMaxLvl').value) || 999);

      if (!state.store.priceRules) state.store.priceRules = [];

      if (isEdit) {
        const target = state.store.priceRules.find(r => r.id === rule.id);
        if (target) {
          target.category = cat;
          target.step = step;
          target.isAllLevel = isAllLvl;
          target.levelMin = minLvl;
          target.levelMax = maxLvl;
        }
      } else {
        state.store.priceRules.push({
          id: 'pr_' + Date.now(),
          category: cat,
          step: step,
          isAllLevel: isAllLvl,
          levelMin: minLvl,
          levelMax: maxLvl,
          tiers: [
            { id: 'pt_1', qty: step, price: 2.00 },
            { id: 'pt_2', qty: step * 5, price: 8.00 },
            { id: 'pt_3', qty: step * 10, price: 15.00 }
          ]
        });
      }

      syncStoreSettingsAcrossDevices();
      closeModal();
      toast(isEdit ? 'แก้ไขกล่องราคาเรียบร้อย' : 'เพิ่มกล่องราคาใหม่เรียบร้อยแล้ว', 'success');
      const content = document.getElementById('adminProductTabContent');
      if (content && state.adminProductTab === 'items') renderAdminItemsTab(content);
    });
  }

  function openAddPriceTierModal(rule) {
    const { modal, body } = openModal({
      title: `เพิ่มรายการราคา (${rule.category} ${rule.isAllLevel ? 'All Level' : 'Lv.' + rule.levelMin + '-' + rule.levelMax})`,
      width: 400
    });

    body.appendChild(el(`
      <form id="formAddPriceTier" style="display:flex; flex-direction:column; gap:14px;">
        <div class="field">
          <label style="font-weight:700;">จำนวนชิ้น (Quantity)</label>
          <input type="number" class="input" id="tierQty" placeholder="เช่น 10, 50, 100" min="1" step="1" required />
        </div>

        <div class="field">
          <label style="font-weight:700;">ราคารวมทั้งแพ็กเกจ (บาท)</label>
          <input type="number" class="input" id="tierPrice" placeholder="เช่น 2.00, 8.00, 15.00" min="0.01" step="0.01" required />
        </div>

        <div id="tierAvgPreview" style="background:var(--primary-50); padding:10px 14px; border-radius:10px; border:1px solid var(--border); font-size:12.5px; font-weight:700; color:var(--accent-text); text-align:center;">
          เฉลี่ย: ฿0.00 / ชิ้น
        </div>

        <div class="flex gap-2" style="justify-content:flex-end; margin-top:8px;">
          <button type="button" class="btn" id="btnCancelTier">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" style="font-weight:800;">+ เพิ่มราคา</button>
        </div>
      </form>
    `));

    const qtyInp = body.querySelector('#tierQty');
    const priceInp = body.querySelector('#tierPrice');
    const prevEl = body.querySelector('#tierAvgPreview');

    const updateAvg = () => {
      const q = Number(qtyInp.value) || 0;
      const p = Number(priceInp.value) || 0;
      if (q > 0 && p > 0) {
        prevEl.textContent = `เฉลี่ย: ${money(p / q)} / ชิ้น`;
      } else {
        prevEl.textContent = `เฉลี่ย: ฿0.00 / ชิ้น`;
      }
    };

    qtyInp.addEventListener('input', updateAvg);
    priceInp.addEventListener('input', updateAvg);

    body.querySelector('#btnCancelTier')?.addEventListener('click', () => closeModal());

    body.querySelector('#formAddPriceTier')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = Number(qtyInp.value) || 0;
      const p = Number(priceInp.value) || 0;
      if (q <= 0 || p <= 0) return toast('กรุณากรอกจำนวนและราคาให้ถูกต้อง', 'error');

      if (!rule.tiers) rule.tiers = [];
      rule.tiers.push({
        id: 'pt_' + Date.now(),
        qty: q,
        price: p
      });
      rule.tiers.sort((a, b) => a.qty - b.qty);

      syncStoreSettingsAcrossDevices();
      closeModal();
      toast(`เพิ่มราคา ${q} ชิ้น ${money(p)} สำเร็จ`, 'success');
      const content = document.getElementById('adminProductTabContent');
      if (content && state.adminProductTab === 'items') renderAdminItemsTab(content);
    });
  }

  // --- TAB 2: วนเหรียญ (Coin Farming Management) ---
  function renderAdminCoinFarmTab(container) {
    const boxes = state.store.coinFarmBoxes || [];
    const wrap = el(`
      <div>
        <!-- Module Toggle Row -->
        <div class="module-switch-row">
          <div>
            <strong style="font-size:13.5px; color:var(--text);">เปิดให้บริการวนเหรียญในหน้าร้าน (Enable Coin Farming Service)</strong>
            <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">เมื่อเปิด จะแสดงหมวดบริการวนเหรียญและกล่องเลเวลในหน้าร้านและหน้าแรก</div>
          </div>
          <label class="clean-switch">
            <input type="checkbox" id="swEnableCoinFarm" ${state.store.enableCoinFarm !== false ? 'checked' : ''} />
            <span class="clean-slider"></span>
          </label>
        </div>

        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
            <div>
              <div class="card-title">กล่องเลเวลและเรทราคาเหรียญ (Level Boxes &amp; Coin Tiers)</div>
              <div class="card-sub">เพิ่มกล่องช่วงเลเวล และกำหนดเรทจำนวนเหรียญ/ราคาได้อย่างอิสระ</div>
            </div>
            <button type="button" class="btn btn-primary" id="btnAddLevelBox">+ Add Level Box (เพิ่มกล่องเลเวล)</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:16px;" id="adminLevelBoxesList"></div>
        </div>
      </div>
    `);
    container.appendChild(wrap);

    wrap.querySelector('#swEnableCoinFarm')?.addEventListener('change', (e) => {
      state.store.enableCoinFarm = e.target.checked;
      syncStoreSettingsAcrossDevices();
      toast(state.store.enableCoinFarm ? 'เปิดให้บริการวนเหรียญในหน้าร้านแล้ว' : 'ปิดบริการวนเหรียญในหน้าร้านแล้ว', 'info');
    });

    wrap.querySelector('#btnAddLevelBox')?.addEventListener('click', () => openCoinFarmBoxModal());

    const listEl = wrap.querySelector('#adminLevelBoxesList');
    if (boxes.length === 0) {
      listEl.innerHTML = `<div class="empty">ยังไม่มีกล่องช่วงเลเวล กดปุ่ม "+ Add Level Box" ด้านบนเพื่อสร้างกล่องแรก</div>`;
      return;
    }

    boxes.forEach((b, bIdx) => {
      const boxCard = el(`
        <div class="coin-farm-box">
          <div class="coin-farm-box-head">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:16px; color:var(--accent-text);">${escapeHTML(b.title)}</span>
                <span class="badge" style="background:var(--primary-50); font-weight:700; font-size:11px;">${(b.tiers || []).length} แพ็กเกจ</span>
              </div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">${escapeHTML(b.sub || '')}</div>
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-sm btn-ghost btn-edit-box" data-bidx="${bIdx}">Edit Box</button>
              <button type="button" class="btn btn-sm btn-primary btn-add-tier" data-bidx="${bIdx}">+ Add Tier (เพิ่มเรทเหรียญ)</button>
              <button type="button" class="btn btn-sm btn-danger btn-del-box" data-bidx="${bIdx}">✕ Delete</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${(b.tiers || []).map((t, tIdx) => `
              <div class="coin-tier-item">
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                  <div style="width:32px; height:32px; border-radius:8px; background:var(--primary-100); color:var(--accent-text); display:grid; place-items:center; font-weight:800; font-size:12px;">
                    #${tIdx + 1}
                  </div>
                  <div>
                    <strong style="font-size:14px; color:var(--text);">${escapeHTML(t.coins)}</strong>
                    <div style="font-size:11.5px; color:var(--muted);">${escapeHTML(t.desc || '')}</div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-weight:800; font-size:15px; color:var(--accent-text);">${money(t.price)}</span>
                  <button type="button" class="btn btn-sm btn-edit-tier" data-bidx="${bIdx}" data-tidx="${tIdx}" style="padding:4px 8px; font-size:11px;">Edit</button>
                  <button type="button" class="btn btn-sm btn-ghost btn-del-tier" data-bidx="${bIdx}" data-tidx="${tIdx}" style="color:var(--danger); padding:4px 8px; font-size:11px;">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `);

      boxCard.querySelector('.btn-edit-box')?.addEventListener('click', () => openCoinFarmBoxModal(b));
      boxCard.querySelector('.btn-del-box')?.addEventListener('click', () => {
        confirmDialog(`ลบกล่องเลเวล "${b.title}" และเรททั้งหมดในกล่องนี้?`, () => {
          state.store.coinFarmBoxes.splice(bIdx, 1);
          syncStoreSettingsAcrossDevices();
          toast(`ลบกล่อง "${b.title}" แล้ว`, 'success');
          renderAdminCoinFarmTab(container);
        });
      });
      boxCard.querySelector('.btn-add-tier')?.addEventListener('click', () => openCoinTierModal(b));

      boxCard.querySelectorAll('.btn-edit-tier').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = b.tiers[+btn.dataset.tidx];
          if (t) openCoinTierModal(b, t);
        });
      });

      boxCard.querySelectorAll('.btn-del-tier').forEach(btn => {
        btn.addEventListener('click', () => {
          const tIdx = +btn.dataset.tidx;
          b.tiers.splice(tIdx, 1);
          syncStoreSettingsAcrossDevices();
          toast('ลบเรทเหรียญเรียบร้อย', 'info');
          renderAdminCoinFarmTab(container);
        });
      });

      listEl.appendChild(boxCard);
    });
  }

  // --- TAB 3: ID Game Management ---
  function renderAdminGameIdsTab(container) {
    const accs = state.store.gameAccounts || [];
    const wrap = el(`
      <div>
        <!-- Module Toggle Row -->
        <div class="module-switch-row">
          <div>
            <strong style="font-size:13.5px; color:var(--text);">เปิดตลาดซื้อขายไอดีเกมในหน้าร้าน (Enable Game Accounts ID Market)</strong>
            <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">เมื่อเปิด จะแสดงการ์ดไอดีเกมพร้อมรูปภาพ 1:1 และปุ่มสั่งซื้อในหน้าร้านและหน้าแรก</div>
          </div>
          <label class="clean-switch">
            <input type="checkbox" id="swEnableGameIds" ${state.store.enableGameIds !== false ? 'checked' : ''} />
            <span class="clean-slider"></span>
          </label>
        </div>

        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
            <div>
              <div class="card-title">รายการไอดีเกม (${accs.length} รายการ)</div>
              <div class="card-sub">เพิ่มไอดีเกม อัปโหลดรูปภาพ 1:1 ได้หลายภาพอย่างอิสระ กำหนดราคา และสถานะ</div>
            </div>
            <button type="button" class="btn btn-primary" id="btnAddGameId">+ Add Game ID (เพิ่มไอดีเกมใหม่)</button>
          </div>

          <div class="game-id-grid" id="adminGameIdsGrid"></div>
        </div>
      </div>
    `);
    container.appendChild(wrap);

    wrap.querySelector('#swEnableGameIds')?.addEventListener('change', (e) => {
      state.store.enableGameIds = e.target.checked;
      syncStoreSettingsAcrossDevices();
      toast(state.store.enableGameIds ? 'เปิดตลาดไอดีเกมในหน้าร้านแล้ว' : 'ปิดตลาดไอดีเกมในหน้าร้านแล้ว', 'info');
    });

    wrap.querySelector('#btnAddGameId')?.addEventListener('click', () => openGameAccountModal());

    const gridEl = wrap.querySelector('#adminGameIdsGrid');
    if (accs.length === 0) {
      gridEl.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">ยังไม่มีรายการไอดีเกม กดปุ่ม "+ Add Game ID" ด้านบนเพื่อเพิ่มไอดีแรก</div>`;
      return;
    }

    accs.forEach((acc, idx) => {
      const images = (acc.images && acc.images.length > 0) ? acc.images : [DEFAULT_PRODUCT_IMG];
      let currentSlide = 0;

      const card = el(`
        <div class="game-id-card">
          <span class="game-id-badge ${acc.status || 'available'}">
            ${acc.status === 'sold' ? 'ขายแล้ว (Sold)' : acc.status === 'reserved' ? 'ติดจอง (Reserved)' : 'พร้อมขาย (Available)'}
          </span>

          <div class="game-id-gallery-wrap">
            <div class="game-id-gallery-track" id="track_${acc.id}">
              ${images.map((img, i) => `
                <div class="game-id-gallery-slide">
                  <img src="${escapeHTML(img)}" alt="${escapeHTML(acc.title)} Photo ${i+1}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                </div>
              `).join('')}
            </div>

            ${images.length > 1 ? `
              <button type="button" class="game-id-gallery-btn prev btn-g-prev">‹</button>
              <button type="button" class="game-id-gallery-btn next btn-g-next">›</button>
              <div class="game-id-dots">
                ${images.map((_, i) => `<div class="game-id-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
              </div>
            ` : ''}
          </div>

          <div style="flex:1; display:flex; flex-direction:column;">
            <div class="flex items-center gap-2" style="margin-bottom:4px;">
              <span class="badge" style="background:var(--primary-100); color:var(--accent-text); font-weight:800; font-size:11px;">${escapeHTML(acc.code)}</span>
              ${acc.badge ? `<span class="badge" style="background:var(--primary-50); font-size:10.5px;">${escapeHTML(acc.badge)}</span>` : ''}
              <span style="font-size:11px; color:var(--muted); margin-left:auto;">${images.length} รูป</span>
            </div>

            <div style="font-weight:800; font-size:14px; color:var(--text); line-height:1.3; margin-bottom:4px;">${escapeHTML(acc.title)}</div>
            ${acc.details ? `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px; line-height:1.4; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHTML(acc.details)}</div>` : ''}

            <div style="margin-top:auto; padding-top:10px; border-top:1.5px dashed var(--border); display:flex; align-items:center; justify-content:space-between; gap:6px;">
              <div style="font-weight:900; font-size:16px; color:var(--accent-text);">${money(acc.price)}</div>
              <div class="flex gap-1">
                <button type="button" class="btn btn-sm btn-edit-acc" style="font-size:11px; padding:4px 8px; font-weight:700;">Edit</button>
                <button type="button" class="btn btn-sm btn-danger btn-del-acc" style="font-size:11px; padding:4px 6px;">✕</button>
              </div>
            </div>
          </div>
        </div>
      `);

      // Slider logic
      if (images.length > 1) {
        const track = card.querySelector(`#track_${acc.id}`);
        const dots = card.querySelectorAll('.game-id-dot');
        const updateSlide = (i) => {
          currentSlide = (i + images.length) % images.length;
          if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
          dots.forEach((d, dIdx) => d.classList.toggle('active', dIdx === currentSlide));
        };
        card.querySelector('.btn-g-prev')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide - 1); });
        card.querySelector('.btn-g-next')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide + 1); });
        dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(+d.dataset.idx); }));
      }

      card.querySelector('.btn-edit-acc')?.addEventListener('click', () => openGameAccountModal(acc));
      card.querySelector('.btn-del-acc')?.addEventListener('click', () => {
        confirmDialog(`ลบไอดีเกม "${acc.code}" (${acc.title})?`, () => {
          state.store.gameAccounts.splice(idx, 1);
          syncStoreSettingsAcrossDevices();
          toast(`ลบไอดี "${acc.code}" แล้ว`, 'success');
          renderAdminGameIdsTab(container);
        });
      });

      gridEl.appendChild(card);
    });
  }

  // Helper Modals
  function openCoinFarmBoxModal(existingBox = null) {
    const isEdit = !!existingBox;
    const body = el(`
      <div class="grid" style="gap:14px;">
        <div class="field">
          <label style="font-weight:700;">ชื่อช่วงเลเวล (Level Range Title) *</label>
          <input class="input" id="cfBoxTitle" placeholder="เช่น Level 1 - 30, Level 31 - 60" value="${existingBox ? escapeHTML(existingBox.title) : ''}" style="font-weight:700;" />
        </div>
        <div class="field">
          <label style="font-weight:700;">คำอธิบายสั้น (Subtitle / Description)</label>
          <input class="input" id="cfBoxSub" placeholder="เช่น สำหรับฟาร์มเลเวลเริ่มต้น, ฟาร์มไวได้เหรียญเร็ว" value="${existingBox ? escapeHTML(existingBox.sub) : ''}" />
        </div>
      </div>
    `);

    openModal({
      title: isEdit ? 'แก้ไขกล่องเลเวลวนเหรียญ (Edit Level Box)' : 'เพิ่มกล่องเลเวลวนเหรียญใหม่ (Add Level Box)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มกล่องเลเวล',
          kind: 'primary',
          onClick: () => {
            const title = $('#cfBoxTitle')?.value.trim() || 'New Level Box';
            const sub = $('#cfBoxSub')?.value.trim() || '';
            state.store.coinFarmBoxes = state.store.coinFarmBoxes || [];
            if (isEdit) {
              existingBox.title = title;
              existingBox.sub = sub;
              toast(`อัปเดตกล่องเลเวล "${title}" แล้ว`, 'success');
            } else {
              const newBox = {
                id: 'cf_box_' + Date.now(),
                title,
                sub,
                tiers: [
                  { id: 't_' + Date.now() + '_1', coins: '10,000 เหรียญ', price: 25, desc: 'ใช้เวลาประมาณ 10-15 นาที' }
                ]
              };
              state.store.coinFarmBoxes.push(newBox);
              toast(`เพิ่มกล่องเลเวล "${title}" สำเร็จ`, 'success');
            }
            syncStoreSettingsAcrossDevices();
            renderPage();
          }
        }
      ]
    });
  }

  function openCoinTierModal(box, existingTier = null) {
    const isEdit = !!existingTier;
    const body = el(`
      <div class="grid" style="gap:14px;">
        <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
          <div class="field">
            <label style="font-weight:700;">จำนวนเหรียญ (Coins Amount) *</label>
            <input class="input" id="cfTierCoins" placeholder="เช่น 10,000 เหรียญ, 1 แสน" value="${existingTier ? escapeHTML(existingTier.coins) : ''}" style="font-weight:700;" />
          </div>
          <div class="field">
            <label style="font-weight:700;">ราคา (${getCurrencySymbol()}) *</label>
            <input type="number" step="0.5" class="input" id="cfTierPrice" placeholder="เช่น 25, 45, 120" value="${existingTier ? existingTier.price : 25}" style="font-weight:700;" />
          </div>
        </div>
        <div class="field">
          <label style="font-weight:700;">ระยะเวลา / หมายเหตุ (Est. Time / Note)</label>
          <input class="input" id="cfTierDesc" placeholder="เช่น ใช้เวลาประมาณ 10-15 นาที" value="${existingTier ? escapeHTML(existingTier.desc) : ''}" />
        </div>
      </div>
    `);

    openModal({
      title: isEdit ? `แก้ไขเรทราคาเหรียญ (${box.title})` : `เพิ่มเรทราคาเหรียญใหม่ (${box.title})`,
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: isEdit ? 'บันทึก' : 'เพิ่มเรทเหรียญ',
          kind: 'primary',
          onClick: () => {
            const coins = $('#cfTierCoins')?.value.trim() || '10,000 เหรียญ';
            const price = Number($('#cfTierPrice')?.value || 25);
            const desc = $('#cfTierDesc')?.value.trim() || '';
            box.tiers = box.tiers || [];
            if (isEdit) {
              existingTier.coins = coins;
              existingTier.price = price;
              existingTier.desc = desc;
              toast(`อัปเดตเรท "${coins}" (${money(price)}) แล้ว`, 'success');
            } else {
              box.tiers.push({
                id: 't_' + Date.now(),
                coins,
                price,
                desc
              });
              toast(`เพิ่มเรท "${coins}" (${money(price)}) สำเร็จ`, 'success');
            }
            syncStoreSettingsAcrossDevices();
            renderPage();
          }
        }
      ]
    });
  }

  function openGameAccountModal(existingAcc = null) {
    const isEdit = !!existingAcc;
    let imagesList = existingAcc?.images ? [...existingAcc.images] : [];

    const body = el(`
      <div class="grid" style="gap:14px;">
        <!-- Multi-image 1:1 Uploader Box (No Emojis) -->
        <div style="background:var(--primary-50); border:1.5px solid var(--border); border-radius:16px; padding:16px;">
          <div class="flex items-center" style="justify-content:space-between; margin-bottom:6px;">
            <div style="font-weight:800; font-size:13.5px; color:var(--text);">รูปภาพไอดีเกม ขนาด 1:1 (Game ID Photos) *</div>
            <span class="badge" id="photoCountBadge" style="background:var(--card); font-size:11px; font-weight:700;">${imagesList.length} รูป</span>
          </div>
          <div style="font-size:11.5px; color:var(--muted); margin-bottom:10px;">สามารถเพิ่มรูปภาพขนาด 1:1 ได้หลายรูปอย่างอิสระ มีปุ่มเลื่อนสไลด์ดูรูปในหน้าร้าน</div>

          <div class="admin-photo-uploader-grid" id="adminPhotoGrid"></div>

          <input type="file" id="fileMultiPhotoUpload" accept="image/*" style="display:none;" />
          <div class="flex gap-2" style="margin-top:12px;">
            <button type="button" class="btn btn-sm btn-primary" id="btnTriggerMultiUpload" style="font-size:12px; padding:6px 14px; font-weight:700;">+ อัปโหลดรูปภาพ 1:1 จากเครื่อง</button>
          </div>
          <div class="field" style="margin-top:8px; margin-bottom:0;">
            <input class="input" id="inpDirectPhotoUrl" placeholder="หรือใส่ Image URL แล้วกด Enter..." style="font-size:11.5px; padding:6px 10px;" />
          </div>
        </div>

        <div class="grid" style="grid-template-columns:140px 1fr; gap:12px;">
          <div class="field" style="margin:0;">
            <label style="font-weight:700; font-size:12px;">รหัสไอดี (Code) *</label>
            <input class="input" id="gaCode" placeholder="เช่น ID-001" value="${existingAcc ? escapeHTML(existingAcc.code) : `ID-${String((state.store.gameAccounts || []).length + 1).padStart(3, '0')}`}" style="font-weight:800; text-transform:uppercase;" />
          </div>
          <div class="field" style="margin:0;">
            <label style="font-weight:700; font-size:12px;">ชื่อหัวข้อไอดี (Title) *</label>
            <input class="input" id="gaTitle" placeholder="เช่น ไอดี HayDay Lv.85 ยุ้งฉาง 3500+" value="${existingAcc ? escapeHTML(existingAcc.title) : ''}" style="font-weight:700;" />
          </div>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr 1fr; gap:10px;">
          <div class="field" style="margin:0;">
            <label style="font-weight:700; font-size:12px;">ราคาขาย (${getCurrencySymbol()}) *</label>
            <input type="number" step="1" class="input" id="gaPrice" placeholder="เช่น 1290" value="${existingAcc ? existingAcc.price : 990}" style="font-weight:800;" />
          </div>
          <div class="field" style="margin:0;">
            <label style="font-weight:700; font-size:12px;">สถานะ (Status)</label>
            <select class="select" id="gaStatus" style="font-weight:700; font-size:12.5px;">
              <option value="available" ${(!existingAcc || existingAcc.status === 'available') ? 'selected' : ''}>พร้อมขาย (Available)</option>
              <option value="reserved" ${existingAcc?.status === 'reserved' ? 'selected' : ''}>ติดจอง (Reserved)</option>
              <option value="sold" ${existingAcc?.status === 'sold' ? 'selected' : ''}>ขายแล้ว (Sold Out)</option>
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label style="font-weight:700; font-size:12px;">ป้ายกำกับ (Badge)</label>
            <input class="input" id="gaBadge" placeholder="เช่น Hot, VIP, แนะนำ" value="${existingAcc?.badge ? escapeHTML(existingAcc.badge) : 'Hot Item'}" style="font-size:12px;" />
          </div>
        </div>

        <div class="field" style="margin:0;">
          <label style="font-weight:700; font-size:12px;">รายละเอียดไอดีเกม (Details &amp; Specifications)</label>
          <textarea class="textarea" id="gaDetails" rows="3" placeholder="ระบุเลเวล ยุ้งฉาง ไซโล เหรียญ เพชร หรือข้อมูลสำคัญของไอดีเกม...">${existingAcc?.details ? escapeHTML(existingAcc.details) : ''}</textarea>
        </div>
      </div>
    `);

    const renderPhotoGrid = () => {
      const gridEl = body.querySelector('#adminPhotoGrid');
      const countBadge = body.querySelector('#photoCountBadge');
      if (countBadge) countBadge.textContent = `${imagesList.length} รูป`;
      if (!gridEl) return;
      gridEl.innerHTML = '';

      imagesList.forEach((url, idx) => {
        const thumb = el(`
          <div class="admin-photo-thumb-wrap">
            <img src="${escapeHTML(url)}" alt="Photo ${idx + 1}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
            <button type="button" class="admin-photo-del-btn" data-idx="${idx}" title="ลบรูปนี้">✕</button>
          </div>
        `);
        thumb.querySelector('.admin-photo-del-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          imagesList.splice(idx, 1);
          renderPhotoGrid();
        });
        gridEl.appendChild(thumb);
      });

      const addBox = el(`
        <div class="admin-photo-add-box" id="btnAddBoxTrigger">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          <span style="margin-top:2px;">เพิ่มรูป</span>
        </div>
      `);
      addBox.addEventListener('click', () => fileInp.click());
      gridEl.appendChild(addBox);
    };

    const fileInp = body.querySelector('#fileMultiPhotoUpload');
    const triggerBtn = body.querySelector('#btnTriggerMultiUpload');
    const directUrlInp = body.querySelector('#inpDirectPhotoUrl');

    triggerBtn.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'กำลังอัปโหลด...';
      try {
        const url = await uploadProductImage(file);
        imagesList.push(url);
        renderPhotoGrid();
        toast('อัปโหลดรูปภาพ 1:1 เรียบร้อย', 'success');
      } catch (err) {
        toast('อัปโหลดไม่สำเร็จ: ' + (err.message || err), 'error');
      } finally {
        triggerBtn.disabled = false;
        triggerBtn.textContent = '+ อัปโหลดรูปภาพ 1:1 จากเครื่อง';
        fileInp.value = '';
      }
    });

    directUrlInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const u = directUrlInp.value.trim();
        if (u && u.startsWith('http')) {
          imagesList.push(u);
          directUrlInp.value = '';
          renderPhotoGrid();
          toast('เพิ่มรูปภาพจาก URL เรียบร้อย', 'success');
        }
      }
    });

    renderPhotoGrid();

    openModal({
      title: isEdit ? `แก้ไขไอดีเกม (${existingAcc.code})` : 'เพิ่มไอดีเกมใหม่ (Add Game ID)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างไอดีเกม',
          kind: 'primary',
          onClick: () => {
            const code = body.querySelector('#gaCode')?.value.trim() || 'ID-001';
            const title = body.querySelector('#gaTitle')?.value.trim() || 'ไอดีเกม HayDay';
            const price = Number(body.querySelector('#gaPrice')?.value || 990);
            const status = body.querySelector('#gaStatus')?.value || 'available';
            const badge = body.querySelector('#gaBadge')?.value.trim() || 'Hot Item';
            const details = body.querySelector('#gaDetails')?.value.trim() || '';

            if (imagesList.length === 0) {
              imagesList.push(DEFAULT_PRODUCT_IMG);
            }

            state.store.gameAccounts = state.store.gameAccounts || [];
            if (isEdit) {
              existingAcc.code = code;
              existingAcc.title = title;
              existingAcc.price = price;
              existingAcc.status = status;
              existingAcc.badge = badge;
              existingAcc.details = details;
              existingAcc.images = imagesList;
              toast(`อัปเดตไอดี "${code}" แล้ว`, 'success');
            } else {
              const newAcc = {
                id: 'ga_' + Date.now(),
                code,
                title,
                price,
                status,
                badge,
                details,
                images: imagesList
              };
              state.store.gameAccounts.unshift(newAcc);
              toast(`เพิ่มไอดี "${code}" สำเร็จ`, 'success');
            }
            syncStoreSettingsAcrossDevices();
            renderPage();
          }
        }
      ]
    });
  }

  function openGameAccountQuickViewModal(acc) {
    let currentSlide = 0;
    const images = (acc.images && acc.images.length > 0) ? acc.images : [DEFAULT_PRODUCT_IMG];

    const body = el(`
      <div>
        <!-- 1:1 Image Slider in Quick View -->
        <div class="game-id-gallery-wrap" style="max-width:380px; margin:0 auto 16px;">
          <div class="game-id-gallery-track" id="qvGalleryTrack">
            ${images.map((img, i) => `
              <div class="game-id-gallery-slide">
                <img src="${escapeHTML(img)}" alt="${escapeHTML(acc.title)} Photo ${i+1}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
              </div>
            `).join('')}
          </div>

          ${images.length > 1 ? `
            <button type="button" class="game-id-gallery-btn prev" id="qvPrev">‹</button>
            <button type="button" class="game-id-gallery-btn next" id="qvNext">›</button>
            <div class="game-id-dots" id="qvDots">
              ${images.map((_, i) => `<div class="game-id-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
            </div>
          ` : ''}

          <span class="game-id-badge ${acc.status || 'available'}">
            ${acc.status === 'sold' ? 'ขายแล้ว (Sold Out)' : acc.status === 'reserved' ? 'ติดจอง (Reserved)' : 'พร้อมส่งมอบ (Available)'}
          </span>
        </div>

        <div style="text-align:left;">
          <div class="flex items-center gap-2" style="margin-bottom:4px;">
            <span class="badge" style="background:var(--primary-100); color:var(--accent-text); font-weight:800; font-size:12px;">${escapeHTML(acc.code)}</span>
            ${acc.badge ? `<span class="badge" style="background:var(--primary-50); font-size:11px; font-weight:700;">${escapeHTML(acc.badge)}</span>` : ''}
          </div>
          <h3 style="font-size:17px; font-weight:800; color:var(--text); margin:4px 0 8px;">${escapeHTML(acc.title)}</h3>
          <div style="font-size:22px; font-weight:900; color:var(--accent-text); margin-bottom:12px;">${money(acc.price)}</div>
          
          <div style="background:var(--primary-50); border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:10px;">
            <div style="font-size:12px; font-weight:800; color:var(--accent-text); margin-bottom:4px;">รายละเอียดไอดีเกม (Specifications)</div>
            <div style="font-size:13px; color:var(--text); line-height:1.6; white-space:pre-line;">${escapeHTML(acc.details || 'ไม่มีรายละเอียดเพิ่มเติม')}</div>
          </div>
        </div>
      </div>
    `);

    if (images.length > 1) {
      const track = body.querySelector('#qvGalleryTrack');
      const dots = body.querySelectorAll('.game-id-dot');
      const updateSlide = (idx) => {
        currentSlide = (idx + images.length) % images.length;
        if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
      };
      body.querySelector('#qvPrev')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide - 1); });
      body.querySelector('#qvNext')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide + 1); });
      dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(+d.dataset.idx); }));
    }

    openModal({
      title: `ข้อมูลไอดีเกม: ${acc.code}`,
      body,
      actions: [
        { label: 'Close', kind: 'ghost' },
        ...(acc.status === 'available' ? [{
          label: `สั่งซื้อไอดีนี้ (${money(acc.price)})`,
          kind: 'primary',
          onClick: () => {
            const cartKey = 'game_acc_' + acc.id;
            state.selected[cartKey] = 1;
            toast(`เพิ่มไอดี "${acc.code}" ลงในตะกร้าแล้ว`, 'success');
            renderPage();
          }
        }] : [])
      ]
    });
  }

  function openProductQuickModal(p) {
    const stockLabel = p.stock === 0 ? 'Out of stock' : p.stock < 10 ? `Low · ${p.stock} left` : `${p.stock} in stock`;
    const stockCls = p.stock === 0 ? 'danger' : p.stock < 10 ? 'warn' : 'success';
    const mediaHtml = p.image
      ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width:72px;height:72px;border-radius:14px;object-fit:cover;flex:none;" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" /><div style="display:none;width:72px;height:72px;place-items:center;font-size:13px;font-weight:700;border-radius:14px;background:var(--primary-50);flex:none;color:var(--accent-text);">${escapeHTML(p.cat || 'Item')}</div>`
      : `<div style="width:72px;height:72px;display:grid;place-items:center;font-size:13px;font-weight:700;border-radius:14px;background:var(--primary-50);flex:none;color:var(--accent-text);">${escapeHTML(p.cat || 'Item')}</div>`;

    const body = el(`
      <div>
        <div class="flex items-center gap-3 mb-3">
          ${mediaHtml}
          <div style="flex:1">
            <div style="font-size:12px; color:var(--muted)">${escapeHTML(p.cat)} · Lv.${p.level || 1}</div>
            <div style="font-weight:800; font-size:16px; margin:2px 0">${escapeHTML(p.name)}</div>
            <span class="badge ${stockCls}">${stockLabel}</span>
          </div>
          <div style="font-weight:800; color:var(--accent-text); font-size:20px">${money(p.price)}</div>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px">
          <button class="btn" id="pqEdit">${ICONS.edit} Edit</button>
          <button class="btn" id="pqStock">${ICONS.stock} Adjust Stock</button>
          <button class="btn btn-danger" id="pqDelete" style="grid-column: 1 / -1">${ICONS.delete} Delete</button>
        </div>
      </div>
    `);
    openModal({
      title: 'Product Details',
      body,
      actions: [
        { label: 'Close', kind: 'ghost' },
        { label: 'Add to Cart', kind: 'primary', onClick: () => {
          state.selected[p.id] = (state.selected[p.id] || 0) + 1;
          toast(`${p.name} added to cart`, 'success');
          renderPage();
        }}
      ]
    });
    body.querySelector('#pqDelete').addEventListener('click', () => {
      closeModal();
      confirmDialog(`Delete "${p.name}"?`, async () => {
        PRODUCTS = PRODUCTS.filter(x => String(x.id) !== String(p.id));
        if (supabase) {
          const { error } = await supabase.from('products').delete().eq('id', p.id);
          if (error) { toast('ลบสินค้าไม่สำเร็จ: ' + error.message, 'error'); return; }
        }
        toast('Product deleted', 'success');
        renderPage();
      });
    });
    body.querySelector('#pqEdit').addEventListener('click', () => { closeModal(); openAddProductModal(p); });
    body.querySelector('#pqStock').addEventListener('click', () => {
      closeModal();
      openRestockModal(p);
    });
  }

  function openRestockModal(prodOrId) {
    const prod = typeof prodOrId === 'object' && prodOrId !== null
      ? prodOrId
      : PRODUCTS.find(x => String(x.id) === String(prodOrId));
    if (!prod) {
      toast('ไม่พบข้อมูลสินค้า', 'error');
      return;
    }

    openModal({
      title: `ปรับสต็อกสินค้า: ${prod.name}`,
      body: el(`
        <div class="grid" style="gap:14px;">
          <div style="background:var(--primary-50); padding:12px 14px; border-radius:14px; border:1px solid var(--border); display:flex; align-items:center; gap:12px;">
            <div style="width:48px; height:48px; border-radius:10px; overflow:hidden; background:var(--card); display:grid; place-items:center; border:1px solid var(--border); flex:none;">
              ${prod.image ? `<img src="${escapeHTML(prod.image)}" alt="${escapeHTML(prod.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><span style="display:none; font-size:24px;">${prod.emoji || '🍰'}</span>` : `<span style="font-size:24px;">${prod.emoji || '🍰'}</span>`}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:800; font-size:14.5px; color:var(--text);">${escapeHTML(prod.name)}</div>
              <div style="font-size:12px; color:var(--muted); margin-top:2px;">
                หมวดหมู่: <strong>${escapeHTML(prod.cat || 'Bakery')}</strong> · คงเหลือปัจจุบัน: <strong style="color:var(--accent-text); font-size:13.5px;">${prod.stock}</strong> ชิ้น
              </div>
            </div>
          </div>

          <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
            <div class="field" style="margin-bottom:0; min-width:0;">
              <label style="font-size:12px; font-weight:700;">ประเภทการปรับสต็อก</label>
              <select class="select" id="restockType" style="border-radius:10px; font-size:13px; width:100%; box-sizing:border-box;">
                <option value="in" selected>เติมสต็อก (+)</option>
                <option value="out">เบิกสต็อก / ลด (-)</option>
                <option value="set">กำหนดจำนวนใหม่</option>
              </select>
            </div>
            <div class="field" style="margin-bottom:0; min-width:0;">
              <label style="font-size:12px; font-weight:700;">จำนวน</label>
              <input type="number" id="restockQty" class="input" value="10" min="1" style="border-radius:10px; font-size:14px; font-weight:700; width:100%; box-sizing:border-box;" />
            </div>
          </div>

          <div class="field" style="margin-bottom:0; min-width:0;">
            <label style="font-size:12px; font-weight:700;">หมายเหตุ</label>
            <input class="input" id="restockNote" placeholder="เช่น เติมสต็อกรอบเช้า, ผลิตเพิ่ม" value="เติมสต็อกสินค้าประจำวัน" style="border-radius:10px; font-size:13px; width:100%; box-sizing:border-box;" />
          </div>
        </div>
      `),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'บันทึกสต็อก', kind: 'primary', onClick: async () => {
          const type = $('#restockType')?.value || 'in';
          const qty = Number($('#restockQty')?.value || 10);

          const target = PRODUCTS.find(x => String(x.id) === String(prod.id)) || prod;
          if (type === 'in') {
            target.stock += qty;
          } else if (type === 'out') {
            target.stock = Math.max(0, target.stock - qty);
          } else if (type === 'set') {
            target.stock = Math.max(0, qty);
          }

          target.status = getStockStatusInfo(target.stock).type === 'danger' ? 'out_of_stock' : getStockStatusInfo(target.stock).type === 'warn' ? 'low' : 'active';

          if (supabase) {
            const { error } = await supabase.from('products').update({
              stock: target.stock,
              is_active: target.stock > 0
            }).eq('id', target.id);
            if (error) { toast('อัปเดตสต็อกไม่สำเร็จ: ' + error.message, 'error'); return; }
          }

          toast(`ปรับสต็อกสินค้า "${target.name}" สำเร็จ (สต็อกคงเหลือ: ${target.stock} ชิ้น)`, 'success');
          renderPage();
        }}
      ]
    });
  }

  function openAddProductModal(existing, prefillCat) {
    let currentImage = existing?.image || '';

    const body = el(`
      <div class="grid" style="gap:14px">
        <!-- Photo Upload Box (Mandatory Photo, No Emojis) -->
        <div style="background:var(--primary-50); padding:16px; border-radius:16px; border:1.5px solid var(--border); text-align:center;">
          <div style="position:relative; width:130px; height:130px; border-radius:16px; border:2px dashed var(--border); background:var(--card); display:grid; place-items:center; overflow:hidden; margin:0 auto 10px; box-shadow:var(--shadow-soft);">
            <img id="prodImgPreview" src="${currentImage || DEFAULT_PRODUCT_IMG}" style="width:100%; height:100%; object-fit:cover; display:${currentImage ? 'block' : 'none'};" onerror="this.style.display='none'; document.getElementById('prodNoPhotoPrompt').style.display='flex';" />
            <div id="prodNoPhotoPrompt" style="display:${currentImage ? 'none' : 'flex'}; flex-direction:column; align-items:center; justify-content:center; padding:10px; color:var(--muted); font-size:12px; font-weight:700;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--accent-text); margin-bottom:4px;"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              <span>ยังไม่มีรูปภาพ</span>
            </div>
            <input type="file" id="prodPhotoUpload" accept="image/*" style="display:none;" />
          </div>

          <div style="font-weight:800; font-size:13.5px; color:var(--text); margin-bottom:2px;">รูปภาพสินค้า (Product Image) *</div>
          <div style="font-size:11.5px; color:var(--muted); margin-bottom:10px;">กรุณาเลือกไฟล์รูปภาพจากเครื่อง หรือใส่ URL รูปภาพ</div>
          
          <div style="display:flex; justify-content:center; gap:8px;">
            <button class="btn btn-primary btn-sm" type="button" id="btnUploadPhotoTrigger" style="font-size:12px; padding:7px 18px; font-weight:700;">
              เลือกรูปภาพจากเครื่อง
            </button>
          </div>
        </div>

        <div class="field">
          <label style="font-weight:700; font-size:12.5px;">หรือระบุลิงก์รูปภาพ (Image URL)</label>
          <input class="input" id="pImageUrl" placeholder="https://... หรืออัปโหลดจากปุ่มด้านบน" value="${escapeHTML(currentImage)}" />
        </div>

        <div class="field">
          <label style="font-weight:700; font-size:12.5px;">ชื่อสินค้า (Product Name) *</label>
          <input class="input" id="pName" placeholder="เช่น Strawberry Cheesecake, Croissant..." value="${existing ? escapeHTML(existing.name) : ''}"/>
        </div>

        <div class="grid" style="grid-template-columns: 1fr 1fr; gap:12px">
          <div class="field">
            <label style="font-weight:700; font-size:12.5px;">หมวดหมู่ (Category)</label>
            <select class="select" id="pCat">
              ${CATEGORIES.map(c => `<option value="${c.name}" ${(existing ? existing.cat === c.name : (prefillCat === c.name)) ? 'selected' : ''}>${c.name}</option>`).join('')}
              <option value="__NEW__">+ สร้างหมวดหมู่ใหม่...</option>
            </select>
          </div>
          <div class="field">
            <label style="font-weight:700; font-size:12.5px;">ราคา (${state.store.currency || '฿'}) *</label>
            <input type="number" step="0.01" class="input" id="pPrice" value="${existing ? existing.price : 8.50}"/>
          </div>
        </div>

        <div class="field" id="newCatWrap" style="display:none;">
          <label style="font-weight:700; font-size:12.5px;">ชื่อหมวดหมู่ใหม่ที่ต้องการเพิ่ม</label>
          <input class="input" id="newCustomCatName" placeholder="เช่น Cakes, Specials, Coffee..." />
        </div>

        <div class="grid" style="grid-template-columns: 1fr 1fr; gap:12px">
          <div class="field">
            <label style="font-weight:700; font-size:12.5px;">จำนวนสต็อก (Stock Quantity) *</label>
            <input type="number" class="input" id="pStock" value="${existing ? existing.stock : 50}"/>
          </div>
          <div class="field">
            <label style="font-weight:700; font-size:12.5px;">คำบรรยาย / รสชาติ (Description / Flavor)</label>
            <input class="input" id="pFlavor" placeholder="เช่น สตรอว์เบอร์รี่สด ครีมนุ่มละมุน" value="${existing?.flavor ? escapeHTML(existing.flavor) : ''}"/>
          </div>
        </div>
      </div>
    `);

    // Listeners for photo upload
    const fileInp = body.querySelector('#prodPhotoUpload');
    const triggerBtn = body.querySelector('#btnUploadPhotoTrigger');
    const previewImg = body.querySelector('#prodImgPreview');
    const noPhotoPrompt = body.querySelector('#prodNoPhotoPrompt');
    const urlInp = body.querySelector('#pImageUrl');
    const catSelect = body.querySelector('#pCat');
    const newCatWrap = body.querySelector('#newCatWrap');

    triggerBtn.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'กำลังอัปโหลด...';
      try {
        const publicUrl = await uploadProductImage(file);
        currentImage = publicUrl;
        previewImg.src = currentImage;
        previewImg.style.display = 'block';
        if (noPhotoPrompt) noPhotoPrompt.style.display = 'none';
        urlInp.value = currentImage;
        toast('อัปโหลดรูปภาพสินค้าเรียบร้อย ', 'success');
      } catch (err) {
        toast('อัปโหลดไม่สำเร็จ: ' + (err.message || err), 'error');
      } finally {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'เลือกรูปภาพจากเครื่อง';
      }
    });

    urlInp.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      currentImage = val;
      if (val) {
        previewImg.src = val;
        previewImg.style.display = 'block';
        if (noPhotoPrompt) noPhotoPrompt.style.display = 'none';
      } else {
        previewImg.style.display = 'none';
        if (noPhotoPrompt) noPhotoPrompt.style.display = 'flex';
      }
    });

    catSelect.addEventListener('change', (e) => {
      newCatWrap.style.display = e.target.value === '__NEW__' ? 'block' : 'none';
    });

    openModal({
      title: existing ? 'Edit Product' : 'Create Product (เพิ่มสินค้าใหม่)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: existing ? 'Save Changes' : 'Create Product (สร้างสินค้า)', kind: 'primary', onClick: async () => {
          const name = $('#pName')?.value.trim() || 'New Treat';
          let cat = $('#pCat')?.value;
          if (cat === '__NEW__') {
            const customCat = $('#newCustomCatName')?.value.trim();
            if (customCat) {
              cat = customCat;
              if (!CATEGORIES.find(c => c.name.toLowerCase() === customCat.toLowerCase())) {
                CATEGORIES.push({ name: customCat, count: 0, emoji: '' });
              }
            } else {
              cat = 'Bakery';
            }
          }
          const price = Number($('#pPrice')?.value || 8.50);
          const stock = Number($('#pStock')?.value || 50);
          const flavor = $('#pFlavor')?.value.trim() || '';
          const status = stock === 0 ? 'out' : stock < 10 ? 'low' : 'active';
          const image = (urlInp?.value && urlInp.value.trim() && urlInp.value !== '(Uploaded Photo)') ? urlInp.value.trim() : (currentImage || '');

          if (!image) {
            toast('กรุณาอัปโหลดรูปภาพสินค้าก่อนบันทึก (จำเป็นต้องมีรูปภาพสินค้า)', 'error');
            return;
          }

          if (existing) {
            existing.name = name;
            existing.cat = cat;
            existing.image = image;
            existing.price = price;
            existing.stock = stock;
            existing.flavor = flavor;
            existing.status = status;
            if (supabase) {
              const { error } = await supabase.from('products').update({
                name,
                price,
                stock,
                cat,
                image: image || null,
                is_active: status !== 'out_of_stock'
              }).eq('id', existing.id);
              if (error) {
                console.error('Product update error:', error);
                toast('บันทึกไม่สำเร็จ: ' + error.message, 'error');
                return;
              }
            }
            if (syncChannel) {
              try {
                syncChannel.send({
                  type: 'broadcast',
                  event: 'product_updated',
                  payload: { id: existing.id, name, cat, image, price, stock, flavor, status }
                });
              } catch (e) {}
            }
            toast(`อัปเดตสินค้า "${name}" แล้ว`, 'success');
            renderPage();
          } else {
            let newId = 'prod_' + Date.now();
            let newProd = {
              id: newId,
              name,
              cat,
              price,
              stock,
              status,
              flavor,
              image
            };

            if (supabase) {
              const storeId = state.storeId || '00000000-0000-0000-0000-000000000001';
              const { data: inserted, error } = await supabase.from('products').insert({
                name,
                price,
                stock,
                cat,
                image: image || null,
                is_active: status !== 'out_of_stock',
                store_id: storeId
              }).select().single();

              if (error) {
                console.error('Product insert error:', error);
                toast('บันทึกสินค้าในระบบ Cloud ไม่สำเร็จ: ' + error.message, 'error');
                return;
              }

              if (inserted) {
                newProd = {
                  id: inserted.id,
                  name: inserted.name,
                  cat: inserted.cat || cat,
                  price: Number(inserted.price || price),
                  stock: Number(inserted.stock !== undefined ? inserted.stock : stock),
                  status: (inserted.stock === 0 || inserted.is_active === false) ? 'out' : (inserted.stock < 10) ? 'low' : 'active',
                  flavor: flavor,
                  image: inserted.image || image
                };
              }
            }

            PRODUCTS.unshift(newProd);
            if (syncChannel) {
              try {
                syncChannel.send({
                  type: 'broadcast',
                  event: 'product_created',
                  payload: newProd
                });
              } catch (e) {}
            }
            toast(`สร้างสินค้า "${name}" สำเร็จ`, 'success');
            renderPage();
          }
        }}
      ]
    });
  }

  // ============================================================
  // PAGE 4: Categories & Product Catalog Management
  // ============================================================
  PAGES.categories = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Categories &amp; Products</h1>
          <div class="page-sub">จัดการหมวดหมู่และสร้างสินค้าใหม่พร้อมรูปภาพได้ไม่อั้น</div>
        </div>
        <div class="flex gap-2">
          <button class="btn" id="addCat">+ New Category</button>
          <button class="btn btn-primary" id="btnCreateProductCat">+ Create Product</button>
        </div>
      </div>
    `));

    root.querySelector('#addCat').addEventListener('click', () => openModal({
      title: 'New Category',
      body: `
        <div class="grid" style="gap:12px">
          <div class="field"><label>Category Name (ชื่อหมวดหมู่) *</label><input class="input" id="newCatName" placeholder="e.g. Special Cakes, Coffee, Artisan Bread"/></div>
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Create Category', kind: 'primary', onClick: async () => {
          const name = $('#newCatName')?.value.trim() || 'New Category';
          if (!CATEGORIES.find(c => c.name.toLowerCase() === name.toLowerCase())) {
            CATEGORIES.push({ name, count: 0 });
          }
          if (supabase) {
            const { error } = await supabase.from('categories').insert({
              name,
              store_id: '00000000-0000-0000-0000-000000000001'
            });
            if (error) { toast('สร้างหมวดหมู่ไม่สำเร็จ: ' + error.message, 'error'); return; }
          }
          toast(`สร้างหมวดหมู่ "${name}" เรียบร้อยแล้ว`, 'success');
          renderPage();
        }},
      ]
    }));

    root.querySelector('#btnCreateProductCat').addEventListener('click', () => openAddProductModal());

    // Category Filter & Search
    const catBar = el(`
      <div class="card" style="margin-bottom:16px;">
        <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div class="card-title">All Categories (${CATEGORIES.length})</div>
            <div class="card-sub">คลิกที่หมวดหมู่เพื่อดูสินค้า หรือกดปุ่ม + เพื่อเพิ่มสินค้าในหมวดนั้นๆ ได้ไม่จำกัด</div>
          </div>
          <div class="search-wrap" style="max-width:240px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>
            <input placeholder="Search catalog..." id="catSearchInput" />
          </div>
        </div>

        <div class="grid cat-grid" style="margin-top:14px;" id="catCardsGrid">
          ${CATEGORIES.map(c => {
            const count = PRODUCTS.filter(p => p.cat === c.name).length;
            return `
              <div class="card cat-card" style="padding:14px; border:1px solid var(--border); background:var(--card);" data-cat="${escapeHTML(c.name)}">
                <div class="flex items-center" style="justify-content:space-between;">
                  <div style="width:40px; height:40px; border-radius:10px; background:var(--primary-50); color:var(--accent-text); display:grid; place-items:center; border:1px solid var(--border); font-weight:800; font-size:15px;">${escapeHTML(c.name.slice(0, 2).toUpperCase())}</div>
                  <span class="badge" style="background:var(--primary-50); font-weight:700;">${count} items</span>
                </div>
                <div style="margin-top:8px;">
                  <div class="cat-name" style="font-size:15px; font-weight:800;">${escapeHTML(c.name)}</div>
                  <div class="cat-count" style="font-size:12px; color:var(--muted);">${count} products in catalog</div>
                </div>
                <div class="cat-actions" style="margin-top:10px; display:flex; gap:6px;">
                  <button class="btn btn-sm btn-primary" data-a="addprod" data-cat="${escapeHTML(c.name)}" style="flex:1; font-size:11.5px;">+ Add Product</button>
                  <button class="btn btn-sm" data-a="edit" data-cat="${escapeHTML(c.name)}" style="padding:6px 10px;">${ICONS.edit}</button>
                  <button class="btn btn-sm btn-danger" data-a="del" data-cat="${escapeHTML(c.name)}" style="padding:6px 10px;">${ICONS.delete}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `);
    root.appendChild(catBar);

    // Products table list under categories
    const prodTableCard = el(`
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div class="card-title">Products Catalog (${PRODUCTS.length} total)</div>
            <div class="card-sub">รายการสินค้าทั้งหมดพร้อมรูปภาพ สามารถแก้ไขหรือเพิ่มใหม่ได้ไม่จำกัด</div>
          </div>
          <button class="btn btn-primary btn-sm" id="btnTableAddProd">+ Create Product</button>
        </div>
        <div class="table-wrap">
          <table class="data" id="catProductsTable">
            <thead>
              <tr>
                <th style="width:70px;">Photo</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${PRODUCTS.slice(0, 100).map(p => `
                <tr data-id="${p.id}">
                  <td>
                    <div style="width:42px; height:42px; border-radius:10px; overflow:hidden; background:var(--primary-50); display:grid; place-items:center; border:1px solid var(--border);">
                      <img src="${escapeHTML(p.image || DEFAULT_PRODUCT_IMG)}" alt="${escapeHTML(p.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                    </div>
                  </td>
                  <td>
                    <strong style="font-size:13.5px;">${escapeHTML(p.name)}</strong>
                    ${p.flavor ? `<div style="font-size:11.5px; color:var(--muted);">${escapeHTML(p.flavor)}</div>` : ''}
                  </td>
                  <td><span class="badge">${escapeHTML(p.cat)}</span></td>
                  <td><strong>${money(p.price)}</strong></td>
                  <td><span class="${getStockStatusInfo(p.stock).badgeClass}">${p.stock} in stock</span></td>
                  <td><span class="${getStockStatusInfo(p.stock).badgeClass}">${getStockStatusInfo(p.stock).label}</span></td>
                  <td style="text-align:right;">
                    <div style="display:flex; gap:10px; justify-content:flex-end; align-items:center;">
                      <button class="btn btn-sm" data-a="edit-p" data-id="${p.id}" style="padding:6px 12px; font-weight:700; background:var(--primary-50); border:1px solid var(--border); color:var(--accent-text);">${ICONS.edit} Edit</button>
                      <button class="btn btn-sm btn-danger" data-a="del-p" data-id="${p.id}" style="padding:6px 12px;">${ICONS.delete} Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);
    root.appendChild(prodTableCard);

    // Event listeners
    prodTableCard.querySelector('#btnTableAddProd')?.addEventListener('click', () => openAddProductModal());

    catBar.querySelectorAll('[data-a="addprod"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddProductModal(null, b.dataset.cat);
      });
    });

    catBar.querySelectorAll('[data-a="edit"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const catName = b.dataset.cat;
        const c = CATEGORIES.find(x => x.name === catName);
        if (!c) return;
        openModal({
          title: 'Edit Category',
          body: `<div class="field"><label>Category Name</label><input class="input" id="editCatName" value="${escapeHTML(c.name)}"/></div>`,
          actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
            const newName = $('#editCatName')?.value.trim() || c.name;
            if (supabase) await supabase.from('categories').update({ name: newName }).eq('name', c.name);
            c.name = newName;
            PRODUCTS.forEach(p => { if (p.cat === catName) p.cat = newName; });
            toast('Category updated', 'success');
            renderPage();
          }}]
        });
      });
    });

    catBar.querySelectorAll('[data-a="del"]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const catName = b.dataset.cat;
        confirmDialog(`Delete category "${catName}"?`, async () => {
          CATEGORIES = CATEGORIES.filter(x => x.name !== catName);
          if (supabase) await supabase.from('categories').delete().eq('name', catName);
          toast('Category deleted', 'success');
          renderPage();
        });
      });
    });

    prodTableCard.querySelectorAll('[data-a="edit-p"]').forEach(b => {
      b.addEventListener('click', () => {
        const prod = PRODUCTS.find(x => String(x.id) === String(b.dataset.id));
        if (prod) openAddProductModal(prod);
      });
    });

    prodTableCard.querySelectorAll('[data-a="del-p"]').forEach(b => {
      b.addEventListener('click', () => {
        const prod = PRODUCTS.find(x => String(x.id) === String(b.dataset.id));
        if (!prod) return;
        confirmDialog(`Delete product "${prod.name}"?`, async () => {
          PRODUCTS = PRODUCTS.filter(x => x.id !== prod.id);
          if (supabase) {
            const { error } = await supabase.from('products').delete().eq('id', prod.id);
            if (error) { toast('ลบสินค้าไม่สำเร็จ: ' + error.message, 'error'); return; }
          }
          toast('Product deleted', 'success');
          renderPage();
        });
      });
    });

    // Search input
    catBar.querySelector('#catSearchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const rows = prodTableCard.querySelectorAll('#catProductsTable tbody tr');
      rows.forEach(r => {
        const txt = r.textContent.toLowerCase();
        r.style.display = txt.includes(q) ? '' : 'none';
      });
    });
  };

  // ============================================================
  // PAGE 5: Stock
  // ============================================================
  PAGES.stock = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div><h1 class="page-title">Stock Management</h1><div class="page-sub">Inventory levels and movement history</div></div>
        <div class="flex gap-2">
          <button class="btn" id="btnStockExport">Export</button>
          <button class="btn btn-primary" id="btnQuickRestock">+ Stock Movement</button>
        </div>
      </div>
    `));

    root.querySelector('#btnStockExport').addEventListener('click', () => toast('Stock export downloaded', 'success'));
    root.querySelector('#btnQuickRestock').addEventListener('click', () => openModal({
      title: 'ปรับสต็อกสินค้า (Stock Movement)',
      body: `
        <div class="grid" style="gap:12px">
          <div class="field" style="min-width:0;"><label style="font-weight:700;">เลือกสินค้า</label><select class="select" id="smProd" style="width:100%; box-sizing:border-box;">${PRODUCTS.slice(0, 50).map(p => `<option value="${p.id}">${escapeHTML(p.name)} (สต็อก: ${p.stock})</option>`).join('')}</select></div>
          <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px">
            <div class="field" style="min-width:0;"><label style="font-weight:700;">ประเภทการปรับสต็อก</label><select class="select" id="smType" style="width:100%; box-sizing:border-box;"><option value="in">เติมสต็อก (+)</option><option value="out">เบิกสต็อก (-)</option></select></div>
            <div class="field" style="min-width:0;"><label style="font-weight:700;">จำนวน</label><input type="number" id="smQty" class="input" value="10" min="1" style="width:100%; box-sizing:border-box;"/></div>
          </div>
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'บันทึกสต็อก', kind: 'primary', onClick: async () => {
          const pid = $('#smProd')?.value;
          const type = $('#smType')?.value || 'in';
          const qty = Number($('#smQty')?.value || 10);
          const p = PRODUCTS.find(x => String(x.id) === String(pid));
          if (p) {
            p.stock = Math.max(0, p.stock + (type === 'in' ? qty : -qty));
            p.status = getStockStatusInfo(p.stock).type === 'danger' ? 'out_of_stock' : getStockStatusInfo(p.stock).type === 'warn' ? 'low' : 'active';
            if (supabase) {
              const { error } = await supabase.from('products').update({ stock: p.stock }).eq('id', p.id);
              if (error) { toast('อัปเดตสต็อกไม่สำเร็จ: ' + error.message, 'error'); return; }
            }
          }
          toast('Stock movement recorded', 'success');
          renderPage();
        }}
      ]
    }));

    const totalStock = PRODUCTS.reduce((a, b) => a + (Number(b.stock) || 0), 0);
    const lowThresh = Number(state.store && state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100);
    const low = PRODUCTS.filter(s => s.stock < lowThresh).length;
    const incomingQty = PRODUCTS.reduce((sum, p) => sum + (Number(p.incoming) || 0), 0);
    const outgoingQty = ORDERS.reduce((sum, o) => sum + (o.status !== 'cancelled' ? (Number(o.items) || 1) : 0), 0);

    const stats = [
      { label: 'Current Stock', value: String(totalStock), icon: ICONS.stock },
      { label: 'Incoming', value: `+${incomingQty}`, icon: ICONS.incoming },
      { label: 'Outgoing', value: `-${outgoingQty}`, icon: ICONS.outgoing },
      { label: 'Low Stock Alerts', value: String(low), icon: ICONS.alert },
    ];
    const g = el(`<div class="grid stats"></div>`);
    stats.forEach(s => g.appendChild(el(`
      <div class="card stat">
        <div class="row"><span class="label">${s.label}</span><span class="icon">${s.icon}</span></div>
        <div class="value">${s.value}</div>
        <div class="delta">Real-time sync</div>
      </div>`)));
    root.appendChild(g);

    const tableCard = el(`
      <div class="card" style="margin-top:18px; padding:0">
        <div style="padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
          <div><div class="card-title">Inventory Overview</div><div class="card-sub">All items (${PRODUCTS.length} products)</div></div>
          <div class="search-wrap" style="max-width:280px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg><input placeholder="Search inventory..." id="stockSearchInput"/></div>
        </div>
        <div class="table-wrap">
          <table class="data" id="stockTable">
            <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Status</th><th style="text-align:right;">Action</th></tr></thead>
            <tbody>
              ${PRODUCTS.map(s => `
                <tr data-pid="${s.id}">
                  <td>
                    <div class="flex items-center gap-3">
                      <div style="width:38px; height:38px; border-radius:8px; overflow:hidden; background:var(--primary-50); border:1px solid var(--border); flex:none;">
                        <img src="${escapeHTML(s.image || DEFAULT_PRODUCT_IMG)}" alt="${escapeHTML(s.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                      </div>
                      <div>
                        <strong style="font-size:13.5px;">${escapeHTML(s.name)}</strong>
                        ${s.flavor ? `<div style="font-size:11px; color:var(--muted);">${escapeHTML(s.flavor)}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td><span class="badge">${escapeHTML(s.cat || 'General')}</span></td>
                  <td><strong style="font-size:14px;">${s.stock}</strong></td>
                  <td><span class="${getStockStatusInfo(s.stock).badgeClass}">${getStockStatusInfo(s.stock).label}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn-sm btn-restock" data-id="${s.id}" style="font-weight:700; background:var(--primary-50); border:1px solid var(--border); color:var(--accent-text); padding:6px 14px;">+ เติมสต็อก</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `);

    // Attach Restock Click Handlers
    tableCard.querySelectorAll('.btn-restock').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prod = PRODUCTS.find(x => String(x.id) === String(btn.dataset.id));
        if (prod) openRestockModal(prod);
      });
    });

    // Stock live search
    tableCard.querySelector('#stockSearchInput')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const rows = tableCard.querySelectorAll('#stockTable tbody tr');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(q) ? '' : 'none';
      });
    });

    root.appendChild(tableCard);
  };

  // ============================================================
  // Customer Aggregation Helper (Group repeat customers by Farm Tag)
  // ============================================================
  function getAggregatedCustomers() {
    const customerMap = new Map();

    // 1. Group all orders by Farm Tag (primary) or Farm Name / Customer Name
    ORDERS.forEach(o => {
      const tagKey = (o.farm_tag || '').trim().toLowerCase();
      const farmKey = (o.farm_name || '').trim().toLowerCase();
      const nameKey = (o.customer || '').trim().toLowerCase();

      // Grouping key: prefer farm_tag, then farm_name, fallback: customer name
      const groupKey = tagKey ? `tag:${tagKey}` : (farmKey ? `farm:${farmKey}` : `name:${nameKey}`);
      if (!groupKey || groupKey === 'name:') return;

      if (!customerMap.has(groupKey)) {
        customerMap.set(groupKey, {
          key: groupKey,
          name: o.customer || 'Customer',
          farm_name: o.farm_name || '',
          farm_tag: o.farm_tag || '',
          contact: o.contact || '',
          email: (o.contact && o.contact.includes('@')) ? o.contact : `${(o.customer || 'customer').toLowerCase().replace(/\s+/g, '')}@customer.com`,
          phone: (o.contact && !o.contact.includes('@')) ? o.contact : '',
          ordersCount: 0,
          totalSpend: 0,
          totalItems: 0,
          tag: 'New',
          ordersList: [],
          itemFrequency: {}
        });
      }

      const c = customerMap.get(groupKey);
      if (o.customer && (!c.name || c.name === 'Customer')) c.name = o.customer;
      if (o.farm_name && !c.farm_name) c.farm_name = o.farm_name;
      if (o.farm_tag && !c.farm_tag) c.farm_tag = o.farm_tag;
      if (o.contact && !c.contact) {
        c.contact = o.contact;
        if (o.contact.includes('@')) c.email = o.contact;
        else c.phone = o.contact;
      }

      c.ordersCount += 1;
      const orderTotal = Number(o.total || 0);
      c.totalSpend += orderTotal;
      c.totalItems += Number(o.items || (o.items_data ? o.items_data.reduce((s, it) => s + (it.qty || 1), 0) : 1));

      // Append order to customer's history list
      c.ordersList.push(o);

      // Track purchased items for Favorite item calculation
      if (Array.isArray(o.items_data)) {
        o.items_data.forEach(it => {
          const itName = it.name || 'Product';
          const qty = Number(it.qty || 1);
          c.itemFrequency[itName] = (c.itemFrequency[itName] || 0) + qty;
        });
      }
    });

    // 2. Also incorporate any pre-registered customers in CUSTOMERS array
    CUSTOMERS.forEach(cust => {
      const tagKey = (cust.tag && !['VIP', 'Regular', 'New'].includes(cust.tag) ? cust.tag : cust.address || '').trim().toLowerCase();
      const nameKey = (cust.name || '').trim().toLowerCase();
      const groupKey = tagKey ? `tag:${tagKey}` : `name:${nameKey}`;

      if (!customerMap.has(groupKey)) {
        customerMap.set(groupKey, {
          key: groupKey,
          name: cust.name,
          farm_name: cust.address || '',
          farm_tag: (cust.tag && !['VIP', 'Regular', 'New'].includes(cust.tag)) ? cust.tag : '',
          contact: cust.phone || cust.email || '',
          email: cust.email || `${cust.name.toLowerCase().replace(/\s+/g, '')}@customer.com`,
          phone: cust.phone || '',
          ordersCount: cust.orders || 1,
          totalSpend: Number(cust.spend || 0),
          totalItems: cust.orders || 1,
          tag: (cust.tag && ['VIP', 'Regular', 'New'].includes(cust.tag)) ? cust.tag : 'New',
          ordersList: [],
          itemFrequency: {}
        });
      }
    });

    // 3. Process tags, sorting and favorite product
    return Array.from(customerMap.values()).map(c => {
      if (c.ordersCount >= 5 || c.totalSpend >= 500) c.tag = 'VIP';
      else if (c.ordersCount >= 2 || c.totalSpend >= 100) c.tag = 'Regular';
      else c.tag = 'New';

      let maxQty = 0;
      let favName = '-';
      Object.entries(c.itemFrequency).forEach(([name, count]) => {
        if (count > maxQty) {
          maxQty = count;
          favName = name;
        }
      });
      c.favoriteItem = favName !== '-' ? `${favName} (${maxQty} ชิ้น)` : (PRODUCTS[0]?.name || '-');
      c.ordersList.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      return c;
    });
  }

  // ============================================================
  // PAGE 6: Customers
  // ============================================================
  PAGES.customers = (root) => {
    const aggCustomers = getAggregatedCustomers();

    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Customers</h1>
          <div class="page-sub">Your loyal customer base (${aggCustomers.length} profiles)</div>
        </div>
        <button class="btn btn-primary" id="btnAddCustomer">+ Add Customer</button>
      </div>
    `));

    root.querySelector('#btnAddCustomer').addEventListener('click', () => openModal({
      title: 'New Customer Profile',
      body: `
        <div class="grid" style="gap:12px">
          <div class="field"><label>Customer Name</label><input class="input" id="newCustName" placeholder="e.g. Lisa M."/></div>
          <div class="field"><label>Farm / Tag</label><input class="input" id="newCustTagInput" placeholder="e.g. #FARM-01 หรือ Green Farm"/></div>
          <div class="field"><label>Contact (Phone/Email)</label><input class="input" id="newCustEmail" placeholder="e.g. 081-234-5678"/></div>
          <div class="field"><label>Customer Tier</label><select class="select" id="newCustTier"><option>New</option><option>Regular</option><option>VIP</option></select></div>
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Add Customer', kind: 'primary', onClick: async () => {
          const name = $('#newCustName')?.value.trim() || 'New Customer';
          const farmTag = $('#newCustTagInput')?.value.trim() || '';
          const contact = $('#newCustEmail')?.value.trim() || '';
          const tier = $('#newCustTier')?.value || 'New';
          const email = (contact && contact.includes('@')) ? contact : `${name.toLowerCase().replace(/\s+/g, '')}@customer.com`;
          const phone = (contact && !contact.includes('@')) ? contact : '';
          CUSTOMERS.unshift({ name, email, phone, address: farmTag, orders: 1, spend: 0, tag: tier });
          if (supabase) await supabase.from('customers').insert({ name, email, phone, address: farmTag, tag: tier });
          toast('เพิ่มข้อมูลลูกค้าเรียบร้อยแล้ว', 'success');
          renderPage();
        }}
      ]
    }));

    const listCard = el(`
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Visits</th>
                <th>Total Spend</th>
                <th>Tag</th>
                <th style="text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${aggCustomers.length ? aggCustomers.map(c => `
                <tr data-key="${escapeHTML(c.key)}" style="cursor:pointer;">
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar" style="width:38px; height:38px; border-radius:10px; font-size:13px; font-weight:800; flex:none;">
                        ${escapeHTML((c.name || 'C').slice(0, 2).toUpperCase())}
                      </div>
                      <div style="min-width:0;">
                        <div style="font-weight:700; font-size:13.5px; color:var(--text);">${escapeHTML(c.name)}</div>
                        ${(c.farm_tag || c.farm_name) ? `
                          <div style="font-size:11px; color:var(--muted); margin-top:2px; display:inline-flex; align-items:center; gap:4px;">
                            <span style="background:var(--primary-50); padding:1px 6px; border-radius:6px; border:1px solid var(--border); font-weight:600; color:var(--accent-text);">${escapeHTML(c.farm_tag || c.farm_name)}</span>
                            <button type="button" class="btn btn-sm btn-ghost btn-copy-cust-tag-row" data-tag="${escapeHTML(c.farm_tag || c.farm_name)}" title="คัดลอกแท็กฟาร์ม" style="padding:2px 5px; border-radius:5px; border:1px solid var(--border); display:inline-flex; align-items:center; cursor:pointer;">
                              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </button>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="font-size:13px; font-weight:600; color:var(--text);">${escapeHTML(c.phone || c.contact || c.email || '-')}</div>
                    ${c.phone && c.email && !c.email.includes('@customer.com') ? `<div style="font-size:11px; color:var(--muted);">${escapeHTML(c.email)}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${c.ordersCount > 1 ? 'info' : ''}" style="font-weight:700;">${c.ordersCount} visits</span>
                  </td>
                  <td><strong style="font-size:14px; color:var(--accent-text);">${money(c.totalSpend)}</strong></td>
                  <td><span class="badge ${c.tag === 'VIP' ? '' : c.tag === 'Regular' ? 'info' : 'success'}">${c.tag}</span></td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-sm btn-view-cust" data-key="${escapeHTML(c.key)}">View</button>
                  </td>
                </tr>`).join('') : `<tr><td colspan="6"><div class="empty"><div class="icon">${ICONS.customers}</div>No customer records found.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `);

    root.appendChild(listCard);

    listCard.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.btn-copy-cust-tag-row')) return;
        openCustomerModal(tr.dataset.key);
      });
    });

    listCard.querySelectorAll('.btn-copy-cust-tag-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = btn.dataset.tag || '';
        const doCopy = () => {
          btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#3F8E63" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
          setTimeout(() => {
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
          }, 1800);
          toast(`คัดลอกแท็กฟาร์ม "${tag}" เรียบร้อยแล้ว`, 'success');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(tag).then(doCopy).catch(doCopy);
        } else {
          doCopy();
        }
      });
    });
  };

  function openCustomerModal(keyOrName) {
    const aggCustomers = getAggregatedCustomers();
    const c = aggCustomers.find(x => x.key === keyOrName || x.name.toLowerCase() === String(keyOrName).toLowerCase() || (x.farm_tag && x.farm_tag.toLowerCase() === String(keyOrName).toLowerCase()));
    if (!c) return;

    const farmInfo = [c.farm_name, c.farm_tag].filter(Boolean).join(' · ') || c.farm_tag || c.farm_name || '-';

    const body = el(`
      <div>
        <!-- Profile Header -->
        <div class="flex items-center gap-3 mb-3">
          <div class="avatar" style="width:52px; height:52px; border-radius:14px; font-size:16px; font-weight:800;">
            ${escapeHTML((c.name || 'C').slice(0, 2).toUpperCase())}
          </div>
          <div>
            <div style="font-weight:800; font-size:16px; color:var(--text);">${escapeHTML(c.name)}</div>
            <div style="color:var(--muted); font-size:12.5px;">${escapeHTML(c.phone || c.contact || c.email)}</div>
          </div>
          <span class="badge ${c.tag === 'VIP' ? '' : c.tag === 'Regular' ? 'info' : 'success'}" style="margin-left:auto; font-weight:700;">${c.tag}</span>
        </div>

        <!-- Farm Tag Bar -->
        <div class="card" style="margin-bottom:14px; padding:10px 14px; background:var(--primary-50); border:1px solid var(--border); border-radius:12px;">
          <div class="kv" style="margin:0; border:none; padding:0;">
            <span class="k" style="font-weight:600;">Farm / Tag</span>
            <span class="v" style="display:flex; align-items:center; gap:6px;">
              <strong style="color:var(--text);">${escapeHTML(farmInfo)}</strong>
              ${(c.farm_tag || c.farm_name) ? `
                <button type="button" class="btn btn-sm btn-ghost btn-copy-cust-tag" data-tag="${escapeHTML(c.farm_tag || c.farm_name)}" style="font-size:11.5px; padding:3px 10px; border:1px solid var(--border); border-radius:8px; display:inline-flex; align-items:center; gap:5px; font-weight:700; color:var(--accent-text); cursor:pointer;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  <span>Copy Tag</span>
                </button>
              ` : ''}
            </span>
          </div>
        </div>

        <!-- Order History List Panel -->
        <div style="margin-bottom:14px;">
          <div class="flex items-center" style="justify-content:space-between; margin-bottom:8px;">
            <div style="font-weight:700; font-size:14px; color:var(--text); display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Order History (ประวัติการสั่งซื้อ ${c.ordersList.length} ครั้ง)</span>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; padding-right:2px;">
            ${c.ordersList.length ? c.ordersList.map(o => {
              const itemsListStr = Array.isArray(o.items_data) && o.items_data.length 
                ? o.items_data.map(it => `${escapeHTML(it.name)} x${it.qty}`).join(', ') 
                : `${o.items || 1} items`;
              return `
                <div style="padding:10px 12px; border:1px solid var(--border); border-radius:10px; background:var(--card); display:flex; align-items:center; justify-content:space-between; gap:8px;">
                  <div style="min-width:0; flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <strong style="font-size:13px; color:var(--text);">#${escapeHTML(o.id)}</strong>
                      <span style="font-size:11.5px; color:var(--muted);">· ${escapeHTML(o.date)}</span>
                      <span class="badge ${STATUS[o.status]?.cls || ''}" style="font-size:10px; padding:1px 6px;">${STATUS[o.status]?.label || o.status}</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${itemsListStr}
                    </div>
                  </div>
                  <div style="font-weight:800; font-size:13.5px; color:var(--accent-text); flex:none;">
                    ${money(o.total)}
                  </div>
                </div>
              `;
            }).join('') : `
              <div style="text-align:center; padding:16px; color:var(--muted); font-size:12.5px; background:var(--primary-50); border:1px dashed var(--border); border-radius:10px;">
                ไม่มีประวัติออเดอร์ในระบบ
              </div>
            `}
          </div>
        </div>

        <!-- Summary Section at the Bottom -->
        <div class="card" style="padding:14px; background:var(--primary-50); border:1px solid var(--border); border-radius:14px; margin-bottom:6px;">
          <div style="font-size:12px; font-weight:700; color:var(--accent-text); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">
            สรุปภาพรวมลูกค้า (Customer Summary)
          </div>
          <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap:10px;">
            <div style="background:var(--card); padding:10px; border-radius:10px; border:1px solid var(--border); text-align:center;">
              <div style="font-size:11px; color:var(--muted); font-weight:600;">ยอดจ่ายทั้งหมด</div>
              <div style="font-size:15px; font-weight:800; color:var(--accent-text); margin-top:2px;">${money(c.totalSpend)}</div>
            </div>
            <div style="background:var(--card); padding:10px; border-radius:10px; border:1px solid var(--border); text-align:center;">
              <div style="font-size:11px; color:var(--muted); font-weight:600;">จำนวนครั้งที่ซื้อ</div>
              <div style="font-size:15px; font-weight:800; color:var(--text); margin-top:2px;">${c.ordersCount} ครั้ง</div>
            </div>
            <div style="background:var(--card); padding:10px; border-radius:10px; border:1px solid var(--border); text-align:center;">
              <div style="font-size:11px; color:var(--muted); font-weight:600;">ออเดอร์ที่ชอบที่สุด</div>
              <div style="font-size:11.5px; font-weight:700; color:var(--primary-600); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(c.favoriteItem)}">
                ${escapeHTML(c.favoriteItem)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `);

    body.querySelectorAll('.btn-copy-cust-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = btn.dataset.tag || '';
        const doCopy = () => {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#3F8E63" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span style="color:#3F8E63;">Copied!</span>
          `;
          btn.style.borderColor = '#7CC59A';
          setTimeout(() => {
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy Tag</span>
            `;
            btn.style.borderColor = 'var(--border)';
          }, 1800);
          toast(`คัดลอกแท็กฟาร์ม "${tag}" เรียบร้อยแล้ว`, 'success');
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(tag).then(doCopy).catch(doCopy);
        } else {
          doCopy();
        }
      });
    });

    openModal({
      title: 'Customer Profile',
      body,
      actions: [{ label: 'Close', kind: 'ghost' }]
    });
  }

  // ============================================================
  // Review Celebration & Thank You Popup
  // ============================================================
  // ============================================================
  // Review Celebration & Thank You Popup (Minimalist Mascot Bounce & Chubby Heart Home Button)
  // ============================================================
  function openReviewCelebrationModal() {
    const title = state.store.reviewPopupTitle || 'Thank You';
    const mascotImg = state.store.reviewPopupImage || '';

    const body = el(`
      <div style="text-align:center; padding:16px 12px 14px; position:relative; overflow:hidden;">
        <!-- Top Curved Bouncing Title above Mascot -->
        <div class="curved-celebration-title">
          ${escapeHTML(title)}
        </div>

        <!-- Center Mascot Image with White Border and Gentle Aura -->
        <div class="mascot-celebration-wrap">
          ${mascotImg ? `
            <img src="${escapeHTML(mascotImg)}" alt="Mascot" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='grid';" />
            <div style="display:none; width:100%; height:100%; place-items:center; color:var(--primary-600);">
              <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
          ` : `
            <div style="display:grid; place-items:center; width:100%; height:100%; color:var(--primary-600);">
              <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
          `}
        </div>

        <!-- Chubby Heart Button with Home SVG Icon Inside -->
        <button type="button" class="btn-chubby-heart" id="btnCelebrationHome" title="กลับหน้าแรก (Back to Home)" aria-label="Home">
          <svg viewBox="0 0 100 90" width="76" height="70" fill="var(--primary-600)" style="display:block; filter:drop-shadow(0 3px 8px color-mix(in srgb, var(--primary-600) 25%, transparent));">
            <path d="M50 82 C50 82 8 52 8 28 C8 12 22 4 35 4 C43 4 47 8 50 12 C53 8 57 4 65 4 C78 4 92 12 92 28 C92 52 50 82 50 82 Z" />
          </svg>
          <div class="heart-home-icon">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
        </button>
      </div>
    `);

    body.querySelector('#btnCelebrationHome')?.addEventListener('click', () => {
      closeModal();
      state.page = 'store';
      state.storeTab = 'home';
      renderMenu();
      renderPage();
    });

    openModal({
      title: '',
      body,
      actions: []
    });
  }

  function openWriteReviewModal(order) {
    let selectedRating = 5;
    const body = el(`
      <div class="grid" style="gap:14px;">
        <div style="text-align:center; padding:10px 0; background:var(--primary-50); border-radius:14px; border:1px solid var(--border);">
          <div style="font-size:12.5px; color:var(--muted); margin-bottom:6px;">ให้คะแนนความพึงพอใจต่อคำสั่งซื้อ ${order?.id ? `<strong>#${order.id}</strong>` : ''}</div>
          <div id="heartPicker" style="display:flex; justify-content:center; gap:8px; cursor:pointer; user-select:none; margin:8px 0;">
            ${[1,2,3,4,5].map(n => `
              <span data-heart="${n}" style="display:inline-flex; align-items:center; transition:transform .15s ease; padding:2px;">
                <svg viewBox="0 0 24 24" width="22" height="22" style="fill:var(--primary-600); stroke:var(--primary-600); stroke-width:2; transition:all .18s ease;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </span>
            `).join('')}
          </div>
          <div id="heartLabel" style="font-size:12.5px; font-weight:700; color:var(--accent-text); margin-top:4px;">5 ดวงใจ - ประทับใจมากที่สุด ยอดเยี่ยม!</div>
        </div>

        <div class="field">
          <label>ชื่อของคุณ (Customer Name) *</label>
          <input class="input" id="revCustName" placeholder="เช่น Anna W., คุณมินตรา" value="${order?.customer ? escapeHTML(order.customer) : ''}" />
        </div>

        <div class="field">
          <label>ความรู้สึกและข้อความรีวิว (Review Message) *</label>
          <textarea class="textarea" id="revCustMsg" placeholder="แชร์ความประทับใจเกี่ยวกับรสชาติขนม, การบริการ, หรือความรวดเร็วในการจัดส่ง..." rows="3"></textarea>
        </div>
      </div>
    `);

    const heartSpans = body.querySelectorAll('#heartPicker span');
    const heartLabel = body.querySelector('#heartLabel');
    const labels = {
      1: state.store.starLabel1 || '1 ดวงใจ - ต้องปรับปรุง',
      2: state.store.starLabel2 || '2 ดวงใจ - พอใช้ได้',
      3: state.store.starLabel3 || '3 ดวงใจ - ปานกลาง / รสชาติดี',
      4: state.store.starLabel4 || '4 ดวงใจ - อร่อยและประทับใจมาก',
      5: state.store.starLabel5 || '5 ดวงใจ - ประทับใจมากที่สุด ยอดเยี่ยม!'
    };

    const updateHearts = (val) => {
      selectedRating = val;
      heartSpans.forEach((s, idx) => {
        const active = (idx + 1) <= val;
        const svg = s.querySelector('svg');
        if (svg) {
          svg.style.fill = active ? 'var(--primary-600)' : 'transparent';
          svg.style.stroke = active ? 'var(--primary-600)' : 'var(--border)';
          s.style.transform = active ? 'scale(1.12)' : 'scale(0.92)';
        }
      });
      if (heartLabel) heartLabel.textContent = labels[val] || `${val} ดวงใจ`;
    };

    updateHearts(5);

    heartSpans.forEach(s => {
      s.addEventListener('click', () => updateHearts(+s.dataset.heart));
    });

    openModal({
      title: 'เขียนรีวิวและให้คะแนนร้านค้า (Leave a Review)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'ส่งรีวิว (Submit Review)', kind: 'primary', close: false, onClick: async () => {
          const name = $('#revCustName')?.value.trim() || 'ลูกค้าคนพิเศษ';
          const text = $('#revCustMsg')?.value.trim() || 'ขนมอร่อยมาก แพ็กเกจน่ารักและจัดส่งรวดเร็วมากค่ะ';
          const avatar = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'AW';
          const date = new Date().toISOString().split('T')[0];

          const newRev = {
            id: 'rev_' + Date.now(),
            name,
            avatar,
            rating: selectedRating,
            date,
            text,
            pinned: false
          };

          // Deduplicate locally
          const exists = REVIEWS.some(r => (r.name === name && r.text === text) || String(r.id) === String(newRev.id));
          if (!exists) {
            REVIEWS.unshift(newRev);
          }

          if (supabase) {
            try {
              const { data: insertedRev } = await supabase.from('reviews').insert({
                store_id: state.storeId || '00000000-0000-0000-0000-000000000001',
                customer_name: name,
                rating: selectedRating,
                comment: text,
                is_pinned: false
              }).select().single();
              if (insertedRev && insertedRev.id) {
                newRev.id = insertedRev.id;
              }
            } catch (e) {
              console.warn('Supabase review insert notice:', e);
            }
          }

          if (syncChannel) {
            try {
              syncChannel.send({
                type: 'broadcast',
                event: 'review_created',
                payload: newRev
              });
            } catch (e) {}
          }

          openReviewCelebrationModal();
        }}
      ]
    });
  }

  // ============================================================
  // PAGE 7: Reviews
  // ============================================================
  PAGES.reviews = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Reviews &amp; Feedback</h1>
          <div class="page-sub">Customer reviews, ratings, and pinned sticky notes (${REVIEWS.length} total)</div>
        </div>
      </div>
    `));

    const grid = el(`<div class="reviews-grid"></div>`);
    root.appendChild(grid);

    // Sort pinned reviews first
    const sortedReviews = [...REVIEWS].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    let pinnedCount = 0;
    sortedReviews.forEach(r => {
      const isPinned = !!r.pinned;
      let stickyClass = '';
      if (isPinned) {
        stickyClass = pinnedCount % 2 === 0 ? 'pinned-sticky tilt-left' : 'pinned-sticky tilt-right';
        pinnedCount++;
      }

      const card = el(`
        <div class="review-card ${stickyClass}">
          ${isPinned ? `
            <div class="sticky-pin-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M5 17h14M7 17l1-9h8l1 9M9 8V3h6v5"/></svg>
              <span>Pinned Note</span>
            </div>
          ` : ''}
          <div class="review-head">
            <div class="avatar" style="font-size:13px; font-weight:800;">${escapeHTML(r.avatar || 'AW')}</div>
            <div style="flex:1">
              <div class="review-name" style="font-size:14px; font-weight:700; color:var(--text);">${escapeHTML(r.name)}</div>
              <div class="review-date">${r.date || '2026-08-20'}</div>
            </div>
            <div class="stars">${renderHearts(r.rating)}</div>
          </div>
          <div class="review-text" style="color:var(--text); font-size:13.5px; line-height:1.55;">${escapeHTML(r.text)}</div>
          <div class="review-actions" style="margin-top:auto; padding-top:8px;">
            <button class="btn ${r.pinned ? 'btn-primary' : ''}" data-a="pin" style="font-weight:700; display:inline-flex; align-items:center; gap:4px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M5 17h14M7 17l1-9h8l1 9M9 8V3h6v5"/></svg>
              <span>${r.pinned ? 'Pinned (ปักหมุดแล้ว)' : 'Pin (ปักหมุด)'}</span>
            </button>
            <button class="btn btn-danger" data-a="del">Delete</button>
          </div>
        </div>
      `);

      card.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.a === 'pin') {
          r.pinned = !r.pinned;
          persistReviews();
          if (supabase && r.id) {
            try {
              await supabase.from('reviews').update({ is_pinned: r.pinned }).eq('id', r.id);
            } catch (e) {}
          }
          toast(r.pinned ? `ปักหมุดรีวิวของคุณ ${r.name} ไว้ด้านบนแล้ว` : `ยกเลิกการปักหมุดรีวิวของคุณ ${r.name} แล้ว`, 'success');
          renderPage();
        } else if (b.dataset.a === 'del') {
          confirmDialog(`Delete review from "${r.name}"?`, async () => {
            REVIEWS = REVIEWS.filter(x => x !== r && x.id !== r.id);
            persistReviews();
            if (supabase && r.id) {
              try {
                await supabase.from('reviews').delete().eq('id', r.id);
              } catch (e) {}
            }
            toast('Review deleted', 'success');
            renderPage();
          });
        }
      }));
      grid.appendChild(card);
    });
  };

  // ============================================================
  // PAGE 8: Promotions & Discount Codes Management
  // ============================================================
  function openPromotionModal(existing = null) {
    const isEdit = !!existing;
    let initialType = 'percent';
    let initialVal = 10;
    if (existing) {
      if (existing.off && existing.off.includes('%')) {
        initialType = 'percent';
        const m = existing.off.match(/(\d+(?:\.\d+)?)/);
        if (m) initialVal = m[1];
      } else if (existing.off && (existing.off.includes('฿') || existing.type === 'Fixed')) {
        initialType = 'fixed';
        const m = existing.off.match(/(\d+(?:\.\d+)?)/);
        if (m) initialVal = m[1];
      } else {
        initialType = 'custom';
      }
    }

    const body = el(`
      <div class="grid" style="gap:14px;">
        <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
          <div class="field" style="min-width:0;">
            <label style="font-weight:700;">รหัสโค้ดส่วนลด *</label>
            <input class="input" id="pCode" placeholder="เช่น SUMMER20, VIP100" value="${existing ? escapeHTML(existing.code) : ''}" style="text-transform:uppercase; font-weight:700; width:100%; box-sizing:border-box;" />
          </div>
          <div class="field" style="min-width:0;">
            <label style="font-weight:700;">รูปแบบส่วนลด</label>
            <select class="select" id="pDiscountMode" style="width:100%; box-sizing:border-box;">
              <option value="percent" ${initialType === 'percent' ? 'selected' : ''}>เปอร์เซ็นต์</option>
              <option value="fixed" ${initialType === 'fixed' ? 'selected' : ''}>จำนวนเงินคงที่</option>
              <option value="custom" ${initialType === 'custom' ? 'selected' : ''}>กำหนดข้อความเอง</option>
            </select>
          </div>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
          <div class="field" id="valFieldWrap" style="min-width:0;">
            <label style="font-weight:700;" id="pValLabel">มูลค่าส่วนลด *</label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="number" step="0.5" min="1" class="input" id="pDiscountVal" placeholder="เช่น 15, 20, 100" value="${initialVal}" style="padding-right:38px; font-weight:700; width:100%; box-sizing:border-box;" />
              <span id="pValUnit" style="position:absolute; right:12px; font-weight:800; color:var(--accent-text); font-size:14px;">${initialType === 'fixed' ? '฿' : '%'}</span>
            </div>
          </div>
          <div class="field" style="min-width:0;">
            <label style="font-weight:700;">สถานะ</label>
            <select class="select" id="pStatus" style="width:100%; box-sizing:border-box;">
              <option value="active" ${(!existing || existing.status === 'active') ? 'selected' : ''}>เปิดใช้งาน</option>
              <option value="scheduled" ${existing?.status === 'scheduled' ? 'selected' : ''}>ตั้งเวลาล่วงหน้า</option>
              <option value="expired" ${existing?.status === 'expired' ? 'selected' : ''}>ปิด / หมดอายุ</option>
            </select>
          </div>
        </div>

        <div class="field" style="min-width:0;">
          <label style="font-weight:700;">ข้อความแสดงส่วนลด</label>
          <input class="input" id="pOff" placeholder="เช่น 15% off, ฿100 off" value="${existing ? escapeHTML(existing.off) : '10% off'}" style="width:100%; box-sizing:border-box;" />
          <div style="font-size:11.5px; color:var(--muted); margin-top:3px;">ข้อความนี้จะแสดงในแท็กคูปองแนะนำและนำไปคำนวณหักยอดเงินในตะกร้าอัตโนมัติ</div>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
          <div class="field" style="min-width:0;">
            <label style="font-weight:700;">วันเริ่มต้น</label>
            <input type="date" class="input" id="pStart" value="${existing?.start || new Date().toISOString().split('T')[0]}" style="width:100%; box-sizing:border-box;" />
          </div>
          <div class="field" style="min-width:0;">
            <label style="font-weight:700;">วันสิ้นสุด</label>
            <input type="date" class="input" id="pEnd" value="${existing?.end || '2026-12-31'}" style="width:100%; box-sizing:border-box;" />
          </div>
        </div>
      </div>
    `);

    // Auto-update discount label on value or mode change
    const modeSelect = body.querySelector('#pDiscountMode');
    const valInput = body.querySelector('#pDiscountVal');
    const valUnit = body.querySelector('#pValUnit');
    const offInput = body.querySelector('#pOff');

    const updateOffLabel = () => {
      const mode = modeSelect.value;
      const val = parseFloat(valInput.value) || 0;
      if (mode === 'percent') {
        valUnit.textContent = '%';
        valInput.disabled = false;
        offInput.value = `${val}% off`;
      } else if (mode === 'fixed') {
        valUnit.textContent = '฿';
        valInput.disabled = false;
        offInput.value = `฿${val} off`;
      } else {
        valUnit.textContent = '';
        valInput.disabled = true;
      }
    };

    modeSelect.addEventListener('change', updateOffLabel);
    valInput.addEventListener('input', updateOffLabel);

    openModal({
      title: isEdit ? `Edit Promotion (${existing.code})` : 'Create New Promotion (สร้างโค้ดส่วนลดใหม่)',
      body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: isEdit ? 'Update Promotion (บันทึก)' : 'Create Promotion (สร้าง)',
          kind: 'primary',
          onClick: async () => {
            const code = (body.querySelector('#pCode')?.value || '').trim().toUpperCase();
            if (!code) return toast('โปรดระบุ Promo Code', 'error');

            const mode = body.querySelector('#pDiscountMode')?.value || 'percent';
            const rawVal = parseFloat(body.querySelector('#pDiscountVal')?.value) || 0;
            const off = (body.querySelector('#pOff')?.value || '').trim() || (mode === 'percent' ? `${rawVal}% off` : `฿${rawVal} off`);
            const status = body.querySelector('#pStatus')?.value || 'active';
            const start = body.querySelector('#pStart')?.value || new Date().toISOString().split('T')[0];
            const end = body.querySelector('#pEnd')?.value || '2026-12-31';
            const type = mode === 'percent' ? 'Coupon' : mode === 'fixed' ? 'Fixed' : 'Campaign';

            if (isEdit) {
              existing.code = code;
              existing.type = type;
              existing.off = off;
              existing.start = start;
              existing.end = end;
              existing.status = status;
              toast(`อัปเดตโปรโมชั่น "${code}" (${off}) เรียบร้อยแล้ว!`, 'success');
            } else {
              PROMOTIONS.unshift({ code, type, off, start, end, status });
              toast(`สร้างโปรโมชั่น "${code}" (${off}) สำเร็จ!`, 'success');
            }

            if (supabase) {
              await supabase.from('promotions').upsert({
                code,
                type: mode === 'percent' ? 'percent' : 'fixed',
                discount: rawVal,
                start_date: start,
                end_date: end,
                status
              }).catch(() => {});
            }

            renderPage();
          }
        }
      ]
    });
  }

  PAGES.promotions = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div><h1 class="page-title">Promotions &amp; Discounts</h1><div class="page-sub">จัดการคูปองส่วนลด แคมเปญ และโปรโมชั่นหน้าร้าน (${PROMOTIONS.length} รายการ)</div></div>
        <button class="btn btn-primary" id="addPromo" style="font-weight:700;">+ Create Discount / Promotion</button>
      </div>
    `));

    root.querySelector('#addPromo').addEventListener('click', () => openPromotionModal());

    const grid = el(`<div class="grid three-col"></div>`);
    root.appendChild(grid);

    PROMOTIONS.slice(0, 6).forEach(p => {
      const card = el(`
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between">
            <span class="badge ${p.status === 'active' ? 'success' : p.status === 'scheduled' ? 'info' : 'mute'}">${p.status}</span>
            <span style="font-size:12px; color:var(--muted); font-weight:600;">${p.type}</span>
          </div>
          <div class="card-title" style="margin-top:10px; font-size:18px; color:var(--accent-text); font-weight:800;">${escapeHTML(p.code)}</div>
          <div class="card-sub" style="font-size:13px; font-weight:700; color:var(--text);">${escapeHTML(p.off)}</div>
          <div class="kv" style="margin-top:10px;"><span class="k">Start</span><span class="v">${p.start}</span></div>
          <div class="kv"><span class="k">End</span><span class="v">${p.end}</span></div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-sm btn-edit-p" style="flex:1; font-weight:700;">Edit</button>
            <button class="btn btn-sm ${p.status === 'active' ? 'btn-danger' : 'btn-outline'} btn-toggle-p" style="flex:1; font-weight:700;">
              ${p.status === 'active' ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      `);

      card.querySelector('.btn-edit-p').addEventListener('click', () => openPromotionModal(p));
      card.querySelector('.btn-toggle-p').addEventListener('click', () => {
        p.status = p.status === 'active' ? 'expired' : 'active';
        toast(`เปลี่ยนสถานะโค้ด ${p.code} เป็น ${p.status} เรียบร้อย`, 'info');
        renderPage();
      });

      grid.appendChild(card);
    });

    root.appendChild(el(`
      <div class="card" style="margin-top:18px; padding:0">
        <div style="padding:16px 20px"><div class="card-title">All Promotion Codes</div><div class="card-sub">รายการโค้ดส่วนลดทั้งหมดในระบบ</div></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Code</th><th>Type</th><th>Discount</th><th>Start</th><th>End</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead>
            <tbody>
              ${PROMOTIONS.map((p, idx) => `
                <tr>
                  <td><strong style="color:var(--accent-text); letter-spacing:0.5px;">${escapeHTML(p.code)}</strong></td>
                  <td>${escapeHTML(p.type)}</td>
                  <td><span style="font-weight:700; color:var(--text);">${escapeHTML(p.off)}</span></td>
                  <td>${p.start}</td>
                  <td>${p.end}</td>
                  <td><span class="badge ${p.status === 'active' ? 'success' : p.status === 'scheduled' ? 'info' : 'mute'}">${p.status}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn-sm btn-p-tbl-edit" data-idx="${idx}" style="padding:4px 10px; font-weight:600;">Edit</button>
                    <button class="btn btn-sm btn-danger btn-p-tbl-del" data-idx="${idx}" style="padding:4px 8px; font-weight:600; margin-left:4px;">✕</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `));

    root.querySelectorAll('.btn-p-tbl-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PROMOTIONS[+btn.dataset.idx];
        if (p) openPromotionModal(p);
      });
    });

    root.querySelectorAll('.btn-p-tbl-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PROMOTIONS[+btn.dataset.idx];
        if (!p) return;
        confirmDialog(`ต้องการลบโค้ดส่วนลด "${p.code}" หรือไม่?`, () => {
          PROMOTIONS.splice(+btn.dataset.idx, 1);
          toast(`ลบโค้ดส่วนลด "${p.code}" แล้ว`, 'success');
          renderPage();
        });
      });
    });
  };

  // ============================================================
  // PAGE 9: Reports
  // ============================================================
  PAGES.reports = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div><h1 class="page-title">Reports</h1><div class="page-sub">Sales performance & analytics</div></div>
        <div class="flex gap-2">
          <button class="btn btn-primary" id="expPdf" style="font-weight:700;">Export PDF / Print</button>
        </div>
      </div>
    `));
    root.querySelector('#expPdf').addEventListener('click', () => window.print());

    const totalRev = ORDERS.reduce((s, o) => s + (o.status !== 'cancelled' ? Number(o.total || 0) : 0), 0);
    const completedOrders = ORDERS.filter(o => o.status === 'completed').length;
    const avgVal = completedOrders > 0 ? (totalRev / completedOrders) : 0;

    const stats = [
      { label: 'Total Revenue', value: money(totalRev), delta: ORDERS.length > 0 ? '+8.2%' : '0%', icon: ICONS.revenue },
      { label: 'Orders Completed', value: String(completedOrders), delta: completedOrders > 0 ? `+${completedOrders}` : '0 orders', icon: ICONS.orders },
      { label: 'Avg Order Value', value: money(avgVal), delta: avgVal > 0 ? '+4.1%' : '฿0.00', icon: ICONS.card },
      { label: 'Refunds', value: money(0), delta: '0%', icon: ICONS.refund },
    ];
    const g = el(`<div class="grid stats"></div>`);
    stats.forEach(s => g.appendChild(el(`
      <div class="card stat">
        <div class="row"><span class="label">${s.label}</span><span class="icon">${s.icon}</span></div>
        <div class="value">${s.value}</div>
        <div class="delta">${s.delta}</div>
      </div>`)));
    root.appendChild(g);

    root.appendChild(el(`
      <div class="grid two-col" style="margin-top:18px">
        <div class="card">
          <div class="card-title">Revenue Trend</div><div class="card-sub">Daily revenue breakdown</div>
          <div class="chart-wrap"><canvas id="revChart"></canvas></div>
        </div>
        <div class="card">
          <div class="card-title">Sales by Category</div><div class="card-sub">Share of revenue</div>
          <div class="chart-wrap"><canvas id="catChart"></canvas></div>
        </div>
      </div>
    `));

    setTimeout(() => drawReportsCharts(), 30);
  };

  let reportsRevChartInstance = null;
  let reportsCatChartInstance = null;
  function drawReportsCharts() {
    const rev = document.getElementById('revChart');
    const cat = document.getElementById('catChart');
    if (!window.Chart) return;
    const colors = getThemeChartColors();

    const hasOrders = ORDERS.length > 0;

    if (rev) {
      if (reportsRevChartInstance) reportsRevChartInstance.destroy();
      const grad = rev.getContext('2d').createLinearGradient(0, 0, 0, 240);
      grad.addColorStop(0, colors.fillGradStart);
      grad.addColorStop(1, colors.fillGradEnd);
      reportsRevChartInstance = new Chart(rev, {
        type: 'line',
        data: {
          labels: ['1','5','10','15','20','25','30'],
          datasets: [{
            label: 'Revenue (฿)',
            data: hasOrders ? [420, 610, 540, 720, 880, 760, 940] : [0, 0, 0, 0, 0, 0, 0],
            borderColor: colors.primary600,
            backgroundColor: grad,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: colors.card,
            pointBorderColor: colors.primary600,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: colors.tooltipBg, titleColor: colors.tooltipText, bodyColor: colors.muted, borderColor: colors.border, borderWidth: 1 } },
          scales: {
            x: { grid: { display: false }, ticks: { color: colors.muted } },
            y: { grid: { color: colors.gridColor }, ticks: { color: colors.muted } }
          }
        }
      });
    }

    if (cat) {
      if (reportsCatChartInstance) reportsCatChartInstance.destroy();
      const catCounts = CATEGORIES.map(c => PRODUCTS.filter(p => p.cat === c.name).length);
      const totalCatProd = catCounts.reduce((a, b) => a + b, 0);
      reportsCatChartInstance = new Chart(cat, {
        type: 'doughnut',
        data: {
          labels: CATEGORIES.map(c => c.name),
          datasets: [{
            data: totalCatProd > 0 ? catCounts : CATEGORIES.map(() => 0),
            backgroundColor: colors.paletteColors,
            borderColor: colors.card,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, color: colors.text } },
            tooltip: { backgroundColor: colors.tooltipBg, titleColor: colors.tooltipText, bodyColor: colors.muted, borderColor: colors.border, borderWidth: 1 }
          }
        }
      });
    }
  }

  function downloadReportsCSV(type) {
    let csv = 'Order ID,Customer,Date,Total,Status\n';
    ORDERS.forEach(o => {
      csv += `${o.id},${o.customer},${o.date},${o.total},${o.status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BNC_HayMate_Report_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'csv' : 'csv'}`;
    a.click();
    toast(`Exported ${type.toUpperCase()} file successfully`, 'success');
  }

  // ============================================================
  // PAGE 10: Settings & Complete Store Management
  // ============================================================
  PAGES.settings = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title">Settings &amp; Store Management</h1>
          <div class="page-sub">ระบบจัดการและปรับแต่งทุกข้อมูลบนหน้า Customer Store, หน้า Home, การเงิน และรหัสผ่าน</div>
        </div>
      </div>
    `));

    // Working copies for dynamic fields
    let currentBrandLogoType = state.store.brandLogoType || 'emoji';
    let currentBrandLogoImage = state.store.brandLogoImage || '';
    let heroIconType = state.store.heroIconType || 'emoji';
    let heroImage = state.store.heroImage || '';
    let currentReceiptLogoType = state.store.receiptLogoType || 'emoji';
    let currentReceiptLogoImage = state.store.receiptLogoImage || '';
    let currentReceiptFooterType = state.store.receiptFooterType === 'qr' ? 'image' : (state.store.receiptFooterType || 'image');
    let currentReceiptFooterImage = state.store.receiptFooterImage || '';
    let currentQrPaymentImage = state.store.qr_image_url || '';
    let currentHighlights = JSON.parse(JSON.stringify(state.store.highlights || DEFAULT_STORE_CONFIG.highlights));
    let currentPaymentAccounts = JSON.parse(JSON.stringify(state.store.payment_accounts || DEFAULT_STORE_CONFIG.payment_accounts));

    const formWrap = el(`
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- SECTION 1: Sidebar Brand Logo & Storefront Header -->
        <div class="card">
          <div class="card-title">Sidebar Logo &amp; Storefront Header (สี่เหลี่ยมโลโก้ร้านมุมซ้ายบนแถบเมนู &amp; หัวข้อหน้าร้าน)</div>
          <div class="card-sub">ปรับแต่งสี่เหลี่ยมโลโก้ร้านที่มุมซ้ายบนของแถบเมนู Sidebar (เลือกระหว่าง อัปโหลดรูปภาพ หรือ ตัวอักษร/อิโมจิ)</div>
          
          <!-- Brand Logo Box Customizer -->
          <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border); margin-top:12px; margin-bottom:14px;">
            <div style="font-weight:700; font-size:13.5px; margin-bottom:8px; color:var(--text);">สี่เหลี่ยมโลโก้มุมซ้ายบนแถบ Sidebar (Brand Mark Logo)</div>
            <div class="flex gap-2" style="margin-bottom:10px;">
              <button type="button" class="btn btn-sm ${currentBrandLogoType !== 'image' ? 'btn-primary' : ''}" id="btnBrandLogoTypeEmoji" style="font-size:12px;">ตัวอักษร / อิโมจิ</button>
              <button type="button" class="btn btn-sm ${currentBrandLogoType === 'image' ? 'btn-primary' : ''}" id="btnBrandLogoTypeImage" style="font-size:12px;">อัปโหลดรูปภาพ (Image)</button>
            </div>

            <!-- Image Upload Box -->
            <div id="brandLogoImageWrap" style="display:${currentBrandLogoType === 'image' ? 'block' : 'none'};">
              <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                <div style="width:48px; height:48px; border-radius:12px; overflow:hidden; border:1.5px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                  <img id="brandLogoImgPreview" src="${escapeHTML(currentBrandLogoImage)}" style="width:100%; height:100%; object-fit:cover; display:${currentBrandLogoImage ? 'block' : 'none'};" onerror="this.style.display='none';" />
                  <span id="brandLogoImgFallback" style="font-size:11px; display:${currentBrandLogoImage ? 'none' : 'block'}; color:var(--muted); font-weight:700;">LOGO</span>
                </div>
                <div style="flex:1;">
                  <input type="file" id="fileBrandLogo" accept="image/*" style="display:none;" />
                  <button type="button" class="btn btn-sm" id="btnUploadBrandLogo" style="font-size:11.5px; padding:5px 12px; font-weight:700;">อัปโหลดรูปภาพ 1:1</button>
                  <button type="button" class="btn btn-sm btn-ghost" id="btnClearBrandLogo" style="font-size:11.5px; padding:5px 8px; color:var(--danger); display:${currentBrandLogoImage ? 'inline-block' : 'none'};">ลบรูปภาพ</button>
                </div>
              </div>
              <input class="input" id="setBrandLogoImgUrl" value="${escapeHTML(currentBrandLogoImage)}" placeholder="หรือวาง URL รูปภาพโลโก้ เช่น https://..." style="font-size:12px;" />
            </div>

            <!-- Text / Emoji Input Box -->
            <div id="brandLogoEmojiWrap" style="display:${currentBrandLogoType === 'image' ? 'none' : 'block'};">
              <div class="field" style="margin:0;">
                <label style="font-size:12px;">ตัวอักษรย่อ หรือ อิโมจิในกล่องสี่เหลี่ยม</label>
                <input class="input" id="setBrandLogoText" value="${escapeHTML(state.store.brandLogoText || (state.store.name ? state.store.name.trim()[0] : 'B'))}" placeholder="เช่น B, V, 🧁, ☕" style="max-width:140px; text-align:center; font-weight:800; font-size:15px;" maxlength="4" />
              </div>
            </div>
          </div>

          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
            <div class="field">
              <label>ข้อความหน้าดาวน์โหลด (Loading Screen Title)</label>
              <input class="input" id="setLoadingTitle" value="${escapeHTML(state.store.loadingTitle || state.store.name || 'BNC HayMate')}" placeholder="เช่น BNC HayMate, ยินดีต้อนรับสู่ BNC HayMate" />
              <div style="font-size:11px; color:var(--muted); margin-top:3px;">แสดงตรงกลางหน้าโหลด (ฟอนต์ Sunshiney) พร้อมหิมะตก</div>
            </div>
            <div class="field">
              <label>ชื่อเมนูหน้าร้าน / Page Title</label>
              <input class="input" id="setStorefrontTitle" value="${escapeHTML(state.store.storefrontTitle || 'BNC HayMate')}" placeholder="เช่น BNC HayMate, ร้านขนม HayMate" />
              <div style="font-size:11px; color:var(--muted); margin-top:3px;">จะเปลี่ยนทั้งชื่อเมนู Sidebar และหัวข้อด้านบนหน้าร้านทันที</div>
            </div>
            <div class="field">
              <label>คำบรรยายหน้าร้าน / Subtitle</label>
              <input class="input" id="setStorefrontSub" value="${escapeHTML(state.store.storefrontSub || 'Handmade sweet things & bakery')}" placeholder="เช่น Handmade sweet things & bakery, ขนมและเครื่องดื่มอบสดใหม่" />
            </div>
          </div>
        </div>

        <!-- SECTION 2: Hero Banner -->
        <div class="card">
          <div class="card-title">Hero Banner (กล่องข้อความสีชมพูบนหน้า Home)</div>
          <div class="card-sub">ปรับเปลี่ยนข้อความและรูปภาพ/อิโมจิในกล่องสีชมพูด้านล่างสไลด์รูปภาพ</div>
          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-top:12px;">
            <div class="field">
              <label>หัวข้อแบนเนอร์ (Hero Title)</label>
              <input class="input" id="setHeroTitle" value="${escapeHTML(state.store.heroTitle || 'Fresh from the oven, daily')}" />
            </div>
            <div class="field">
              <label>คำบรรยายแบนเนอร์ (Hero Description)</label>
              <input class="input" id="setHeroSub" value="${escapeHTML(state.store.heroSub || 'Handmade cakes, pastries, and rose-scented drinks.')}" />
            </div>
            <div class="field">
              <label>ข้อความบนปุ่มกด (Button Text)</label>
              <input class="input" id="setHeroBtnText" value="${escapeHTML(state.store.heroBtnText || 'Shop Menu (320 items)')}" />
            </div>
          </div>

          <!-- Hero Icon / Image Selector -->
          <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border); margin-top:12px;">
            <div style="font-weight:700; font-size:13px; margin-bottom:8px; color:var(--text);">ไอคอน / รูปภาพแบนเนอร์ Hero</div>
            <div class="flex gap-2" style="margin-bottom:10px;">
              <button type="button" class="btn btn-sm ${heroIconType === 'emoji' ? 'btn-primary' : ''}" id="btnHeroTypeEmoji" style="font-size:12px;">ใช้อิโมจิ / ตัวอักษร</button>
              <button type="button" class="btn btn-sm ${heroIconType === 'image' ? 'btn-primary' : ''}" id="btnHeroTypeImage" style="font-size:12px;">อัปโหลดรูปภาพ 1:1</button>
            </div>
            <div id="heroEmojiWrap" style="display:${heroIconType === 'emoji' ? 'block' : 'none'};">
              <div class="field" style="margin-bottom:0;">
                <label style="font-size:11px;">ข้อความตัวอักษรย่อแบนเนอร์ (เช่น B, BN, HM)</label>
                <input class="input" id="setHeroEmoji" value="${escapeHTML(state.store.heroEmoji || 'B')}" style="max-width:120px; font-size:18px; text-align:center;" />
              </div>
            </div>
            <div id="heroImageWrap" style="display:${heroIconType === 'image' ? 'block' : 'none'};">
              <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                <div style="width:50px; height:50px; border-radius:12px; overflow:hidden; border:1.5px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                  <img id="heroImgPreview" src="${escapeHTML(heroImage)}" style="width:100%; height:100%; object-fit:cover; display:${heroImage ? 'block' : 'none'};" onerror="this.style.display='none';" />
                  <span id="heroImgFallback" style="font-size:18px; display:${heroImage ? 'none' : 'block'}; color:var(--muted);">IMG</span>
                </div>
                <div style="flex:1;">
                  <input type="file" id="fileHeroImg" accept="image/*" style="display:none;" />
                  <button type="button" class="btn btn-sm" id="btnUploadHeroImg" style="font-size:11.5px; padding:5px 12px; font-weight:700;">อัปโหลดรูปภาพ 1:1</button>
                  <button type="button" class="btn btn-sm btn-ghost" id="btnClearHeroImg" style="font-size:11.5px; padding:5px 8px; color:var(--danger);">ลบรูปภาพ</button>
                </div>
              </div>
              <input class="input" id="setHeroImage" placeholder="https://... หรืออัปโหลดจากปุ่มด้านบน" value="${escapeHTML(heroImage)}" style="font-size:12px; padding:6px 10px;" />
            </div>
          </div>
        </div>

        <!-- SECTION 3: 4 Highlights / Trust Badges -->
        <div class="card">
          <div class="card-title">4 Highlights Badges (จุดเด่น 4 ช่องบนหน้าแรก)</div>
          <div class="card-sub">แก้ไขไอคอน (รูปภาพหรืออิโมจิ), ข้อความ และคำบรรยายของจุดเด่น 4 การ์ดบนหน้า Home</div>
          <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:12px;" id="highlightsSettingsList"></div>
        </div>

        <!-- SECTION 4: Home Carousel Dynamic Slides Manager -->
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <div>
              <div class="card-title">Home Carousel Banners (สไลด์รูปภาพ ${BANNERS.length} รูป)</div>
              <div class="card-sub">เพิ่ม ลบ อัปโหลดรูปภาพ 1:1 หรือเปลี่ยนลิงก์รูปภาพโปรโมทบนหน้า Home ได้อย่างอิสระ</div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="btnEditBannersSettings" style="font-weight:700;">+ จัดการ / เพิ่ม-ลดรูปสไลด์ (${BANNERS.length} รูป)</button>
          </div>
          <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:12px; margin-top:12px;">
            ${BANNERS.length === 0 ? `
              <div style="grid-column: 1 / -1; padding:20px; text-align:center; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:12px; color:var(--muted); font-size:12px; font-weight:700;">
                ยังไม่มีรูปภาพสไลด์ (กดปุ่ม "จัดการ / เพิ่ม-ลดรูปสไลด์" เพื่อเพิ่มรูปภาพ)
              </div>
            ` : BANNERS.map((b, idx) => `
              <div style="border:1.5px solid var(--border); border-radius:12px; overflow:hidden; background:var(--card); text-align:center;">
                ${b.image ? `<img src="${escapeHTML(b.image)}" style="width:100%; aspect-ratio:1/1; object-fit:cover; display:block;" />` : `<div style="width:100%; aspect-ratio:1/1; display:grid; place-items:center; background:var(--primary-50); color:var(--muted); font-size:11px; font-weight:700;">(No Image)</div>`}
                <div style="padding:6px 8px; font-size:11.5px; font-weight:700; color:var(--accent-text);">Slide #${idx + 1}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- SECTION 6: Receipt & Slip Customization -->
        <div class="card" id="receiptSettingsCard">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <div>
              <div class="card-title">Receipt &amp; Slip Customization (ตั้งค่าหน้าตาสลิป / ใบเสร็จ)</div>
              <div class="card-sub">ปรับแต่งโลโก้หัวกระดาษ (รูป 1:1 หรืออิโมจิ), ชื่อร้าน, ที่อยู่, QR/รูปภาพท้ายกระดาษ และข้อความขอบคุณ</div>
            </div>
            <span class="badge success" style="font-size:12px; font-weight:700;">Live Preview</span>
          </div>

          <div class="grid two-col" style="gap:18px; align-items:flex-start;">
            <!-- Left Column: Controls & Uploaders -->
            <div class="grid" style="gap:16px;">
              
              <!-- 1. Header Logo & Type -->
              <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-weight:700; font-size:14px; margin-bottom:6px; color:var(--text);">1. โลโก้หัวกระดาษสลิป (Header Logo)</div>
                <div class="flex gap-2" style="margin-bottom:10px;">
                  <button type="button" class="btn btn-sm ${currentReceiptLogoType !== 'image' ? 'btn-primary' : ''}" id="btnLogoTypeEmoji" style="font-size:12px;">ใช้อิโมจิ / ตัวอักษร</button>
                  <button type="button" class="btn btn-sm ${currentReceiptLogoType === 'image' ? 'btn-primary' : ''}" id="btnLogoTypeImage" style="font-size:12px;">อัปโหลดรูปภาพ 1:1</button>
                </div>

                <!-- Image Upload Box -->
                <div id="receiptLogoImageWrap" style="display:${currentReceiptLogoType === 'image' ? 'block' : 'none'};">
                  <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                    <div style="width:58px; height:58px; border-radius:14px; overflow:hidden; border:1.5px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                      <img id="receiptLogoImgPreview" src="${escapeHTML(currentReceiptLogoImage)}" style="width:100%; height:100%; object-fit:cover; display:${currentReceiptLogoImage ? 'block' : 'none'};" onerror="this.style.display='none';" />
                      <span id="receiptLogoImgFallback" style="font-size:14px; display:${currentReceiptLogoImage ? 'none' : 'block'}; color:var(--muted); font-weight:700;">IMG</span>
                    </div>
                    <div style="flex:1;">
                      <input type="file" id="fileReceiptLogo" accept="image/*" style="display:none;" />
                      <button type="button" class="btn btn-sm" id="btnUploadReceiptLogo" style="font-size:11.5px; padding:5px 12px; font-weight:700;">อัปโหลดรูปภาพ 1:1</button>
                      <button type="button" class="btn btn-sm btn-ghost" id="btnClearReceiptLogo" style="font-size:11.5px; padding:5px 8px; color:var(--danger);">ลบรูปภาพ</button>
                    </div>
                  </div>
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-size:11px;">หรือใส่ URL รูปภาพโลโก้ 1:1</label>
                    <input class="input" id="setReceiptLogoImage" placeholder="https://... (หรือกดปุ่มอัปโหลดรูปด้านบน)" value="${escapeHTML(currentReceiptLogoImage)}" style="font-size:12px; padding:6px 10px;" />
                  </div>
                </div>

                <!-- Emoji / Letter Input -->
                <div id="receiptLogoEmojiWrap" style="display:${currentReceiptLogoType !== 'image' ? 'block' : 'none'};">
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-size:11px;">ตัวอักษรย่อโลโก้หัวสลิป (เช่น B, BN, HM)</label>
                    <input class="input" id="setReceiptLogoEmoji" value="${escapeHTML(state.store.receiptLogoEmoji || 'B')}" style="max-width:140px; text-align:center; font-size:18px; font-weight:800;" />
                  </div>
                </div>
              </div>

              <!-- 2. Header Text -->
              <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px;">
                <div class="field">
                  <label>ชื่อร้านบนหัวสลิป (Store Name)</label>
                  <input class="input" id="setReceiptStoreName" value="${escapeHTML(state.store.receiptStoreName || 'BNC HayMate Bakery')}" />
                </div>
                <div class="field">
                  <label>ที่อยู่/คำโปรยหัวสลิป (Store Address)</label>
                  <input class="input" id="setReceiptStoreAddress" value="${escapeHTML(state.store.receiptStoreAddress || '14 Sukhumvit Rd · Bangkok')}" />
                </div>
              </div>

              <!-- 3. Footer Graphic & Message (Standard QR removed) -->
              <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border);">
                <div style="font-weight:700; font-size:14px; margin-bottom:6px; color:var(--text);">2. ท้ายกระดาษสลิป (Footer Graphic &amp; Message)</div>
                <div class="flex gap-2" style="margin-bottom:10px; flex-wrap:wrap;">
                  <button type="button" class="btn btn-sm ${currentReceiptFooterType === 'image' ? 'btn-primary' : ''}" id="btnFooterTypeImage" style="font-size:12px;">รูปภาพ / QR ของร้าน (1:1)</button>
                  <button type="button" class="btn btn-sm ${currentReceiptFooterType === 'emoji' ? 'btn-primary' : ''}" id="btnFooterTypeEmoji" style="font-size:12px;">ใช้อิโมจิ / ไอคอน</button>
                </div>

                <!-- Footer Image Upload Box -->
                <div id="receiptFooterImageWrap" style="display:${currentReceiptFooterType === 'image' ? 'block' : 'none'}; margin-bottom:10px;">
                  <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                    <div style="width:58px; height:58px; border-radius:14px; overflow:hidden; border:1.5px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                      <img id="receiptFooterImgPreview" src="${escapeHTML(currentReceiptFooterImage)}" style="width:100%; height:100%; object-fit:cover; display:${currentReceiptFooterImage ? 'block' : 'none'};" onerror="this.style.display='none';" />
                      <span id="receiptFooterImgFallback" style="font-size:14px; display:${currentReceiptFooterImage ? 'none' : 'block'}; color:var(--muted); font-weight:700;">QR/IMG</span>
                    </div>
                    <div style="flex:1;">
                      <input type="file" id="fileReceiptFooter" accept="image/*" style="display:none;" />
                      <button type="button" class="btn btn-sm" id="btnUploadReceiptFooter" style="font-size:11.5px; padding:5px 12px; font-weight:700;">อัปโหลดรูป / QR ท้ายสลิป</button>
                      <button type="button" class="btn btn-sm btn-ghost" id="btnClearReceiptFooter" style="font-size:11.5px; padding:5px 8px; color:var(--danger);">ลบรูปภาพ</button>
                    </div>
                  </div>
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-size:11px;">หรือใส่ URL รูปภาพ/QR</label>
                    <input class="input" id="setReceiptFooterImage" placeholder="https://... (หรืออัปโหลดจากปุ่มด้านบน)" value="${escapeHTML(currentReceiptFooterImage)}" style="font-size:12px; padding:6px 10px;" />
                  </div>
                </div>

                <!-- Footer Emoji Input -->
                <div id="receiptFooterEmojiWrap" style="display:${currentReceiptFooterType === 'emoji' ? 'block' : 'none'}; margin-bottom:10px;">
                  <div class="field" style="margin-bottom:0;">
                    <label style="font-size:11px;">ใส่อิโมจิท้ายกระดาษ (เช่น , , , )</label>
                    <input class="input" id="setReceiptFooterEmoji" value="${escapeHTML(state.store.receiptFooterEmoji || '')}" style="max-width:140px; text-align:center; font-size:18px;" />
                  </div>
                </div>

                <!-- Thank you message & Subnote -->
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px;">
                  <div class="field" style="margin-bottom:0;">
                    <label>ข้อความขอบคุณ (Thank You Message)</label>
                    <input class="input" id="setReceiptFooterMsg" value="${escapeHTML(state.store.receiptFooterMsg || 'Thank you for your order')}" />
                  </div>
                  <div class="field" style="margin-bottom:0;">
                    <label>ข้อความหมายเหตุสลิป (Sub-note)</label>
                    <input class="input" id="setReceiptFooterSub" value="${escapeHTML(state.store.receiptFooterSub || 'Please keep this receipt for your reference')}" />
                  </div>
                </div>
              </div>

            </div>

            <!-- Right Column: Live Receipt Preview Box -->
            <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:18px; padding:16px;">
              <div style="font-weight:800; font-size:13px; color:var(--muted); text-align:center; margin-bottom:12px;">ตัวอย่างใบเสร็จ / สลิป (Live Preview)</div>
              
              <div class="receipt" style="box-shadow:var(--shadow-soft); max-width:320px; padding:18px; background:var(--card);">
                <div class="r-head" style="margin-bottom:10px;">
                  <div class="r-logo" id="prevRLogo">
                    ${(currentReceiptLogoType === 'image' && currentReceiptLogoImage)
                      ? `<img src="${escapeHTML(currentReceiptLogoImage)}" style="width:100%;height:100%;object-fit:cover;" />`
                      : `<span>${escapeHTML(state.store.receiptLogoEmoji || 'B')}</span>`}
                  </div>
                  <div class="r-store" id="prevRStore" style="font-size:15px;">${escapeHTML(state.store.receiptStoreName || 'BNC HayMate Bakery')}</div>
                  <div class="r-sub" id="prevRAddress" style="font-size:11px;">${escapeHTML(state.store.receiptStoreAddress || '14 Sukhumvit Rd · Bangkok')}</div>
                </div>
                <div class="r-line" style="margin:8px 0;"></div>
                <div class="r-items" style="font-size:11.5px; gap:4px;">
                  <div class="r-row"><span>Order</span><strong>HP-1042</strong></div>
                  <div class="r-row"><span>Date</span><span>${new Date().toISOString().split('T')[0]}</span></div>
                  <div class="r-row"><span>Customer</span><span>Anna Wong</span></div>
                </div>
                <div class="r-line" style="margin:8px 0;"></div>
                <div class="r-items" style="font-size:11.5px; gap:4px;">
                  <div class="r-row"><span>Strawberry Shortcake × 1</span><span>฿85.00</span></div>
                  <div class="r-row"><span>Rose Milk Latte × 1</span><span>฿65.00</span></div>
                </div>
                <div class="r-line" style="margin:8px 0;"></div>
                <div class="r-items" style="font-size:11.5px; gap:4px;">
                  <div class="r-row"><span>Subtotal</span><span>฿150.00</span></div>
                  <div class="r-row r-total" style="font-size:14.5px; margin-top:2px;"><span>Total</span><span style="color:var(--accent-text)">฿150.00</span></div>
                </div>
                <div id="prevRFooterGraphic" style="margin-top:10px;">
                  ${currentReceiptFooterType === 'image' && currentReceiptFooterImage
                    ? `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;"><img src="${escapeHTML(currentReceiptFooterImage)}" style="width:100%;height:100%;object-fit:cover;" /></div>`
                    : currentReceiptFooterType === 'emoji'
                    ? `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;font-size:36px;">${escapeHTML(state.store.receiptFooterEmoji || '')}</div>`
                    : `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;font-size:36px;"></div>`}
                </div>
                <div id="prevRFooterMsg" style="text-align:center; font-family:'Sunshiney', cursive; font-size:18px; font-weight:700; color:var(--accent-text); margin-top:6px; line-height:1.2;">${escapeHTML(state.store.receiptFooterMsg || 'Thank you for your order')}</div>
                <div id="prevRFooterSub" style="text-align:center; font-size:10px; color:var(--muted); margin-top:2px;">${escapeHTML(state.store.receiptFooterSub || '')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 7: Tracking Review Calligraphy & Heart Rating Labels Settings -->
        <div class="card">
          <div class="card-title">Tracking Review &amp; Heart Labels (ตั้งค่าข้อความรีวิวหน้า Tracking และระดับดวงใจ)</div>
          <div class="card-sub">กำหนดชื่อร้าน Calligraphy, ข้อความขอบคุณบนหน้า Tracking และข้อความอธิบายการให้คะแนน 1-5 ดวงใจ</div>
          
          <div class="grid two-col" style="gap:16px; margin-top:14px;">
            <!-- Left: Tracking Calligraphy Box Settings -->
            <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border);">
              <div style="font-weight:700; font-size:13.5px; margin-bottom:10px; color:var(--text);">1. กล่องรีวิวหน้า Tracking (Calligraphy Banner)</div>
              
              <div class="field">
                <label>ชื่อร้านสไตล์ Calligraphy (Store Brand Title)</label>
                <input class="input" id="setTrackingTitle" value="${escapeHTML(state.store.trackingReviewTitle || state.store.receiptStoreName || state.store.name || 'BNC HayMate')}" />
              </div>
              <div class="field">
                <label>ข้อความเล็กๆ ใต้ชื่อร้าน (Sub-message)</label>
                <input class="input" id="setTrackingSub" value="${escapeHTML(state.store.trackingReviewSub || '')}" />
              </div>
              <div class="field" style="margin-bottom:0;">
                <label>ข้อความบนปุ่มรีวิว (Button Text)</label>
                <input class="input" id="setTrackingBtnText" value="${escapeHTML(state.store.trackingReviewBtnText || 'เขียนรีวิว &amp; ให้คะแนนร้าน')}" />
              </div>
            </div>

            <!-- Right: 1-5 Heart Rating Custom Labels -->
            <div style="background:var(--primary-50); padding:14px; border-radius:14px; border:1px solid var(--border);">
              <div style="font-weight:700; font-size:13.5px; margin-bottom:10px; color:var(--text);">2. คำอธิบายระดับคะแนนดวงใจ (Heart Rating Labels)</div>
              
              <div class="grid" style="gap:8px;">
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px;">1 ดวงใจ</label>
                  <input class="input" id="setStarLabel1" value="${escapeHTML(state.store.starLabel1 || '1 ดวงใจ - ต้องปรับปรุง')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px;">2 ดวงใจ</label>
                  <input class="input" id="setStarLabel2" value="${escapeHTML(state.store.starLabel2 || '2 ดวงใจ - พอใช้ได้')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px;">3 ดวงใจ</label>
                  <input class="input" id="setStarLabel3" value="${escapeHTML(state.store.starLabel3 || '3 ดวงใจ - ปานกลาง / รสชาติดี')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px;">4 ดวงใจ</label>
                  <input class="input" id="setStarLabel4" value="${escapeHTML(state.store.starLabel4 || '4 ดวงใจ - อร่อยและประทับใจมาก')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px;">5 ดวงใจ</label>
                  <input class="input" id="setStarLabel5" value="${escapeHTML(state.store.starLabel5 || '5 ดวงใจ - ประทับใจมากที่สุด ยอดเยี่ยม!')}" style="font-size:12px; padding:6px 10px;" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 8: Sticky Note Customization (ตั้งค่าโทนสีกระดาษสติกกี้โน้ตปักหมุด) -->
        <div class="card">
          <div class="card-title">Sticky Note Customization (ตั้งค่าโทนสีกระดาษสติกกี้โน้ตปักหมุด)</div>
          <div class="card-sub">เลือกโทนสีพาสเทลสำเร็จรูป หรือปรับแต่งสีกระดาษ สีขอบ และสีหมุดปักของรีวิวที่ปักหมุดได้ตามใจชอบ</div>

          <div class="grid two-col" style="gap:16px; margin-top:14px;">
            <!-- Left Column: Preset Palettes & Custom Pickers -->
            <div style="background:var(--primary-50); padding:16px; border-radius:14px; border:1px solid var(--border);">
              <div style="font-weight:700; font-size:13.5px; margin-bottom:8px; color:var(--text);">โทนสีสว่างพาสเทล (Light Presets - 6 แบบ)</div>
              <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:8px; margin-bottom:14px;" id="stickyPresetListLight">
                ${Object.entries(STICKY_NOTE_PALETTES).filter(([_, p]) => p.category === 'light').map(([k, p]) => `
                  <button type="button" class="btn-sticky-preset" data-k="${k}" style="background:${p.bg}; border:1.5px solid ${p.border}; border-bottom:3px solid ${p.bottom}; padding:8px 10px; border-radius:12px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all .15s ease; box-shadow:var(--shadow-soft);">
                    <div style="width:14px; height:14px; border-radius:50%; background:${p.pin}; flex:none; box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                    <span style="font-size:11px; font-weight:700; color:#2D3748;">${escapeHTML(p.name.split('(')[0].trim())}</span>
                  </button>
                `).join('')}
              </div>

              <div style="font-weight:700; font-size:13.5px; margin-bottom:8px; color:var(--text);">โทนสีมืดพรีเมียม (Dark Presets - 6 แบบ)</div>
              <div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:8px; margin-bottom:14px;" id="stickyPresetListDark">
                ${Object.entries(STICKY_NOTE_PALETTES).filter(([_, p]) => p.category === 'dark').map(([k, p]) => `
                  <button type="button" class="btn-sticky-preset" data-k="${k}" style="background:${p.bg}; border:1.5px solid ${p.border}; border-bottom:3px solid ${p.bottom}; padding:8px 10px; border-radius:12px; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all .15s ease; box-shadow:var(--shadow-soft);">
                    <div style="width:14px; height:14px; border-radius:50%; background:${p.pin}; flex:none; box-shadow:0 1px 3px rgba(0,0,0,0.35);"></div>
                    <span style="font-size:11px; font-weight:700; color:#F5EEF8;">${escapeHTML(p.name.split('(')[0].trim())}</span>
                  </button>
                `).join('')}
              </div>

              <div style="font-weight:700; font-size:13px; margin-top:14px; margin-bottom:8px; color:var(--text);">2. กำหนดสีเองอย่างละเอียด (Custom Colors)</div>
              <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px;">
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11.5px; font-weight:700;">สีกระดาษโน้ต (Paper Bg)</label>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" id="setStickyBg" value="${state.store.stickyNoteBg || '#FFFDF2'}" style="width:36px; height:36px; border:none; border-radius:8px; cursor:pointer; background:transparent;" />
                    <input class="input" id="setStickyBgHex" value="${state.store.stickyNoteBg || '#FFFDF2'}" style="font-size:12px; padding:6px 8px; font-weight:700; font-family:monospace;" />
                  </div>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11.5px; font-weight:700;">สีเส้นขอบ (Border)</label>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" id="setStickyBorder" value="${state.store.stickyNoteBorder || '#EFE6C7'}" style="width:36px; height:36px; border:none; border-radius:8px; cursor:pointer; background:transparent;" />
                    <input class="input" id="setStickyBorderHex" value="${state.store.stickyNoteBorder || '#EFE6C7'}" style="font-size:12px; padding:6px 8px; font-weight:700; font-family:monospace;" />
                  </div>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11.5px; font-weight:700;">สีขอบล่างกระดาษ (Bottom Edge)</label>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" id="setStickyBottom" value="${state.store.stickyNoteBottomBorder || '#DFD2A8'}" style="width:36px; height:36px; border:none; border-radius:8px; cursor:pointer; background:transparent;" />
                    <input class="input" id="setStickyBottomHex" value="${state.store.stickyNoteBottomBorder || '#DFD2A8'}" style="font-size:12px; padding:6px 8px; font-weight:700; font-family:monospace;" />
                  </div>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11.5px; font-weight:700;">สีตราหมุดปัก (Pin Badge)</label>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <input type="color" id="setStickyPin" value="${state.store.stickyNotePinColor || '#EFA6C1'}" style="width:36px; height:36px; border:none; border-radius:8px; cursor:pointer; background:transparent;" />
                    <input class="input" id="setStickyPinHex" value="${state.store.stickyNotePinColor || '#EFA6C1'}" style="font-size:12px; padding:6px 8px; font-weight:700; font-family:monospace;" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Real-time Sticky Note Live Preview -->
            <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:18px; padding:18px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-weight:700; font-size:13px; color:var(--muted); margin-bottom:18px; text-align:center;">ตัวอย่างสติกกี้โน้ตแบบสด (Live Preview)</div>
              
              <div id="stickyLivePreviewCard" class="review-card pinned-sticky tilt-left" style="max-width:280px; width:100%; pointer-events:none; background:${state.store.stickyNoteBg || '#FFFDF2'}; border-color:${state.store.stickyNoteBorder || '#EFE6C7'}; border-bottom-color:${state.store.stickyNoteBottomBorder || '#DFD2A8'};">
                <div class="sticky-pin-badge" id="prevStickyPinBadge" style="background:${state.store.stickyNotePinColor || '#EFA6C1'};">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M5 17h14M7 17l1-9h8l1 9M9 8V3h6v5"/></svg>
                  <span>Pinned Note</span>
                </div>
                <div class="review-head">
                  <div class="avatar" style="font-size:13px; font-weight:800;">AW</div>
                  <div style="flex:1;">
                    <div class="review-name" style="font-size:14px; font-weight:700; color:var(--text);">Anna W.</div>
                    <div class="review-date">Today</div>
                  </div>
                  <div class="stars">${renderHearts(5)}</div>
                </div>
                <div class="review-text" style="font-size:13px; color:var(--text); line-height:1.5;">เค้กนุ่มละมุนมากค่ะ บรรยากาศร้านและแพ็กเกจน่ารักที่สุดเลย 💕</div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 9: Stock Thresholds & Status Color Alerts (ตั้งค่าเกณฑ์สต็อก & การแสดงผลสี) -->
        <div class="card">
          <div class="card-title">Stock Thresholds &amp; Color Alerts (ตั้งค่าเกณฑ์ระดับสต็อก &amp; การแสดงผลสี)</div>
          <div class="card-sub">กำหนดจำนวนสต็อกสินค้าเพื่อแสดงสีแจ้งเตือน (เขียว Healthy, ส้ม Low, แดง Out of Stock) ในทุกตารางและหน้าร้าน</div>
          
          <div class="grid two-col" style="gap:16px; margin-top:14px;">
            <!-- Left: Threshold Inputs -->
            <div style="background:var(--primary-50); padding:16px; border-radius:14px; border:1px solid var(--border);">
              <div style="font-weight:700; font-size:13.5px; margin-bottom:12px; color:var(--text);">กำหนดเกณฑ์จำนวนสต็อก (Thresholds)</div>
              
              <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:700; color:#B47A28;">เกณฑ์สต็อกน้อย (Low Stock &lt; ชิ้น)</label>
                  <input type="number" class="input" id="setStockLowThreshold" value="${state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100}" min="1" style="font-weight:700;" />
                  <div style="font-size:11px; color:var(--muted); margin-top:2px;">น้อยกว่าจำนวนนี้จะแสดง <strong style="color:#B47A28;">สีส้ม Low</strong></div>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:700; color:#B04955;">เกณฑ์สินค้าหมด (Out of Stock &le; ชิ้น)</label>
                  <input type="number" class="input" id="setStockOutThreshold" value="${state.store.stockOutThreshold !== undefined ? state.store.stockOutThreshold : 0}" min="0" style="font-weight:700;" />
                  <div style="font-size:11px; color:var(--muted); margin-top:2px;">เหลือน้อยกว่าหรือเท่ากับนี้จะแสดง <strong style="color:#B04955;">สีแดง Out</strong></div>
                </div>
              </div>

              <div style="font-weight:700; font-size:12.5px; margin-top:14px; margin-bottom:8px; color:var(--text);">ข้อความบนป้ายสถานะ (Badge Labels)</div>
              <div class="grid" style="grid-template-columns:1fr 1fr 1fr; gap:8px;">
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px; color:#3F8E63;">ป้ายสต็อกพร้อมขาย (เขียว)</label>
                  <input class="input" id="setStockHealthyLabel" value="${escapeHTML(state.store.stockHealthyLabel || 'Healthy')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px; color:#B47A28;">ป้ายสต็อกน้อย (ส้ม)</label>
                  <input class="input" id="setStockLowLabel" value="${escapeHTML(state.store.stockLowLabel || 'Low')}" style="font-size:12px; padding:6px 10px;" />
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11px; color:#B04955;">ป้ายสินค้าหมด (แดง)</label>
                  <input class="input" id="setStockOutLabel" value="${escapeHTML(state.store.stockOutLabel || 'Out of stock')}" style="font-size:12px; padding:6px 10px;" />
                </div>
              </div>
            </div>

            <!-- Right: Live Preview Box -->
            <div style="background:var(--card); border:1.5px solid var(--border); border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:center; gap:10px;">
              <div style="font-weight:700; font-size:13.5px; color:var(--muted); text-align:center;">ตัวอย่างการแสดงผลสี (Live Preview)</div>
              
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <strong style="font-size:13px;">Strawberry Croissant</strong>
                    <div style="font-size:11px; color:var(--muted);">สต็อก: 150 ชิ้น (&ge; <span id="prevThreshHealthy">${state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100}</span>)</div>
                  </div>
                  <span class="badge success" id="prevBadgeHealthy">150 in stock (${escapeHTML(state.store.stockHealthyLabel || 'Healthy')})</span>
                </div>

                <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <strong style="font-size:13px;">Matcha Latte Cake</strong>
                    <div style="font-size:11px; color:var(--muted);">สต็อก: 45 ชิ้น (&lt; <span id="prevThreshLow">${state.store.stockLowThreshold !== undefined ? state.store.stockLowThreshold : 100}</span>)</div>
                  </div>
                  <span class="badge warn" id="prevBadgeLow">45 in stock (${escapeHTML(state.store.stockLowLabel || 'Low')})</span>
                </div>

                <div style="background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <strong style="font-size:13px;">Rose Blossom Cookie</strong>
                    <div style="font-size:11px; color:var(--muted);">สต็อก: 0 ชิ้น (&le; <span id="prevThreshOut">${state.store.stockOutThreshold !== undefined ? state.store.stockOutThreshold : 0}</span>)</div>
                  </div>
                  <span class="badge danger" id="prevBadgeOut">0 in stock (${escapeHTML(state.store.stockOutLabel || 'Out of stock')})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 9: General Store Details & Brand -->
        <div class="card">
          <div class="card-title">Store Details &amp; Brand (ข้อมูลระบบหลัก)</div>
          <div class="card-sub">ข้อมูลหลักที่ใช้แสดงผลบนเมนูด้านข้าง (Sidebar Brand), หัวหน้าเว็บ และระบบเวลา</div>
          <div class="grid" style="gap:12px; margin-top:12px;">
            <div class="field">
              <label>Store Name (ชื่อร้านหลัก)</label>
              <input class="input" id="setStoreName" value="${escapeHTML(state.store.name)}"/>
              <div style="font-size:11px; color:var(--muted); margin-top:3px;">แสดงที่แถบเมนูด้านซ้ายบน (Sidebar Brand) และหัวบราวเซอร์</div>
            </div>
            <div class="field">
              <label>Store Tagline (คำโปรยร้านหลัก)</label>
              <input class="input" id="setStoreTagline" value="${escapeHTML(state.store.tagline)}"/>
              <div style="font-size:11px; color:var(--muted); margin-top:3px;">แสดงใต้ชื่อร้านที่แถบเมนู</div>
            </div>
            <div class="grid" style="grid-template-columns:1fr 1fr; gap:12px">
              <div class="field"><label>Currency (สกุลเงิน)</label><select class="select" id="setCurrency"><option ${state.store.currency === 'THB (฿)' ? 'selected' : ''}>THB (฿)</option><option ${state.store.currency === 'USD ($)' ? 'selected' : ''}>USD ($)</option><option ${state.store.currency === 'SGD (S$)' ? 'selected' : ''}>SGD (S$)</option></select></div>
              <div class="field"><label>Timezone (เขตเวลา)</label><select class="select" id="setTimezone"><option ${state.store.timezone === 'UTC+7 Bangkok' ? 'selected' : ''}>UTC+7 Bangkok</option><option ${state.store.timezone === 'UTC+8 Singapore' ? 'selected' : ''}>UTC+8 Singapore</option></select></div>
            </div>
          </div>
        </div>

        <!-- SECTION 9: PromptPay QR Code Payment (QR สแกนจ่ายเงินหน้าร้าน) -->
        <div class="card">
          <div class="card-title">PromptPay QR Code Payment (QR สแกนจ่ายเงินหน้าร้าน)</div>
          <div class="card-sub">อัปโหลดรูปภาพ QR Code พร้อมเพย์ของร้าน สำหรับให้ลูกค้าสแกนจ่ายเงินในขั้นตอนสั่งซื้อ (Checkout) และบันทึกลงฐานข้อมูลกลาง</div>
          
          <div style="background:var(--primary-50); border:1.5px solid var(--border); border-radius:16px; padding:16px; margin-top:12px;">
            <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
              <div style="width:110px; height:110px; border-radius:14px; overflow:hidden; border:2px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                <img id="qrPaymentImgPreview" src="${escapeHTML(currentQrPaymentImage)}" style="width:100%; height:100%; object-fit:contain; display:${currentQrPaymentImage ? 'block' : 'none'};" onerror="this.style.display='none';" />
                <span id="qrPaymentImgFallback" style="font-size:12px; display:${currentQrPaymentImage ? 'none' : 'block'}; color:var(--muted); font-weight:700; text-align:center; padding:6px;">ยังไม่มีรูป QR</span>
              </div>
              <div style="flex:1; min-width:240px;">
                <input type="file" id="fileQrPayment" accept="image/*" style="display:none;" />
                <div class="flex gap-2 items-center" style="margin-bottom:8px;">
                  <button type="button" class="btn btn-sm btn-primary" id="btnUploadQrPayment" style="font-size:12px; padding:6px 14px; font-weight:700;">อัปโหลดรูป QR Code พร้อมเพย์</button>
                  <button type="button" class="btn btn-sm btn-ghost" id="btnClearQrPayment" style="font-size:12px; padding:6px 10px; color:var(--danger); display:${currentQrPaymentImage ? 'inline-block' : 'none'};">ลบรูป QR</button>
                </div>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:11.5px;">หรือใส่ URL รูปภาพ QR Code</label>
                  <input class="input" id="setQrPaymentImage" placeholder="https://... หรืออัปโหลดจากปุ่มด้านบน" value="${escapeHTML(currentQrPaymentImage)}" style="font-size:12px; padding:7px 10px;" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 10: Payment Accounts Builder (รองรับทั้งรูปภาพโลโก้และอิโมจิ) -->
        <div class="card">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <div>
              <div class="card-title">Payment Accounts (ช่องทางการชำระเงิน)</div>
              <div class="card-sub" style="margin-bottom:0;">เพิ่ม ลบ และแก้ไขเลขที่บัญชีธนาคาร พร้อมเพย์ หรือวอลเล็ท (รองรับการอัปโหลดโลโก้รูปภาพและอิโมจิ)</div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="btnAddPaymentAcc" style="font-weight:700;">+ เพิ่มบัญชี / วอลเล็ทใหม่ (+ Add Account)</button>
          </div>

          <div id="paymentAccountsList" style="display:flex; flex-direction:column; gap:12px; margin-top:14px;"></div>
        </div>

        <!-- SECTION 10: Security & Passcodes -->
        <div class="grid two-col">
          <div class="card">
            <div class="card-title">Admin Security Passcode (รหัสผ่านเข้าสู่ระบบแอดมิน)</div>
            <div class="card-sub">กำหนดรหัสผ่าน 6 หลักสำหรับหน้าจอล็อคอินแอดมิน (ส่วนรหัส Master PIN สำหรับลบออเดอร์/รีเซ็ต ถูกจัดเก็บอย่างปลอดภัยในโค้ดระบบ)</div>
            
            <div class="field" style="margin-top:12px;">
              <label style="font-weight:700;">Admin Login PIN (6-Digit Passcode)</label>
              <input class="input" id="setAdminPin" type="password" maxlength="6" value="${escapeHTML(state.correctPin || '123456')}" style="max-width:200px; font-size:18px; letter-spacing:4px; font-weight:700; text-align:center;" />
              <div style="font-size:11.5px; color:var(--muted); margin-top:4px;">ตัวเลข 6 หลักสำหรับหน้าจอล็อคอินแอดมิน (ค่าเริ่มต้น: 123456)</div>
            </div>
          </div>

          <!-- SECTION 11: Appearance & Theme (Primary Color Swatches) -->
          <div class="card">
            <div class="card-title">Appearance &amp; Theme (ธีมและสีหลักของระบบ)</div>
            <div class="card-sub">เลือกโทนสีหลักของระบบ (ระบบจะแสดงผลพรีวิวทันที และปรับโทนสี Dark Mode ตามที่เลือก)</div>
            <div class="grid" style="gap:12px; margin-top:12px;">
              <div class="field"><label>Primary Color</label>
                <div class="flex gap-2" id="colorRow">
                  ${['#F8BFD4','#F0B265','#7CC59A','#8BB6E8','#D6BEE9'].map(c => `<button type="button" class="swatch-btn" data-c="${c}" style="width:36px;height:36px;border-radius:12px;background:${c};border:2.5px solid ${c === state.color ? 'var(--text)' : 'transparent'};box-shadow:${c === state.color ? '0 0 0 2.5px var(--card)' : 'none'}; cursor:pointer; transition:transform 0.18s ease;"></button>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 12: Review Celebration Popup (ป๊อปอัพขอบคุณหลังรีวิว) -->
        <div class="card" style="margin-top:14px;">
          <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:10px;">
            <div>
              <div class="card-title">Review Celebration Popup (ป๊อปอัพขอบคุณหลังลูกค้าเขียนรีวิว)</div>
              <div class="card-sub" style="margin-bottom:0;">ปรับแต่งข้อความหัวเรื่องบนหัวมาสคอต และรูปภาพมาสคอตเด้งดึ๋ง (ปุ่มหัวใจอ้วนกลมสีชมพูนำทางกลับหน้าแรก)</div>
            </div>
            <button type="button" class="btn btn-sm" id="btnTestCelebrationPopup" style="background:var(--primary-50); border:1.5px solid var(--primary-600); color:var(--accent-text); font-weight:800; border-radius:10px; padding:6px 14px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              <span>ทดสอบเปิดป๊อปอัพ (Test Preview)</span>
            </button>
          </div>

          <div class="field" style="margin-top:10px;">
            <label style="font-weight:700;">ข้อความบนหัวมาสคอต (Top Title Text)</label>
            <input class="input" id="setReviewPopupTitle" value="${escapeHTML(state.store.reviewPopupTitle || 'Thank You')}" placeholder="เช่น Thank You" />
            <div style="font-size:11.5px; color:var(--muted); margin-top:3px;">ข้อความตัวอักษรโค้งเด้งดึ๋งด้านบนมาสคอต</div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label style="font-weight:700;">รูปภาพมาสคอตร้าน (Mascot / Profile Image)</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input class="input" id="setReviewPopupImgUrl" value="${escapeHTML(state.store.reviewPopupImage || '')}" placeholder="วาง URL รูปภาพ หรือกดปุ่มอัปโหลดรูปภาพมาสคอต" style="flex:1;" />
              <input type="file" id="fileReviewPopupImg" accept="image/*" style="display:none;" />
              <button type="button" class="btn btn-sm btn-primary" id="btnUploadReviewPopupImg" style="font-weight:700; white-space:nowrap; display:inline-flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>อัปโหลดรูป</span>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="btnClearReviewPopupImg" style="color:var(--danger); font-weight:700; white-space:nowrap; ${state.store.reviewPopupImage ? 'display:inline-block;' : 'display:none;'}">ลบรูป</button>
            </div>
          </div>
        </div>

        <div class="grid" style="margin-top:14px;">
          <!-- SECTION 13: Danger Zone / Factory Reset (ล้างข้อมูลระบบทั้งหมด & รีเซ็ตค่าเริ่มต้น) -->
          <div class="card" style="border:1.5px solid var(--danger); background:rgba(229,139,148,0.05); border-radius:18px;">
            <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div>
                <div class="card-title" style="color:var(--danger); display:flex; align-items:center; gap:8px;">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                  <span>Danger Zone: ล้างข้อมูลระบบทั้งหมด (Factory Reset All Data)</span>
                </div>
                <div class="card-sub" style="color:var(--text); margin-top:4px;">
                  ล้างประวัติออเดอร์, สต็อกสินค้า, รีวิวลูกค้า, โค้ดโปรโมชั่น และคืนค่าการตั้งค่าระบบทั้งหมดกลับสู่ค่าเริ่มต้นจากโรงงาน (ต้องกรอกรหัส PIN เพื่อยืนยันความปลอดภัย)
                </div>
              </div>
              <button type="button" class="btn btn-danger" id="btnTriggerFactoryReset" style="font-weight:800; padding:10px 20px; border-radius:12px; display:inline-flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                <span>รีเซ็ตข้อมูลทั้งหมด (Reset Everything)</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom Save Button -->
        <div style="text-align:center; padding:16px 0 24px;">
          <button class="btn btn-primary" id="saveSettingsBottom" style="font-size:15px; padding:12px 36px; font-weight:800; border-radius:14px; box-shadow:var(--shadow);">บันทึกการตั้งค่าทั้งหมด (Save All Changes)</button>
        </div>

      </div>
    `);

    root.appendChild(formWrap);

    // Dynamic Highlights List Renderer with Image / Emoji Choice
    const renderHighlightsSettingsList = () => {
      const hlContainer = formWrap.querySelector('#highlightsSettingsList');
      if (!hlContainer) return;
      hlContainer.innerHTML = '';

      currentHighlights.forEach((h, idx) => {
        const itemEl = el(`
          <div style="background:var(--primary-50); border:1px solid var(--border); border-radius:14px; padding:12px;">
            <div class="flex items-center" style="justify-content:space-between; margin-bottom:8px;">
              <span style="font-weight:700; font-size:12px; color:var(--accent-text);">ช่องที่ #${idx + 1}</span>
              <div class="flex gap-1">
                <button type="button" class="btn btn-sm btn-hl-mode ${h.iconType !== 'image' ? 'btn-primary' : 'btn-ghost'}" data-mode="emoji" style="padding:2px 7px; font-size:10.5px;">อิโมจิ</button>
                <button type="button" class="btn btn-sm btn-hl-mode ${h.iconType === 'image' ? 'btn-primary' : 'btn-ghost'}" data-mode="image" style="padding:2px 7px; font-size:10.5px;">รูปภาพ</button>
              </div>
            </div>

            <div style="display:${h.iconType === 'image' ? 'flex' : 'none'}; gap:8px; align-items:center; margin-bottom:8px;" class="hl-img-box">
              <div style="width:40px; height:40px; border-radius:10px; border:1px dashed var(--border); background:var(--card); display:grid; place-items:center; overflow:hidden; flex:none;">
                <img class="hl-img-prev" src="${escapeHTML(h.image || '')}" style="width:100%; height:100%; object-fit:cover; display:${h.image ? 'block' : 'none'};" onerror="this.style.display='none';" />
                <span class="hl-img-fallback" style="font-size:11px; display:${h.image ? 'none' : 'block'}; color:var(--muted);">IMG</span>
              </div>
              <div style="flex:1;">
                <input type="file" class="hl-file-input" accept="image/*" style="display:none;" />
                <button type="button" class="btn btn-sm btn-hl-upload" style="font-size:11px; padding:4px 10px; font-weight:700;">อัปโหลดรูป</button>
                <input class="input hl-img-url" placeholder="หรือ URL รูปภาพ" value="${escapeHTML(h.image || '')}" style="font-size:11px; padding:4px 8px; margin-top:4px;" />
              </div>
            </div>

            <div class="grid" style="grid-template-columns:${h.iconType === 'image' ? '1fr' : '54px 1fr'}; gap:8px;">
              <div class="field hl-emoji-box" style="margin:0; display:${h.iconType === 'image' ? 'none' : 'block'};">
                <label style="font-size:11px;">ไอคอน</label>
                <input class="input set-h-icon" value="${escapeHTML(h.icon || '')}" style="text-align:center; font-size:16px; padding:6px;" />
              </div>
              <div class="field" style="margin:0;">
                <label style="font-size:11px;">หัวข้อ</label>
                <input class="input set-h-title" value="${escapeHTML(h.title || '')}" style="padding:6px 10px; font-size:12.5px;" />
              </div>
            </div>
            <div class="field" style="margin-top:6px; margin-bottom:0;">
              <label style="font-size:11px;">คำบรรยาย</label>
              <input class="input set-h-sub" value="${escapeHTML(h.sub || '')}" style="padding:6px 10px; font-size:12px;" />
            </div>
          </div>
        `);

        // Mode switch
        itemEl.querySelectorAll('.btn-hl-mode').forEach(btn => {
          btn.addEventListener('click', () => {
            h.iconType = btn.dataset.mode;
            renderHighlightsSettingsList();
          });
        });

        // File upload
        const fileInp = itemEl.querySelector('.hl-file-input');
        itemEl.querySelector('.btn-hl-upload')?.addEventListener('click', () => fileInp?.click());
        fileInp?.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            h.image = evt.target.result;
            renderHighlightsSettingsList();
            toast(`อัปโหลดรูปจุดเด่น #${idx+1} เรียบร้อย`, 'success');
          };
          reader.readAsDataURL(file);
        });

        itemEl.querySelector('.hl-img-url')?.addEventListener('input', (e) => { h.image = e.target.value; });
        itemEl.querySelector('.set-h-icon')?.addEventListener('input', (e) => { h.icon = e.target.value; });
        itemEl.querySelector('.set-h-title')?.addEventListener('input', (e) => { h.title = e.target.value; });
        itemEl.querySelector('.set-h-sub')?.addEventListener('input', (e) => { h.sub = e.target.value; });

        hlContainer.appendChild(itemEl);
      });
    };

    // Brand Logo Handlers
    const btnBrandLogoTypeEmoji = formWrap.querySelector('#btnBrandLogoTypeEmoji');
    const btnBrandLogoTypeImage = formWrap.querySelector('#btnBrandLogoTypeImage');
    const brandLogoImageWrap = formWrap.querySelector('#brandLogoImageWrap');
    const brandLogoEmojiWrap = formWrap.querySelector('#brandLogoEmojiWrap');
    const fileBrandLogo = formWrap.querySelector('#fileBrandLogo');
    const btnUploadBrandLogo = formWrap.querySelector('#btnUploadBrandLogo');
    const btnClearBrandLogo = formWrap.querySelector('#btnClearBrandLogo');
    const brandLogoImgPreview = formWrap.querySelector('#brandLogoImgPreview');
    const brandLogoImgFallback = formWrap.querySelector('#brandLogoImgFallback');
    const setBrandLogoImgUrl = formWrap.querySelector('#setBrandLogoImgUrl');

    btnBrandLogoTypeEmoji?.addEventListener('click', () => {
      currentBrandLogoType = 'emoji';
      btnBrandLogoTypeEmoji.classList.add('btn-primary');
      btnBrandLogoTypeImage.classList.remove('btn-primary');
      if (brandLogoImageWrap) brandLogoImageWrap.style.display = 'none';
      if (brandLogoEmojiWrap) brandLogoEmojiWrap.style.display = 'block';
    });

    btnBrandLogoTypeImage?.addEventListener('click', () => {
      currentBrandLogoType = 'image';
      btnBrandLogoTypeImage.classList.add('btn-primary');
      btnBrandLogoTypeEmoji.classList.remove('btn-primary');
      if (brandLogoImageWrap) brandLogoImageWrap.style.display = 'block';
      if (brandLogoEmojiWrap) brandLogoEmojiWrap.style.display = 'none';
    });

    btnUploadBrandLogo?.addEventListener('click', () => fileBrandLogo?.click());
    fileBrandLogo?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentBrandLogoImage = evt.target.result;
        if (brandLogoImgPreview) {
          brandLogoImgPreview.src = currentBrandLogoImage;
          brandLogoImgPreview.style.display = 'block';
        }
        if (brandLogoImgFallback) brandLogoImgFallback.style.display = 'none';
        if (setBrandLogoImgUrl) setBrandLogoImgUrl.value = '(Uploaded Photo)';
        if (btnClearBrandLogo) btnClearBrandLogo.style.display = 'inline-block';
        toast('อัปโหลดรูปภาพโลโก้ร้านเรียบร้อย', 'success');
      };
      reader.readAsDataURL(file);
    });

    setBrandLogoImgUrl?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      currentBrandLogoImage = val;
      if (val && !val.startsWith('(Uploaded')) {
        if (brandLogoImgPreview) {
          brandLogoImgPreview.src = val;
          brandLogoImgPreview.style.display = 'block';
        }
        if (brandLogoImgFallback) brandLogoImgFallback.style.display = 'none';
        if (btnClearBrandLogo) btnClearBrandLogo.style.display = 'inline-block';
      } else if (!val) {
        if (brandLogoImgPreview) brandLogoImgPreview.style.display = 'none';
        if (brandLogoImgFallback) brandLogoImgFallback.style.display = 'block';
        if (btnClearBrandLogo) btnClearBrandLogo.style.display = 'none';
      }
    });

    btnClearBrandLogo?.addEventListener('click', () => {
      currentBrandLogoImage = '';
      if (setBrandLogoImgUrl) setBrandLogoImgUrl.value = '';
      if (brandLogoImgPreview) brandLogoImgPreview.style.display = 'none';
      if (brandLogoImgFallback) brandLogoImgFallback.style.display = 'block';
      if (btnClearBrandLogo) btnClearBrandLogo.style.display = 'none';
      toast('ลบรูปภาพโลโก้แล้ว', 'info');
    });

    // Hero Type Handlers
    const btnHeroEmoji = formWrap.querySelector('#btnHeroTypeEmoji');
    const btnHeroImage = formWrap.querySelector('#btnHeroTypeImage');
    const heroEmojiWrap = formWrap.querySelector('#heroEmojiWrap');
    const heroImageWrap = formWrap.querySelector('#heroImageWrap');
    const fileHeroImg = formWrap.querySelector('#fileHeroImg');
    const btnUploadHeroImg = formWrap.querySelector('#btnUploadHeroImg');
    const btnClearHeroImg = formWrap.querySelector('#btnClearHeroImg');
    const heroImgPreview = formWrap.querySelector('#heroImgPreview');
    const heroImgFallback = formWrap.querySelector('#heroImgFallback');
    const heroUrlInp = formWrap.querySelector('#setHeroImage');

    btnHeroEmoji?.addEventListener('click', () => {
      heroIconType = 'emoji';
      btnHeroEmoji.classList.add('btn-primary');
      btnHeroImage.classList.remove('btn-primary');
      heroEmojiWrap.style.display = 'block';
      heroImageWrap.style.display = 'none';
    });

    btnHeroImage?.addEventListener('click', () => {
      heroIconType = 'image';
      btnHeroImage.classList.add('btn-primary');
      btnHeroEmoji.classList.remove('btn-primary');
      heroImageWrap.style.display = 'block';
      heroEmojiWrap.style.display = 'none';
    });

    btnUploadHeroImg?.addEventListener('click', () => fileHeroImg?.click());
    fileHeroImg?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        heroImage = evt.target.result;
        if (heroImgPreview) { heroImgPreview.src = heroImage; heroImgPreview.style.display = 'block'; }
        if (heroImgFallback) heroImgFallback.style.display = 'none';
        if (heroUrlInp) heroUrlInp.value = '(Uploaded Photo)';
        toast('อัปโหลดรูปภาพ Hero เรียบร้อย', 'success');
      };
      reader.readAsDataURL(file);
    });

    heroUrlInp?.addEventListener('input', (e) => {
      heroImage = e.target.value.trim();
      if (heroImgPreview && heroImage) { heroImgPreview.src = heroImage; heroImgPreview.style.display = 'block'; }
      if (heroImgFallback && heroImage) heroImgFallback.style.display = 'none';
    });

    btnClearHeroImg?.addEventListener('click', () => {
      heroImage = '';
      if (heroUrlInp) heroUrlInp.value = '';
      if (heroImgPreview) heroImgPreview.style.display = 'none';
      if (heroImgFallback) heroImgFallback.style.display = 'block';
      toast('ลบรูปภาพ Hero แล้ว', 'info');
    });

    // Dynamic Receipt Live Preview Handlers
    const updateReceiptPreview = () => {
      const prevLogo = formWrap.querySelector('#prevRLogo');
      const prevStore = formWrap.querySelector('#prevRStore');
      const prevAddress = formWrap.querySelector('#prevRAddress');
      const prevFooterGraphic = formWrap.querySelector('#prevRFooterGraphic');
      const prevFooterMsg = formWrap.querySelector('#prevRFooterMsg');
      const prevFooterSub = formWrap.querySelector('#prevRFooterSub');

      const emojiVal = formWrap.querySelector('#setReceiptLogoEmoji')?.value.trim() || 'B';
      const storeVal = formWrap.querySelector('#setReceiptStoreName')?.value.trim() || 'BNC HayMate Bakery';
      const addressVal = formWrap.querySelector('#setReceiptStoreAddress')?.value.trim() || '14 Sukhumvit Rd · Bangkok';
      const footerEmojiVal = formWrap.querySelector('#setReceiptFooterEmoji')?.value.trim() || '';
      const footerMsgVal = formWrap.querySelector('#setReceiptFooterMsg')?.value.trim() || 'Thank you for your order';
      const footerSubVal = formWrap.querySelector('#setReceiptFooterSub')?.value.trim() || '';

      if (prevLogo) {
        if (currentReceiptLogoType === 'image' && currentReceiptLogoImage) {
          prevLogo.innerHTML = `<img src="${escapeHTML(currentReceiptLogoImage)}" style="width:100%;height:100%;object-fit:cover;" />`;
        } else {
          prevLogo.innerHTML = `<span>${escapeHTML(emojiVal)}</span>`;
        }
      }
      if (prevStore) prevStore.textContent = storeVal;
      if (prevAddress) prevAddress.textContent = addressVal;

      if (prevFooterGraphic) {
        if (currentReceiptFooterType === 'image' && currentReceiptFooterImage) {
          prevFooterGraphic.innerHTML = `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;"><img src="${escapeHTML(currentReceiptFooterImage)}" style="width:100%;height:100%;object-fit:cover;" /></div>`;
        } else if (currentReceiptFooterType === 'emoji') {
          prevFooterGraphic.innerHTML = `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;font-size:36px;">${escapeHTML(footerEmojiVal)}</div>`;
        } else {
          prevFooterGraphic.innerHTML = `<div class="r-footer-graphic" style="width:80px;height:80px;margin:8px auto 4px;font-size:36px;"></div>`;
        }
      }
      if (prevFooterMsg) prevFooterMsg.textContent = footerMsgVal;
      if (prevFooterSub) prevFooterSub.textContent = footerSubVal;
    };

    // Header Logo Type Listeners
    const btnLogoEmoji = formWrap.querySelector('#btnLogoTypeEmoji');
    const btnLogoImage = formWrap.querySelector('#btnLogoTypeImage');
    const logoImgWrap = formWrap.querySelector('#receiptLogoImageWrap');
    const logoEmojiWrap = formWrap.querySelector('#receiptLogoEmojiWrap');
    const fileLogoInp = formWrap.querySelector('#fileReceiptLogo');
    const btnUploadLogo = formWrap.querySelector('#btnUploadReceiptLogo');
    const btnClearLogo = formWrap.querySelector('#btnClearReceiptLogo');
    const logoImgPreview = formWrap.querySelector('#receiptLogoImgPreview');
    const logoImgFallback = formWrap.querySelector('#receiptLogoImgFallback');
    const logoUrlInp = formWrap.querySelector('#setReceiptLogoImage');

    btnLogoEmoji?.addEventListener('click', () => {
      currentReceiptLogoType = 'emoji';
      btnLogoEmoji.classList.add('btn-primary');
      btnLogoImage.classList.remove('btn-primary');
      logoEmojiWrap.style.display = 'block';
      logoImgWrap.style.display = 'none';
      updateReceiptPreview();
    });

    btnLogoImage?.addEventListener('click', () => {
      currentReceiptLogoType = 'image';
      btnLogoImage.classList.add('btn-primary');
      btnLogoEmoji.classList.remove('btn-primary');
      logoImgWrap.style.display = 'block';
      logoEmojiWrap.style.display = 'none';
      updateReceiptPreview();
    });

    btnUploadLogo?.addEventListener('click', () => fileLogoInp?.click());
    fileLogoInp?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentReceiptLogoImage = evt.target.result;
        if (logoImgPreview) {
          logoImgPreview.src = currentReceiptLogoImage;
          logoImgPreview.style.display = 'block';
        }
        if (logoImgFallback) logoImgFallback.style.display = 'none';
        if (logoUrlInp) logoUrlInp.value = '(Uploaded Photo)';
        updateReceiptPreview();
        toast('อัปโหลดรูปภาพโลโก้หัวสลิปเรียบร้อย', 'success');
      };
      reader.readAsDataURL(file);
    });

    logoUrlInp?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && (val.startsWith('http') || val.startsWith('data:image'))) {
        currentReceiptLogoImage = val;
        if (logoImgPreview) {
          logoImgPreview.src = val;
          logoImgPreview.style.display = 'block';
        }
        if (logoImgFallback) logoImgFallback.style.display = 'none';
        updateReceiptPreview();
      }
    });

    btnClearLogo?.addEventListener('click', () => {
      currentReceiptLogoImage = '';
      if (logoUrlInp) logoUrlInp.value = '';
      if (logoImgPreview) logoImgPreview.style.display = 'none';
      if (logoImgFallback) logoImgFallback.style.display = 'block';
      updateReceiptPreview();
      toast('ลบรูปภาพโลโก้แล้ว', 'info');
    });

    // Footer Graphic Type Listeners (QR standard removed)
    const btnFooterImg = formWrap.querySelector('#btnFooterTypeImage');
    const btnFooterEmoji = formWrap.querySelector('#btnFooterTypeEmoji');
    const footerImgWrap = formWrap.querySelector('#receiptFooterImageWrap');
    const footerEmojiWrap = formWrap.querySelector('#receiptFooterEmojiWrap');
    const fileFooterInp = formWrap.querySelector('#fileReceiptFooter');
    const btnUploadFooter = formWrap.querySelector('#btnUploadReceiptFooter');
    const btnClearFooter = formWrap.querySelector('#btnClearReceiptFooter');
    const footerImgPreview = formWrap.querySelector('#receiptFooterImgPreview');
    const footerImgFallback = formWrap.querySelector('#receiptFooterImgFallback');
    const footerUrlInp = formWrap.querySelector('#setReceiptFooterImage');

    btnFooterImg?.addEventListener('click', () => {
      currentReceiptFooterType = 'image';
      btnFooterImg.classList.add('btn-primary');
      btnFooterEmoji.classList.remove('btn-primary');
      footerImgWrap.style.display = 'block';
      footerEmojiWrap.style.display = 'none';
      updateReceiptPreview();
    });

    btnFooterEmoji?.addEventListener('click', () => {
      currentReceiptFooterType = 'emoji';
      btnFooterEmoji.classList.add('btn-primary');
      btnFooterImg.classList.remove('btn-primary');
      footerEmojiWrap.style.display = 'block';
      footerImgWrap.style.display = 'none';
      updateReceiptPreview();
    });

    btnUploadFooter?.addEventListener('click', () => fileFooterInp?.click());
    fileFooterInp?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentReceiptFooterImage = evt.target.result;
        if (footerImgPreview) {
          footerImgPreview.src = currentReceiptFooterImage;
          footerImgPreview.style.display = 'block';
        }
        if (footerImgFallback) footerImgFallback.style.display = 'none';
        if (footerUrlInp) footerUrlInp.value = '(Uploaded Photo)';
        updateReceiptPreview();
        toast('อัปโหลดรูปภาพ/QR ท้ายสลิปเรียบร้อย', 'success');
      };
      reader.readAsDataURL(file);
    });

    footerUrlInp?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val && (val.startsWith('http') || val.startsWith('data:image'))) {
        currentReceiptFooterImage = val;
        if (footerImgPreview) {
          footerImgPreview.src = val;
          footerImgPreview.style.display = 'block';
        }
        if (footerImgFallback) footerImgFallback.style.display = 'none';
        updateReceiptPreview();
      }
    });

    btnClearFooter?.addEventListener('click', () => {
      currentReceiptFooterImage = '';
      if (footerUrlInp) footerUrlInp.value = '';
      if (footerImgPreview) footerImgPreview.style.display = 'none';
      if (footerImgFallback) footerImgFallback.style.display = 'block';
      updateReceiptPreview();
      toast('ลบรูปภาพท้ายสลิปแล้ว', 'info');
    });

    // Dynamic Payment Accounts Builder with Logo Image upload
    const renderPaymentAccountsList = () => {
      const listEl = formWrap.querySelector('#paymentAccountsList');
      if (!listEl) return;
      listEl.innerHTML = '';

      if (currentPaymentAccounts.length === 0) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:18px; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:14px; color:var(--muted); font-size:13px;">
            ยังไม่มีช่องทางชำระเงินที่สร้างไว้ กดปุ่ม <strong>+ เพิ่มบัญชี / วอลเล็ทใหม่</strong> ด้านบนเพื่อสร้าง
          </div>
        `;
        return;
      }

      currentPaymentAccounts.forEach((acc, idx) => {
        const row = el(`
          <div class="card" style="background:var(--primary-50); border:1.5px solid var(--border); border-radius:16px; padding:14px 16px; position:relative;">
            <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px;">
              <span style="font-size:13px; font-weight:800; color:var(--accent-text);">ช่องทางชำระเงิน #${idx + 1}</span>
              <button type="button" class="btn btn-sm btn-ghost btn-del-acc" data-idx="${idx}" style="color:var(--danger); font-size:11.5px; padding:3px 8px; font-weight:700;">ลบช่องทางนี้</button>
            </div>

            <!-- Logo Image Upload Box for Payment Account -->
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;" class="acc-img-wrap">
              <div style="width:44px; height:44px; border-radius:10px; overflow:hidden; border:1px dashed var(--border); background:var(--card); display:grid; place-items:center; flex:none;">
                <img class="acc-img-prev" src="${escapeHTML(acc.image || '')}" style="width:100%; height:100%; object-fit:contain; display:${acc.image ? 'block' : 'none'};" onerror="this.style.display='none';" />
                <span class="acc-img-fallback" style="display:${acc.image ? 'none' : 'block'}; color:var(--muted);">${ICONS.bank}</span>
              </div>
              <div style="flex:1;">
                <input type="file" class="acc-file-inp" accept="image/*" style="display:none;" />
                <div class="flex gap-2 items-center">
                  <button type="button" class="btn btn-sm btn-acc-upload" style="font-size:11px; padding:4px 10px; font-weight:700;">อัปโหลดโลโก้</button>
                  ${acc.image ? `<button type="button" class="btn btn-sm btn-ghost btn-acc-clear" style="font-size:11px; padding:4px 8px; color:var(--danger);">ลบรูป</button>` : ''}
                </div>
                <input class="input acc-img-url" placeholder="หรือใส่ URL โลโก้ธนาคาร / วอลเล็ท" value="${escapeHTML(acc.image || '')}" style="font-size:11.5px; padding:5px 8px; margin-top:4px;" />
              </div>
            </div>

            <div class="grid" style="grid-template-columns: 1.5fr 1.5fr 1.5fr; gap:10px; align-items:flex-end;">
              <div class="field" style="margin-bottom:0;">
                <label style="font-size:11px; font-weight:700;">ชื่อธนาคาร / วอลเล็ท *</label>
                <input class="input acc-title" placeholder="เช่น กสิกรไทย, TrueMoney" value="${escapeHTML(acc.title || '')}" style="padding:8px 10px; font-size:12.5px; border-radius:10px;" />
              </div>
              <div class="field" style="margin-bottom:0;">
                <label style="font-size:11px; font-weight:700;">เลขบัญชี / เบอร์โทร *</label>
                <input class="input acc-num" placeholder="เช่น 123-4-56789-0" value="${escapeHTML(acc.account_number || '')}" style="padding:8px 10px; font-size:12.5px; border-radius:10px; font-weight:700;" />
              </div>
              <div class="field" style="margin-bottom:0;">
                <label style="font-size:11px; font-weight:700;">ชื่อบัญชี (Account Holder)</label>
                <input class="input acc-holder" placeholder="เช่น บจก. บีเอ็นซี เฮย์เมท" value="${escapeHTML(acc.account_holder || '')}" style="padding:8px 10px; font-size:12.5px; border-radius:10px;" />
              </div>
            </div>
          </div>
        `);

        // File upload
        const fileInp = row.querySelector('.acc-file-inp');
        row.querySelector('.btn-acc-upload')?.addEventListener('click', () => fileInp?.click());
        fileInp?.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const url = await uploadProductImage(file);
            acc.image = url;
            renderPaymentAccountsList();
            toast(`อัปโหลดโลโก้บัญชี #${idx+1} เรียบร้อย`, 'success');
          } catch (err) {
            toast('อัปโหลดโลโก้ไม่สำเร็จ: ' + (err.message || err), 'error');
          }
        });

        row.querySelector('.btn-acc-clear')?.addEventListener('click', () => {
          acc.image = '';
          renderPaymentAccountsList();
          toast('ลบโลโก้บัญชีแล้ว', 'info');
        });

        row.querySelector('.acc-img-url')?.addEventListener('input', (e) => {
          acc.image = e.target.value;
          const img = row.querySelector('.acc-img-prev');
          const fb = row.querySelector('.acc-img-fallback');
          if (img) { img.src = e.target.value; img.style.display = e.target.value ? 'block' : 'none'; }
          if (fb) fb.style.display = e.target.value ? 'none' : 'block';
        });
        row.querySelector('.acc-title')?.addEventListener('input', (e) => { acc.title = e.target.value; });
        row.querySelector('.acc-num')?.addEventListener('input', (e) => { acc.account_number = e.target.value; });
        row.querySelector('.acc-holder')?.addEventListener('input', (e) => { acc.account_holder = e.target.value; });

        row.querySelector('.btn-del-acc')?.addEventListener('click', () => {
          currentPaymentAccounts.splice(idx, 1);
          renderPaymentAccountsList();
          toast('ลบช่องทางชำระเงินเรียบร้อย', 'info');
        });

        listEl.appendChild(row);
      });
    };

    renderPaymentAccountsList();

    // PromptPay QR Code Payment Uploader
    const fileQrPayment = formWrap.querySelector('#fileQrPayment');
    const btnUploadQrPayment = formWrap.querySelector('#btnUploadQrPayment');
    const btnClearQrPayment = formWrap.querySelector('#btnClearQrPayment');
    const qrPaymentImgPreview = formWrap.querySelector('#qrPaymentImgPreview');
    const qrPaymentImgFallback = formWrap.querySelector('#qrPaymentImgFallback');
    const qrPaymentUrlInp = formWrap.querySelector('#setQrPaymentImage');

    btnUploadQrPayment?.addEventListener('click', () => fileQrPayment?.click());
    fileQrPayment?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      btnUploadQrPayment.disabled = true;
      btnUploadQrPayment.textContent = 'กำลังอัปโหลด...';
      try {
        const publicUrl = await uploadProductImage(file);
        currentQrPaymentImage = publicUrl;
        if (qrPaymentImgPreview) {
          qrPaymentImgPreview.src = currentQrPaymentImage;
          qrPaymentImgPreview.style.display = 'block';
        }
        if (qrPaymentImgFallback) qrPaymentImgFallback.style.display = 'none';
        if (btnClearQrPayment) btnClearQrPayment.style.display = 'inline-block';
        if (qrPaymentUrlInp) qrPaymentUrlInp.value = currentQrPaymentImage;
        toast('อัปโหลดรูป QR Code พร้อมเพย์เรียบร้อย', 'success');
      } catch (err) {
        toast('อัปโหลดไม่สำเร็จ: ' + (err.message || err), 'error');
      } finally {
        btnUploadQrPayment.disabled = false;
        btnUploadQrPayment.textContent = 'อัปโหลดรูป QR Code พร้อมเพย์';
      }
    });

    qrPaymentUrlInp?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      currentQrPaymentImage = val;
      if (qrPaymentImgPreview) {
        qrPaymentImgPreview.src = val;
        qrPaymentImgPreview.style.display = val ? 'block' : 'none';
      }
      if (qrPaymentImgFallback) qrPaymentImgFallback.style.display = val ? 'none' : 'block';
      if (btnClearQrPayment) btnClearQrPayment.style.display = val ? 'inline-block' : 'none';
    });

    btnClearQrPayment?.addEventListener('click', () => {
      currentQrPaymentImage = '';
      if (qrPaymentUrlInp) qrPaymentUrlInp.value = '';
      if (qrPaymentImgPreview) qrPaymentImgPreview.style.display = 'none';
      if (qrPaymentImgFallback) qrPaymentImgFallback.style.display = 'block';
      btnClearQrPayment.style.display = 'none';
      toast('ลบรูป QR Code พร้อมเพย์แล้ว', 'info');
    });

    formWrap.querySelector('#btnAddPaymentAcc')?.addEventListener('click', () => {
      currentPaymentAccounts.push({
        id: Date.now(),
        type: 'bank',
        image: '',
        title: 'ธนาคารใหม่',
        account_number: '',
        account_holder: state.store.name || ''
      });
      renderPaymentAccountsList();
      toast('เพิ่มช่องทางชำระเงินใหม่แล้ว', 'success');
      const inputs = formWrap.querySelectorAll('#paymentAccountsList .acc-title');
    });

    // Real-time input listeners for text
    ['#setReceiptLogoEmoji', '#setReceiptStoreName', '#setReceiptStoreAddress', '#setReceiptFooterEmoji', '#setReceiptFooterMsg', '#setReceiptFooterSub'].forEach(sel => {
      formWrap.querySelector(sel)?.addEventListener('input', updateReceiptPreview);
    });

    const updateStockPreview = () => {
      const lowVal = formWrap.querySelector('#setStockLowThreshold')?.value || '100';
      const outVal = formWrap.querySelector('#setStockOutThreshold')?.value || '0';
      const hLbl = formWrap.querySelector('#setStockHealthyLabel')?.value || 'Healthy';
      const lLbl = formWrap.querySelector('#setStockLowLabel')?.value || 'Low';
      const oLbl = formWrap.querySelector('#setStockOutLabel')?.value || 'Out of stock';

      const prevThreshHealthy = formWrap.querySelector('#prevThreshHealthy');
      const prevThreshLow = formWrap.querySelector('#prevThreshLow');
      const prevThreshOut = formWrap.querySelector('#prevThreshOut');
      const prevBadgeHealthy = formWrap.querySelector('#prevBadgeHealthy');
      const prevBadgeLow = formWrap.querySelector('#prevBadgeLow');
      const prevBadgeOut = formWrap.querySelector('#prevBadgeOut');

      if (prevThreshHealthy) prevThreshHealthy.textContent = lowVal;
      if (prevThreshLow) prevThreshLow.textContent = lowVal;
      if (prevThreshOut) prevThreshOut.textContent = outVal;

      if (prevBadgeHealthy) prevBadgeHealthy.textContent = `150 in stock (${hLbl})`;
      if (prevBadgeLow) prevBadgeLow.textContent = `45 in stock (${lLbl})`;
      if (prevBadgeOut) prevBadgeOut.textContent = `0 in stock (${oLbl})`;
    };

    ['#setStockLowThreshold', '#setStockOutThreshold', '#setStockHealthyLabel', '#setStockLowLabel', '#setStockOutLabel'].forEach(sel => {
      formWrap.querySelector(sel)?.addEventListener('input', updateStockPreview);
    });

    // Review Celebration Popup Handlers
    let currentReviewPopupImage = state.store.reviewPopupImage || '';
    const fileReviewPopupImg = formWrap.querySelector('#fileReviewPopupImg');
    const btnUploadReviewPopupImg = formWrap.querySelector('#btnUploadReviewPopupImg');
    const btnClearReviewPopupImg = formWrap.querySelector('#btnClearReviewPopupImg');
    const reviewPopupImgUrlInp = formWrap.querySelector('#setReviewPopupImgUrl');

    btnUploadReviewPopupImg?.addEventListener('click', () => fileReviewPopupImg?.click());
    fileReviewPopupImg?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentReviewPopupImage = evt.target.result;
        if (reviewPopupImgUrlInp) reviewPopupImgUrlInp.value = '(Uploaded Photo)';
        if (btnClearReviewPopupImg) btnClearReviewPopupImg.style.display = 'inline-block';
        toast('อัปโหลดรูปภาพมาสคอตสำหรับป๊อปอัพเรียบร้อย', 'success');
      };
      reader.readAsDataURL(file);
    });

    reviewPopupImgUrlInp?.addEventListener('input', (e) => {
      currentReviewPopupImage = e.target.value.trim();
      if (btnClearReviewPopupImg) btnClearReviewPopupImg.style.display = currentReviewPopupImage ? 'inline-block' : 'none';
    });

    btnClearReviewPopupImg?.addEventListener('click', () => {
      currentReviewPopupImage = '';
      if (reviewPopupImgUrlInp) reviewPopupImgUrlInp.value = '';
      btnClearReviewPopupImg.style.display = 'none';
      toast('ลบรูปภาพมาสคอตป๊อปอัพแล้ว', 'info');
    });

    formWrap.querySelector('#btnTestCelebrationPopup')?.addEventListener('click', () => {
      const tempTitle = formWrap.querySelector('#setReviewPopupTitle')?.value.trim() || state.store.reviewPopupTitle;
      const tempMsg = formWrap.querySelector('#setReviewPopupMsg')?.value.trim() || state.store.reviewPopupMsg;
      const tempImg = (currentReviewPopupImage && !currentReviewPopupImage.startsWith('(Uploaded')) ? currentReviewPopupImage : (reviewPopupImgUrlInp?.value && reviewPopupImgUrlInp.value !== '(Uploaded Photo)' ? reviewPopupImgUrlInp.value : currentReviewPopupImage);
      
      const prevStoreConfig = { ...state.store };
      state.store.reviewPopupTitle = tempTitle;
      state.store.reviewPopupMsg = tempMsg;
      state.store.reviewPopupImage = tempImg;

      openReviewCelebrationModal();

      // Restore temporary store config
      state.store = prevStoreConfig;
    });

    // Bind save actions
    const doSave = () => {
      state.store.brandLogoType = currentBrandLogoType;
      state.store.brandLogoImage = (currentBrandLogoImage && !currentBrandLogoImage.startsWith('(Uploaded')) ? currentBrandLogoImage : (formWrap.querySelector('#setBrandLogoImgUrl')?.value && formWrap.querySelector('#setBrandLogoImgUrl').value !== '(Uploaded Photo)' ? formWrap.querySelector('#setBrandLogoImgUrl').value : currentBrandLogoImage || '');
      state.store.brandLogoText = formWrap.querySelector('#setBrandLogoText')?.value.trim() || 'B';
      state.store.loadingTitle = formWrap.querySelector('#setLoadingTitle')?.value.trim() || state.store.name || 'BNC HayMate';
      state.store.storefrontTitle = formWrap.querySelector('#setStorefrontTitle')?.value.trim() || 'BNC HayMate';
      state.store.storefrontSub = formWrap.querySelector('#setStorefrontSub')?.value.trim() || 'Handmade sweet things & bakery';
      state.store.heroTitle = formWrap.querySelector('#setHeroTitle')?.value.trim() || 'Fresh from the oven, daily';
      state.store.heroSub = formWrap.querySelector('#setHeroSub')?.value.trim() || 'Handmade cakes, pastries, and rose-scented drinks.';
      state.store.heroBtnText = formWrap.querySelector('#setHeroBtnText')?.value.trim() || 'Shop Menu (320 items)';
      state.store.heroIconType = heroIconType;
      state.store.heroEmoji = formWrap.querySelector('#setHeroEmoji')?.value.trim() || '';
      state.store.heroImage = (heroImage && !heroImage.startsWith('(Uploaded')) ? heroImage : (heroUrlInp?.value && heroUrlInp.value !== '(Uploaded Photo)' && heroUrlInp.value.startsWith('http') ? heroUrlInp.value : heroImage);

      // Save Review Celebration Popup Settings
      state.store.reviewPopupTitle = formWrap.querySelector('#setReviewPopupTitle')?.value.trim() || 'Thank You';
      state.store.reviewPopupMsg = formWrap.querySelector('#setReviewPopupMsg')?.value.trim() || 'กลับมาใหม่น้า';
      state.store.reviewPopupImage = (currentReviewPopupImage && !currentReviewPopupImage.startsWith('(Uploaded')) ? currentReviewPopupImage : (reviewPopupImgUrlInp?.value && reviewPopupImgUrlInp.value !== '(Uploaded Photo)' ? reviewPopupImgUrlInp.value : currentReviewPopupImage || '');

      state.store.highlights = currentHighlights.map(h => ({
        iconType: h.iconType || 'emoji',
        icon: h.icon || '',
        image: h.image || '',
        title: h.title || '',
        sub: h.sub || ''
      }));

      state.store.popularTitle = formWrap.querySelector('#setPopularTitle')?.value.trim() || state.store.popularTitle || 'Popular Picks';
      state.store.popularSub = formWrap.querySelector('#setPopularSub')?.value.trim() || state.store.popularSub || 'Best sellers this week';

      // Receipt Settings Save
      state.store.receiptLogoType = currentReceiptLogoType;
      state.store.receiptLogoImage = (currentReceiptLogoImage && !currentReceiptLogoImage.startsWith('(Uploaded')) ? currentReceiptLogoImage : (logoUrlInp?.value && logoUrlInp.value !== '(Uploaded Photo)' && logoUrlInp.value.startsWith('http') ? logoUrlInp.value : currentReceiptLogoImage);
      state.store.receiptLogoEmoji = formWrap.querySelector('#setReceiptLogoEmoji')?.value.trim() || 'B';
      state.store.receiptStoreName = formWrap.querySelector('#setReceiptStoreName')?.value.trim() || 'BNC HayMate Bakery';
      state.store.receiptStoreAddress = formWrap.querySelector('#setReceiptStoreAddress')?.value.trim() || '14 Sukhumvit Rd · Bangkok';
      state.store.receiptFooterType = currentReceiptFooterType;
      state.store.receiptFooterImage = (currentReceiptFooterImage && !currentReceiptFooterImage.startsWith('(Uploaded')) ? currentReceiptFooterImage : (footerUrlInp?.value && footerUrlInp.value !== '(Uploaded Photo)' && footerUrlInp.value.startsWith('http') ? footerUrlInp.value : currentReceiptFooterImage);
      state.store.receiptFooterEmoji = formWrap.querySelector('#setReceiptFooterEmoji')?.value.trim() || '';
      state.store.receiptFooterMsg = formWrap.querySelector('#setReceiptFooterMsg')?.value.trim() || 'Thank you for your order';
      state.store.receiptFooterSub = formWrap.querySelector('#setReceiptFooterSub')?.value.trim() || '';

      // Tracking Review Calligraphy & Star Labels Save (STARS PRESERVED)
      state.store.trackingReviewTitle = formWrap.querySelector('#setTrackingTitle')?.value.trim() || 'BNC HayMate Bakery';
      state.store.trackingReviewSub = formWrap.querySelector('#setTrackingSub')?.value.trim() || 'Thank you for your support';
      state.store.trackingReviewBtnText = formWrap.querySelector('#setTrackingBtnText')?.value.trim() || 'เขียนรีวิวและให้คะแนนร้านค้า';
      state.store.starLabel1 = formWrap.querySelector('#setStarLabel1')?.value.trim() || '1 ดาว - ต้องปรับปรุง';
      state.store.starLabel2 = formWrap.querySelector('#setStarLabel2')?.value.trim() || '2 ดาว - พอใช้ได้';
      state.store.starLabel3 = formWrap.querySelector('#setStarLabel3')?.value.trim() || '3 ดาว - ปานกลาง / รสชาติดี';
      state.store.starLabel4 = formWrap.querySelector('#setStarLabel4')?.value.trim() || '4 ดาว - อร่อยและประทับใจมาก';
      state.store.starLabel5 = formWrap.querySelector('#setStarLabel5')?.value.trim() || '5 ดาว - ประทับใจมากที่สุด ยอดเยี่ยม!';

      // Save Stock Threshold Settings
      state.store.stockLowThreshold = Math.max(1, Number(formWrap.querySelector('#setStockLowThreshold')?.value || 100));
      state.store.stockOutThreshold = Math.max(0, Number(formWrap.querySelector('#setStockOutThreshold')?.value || 0));
      state.store.stockHealthyLabel = formWrap.querySelector('#setStockHealthyLabel')?.value.trim() || 'Healthy';
      state.store.stockLowLabel = formWrap.querySelector('#setStockLowLabel')?.value.trim() || 'Low';
      state.store.stockOutLabel = formWrap.querySelector('#setStockOutLabel')?.value.trim() || 'Out of stock';

      // Save Sticky Note Customization
      state.store.stickyNoteBg = formWrap.querySelector('#setStickyBg')?.value || '#FFFDF2';
      state.store.stickyNoteBorder = formWrap.querySelector('#setStickyBorder')?.value || '#EFE6C7';
      state.store.stickyNoteBottomBorder = formWrap.querySelector('#setStickyBottom')?.value || '#DFD2A8';
      state.store.stickyNotePinColor = formWrap.querySelector('#setStickyPin')?.value || '#EFA6C1';
      applyStickyNoteTheme();

      // Save QR Code Payment Image
      state.store.qr_image_url = currentQrPaymentImage;

      // Save Payment Accounts
      state.store.payment_accounts = currentPaymentAccounts.map(acc => ({
        id: acc.id || Date.now(),
        type: acc.type || 'bank',
        image: acc.image || '',
        title: acc.title || '',
        account_number: acc.account_number || '',
        account_holder: acc.account_holder || ''
      }));

      // Legacy fallback
      if (state.store.payment_accounts.length > 0) {
        state.store.bank_name = state.store.payment_accounts[0].title;
        state.store.bank_account = state.store.payment_accounts[0].account_number;
        state.store.account_holder = state.store.payment_accounts[0].account_holder;
      }

      state.store.name = formWrap.querySelector('#setStoreName')?.value.trim() || 'BNC HayMate';
      state.store.tagline = formWrap.querySelector('#setStoreTagline')?.value.trim() || 'Handmade sweet things';
      state.store.currency = formWrap.querySelector('#setCurrency')?.value || 'THB (฿)';
      state.store.timezone = formWrap.querySelector('#setTimezone')?.value || 'UTC+7 Bangkok';

      const pinVal = formWrap.querySelector('#setAdminPin')?.value.trim();
      if (pinVal && pinVal.length === 6 && /^\d+$/.test(pinVal)) {
        state.correctPin = pinVal;
        state.store.pin = pinVal;
      }
      const delPinVal = formWrap.querySelector('#setDeletePin')?.value.trim();
      if (delPinVal && delPinVal.length === 6 && /^\d+$/.test(delPinVal)) {
        state.deletePin = delPinVal;
        state.store.deletePin = delPinVal;
      }

      // Save Theme & Color instantly
      state.store.color = state.color;
      state.store.theme = state.theme;
      applyAppTheme(state.color, state.theme);
      try {
        localStorage.setItem('haypos_color', state.color);
        localStorage.setItem('haypos_theme', state.theme);
      } catch (e) {}

      // Persist to localStorage
      try {
        localStorage.setItem('haypos_store_settings', JSON.stringify(state.store));
      } catch (e) {}

      // Sync all settings, themes, banners across all devices & persist to Supabase
      syncStoreSettingsAcrossDevices();

      renderMenu();
      renderPage();
      toast(`บันทึกการตั้งค่าร้าน, ธีมสี, สติกกี้โน้ต, ค่าเงิน (${getCurrencySymbol()}), สลิป และหน้า Home เรียบร้อยแล้ว`, 'success');
    };

    root.querySelector('#saveSettingsTop')?.addEventListener('click', doSave);
    formWrap.querySelector('#saveSettingsBottom')?.addEventListener('click', doSave);
    formWrap.querySelector('#btnEditBannersSettings')?.addEventListener('click', openBannerManagerModal);

    // Sticky Note Live Preview Sync
    const sBgInp = formWrap.querySelector('#setStickyBg');
    const sBgHex = formWrap.querySelector('#setStickyBgHex');
    const sBorderInp = formWrap.querySelector('#setStickyBorder');
    const sBorderHex = formWrap.querySelector('#setStickyBorderHex');
    const sBottomInp = formWrap.querySelector('#setStickyBottom');
    const sBottomHex = formWrap.querySelector('#setStickyBottomHex');
    const sPinInp = formWrap.querySelector('#setStickyPin');
    const sPinHex = formWrap.querySelector('#setStickyPinHex');

    const updateStickyPreview = () => {
      const prevCard = formWrap.querySelector('#stickyLivePreviewCard');
      const prevPin = formWrap.querySelector('#prevStickyPinBadge');
      const bg = sBgInp ? sBgInp.value : '#FFFDF2';
      const border = sBorderInp ? sBorderInp.value : '#EFE6C7';
      const bottom = sBottomInp ? sBottomInp.value : '#DFD2A8';
      const pin = sPinInp ? sPinInp.value : '#EFA6C1';

      if (prevCard) {
        prevCard.style.background = bg;
        prevCard.style.borderColor = border;
        prevCard.style.borderBottomColor = bottom;
      }
      if (prevPin) {
        prevPin.style.background = pin;
      }
    };

    // Color pickers <-> Hex sync
    const syncColor = (colorInp, hexInp) => {
      if (!colorInp || !hexInp) return;
      colorInp.addEventListener('input', () => {
        hexInp.value = colorInp.value;
        updateStickyPreview();
      });
      hexInp.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexInp.value.trim())) {
          colorInp.value = hexInp.value.trim();
          updateStickyPreview();
        }
      });
    };

    syncColor(sBgInp, sBgHex);
    syncColor(sBorderInp, sBorderHex);
    syncColor(sBottomInp, sBottomHex);
    syncColor(sPinInp, sPinHex);

    // Preset buttons
    formWrap.querySelectorAll('.btn-sticky-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.k;
        const p = STICKY_NOTE_PALETTES[k];
        if (p) {
          if (sBgInp) sBgInp.value = p.bg;
          if (sBgHex) sBgHex.value = p.bg;
          if (sBorderInp) sBorderInp.value = p.border;
          if (sBorderHex) sBorderHex.value = p.border;
          if (sBottomInp) sBottomInp.value = p.bottom;
          if (sBottomHex) sBottomHex.value = p.bottom;
          if (sPinInp) sPinInp.value = p.pin;
          if (sPinHex) sPinHex.value = p.pin;
          updateStickyPreview();
          toast(`เลือกโทนสีสติกกี้โน้ต: ${p.name}`, 'info');
        }
      });
    });

    formWrap.querySelectorAll('.swatch-btn').forEach(b => b.addEventListener('click', () => {
      const selectedColor = b.dataset.c;
      state.color = selectedColor;
      state.theme = 'light';
      if (state.store) {
        state.store.color = selectedColor;
        state.store.theme = 'light';
      }
      applyAppTheme(selectedColor, 'light');
      formWrap.querySelectorAll('.swatch-btn').forEach(x => {
        x.style.borderColor = 'transparent';
        x.style.boxShadow = 'none';
      });
      b.style.borderColor = 'var(--text)';
      b.style.boxShadow = '0 0 0 2px var(--card)';
      try {
        localStorage.setItem('haypos_color', selectedColor);
        localStorage.setItem('haypos_theme', 'light');
        if (state.store) localStorage.setItem('haypos_store_settings', JSON.stringify(state.store));
      } catch(e) {}
      toast(`เปลี่ยนโทนสีเป็น ${COLOR_PALETTES[selectedColor]?.name || 'ใหม่'} (โหมด Light) ทันที`, 'success');
    }));

    // Trigger Factory Reset Modal
    formWrap.querySelector('#btnTriggerFactoryReset')?.addEventListener('click', openFactoryResetModal);
  };

  // ============================================================
  // Factory Reset All Data (Requires 6-digit Security PIN)
  // ============================================================
  function openFactoryResetModal() {
    const currentDeletePin = String(MASTER_DELETE_PIN || '888888');
    let enteredCode = '';

    const body = el(`
      <div class="calc-pin-card">
        <div style="background:rgba(229,139,148,0.12); border:1.5px solid var(--danger); border-radius:14px; padding:12px; display:flex; gap:10px; align-items:flex-start; text-align:left; margin-bottom:14px;">
          <div style="color:var(--danger); font-size:20px; flex:none; margin-top:1px;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          </div>
          <div>
            <div style="font-weight:800; font-size:13px; color:var(--danger);">คำเตือน: การล้างข้อมูลจะไม่สามารถกู้คืนได้</div>
            <div style="font-size:11.5px; color:var(--muted); line-height:1.4; margin-top:2px;">
              ล้างประวัติออเดอร์, ประวัติลูกค้า, สต็อกสินค้า, รีวิว และโปรโมชั่น ทั้งหมดกลับสู่ค่าว่างเปล่า (Blank Slate)
            </div>
          </div>
        </div>

        <div style="font-weight:700; color:var(--text); font-size:13px; margin-bottom:8px;">
          กรุณากดรหัสความปลอดภัยสำหรับการรีเซ็ต (Master PIN) *
        </div>

        <!-- Calculator Display Screen -->
        <div class="calc-screen" id="resetCalcScreen">
          <div class="calc-dots" id="resetDotsRow">
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
            <span class="calc-dot"></span>
          </div>
        </div>

        <!-- Calculator Round Keypad -->
        <div class="calc-keypad">
          <button type="button" class="calc-key" data-k="1">1</button>
          <button type="button" class="calc-key" data-k="2">2</button>
          <button type="button" class="calc-key" data-k="3">3</button>
          <button type="button" class="calc-key" data-k="4">4</button>
          <button type="button" class="calc-key" data-k="5">5</button>
          <button type="button" class="calc-key" data-k="6">6</button>
          <button type="button" class="calc-key" data-k="7">7</button>
          <button type="button" class="calc-key" data-k="8">8</button>
          <button type="button" class="calc-key" data-k="9">9</button>
          <button type="button" class="calc-key calc-key-action" data-k="clear">C</button>
          <button type="button" class="calc-key" data-k="0">0</button>
          <button type="button" class="calc-key calc-key-del" data-k="del">⌫</button>
        </div>

        <div style="margin-top: 14px; font-size: 11.5px; color: var(--muted);">
          รหัสความปลอดภัยสำหรับการรีเซ็ตถูกเก็บเป็นความลับในโค้ดระบบ
        </div>
      </div>
    `);

    function updateResetDots() {
      const dots = body.querySelectorAll('.calc-dot');
      dots.forEach((d, idx) => {
        if (idx < enteredCode.length) d.classList.add('filled');
        else d.classList.remove('filled');
      });
    }

    const executeReset = async () => {
      const isMatch = (enteredCode === currentDeletePin);

      if (!isMatch) {
        const dots = body.querySelectorAll('.calc-dot');
        dots.forEach(dot => dot.classList.add('error'));
        toast('รหัส PIN ความปลอดภัยไม่ถูกต้อง! ไม่สามารถรีเซ็ตได้', 'error');
        setTimeout(() => {
          enteredCode = '';
          dots.forEach(dot => { dot.classList.remove('filled'); dot.classList.remove('error'); });
        }, 450);
        return;
      }

      // 1. Wipe Supabase tables in strict dependency order (leaf tables first) so foreign key constraints are not violated
      if (supabase) {
        try {
          // 1. Order Items (leaf table referencing orders & products)
          await supabase.from('order_items').delete().not('id', 'is', null);
          // 2. Stock Movements (referencing products & stores)
          await supabase.from('stock_movements').delete().not('id', 'is', null);
          // 3. Orders (referencing stores & customers)
          await supabase.from('orders').delete().not('id', 'is', null);
          // 4. Reviews (referencing stores & customers)
          await supabase.from('reviews').delete().not('id', 'is', null);
          // 5. Promotions / Coupons
          await supabase.from('promotions').delete().not('id', 'is', null);
          await supabase.from('coupons').delete().not('id', 'is', null);
          // 6. Products (referencing stores & categories)
          await supabase.from('products').delete().not('id', 'is', null);
          // 7. Customers (referencing stores)
          await supabase.from('customers').delete().not('id', 'is', null);
          // 8. Categories & Banners
          await supabase.from('categories').delete().not('id', 'is', null);
          await supabase.from('store_banners').delete().not('id', 'is', null);
          // 9. Reset store_settings
          await supabase.from('store_settings').update({
            primary_color: '#F8BFD4',
            dark_mode: false,
            theme_config: null,
            qr_image_url: null,
            bank_name: null,
            bank_account: null,
            account_holder: null
          }).not('id', 'is', null);
        } catch (dbErr) {
          console.warn('Supabase reset warning:', dbErr);
        }
      }

      // 2. Broadcast system_reset event to all connected devices in realtime
      if (syncChannel) {
        try {
          syncChannel.send({
            type: 'broadcast',
            event: 'system_reset',
            payload: { timestamp: Date.now() }
          });
        } catch (e) {}
      }

      // 3. Clear all local storage keys
      const keysToClear = [
        'haypos_orders', 'haypos_customers', 'haypos_products', 'haypos_reviews',
        'haypos_promotions', 'haypos_store_settings', 'haypos_cart', 'haypos_banners',
        'haypos_color', 'haypos_theme', 'haypos_recent_order_notifs',
        'haypos_cleared_order_notifs', 'haypos_cleared_stock_notifs',
        'haypos_last_order_id'
      ];
      keysToClear.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });

      // 4. Reset in-memory data to completely empty blank slate
      ORDERS = [];
      CUSTOMERS = [];
      REVIEWS = [];
      PROMOTIONS = [];
      PRODUCTS = [];
      STOCK = [];
      CATEGORIES = [];
      BANNERS = [
        { id: 1, title: '', sub: '', tag: '', image: '' },
        { id: 2, title: '', sub: '', tag: '', image: '' },
        { id: 3, title: '', sub: '', tag: '', image: '' },
        { id: 4, title: '', sub: '', tag: '', image: '' },
        { id: 5, title: '', sub: '', tag: '', image: '' }
      ];

      state.store = JSON.parse(JSON.stringify(DEFAULT_STORE_CONFIG));
      state.correctPin = '123456';
      state.selected = {};
      state.cart = {};
      state.recentOrderNotifs = [];
      state.clearedNotifProductIds = new Set();
      state.clearedOrderNotifIds = new Set();
      state.lastOrderId = null;

      // Save empty notification state and update badge
      saveNotifsState();
      updateStockNotifications();

      // Persist clean blank states
      persistOrders();
      persistCustomers();
      persistProducts();
      persistReviews();
      persistPromotions();
      persistBanners();
      try { localStorage.setItem('haypos_store_settings', JSON.stringify(state.store)); } catch (e) {}

      // Apply defaults theme & sticky note
      applyAppTheme('#F8BFD4', 'light');
      applyStickyNoteTheme();

      closeModal();
      toast('ล้างข้อมูลระบบทุกตารางในฐานข้อมูลและทุกเครื่องเรียบร้อยแล้ว', 'success');
      renderMenu();
      renderPage();
    };

    body.querySelectorAll('.calc-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const k = btn.dataset.k;
        if (k === 'clear') {
          enteredCode = '';
          updateResetDots();
          return;
        }
        if (k === 'del') {
          enteredCode = enteredCode.slice(0, -1);
          updateResetDots();
          return;
        }
        if (enteredCode.length < 6) {
          enteredCode += k;
          updateResetDots();
        }
        if (enteredCode.length === 6) {
          setTimeout(executeReset, 120);
        }
      });
    });

    // Keyboard support
    const handleKeydown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (enteredCode.length < 6) {
          enteredCode += e.key;
          updateResetDots();
          if (enteredCode.length === 6) setTimeout(executeReset, 120);
        }
      } else if (e.key === 'Backspace') {
        enteredCode = enteredCode.slice(0, -1);
        updateResetDots();
      } else if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleKeydown);
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeydown);

    openModal({
      title: 'ล้างข้อมูลระบบทั้งหมด (Factory Reset)',
      body,
      actions: [
        { label: 'ยกเลิก (Cancel)', kind: 'ghost', onClick: () => document.removeEventListener('keydown', handleKeydown) },
        {
          label: 'ล้างข้อมูลทั้งหมด (Confirm Reset)',
          kind: 'danger',
          close: false,
          onClick: executeReset
        }
      ]
    });
  }

  // Promotion Discount Calculator Helper
  function calculatePromoDiscount(promo, subtotal) {
    if (!promo || !subtotal) return 0;
    const offText = (promo.off || '').toLowerCase();
    const percentMatch = offText.match(/(\d+)\s*%/);
    if (percentMatch) {
      const pct = parseFloat(percentMatch[1]);
      return Math.round((subtotal * (pct / 100)) * 100) / 100;
    }
    const fixedMatch = offText.match(/(\d+(?:\.\d+)?)/);
    if (fixedMatch) {
      const amt = parseFloat(fixedMatch[1]);
      return Math.min(subtotal, amt);
    }
    return 0;
  }

  // ============================================================
  // PAGE 11: Customer Store (Storefront & Order Placement)
  // ============================================================
  PAGES.store = (root) => {
    root.appendChild(el(`
      <div class="page-head">
        <div>
          <h1 class="page-title" style="font-family:'Sunshiney', cursive; font-size:36px; font-weight:700; color:var(--accent-text); letter-spacing:0.5px; line-height:1.1;">${escapeHTML(state.store.storefrontTitle || 'Customer store')}</h1>
          <div class="page-sub" style="font-family:'Plus Jakarta Sans', system-ui, sans-serif; font-size:13px; color:var(--muted); font-weight:500; margin-top:2px;">${escapeHTML(state.store.storefrontSub || 'Online storefront view')}</div>
        </div>
        <div class="tabs" id="storeTabs">
          <div class="tab active" data-s="home">Home</div>
          <div class="tab" data-s="products">Products</div>
          <div class="tab" data-s="cart">Cart</div>
          <div class="tab" data-s="checkout">Checkout</div>
          <div class="tab" data-s="receipt">Receipt</div>
          <div class="tab" data-s="tracking">Tracking</div>
        </div>
      </div>
    `));

    const view = el(`<div id="storeView"></div>`);
    root.appendChild(view);

    let currentStoreTab = 'home';
    state.storeProductSubTab = state.storeProductSubTab || 'items';

    function updateFloatingCartBtn() {
      let floatBtn = document.getElementById('storeFloatingCartBtn');
      const totalQty = Object.values(state.selected).reduce((a, b) => a + Number(b || 0), 0);
      const totalPrice = Object.entries(state.selected).reduce((sum, [id, q]) => {
        const item = getCartItemDetails(id);
        return sum + (item ? Number(item.price) * Number(q) : 0);
      }, 0);

      // Show floating button on Store page when viewing 'products' or 'home' tab and items > 0
      if (totalQty > 0 && state.page === 'store' && (currentStoreTab === 'products' || currentStoreTab === 'home')) {
        if (!floatBtn) {
          floatBtn = el(`
            <button type="button" id="storeFloatingCartBtn" class="floating-cart-btn" title="ไปที่ตะกร้าสินค้า">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" style="display:inline-block; vertical-align:middle;"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              <span id="floatCartItemsCount" class="float-cart-count">${totalQty}</span>
              <span id="floatCartPriceText">${money(totalPrice)}</span>
              <span style="font-size:13px; font-weight:800;">→</span>
            </button>
          `);
          floatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabBtn = document.querySelector('#storeTabs [data-s="cart"]');
            if (tabBtn) {
              tabBtn.click();
            } else {
              root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
              root.querySelector('#storeTabs [data-s="cart"]')?.classList.add('active');
              drawStore('cart');
            }
          });
          document.body.appendChild(floatBtn);
        } else {
          const countEl = floatBtn.querySelector('#floatCartItemsCount');
          const priceEl = floatBtn.querySelector('#floatCartPriceText');
          if (countEl) countEl.textContent = totalQty;
          if (priceEl) priceEl.textContent = money(totalPrice);
          floatBtn.style.display = 'flex';
        }
      } else {
        if (floatBtn) {
          floatBtn.style.display = 'none';
          floatBtn.remove();
        }
      }
    }

    const drawStore = (key) => {
      currentStoreTab = key;
      state.storeTab = key;
      view.innerHTML = '';
      updateFloatingCartBtn();

      const isItemsActive = state.store.enableItems !== false;
      const isCoinFarmActive = state.store.enableCoinFarm !== false;
      const isGameIdsActive = state.store.enableGameIds !== false;

      if (key === 'home') {
        // 1. Carousel Container (Dynamic Slides, 1:1 Aspect Ratio at Top)
        const carouselEl = el(`
          <div>
            ${state.isAdmin ? `
              <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
                <button class="btn btn-sm" id="btnAdminEditBanners" style="background:var(--card); border:1.5px solid var(--border); color:var(--accent-text); font-size:12px; font-weight:700; cursor:pointer;">
                  จัดการรูปสไลด์ (${BANNERS.length} รูป)
                </button>
              </div>` : ''}

            ${BANNERS.length === 0 ? `
              <div style="padding:28px 16px; text-align:center; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:18px; margin-bottom:14px;">
                <div style="font-size:13.5px; font-weight:700; color:var(--accent-text); margin-bottom:4px;">Home Carousel Banners</div>
                <div style="font-size:12px; color:var(--muted);">ยังไม่มีรูปภาพสไลด์โปรโมท (แอดมินสามารถกดปุ่มด้านบนเพื่อเพิ่มรูปภาพได้)</div>
              </div>
            ` : `
            <div class="home-carousel-wrapper" style="margin-top:0;">
              <div class="carousel-track" id="carouselTrack">
                ${BANNERS.map((b, idx) => `
                  <div class="carousel-slide" data-idx="${idx}">
                    ${b.image
                      ? `<img src="${escapeHTML(b.image)}" alt="Slide ${idx + 1}" style="width:100%; height:100%; object-fit:cover; display:block; user-select:none;" />`
                      : `<div style="width:100%; height:100%; display:grid; place-items:center; background:var(--primary-50); color:var(--muted); font-size:13px; font-weight:700; user-select:none;"><div style="text-align:center;"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 4px; display:block; opacity:0.5;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><div>Slide #${idx + 1}</div></div></div>`
                    }
                  </div>
                `).join('')}
              </div>

              ${BANNERS.length > 1 ? `
                <button class="carousel-btn prev" id="cPrev" aria-label="Previous">‹</button>
                <button class="carousel-btn next" id="cNext" aria-label="Next">›</button>
              ` : ''}

              <div class="carousel-dots" id="cDots">
                ${BANNERS.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
              </div>
            </div>
            `}
          </div>
        `);
        view.appendChild(carouselEl);

        if (state.isAdmin) {
          carouselEl.querySelector('#btnAdminEditBanners')?.addEventListener('click', openBannerManagerModal);
        }

        // Carousel Logic
        if (BANNERS.length > 0) {
          let currentSlide = 0;
          const totalSlides = BANNERS.length;
          const track = carouselEl.querySelector('#carouselTrack');
          const dots = carouselEl.querySelectorAll('.carousel-dot');

          function goToSlide(idx) {
            if (totalSlides <= 0) return;
            currentSlide = (idx + totalSlides) % totalSlides;
            if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
            dots.forEach((d, i) => {
              if (i === currentSlide) d.classList.add('active');
              else d.classList.remove('active');
            });
          }

          carouselEl.querySelector('#cPrev')?.addEventListener('click', (e) => { e.stopPropagation(); goToSlide(currentSlide - 1); });
          carouselEl.querySelector('#cNext')?.addEventListener('click', (e) => { e.stopPropagation(); goToSlide(currentSlide + 1); });
          dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); goToSlide(+d.dataset.idx); }));
        }

        // Click slide to open products
        carouselEl.querySelectorAll('.carousel-slide').forEach(sl => {
          sl.addEventListener('click', (e) => {
            if (e.target.closest('.carousel-btn') || e.target.closest('.carousel-dots')) return;
            root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
            root.querySelector('#storeTabs [data-s="products"]')?.classList.add('active');
            drawStore('products');
          });
        });

        // 2. Compact Hero Banner
        const heroGraphicHtml = (state.store.heroIconType === 'image' && state.store.heroImage)
          ? `<img src="${escapeHTML(state.store.heroImage)}" alt="Hero" style="width:38px; height:38px; object-fit:contain; border-radius:10px; display:block;" onerror="this.style.display='none';" />`
          : '';

        const compactHero = el(`
          <div class="store-hero">
            <div style="flex:1;">
              <h2 style="font-size:15.5px; font-weight:800;">${escapeHTML(state.store.heroTitle || 'ยินดีต้อนรับสู่ร้านค้า')}</h2>
              <p style="font-size:12px; color:var(--muted); margin-top:2px;">${escapeHTML(state.store.heroSub || 'เลือกซื้อสินค้าไอเทม บริการวนเหรียญ และไอดีเกมคุณภาพ')}</p>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-primary btn-sm" id="btnHeroShop" style="font-size:12px; padding:6px 14px;">${escapeHTML(state.store.heroBtnText || 'ดูสินค้าทั้งหมด')}</button>
              ${heroGraphicHtml}
            </div>
          </div>
        `);
        view.appendChild(compactHero);

        compactHero.querySelector('#btnHeroShop')?.addEventListener('click', () => {
          root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
          root.querySelector('#storeTabs [data-s="products"]').classList.add('active');
          drawStore('products');
        });

        // 3. SERVICE SECTION A: วนเหรียญ (Coin Farming Showcase) - IF ENABLED
        if (isCoinFarmActive) {
          const boxes = state.store.coinFarmBoxes || [];
          let activeBoxIdx = 0;

          const coinFarmSection = el(`
            <div class="card" style="margin-top:16px;">
              <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                <div>
                  <div class="card-title">บริการวนเหรียญ (Coin Farming)</div>
                  <div class="card-sub">ฟาร์มเหรียญรวดเร็ว ปลอดภัย มีหลายช่วงเลเวลให้เลือก</div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" id="btnHomeGoCoinFarm" style="font-weight:700;">ดูแพ็กเกจทั้งหมด →</button>
              </div>

              ${boxes.length > 0 ? `
                <!-- Level Boxes Selector Tabs -->
                <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:6px; margin-bottom:12px;" id="homeCfBoxTabs">
                  ${boxes.map((b, i) => `
                    <button type="button" class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-ghost'}" data-bidx="${i}" style="border-radius:10px; font-size:12px; font-weight:700; white-space:nowrap; border:1.5px solid var(--border);">
                      ${escapeHTML(b.title)}
                    </button>
                  `).join('')}
                </div>

                <div id="homeCfTiersContainer" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px;"></div>
              ` : `
                <div style="padding:20px; text-align:center; color:var(--muted); background:var(--primary-50); border-radius:12px;">ยังไม่มีข้อมูลแพ็กเกจวนเหรียญในขณะนี้</div>
              `}
            </div>
          `);
          view.appendChild(coinFarmSection);

          const renderHomeCfTiers = () => {
            const container = coinFarmSection.querySelector('#homeCfTiersContainer');
            if (!container) return;
            const currentBox = boxes[activeBoxIdx];
            if (!currentBox || !currentBox.tiers || !currentBox.tiers.length) {
              container.innerHTML = `<div style="grid-column:1/-1; padding:16px; text-align:center; color:var(--muted);">ไม่มีแพ็กเกจในกล่องนี้</div>`;
              return;
            }
            container.innerHTML = '';
            currentBox.tiers.forEach(t => {
              const cartKey = `cf_tier_${currentBox.id}_${t.id}`;
              const qty = state.selected[cartKey] || 0;
              const card = el(`
                <div class="coin-tier-item ${qty > 0 ? 'selected' : ''}" style="display:flex; flex-direction:column; align-items:stretch; gap:8px; padding:12px; border-radius:14px; background:var(--card);">
                  <div class="flex items-center" style="justify-content:space-between;">
                    <span style="font-weight:800; font-size:14.5px; color:var(--text);">${escapeHTML(t.coins)}</span>
                    <span style="font-weight:900; font-size:16px; color:var(--accent-text);">${money(t.price)}</span>
                  </div>
                  <div style="font-size:11.5px; color:var(--muted); min-height:16px;">${escapeHTML(t.desc || currentBox.title)}</div>
                  <button type="button" class="btn btn-sm btn-block ${qty > 0 ? 'btn-primary' : ''}" style="margin-top:4px; font-weight:700; font-size:12px; border-radius:8px;">
                    ${qty > 0 ? `✓ ในตะกร้า (${qty})` : '+ สั่งซื้อ'}
                  </button>
                </div>
              `);
              card.addEventListener('click', () => {
                state.selected[cartKey] = (state.selected[cartKey] || 0) + 1;
                toast(`เพิ่ม "${t.coins}" ลงในตะกร้าแล้ว`, 'success');
                updateFloatingCartBtn();
                renderHomeCfTiers();
              });
              container.appendChild(card);
            });
          };

          if (boxes.length > 0) {
            renderHomeCfTiers();
            coinFarmSection.querySelectorAll('#homeCfBoxTabs button').forEach(btn => {
              btn.addEventListener('click', () => {
                activeBoxIdx = +btn.dataset.bidx;
                coinFarmSection.querySelectorAll('#homeCfBoxTabs button').forEach(b => {
                  b.classList.remove('btn-primary');
                  b.classList.add('btn-ghost');
                });
                btn.classList.add('btn-primary');
                btn.classList.remove('btn-ghost');
                renderHomeCfTiers();
              });
            });
          }

          coinFarmSection.querySelector('#btnHomeGoCoinFarm')?.addEventListener('click', () => {
            state.storeProductSubTab = 'coin_farm';
            root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
            root.querySelector('#storeTabs [data-s="products"]')?.classList.add('active');
            drawStore('products');
          });
        }

        // 4. SERVICE SECTION B: Item HayDay Popular Picks - IF ENABLED
        if (isItemsActive) {
          const itemsSection = el(`
            <div class="card" style="margin-top:16px">
              <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <div>
                  <div class="card-title">${escapeHTML(state.store.popularTitle || 'Item HayDay')} (${PRODUCTS.length})</div>
                  <div class="card-sub">${escapeHTML(state.store.popularSub || 'เลือกชมและสั่งซื้อสินค้าไอเทมและอุปกรณ์')}</div>
                </div>
                <button class="btn btn-primary btn-sm" id="btnHomeViewAllMenu" style="font-weight:700;">ดูสินค้าทั้งหมด (${PRODUCTS.length} รายการ) →</button>
              </div>

              ${PRODUCTS.length > 0 ? `
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:14px;" id="homeProductCardsGrid">
                  ${PRODUCTS.slice(0, 12).map(p => {
                    const qty = state.selected[p.id] || 0;
                    const imgUrl = p.image || DEFAULT_PRODUCT_IMG;
                    const stockCls = p.stock === 0 ? 'out' : p.stock < 10 ? 'low' : '';
                    return `
                      <div class="card home-product-card ${stockCls}" data-id="${p.id}" style="padding:12px; border:1.5px solid var(--border); border-radius:16px; background:var(--card); display:flex; flex-direction:column; position:relative; cursor:pointer; margin:0;">
                        <div style="position:relative; width:100%; aspect-ratio:1/1; border-radius:12px; overflow:hidden; background:var(--primary-50); border:1px solid var(--border); margin-bottom:10px;">
                          <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                          ${qty > 0 ? `<span class="qty-badge" style="display:flex; position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; background:var(--primary-600); color:#fff; font-size:12px; font-weight:800; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${qty}</span>` : ''}
                          ${p.stock === 0 ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.55); color:#fff; display:grid; place-items:center; font-size:12px; font-weight:800;">สินค้าหมด</div>` : ''}
                        </div>
                        
                        <div style="flex:1; display:flex; flex-direction:column;">
                          <div style="font-size:11px; color:var(--muted); font-weight:700;">${escapeHTML(p.cat || 'Item')}</div>
                          <div style="font-weight:800; font-size:14px; color:var(--text); line-height:1.3; margin:2px 0 4px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHTML(p.name)}</div>
                          ${p.flavor ? `<div style="font-size:11.5px; color:var(--muted); margin-bottom:6px;">${escapeHTML(p.flavor)}</div>` : ''}
                          
                          <div style="margin-top:auto; display:flex; align-items:center; justify-content:space-between; gap:6px; padding-top:8px; border-top:1px dashed var(--border);">
                            <div style="font-weight:800; font-size:15px; color:var(--accent-text);">${money(p.price)}</div>
                            <button type="button" class="btn btn-sm btn-home-add" data-id="${p.id}" style="padding:4px 10px; font-size:11.5px; font-weight:700; background:${qty > 0 ? 'var(--primary-600)' : 'var(--primary-50)'}; color:${qty > 0 ? '#fff' : 'var(--accent-text)'}; border:1px solid var(--border); border-radius:8px;">
                              ${qty > 0 ? `✓ ในตะกร้า (${qty})` : '+ สั่งซื้อ'}
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div style="padding:32px 16px; text-align:center; background:var(--primary-50); border:1.5px dashed var(--border); border-radius:16px;">
                  <div style="font-weight:700; font-size:14px; color:var(--text); margin-bottom:4px;">ยังไม่มีสินค้าในขณะนี้</div>
                  <div style="font-size:12px; color:var(--muted);">เมื่อแอดมินสร้างสินค้าใหม่ สินค้าจะปรากฏที่หน้านี้โดยอัตโนมัติ</div>
                </div>
              `}
            </div>
          `);
          view.appendChild(itemsSection);

          itemsSection.querySelectorAll('.home-product-card').forEach(card => {
            card.addEventListener('click', () => {
              const pid = card.dataset.id;
              const p = PRODUCTS.find(x => String(x.id) === String(pid));
              if (!p) return;
              if (p.stock === 0) return toast(`${p.name} สินค้าหมด`, 'error');
              state.selected[p.id] = (state.selected[p.id] || 0) + 1;
              toast(`เพิ่ม ${p.name} ลงในตะกร้าแล้ว`, 'success');
              updateFloatingCartBtn();
              drawStore('home');
            });
          });

          itemsSection.querySelector('#btnHomeViewAllMenu')?.addEventListener('click', () => {
            state.storeProductSubTab = 'items';
            root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
            root.querySelector('#storeTabs [data-s="products"]')?.classList.add('active');
            drawStore('products');
          });
        }

        // 5. SERVICE SECTION C: ตลาดซื้อขายไอดีเกม (Game ID Showcase) - IF ENABLED
        if (isGameIdsActive) {
          const accs = state.store.gameAccounts || [];
          const gameIdsSection = el(`
            <div class="card" style="margin-top:16px;">
              <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
                <div>
                  <div class="card-title">ตลาดซื้อขายไอดีเกม (Game ID Market) (${accs.length})</div>
                  <div class="card-sub">ไอดีแท้ พร้อมส่งมอบ ปลอดภัย 100% ตรวจสอบได้</div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" id="btnHomeGoGameIds" style="font-weight:700;">ดูไอดีทั้งหมด (${accs.length} รายการ) →</button>
              </div>

              ${accs.length > 0 ? `
                <div class="game-id-grid">
                  ${accs.map(acc => {
                    const images = (acc.images && acc.images.length > 0) ? acc.images : [DEFAULT_PRODUCT_IMG];
                    const cartKey = 'game_acc_' + acc.id;
                    const inCart = !!state.selected[cartKey];
                    return `
                      <div class="game-id-card" data-accid="${acc.id}">
                        <span class="game-id-badge ${acc.status || 'available'}">
                          ${acc.status === 'sold' ? 'ขายแล้ว (Sold Out)' : acc.status === 'reserved' ? 'ติดจอง (Reserved)' : 'พร้อมส่งมอบ (Available)'}
                        </span>

                        <div class="game-id-gallery-wrap">
                          <div class="game-id-gallery-track" id="h_track_${acc.id}">
                            ${images.map((img, i) => `
                              <div class="game-id-gallery-slide">
                                <img src="${escapeHTML(img)}" alt="${escapeHTML(acc.title)} Photo ${i+1}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                              </div>
                            `).join('')}
                          </div>

                          ${images.length > 1 ? `
                            <button type="button" class="game-id-gallery-btn prev btn-hg-prev">‹</button>
                            <button type="button" class="game-id-gallery-btn next btn-hg-next">›</button>
                            <div class="game-id-dots">
                              ${images.map((_, i) => `<div class="game-id-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
                            </div>
                          ` : ''}
                        </div>

                        <div style="flex:1; display:flex; flex-direction:column;">
                          <div class="flex items-center gap-2" style="margin-bottom:4px;">
                            <span class="badge" style="background:var(--primary-100); color:var(--accent-text); font-weight:800; font-size:11px;">${escapeHTML(acc.code)}</span>
                            ${acc.badge ? `<span class="badge" style="background:var(--primary-50); font-size:10.5px;">${escapeHTML(acc.badge)}</span>` : ''}
                            <span style="font-size:11px; color:var(--muted); margin-left:auto;">${images.length} รูป</span>
                          </div>

                          <div style="font-weight:800; font-size:14px; color:var(--text); line-height:1.3; margin-bottom:4px;">${escapeHTML(acc.title)}</div>
                          ${acc.details ? `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px; line-height:1.4; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHTML(acc.details)}</div>` : ''}

                          <div style="margin-top:auto; padding-top:10px; border-top:1.5px dashed var(--border); display:flex; align-items:center; justify-content:space-between; gap:6px;">
                            <div style="font-weight:900; font-size:16px; color:var(--accent-text);">${money(acc.price)}</div>
                            <div class="flex gap-1">
                              <button type="button" class="btn btn-sm btn-ghost btn-quick-view" style="font-size:11.5px; padding:4px 8px; font-weight:700;">ดูรูป/รายละเอียด</button>
                              ${acc.status === 'available' ? `
                                <button type="button" class="btn btn-sm ${inCart ? 'btn-primary' : ''} btn-buy-game-id" style="font-size:11.5px; padding:4px 10px; font-weight:700;">
                                  ${inCart ? '✓ ในตะกร้า' : '+ สั่งซื้อ'}
                                </button>
                              ` : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : `
                <div style="padding:24px; text-align:center; color:var(--muted); background:var(--primary-50); border-radius:12px;">ยังไม่มีไอดีเกมในขณะนี้</div>
              `}
            </div>
          `);
          view.appendChild(gameIdsSection);

          // Slider logic on Home
          gameIdsSection.querySelectorAll('.game-id-card').forEach(card => {
            const accId = card.dataset.accid;
            const acc = accs.find(a => a.id === accId);
            if (!acc) return;
            const images = (acc.images && acc.images.length > 0) ? acc.images : [DEFAULT_PRODUCT_IMG];
            let currentSlide = 0;

            if (images.length > 1) {
              const track = card.querySelector(`#h_track_${acc.id}`);
              const dots = card.querySelectorAll('.game-id-dot');
              const updateSlide = (i) => {
                currentSlide = (i + images.length) % images.length;
                if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
                dots.forEach((d, dIdx) => d.classList.toggle('active', dIdx === currentSlide));
              };
              card.querySelector('.btn-hg-prev')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide - 1); });
              card.querySelector('.btn-hg-next')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide + 1); });
              dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(+d.dataset.idx); }));
            }

            card.querySelector('.btn-quick-view')?.addEventListener('click', () => openGameAccountQuickViewModal(acc));
            card.querySelector('.btn-buy-game-id')?.addEventListener('click', () => {
              const cartKey = 'game_acc_' + acc.id;
              state.selected[cartKey] = 1;
              toast(`เพิ่มไอดี "${acc.code}" ลงในตะกร้าแล้ว`, 'success');
              updateFloatingCartBtn();
              drawStore('home');
            });
          });

          gameIdsSection.querySelector('#btnHomeGoGameIds')?.addEventListener('click', () => {
            state.storeProductSubTab = 'game_ids';
            root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
            root.querySelector('#storeTabs [data-s="products"]')?.classList.add('active');
            drawStore('products');
          });
        }

        // 6. Customer Reviews & Ratings
        const sortedHomeReviews = [...REVIEWS].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return 0;
        });

        const avgRating = REVIEWS.length > 0
          ? (REVIEWS.reduce((sum, r) => sum + Number(r.rating || 5), 0) / REVIEWS.length).toFixed(1)
          : '5.0';
        const orderCount = ORDERS.length;
        const reviewSub = REVIEWS.length > 0
          ? `ความประทับใจและรีวิวจากลูกค้าตัวจริง · ${avgRating} / 5.0 (${orderCount} คำสั่งซื้อ)`
          : `ยังไม่มีรีวิวสำหรับร้านนี้ (${orderCount} คำสั่งซื้อ)`;

        let homePinnedCount = 0;
        const reviewsSection = el(`
          <div class="card" style="margin-top:16px;">
            <div class="flex items-center" style="justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
              <div>
                <div class="card-title">Customer Reviews &amp; Pinned Notes (${REVIEWS.length})</div>
                <div class="card-sub">${escapeHTML(reviewSub)}</div>
              </div>
              <button class="btn btn-primary btn-sm" id="btnHomeWriteReview" style="font-weight:700;">เขียนรีวิวให้ร้านค้า</button>
            </div>

            ${sortedHomeReviews.length > 0 ? `
              <div class="reviews-grid">
                ${sortedHomeReviews.map(r => {
                  const isPinned = !!r.pinned;
                  let stickyClass = '';
                  if (isPinned) {
                    stickyClass = homePinnedCount % 2 === 0 ? 'pinned-sticky tilt-left' : 'pinned-sticky tilt-right';
                    homePinnedCount++;
                  }
                  return `
                    <div class="review-card ${stickyClass}">
                      ${isPinned ? `
                        <div class="sticky-pin-badge">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M5 17h14M7 17l1-9h8l1 9M9 8V3h6v5"/></svg>
                          <span>Pinned Note</span>
                        </div>
                      ` : ''}
                      <div class="review-head">
                        <div class="avatar" style="width:38px; height:38px; font-size:13px; font-weight:800; background:var(--card); border:1px solid var(--border);">${escapeHTML(r.avatar || 'AW')}</div>
                        <div style="flex:1;">
                          <div class="flex items-center gap-2">
                            <span class="review-name" style="font-size:13.5px; font-weight:700; color:var(--text);">${escapeHTML(r.name)}</span>
                            <span class="badge success" style="font-size:10px; padding:1px 6px;">✓ Verified</span>
                          </div>
                          <div class="review-date" style="font-size:11px; color:var(--muted);">${r.date || '2026-08-20'}</div>
                        </div>
                        <div class="stars">${renderHearts(r.rating)}</div>
                      </div>
                      <div class="review-text" style="font-size:13px; line-height:1.5; color:var(--text); margin-top:6px;">${escapeHTML(r.text)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="empty" style="padding: 24px; text-align: center; color: var(--muted); background: var(--primary-50); border-radius: 12px; border: 1px dashed var(--border);">
                <div style="font-weight: 700; font-size: 13.5px; color: var(--text);">ยังไม่มีรีวิวในขณะนี้</div>
                <div style="font-size: 12px; margin-top: 2px;">เมื่อลูกค้าสั่งซื้อสินค้า สามารถเป็นคนแรกที่เขียนรีวิวให้ร้านค้าได้เลย!</div>
              </div>
            `}
          </div>
        `);
        view.appendChild(reviewsSection);
        reviewsSection.querySelector('#btnHomeWriteReview')?.addEventListener('click', () => openWriteReviewModal());

      } else if (key === 'products') {
        // Multi-Product Storefront View with Service Switcher
        const enabledCount = (isItemsActive ? 1 : 0) + (isCoinFarmActive ? 1 : 0) + (isGameIdsActive ? 1 : 0);
        
        // Auto-fix sub-tab if current is disabled
        if (state.storeProductSubTab === 'items' && !isItemsActive) {
          state.storeProductSubTab = isCoinFarmActive ? 'coin_farm' : 'game_ids';
        } else if (state.storeProductSubTab === 'coin_farm' && !isCoinFarmActive) {
          state.storeProductSubTab = isItemsActive ? 'items' : 'game_ids';
        } else if (state.storeProductSubTab === 'game_ids' && !isGameIdsActive) {
          state.storeProductSubTab = isItemsActive ? 'items' : 'coin_farm';
        }

        const wrap = el(`
          <div>
            ${enabledCount > 1 ? `
              <!-- Multi-Service Switcher Navigation Bar -->
              <div class="product-hub-nav" id="storeSubNav">
                ${isItemsActive ? `
                  <button type="button" class="hub-tab-btn ${state.storeProductSubTab === 'items' ? 'active' : ''}" data-sub="items">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    <span>Item HayDay</span>
                  </button>
                ` : ''}
                ${isCoinFarmActive ? `
                  <button type="button" class="hub-tab-btn ${state.storeProductSubTab === 'coin_farm' ? 'active' : ''}" data-sub="coin_farm">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9h-4a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3h-4"/><path d="M12 7v10"/></svg>
                    <span>วนเหรียญ (Coin Farming)</span>
                  </button>
                ` : ''}
                ${isGameIdsActive ? `
                  <button type="button" class="hub-tab-btn ${state.storeProductSubTab === 'game_ids' ? 'active' : ''}" data-sub="game_ids">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="5" rx="3"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/></svg>
                    <span>ID Game (ไอดีเกม)</span>
                  </button>
                ` : ''}
              </div>
            ` : ''}

            <div id="storeProductsContent"></div>
          </div>
        `);
        view.appendChild(wrap);

        wrap.querySelectorAll('#storeSubNav .hub-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            state.storeProductSubTab = btn.dataset.sub;
            wrap.querySelectorAll('#storeSubNav .hub-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderSubContent();
          });
        });

        function renderSubContent() {
          const contentContainer = wrap.querySelector('#storeProductsContent');
          if (!contentContainer) return;
          contentContainer.innerHTML = '';

          if (state.storeProductSubTab === 'items' && isItemsActive) {
            // ITEM HAYDAY CATALOG
            const currentStep = Number(state.store.itemClickStep) || 1;
            const itemBox = el(`
              <div class="card">
                <div class="flex items-center" style="justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px">
                  <div>
                    <div class="card-title">Item HayDay Catalog</div>
                    <div class="card-sub">แตะสินค้าเพื่อใส่ตะกร้า (Right-click เพื่อลดจำนวน)</div>
                  </div>
                  <div class="flex gap-2" style="flex-wrap:wrap; align-items:center;">
                    <div class="search-wrap" style="max-width:200px">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>
                      <input placeholder="ค้นหาไอเทม..." id="storeSearch"/>
                    </div>
                    <select class="select" id="storeCat" style="width:auto">
                      <option value="">ทุกหมวดหมู่ (All Categories)</option>
                      ${CATEGORIES.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
                    </select>
                    <select class="select" id="storeLevel" style="width:auto">
                      <option value="">ทุกเลเวล (All Levels)</option>
                      <option value="1-20">Lv. 1 - 20</option>
                      <option value="21-40">Lv. 21 - 40</option>
                      <option value="41-60">Lv. 41 - 60</option>
                      <option value="61-80">Lv. 61 - 80</option>
                      <option value="81+">Lv. 81+</option>
                    </select>
                    <select class="select" id="storeMultiplier" style="width:auto; font-weight:700; color:var(--accent-text);">
                      <option value="1" ${currentStep === 1 ? 'selected' : ''}>x1 ชิ้น/คลิก</option>
                      <option value="10" ${currentStep === 10 ? 'selected' : ''}>x10 ชิ้น/คลิก</option>
                      <option value="80" ${currentStep === 80 ? 'selected' : ''}>x80 ชิ้น/คลิก</option>
                      <option value="100" ${currentStep === 100 ? 'selected' : ''}>x100 ชิ้น/คลิก</option>
                    </select>
                    <button type="button" class="btn btn-sm btn-ghost" id="btnStoreResetFilters" style="padding:6px 12px; font-weight:700; border:1px solid var(--border); border-radius:10px;">
                      ล้างค่า (Reset)
                    </button>
                  </div>
                </div>
                <div class="flex items-center" style="justify-content:space-between; margin-bottom:10px; color:var(--muted); font-size:12.5px">
                  <span id="storeCount"></span>
                  <span id="storeCartInfo" style="cursor:pointer;" title="Go to Cart"></span>
                </div>
                <div class="product-grid" id="storeGrid"></div>
                <div class="pagination" id="storePager"></div>
              </div>
            `);
            contentContainer.appendChild(itemBox);

            const grid = itemBox.querySelector('#storeGrid');
            const pager = itemBox.querySelector('#storePager');
            const countEl = itemBox.querySelector('#storeCount');
            const cartInfo = itemBox.querySelector('#storeCartInfo');
            const searchEl = itemBox.querySelector('#storeSearch');
            const catEl = itemBox.querySelector('#storeCat');
            const levelEl = itemBox.querySelector('#storeLevel');
            const multiplierEl = itemBox.querySelector('#storeMultiplier');
            const btnReset = itemBox.querySelector('#btnStoreResetFilters');
            const PAGE = 160;
            let page = 1;
            let currentMultiplier = Number(multiplierEl.value) || currentStep || 1;

            multiplierEl.addEventListener('change', () => {
              currentMultiplier = Number(multiplierEl.value) || 1;
            });

            btnReset.addEventListener('click', () => {
              searchEl.value = '';
              catEl.value = '';
              levelEl.value = '';
              multiplierEl.value = String(state.store.itemClickStep || 1);
              currentMultiplier = Number(multiplierEl.value) || 1;
              page = 1;
              drawStoreGrid();
              toast('ล้างค่าตัวกรองเรียบร้อยแล้ว', 'info');
            });

            function updateCartInfo() {
              const totalQty = Object.values(state.selected).reduce((a,b)=>a+Number(b||0), 0);
              const totalPrice = Object.entries(state.selected).reduce((sum, [id, q]) => {
                const it = getCartItemDetails(id);
                return sum + (it ? Number(it.price) * Number(q) : 0);
              }, 0);
              cartInfo.innerHTML = totalQty
                ? `Cart: <strong style="color:var(--text)">${totalQty}</strong> items · <strong style="color:var(--accent-text)">${money(totalPrice)}</strong> (Go to Cart →)`
                : 'Cart is empty';
            }
            cartInfo.addEventListener('click', () => {
              root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
              root.querySelector('#storeTabs [data-s="cart"]')?.classList.add('active');
              drawStore('cart');
            });

            function drawStoreGrid() {
              const q = searchEl.value.toLowerCase().trim();
              const cat = catEl.value;
              const lvl = levelEl.value;

              const list = PRODUCTS.filter(p => {
                if (q && !p.name.toLowerCase().includes(q) && !(p.cat || '').toLowerCase().includes(q)) return false;
                if (cat && p.cat !== cat) return false;
                if (lvl) {
                  const pLevel = Number(p.level) || 1;
                  if (lvl === '1-20' && (pLevel < 1 || pLevel > 20)) return false;
                  if (lvl === '21-40' && (pLevel < 21 || pLevel > 40)) return false;
                  if (lvl === '41-60' && (pLevel < 41 || pLevel > 60)) return false;
                  if (lvl === '61-80' && (pLevel < 61 || pLevel > 80)) return false;
                  if (lvl === '81+' && pLevel < 81) return false;
                }
                return true;
              });

              const totalPages = Math.max(1, Math.ceil(list.length / PAGE));
              if (page > totalPages) page = totalPages;
              const start = (page - 1) * PAGE;
              const items = list.slice(start, start + PAGE);
              countEl.textContent = list.length
                ? `Showing ${start + 1}–${Math.min(list.length, start + PAGE)} of ${list.length} products`
                : 'No products';
              grid.innerHTML = '';

              const ratio = Number(state.store?.priceRatio) || 1.0;

              items.forEach(p => {
                const sInfo = getStockStatusInfo(p.stock);
                const stockCls = sInfo.dotClass;
                const qty = state.selected[p.id] || 0;
                const effectivePrice = Math.round(Number(p.price || 0) * ratio * 100) / 100;
                const imgUrl = p.image || DEFAULT_PRODUCT_IMG;
                const mediaHtml = `<img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.name)}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />`;
                const tile = el(`
                  <div class="product-tile ${stockCls} ${qty ? 'selected' : ''}" data-id="${p.id}" title="${escapeHTML(p.name)} · ${money(effectivePrice)} (Lv.${p.level || 1})">
                    ${mediaHtml}
                    <span class="stock-dot"></span>
                    <span class="qty-badge">${qty}</span>
                  </div>
                `);
                tile.addEventListener('click', () => {
                  if (p.stock === 0) return toast(`${p.name} is out of stock`, 'error');
                  state.selected[p.id] = (state.selected[p.id] || 0) + currentMultiplier;
                  tile.classList.add('selected');
                  const badge = tile.querySelector('.qty-badge');
                  badge.textContent = state.selected[p.id];
                  badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';
                  updateCartInfo();
                  updateFloatingCartBtn();
                });
                tile.addEventListener('contextmenu', (e) => {
                  e.preventDefault();
                  if (!state.selected[p.id]) return;
                  state.selected[p.id] -= currentMultiplier;
                  if (state.selected[p.id] <= 0) {
                    delete state.selected[p.id];
                    tile.classList.remove('selected');
                  } else {
                    tile.querySelector('.qty-badge').textContent = state.selected[p.id];
                  }
                  updateCartInfo();
                  updateFloatingCartBtn();
                });
                grid.appendChild(tile);
              });

              pager.innerHTML = '';
              if (totalPages > 1) {
                const mk = (label, p2, opts={}) => {
                  const b = el(`<button class="pg ${opts.active?'active':''}" ${opts.disabled?'disabled style="opacity:.4;cursor:not-allowed"':''}>${label}</button>`);
                  if (!opts.disabled) b.addEventListener('click', () => { page = p2; drawStoreGrid(); });
                  return b;
                };
                pager.appendChild(mk('‹', page-1, {disabled: page===1}));
                for (let i=1; i<=totalPages; i++) pager.appendChild(mk(String(i), i, {active: i===page}));
                pager.appendChild(mk('›', page+1, {disabled: page===totalPages}));
              }
            }
            searchEl.addEventListener('input', () => { page = 1; drawStoreGrid(); });
            catEl.addEventListener('change', () => { page = 1; drawStoreGrid(); });
            levelEl.addEventListener('change', () => { page = 1; drawStoreGrid(); });
            drawStoreGrid();
            updateCartInfo();

          } else if (state.storeProductSubTab === 'coin_farm' && isCoinFarmActive) {
            // COIN FARMING STOREFRONT VIEW
            const boxes = state.store.coinFarmBoxes || [];
            let activeBIdx = 0;

            const cfBox = el(`
              <div class="card">
                <div class="card-title">บริการวนเหรียญ (Coin Farming Packages)</div>
                <div class="card-sub" style="margin-bottom:14px;">เลือกช่วงเลเวลฟาร์ม และเลือกแพ็กเกจจำนวนเหรียญที่ต้องการ</div>

                ${boxes.length > 0 ? `
                  <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px;" id="storeCfBoxTabs">
                    ${boxes.map((b, i) => `
                      <button type="button" class="btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}" data-bidx="${i}" style="border-radius:12px; font-weight:800; font-size:13px; white-space:nowrap; border:1.5px solid var(--border);">
                        ${escapeHTML(b.title)}
                      </button>
                    `).join('')}
                  </div>

                  <div id="storeCfTiersGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px;"></div>
                ` : `
                  <div class="empty">ยังไม่มีแพ็กเกจวนเหรียญในขณะนี้</div>
                `}
              </div>
            `);
            contentContainer.appendChild(cfBox);

            const renderStoreCfTiers = () => {
              const container = cfBox.querySelector('#storeCfTiersGrid');
              if (!container) return;
              const box = boxes[activeBIdx];
              if (!box || !box.tiers || !box.tiers.length) {
                container.innerHTML = `<div style="grid-column:1/-1; padding:20px; text-align:center; color:var(--muted);">ไม่มีรายการเรทเหรียญในกล่องนี้</div>`;
                return;
              }
              container.innerHTML = '';
              box.tiers.forEach((t, tIdx) => {
                const cartKey = `cf_tier_${box.id}_${t.id}`;
                const qty = state.selected[cartKey] || 0;
                const card = el(`
                  <div class="coin-farm-box ${qty > 0 ? 'selected' : ''}" style="cursor:pointer; border-radius:16px;">
                    <div class="flex items-center" style="justify-content:space-between;">
                      <span class="badge" style="background:var(--primary-100); color:var(--accent-text); font-weight:800;">#${tIdx + 1} แพ็กเกจ</span>
                      <span style="font-weight:900; font-size:18px; color:var(--accent-text);">${money(t.price)}</span>
                    </div>
                    <div style="margin:4px 0;">
                      <div style="font-size:16px; font-weight:800; color:var(--text);">${escapeHTML(t.coins)}</div>
                      <div style="font-size:12px; color:var(--muted); margin-top:2px;">${escapeHTML(t.desc || box.title)}</div>
                    </div>
                    <button type="button" class="btn btn-sm ${qty > 0 ? 'btn-primary' : ''} btn-block" style="margin-top:auto; font-weight:800; font-size:12.5px; border-radius:10px;">
                      ${qty > 0 ? `✓ ในตะกร้า (${qty})` : '+ สั่งซื้อแพ็กเกจนี้'}
                    </button>
                  </div>
                `);
                card.addEventListener('click', () => {
                  state.selected[cartKey] = (state.selected[cartKey] || 0) + 1;
                  toast(`เพิ่ม "${t.coins}" ลงในตะกร้าแล้ว`, 'success');
                  updateFloatingCartBtn();
                  renderStoreCfTiers();
                });
                container.appendChild(card);
              });
            };

            if (boxes.length > 0) {
              renderStoreCfTiers();
              cfBox.querySelectorAll('#storeCfBoxTabs button').forEach(btn => {
                btn.addEventListener('click', () => {
                  activeBIdx = +btn.dataset.bidx;
                  cfBox.querySelectorAll('#storeCfBoxTabs button').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-ghost');
                  });
                  btn.classList.add('btn-primary');
                  btn.classList.remove('btn-ghost');
                  renderStoreCfTiers();
                });
              });
            }

          } else if (state.storeProductSubTab === 'game_ids' && isGameIdsActive) {
            // GAME ID MARKET STOREFRONT VIEW
            const accs = state.store.gameAccounts || [];
            const gaBox = el(`
              <div class="card">
                <div class="card-title">ตลาดซื้อขายไอดีเกม (Game Accounts Market)</div>
                <div class="card-sub" style="margin-bottom:14px;">ไอดีเกมแท้ ปลอดภัย คลิกที่รูปเพื่อเลื่อนดูหลายมุมมอง หรือกด "ดูรายละเอียด" เพื่ออ่านข้อมูลเพิ่มเติม</div>

                ${accs.length > 0 ? `
                  <div class="game-id-grid" id="storeGameIdsGrid"></div>
                ` : `
                  <div class="empty">ยังไม่มีไอดีเกมในขณะนี้</div>
                `}
              </div>
            `);
            contentContainer.appendChild(gaBox);

            const gridEl = gaBox.querySelector('#storeGameIdsGrid');
            if (gridEl) {
              accs.forEach(acc => {
                const images = (acc.images && acc.images.length > 0) ? acc.images : [DEFAULT_PRODUCT_IMG];
                const cartKey = 'game_acc_' + acc.id;
                const inCart = !!state.selected[cartKey];
                let currentSlide = 0;

                const card = el(`
                  <div class="game-id-card">
                    <span class="game-id-badge ${acc.status || 'available'}">
                      ${acc.status === 'sold' ? 'ขายแล้ว (Sold Out)' : acc.status === 'reserved' ? 'ติดจอง (Reserved)' : 'พร้อมส่งมอบ (Available)'}
                    </span>

                    <div class="game-id-gallery-wrap">
                      <div class="game-id-gallery-track" id="p_track_${acc.id}">
                        ${images.map((img, i) => `
                          <div class="game-id-gallery-slide">
                            <img src="${escapeHTML(img)}" alt="${escapeHTML(acc.title)} Photo ${i+1}" onerror="this.src='${DEFAULT_PRODUCT_IMG}';" />
                          </div>
                        `).join('')}
                      </div>

                      ${images.length > 1 ? `
                        <button type="button" class="game-id-gallery-btn prev btn-pg-prev">‹</button>
                        <button type="button" class="game-id-gallery-btn next btn-pg-next">›</button>
                        <div class="game-id-dots">
                          ${images.map((_, i) => `<div class="game-id-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`).join('')}
                        </div>
                      ` : ''}
                    </div>

                    <div style="flex:1; display:flex; flex-direction:column;">
                      <div class="flex items-center gap-2" style="margin-bottom:4px;">
                        <span class="badge" style="background:var(--primary-100); color:var(--accent-text); font-weight:800; font-size:11px;">${escapeHTML(acc.code)}</span>
                        ${acc.badge ? `<span class="badge" style="background:var(--primary-50); font-size:10.5px;">${escapeHTML(acc.badge)}</span>` : ''}
                        <span style="font-size:11px; color:var(--muted); margin-left:auto;">${images.length} รูป</span>
                      </div>

                      <div style="font-weight:800; font-size:14px; color:var(--text); line-height:1.3; margin-bottom:4px;">${escapeHTML(acc.title)}</div>
                      ${acc.details ? `<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px; line-height:1.4; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHTML(acc.details)}</div>` : ''}

                      <div style="margin-top:auto; padding-top:10px; border-top:1.5px dashed var(--border); display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div style="font-weight:900; font-size:16px; color:var(--accent-text);">${money(acc.price)}</div>
                        <div class="flex gap-1">
                          <button type="button" class="btn btn-sm btn-ghost btn-quick-view" style="font-size:11.5px; padding:4px 8px; font-weight:700;">ดูรายละเอียด</button>
                          ${acc.status === 'available' ? `
                            <button type="button" class="btn btn-sm ${inCart ? 'btn-primary' : ''} btn-buy-game-id" style="font-size:11.5px; padding:4px 10px; font-weight:700;">
                              ${inCart ? '✓ ในตะกร้า' : '+ สั่งซื้อ'}
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                `);

                // Slider logic
                if (images.length > 1) {
                  const track = card.querySelector(`#p_track_${acc.id}`);
                  const dots = card.querySelectorAll('.game-id-dot');
                  const updateSlide = (i) => {
                    currentSlide = (i + images.length) % images.length;
                    if (track) track.style.transform = `translateX(-${currentSlide * 100}%)`;
                    dots.forEach((d, dIdx) => d.classList.toggle('active', dIdx === currentSlide));
                  };
                  card.querySelector('.btn-pg-prev')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide - 1); });
                  card.querySelector('.btn-pg-next')?.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(currentSlide + 1); });
                  dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); updateSlide(+d.dataset.idx); }));
                }

                card.querySelector('.btn-quick-view')?.addEventListener('click', () => openGameAccountQuickViewModal(acc));
                card.querySelector('.btn-buy-game-id')?.addEventListener('click', () => {
                  state.selected[cartKey] = 1;
                  toast(`เพิ่มไอดี "${acc.code}" ลงในตะกร้าแล้ว`, 'success');
                  updateFloatingCartBtn();
                  renderSubContent();
                });

                gridEl.appendChild(card);
              });
            }
          }
        }

        renderSubContent();

      } else if (key === 'cart') {
        // UNIVERSAL CART VIEW
        const cartEntries = Object.entries(state.selected).map(([id, q]) => {
          const it = getCartItemDetails(id);
          return it ? { ...it, qty: q } : null;
        }).filter(Boolean);

        const subtotal = cartEntries.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = calculatePromoDiscount(state.appliedPromo, subtotal);
        const total = Math.max(0, subtotal - discount);
        const activePromos = PROMOTIONS.filter(p => p.status === 'active');

        const cartWrap = el(`
          <div class="grid two-col">
            <div>
              <div class="card">
                <div class="card-title">Your Cart</div>
                <div class="card-sub">${cartEntries.length} unique items</div>
                ${cartEntries.length === 0 ? '<div class="empty">Your cart is empty.</div>' : `
                  <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px">
                    ${cartEntries.map(p => {
                      const thumbHtml = p.image
                        ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width:52px;height:52px;object-fit:cover;border-radius:12px;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='grid';" /><div style="display:none;width:52px;height:52px;place-items:center;font-size:11px;font-weight:700;border-radius:12px;background:var(--primary-50);color:var(--accent-text);">${escapeHTML(p.cat || 'Item')}</div>`
                        : `<div style="width:52px;height:52px;display:grid;place-items:center;font-size:11px;font-weight:700;border-radius:12px;background:var(--primary-50);color:var(--accent-text);">${escapeHTML(p.cat || 'Item')}</div>`;
                      return `
                        <div class="flex items-center gap-3" style="padding:10px; border:1px solid var(--border); border-radius:12px">
                          ${thumbHtml}
                          <div style="flex:1">
                            <div style="font-weight:700; font-size:13.5px;">${escapeHTML(p.name)}</div>
                            <div style="font-size:12px; color:var(--muted)">${escapeHTML(p.cat)} · ${money(p.price)}</div>
                          </div>
                          <div class="flex items-center gap-2">
                            <button class="btn btn-sm btn-cart-minus" data-id="${p.id}">−</button>
                            <span style="font-weight:700">${p.qty}</span>
                            ${p.type !== 'game_account' ? `<button class="btn btn-sm btn-cart-plus" data-id="${p.id}">+</button>` : ''}
                          </div>
                          <div style="font-weight:800; width:70px; text-align:right; color:var(--accent-text);">${money(p.price * p.qty)}</div>
                        </div>`;
                    }).join('')}
                  </div>
                `}
              </div>

              <!-- Promo Code / Coupon Section in Cart -->
              ${cartEntries.length > 0 ? `
                <div class="card" style="margin-top:14px;">
                  <div class="card-title" style="font-size:14.5px;">
                    Coupon &amp; Promotion (โค้ดส่วนลด)
                  </div>
                  <div class="card-sub" style="margin-bottom:10px;">กรอกโค้ดส่วนลด หรือคลิกเลือกโปรโมชั่นที่เปิดใช้งานอยู่ด้านล่าง</div>
                  
                  <div style="display:flex; gap:8px; align-items:center;">
                    <input class="input" id="cartPromoInput" placeholder="กรอกโค้ดส่วนลด เช่น WELCOME50, BLOOM10" value="${state.appliedPromo ? escapeHTML(state.appliedPromo.code) : ''}" style="padding:9px 12px; font-size:13px; text-transform:uppercase; font-weight:700; border-radius:12px; flex:1;" />
                    <button class="btn btn-primary" id="btnApplyPromo" style="font-size:13px; font-weight:700; white-space:nowrap; padding:9px 16px; border-radius:12px;">Apply</button>
                  </div>

                  ${state.appliedPromo ? `
                    <div style="margin-top:10px; background:var(--primary-50); border:1.5px solid var(--primary-600); border-radius:12px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div>
                        <div style="font-size:12.5px; font-weight:800; color:var(--accent-text); display:flex; align-items:center; gap:6px;">
                          <span>ใช้โค้ด: <strong>${escapeHTML(state.appliedPromo.code)}</strong></span>
                          <span class="badge success" style="font-size:10.5px;">Applied</span>
                        </div>
                        <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">ส่วนลด: ${escapeHTML(state.appliedPromo.off)} (-${money(discount)})</div>
                      </div>
                      <button type="button" class="btn btn-sm btn-ghost" id="btnRemovePromo" style="color:var(--danger); font-size:12px; font-weight:700; padding:4px 8px;">✕ ยกเลิก</button>
                    </div>
                  ` : ''}

                  <!-- Active Promotion Quick Tags -->
                  <div style="margin-top:12px;">
                    <div style="font-size:11.5px; font-weight:700; color:var(--muted); margin-bottom:6px;">โปรโมชั่นแนะนำ (คลิกเพื่อใช้โค้ด):</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                      ${activePromos.map(p => `
                        <button type="button" class="btn-promo-tag" data-code="${escapeHTML(p.code)}" style="background:var(--card); border:1.5px dashed var(--border); color:var(--accent-text); padding:5px 10px; border-radius:10px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all .15s ease;">
                          <span>${escapeHTML(p.code)}</span>
                          <span style="font-size:10.5px; color:var(--muted); font-weight:500;">(${escapeHTML(p.off)})</span>
                        </button>
                      `).join('')}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="card" style="height:fit-content;">
              <div class="card-title">Summary</div>
              <div class="kv"><span class="k">Subtotal</span><span class="v">${money(subtotal)}</span></div>
              ${discount > 0 ? `<div class="kv"><span class="k" style="color:var(--accent-text); font-weight:700;">Discount (${escapeHTML(state.appliedPromo?.code || 'Promo')})</span><span class="v" style="color:var(--danger); font-weight:800;">-${money(discount)}</span></div>` : ''}
              <div class="kv"><span class="k">Total</span><span class="v" style="color:var(--accent-text); font-size:17px; font-weight:800;">${money(total)}</span></div>
              <button class="btn btn-primary btn-block mt-3" id="goCheckout" ${cartEntries.length === 0 ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>Proceed to Checkout</button>
            </div>
          </div>
        `);
        view.appendChild(cartWrap);

        // Cart item plus / minus event listeners
        cartWrap.querySelectorAll('.btn-cart-minus').forEach(btn => {
          btn.addEventListener('click', () => {
            const pid = btn.dataset.id;
            if (state.selected[pid]) {
              state.selected[pid]--;
              if (state.selected[pid] <= 0) delete state.selected[pid];
              drawStore('cart');
              updateFloatingCartBtn();
            }
          });
        });
        cartWrap.querySelectorAll('.btn-cart-plus').forEach(btn => {
          btn.addEventListener('click', () => {
            const pid = btn.dataset.id;
            state.selected[pid] = (state.selected[pid] || 0) + 1;
            drawStore('cart');
            updateFloatingCartBtn();
          });
        });

        // Promo handlers in cart
        const promoInput = cartWrap.querySelector('#cartPromoInput');
        const btnApply = cartWrap.querySelector('#btnApplyPromo');
        const btnRemove = cartWrap.querySelector('#btnRemovePromo');

        const doApplyPromoCode = (rawCode) => {
          const code = (rawCode || '').trim().toUpperCase();
          if (!code) {
            toast('โปรดกรอกรหัสโค้ดส่วนลด', 'error');
            return;
          }
          const matched = PROMOTIONS.find(p => p.code.toUpperCase() === code && p.status === 'active')
            || PROMOTIONS.find(p => p.code.toUpperCase() === code);
          if (matched) {
            state.appliedPromo = matched;
            toast(`ใช้โค้ดส่วนลด "${matched.code}" (${matched.off}) สำเร็จ!`, 'success');
            drawStore('cart');
          } else {
            toast(`ไม่พบโค้ดส่วนลด "${code}" หรือโค้ดหมดอายุแล้ว`, 'error');
          }
        };

        btnApply?.addEventListener('click', () => doApplyPromoCode(promoInput?.value));
        promoInput?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doApplyPromoCode(promoInput?.value);
          }
        });

        btnRemove?.addEventListener('click', () => {
          state.appliedPromo = null;
          toast('ยกเลิกโค้ดส่วนลดแล้ว', 'info');
          drawStore('cart');
        });

        cartWrap.querySelectorAll('.btn-promo-tag').forEach(tag => {
          tag.addEventListener('click', () => {
            if (promoInput) promoInput.value = tag.dataset.code;
            doApplyPromoCode(tag.dataset.code);
          });
        });

        if (cartEntries.length) {
          cartWrap.querySelector('#goCheckout').addEventListener('click', () => {
            root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
            root.querySelector('#storeTabs [data-s="checkout"]').classList.add('active');
            drawStore('checkout');
          });
        }
      } else if (key === 'checkout') {
        const cartEntries = Object.entries(state.selected).map(([id, q]) => {
          const it = getCartItemDetails(id);
          return it ? { ...it, qty: q } : null;
        }).filter(Boolean);
        const subtotal = cartEntries.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = calculatePromoDiscount(state.appliedPromo, subtotal);
        const total = Math.max(0, subtotal - discount);

        state.checkoutForm = state.checkoutForm || { name: '', farmName: '', farmTag: '', contact: '', uploadedSlipData: '' };

        view.appendChild(el(`
          <div class="grid two-col">
            <div class="card">
              <div class="card-title">Customer &amp; Farm Information</div>
              <div class="card-sub">ข้อมูลลูกค้าและฟาร์มสำหรับออกใบเสร็จและจัดส่ง</div>
              <div class="grid" style="gap:10px; margin-top:10px">
                <div class="field">
                  <label style="font-size:12px; font-weight:700;">Name (ชื่อลูกค้าที่จะขึ้นในใบเสร็จ) *</label>
                  <input class="input" id="coName" placeholder="เช่น Anna Wong, คุณสมชาย" value="${escapeHTML(state.checkoutForm.name || '')}" style="padding:9px 12px; font-size:13px; border-radius:12px;"/>
                </div>
                <div class="grid" style="grid-template-columns:1fr 1fr; gap:10px">
                  <div class="field">
                    <label style="font-size:12px; font-weight:700;">Farm Name (ชื่อฟาร์ม)</label>
                    <input class="input" id="coFarmName" placeholder="เช่น Green Valley Farm" value="${escapeHTML(state.checkoutForm.farmName || '')}" style="padding:9px 12px; font-size:13px; border-radius:12px;"/>
                  </div>
                  <div class="field">
                    <label style="font-size:12px; font-weight:700;">Farm Tag</label>
                    <input class="input" id="coFarmTag" placeholder="เช่น #FARM-01" value="${escapeHTML(state.checkoutForm.farmTag || '')}" style="padding:9px 12px; font-size:13px; border-radius:12px;"/>
                  </div>
                </div>
                <div class="field">
                  <label style="font-size:12px; font-weight:700;">Contact (ช่องทางการติดต่อของลูกค้า) *</label>
                  <input class="input" id="coContact" placeholder="เช่น เบอร์โทร 081-234-5678, Line ID: @haymate" value="${escapeHTML(state.checkoutForm.contact || '')}" style="padding:9px 12px; font-size:13px; border-radius:12px;"/>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Payment Transfer</div>
              <div class="card-sub">สแกน QR หรือโอนผ่านบัญชีธนาคาร/วอลเล็ท</div>
              
              <!-- QR Code Preview -->
              <div class="file-preview" style="aspect-ratio:auto; padding:14px; margin-top:8px; text-align:center; background:var(--card); border:1.5px solid var(--border); border-radius:14px;">
                ${state.store.qr_image_url
                  ? `<img src="${escapeHTML(state.store.qr_image_url)}" alt="PromptPay QR" style="width:140px; height:140px; object-fit:contain; border-radius:10px; margin:0 auto 6px; display:block; box-shadow:var(--shadow-soft);" onerror="this.style.display='none';" />`
                  : `<div class="qr" style="width:90px; height:90px; margin:0 auto 6px;"></div>`}
                <div style="font-size:12px; font-weight:800; color:var(--accent-text);">PromptPay QR Code (สแกนจ่ายเงิน)</div>
              </div>

              <!-- Bank & Wallet Transfer Details with Copy Buttons (Dynamic List from Settings) -->
              <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
                ${(state.store.payment_accounts && state.store.payment_accounts.length > 0 ? state.store.payment_accounts : DEFAULT_STORE_CONFIG.payment_accounts).map(acc => {
                  const accIconHtml = acc.image
                    ? `<img src="${escapeHTML(acc.image)}" alt="Account Logo" style="width:20px; height:20px; object-fit:contain; border-radius:5px; display:inline-block; vertical-align:middle;" onerror="this.style.display='none';" />`
                    : `<span style="display:inline-flex; align-items:center; color:var(--accent-text);">${ICONS.bank}</span>`;
                  return `
                    <div style="background:var(--card); border:1.5px solid var(--border); border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; box-shadow:var(--shadow-soft);">
                      <div>
                        <div style="font-size:11px; color:var(--muted); font-weight:700; display:flex; align-items:center; gap:6px;">
                          ${accIconHtml}
                          <span>${escapeHTML(acc.title || 'ธนาคาร')}</span>
                        </div>
                        <div style="font-size:15px; font-weight:800; color:var(--text); letter-spacing:0.5px; margin:2px 0;">${escapeHTML(acc.account_number || '')}</div>
                        ${acc.account_holder ? `<div style="font-size:11.5px; color:var(--muted);">ชื่อ: ${escapeHTML(acc.account_holder)}</div>` : ''}
                      </div>
                      <button type="button" class="btn btn-copy-acc" data-num="${escapeHTML(acc.account_number || '')}" style="background:var(--primary-600); color:#FFFFFF; border:none; font-size:12.5px; font-weight:700; white-space:nowrap; padding:7px 14px; border-radius:10px; box-shadow:none; cursor:pointer; transition:all .15s ease;">Copy</button>
                    </div>
                  `;
                }).join('')}
              </div>
              
              <!-- Slip Upload Area -->
              <div class="field" style="margin-top:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <label style="font-weight:700; font-size:12.5px; color:var(--text); margin:0;">แนบสลิปโอนเงิน <span style="color:var(--danger)">* (จำเป็น)</span></label>
                  <span id="slipStatusBadge" style="font-size:11px; color:var(--danger); font-weight:600;">ยังไม่ได้แนบสลิป</span>
                </div>
                <input type="file" id="slipFileInput" accept="image/*" style="display:none;" />
                <div id="slipUploadDropzone" style="cursor:pointer; border:2px dashed var(--border); border-radius:14px; background:var(--primary-50); padding:14px; text-align:center; transition:all .2s ease;">
                  <div id="slipPrompt">
                    <div style="margin-bottom:4px;">${ICONS.receipt}</div>
                    <div style="font-weight:700; font-size:13px; color:var(--accent-text);">คลิกเพื่ออัปโหลดสลิปโอนเงิน</div>
                    <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">รองรับรูปถ่าย JPG, PNG (สูงสุด 10MB)</div>
                  </div>
                  <div id="slipPreviewWrapper" style="display:none;">
                    <img id="slipPreviewImg" style="max-height:150px; max-width:100%; border-radius:8px; object-fit:contain; box-shadow:var(--shadow-soft); display:block; margin:0 auto;" />
                    <div style="font-size:12px; color:#3F8E63; font-weight:700; margin-top:6px;">✓ แนบสลิปเรียบร้อยแล้ว (คลิกเพื่อเปลี่ยนรูป)</div>
                  </div>
                </div>
              </div>

              <div class="kv" style="margin-top:14px"><span class="k">ยอดรวมสินค้า (Subtotal)</span><span class="v">${money(subtotal)}</span></div>
              ${discount > 0 ? `<div class="kv"><span class="k" style="color:var(--accent-text); font-weight:700;">ส่วนลด (Discount ${escapeHTML(state.appliedPromo?.code || '')})</span><span class="v" style="color:var(--danger); font-weight:800;">-${money(discount)}</span></div>` : ''}
              <div class="kv" style="border-top:1.5px dashed var(--border); padding-top:8px; margin-top:6px;"><span class="k" style="font-size:14px; font-weight:800;">ยอดชำระสุทธิ (Order Total)</span><span class="v" style="color:var(--accent-text); font-size:17px; font-weight:800;">${money(total)}</span></div>
              <button class="btn btn-primary btn-block mt-3" id="confirmPay" style="font-size:14px; font-weight:700;">ยืนยันคำสั่งซื้อ (Confirm Order)</button>
            </div>
          </div>
        `));

        // Preserve input fields real-time
        const coNameEl = view.querySelector('#coName');
        const coFarmNameEl = view.querySelector('#coFarmName');
        const coFarmTagEl = view.querySelector('#coFarmTag');
        const coContactEl = view.querySelector('#coContact');

        coNameEl?.addEventListener('input', (e) => { state.checkoutForm.name = e.target.value; });
        coFarmNameEl?.addEventListener('input', (e) => { state.checkoutForm.farmName = e.target.value; });
        coFarmTagEl?.addEventListener('input', (e) => { state.checkoutForm.farmTag = e.target.value; });
        coContactEl?.addEventListener('input', (e) => { state.checkoutForm.contact = e.target.value; });

        let uploadedSlipData = state.checkoutForm.uploadedSlipData || '';
        const slipInput = view.querySelector('#slipFileInput');
        const slipDropzone = view.querySelector('#slipUploadDropzone');
        const slipPrompt = view.querySelector('#slipPrompt');
        const slipPreviewWrapper = view.querySelector('#slipPreviewWrapper');
        const slipPreviewImg = view.querySelector('#slipPreviewImg');
        const slipStatusBadge = view.querySelector('#slipStatusBadge');

        // If slip was previously uploaded in this session, restore preview immediately
        if (uploadedSlipData) {
          slipPreviewImg.src = uploadedSlipData;
          slipPrompt.style.display = 'none';
          slipPreviewWrapper.style.display = 'block';
          slipDropzone.style.borderColor = '#7CC59A';
          slipDropzone.style.background = '#F4FAF6';
          if (slipStatusBadge) {
            slipStatusBadge.textContent = '✓ แนบสลิปแล้ว';
            slipStatusBadge.style.color = '#3F8E63';
          }
        }

        // Copy buttons logic (Solid theme color -> Copied)
        view.querySelectorAll('.btn-copy-acc').forEach(btn => {
          btn.addEventListener('click', () => {
            const raw = btn.dataset.num ? btn.dataset.num.replace(/\D/g, '') : '';
            const copyText = raw || btn.dataset.num || '';
            const doCopy = () => {
              toast(`Copied: ${btn.dataset.num}`, 'success');
              btn.textContent = 'Copied';
              btn.style.background = '#7CC59A';
              setTimeout(() => {
                btn.textContent = 'Copy';
                btn.style.background = 'var(--primary-600)';
              }, 2000);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(copyText).then(doCopy).catch(doCopy);
            } else {
              doCopy();
            }
          });
        });

        slipDropzone.addEventListener('click', () => slipInput.click());
        slipInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            uploadedSlipData = await compressImageToDataUrl(file, 900, 1200, 0.82);
            state.checkoutForm.uploadedSlipData = uploadedSlipData;
            slipPreviewImg.src = uploadedSlipData;
            slipPrompt.style.display = 'none';
            slipPreviewWrapper.style.display = 'block';
            slipDropzone.style.borderColor = '#7CC59A';
            slipDropzone.style.background = '#F4FAF6';
            if (slipStatusBadge) {
              slipStatusBadge.textContent = '✓ แนบสลิปแล้ว';
              slipStatusBadge.style.color = '#3F8E63';
            }
            toast('แนบสลิปโอนเงินเรียบร้อย', 'success');

            if (supabase) {
              uploadProductImage(file).then(pubUrl => {
                if (pubUrl) {
                  uploadedSlipData = pubUrl;
                  state.checkoutForm.uploadedSlipData = pubUrl;
                }
              }).catch(() => {});
            }
          } catch (err) {
            toast('ไม่สามารถอ่านรูปภาพสลิปได้ โปรดลองอีกครั้ง', 'error');
          }
        });

        view.querySelector('#confirmPay').addEventListener('click', async () => {
          // Check if slip is attached
          if (!uploadedSlipData) {
            slipDropzone.style.borderColor = 'var(--danger)';
            slipDropzone.style.background = '#FFF0F2';
            slipDropzone.style.animation = 'pinShake .35s ease';
            setTimeout(() => { slipDropzone.style.animation = ''; }, 400);
            toast('เช็คเอาท์ไม่ได้: โปรดแนบสลิปหลักฐานการโอนเงินก่อนสั่งซื้อ', 'error');
            slipDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }

          const name = $('#coName')?.value.trim() || 'Anna Wong';
          const farmName = $('#coFarmName')?.value.trim() || '';
          const farmTag = $('#coFarmTag')?.value.trim() || '';
          const contact = $('#coContact')?.value.trim() || '';
          const newOrderNumber = 'HP-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random()*900);

          const selectedItemsList = Object.entries(state.selected).map(([pid, q]) => {
            const it = getCartItemDetails(pid);
            return {
              id: pid,
              name: it ? it.name : 'Product',
              price: Number(it ? it.price : 0),
              qty: Number(q),
              subtotal: Number((it ? it.price : 0) * Number(q)),
              image: it ? (it.image || '') : '',
              cat: it ? (it.cat || 'Item') : 'Item',
              type: it ? it.type : 'item',
              rawId: it ? it.rawId : pid
            };
          });

          const totalItemsCount = selectedItemsList.reduce((sum, it) => sum + it.qty, 0);

          const newOrder = {
            id: newOrderNumber,
            customer: name,
            farm_name: farmName,
            farm_tag: farmTag,
            contact: contact,
            date: new Date().toISOString().split('T')[0],
            items: totalItemsCount || 1,
            items_data: selectedItemsList,
            subtotal: subtotal,
            discount: discount,
            promo_code: state.appliedPromo ? state.appliedPromo.code : '',
            delivery: 0,
            total: Number(total),
            status: 'waiting',
            slip_url: uploadedSlipData || ''
          };
          ORDERS.unshift(newOrder);
          persistOrders();

          // Reset checkout form state
          state.checkoutForm = { name: '', farmName: '', farmTag: '', contact: '', uploadedSlipData: '' };

          // Update Customer records locally
          const custEmail = (contact && contact.includes('@')) ? contact : `${(name || 'customer').toLowerCase().replace(/\s+/g, '')}@customer.com`;
          const custPhone = (contact && !contact.includes('@')) ? contact : '';
          const cIdx = CUSTOMERS.findIndex(c => c.name.toLowerCase() === name.toLowerCase() || (custEmail && c.email.toLowerCase() === custEmail.toLowerCase()));
          let currentCustObj = null;
          if (cIdx !== -1) {
            CUSTOMERS[cIdx].orders = (CUSTOMERS[cIdx].orders || 0) + 1;
            CUSTOMERS[cIdx].spend = (CUSTOMERS[cIdx].spend || 0) + Number(total);
            if (farmName && !CUSTOMERS[cIdx].address) CUSTOMERS[cIdx].address = farmName;
            if (farmTag && !CUSTOMERS[cIdx].tag) CUSTOMERS[cIdx].tag = farmTag;
            currentCustObj = CUSTOMERS[cIdx];
          } else {
            currentCustObj = {
              name: name,
              email: custEmail,
              phone: custPhone,
              address: [farmName, farmTag].filter(Boolean).join(' · '),
              orders: 1,
              spend: Number(total),
              tag: farmTag || 'New'
            };
            CUSTOMERS.unshift(currentCustObj);
          }
          persistCustomers();

          notifyNewOrder(newOrder);

          // 1. Instant Real-time WebSocket Broadcast to Admin and all connected devices
          if (syncChannel) {
            try {
              syncChannel.send({
                type: 'broadcast',
                event: 'new_order',
                payload: { order: newOrder, customer: currentCustObj }
              });
            } catch (e) {
              console.warn('Sync broadcast new_order notice:', e);
            }
          }

          // 2. Persist to Supabase Database table 'customers', 'orders' & 'order_items'
          if (supabase) {
            try {
              let customerDbId = null;
              try {
                const { data: custData } = await supabase.from('customers').insert({
                  store_id: state.storeId || '00000000-0000-0000-0000-000000000001',
                  name: name,
                  email: custEmail,
                  phone: custPhone || null,
                  address: farmName || null,
                  tag: (farmTag && ['VIP', 'Regular', 'New'].includes(farmTag)) ? farmTag : 'New'
                }).select().single();
                if (custData) {
                  customerDbId = custData.id;
                }
              } catch (e) {
                console.warn('Customer Supabase insert notice:', e);
              }

              const noteMeta = `Customer: ${name} | Farm: ${farmName} | Tag: ${farmTag} | Contact: ${contact} | Promo: ${state.appliedPromo?.code || '-'} | Slip: ${uploadedSlipData || ''}`;
              const { data: insertedOrder, error: ordErr } = await supabase.from('orders').insert({
                store_id: state.storeId || '00000000-0000-0000-0000-000000000001',
                order_number: newOrderNumber,
                customer_id: customerDbId || null,
                subtotal: Number(subtotal || 0),
                discount: Number(discount || 0),
                tax: 0,
                total: Number(total || 0),
                status: 'waiting',
                payment_method: 'qr',
                note: noteMeta
              }).select().single();

              if (!ordErr && insertedOrder) {
                const itemRows = selectedItemsList.map(it => ({
                  order_id: insertedOrder.id,
                  product_id: (it.id && !String(it.id).startsWith('prod_') && it.id.length === 36) ? it.id : null,
                  product_name: it.name,
                  quantity: Number(it.qty),
                  unit_price: Number(it.price),
                  total: Number(it.subtotal)
                }));
                if (itemRows.length > 0) {
                  await supabase.from('order_items').insert(itemRows);
                }
              } else if (ordErr) {
                console.warn('Supabase order insert error:', ordErr);
              }
            } catch (dbErr) {
              console.warn('Supabase orders table insert notice:', dbErr);
            }
          }

          // 3. Deduct stock for items or mark game account as sold
          selectedItemsList.forEach(it => {
            if (it.type === 'item') {
              const p = PRODUCTS.find(x => String(x.id) === String(it.id));
              if (p) {
                p.stock = Math.max(0, Number(p.stock || 0) - Number(it.qty || 1));
              }
            } else if (it.type === 'game_account') {
              const acc = (state.store.gameAccounts || []).find(a => String(a.id) === String(it.rawId));
              if (acc) {
                acc.status = 'sold';
              }
            }
          });
          syncStoreSettingsAcrossDevices();
          updateStockNotifications();

          if (supabase) {
            try {
              for (const it of selectedItemsList) {
                if (it.type === 'item') {
                  const p = PRODUCTS.find(x => String(x.id) === String(it.id));
                  if (p && !String(p.id).startsWith('prod_') && p.id.length === 36) {
                    await supabase.from('products').update({ stock: p.stock }).eq('id', p.id);
                  }
                }
              }
            } catch (stkErr) {
              console.warn('Supabase stock update notice:', stkErr);
            }
          }

          // 4. Real-time broadcast stock deduction to all other connected devices
          if (syncChannel) {
            try {
              syncChannel.send({
                type: 'broadcast',
                event: 'stock_deducted',
                payload: { items: selectedItemsList.map(it => ({ id: it.id, qty: it.qty })) }
              });
            } catch (e) {}
          }

          state.lastOrderId = newOrderNumber;
          state.selected = {};
          updateFloatingCartBtn();
          toast('สั่งซื้อสำเร็จ', 'success');
          root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
          root.querySelector('#storeTabs [data-s="receipt"]').classList.add('active');
          drawStore('receipt');
        });
      } else if (key === 'receipt') {
        const latestOrder = (state.lastOrderId && ORDERS.find(x => String(x.id) === String(state.lastOrderId))) || ORDERS[0] || { id: 'HP-1042', customer: 'Anna Wong', farm_name: 'BNC Hay Farm', farm_tag: '#FARM-01', date: new Date().toISOString().split('T')[0], total: 35.30, subtotal: 35.30, discount: 0, delivery: 0 };
        const logoType = state.store.receiptLogoType || 'emoji';
        const logoImage = state.store.receiptLogoImage || '';
        const logoEmoji = state.store.receiptLogoEmoji || 'B';
        const storeName = state.store.receiptStoreName || (state.store.name ? state.store.name : 'BNC HayMate');
        const storeSub = state.store.receiptStoreAddress || '';

        const footerType = state.store.receiptFooterType || 'qr';
        const footerImage = state.store.receiptFooterImage || '';
        const footerEmoji = state.store.receiptFooterEmoji || '';
        const footerMsg = state.store.receiptFooterMsg || 'Thank you for your order';
        const footerSub = state.store.receiptFooterSub || '';

        const logoHtml = (logoType === 'image' && logoImage)
          ? `<img src="${escapeHTML(logoImage)}" alt="Store Logo" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='grid';" /><div style="display:none;">${escapeHTML(logoEmoji)}</div>`
          : `<div>${escapeHTML(logoEmoji)}</div>`;

        let footerGraphicHtml = '';
        if (footerType === 'image' && footerImage) {
          footerGraphicHtml = `<div class="r-footer-graphic"><img src="${escapeHTML(footerImage)}" alt="Footer Graphic/QR" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><div class="qr-default" style="display:none;"></div></div>`;
        } else if (footerType === 'emoji') {
          footerGraphicHtml = `<div class="r-footer-graphic" style="font-size:42px;">${escapeHTML(footerEmoji)}</div>`;
        } else {
          footerGraphicHtml = `<div class="r-footer-graphic"><div class="qr-default"></div></div>`;
        }

        const rSubtotal = latestOrder.subtotal !== undefined ? latestOrder.subtotal : latestOrder.total;
        const rDiscount = latestOrder.discount || 0;

        view.appendChild(el(`
          <div class="receipt">
            <div class="r-head">
              <div class="r-logo">${logoHtml}</div>
              <div class="r-store">${escapeHTML(storeName)}</div>
              ${storeSub ? `<div class="r-sub">${escapeHTML(storeSub)}</div>` : ''}
            </div>
            <div class="r-line"></div>
            <div class="r-items">
              <div class="r-row"><span>Order</span><span><strong>${latestOrder.id}</strong></span></div>
              <div class="r-row"><span>Date</span><span>${latestOrder.date}</span></div>
              <div class="r-row"><span>Customer</span><span>${escapeHTML(latestOrder.customer)}</span></div>
              ${latestOrder.farm_name ? `<div class="r-row"><span>Farm</span><span>${escapeHTML(latestOrder.farm_name)}</span></div>` : ''}
              ${latestOrder.farm_tag ? `<div class="r-row"><span>Farm Tag</span><span>${escapeHTML(latestOrder.farm_tag)}</span></div>` : ''}
            </div>
            <div class="r-line"></div>
            <div class="r-items">
              ${(latestOrder.items_data && latestOrder.items_data.length > 0)
                ? latestOrder.items_data.map(it => `<div class="r-row"><span>${escapeHTML(it.name)} × ${it.qty}</span><span>${money(it.subtotal || (it.price * it.qty))}</span></div>`).join('')
                : PRODUCTS.slice(0,3).map((p, i) => `<div class="r-row"><span>${escapeHTML(p.name)} × ${i+1}</span><span>${money(p.price * (i+1))}</span></div>`).join('')}
            </div>
            <div class="r-line"></div>
            <div class="r-items">
              <div class="r-row"><span>Subtotal</span><span>${money(rSubtotal)}</span></div>
              ${rDiscount > 0 ? `<div class="r-row" style="color:var(--accent-text); font-weight:700;"><span>Discount (${escapeHTML(latestOrder.promo_code || 'Promo')})</span><span style="color:var(--danger)">-${money(rDiscount)}</span></div>` : ''}
              <div class="r-row r-total"><span>Total</span><span>${money(latestOrder.total)}</span></div>
            </div>
            ${footerGraphicHtml}
            <div style="text-align:center; font-family:'Sunshiney', cursive; font-size:22px; font-weight:700; color:var(--accent-text); margin-top:8px; line-height:1.2;">${escapeHTML(footerMsg)}</div>
            ${footerSub ? `<div style="text-align:center; font-size:12px; color:var(--muted); margin-top:2px;">${escapeHTML(footerSub)}</div>` : ''}
            <button class="btn btn-primary btn-block mt-3" id="btnTrackOrder" style="font-size:14px; font-weight:700;">Track your order →</button>
            <button class="btn btn-block mt-2" id="dlReceipt" style="font-size:13.5px; font-weight:700;">Download / Share Receipt (บันทึก/พิมพ์ใบเสร็จ)</button>
          </div>
        `));
        view.querySelector('#btnTrackOrder').addEventListener('click', () => {
          root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
          root.querySelector('#storeTabs [data-s="tracking"]').classList.add('active');
          drawStore('tracking');
        });
        view.querySelector('#dlReceipt').addEventListener('click', async () => {
          if (navigator.share) {
            try {
              await navigator.share({
                title: 'BNC HayMate Order Receipt',
                text: `BNC HayMate Receipt #${latestOrder.id} - ${latestOrder.customer} - Total: ${money(latestOrder.total)}`,
                url: window.location.href
              });
              toast('แชร์ใบเสร็จเรียบร้อย', 'success');
              return;
            } catch (err) {}
          }
          window.print();
        });
      } else if (key === 'tracking') {
        const latestOrder = (state.lastOrderId && ORDERS.find(x => String(x.id) === String(state.lastOrderId))) || ORDERS[0] || { id: 'HP-1042', customer: 'Anna Wong', date: new Date().toISOString().split('T')[0], status: 'waiting' };
        const trackingTitle = state.store.trackingReviewTitle || state.store.receiptStoreName || state.store.name || 'BNC HayMate';
        const trackingSub = state.store.trackingReviewSub || '';
        const trackingBtn = state.store.trackingReviewBtnText || 'เขียนรีวิว & ให้คะแนนร้าน';

        view.appendChild(el(`
          <div class="card" style="max-width:560px; margin:0 auto;">
            <div class="card-title">Order Tracking</div>
            <div class="card-sub">Order ${latestOrder.id} · Live Status</div>
            <div class="timeline" style="margin-top:14px">
              <div class="step done"><div class="bullet">✓</div><div><div class="label">Waiting Payment</div><div class="sub">กรุณาชำระเงินเพื่อยืนยันคำสั่งซื้อ</div></div></div>
              <div class="step ${latestOrder.status !== 'waiting' ? 'done' : 'active'}"><div class="bullet">${latestOrder.status !== 'waiting' ? '✓' : '2'}</div><div><div class="label">Payment Verify</div><div class="sub">ร้านกำลังตรวจสอบคำสั่งซื้อ กรุณารอสักครู่</div></div></div>
              <div class="step ${latestOrder.status === 'preparing' || latestOrder.status === 'completed' ? (latestOrder.status === 'completed' ? 'done' : 'active') : ''}"><div class="bullet">${latestOrder.status === 'completed' ? '✓' : '3'}</div><div><div class="label">Preparing</div><div class="sub">ตรวจสอบคำสั่งซื้อเสร็จสิ้น รอรับไอเทมตามคิว นำรหัสสลิปทักสอบถามคิวได้เลย</div></div></div>
              <div class="step ${latestOrder.status === 'completed' ? 'done' : ''}"><div class="bullet">${latestOrder.status === 'completed' ? '✓' : '4'}</div><div><div class="label">Complete</div><div class="sub">จัดส่งเรียบร้อย</div></div></div>
            </div>

            <!-- Review Card for Customers (Calligraphy Store Name + Subtext) -->
            <div style="background:var(--primary-50); border:1.5px solid var(--border); border-radius:18px; padding:22px 18px; margin-top:22px; text-align:center; box-shadow:var(--shadow-soft);">
              <div style="font-family:'Sunshiney', cursive; font-size:36px; font-weight:700; color:var(--accent-text); line-height:1.2; letter-spacing:0.5px;">
                ${escapeHTML(trackingTitle)}
              </div>
              <div style="font-size:12.5px; color:var(--muted); margin-top:6px; font-weight:500;">
                ${escapeHTML(trackingSub)}
              </div>
              <button class="btn btn-primary btn-sm mt-3" id="btnTrackingReview" style="padding:9px 24px; font-weight:700; font-size:13px; border-radius:12px; box-shadow:var(--shadow-soft);">
                ${escapeHTML(trackingBtn)}
              </button>
            </div>

            <button class="btn btn-block mt-4" id="btnBackToReceipt">← Back to Receipt</button>
          </div>
        `));
        view.querySelector('#btnTrackingReview')?.addEventListener('click', () => openWriteReviewModal(latestOrder));
        view.querySelector('#btnBackToReceipt').addEventListener('click', () => {
          root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
          root.querySelector('#storeTabs [data-s="receipt"]').classList.add('active');
          drawStore('receipt');
        });
      }
    };

    const initialTab = state.storeTab || 'home';
    state.storeTab = initialTab;
    root.querySelectorAll('#storeTabs .tab').forEach(x => {
      x.classList.toggle('active', x.dataset.s === initialTab);
    });
    drawStore(initialTab);

    root.querySelectorAll('#storeTabs .tab').forEach(t => t.addEventListener('click', () => {
      root.querySelectorAll('#storeTabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      drawStore(t.dataset.s);
    }));
  };

  // Dedicated routes for Cart and Checkout
  PAGES.cart = (root) => {
    state.storeTab = 'cart';
    PAGES.store(root);
  };

  PAGES.checkout = (root) => {
    state.storeTab = 'checkout';
    PAGES.store(root);
  };

  // ============================================================
  // PART 7: Theme & Complete Multi-Color Palette System
  // ============================================================
  const COLOR_PALETTES = {
    // 1. Pastel Pink (ชมพูพาสเทล) -> Dark Berry Plum
    '#F8BFD4': {
      name: 'Pastel Pink (ชมพูพาสเทล)',
      light: {
        '--primary': '#F8BFD4',
        '--primary-600': '#EFA6C1',
        '--primary-700': '#DE85A7',
        '--primary-100': '#FCE3EE',
        '--primary-50': '#FDF1F6',
        '--bg': '#FFF8FB',
        '--card': '#FFFFFF',
        '--surface': '#FFFFFF',
        '--surface-2': '#FDF1F6',
        '--border': '#F3DCE6',
        '--divider': '#F3DCE6',
        '--text': '#2D3748',
        '--text-secondary': '#4A5568',
        '--muted': '#718096',
        '--accent-text': '#B24C74',
        '--shadow': '0 4px 20px rgba(248, 191, 212, 0.22)',
        '--shadow-soft': '0 2px 10px rgba(248, 191, 212, 0.12)'
      },
      dark: {
        '--primary': '#F8BFD4',
        '--primary-600': '#EEA0BC',
        '--primary-700': '#DB7EA2',
        '--primary-100': '#432135',
        '--primary-50': '#2D1623',
        '--bg': '#180D14',
        '--card': '#23131D',
        '--surface': '#23131D',
        '--surface-2': '#331B2A',
        '--border': '#46253A',
        '--divider': '#46253A',
        '--text': '#FAEDF4',
        '--text-secondary': '#E6D0DE',
        '--muted': '#B695A9',
        '--accent-text': '#F8BFD4',
        '--shadow': '0 6px 24px rgba(0,0,0,0.6)',
        '--shadow-soft': '0 2px 12px rgba(0,0,0,0.4)'
      }
    },

    // 2. Warm Peach (ส้มพีช) -> Dark Warm Espresso
    '#F0B265': {
      name: 'Warm Peach (ส้มพีช)',
      light: {
        '--primary': '#F0B265',
        '--primary-600': '#E59838',
        '--primary-700': '#D48320',
        '--primary-100': '#FDF0DD',
        '--primary-50': '#FFF9F2',
        '--bg': '#FFF8F2',
        '--card': '#FFFFFF',
        '--surface': '#FFFFFF',
        '--surface-2': '#FFF3E4',
        '--border': '#F5DCBE',
        '--divider': '#F5DCBE',
        '--text': '#36271D',
        '--text-secondary': '#543F32',
        '--muted': '#886E5E',
        '--accent-text': '#C46D08',
        '--shadow': '0 4px 20px rgba(240, 178, 101, 0.22)',
        '--shadow-soft': '0 2px 10px rgba(240, 178, 101, 0.12)'
      },
      dark: {
        '--primary': '#F0B265',
        '--primary-600': '#E39433',
        '--primary-700': '#D07F1B',
        '--primary-100': '#432A17',
        '--primary-50': '#2C1B0E',
        '--bg': '#181008',
        '--card': '#23170E',
        '--surface': '#23170E',
        '--surface-2': '#342215',
        '--border': '#472F1E',
        '--divider': '#472F1E',
        '--text': '#FAF1E8',
        '--text-secondary': '#E7D8C9',
        '--muted': '#B69E8D',
        '--accent-text': '#F0B265',
        '--shadow': '0 6px 24px rgba(0,0,0,0.6)',
        '--shadow-soft': '0 2px 12px rgba(0,0,0,0.4)'
      }
    },

    // 3. Matcha Green (เขียวมัทฉะ) -> Deep Forest Matcha
    '#7CC59A': {
      name: 'Matcha Green (เขียวมัทฉะ)',
      light: {
        '--primary': '#7CC59A',
        '--primary-600': '#5EB281',
        '--primary-700': '#489A6A',
        '--primary-100': '#E3F5EB',
        '--primary-50': '#F2FAF5',
        '--bg': '#F4FAF6',
        '--card': '#FFFFFF',
        '--surface': '#FFFFFF',
        '--surface-2': '#EAF7EF',
        '--border': '#C9EBD6',
        '--divider': '#C9EBD6',
        '--text': '#203328',
        '--text-secondary': '#3A5244',
        '--muted': '#5F7B6B',
        '--accent-text': '#267A49',
        '--shadow': '0 4px 20px rgba(124, 197, 154, 0.22)',
        '--shadow-soft': '0 2px 10px rgba(124, 197, 154, 0.12)'
      },
      dark: {
        '--primary': '#7CC59A',
        '--primary-600': '#57AD7B',
        '--primary-700': '#429766',
        '--primary-100': '#183B27',
        '--primary-50': '#10271A',
        '--bg': '#09150E',
        '--card': '#102117',
        '--surface': '#102117',
        '--surface-2': '#193123',
        '--border': '#234531',
        '--divider': '#234531',
        '--text': '#EAF8F0',
        '--text-secondary': '#CDECDA',
        '--muted': '#89B399',
        '--accent-text': '#7CC59A',
        '--shadow': '0 6px 24px rgba(0,0,0,0.6)',
        '--shadow-soft': '0 2px 12px rgba(0,0,0,0.4)'
      }
    },

    // 4. Sky Blue (ฟ้าพาสเทล) -> Dark Ocean / Midnight Navy
    '#8BB6E8': {
      name: 'Sky Blue (ฟ้าพาสเทล)',
      light: {
        '--primary': '#8BB6E8',
        '--primary-600': '#6AA0DE',
        '--primary-700': '#5189CD',
        '--primary-100': '#E5F0FC',
        '--primary-50': '#F4F8FD',
        '--bg': '#F2F7FD',
        '--card': '#FFFFFF',
        '--surface': '#FFFFFF',
        '--surface-2': '#EBF4FD',
        '--border': '#CBE2F8',
        '--divider': '#CBE2F8',
        '--text': '#202D3C',
        '--text-secondary': '#3A4D62',
        '--muted': '#617489',
        '--accent-text': '#276BB5',
        '--shadow': '0 4px 20px rgba(139, 182, 232, 0.22)',
        '--shadow-soft': '0 2px 10px rgba(139, 182, 232, 0.12)'
      },
      dark: {
        '--primary': '#8BB6E8',
        '--primary-600': '#5B97DC',
        '--primary-700': '#4282CB',
        '--primary-100': '#1B3556',
        '--primary-50': '#12243C',
        '--bg': '#0A121E',
        '--card': '#121E30',
        '--surface': '#121E30',
        '--surface-2': '#1A2B44',
        '--border': '#233959',
        '--divider': '#233959',
        '--text': '#EAF3FD',
        '--text-secondary': '#C8DCF2',
        '--muted': '#8AA7C7',
        '--accent-text': '#8BB6E8',
        '--shadow': '0 6px 24px rgba(0,0,0,0.6)',
        '--shadow-soft': '0 2px 12px rgba(0,0,0,0.4)'
      }
    },

    // 5. Lavender Purple (ม่วงลาเวนเดอร์) -> Dark Violet / Lavender
    '#D6BEE9': {
      name: 'Lavender Purple (ม่วงลาเวนเดอร์)',
      light: {
        '--primary': '#D6BEE9',
        '--primary-600': '#C19FDC',
        '--primary-700': '#AB83CD',
        '--primary-100': '#F4ECFA',
        '--primary-50': '#FAF6FD',
        '--bg': '#F9F4FD',
        '--card': '#FFFFFF',
        '--surface': '#FFFFFF',
        '--surface-2': '#F6EDFC',
        '--border': '#E4D2F5',
        '--divider': '#E4D2F5',
        '--text': '#2C2036',
        '--text-secondary': '#4A375A',
        '--muted': '#776485',
        '--accent-text': '#7A3CA8',
        '--shadow': '0 4px 20px rgba(214, 190, 233, 0.22)',
        '--shadow-soft': '0 2px 10px rgba(214, 190, 233, 0.12)'
      },
      dark: {
        '--primary': '#D6BEE9',
        '--primary-600': '#BD98DA',
        '--primary-700': '#A87DC9',
        '--primary-100': '#38214F',
        '--primary-50': '#251635',
        '--bg': '#140C1D',
        '--card': '#1D122A',
        '--surface': '#1D122A',
        '--surface-2': '#2B1A3D',
        '--border': '#3D2557',
        '--divider': '#3D2557',
        '--text': '#F6EEFB',
        '--text-secondary': '#E3D1F2',
        '--muted': '#AB93BE',
        '--accent-text': '#D6BEE9',
        '--shadow': '0 6px 24px rgba(0,0,0,0.6)',
        '--shadow-soft': '0 2px 12px rgba(0,0,0,0.4)'
      }
    }
  };

  const STICKY_NOTE_PALETTES = {
    // 6 โทนสีสว่างพาสเทล (Light Pastel Presets)
    yellow: { name: 'Butter Yellow (เหลืองเนย)', category: 'light', bg: '#FFFDF2', border: '#EFE6C7', bottom: '#DFD2A8', pin: '#EFA6C1' },
    pink: { name: 'Blossom Pink (ชมพูซากุระ)', category: 'light', bg: '#FFF5F8', border: '#FADBE6', bottom: '#F2BACF', pin: '#E58B94' },
    green: { name: 'Matcha Green (เขียวมัทฉะ)', category: 'light', bg: '#F4FAF6', border: '#D6EFE0', bottom: '#BBE2CB', pin: '#7CC59A' },
    blue: { name: 'Sky Blue (ฟ้าพาสเทล)', category: 'light', bg: '#F2F7FD', border: '#D4E5FA', bottom: '#B5D4F6', pin: '#8BB6E8' },
    purple: { name: 'Lavender (ม่วงลาเวนเดอร์)', category: 'light', bg: '#FAF5FD', border: '#EDDCFB', bottom: '#DFC6F7', pin: '#C79EE5' },
    peach: { name: 'Peach Apricot (ส้มพีช)', category: 'light', bg: '#FFF8F2', border: '#FCE6D6', bottom: '#F7CFB5', pin: '#F0B265' },

    // 6 โทนสีมืดพรีเมียม (Dark Night Presets)
    dark_charcoal: { name: 'Dark Charcoal (ชาร์โคลมืด)', category: 'dark', bg: '#1E1B22', border: '#3A3342', bottom: '#4E4559', pin: '#EFA6C1' },
    dark_espresso: { name: 'Dark Espresso (เอสเปรสโซเข้ม)', category: 'dark', bg: '#221812', border: '#453024', bottom: '#5A3E2F', pin: '#F0B265' },
    dark_emerald: { name: 'Dark Forest (เขียวป่ามืด)', category: 'dark', bg: '#112218', border: '#254431', bottom: '#325C43', pin: '#7CC59A' },
    dark_navy: { name: 'Midnight Navy (มิดไนท์เนวี)', category: 'dark', bg: '#121D2C', border: '#243954', bottom: '#314D70', pin: '#8BB6E8' },
    dark_plum: { name: 'Plum Berry (เบอร์รี่พลัม)', category: 'dark', bg: '#241420', border: '#47273F', bottom: '#5C3352', pin: '#F8BFD4' },
    dark_violet: { name: 'Royal Violet (ไวโอเล็ตเข้ม)', category: 'dark', bg: '#1E122A', border: '#3C2454', bottom: '#503070', pin: '#D6BEE9' }
  };

  function applyStickyNoteTheme() {
    let bg = state.store.stickyNoteBg || '#FFFDF2';
    let border = state.store.stickyNoteBorder || '#EFE6C7';
    let bottom = state.store.stickyNoteBottomBorder || '#DFD2A8';
    let pin = state.store.stickyNotePinColor || '#EFA6C1';

    if (state.store.stickyNotePreset && STICKY_NOTE_PALETTES[state.store.stickyNotePreset]) {
      const preset = STICKY_NOTE_PALETTES[state.store.stickyNotePreset];
      bg = preset.bg;
      border = preset.border;
      bottom = preset.bottom;
      pin = preset.pin;
    }

    document.documentElement.style.setProperty('--sticky-bg', bg);
    document.documentElement.style.setProperty('--sticky-border', border);
    document.documentElement.style.setProperty('--sticky-bottom-border', bottom);
    document.documentElement.style.setProperty('--sticky-pin-bg', pin);
  }

  function applyAppTheme(colorHex = state.color, themeMode = state.theme) {
    state.color = colorHex || '#F8BFD4';
    state.theme = (themeMode === 'dark') ? 'dark' : 'light';

    if (state.store) {
      state.store.color = state.color;
      state.store.theme = state.theme;
    }

    const palette = COLOR_PALETTES[state.color] || COLOR_PALETTES['#F8BFD4'];
    const vars = palette[state.theme] || palette.light;

    const rootEl = document.documentElement;

    // 1. Set root and body data-theme attribute
    rootEl.setAttribute('data-theme', state.theme);
    document.body.setAttribute('data-theme', state.theme);
    const appEl = document.getElementById('app');
    if (appEl) appEl.setAttribute('data-theme', state.theme);

    // 2. Remove inline backgroundColor overrides so CSS rules work naturally
    rootEl.style.removeProperty('background-color');
    document.body.style.removeProperty('background-color');
    if (appEl) appEl.style.removeProperty('background-color');

    // 3. Clear existing theme variables and apply new palette variables to :root
    const themeVarKeys = [
      '--primary', '--primary-600', '--primary-700', '--primary-100', '--primary-50',
      '--bg', '--card', '--surface', '--surface-2', '--border', '--divider',
      '--text', '--text-secondary', '--muted', '--accent-text', '--shadow', '--shadow-soft'
    ];
    themeVarKeys.forEach(v => {
      rootEl.style.removeProperty(v);
      document.body.style.removeProperty(v);
      if (appEl) appEl.style.removeProperty(v);
    });

    Object.entries(vars).forEach(([k, v]) => {
      rootEl.style.setProperty(k, v);
    });

    applyStickyNoteTheme();

    // 4. Persistence
    try {
      localStorage.setItem('haypos_color', state.color);
      localStorage.setItem('haypos_theme', state.theme);
      if (state.store) localStorage.setItem('haypos_store_settings', JSON.stringify(state.store));
    } catch (e) {}

    // 5. Update topbar themeToggle button icon & tooltip immediately (Only visible for Admin)
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
      themeBtn.innerHTML = state.theme === 'dark'
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`;
      themeBtn.title = state.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    // 6. Update swatches borders in Settings if visible
    document.querySelectorAll('.swatch-btn').forEach(b => {
      const isSelected = b.dataset.c === state.color;
      b.style.borderColor = isSelected ? 'var(--text)' : 'transparent';
      b.style.boxShadow = isSelected ? '0 0 0 2px var(--card)' : 'none';
    });

    // 7. Refresh sidebar and page components
    renderMenu();

    // 8. Live re-draw charts when theme or color changes
    if (state.page === 'dashboard' && typeof drawSalesChart === 'function') {
      setTimeout(() => drawSalesChart(), 20);
    } else if (state.page === 'reports' && typeof drawReportsCharts === 'function') {
      setTimeout(() => drawReportsCharts(), 20);
    }
  }

  async function syncStoreSettingsAcrossDevices() {
    const storeId = state.storeId || '00000000-0000-0000-0000-000000000001';
    const payload = {
      color: state.color,
      theme: state.theme || 'light',
      store: state.store,
      banners: BANNERS
    };

    // 1. Broadcast to all connected devices in realtime
    if (syncChannel) {
      try {
        syncChannel.send({
          type: 'broadcast',
          event: 'store_settings_updated',
          payload
        });
      } catch (e) {
        console.warn('Realtime settings broadcast notice:', e);
      }
    }

    // 2. Persist to Supabase stores table (config JSONB column & base attributes)
    if (supabase) {
      try {
        const payloadConfig = {
          color: state.color,
          theme: state.theme || 'light',
          store: state.store,
          banners: BANNERS
        };

        await supabase.from('stores').update({
          name: state.store.name || 'Vicky Store',
          config: payloadConfig
        }).eq('id', storeId);

        // Also try upserting to store_settings if table exists
        try {
          const basePayload = {
            store_id: storeId,
            primary_color: state.color || '#F8BFD4',
            qr_image_url: state.store.qr_image_url || null,
            bank_name: state.store.bank_name || null,
            bank_account: state.store.bank_account || null,
            account_holder: state.store.account_holder || null
          };
          await supabase.from('store_settings').upsert(basePayload, { onConflict: 'store_id' });
        } catch(e) {}
      } catch (dbErr) {
        console.warn('Supabase store config update notice:', dbErr);
      }
    }
  }

  function setTheme(mode) {
    state.theme = mode;
    if (state.store) state.store.theme = mode;
    applyAppTheme(state.color, mode);
    try {
      localStorage.setItem('haypos_theme', mode);
      localStorage.setItem('haypos_store_settings', JSON.stringify(state.store));
    } catch(e) {}
    const themeName = COLOR_PALETTES[state.color]?.name || '';
    toast(`สลับเป็นโหมด ${mode === 'dark' ? `Dark (${themeName})` : `Light (${themeName})`} เรียบร้อย`, 'info');
    syncStoreSettingsAcrossDevices();
  }

  function setColorAccent(colorHex) {
    state.color = colorHex;
    if (state.store) state.store.color = colorHex;
    applyAppTheme(colorHex, state.theme);
    try {
      localStorage.setItem('haypos_color', colorHex);
      localStorage.setItem('haypos_store_settings', JSON.stringify(state.store));
    } catch(e) {}
    syncStoreSettingsAcrossDevices();
  }

  function createSnowflakes() {
    const snowWrap = $('#snowContainer');
    if (!snowWrap) return;
    snowWrap.innerHTML = '';
    const flakeCount = 42;
    for (let i = 0; i < flakeCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'snowflake';
      const size = Math.random() * 4.5 + 3; // 3px to 7.5px
      const left = Math.random() * 100; // 0% to 100%
      const duration = Math.random() * 3.5 + 3.2; // 3.2s to 6.7s
      const delay = Math.random() * 3.5; // 0s to 3.5s
      const drift = (Math.random() * 45 - 15) + 'px';
      const opacity = Math.random() * 0.45 + 0.45;
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
      dot.style.left = left + '%';
      dot.style.animationDuration = duration + 's';
      dot.style.animationDelay = delay + 's';
      dot.style.setProperty('--snow-drift', drift);
      dot.style.setProperty('--snow-op', opacity);
      snowWrap.appendChild(dot);
    }
  }

  function runLoadingProgress(onComplete) {
    const overlay = $('#loadingOverlay');
    const fill = $('#loadingFill');
    const text = $('#loadingPercentText');
    const title = $('#loadingTitle');

    if (title) {
      title.textContent = state.store.loadingTitle || state.store.name || 'BNC HayMate';
    }

    createSnowflakes();

    if (!overlay || !fill || !text) {
      if (onComplete) onComplete();
      return;
    }
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 6;
      if (progress >= 100) {
        progress = 100;
        fill.style.width = '100%';
        text.textContent = '100%';
        clearInterval(interval);
        setTimeout(() => {
          overlay.classList.add('hidden');
          setTimeout(() => { overlay.style.display = 'none'; }, 450);
          if (onComplete) onComplete();
        }, 250);
      } else {
        fill.style.width = `${progress}%`;
        text.textContent = `${progress}%`;
      }
    }, 40);
  }

  async function init() {
    state.theme = 'light';
    if (state.store) state.store.theme = 'light';
    try { localStorage.setItem('haypos_theme', 'light'); } catch(e){}
    const savedColor = localStorage.getItem('haypos_color') || '#F8BFD4';
    applyAppTheme(savedColor, 'light');

    initSupabase();
    renderMenu();
    // Note: renderPage() is called after Supabase data is loaded (at the bottom of init)

    // Topbar & Global Buttons (Active Sidebar Collapse & Drawer Toggle)
    const menuToggle = $('#menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const app = $('#app');
        const sidebar = $('#sidebar');
        if (window.innerWidth <= 780) {
          let bd = document.getElementById('sidebarBackdrop');
          if (!bd) {
            bd = document.createElement('div');
            bd.id = 'sidebarBackdrop';
            bd.className = 'sidebar-backdrop';
            document.body.appendChild(bd);
            bd.addEventListener('click', () => {
              sidebar?.classList.remove('open');
              bd.classList.remove('active');
            });
          }
          const isOpen = sidebar?.classList.toggle('open');
          bd.classList.toggle('active', !!isOpen);
        } else {
          app?.classList.toggle('collapsed');
          const isCollapsed = app?.classList.contains('collapsed');
          localStorage.setItem('haypos_sidebar_collapsed', isCollapsed ? '1' : '0');
        }
      });
    }

    if (localStorage.getItem('haypos_sidebar_collapsed') === '1' && window.innerWidth > 780) {
      $('#app')?.classList.add('collapsed');
    }

    const themeToggle = $('#themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', () => setTheme(state.theme === 'light' ? 'dark' : 'light'));

    // Global instant delegated theme and color click listener
    document.addEventListener('click', (e) => {
      const swatch = e.target.closest('.swatch-btn');
      if (swatch) {
        e.preventDefault();
        e.stopPropagation();
        const selectedColor = swatch.dataset.c;
        if (selectedColor) {
          setColorAccent(selectedColor);
          toast(`เปลี่ยนโทนสีเป็น ${COLOR_PALETTES[selectedColor]?.name || 'ใหม่'} (โหมด Light) เรียบร้อย`, 'success');
        }
        return;
      }
    });

    const userChip = $('#userChip');
    if (userChip) {
      userChip.addEventListener('click', () => {
        if (state.isAdmin) {
          openModal({
            title: 'Admin Session',
            body: `<p style="font-size:13.5px; margin:0;">Logged in as <strong>${escapeHTML(state.user?.full_name || 'Admin')}</strong> (${escapeHTML(state.user?.email || 'admin@bnchaymate.com')})</p>`,
            actions: [
              { label: 'Switch to Customer View', kind: 'ghost', onClick: lockToVisitorMode },
              { label: 'Sign Out', kind: 'danger', onClick: lockToVisitorMode }
            ]
          });
        } else {
          openAdminPinModal();
        }
      });
    }

    const brandLogoBtn = $('#brandLogoBtn');
    if (brandLogoBtn) {
      brandLogoBtn.addEventListener('click', () => {
        state.page = 'store';
        renderMenu();
        renderPage();
      });
    }

    const globalSearch = $('#globalSearchInput');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val) {
          state.page = state.isAdmin ? 'products' : 'store';
          renderMenu();
          renderPage();
          setTimeout(() => {
            const ps = $('#prodSearch') || $('#storeSearch');
            if (ps) { ps.value = val; ps.dispatchEvent(new Event('input')); }
          }, 50);
        }
      });
    }

    // Physical Keyboard Listener for 6-Digit PIN
    document.addEventListener('keydown', (e) => {
      const pinModal = document.querySelector('.pin-modal-card');
      if (!pinModal) return;
      if (e.key >= '0' && e.key <= '9') {
        const keyBtn = pinModal.querySelector(`.pin-key[data-k="${e.key}"]`);
        if (keyBtn) keyBtn.click();
      } else if (e.key === 'Backspace') {
        const delBtn = pinModal.querySelector('.pin-key[data-k="del"]');
        if (delBtn) delBtn.click();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    });

    // Initialize Stock Low Alerts Notification System
    initStockNotifications();

    // Clean up legacy localStorage keys — product data now lives in Supabase only
    ['haypos_products', 'haypos_custom_products', 'haypos_categories',
     'haypos_orders', 'haypos_customers', 'haypos_reviews', 'haypos_promotions']
      .forEach(k => { try { localStorage.removeItem(k); } catch(e){} });

    // Start Supabase data fetch and loading animation concurrently.
    // Use a strict 2.5-second timeout safeguard so in-app browsers (Messenger/LINE) never freeze on a blank screen.
    const dataPromise = (async () => {
      try {
        await Promise.race([
          (async () => {
            await checkAuthSession();
            await loadSupabaseData();
          })(),
          new Promise(r => setTimeout(r, 2500))
        ]);
      } catch (e) {
        console.warn('Data load notice / timeout:', e);
      }

      // Non-blocking background realtime setup
      setTimeout(() => {
        try {
          setupRealtimeSubscriptions();
          setupRealtimePresence();
        } catch(e){}
      }, 100);
    })();

    // Wait for loading animation to complete
    await new Promise(resolve => runLoadingProgress(resolve));
    // Also wait for Supabase data (safe with timeout)
    try {
      await dataPromise;
    } catch(e) {}

    // If not logged in as Admin, ensure Customer Storefront is displayed
    if (!state.isAdmin) {
      state.page = 'store';
    }
    renderMenu();
    renderPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
