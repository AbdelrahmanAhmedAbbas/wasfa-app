update public.import_jobs
set
  status = 'failed',
  error_code = coalesce(error_code, 'LEGACY_FALLBACK_REMOVED'),
  error_message = coalesce(
    error_message,
    'This legacy fallback status is no longer supported.'
  )
where status = 'needs_fallback_text';

update public.job_events
set event = 'failed'
where event = 'needs_fallback';

alter table public.import_jobs
drop constraint if exists import_jobs_status_check;

alter table public.import_jobs
add constraint import_jobs_status_check
check (status in ('queued', 'processing', 'awaiting_user_review', 'confirmed', 'failed'));

alter table public.job_events
drop constraint if exists job_events_event_check;

alter table public.job_events
add constraint job_events_event_check
check (event in ('received', 'normalized', 'ai_extracted', 'confirmed', 'failed'));
