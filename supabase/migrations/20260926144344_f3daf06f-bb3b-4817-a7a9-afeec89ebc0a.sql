CREATE POLICY "Public can view flash gallery images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'flash-gallery');

CREATE POLICY "Owners can upload flash gallery images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'flash-gallery' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update flash gallery images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'flash-gallery' AND public.has_role(auth.uid(), 'owner'))
WITH CHECK (bucket_id = 'flash-gallery' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete flash gallery images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'flash-gallery' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Customers can upload booking references"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'booking-references'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND char_length((storage.foldername(name))[1]) >= 16
);

CREATE POLICY "Owners can view booking references"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'booking-references' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete booking references"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'booking-references' AND public.has_role(auth.uid(), 'owner'));