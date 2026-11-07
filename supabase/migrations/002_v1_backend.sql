-- v1 backend: profile bootstrap, secure group/membership RPCs, atomic receipt
-- ledger save, settlements, balances, and storage policies.
--
-- Design notes
-- * Ledger tables (expenses, receipt_items, receipt_adjustments,
--   item_allocations, expense_shares) are read-only for clients. All writes go
--   through security-definer RPCs that validate membership and money totals and
--   run in a single transaction, so a failed save leaves no partial rows.
-- * Membership policies in 001 referenced group_memberships from inside a
--   group_memberships policy, which Postgres rejects with "infinite recursion
--   detected in policy". Owner checks now go through a security-definer helper.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_group_owner(target_group_id uuid)
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

create or replace function public.is_member_of(target_group_id uuid, target_profile_id uuid)
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
      and gm.profile_id = target_profile_id
  );
$$;

create or replace function public.shares_group_with(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_memberships mine
    join public.group_memberships theirs on theirs.group_id = mine.group_id
    where mine.profile_id = auth.uid()
      and theirs.profile_id = target_profile_id
  );
$$;

create or replace function public.require_auth()
returns uuid
language plpgsql
stable
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: auto-create on sign-up, restrict visibility to co-members.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'traveler'), '@', 1)
    ),
    lower(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill users that signed up before this migration.
insert into public.profiles (id, display_name, email)
select u.id, split_part(coalesce(u.email, 'traveler'), '@', 1), lower(u.email)
from auth.users u
on conflict (id) do nothing;

drop policy if exists "profiles are visible to signed-in users" on public.profiles;

create policy "profiles visible to self and co-members"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.shares_group_with(id));

create policy "users insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

-- Users may only change display_name / avatar_url, never email or id.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 60);

-- ---------------------------------------------------------------------------
-- Groups & memberships
-- ---------------------------------------------------------------------------

drop policy if exists "signed-in users create groups" on public.trip_groups;
drop policy if exists "owners manage memberships" on public.group_memberships;

create policy "owners update groups"
on public.trip_groups for update
to authenticated
using (public.is_group_owner(id))
with check (public.is_group_owner(id));

alter table public.trip_groups
  add constraint trip_groups_name_length check (char_length(trim(name)) between 1 and 80);

create or replace function public.create_group(
  p_name text,
  p_starts_on date default null,
  p_ends_on date default null
)
returns public.trip_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth();
  created public.trip_groups;
begin
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'group_name_required' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name)
  values (uid, 'Traveler')
  on conflict (id) do nothing;

  insert into public.trip_groups (name, starts_on, ends_on, created_by)
  values (trim(p_name), p_starts_on, p_ends_on, uid)
  returning * into created;

  insert into public.group_memberships (group_id, profile_id, role)
  values (created.id, uid, 'owner');

  return created;
end;
$$;

create or replace function public.add_group_member(p_group_id uuid, p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth();
  target public.profiles;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'only_owner_can_add_members' using errcode = '42501';
  end if;

  select p.* into target
  from public.profiles p
  where p.email = lower(trim(p_email));

  if target.id is null then
    raise exception 'no_account_for_email' using errcode = 'P0002';
  end if;

  insert into public.group_memberships (group_id, profile_id, role)
  values (p_group_id, target.id, 'member')
  on conflict (group_id, profile_id) do nothing;

  return target;
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth();
  target_role text;
  owner_count integer;
begin
  -- Owners can remove anyone; members can remove themselves (leave).
  if not (public.is_group_owner(p_group_id) or p_profile_id = uid) then
    raise exception 'only_owner_can_remove_members' using errcode = '42501';
  end if;

  select role into target_role
  from public.group_memberships
  where group_id = p_group_id and profile_id = p_profile_id;

  if target_role is null then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;

  if target_role = 'owner' then
    select count(*) into owner_count
    from public.group_memberships
    where group_id = p_group_id and role = 'owner';

    if owner_count <= 1 then
      raise exception 'cannot_remove_last_owner' using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from public.expense_shares es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id and es.profile_id = p_profile_id
  ) or exists (
    select 1 from public.expenses e
    where e.group_id = p_group_id and e.paid_by = p_profile_id
  ) or exists (
    select 1 from public.settlements s
    where s.group_id = p_group_id
      and (s.from_profile_id = p_profile_id or s.to_profile_id = p_profile_id)
  ) then
    raise exception 'member_has_ledger_history' using errcode = '23503';
  end if;

  delete from public.group_memberships
  where group_id = p_group_id and profile_id = p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Receipts: clients may create and edit drafts; ledger rows are RPC-only.
