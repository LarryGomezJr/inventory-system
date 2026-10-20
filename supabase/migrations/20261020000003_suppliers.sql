-- Inventory System — suppliers, linked to products
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- Requires 20261020000001_init.sql and 20261020000002_products.sql.

create table if not exists public.tbl_supplier (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  category        text not null check (category in (
                    'Food & Beverage', 'Medicine', 'Electronics', 'Office Supplies',
                    'Cleaning Supplies', 'Hardware', 'Other')),
  contact_person  text check (contact_person is null or char_length(contact_person) <= 120),
  phone           text check (phone is null or char_length(phone) <= 30),
  email           text check (email is null or char_length(email) <= 254),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Target of the composite foreign key from tbl_product (same-user links only).
  unique (id, user_id)
);

-- One supplier name per user, ignoring case.
create unique index if not exists tbl_supplier_user_name_idx on public.tbl_supplier (user_id, lower(name));

drop trigger if exists tbl_supplier_set_updated_at on public.tbl_supplier;
create trigger tbl_supplier_set_updated_at
  before update on public.tbl_supplier
  for each row execute function public.set_updated_at();

alter table public.tbl_supplier enable row level security;
revoke all on public.tbl_supplier from anon;
grant select, insert, update, delete on public.tbl_supplier to authenticated;

drop policy if exists "Users can view own suppliers" on public.tbl_supplier;
create policy "Users can view own suppliers"
  on public.tbl_supplier for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own suppliers" on public.tbl_supplier;
create policy "Users can add own suppliers"
  on public.tbl_supplier for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own suppliers" on public.tbl_supplier;
create policy "Users can update own suppliers"
  on public.tbl_supplier for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own suppliers" on public.tbl_supplier;
create policy "Users can delete own suppliers"
  on public.tbl_supplier for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Link products to suppliers. The composite key means a product can only
-- point at a supplier owned by the same user. Deleting a supplier keeps the
-- product and just clears supplier_id.
-- ---------------------------------------------------------------------------
alter table public.tbl_product add column if not exists supplier_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tbl_product_supplier_fk'
  ) then
    alter table public.tbl_product
      add constraint tbl_product_supplier_fk
      foreign key (supplier_id, user_id)
      references public.tbl_supplier (id, user_id)
      on delete set null (supplier_id);
  end if;
end $$;

create index if not exists tbl_product_user_supplier_idx on public.tbl_product (user_id, supplier_id);

-- Convert the old free-text product supplier into supplier records (runs once).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tbl_product' and column_name = 'supplier'
  ) then
    insert into public.tbl_supplier (user_id, name, category)
    select
      user_id,
      min(trim(supplier)),
      mode() within group (order by product_type)
    from public.tbl_product
    where supplier is not null and trim(supplier) <> ''
    group by user_id, lower(trim(supplier))
    on conflict do nothing;

    update public.tbl_product p
       set supplier_id = s.id
      from public.tbl_supplier s
     where p.supplier_id is null
       and s.user_id = p.user_id
       and lower(s.name) = lower(trim(p.supplier));

    alter table public.tbl_product drop column supplier;
  end if;
end $$;
