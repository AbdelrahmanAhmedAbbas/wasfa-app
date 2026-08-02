drop policy if exists "recipes_owner_delete" on public.recipes;
create policy "recipes_owner_delete"
on public.recipes
for delete
to authenticated
using (user_id = auth.uid());