-- ---------------------------------------------------------------------------

drop policy if exists "members manage expenses" on public.expenses;
drop policy if exists "members manage receipts" on public.receipts;
drop policy if exists "members manage receipt items" on public.receipt_items;
drop policy if exists "members manage receipt adjustments" on public.receipt_adjustments;
drop policy if exists "members manage item allocations" on public.item_allocations;

create policy "members read expenses"
on public.expenses for select
to authenticated
using (public.is_group_member(group_id));

create policy "members read receipts"
on public.receipts for select
to authenticated
using (public.is_group_member(group_id));

create policy "members create draft receipts"
on public.receipts for insert
to authenticated
with check (
  public.is_group_member(group_id)
  and uploaded_by = auth.uid()
  and expense_id is null
  and ocr_status in ('draft', 'processing')
);

create policy "uploaders update unconfirmed receipts"
on public.receipts for update
to authenticated
using (uploaded_by = auth.uid() and ocr_status <> 'confirmed')
with check (
  uploaded_by = auth.uid()
  and public.is_group_member(group_id)
  and expense_id is null
  and ocr_status <> 'confirmed'
);

create policy "uploaders delete unconfirmed receipts"
on public.receipts for delete
to authenticated
using (uploaded_by = auth.uid() and ocr_status <> 'confirmed');

create policy "members read receipt items"
on public.receipt_items for select
to authenticated
using (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_items.receipt_id
      and public.is_group_member(r.group_id)
  )
);

create policy "members read receipt adjustments"
on public.receipt_adjustments for select
to authenticated
using (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_adjustments.receipt_id
      and public.is_group_member(r.group_id)
  )
);

create policy "members read item allocations"
on public.item_allocations for select
to authenticated
using (
  exists (
    select 1
    from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = item_allocations.receipt_item_id
      and public.is_group_member(r.group_id)
  )
  or exists (
    select 1
    from public.receipt_adjustments ra
    join public.receipts r on r.id = ra.receipt_id
    where ra.id = item_allocations.receipt_adjustment_id
      and public.is_group_member(r.group_id)
  )
);

alter table public.expenses add column if not exists receipt_id uuid references public.receipts (id) on delete set null;
alter table public.expenses add column if not exists subtotal_cents integer;
create index if not exists expenses_group_idx on public.expenses (group_id, created_at desc);

