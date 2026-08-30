-- =====================================================
-- MIGRATION: Independent detail-page texts and carta example videos
-- Run this in Supabase SQL Editor
-- =====================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS hero_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS section_title TEXT,
  ADD COLUMN IF NOT EXISTS section_text TEXT;

ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS hero_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS section_title TEXT,
  ADD COLUMN IF NOT EXISTS section_text TEXT;

ALTER TABLE public.cartas
  ADD COLUMN IF NOT EXISTS sample_videos JSONB DEFAULT '[]'::jsonb;
