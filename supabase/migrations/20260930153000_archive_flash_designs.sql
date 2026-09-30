-- Keep booking references intact when an owner removes a design from the flash book.
ALTER TABLE public.flash_designs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.flash_designs SET available = false WHERE archived_at IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flash_archived_unavailable'
      AND conrelid = 'public.flash_designs'::regclass
  ) THEN
    ALTER TABLE public.flash_designs
      ADD CONSTRAINT flash_archived_unavailable CHECK (archived_at IS NULL OR NOT available);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Anyone can read available flash" ON public.flash_designs;
CREATE POLICY "Anyone can read available flash"
ON public.flash_designs FOR SELECT TO anon, authenticated
USING ((available AND archived_at IS NULL) OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Public can view bookable flash gallery images" ON storage.objects;
CREATE POLICY "Public can view bookable flash gallery images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'flash-gallery'
  AND EXISTS (
    SELECT 1 FROM public.flash_designs design
    WHERE design.image_path = name
      AND design.available
      AND design.archived_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.sync_flash_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.flash_design_key IS NOT NULL THEN
    UPDATE public.flash_designs design SET available =
      design.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_requests booking
        WHERE booking.flash_design_key = design.id::text AND booking.status <> 'declined'
      )
    WHERE design.id::text = NEW.flash_design_key;
  END IF;
  RETURN NEW;
END;
$$;
