-- =====================================================
-- MANUAL INVOICES
-- Stores invoices created directly from the admin panel.
-- Invoice numbers share the same F-series sequence as contract invoices.
-- =====================================================

CREATE TABLE IF NOT EXISTS manual_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number INTEGER NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_cif TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  concept TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Transferencia bancaria',
  status TEXT NOT NULL DEFAULT 'issued',
  invoice_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manual_invoices_status_check CHECK (status IN ('draft', 'issued', 'paid', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_manual_invoices_issued_at ON manual_invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_invoices_client_name ON manual_invoices(client_name);

ALTER TABLE manual_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access manual_invoices" ON manual_invoices;
CREATE POLICY "Admin full access manual_invoices" ON manual_invoices
  FOR ALL USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS manual_invoices_updated_at ON manual_invoices;
CREATE TRIGGER manual_invoices_updated_at
  BEFORE UPDATE ON manual_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
