alter table public.recipes
add column if not exists source_reel_url text,
add column if not exists source_thumbnail_url text,
add column if not exists folder_id uuid;

create table if not exists public.recipe_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipes_folder_id_fkey'
  ) then
    alter table public.recipes
    add constraint recipes_folder_id_fkey
    foreign key (folder_id) references public.recipe_folders(id) on delete set null;
  end if;
end $$;

create unique index if not exists idx_recipe_folders_user_name_unique
on public.recipe_folders(user_id, lower(name));

create index if not exists idx_recipes_user_folder_created
on public.recipes(user_id, folder_id, created_at desc);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_text text not null,
  checked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_shopping_items_user_recipe_ingredient_unique
on public.shopping_list_items(user_id, recipe_id, ingredient_text);

create index if not exists idx_shopping_items_user_created
on public.shopping_list_items(user_id, created_at desc);

drop trigger if exists trg_recipe_folders_touch_updated_at on public.recipe_folders;
create trigger trg_recipe_folders_touch_updated_at
before update on public.recipe_folders
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_shopping_list_items_touch_updated_at on public.shopping_list_items;
create trigger trg_shopping_list_items_touch_updated_at
before update on public.shopping_list_items
for each row execute procedure public.touch_updated_at();

alter table public.recipe_folders enable row level security;
alter table public.shopping_list_items enable row level security;

drop policy if exists "recipe_folders_owner_select" on public.recipe_folders;
create policy "recipe_folders_owner_select"
on public.recipe_folders
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "recipe_folders_owner_insert" on public.recipe_folders;
create policy "recipe_folders_owner_insert"
on public.recipe_folders
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "recipe_folders_owner_update" on public.recipe_folders;
create policy "recipe_folders_owner_update"
on public.recipe_folders
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "recipe_folders_owner_delete" on public.recipe_folders;
create policy "recipe_folders_owner_delete"
on public.recipe_folders
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "shopping_items_owner_select" on public.shopping_list_items;
create policy "shopping_items_owner_select"
on public.shopping_list_items
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "shopping_items_owner_insert" on public.shopping_list_items;
create policy "shopping_items_owner_insert"
on public.shopping_list_items
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "shopping_items_owner_update" on public.shopping_list_items;
create policy "shopping_items_owner_update"
on public.shopping_list_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "shopping_items_owner_delete" on public.shopping_list_items;
create policy "shopping_items_owner_delete"
on public.shopping_list_items
for delete
to authenticated
using (user_id = auth.uid());
