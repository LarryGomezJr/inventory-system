-- Inventory System — products
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- Requires 20261020000001_init.sql (uses public.set_updated_at()).

create table if not exists public.tbl_product (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  product_type     text not null check (product_type in (
                     'Food & Beverage', 'Medicine', 'Electronics', 'Office Supplies',
                     'Cleaning Supplies', 'Hardware', 'Other')),
  quantity         integer not null check (quantity between 0 and 1000000),
  reorder_level    integer not null default 10 check (reorder_level between 0 and 1000000),
  expiration_date  date,
  supplier         text check (supplier is null or char_length(supplier) <= 120),
  -- Restock status, computed by the database so it can be filtered and counted.
  stock_status     text generated always as (
                     case
                       when quantity = 0 then 'out_of_stock'
                       when quantity <= reorder_level then 'low_stock'
                       else 'in_stock'
                     end
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tbl_product_user_created_idx on public.tbl_product (user_id, created_at desc);
create index if not exists tbl_product_user_status_idx on public.tbl_product (user_id, stock_status);
create index if not exists tbl_product_user_expiry_idx on public.tbl_product (user_id, expiration_date);

drop trigger if exists tbl_product_set_updated_at on public.tbl_product;
create trigger tbl_product_set_updated_at
  before update on public.tbl_product
  for each row execute function public.set_updated_at();

-- Each user can only see and change their own products.
alter table public.tbl_product enable row level security;
revoke all on public.tbl_product from anon;
grant select, insert, update, delete on public.tbl_product to authenticated;

drop policy if exists "Users can view own products" on public.tbl_product;
create policy "Users can view own products"
  on public.tbl_product for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own products" on public.tbl_product;
create policy "Users can add own products"
  on public.tbl_product for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own products" on public.tbl_product;
create policy "Users can update own products"
  on public.tbl_product for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own products" on public.tbl_product;
create policy "Users can delete own products"
  on public.tbl_product for delete
  to authenticated
  using ((select auth.uid()) = user_id);
