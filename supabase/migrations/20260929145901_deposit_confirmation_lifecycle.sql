ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('confirmed', 'awaiting_deposit', 'pending', 'declined'));

-- Existing confirmed appointments with an unpaid deposit return to the waiting state.
UPDATE public.booking_requests
SET status = 'awaiting_deposit'
WHERE status = 'confirmed'
  AND deposit_paid_at IS NULL
  AND COALESCE((quote->>'deposit')::numeric, 0) > 0;

CREATE OR REPLACE FUNCTION public.create_booking_request(p_booking jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_booking->>'id')::uuid;
  v_date date := (p_booking->>'appointment_date')::date;
  v_time time := (p_booking->>'appointment_time')::time;
  v_member text := COALESCE(p_booking->>'member_id', '');
  v_duration integer := (p_booking->'quote'->>'duration')::integer;
  v_flash text := NULLIF(p_booking->>'flash_design_key', '');
BEGIN
  IF v_duration IS NULL OR v_duration < 15 OR v_duration > 720
     OR (p_booking->>'status' = 'confirmed' AND (v_member = '' OR v_member = 'unassigned'))
     OR v_date < current_date OR v_date > current_date + 365
     OR length(trim(COALESCE(p_booking->>'customer_name', ''))) NOT BETWEEN 1 AND 120
     OR length(trim(COALESCE(p_booking->>'contact', ''))) NOT BETWEEN 3 AND 240
     OR length(regexp_replace(COALESCE(p_booking->>'phone', ''), '[^0-9]', '', 'g')) < 6
     OR (p_booking->>'service_id' = 'flash' AND v_flash IS NULL)
     OR p_booking->>'status' NOT IN ('pending', 'awaiting_deposit', 'confirmed') THEN
    RAISE EXCEPTION 'Invalid booking slot';
  END IF;
  IF v_member <> '' AND v_member <> 'unassigned' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_member || ':' || v_date::text, 0));
  END IF;
  IF v_flash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flash:' || v_flash, 0));
  END IF;
  IF v_member <> '' AND v_member <> 'unassigned' AND EXISTS (
    SELECT 1 FROM public.booking_requests existing
    WHERE existing.member_id = v_member AND existing.appointment_date = v_date
      AND existing.status <> 'declined'
      AND existing.appointment_time < v_time + make_interval(mins => v_duration)
      AND v_time < existing.appointment_time + make_interval(mins => COALESCE((existing.quote->>'duration')::integer, 60))
  ) THEN
    RAISE EXCEPTION 'This time is no longer available';
  END IF;
  IF v_flash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.booking_requests existing
    WHERE existing.flash_design_key = v_flash AND existing.status <> 'declined'
  ) THEN
    RAISE EXCEPTION 'This flash design is no longer available';
  END IF;
  IF v_flash IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.flash_designs design
    WHERE design.id::text = v_flash AND design.available
  ) THEN
    RAISE EXCEPTION 'This flash design is no longer available';
  END IF;
  INSERT INTO public.booking_requests (
    id, customer_name, contact, phone, notes, service_id, answers, quote,
    appointment_date, appointment_time, flash_design_id, member_id,
    flash_design_key, reference_paths, status
  ) VALUES (
    v_id, trim(p_booking->>'customer_name'), trim(p_booking->>'contact'),
    COALESCE(p_booking->>'phone', ''), COALESCE(p_booking->>'notes', ''),
    p_booking->>'service_id', COALESCE(p_booking->'answers', '{}'::jsonb),
    p_booking->'quote', v_date, v_time, NULL, v_member,
    v_flash, ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_booking->'reference_paths', '[]'::jsonb))),
    p_booking->>'status'
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_request(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_request(jsonb) TO service_role;
