-- YouTube Shorts as a third source platform, and the source thumbnail kept with
-- cached extractions so a cache hit can save a recipe with its picture.

alter table public.import_jobs
drop constraint if exists import_jobs_source_platform_check;

alter table public.import_jobs
add constraint import_jobs_source_platform_check
check (source_platform in ('instagram', 'tiktok', 'youtube', 'unknown'));

alter table public.recipes
drop constraint if exists recipes_source_platform_check;

alter table public.recipes
add constraint recipes_source_platform_check
check (source_platform in ('instagram', 'tiktok', 'youtube', 'unknown'));

alter table public.recipe_extraction_cache
drop constraint if exists recipe_extraction_cache_source_platform_check;

alter table public.recipe_extraction_cache
add constraint recipe_extraction_cache_source_platform_check
check (source_platform in ('instagram', 'tiktok', 'youtube', 'unknown'));

alter table public.recipe_extraction_cache
add column if not exists source_thumbnail_url text;
