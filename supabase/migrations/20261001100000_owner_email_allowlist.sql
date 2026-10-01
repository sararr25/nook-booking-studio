-- Extra owner accounts. The first account to sign up is still the owner (handle_new_user);
-- anyone listed here also becomes an owner once their email address is confirmed.
-- Used for the demo account that challenge judges sign in with.
CREATE TABLE IF NOT EXISTS public.owner_emails (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_emails FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.owner_emails TO service_role;

INSERT INTO public.owner_emails (email) VALUES ('demo.ai.tester@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_allowlisted_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a confirmed address counts, so nobody can claim the role by signing up with it unverified.
  IF NEW.email_confirmed_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.owner_emails WHERE email = lower(NEW.email)
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_allowlisted_owner() FROM PUBLIC, anon, authenticated;

-- Fires on sign-up and again when the email gets confirmed.
DROP TRIGGER IF EXISTS on_auth_user_owner_allowlist ON auth.users;
CREATE TRIGGER on_auth_user_owner_allowlist
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_allowlisted_owner();

-- The demo account may already exist: promote it now.
INSERT INTO public.user_roles (user_id, role)
SELECT users.id, 'owner'
FROM auth.users users
JOIN public.owner_emails allowed ON allowed.email = lower(users.email)
WHERE users.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
