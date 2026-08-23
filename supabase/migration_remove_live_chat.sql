-- VideoMarketing Sevilla - Remove Live Chat
-- Run this in Supabase SQL Editor if chat tables were already created.

DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.chat_conversations') IS NOT NULL THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_conversations;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END IF;
END $$;

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_conversations;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    UPDATE public.profiles
    SET permissions = array_remove(permissions, 'chat')
    WHERE permissions @> ARRAY['chat']::text[];
  END IF;
END $$;
