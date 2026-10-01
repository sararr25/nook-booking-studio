-- Retention rules for the owner's booking list:
--   cancelled / declined bookings are removed 15 days after they were cancelled;
--   past bookings are removed 100 days after their appointment date.
-- The owner panel runs this when it opens; only owners (or the service role) may call it.
CREATE OR REPLACE FUNCTION public.purge_expired_bookings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer;
  v_past integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Owner only';
  END IF;

  WITH removed AS (
    DELETE FROM public.booking_requests
    WHERE status = 'declined' AND updated_at < now() - interval '15 days'
    RETURNING 1
  ) SELECT count(*) INTO v_cancelled FROM removed;

  WITH removed AS (
    DELETE FROM public.booking_requests
    WHERE status <> 'declined' AND appointment_date < current_date - 100
    RETURNING 1
  ) SELECT count(*) INTO v_past FROM removed;

  RETURN jsonb_build_object('cancelled', v_cancelled, 'past', v_past);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_bookings() TO authenticated, service_role;

-- Demo history so the grouped lists have something to show. Dates are relative to the day
-- this migration runs. Fixed ids make it safe to run twice. All contacts are example.com.
INSERT INTO public.booking_requests (
  id, customer_name, contact, phone, notes, service_id, answers, quote,
  appointment_date, appointment_time, member_id, status, deposit_paid_at, created_at, updated_at
)
SELECT
  md5('nook-demo-' || demo.key)::uuid,
  demo.customer_name,
  lower(replace(demo.customer_name, ' ', '.')) || '@example.com',
  '+46 70 555 01' || lpad(demo.n::text, 2, '0'),
  demo.notes,
  demo.service_id,
  '{}'::jsonb,
  jsonb_build_object(
    'low', demo.price,
    'high', demo.price + CASE WHEN demo.price = 0 THEN 0 ELSE 40 END,
    'duration', demo.minutes,
    'deposit', round(demo.price * 0.2),
    'requiresReview', false,
    'reviewReasons', '[]'::jsonb,
    'lines', '[]'::jsonb
  ),
  CASE WHEN demo.kind = 'past' THEN current_date - demo.days_ago ELSE current_date + demo.days_ahead END,
  demo.start_time::time,
  demo.member_id,
  CASE WHEN demo.kind = 'past' THEN 'confirmed' ELSE 'declined' END,
  CASE WHEN demo.kind = 'past' AND demo.price > 0 THEN now() - make_interval(days => demo.days_ago + 7) END,
  now() - make_interval(days => COALESCE(demo.days_ago, demo.cancelled_days_ago) + 14),
  CASE WHEN demo.kind = 'past'
       THEN now() - make_interval(days => demo.days_ago + 1)
       ELSE now() - make_interval(days => demo.cancelled_days_ago) END
FROM (VALUES
  ('past-1',  1, 'past', 'Maja Lindqvist',   'tattoo',  'ines', '10:00',  4, NULL, NULL, 280, 150, 'Fine-line botanical, inner forearm'),
  ('past-2',  2, 'past', 'Oskar Berg',       'flash',   'tove', '13:00',  9, NULL, NULL, 160,  75, 'Flash: small moth'),
  ('past-3',  3, 'past', 'Ella Nygren',      'tattoo',  'rafa', '11:30', 17, NULL, NULL, 420, 210, 'Blackwork band, upper arm'),
  ('past-4',  4, 'past', 'Noor Haddad',      'consult', 'ines', '15:00', 26, NULL, NULL,   0,  30, 'Sleeve consultation'),
  ('past-5',  5, 'past', 'Viktor Sandell',   'tattoo',  'tove', '09:30', 38, NULL, NULL, 350, 180, 'Lettering, ribs'),
  ('past-6',  6, 'past', 'Saga Holm',        'flash',   'rafa', '14:00', 52, NULL, NULL, 190,  90, 'Flash: snake and dagger'),
  ('past-7',  7, 'past', 'Leo Karlsson',     'tattoo',  'ines', '12:00', 67, NULL, NULL, 520, 270, 'Cover-up, calf'),
  ('past-8',  8, 'past', 'Amira Said',       'tattoo',  'tove', '10:30', 81, NULL, NULL, 240, 120, 'Small colour piece'),
  ('past-9',  9, 'past', 'Hugo Ek',          'flash',   'rafa', '16:00', 93, NULL, NULL, 150,  60, 'Flash: sparrow'),
  ('past-10', 10, 'past', 'Frida Lund',      'tattoo',  'ines', '11:00', 98, NULL, NULL, 300, 150, 'Fine-line script (leaves the list in 2 days)'),
  ('cancelled-1', 11, 'cancelled', 'Isak Nilsson',  'tattoo',  'tove', '13:00', NULL,  6,  1, 310, 150, 'Cancelled by the customer'),
  ('cancelled-2', 12, 'cancelled', 'Linnea Vidal',  'flash',   'rafa', '10:00', NULL, 12,  3, 170,  75, 'Declined: flash already booked'),
  ('cancelled-3', 13, 'cancelled', 'Emil Aronsson', 'tattoo',  'ines', '14:30', NULL, 20,  6, 450, 240, 'Cancelled: moved abroad'),
  ('cancelled-4', 14, 'cancelled', 'Tilda Roos',    'consult', 'tove', '16:30', NULL,  3,  9,   0,  30, 'Declined: outside our styles'),
  ('cancelled-5', 15, 'cancelled', 'Albin Strand',  'tattoo',  'rafa', '09:00', NULL, 28, 13, 260, 120, 'Cancelled by the studio')
) AS demo(key, n, kind, customer_name, service_id, member_id, start_time, days_ago, days_ahead, cancelled_days_ago, price, minutes, notes)
ON CONFLICT (id) DO NOTHING;
