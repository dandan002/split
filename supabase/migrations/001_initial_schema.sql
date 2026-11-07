create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.group_memberships (
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  paid_by uuid not null references public.profiles (id) on delete restrict,
  merchant text not null,
  occurred_on date not null default current_date,
  currency_code text not null default 'USD',
  total_cents integer not null check (total_cents >= 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.trip_groups (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  merchant text,
  receipt_date date,
  currency_code text not null default 'USD',
  subtotal_cents integer not null default 0,
  total_cents integer not null check (total_cents >= 0),
  image_path text,
  ocr_status text not null default 'draft' check (ocr_status in ('draft', 'processing', 'needs_review', 'confirmed', 'failed')),
  ocr_confidence numeric(4, 3) check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  raw_ocr jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  name text not null,
  quantity numeric(10, 3) not null default 1,
  unit_amount_cents integer,
  total_amount_cents integer not null check (total_amount_cents >= 0),
  ocr_confidence numeric(4, 3) check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  was_manually_edited boolean not null default false,
  position integer not null default 0
);

create table public.receipt_adjustments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('tax', 'tip', 'service_fee', 'delivery_fee', 'discount', 'credit', 'other')),
  amount_cents integer not null,
  allocation_strategy text not null default 'proportional'
    check (allocation_strategy in ('proportional', 'equal', 'custom')),
  position integer not null default 0
);

create table public.item_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_item_id uuid references public.receipt_items (id) on delete cascade,
  receipt_adjustment_id uuid references public.receipt_adjustments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  weight numeric(12, 4),
  amount_cents integer,
  created_at timestamptz not null default now(),
  check (
    (receipt_item_id is not null and receipt_adjustment_id is null)
    or (receipt_item_id is null and receipt_adjustment_id is not null)
  ),
  check (weight is not null or amount_cents is not null)
);

create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  owes_cents integer not null check (owes_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  primary key (expense_id, profile_id)
);

create index receipts_group_idx on public.receipts (group_id, created_at desc);
create index receipt_items_receipt_idx on public.receipt_items (receipt_id, position);
create index receipt_adjustments_receipt_idx on public.receipt_adjustments (receipt_id, position);
create index item_allocations_item_idx on public.item_allocations (receipt_item_id);
create index item_allocations_adjustment_idx on public.item_allocations (receipt_adjustment_id);
create index expense_shares_profile_idx on public.expense_shares (profile_id);

alter table public.profiles enable row level security;
alter table public.trip_groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.expenses enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.receipt_adjustments enable row level security;
alter table public.item_allocations enable row level security;
alter table public.expense_shares enable row level security;

create function public.is_group_member(target_group_id uuid)
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
  );
$$;

create policy "profiles are visible to signed-in users"
on public.profiles for select
to authenticated
using (true);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members read groups"
on public.trip_groups for select
to authenticated
using (public.is_group_member(id));

create policy "signed-in users create groups"
on public.trip_groups for insert
to authenticated
with check (created_by = auth.uid());

create policy "members read memberships"
on public.group_memberships for select
to authenticated
using (public.is_group_member(group_id));

create policy "owners manage memberships"
on public.group_memberships for all
to authenticated
using (
  exists (
    select 1 from public.group_memberships gm
    where gm.group_id = group_memberships.group_id
      and gm.profile_id = auth.uid()
      and gm.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.group_memberships gm
    where gm.group_id = group_memberships.group_id
      and gm.profile_id = auth.uid()
      and gm.role = 'owner'
  )
);

create policy "members manage expenses"
on public.expenses for all
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy "members manage receipts"
on public.receipts for all
to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id) and uploaded_by = auth.uid());

create policy "members manage receipt items"
on public.receipt_items for all
to authenticated
using (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_items.receipt_id
      and public.is_group_member(r.group_id)
  )
)
with check (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_items.receipt_id
      and public.is_group_member(r.group_id)
  )
);

create policy "members manage receipt adjustments"
on public.receipt_adjustments for all
to authenticated
using (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_adjustments.receipt_id
      and public.is_group_member(r.group_id)
  )
)
with check (
  exists (
    select 1 from public.receipts r
    where r.id = receipt_adjustments.receipt_id
      and public.is_group_member(r.group_id)
  )
);

create policy "members manage item allocations"
on public.item_allocations for all
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
)
with check (
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

create policy "members read expense shares"
on public.expense_shares for select
to authenticated
using (
  exists (
    select 1 from public.expenses e
    where e.id = expense_shares.expense_id
      and public.is_group_member(e.group_id)
  )
);
