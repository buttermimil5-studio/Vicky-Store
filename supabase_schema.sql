-- ============================================================
-- Complete & Clean Supabase Schema for Vicky Store / HayPOS
-- Run this in Supabase -> SQL Editor (New query -> Run)
-- ============================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if re-running (Clean slate)
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS store_banners CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- 3. Stores Table (Main Store Config & Branding)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Vicky Store',
    slug TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Base Store
INSERT INTO stores (id, name, config)
VALUES ('00000000-0000-0000-0000-000000000001', 'Vicky Store', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 4. Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    cat TEXT DEFAULT 'Bakery',
    image TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    tag TEXT DEFAULT 'New',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    subtotal NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'qr',
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'waiting',
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Reviews Table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    customer_id UUID,
    order_id UUID,
    customer_name TEXT DEFAULT 'Guest',
    rating INT DEFAULT 5,
    comment TEXT,
    is_pinned BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Coupons Table
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    code TEXT NOT NULL,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    min_spend NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Store Banners Table
CREATE TABLE store_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    title TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Store Settings Table (Theme & Bank Fallback)
CREATE TABLE store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    primary_color TEXT DEFAULT '#F8BFD4',
    qr_image_url TEXT,
    bank_name TEXT,
    bank_account TEXT,
    account_holder TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Enable Row Level Security (RLS) with Open Public Access for Anon Key
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access on stores" ON stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on coupons" ON coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on store_banners" ON store_banners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);

-- 13. Enable Realtime Subscriptions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE stores, products, orders, order_items, customers, reviews, coupons, store_banners, store_settings;
COMMIT;
