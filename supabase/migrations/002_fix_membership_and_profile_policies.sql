-- 1. Membership policies referenced group_memberships from inside a policy on
--    group_memberships, which Postgres rejects as infinite recursion. Owner
--    checks now go through a security definer function, like is_group_member.
-- 2. Nothing let a user get a profile row, so they could never create a group
--    (trip_groups.created_by references profiles). Profiles are now created on
--    sign-up, and users may insert their own as a fallback.
-- 3. A group's creator had no way to add the first (owner) membership, and could
--    not read the group they just created. Both are allowed now.

create function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.profile_id = auth.uid()
      and gm.role = 'owner'
  );
$$;

revoke execute on function public.is_group_owner(uuid) from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

drop policy "owners manage memberships" on public.group_memberships;

create policy "owners add memberships"
on public.group_memberships for insert
to authenticated
with check (public.is_group_owner(group_id));

create policy "creators add themselves as owner"
on public.group_memberships for insert
to authenticated
with check (
  profile_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1 from public.trip_groups g
    where g.id = group_memberships.group_id
      and g.created_by = auth.uid()
  )
);

create policy "owners update memberships"
on public.group_memberships for update
to authenticated
using (public.is_group_owner(group_id))
with check (public.is_group_owner(group_id));

create policy "owners remove memberships"
on public.group_memberships for delete
to authenticated
using (public.is_group_owner(group_id));

drop policy "members read groups" on public.trip_groups;

create policy "members and creators read groups"
on public.trip_groups for select
to authenticated
using (created_by = auth.uid() or public.is_group_member(id));

create policy "users create their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Traveler'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
