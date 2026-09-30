-- Flash artwork is public only while its catalog entry can be booked.
-- Owners can still inspect reserved designs and recover an upload before publishing it.
DROP POLICY IF EXISTS "Public can view flash gallery images" ON storage.objects;

CREATE POLICY "Public can view bookable flash gallery images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'flash-gallery'
  AND EXISTS (
    SELECT 1 FROM public.flash_designs design
    WHERE design.image_path = name AND design.available
  )
);

CREATE POLICY "Owners can view all flash gallery images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'flash-gallery' AND public.has_role(auth.uid(), 'owner'));
