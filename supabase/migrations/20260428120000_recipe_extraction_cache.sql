create table if not exists public.recipe_extraction_cache (
  normalized_source_url text primary key,
  source_platform text not null check (source_platform in ('instagram', 'tiktok', 'unknown')),
  source_post_id text,
  payload jsonb not null,
  extraction_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_extraction_cache enable row level security;

drop trigger if exists trg_recipe_extraction_cache_touch_updated_at on public.recipe_extraction_cache;
create trigger trg_recipe_extraction_cache_touch_updated_at
before update on public.recipe_extraction_cache
for each row execute procedure public.touch_updated_at();
