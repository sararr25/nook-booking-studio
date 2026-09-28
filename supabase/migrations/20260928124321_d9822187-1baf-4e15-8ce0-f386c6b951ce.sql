ALTER TABLE public.studio_settings ADD COLUMN IF NOT EXISTS config jsonb;
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS member_id text NOT NULL DEFAULT '';
ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS flash_design_key text;