CREATE TYPE public.app_role AS ENUM ('owner', 'staff', 'customer');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_initial_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  LOCK TABLE public.user_roles IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    RETURN public.has_role(auth.uid(), 'owner');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'owner');
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_initial_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.studio_settings (
  id text PRIMARY KEY DEFAULT 'main',
  business_name text NOT NULL,
  location text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  policies jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.studio_settings TO authenticated;
GRANT ALL ON public.studio_settings TO service_role;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read studio settings" ON public.studio_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners manage studio settings" ON public.studio_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER studio_settings_updated_at BEFORE UPDATE ON public.studio_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_title text NOT NULL,
  initials text NOT NULL,
  skills text[] NOT NULL DEFAULT '{}',
  working_days integer[] NOT NULL DEFAULT '{}',
  start_time time NOT NULL DEFAULT '10:00',
  end_time time NOT NULL DEFAULT '18:00',
  max_session_minutes integer NOT NULL DEFAULT 240 CHECK (max_session_minutes BETWEEN 15 AND 720),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.professionals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active professionals" ON public.professionals FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage professionals" ON public.professionals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER professionals_updated_at BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'google_calendar')),
  external_event_id text,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read open availability" ON public.availability FOR SELECT TO anon, authenticated USING (available OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage availability" ON public.availability FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER availability_updated_at BEFORE UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flash_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_path text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 720),
  artist_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flash_designs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flash_designs TO authenticated;
GRANT ALL ON public.flash_designs TO service_role;
ALTER TABLE public.flash_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read available flash" ON public.flash_designs FOR SELECT TO anon, authenticated USING (available OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners manage flash designs" ON public.flash_designs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER flash_designs_updated_at BEFORE UPDATE ON public.flash_designs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  contact text NOT NULL,
  notes text NOT NULL DEFAULT '',
  service_id text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote jsonb NOT NULL DEFAULT '{}'::jsonb,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  flash_design_id uuid REFERENCES public.flash_designs(id) ON DELETE SET NULL,
  reference_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.booking_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can submit booking requests" ON public.booking_requests FOR INSERT TO anon, authenticated WITH CHECK (char_length(customer_name) BETWEEN 1 AND 120 AND char_length(contact) BETWEEN 3 AND 240);
CREATE POLICY "Owners can read booking requests" ON public.booking_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update booking requests" ON public.booking_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete booking requests" ON public.booking_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER booking_requests_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.studio_settings (id, business_name, location, currency, services, policies)
VALUES (
  'main',
  'Ember & Thread',
  'Ostergatan 14, Malmo',
  'EUR',
  '[{"id":"tattoo","name":"Custom tattoo","basePrice":180,"baseDuration":90,"depositPercent":20},{"id":"flash","name":"Flash piece","basePrice":140,"baseDuration":60,"depositPercent":25},{"id":"consult","name":"Consultation","basePrice":0,"baseDuration":30,"depositPercent":0}]'::jsonb,
  '{"leadTimeDays":3,"horizonDays":90,"autoApproveUnder":900,"autoApproveMaxDuration":300,"cancellationHours":48}'::jsonb
);

INSERT INTO public.professionals (name, role_title, initials, skills, working_days, start_time, end_time, max_session_minutes)
VALUES
  ('Ines Marrow', 'Owner, blackwork & cover-ups', 'IM', ARRAY['blackwork','coverup','lettering','exposed-placement','fineline'], ARRAY[2,3,4,5], '11:00', '19:00', 360),
  ('Tove Lind', 'Fine line & botanical', 'TL', ARRAY['fineline','lettering'], ARRAY[1,2,4,6], '10:00', '17:00', 240),
  ('Rafa Osei', 'Colour & illustrative', 'RO', ARRAY['colour','fineline','blackwork'], ARRAY[3,4,5,6], '12:00', '20:00', 300);

INSERT INTO public.availability (professional_id, starts_at, ends_at, source)
SELECT p.id, day_slot + p.start_time, day_slot + p.end_time, 'manual'
FROM public.professionals p
CROSS JOIN generate_series(current_date + 3, current_date + 31, interval '1 day') AS day_slot
WHERE extract(dow FROM day_slot)::integer = ANY(p.working_days);