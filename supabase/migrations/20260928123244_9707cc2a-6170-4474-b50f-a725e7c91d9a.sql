ALTER TABLE public.booking_requests ADD COLUMN phone text NOT NULL DEFAULT '';
DROP POLICY IF EXISTS "Customers can submit booking requests" ON public.booking_requests;
CREATE POLICY "Customers can submit booking requests" ON public.booking_requests FOR INSERT TO anon, authenticated
WITH CHECK (char_length(customer_name) BETWEEN 1 AND 120 AND char_length(contact) BETWEEN 3 AND 240 AND char_length(phone) BETWEEN 6 AND 40);