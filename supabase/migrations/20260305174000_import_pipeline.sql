create extension if not exists pgcrypto;

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  client_id text,
  access_token uuid not null default gen_random_uuid(),
  source_platform text not null check (source_platform in ('instagram', 'tiktok', 'unknown')),
  entrypoint text not null check (entrypoint in ('paste_url', 'share_intent', 'manual_retry')),
  source_url text not null,
  status text not null check (status in ('queued', 'processing', 'awaiting_user_review', 'needs_fallback_text', 'confirmed', 'failed')),
  error_code text,
  error_message text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_raw_artifacts (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('shared_text', 'caption', 'ocr_text', 'transcript')),
  content_encrypted text not null,
  delete_after timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_drafts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.import_jobs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  payload_json jsonb not null,
  confidence_json jsonb not null default '{}'::jsonb,
  language_detected text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  draft_job_id uuid unique references public.import_jobs(id) on delete set null,
  source_platform text not null check (source_platform in ('instagram', 'tiktok', 'unknown')),
  source_url text not null,
  title text not null,
  description text,
  servings int,
  prep_minutes int,
  cook_minutes int,
  ingredients_json jsonb not null default '[]'::jsonb,
  steps_json jsonb not null default '[]'::jsonb,
  nutrition_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  event text not null check (event in ('received', 'normalized', 'ai_extracted', 'needs_fallback', 'confirmed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_jobs_user_id_created_at on public.import_jobs(user_id, created_at desc);
create index if not exists idx_import_jobs_client_id_created_at on public.import_jobs(client_id, created_at desc);
create index if not exists idx_import_jobs_status_created_at on public.import_jobs(status, created_at desc);
create index if not exists idx_import_jobs_source_url_created_at on public.import_jobs(source_url, created_at desc);
create index if not exists idx_recipe_drafts_job_id on public.recipe_drafts(job_id);
create index if not exists idx_job_events_job_id_created_at on public.job_events(job_id, created_at desc);
create index if not exists idx_import_raw_artifacts_delete_after on public.import_raw_artifacts(delete_after);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_import_jobs_touch_updated_at on public.import_jobs;
create trigger trg_import_jobs_touch_updated_at
before update on public.import_jobs
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_recipe_drafts_touch_updated_at on public.recipe_drafts;
create trigger trg_recipe_drafts_touch_updated_at
before update on public.recipe_drafts
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_recipes_touch_updated_at on public.recipes;
create trigger trg_recipes_touch_updated_at
before update on public.recipes
for each row execute procedure public.touch_updated_at();

alter table public.import_jobs enable row level security;
alter table public.import_raw_artifacts enable row level security;
alter table public.recipe_drafts enable row level security;
alter table public.recipes enable row level security;
alter table public.job_events enable row level security;

drop policy if exists "import_jobs_owner_select" on public.import_jobs;
create policy "import_jobs_owner_select"
on public.import_jobs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "import_jobs_owner_insert" on public.import_jobs;
create policy "import_jobs_owner_insert"
on public.import_jobs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "import_jobs_owner_update" on public.import_jobs;
create policy "import_jobs_owner_update"
on public.import_jobs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "import_jobs_owner_delete" on public.import_jobs;
create policy "import_jobs_owner_delete"
on public.import_jobs
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "recipe_drafts_owner_select" on public.recipe_drafts;
create policy "recipe_drafts_owner_select"
on public.recipe_drafts
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recipes_owner_select" on public.recipes;
create policy "recipes_owner_select"
on public.recipes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recipes_owner_insert" on public.recipes;
create policy "recipes_owner_insert"
on public.recipes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "recipes_owner_update" on public.recipes;
create policy "recipes_owner_update"
on public.recipes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "job_events_owner_select_via_job" on public.job_events;
create policy "job_events_owner_select_via_job"
on public.job_events
for select
to authenticated
using (
  exists (
    select 1
    from public.import_jobs j
    where j.id = job_events.job_id
      and j.user_id = auth.uid()
  )
);

create or replace function public.cleanup_expired_import_artifacts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.import_raw_artifacts where delete_after <= now();
  delete from public.import_jobs where expires_at <= now();
$$;