-- Save a reviewed receipt as an expense in one transaction.
--
-- p_payload shape:
-- {
--   "merchant": text, "receiptDate": "YYYY-MM-DD", "currencyCode": "USD",
--   "subtotalCents": int, "totalCents": int, "paidBy": uuid,
--   "confidence": number | null,
--   "items": [{ "name", "quantity", "totalAmountCents", "confidence",
--               "wasManuallyEdited", "allocations": [{ "profileId", "weight", "amountCents" }] }],
--   "adjustments": [{ "label", "kind", "amountCents", "strategy",
--                     "allocations": [{ "profileId", "weight", "amountCents" }] }],
--   "shares": [{ "profileId", "owesCents" }]
-- }
create or replace function public.save_receipt(p_receipt_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth();
  r public.receipts;
  v_group uuid;
  v_paid_by uuid;
  v_total integer;
  v_subtotal integer;
  v_merchant text;
  v_date date;
  v_currency text;
  v_items_sum bigint := 0;
  v_adj_sum bigint := 0;
  v_shares_sum bigint := 0;
  v_expense_id uuid;
  v_item jsonb;
  v_adj jsonb;
  v_alloc jsonb;
  v_share jsonb;
  v_item_id uuid;
  v_adj_id uuid;
  v_position integer := 0;
  v_profile uuid;
  v_amount integer;
  v_strategy text;
begin
  select * into r from public.receipts where id = p_receipt_id for update;

  if r.id is null or not public.is_group_member(r.group_id) then
    raise exception 'receipt_not_found' using errcode = 'P0002';
  end if;

  if r.ocr_status = 'confirmed' or r.expense_id is not null then
    raise exception 'receipt_already_saved' using errcode = '23505';
  end if;

  v_group := r.group_id;
  v_paid_by := (p_payload ->> 'paidBy')::uuid;
  v_total := (p_payload ->> 'totalCents')::integer;
  v_subtotal := coalesce((p_payload ->> 'subtotalCents')::integer, 0);
  v_merchant := nullif(trim(coalesce(p_payload ->> 'merchant', '')), '');
  v_date := coalesce(nullif(p_payload ->> 'receiptDate', '')::date, current_date);
  v_currency := upper(coalesce(nullif(p_payload ->> 'currencyCode', ''), 'USD'));

  if v_merchant is null then
    raise exception 'merchant_required' using errcode = '22023';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  if v_total is null or v_total < 0 then
    raise exception 'invalid_total' using errcode = '22023';
  end if;

  if v_paid_by is null or not public.is_member_of(v_group, v_paid_by) then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload -> 'items') <> 'array' or jsonb_array_length(p_payload -> 'items') = 0 then
    raise exception 'items_required' using errcode = '22023';
  end if;

  -- Validate items.
  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    v_amount := (v_item ->> 'totalAmountCents')::integer;
    if v_amount is null or v_amount < 0 then
      raise exception 'invalid_item_amount' using errcode = '22023';
    end if;
    if nullif(trim(coalesce(v_item ->> 'name', '')), '') is null then
      raise exception 'item_name_required' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'allocations') <> 'array' or jsonb_array_length(v_item -> 'allocations') = 0 then
      raise exception 'unassigned_items' using errcode = '22023';
    end if;
    for v_alloc in select * from jsonb_array_elements(v_item -> 'allocations') loop
      v_profile := (v_alloc ->> 'profileId')::uuid;
      if not public.is_member_of(v_group, v_profile) then
        raise exception 'allocation_member_not_in_group' using errcode = '22023';
      end if;
    end loop;
    v_items_sum := v_items_sum + v_amount;
  end loop;

  -- Validate adjustments.
  if p_payload ? 'adjustments' and jsonb_typeof(p_payload -> 'adjustments') = 'array' then
    for v_adj in select * from jsonb_array_elements(p_payload -> 'adjustments') loop
      v_amount := (v_adj ->> 'amountCents')::integer;
      v_strategy := coalesce(v_adj ->> 'strategy', 'proportional');
      if v_amount is null then
        raise exception 'invalid_adjustment_amount' using errcode = '22023';
      end if;
      if v_strategy not in ('proportional', 'equal', 'custom') then
        raise exception 'invalid_adjustment_strategy' using errcode = '22023';
      end if;
      if v_strategy = 'custom' and (
        jsonb_typeof(v_adj -> 'allocations') <> 'array' or jsonb_array_length(v_adj -> 'allocations') = 0
      ) then
        raise exception 'custom_adjustment_unassigned' using errcode = '22023';
      end if;
      if jsonb_typeof(v_adj -> 'allocations') = 'array' then
        for v_alloc in select * from jsonb_array_elements(v_adj -> 'allocations') loop
          v_profile := (v_alloc ->> 'profileId')::uuid;
          if not public.is_member_of(v_group, v_profile) then
            raise exception 'allocation_member_not_in_group' using errcode = '22023';
          end if;
        end loop;
      end if;
      v_adj_sum := v_adj_sum + v_amount;
    end loop;
  end if;

  if v_items_sum + v_adj_sum <> v_total then
    raise exception 'receipt_total_mismatch' using errcode = '22023';
  end if;

  -- Validate shares.
  if jsonb_typeof(p_payload -> 'shares') <> 'array' or jsonb_array_length(p_payload -> 'shares') = 0 then
    raise exception 'shares_required' using errcode = '22023';
  end if;

  for v_share in select * from jsonb_array_elements(p_payload -> 'shares') loop
    v_profile := (v_share ->> 'profileId')::uuid;
    v_amount := (v_share ->> 'owesCents')::integer;
    if not public.is_member_of(v_group, v_profile) then
      raise exception 'share_member_not_in_group' using errcode = '22023';
    end if;
    if v_amount is null or v_amount < 0 then
      raise exception 'invalid_share_amount' using errcode = '22023';
    end if;
    v_shares_sum := v_shares_sum + v_amount;
  end loop;

  if v_shares_sum <> v_total then
    raise exception 'shares_total_mismatch' using errcode = '22023';
  end if;

  -- Write ledger rows.
  insert into public.expenses (
    group_id, paid_by, merchant, occurred_on, currency_code, total_cents,
    subtotal_cents, created_by, receipt_id
  )
  values (v_group, v_paid_by, v_merchant, v_date, v_currency, v_total, v_subtotal, uid, r.id)
  returning id into v_expense_id;

  delete from public.receipt_items where receipt_id = r.id;
  delete from public.receipt_adjustments where receipt_id = r.id;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.receipt_items (
      receipt_id, name, quantity, unit_amount_cents, total_amount_cents,
      ocr_confidence, was_manually_edited, position
    )
    values (
      r.id,
      trim(v_item ->> 'name'),
      coalesce((v_item ->> 'quantity')::numeric, 1),
      nullif(v_item ->> 'unitAmountCents', '')::integer,
      (v_item ->> 'totalAmountCents')::integer,
      nullif(v_item ->> 'confidence', '')::numeric,
      coalesce((v_item ->> 'wasManuallyEdited')::boolean, false),
      v_position
    )
    returning id into v_item_id;

    for v_alloc in select * from jsonb_array_elements(v_item -> 'allocations') loop
      insert into public.item_allocations (receipt_item_id, profile_id, weight, amount_cents)
      values (
        v_item_id,
        (v_alloc ->> 'profileId')::uuid,
        coalesce(nullif(v_alloc ->> 'weight', '')::numeric, case when v_alloc ? 'amountCents' then null else 1 end),
        nullif(v_alloc ->> 'amountCents', '')::integer
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  v_position := 0;
  if jsonb_typeof(p_payload -> 'adjustments') = 'array' then
    for v_adj in select * from jsonb_array_elements(p_payload -> 'adjustments') loop
      insert into public.receipt_adjustments (receipt_id, label, kind, amount_cents, allocation_strategy, position)
      values (
        r.id,
        coalesce(nullif(trim(v_adj ->> 'label'), ''), 'Adjustment'),
        coalesce(nullif(v_adj ->> 'kind', ''), 'other'),
        (v_adj ->> 'amountCents')::integer,
        coalesce(v_adj ->> 'strategy', 'proportional'),
        v_position
      )
      returning id into v_adj_id;

      if jsonb_typeof(v_adj -> 'allocations') = 'array' then
        for v_alloc in select * from jsonb_array_elements(v_adj -> 'allocations') loop
          insert into public.item_allocations (receipt_adjustment_id, profile_id, weight, amount_cents)
          values (
            v_adj_id,
            (v_alloc ->> 'profileId')::uuid,
            coalesce(nullif(v_alloc ->> 'weight', '')::numeric, case when v_alloc ? 'amountCents' then null else 1 end),
            nullif(v_alloc ->> 'amountCents', '')::integer
          );
        end loop;
      end if;

      v_position := v_position + 1;
    end loop;
  end if;

  insert into public.expense_shares (expense_id, profile_id, owes_cents, paid_cents)
  select
    v_expense_id,
    s.profile_id,
    sum(s.owes)::integer,
    case when s.profile_id = v_paid_by then v_total else 0 end
  from (
    select (x ->> 'profileId')::uuid as profile_id, (x ->> 'owesCents')::integer as owes
    from jsonb_array_elements(p_payload -> 'shares') x
    union all
    select v_paid_by, 0
  ) s
  group by s.profile_id;

  update public.receipts
  set
    expense_id = v_expense_id,
    merchant = v_merchant,
    receipt_date = v_date,
    currency_code = v_currency,
    subtotal_cents = v_subtotal,
    total_cents = v_total,
    ocr_status = 'confirmed',
    ocr_confidence = coalesce(nullif(p_payload ->> 'confidence', '')::numeric, ocr_confidence)
  where id = r.id;

  return v_expense_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlements
-- ---------------------------------------------------------------------------

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  from_profile_id uuid not null references public.profiles (id) on delete restrict,
  to_profile_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency_code text not null default 'USD',
  note text,
  settled_on date not null default current_date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (from_profile_id <> to_profile_id)
);

