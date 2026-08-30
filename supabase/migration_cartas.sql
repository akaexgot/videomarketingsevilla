-- =====================================================
-- MIGRATION: Cartas (Sistema de Menu/Servicios)
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Cartas
CREATE TABLE IF NOT EXISTS public.cartas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('imagenes', 'pdf', 'manual')),
  video_url TEXT,
  sample_videos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Imágenes de la Carta (Para tipo 'imagenes' y 'pdf')
CREATE TABLE IF NOT EXISTS public.carta_imagenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carta_id UUID NOT NULL REFERENCES public.cartas(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bloques (Para tipo 'manual')
CREATE TABLE IF NOT EXISTS public.carta_bloques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carta_id UUID NOT NULL REFERENCES public.cartas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  orden INT DEFAULT 0,
  visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Servicios (Para tipo 'manual', vinculados a un Bloque)
CREATE TABLE IF NOT EXISTS public.carta_servicios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bloque_id UUID NOT NULL REFERENCES public.carta_bloques(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio TEXT,
  descripcion TEXT,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS (Row Level Security)
ALTER TABLE public.cartas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carta_imagenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carta_bloques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carta_servicios ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
CREATE POLICY "Public read cartas" ON public.cartas FOR SELECT USING (true);
CREATE POLICY "Public read carta_imagenes" ON public.carta_imagenes FOR SELECT USING (true);
CREATE POLICY "Public read carta_bloques" ON public.carta_bloques FOR SELECT USING (true);
CREATE POLICY "Public read carta_servicios" ON public.carta_servicios FOR SELECT USING (true);

-- API (Service Role) can bypass RLS anyway, but let's add Updated At Triggers

-- Triggers for updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cartas_updated_at') THEN
    CREATE TRIGGER cartas_updated_at BEFORE UPDATE ON public.cartas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'carta_bloques_updated_at') THEN
    CREATE TRIGGER carta_bloques_updated_at BEFORE UPDATE ON public.carta_bloques FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'carta_servicios_updated_at') THEN
    CREATE TRIGGER carta_servicios_updated_at BEFORE UPDATE ON public.carta_servicios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;
