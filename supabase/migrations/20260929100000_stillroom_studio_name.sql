-- Rebrand only the unchanged demo studio. Preserve any owner-defined name.
UPDATE public.studio_settings
SET business_name = 'Stillroom Tattoo',
    config = CASE
      WHEN config IS NULL THEN NULL
      ELSE jsonb_set(
        jsonb_set(config, '{name}', '"Stillroom Tattoo"'::jsonb, true),
        '{id}', '"stillroom-tattoo"'::jsonb, true
      )
    END
WHERE id = 'main'
  AND business_name = 'Ember & Thread'
  AND (config IS NULL OR config->>'name' = 'Ember & Thread');