create index settlements_group_idx on public.settlements (group_id, created_at desc);

alter table public.settlements enable row level security;

create policy "members read settlements"
on public.settlements for select
to authenticated
using (public.is_group_member(group_id));

create or replace function public.record_settlement(
  p_group_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount_cents integer,
  p_note text default null
)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_auth();
  created public.settlements;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;
  if not public.is_member_of(p_group_id, p_from) or not public.is_member_of(p_group_id, p_to) then
    raise exception 'settlement_member_not_in_group' using errcode = '22023';
  end if;
  if p_from = p_to then
    raise exception 'settlement_same_member' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_settlement_amount' using errcode = '22023';
  end if;

  insert into public.settlements (group_id, from_profile_id, to_profile_id, amount_cents, note, created_by)
  values (p_group_id, p_from, p_to, p_amount_cents, nullif(trim(coalesce(p_note, '')), ''), uid)
  returning * into created;

  return created;
end;
$$;

-- Net balance per member: positive = the group owes them, negative = they owe.
create or replace function public.group_balances(p_group_id uuid)
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  role text,
  paid_cents bigint,
  owed_cents bigint,
  settled_out_cents bigint,
  settled_in_cents bigint,
  net_cents bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    gm.profile_id,
    p.display_name,
    p.avatar_url,
    gm.role,
    coalesce(sh.paid, 0) as paid_cents,
    coalesce(sh.owed, 0) as owed_cents,
    coalesce(so.amount, 0) as settled_out_cents,
    coalesce(si.amount, 0) as settled_in_cents,
    coalesce(sh.paid, 0) - coalesce(sh.owed, 0) + coalesce(so.amount, 0) - coalesce(si.amount, 0) as net_cents
  from public.group_memberships gm
  join public.profiles p on p.id = gm.profile_id
  left join (
    select es.profile_id, sum(es.paid_cents) as paid, sum(es.owes_cents) as owed
    from public.expense_shares es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by es.profile_id
  ) sh on sh.profile_id = gm.profile_id
  left join (
    select from_profile_id, sum(amount_cents) as amount
    from public.settlements where group_id = p_group_id
    group by from_profile_id
  ) so on so.from_profile_id = gm.profile_id
  left join (
    select to_profile_id, sum(amount_cents) as amount
    from public.settlements where group_id = p_group_id
    group by to_profile_id
  ) si on si.to_profile_id = gm.profile_id
  where gm.group_id = p_group_id
    and public.is_group_member(p_group_id)
  order by gm.joined_at;
