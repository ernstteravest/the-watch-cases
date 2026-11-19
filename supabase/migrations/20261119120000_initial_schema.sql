-- ─────────────────────────────────────────────────────────────────────────────
--  The Watch Cases: initial schema
--
--  Security model
--   • Row Level Security is ON for every table.
--   • Visitors (anon) and signed-in users may only READ active products and
--     option prices. Nothing else is readable or writable from a browser.
--   • Customers, orders and newsletter sign-ups are written by the website's
--     server with the service-role key (never sent to the browser), which
--     bypasses RLS. Policies for customer accounts can be added later.
--
--  Money is stored in euro cents, including VAT.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists citext with schema extensions;

-- Keeps updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────── Products ───────────────────────────
create table public.products (
  slug              text primary key check (slug ~ '^[a-z0-9-]+$'),
  name              text not null,
  capacity          smallint not null check (capacity > 0),
  -- null = price not decided yet (the site shows €xxx.xx)
  price_from_cents  integer check (price_from_cents >= 0),
  active            boolean not null default true,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.products is 'Watch box models. Texts and photos live in the website code; prices and availability here.';

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Optional surcharges for configurator options (e.g. a leather that costs extra).
-- Empty at launch: every option is included in the product price.
create table public.option_prices (
  id                bigint generated always as identity primary key,
  product_slug      text references public.products (slug) on delete cascade, -- null = all models
  option_kind       text not null check (option_kind in ('exterior', 'interior', 'piece_material', 'piece_color', 'engraving')),
  option_id         text not null, -- id from config/options.ts, e.g. 'nappa' or 'cushions:nappa'
  price_delta_cents integer not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique nulls not distinct (product_slug, option_kind, option_id)
);

create trigger option_prices_updated_at before update on public.option_prices
  for each row execute function public.set_updated_at();

-- ─────────────────────────── Customers ──────────────────────────
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null unique,
  first_name    text,
  last_name     text,
  phone         text,
  -- Filled once customer accounts exist (Supabase Auth). Guest checkout leaves it empty.
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ─────────────────────────── Orders ─────────────────────────────
create type public.order_status as enum (
  'pending_payment', -- created at checkout, waiting for the payment provider
  'paid',            -- payment confirmed by a verified webhook
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

create sequence public.order_number_seq;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  -- e.g. TWC-2026-0001 (the number keeps counting across years)
  order_number       text not null unique default (
    'TWC-' || to_char(now() at time zone 'Europe/Amsterdam', 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0')
  ),
  customer_id        uuid not null references public.customers (id) on delete restrict,
  status             public.order_status not null default 'pending_payment',
  locale             text not null check (locale in ('nl', 'en')),
  currency           char(3) not null default 'EUR' check (currency = 'EUR'),
  subtotal_cents     integer not null check (subtotal_cents >= 0),
  shipping_cents     integer not null default 0 check (shipping_cents >= 0),
  discount_cents     integer not null default 0 check (discount_cents >= 0),
  -- VAT contained in total_cents; filled once the VAT rules are settled (accountant).
  tax_cents          integer check (tax_cents >= 0),
  total_cents        integer not null check (total_cents >= 0),
  shipping_country   char(2) not null check (shipping_country in ('NL', 'BE', 'DE')),
  shipping_address   jsonb not null,
  billing_address    jsonb,
  payment_provider   text,
  payment_reference  text unique, -- e.g. Stripe Checkout Session id
  paid_at            timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint orders_total_matches check (total_cents = subtotal_cents + shipping_cents - discount_cents)
);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_slug      text not null references public.products (slug) on delete restrict,
  product_name      text not null, -- snapshot, so old orders never change
  quantity          smallint not null check (quantity between 1 and 10),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  line_total_cents  integer not null check (line_total_cents >= 0),
  -- Full configurator design as ordered: model, colours, leathers per piece, engraving.
  configuration     jsonb not null,
  engraving_text    text check (char_length(engraving_text) <= 30),
  design_url        text,
  created_at        timestamptz not null default now(),
  constraint order_items_line_total check (line_total_cents = unit_price_cents * quantity)
);
create index order_items_order_id_idx on public.order_items (order_id);

-- Every status change, with time; filled automatically.
create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  note         text,
  created_at   timestamptz not null default now()
);
create index order_status_history_order_id_idx on public.order_status_history (order_id);

create or replace function public.log_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status) values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status) values (new.id, old.status, new.status);
    if new.status = 'paid' and new.paid_at is null then
      new.paid_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE so paid_at can be set on the same row; AFTER INSERT so the order exists.
create trigger orders_status_on_update before update on public.orders
  for each row execute function public.log_order_status();
create trigger orders_status_on_insert after insert on public.orders
  for each row execute function public.log_order_status();

-- ─────────────────────────── Newsletter ─────────────────────────
create table public.newsletter_subscribers (
  id                  uuid primary key default gen_random_uuid(),
  email               extensions.citext not null unique,
  locale              text not null check (locale in ('nl', 'en')),
  source              text not null default 'website',
  consent_at          timestamptz not null default now(),
  -- Double opt-in: set when the subscriber clicks the link in the confirmation e-mail.
  confirmation_token  uuid not null default gen_random_uuid(),
  confirmed_at        timestamptz,
  unsubscribed_at     timestamptz,
  created_at          timestamptz not null default now()
);

-- ─────────────────────────── Row Level Security ─────────────────
alter table public.products                enable row level security;
alter table public.option_prices           enable row level security;
alter table public.customers               enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.order_status_history    enable row level security;
alter table public.newsletter_subscribers  enable row level security;

create policy "Active products are public"
  on public.products for select to anon, authenticated
  using (active);

create policy "Active option prices are public"
  on public.option_prices for select to anon, authenticated
  using (active);

-- No policies on customers, orders, order_items, order_status_history or
-- newsletter_subscribers: with RLS on, browsers can neither read nor write them.

-- Belt and braces: browsers get no table rights beyond reading the catalogue.
revoke all on public.customers, public.orders, public.order_items,
              public.order_status_history, public.newsletter_subscribers
  from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;
revoke insert, update, delete, truncate on public.products, public.option_prices from anon, authenticated;
