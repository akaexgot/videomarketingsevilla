-- =====================================================
-- VIDEOMARKETING SEVILLA — Complete Supabase Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. SETTINGS (Global site configuration)
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_name TEXT NOT NULL DEFAULT 'VideoMarketing Sevilla',
  site_description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#9B1B30',
  secondary_color TEXT DEFAULT '#C42847',
  font_heading TEXT DEFAULT 'Outfit',
  font_body TEXT DEFAULT 'Inter',
  whatsapp_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  instagram TEXT,
  linkedin TEXT,
  google_maps_embed TEXT,
  hero_title TEXT DEFAULT 'Creamos historias que impulsan tu marca',
  hero_subtitle TEXT DEFAULT 'Productora audiovisual especializada en video marketing para empresas',
  hero_video_desktop TEXT,
  hero_video_mobile TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. NAVIGATION
-- =====================================================
CREATE TABLE IF NOT EXISTS navigation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_navigation_order ON navigation("order");

-- =====================================================
-- 3. PROJECTS
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  video_project TEXT,
  video_explanation_desktop TEXT,
  video_explanation_mobile TEXT,
  thumbnail TEXT,
  client_name TEXT,
  client_logo TEXT,
  featured_home BOOLEAN DEFAULT FALSE,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_featured ON projects(featured_home) WHERE featured_home = TRUE;
CREATE INDEX idx_projects_order ON projects("order");

-- =====================================================
-- 4. SERVICES
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  section_title TEXT,
  section_text TEXT,
  icon TEXT DEFAULT '🎬',
  video TEXT,
  preview_seconds INT DEFAULT 3,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_order ON services("order");

-- =====================================================
-- 5. SECTORS
-- =====================================================
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  section_title TEXT,
  section_text TEXT,
  icon TEXT DEFAULT '🏢',
  video TEXT,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sectors_slug ON sectors(slug);
CREATE INDEX idx_sectors_order ON sectors("order");

-- =====================================================
-- 6. COMPANIES (Logo carousel)
-- =====================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_order ON companies("order");

-- =====================================================
-- 7. PORTAL CLIENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  image TEXT,
  dropbox_link TEXT,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_clients_order ON portal_clients("order", created_at, id);

-- =====================================================
-- 8. CONTACTS (Form submissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_created ON contacts(created_at DESC);
CREATE INDEX idx_contacts_unread ON contacts(is_read) WHERE is_read = FALSE;

-- =====================================================
-- 9. PAGES SEO (Custom meta per page)
-- =====================================================
CREATE TABLE IF NOT EXISTS pages_seo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_path TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  og_image TEXT,
  canonical_url TEXT,
  no_index BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pages_seo_path ON pages_seo(page_path);

-- =====================================================
-- 10. FOOTER
-- =====================================================
CREATE TABLE IF NOT EXISTS footer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT,
  copyright TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS footer_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  "order" INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer ENABLE ROW LEVEL SECURITY;
ALTER TABLE footer_links ENABLE ROW LEVEL SECURITY;

-- Public read access for content tables
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Public read navigation" ON navigation FOR SELECT USING (true);
CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);
CREATE POLICY "Public read sectors" ON sectors FOR SELECT USING (true);
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read pages_seo" ON pages_seo FOR SELECT USING (true);
CREATE POLICY "Public read footer" ON footer FOR SELECT USING (true);
CREATE POLICY "Public read footer_links" ON footer_links FOR SELECT USING (true);

-- Portal clients: only show active, hide password_hash
CREATE POLICY "Public read portal_clients" ON portal_clients
  FOR SELECT USING (is_active = true);

-- Contacts: public insert only
CREATE POLICY "Public insert contacts" ON contacts
  FOR INSERT WITH CHECK (true);

-- Admin policies (authenticated users can do everything)
CREATE POLICY "Admin full access settings" ON settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access navigation" ON navigation FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access projects" ON projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access services" ON services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access sectors" ON sectors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access companies" ON companies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access portal_clients" ON portal_clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access contacts" ON contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access pages_seo" ON pages_seo FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access footer" ON footer FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access footer_links" ON footer_links FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sectors_updated_at BEFORE UPDATE ON sectors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER portal_clients_updated_at BEFORE UPDATE ON portal_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pages_seo_updated_at BEFORE UPDATE ON pages_seo FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER footer_updated_at BEFORE UPDATE ON footer FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default settings
INSERT INTO settings (site_name, site_description, email, phone, whatsapp_number, address, hero_title, hero_subtitle)
VALUES (
  'VideoMarketing Sevilla',
  'Productora audiovisual especializada en video marketing para empresas en Sevilla, Cádiz y toda España.',
  'info@videomarketingsevilla.es',
  '+34 600 000 000',
  '34600000000',
  'Sevilla, España',
  'Creamos historias que impulsan tu marca',
  'Productora audiovisual especializada en video marketing para empresas'
);

-- Insert navigation
INSERT INTO navigation (label, href, "order") VALUES
  ('Inicio', '/', 1),
  ('Proyectos', '/proyectos', 2),
  ('Servicios', '/servicios', 3),
  ('Sectores', '/sectores', 4),
  ('Quiénes Somos', '/quienes-somos', 5),
  ('Contacto', '/contacto', 6);

-- Insert footer
INSERT INTO footer (description, copyright)
VALUES (
  'Productora audiovisual especializada en video marketing para empresas. Creamos contenido que impulsa marcas.',
  '© 2024 VideoMarketing Sevilla. Todos los derechos reservados.'
);

INSERT INTO footer_links (label, href, "order") VALUES
  ('Política de Privacidad', '/privacidad', 1),
  ('Aviso Legal', '/aviso-legal', 2),
  ('Cookies', '/cookies', 3);
