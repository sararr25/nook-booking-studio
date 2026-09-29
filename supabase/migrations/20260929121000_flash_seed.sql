-- Move the original demo flash book into the same catalog used by owner and client.
INSERT INTO public.flash_designs (id, title, image_path, price, duration_minutes)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Wildflower stem', 'seed:botanical', 160, 75),
  ('00000000-0000-4000-8000-000000000002', 'Night moth', 'seed:moth', 220, 120),
  ('00000000-0000-4000-8000-000000000003', 'Ornamental sun', 'seed:sun', 190, 90),
  ('00000000-0000-4000-8000-000000000004', 'Fine-line swallow', 'seed:swallow', 180, 90)
ON CONFLICT (id) DO NOTHING;

UPDATE public.booking_requests
SET flash_design_key = CASE flash_design_key
  WHEN 'botanical' THEN '00000000-0000-4000-8000-000000000001'
  WHEN 'moth' THEN '00000000-0000-4000-8000-000000000002'
  WHEN 'sun' THEN '00000000-0000-4000-8000-000000000003'
  WHEN 'swallow' THEN '00000000-0000-4000-8000-000000000004'
  ELSE flash_design_key END
WHERE flash_design_key IN ('botanical', 'moth', 'sun', 'swallow');

UPDATE public.flash_designs design SET available = false
WHERE EXISTS (
  SELECT 1 FROM public.booking_requests booking
  WHERE booking.flash_design_key = design.id::text AND booking.status <> 'declined'
);
