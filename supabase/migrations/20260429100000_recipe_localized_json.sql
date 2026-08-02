alter table public.recipes
  add column if not exists localized_json jsonb not null default '{}'::jsonb;
