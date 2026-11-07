-- RLS and RPC tests for groups, receipts, ledger saves, and settlements.
-- Runs as superuser for setup and switches to the `authenticated` role to act
-- as specific users. Any failed expectation raises and aborts the run.

\set ana '''00000000-0000-0000-0000-00000000000a'''
\set bo '''00000000-0000-0000-0000-00000000000b'''
\set cam '''00000000-0000-0000-0000-00000000000c'''
\set eve '''00000000-0000-0000-0000-00000000000e'''

create or replace function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

create or replace function pg_temp.expect_error(sql text, expected text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error "%" but statement succeeded: %', expected, sql;
exception
  when others then
    if sqlerrm like 'expected error%' then
      raise;
    end if;
    if position(expected in sqlerrm) = 0 then
      raise exception 'expected error "%" but got "%" for: %', expected, sqlerrm, sql;
    end if;
end;
$$;

-- Sign-up trigger creates profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  (:ana, 'Ana@Example.com', '{"display_name":"Ana"}'),
  (:bo, 'bo@example.com', '{}'),
  (:cam, 'cam@example.com', '{"display_name":"Cam"}'),
  (:eve, 'eve@example.com', '{"display_name":"Eve"}');

do $$ begin
  if (select count(*) from public.profiles) <> 4 then raise exception 'profiles not bootstrapped'; end if;
  if (select display_name from public.profiles where email = 'bo@example.com') <> 'bo' then
    raise exception 'display name fallback failed';
  end if;
  if (select email from public.profiles where display_name = 'Ana') <> 'ana@example.com' then
    raise exception 'email not normalized';
  end if;
end $$;

-- Ana creates a group and becomes owner.
select pg_temp.act_as(:ana);
set role authenticated;

create temp table ctx as select (public.create_group('Iceland Trip', '2026-06-12', '2026-06-20')).id as group_id;

do $$
declare g uuid := (select group_id from ctx);
begin
  if not exists (select 1 from public.trip_groups where id = g) then raise exception 'owner cannot read new group'; end if;
  if (select role from public.group_memberships where group_id = g and profile_id = auth.uid()) <> 'owner' then
    raise exception 'creator is not owner';
  end if;
end $$;

-- Membership policies no longer recurse.
select count(*) from public.group_memberships;

-- Direct inserts into ledger tables are blocked.
select pg_temp.expect_error(
  format('insert into public.trip_groups (name, created_by) values (%L, %L)', 'Sneaky', auth.uid()),
  'row-level security'
);

-- Owner adds members by email (case-insensitive).
select public.add_group_member((select group_id from ctx), 'BO@example.com');
select public.add_group_member((select group_id from ctx), 'cam@example.com');
select pg_temp.expect_error(
  format('select public.add_group_member(%L, %L)', (select group_id from ctx), 'nobody@example.com'),
  'no_account_for_email'
);

-- Non-owner member cannot add members; non-member sees nothing.
reset role;
select pg_temp.act_as(:bo);
set role authenticated;
select pg_temp.expect_error(
  format('select public.add_group_member(%L, %L)', (select group_id from ctx), 'eve@example.com'),
  'only_owner_can_add_members'
);
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'bo should see 3 co-member profiles'; end if;
end $$;

reset role;
select pg_temp.act_as(:eve);
set role authenticated;
do $$ begin
  if exists (select 1 from public.trip_groups) then raise exception 'non-member can read group'; end if;
  if exists (select 1 from public.group_memberships) then raise exception 'non-member can read memberships'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'non-member sees other profiles'; end if;
  if exists (select 1 from public.my_groups()) then raise exception 'non-member my_groups not empty'; end if;
  if exists (select 1 from public.group_balances((select group_id from ctx))) then raise exception 'non-member sees balances'; end if;
end $$;
select pg_temp.expect_error(
  format('insert into public.receipts (group_id, uploaded_by, total_cents) values (%L, auth.uid(), 0)', (select group_id from ctx)),
  'row-level security'
);

-- Anonymous callers are rejected.
reset role;
select pg_temp.act_as('');
set role authenticated;
select pg_temp.expect_error('select public.create_group(''Anon'')', 'not_authenticated');

-- Ana uploads a draft receipt and saves it.
reset role;
select pg_temp.act_as(:ana);
set role authenticated;

insert into ctx (group_id) values (null);
create temp table rctx as
  with r as (
    insert into public.receipts (group_id, uploaded_by, total_cents, image_path, ocr_status)
    select group_id, auth.uid(), 0, group_id || '/' || auth.uid() || '/r.jpg', 'processing' from ctx where group_id is not null
    returning id
  ) select id as receipt_id from r;
delete from ctx where group_id is null;

update public.receipts set ocr_status = 'needs_review', merchant = 'Blue Hill' where id = (select receipt_id from rctx);

-- Mismatched totals are rejected and leave nothing behind.
select pg_temp.expect_error(
  format($q$select public.save_receipt(%L, %L::jsonb)$q$, (select receipt_id from rctx), jsonb_build_object(
    'merchant', 'Blue Hill', 'totalCents', 1000, 'subtotalCents', 900, 'paidBy', current_setting('request.jwt.claim.sub'),
    'items', jsonb_build_array(jsonb_build_object('name', 'Oysters', 'totalAmountCents', 900,
      'allocations', jsonb_build_array(jsonb_build_object('profileId', current_setting('request.jwt.claim.sub'), 'weight', 1)))),
    'adjustments', '[]'::jsonb,
    'shares', jsonb_build_array(jsonb_build_object('profileId', current_setting('request.jwt.claim.sub'), 'owesCents', 1000))
  )),
  'receipt_total_mismatch'
);

-- Outsider in allocations is rejected.
select pg_temp.expect_error(
  format($q$select public.save_receipt(%L, %L::jsonb)$q$, (select receipt_id from rctx), jsonb_build_object(
    'merchant', 'Blue Hill', 'totalCents', 900, 'paidBy', current_setting('request.jwt.claim.sub'),
    'items', jsonb_build_array(jsonb_build_object('name', 'Oysters', 'totalAmountCents', 900,
      'allocations', jsonb_build_array(jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000e', 'weight', 1)))),
    'shares', jsonb_build_array(jsonb_build_object('profileId', current_setting('request.jwt.claim.sub'), 'owesCents', 900))
  )),
  'allocation_member_not_in_group'
);

-- Shares that don't add up are rejected.
select pg_temp.expect_error(
  format($q$select public.save_receipt(%L, %L::jsonb)$q$, (select receipt_id from rctx), jsonb_build_object(
    'merchant', 'Blue Hill', 'totalCents', 900, 'paidBy', current_setting('request.jwt.claim.sub'),
    'items', jsonb_build_array(jsonb_build_object('name', 'Oysters', 'totalAmountCents', 900,
      'allocations', jsonb_build_array(jsonb_build_object('profileId', current_setting('request.jwt.claim.sub'), 'weight', 1)))),
    'shares', jsonb_build_array(jsonb_build_object('profileId', current_setting('request.jwt.claim.sub'), 'owesCents', 899))
  )),
  'shares_total_mismatch'
);

do $$ begin
  if exists (select 1 from public.expenses) then raise exception 'failed save left an expense row'; end if;
  if exists (select 1 from public.receipt_items) then raise exception 'failed save left item rows'; end if;
end $$;

-- Valid save: $60 food split Ana/Bo, $30 Cam, $9 tax proportional, $1 discount.
-- Total 6000 + 3000 + 900 - 100 = 9800. Ana pays.
create temp table save_result as
select public.save_receipt((select receipt_id from rctx), jsonb_build_object(
  'merchant', 'Blue Hill', 'receiptDate', '2026-06-14', 'currencyCode', 'usd',
  'subtotalCents', 9000, 'totalCents', 9800, 'paidBy', '00000000-0000-0000-0000-00000000000a',
  'items', jsonb_build_array(
    jsonb_build_object('name', 'Tasting menu', 'quantity', 2, 'totalAmountCents', 6000, 'confidence', 0.95,
      'allocations', jsonb_build_array(
        jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000a', 'weight', 1),
        jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000b', 'weight', 1))),
    jsonb_build_object('name', 'Wine', 'totalAmountCents', 3000,
      'allocations', jsonb_build_array(jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000c', 'weight', 1)))
  ),
  'adjustments', jsonb_build_array(
    jsonb_build_object('label', 'Tax', 'kind', 'tax', 'amountCents', 900, 'strategy', 'proportional'),
    jsonb_build_object('label', 'Promo', 'kind', 'discount', 'amountCents', -100, 'strategy', 'equal')
  ),
  'shares', jsonb_build_array(
    jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000a', 'owesCents', 3267),
    jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000b', 'owesCents', 3267),
    jsonb_build_object('profileId', '00000000-0000-0000-0000-00000000000c', 'owesCents', 3266)
  )
)) as expense_id;

do $$
declare e uuid := (select expense_id from save_result);
begin
  if (select total_cents from public.expenses where id = e) <> 9800 then raise exception 'expense total wrong'; end if;
  if (select currency_code from public.expenses where id = e) <> 'USD' then raise exception 'currency not normalized'; end if;
  if (select count(*) from public.receipt_items ri join public.receipts r on r.id = ri.receipt_id where r.expense_id = e) <> 2 then
    raise exception 'items not saved';
  end if;
  if (select count(*) from public.item_allocations) <> 3 then raise exception 'allocations not saved'; end if;
  if (select ocr_status from public.receipts where expense_id = e) <> 'confirmed' then raise exception 'receipt not confirmed'; end if;
  if (select paid_cents from public.expense_shares where expense_id = e and profile_id = auth.uid()) <> 9800 then
    raise exception 'payer paid_cents wrong';
  end if;
  if (select sum(owes_cents) from public.expense_shares where expense_id = e) <> 9800 then raise exception 'shares do not sum'; end if;
end $$;

-- Saving twice is rejected; confirmed receipts can't be edited directly.
select pg_temp.expect_error(
  format($q$select public.save_receipt(%L, '{}'::jsonb)$q$, (select receipt_id from rctx)),
  'receipt_already_saved'
);
update public.receipts set merchant = 'Hacked' where id = (select receipt_id from rctx);
do $$ begin
  if (select merchant from public.receipts where id = (select receipt_id from rctx)) <> 'Blue Hill' then
    raise exception 'confirmed receipt was editable';
  end if;
end $$;
delete from public.expense_shares where expense_id = (select expense_id from save_result);
do $$ begin
  if (select count(*) from public.expense_shares) <> 3 then raise exception 'shares were deletable'; end if;
end $$;

-- Balances: Ana paid 9800 and owes 3267 => +6533; Bo -3267; Cam -3266.
do $$
declare g uuid := (select group_id from ctx);
begin
  if (select net_cents from public.group_balances(g) where profile_id = '00000000-0000-0000-0000-00000000000a') <> 6533 then
    raise exception 'ana balance wrong';
  end if;
  if (select sum(net_cents) from public.group_balances(g)) <> 0 then raise exception 'balances do not net to zero'; end if;
end $$;

-- Bo pays Ana back $20.
reset role;
select pg_temp.act_as(:bo);
set role authenticated;
select public.record_settlement((select group_id from ctx), '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 2000, 'Venmo');
select pg_temp.expect_error(
  format('select public.record_settlement(%L, %L, %L, 0)', (select group_id from ctx),
    '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a'),
  'invalid_settlement_amount'
);
select pg_temp.expect_error(
  format('select public.record_settlement(%L, %L, %L, 100)', (select group_id from ctx),
    '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000e'),
  'settlement_member_not_in_group'
);

do $$
declare g uuid := (select group_id from ctx);
begin
  if (select net_cents from public.group_balances(g) where profile_id = '00000000-0000-0000-0000-00000000000b') <> -1267 then
    raise exception 'bo balance after settlement wrong';
  end if;
  if (select my_net_cents from public.my_groups() where id = g) <> -1267 then raise exception 'my_groups net wrong'; end if;
  if (select total_spent_cents from public.my_groups() where id = g) <> 9800 then raise exception 'my_groups spend wrong'; end if;
end $$;

-- Members with ledger history can't be removed; last owner can't leave.
reset role;
select pg_temp.act_as(:ana);
set role authenticated;
select pg_temp.expect_error(
  format('select public.remove_group_member(%L, %L)', (select group_id from ctx), '00000000-0000-0000-0000-00000000000c'),
  'member_has_ledger_history'
);
select pg_temp.expect_error(
  format('select public.remove_group_member(%L, %L)', (select group_id from ctx), '00000000-0000-0000-0000-00000000000a'),
  'cannot_remove_last_owner'
);
select public.add_group_member((select group_id from ctx), 'eve@example.com');
select public.remove_group_member((select group_id from ctx), '00000000-0000-0000-0000-00000000000e');
do $$ begin
  if exists (select 1 from public.group_memberships where profile_id = '00000000-0000-0000-0000-00000000000e') then
    raise exception 'eve not removed';
  end if;
end $$;

-- Profiles: users can rename themselves but not change email.
update public.profiles set display_name = 'Ana B' where id = auth.uid();
select pg_temp.expect_error(
  'update public.profiles set email = ''x@example.com'' where id = auth.uid()',
  'permission denied'
);

-- Storage policies: members upload to their own folder within the group.
select pg_temp.expect_error(
  format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'receipts',
    (select group_id from ctx) || '/00000000-0000-0000-0000-00000000000b/x.jpg'),
  'row-level security'
);
insert into storage.objects (bucket_id, name)
values ('receipts', (select group_id from ctx) || '/' || auth.uid() || '/ok.jpg');

reset role;
select pg_temp.act_as(:eve);
set role authenticated;
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'receipts') then
    raise exception 'non-member can see receipt images';
  end if;
end $$;

reset role;
\echo 'ledger.test.sql passed'
