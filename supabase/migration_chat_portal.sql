-- VideoMarketing Sevilla - Portal Clients Migration
-- Execute this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS portal_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name text NOT NULL,
  logo text DEFAULT '',
  dropbox_link text DEFAULT '',
  password_hash text DEFAULT '',
  is_active boolean DEFAULT true,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portal_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select portal_clients" ON portal_clients
  FOR SELECT USING (true);