$$;

-- Group list with the caller's position and spend totals.
create or replace function public.my_groups()
returns table (
  id uuid,
  name text,
  starts_on date,
  ends_on date,
  created_at timestamptz,
  archived_at timestamptz,
  role text,
  member_count bigint,
  total_spent_cents bigint,
  my_net_cents bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    g.name,
    g.starts_on,
    g.ends_on,
    g.created_at,
    g.archived_at,
    mine.role,
    (select count(*) from public.group_memberships m where m.group_id = g.id) as member_count,
    coalesce((select sum(e.total_cents) from public.expenses e where e.group_id = g.id), 0) as total_spent_cents,
    coalesce((
      select sum(es.paid_cents - es.owes_cents)
      from public.expense_shares es
      join public.expenses e on e.id = es.expense_id
      where e.group_id = g.id and es.profile_id = auth.uid()
    ), 0)
    + coalesce((
      select sum(s.amount_cents) from public.settlements s
      where s.group_id = g.id and s.from_profile_id = auth.uid()
    ), 0)
    - coalesce((
      select sum(s.amount_cents) from public.settlements s
      where s.group_id = g.id and s.to_profile_id = auth.uid()
    ), 0) as my_net_cents
  from public.trip_groups g
  join public.group_memberships mine on mine.group_id = g.id and mine.profile_id = auth.uid()
  order by g.archived_at nulls first, coalesce(g.starts_on, g.created_at::date) desc, g.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke execute on function public.create_group(text, date, date) from public, anon;
revoke execute on function public.add_group_member(uuid, text) from public, anon;
revoke execute on function public.remove_group_member(uuid, uuid) from public, anon;
revoke execute on function public.save_receipt(uuid, jsonb) from public, anon;
revoke execute on function public.record_settlement(uuid, uuid, uuid, integer, text) from public, anon;
revoke execute on function public.group_balances(uuid) from public, anon;
revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.create_group(text, date, date) to authenticated;
grant execute on function public.add_group_member(uuid, text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.save_receipt(uuid, jsonb) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.group_balances(uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: receipts are private and scoped to {group_id}/{uploader_id}/file.
-- Avatars are public-read and scoped to {profile_id}/file.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create or replace function public.storage_group_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end;
$$;

create policy "members read group receipt images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and public.is_group_member(public.storage_group_id(name))
);

create policy "members upload their own receipt images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and public.is_group_member(public.storage_group_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);

create policy "uploaders delete their receipt images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and split_part(name, '/', 2) = auth.uid()::text
);

create policy "anyone reads avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "users upload their avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "users update their avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

create policy "users delete their avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
