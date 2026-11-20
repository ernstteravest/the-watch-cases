-- ─────────────────────────────────────────────────────────────────────────────
--  Checkout (Stage 7): shipping rates, manual logo check, logo files.
-- ─────────────────────────────────────────────────────────────────────────────

-- Shipping cost per country, in cents incl. VAT. NULL = not decided yet:
-- orders to that country are refused until a price is filled in.
create table public.shipping_rates (
  country      char(2) primary key check (country in ('NL', 'BE', 'DE')),
  price_cents  integer check (price_cents >= 0),
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);
create trigger shipping_rates_updated_at before update on public.shipping_rates
  for each row execute function public.set_updated_at();

insert into public.shipping_rates (country, price_cents) values
  ('NL', 0),     -- free shipping in the Netherlands
  ('BE', null),  -- to be decided
  ('DE', null)   -- to be decided
on conflict (country) do nothing;

alter table public.shipping_rates enable row level security;
create policy "Active shipping rates are public"
  on public.shipping_rates for select to anon, authenticated
  using (active);
revoke insert, update, delete, truncate on public.shipping_rates from anon, authenticated;

-- Orders with a logo are checked by hand before production.
alter table public.orders
  add column requires_logo_review boolean not null default false,
  add column logo_approved_at timestamptz,
  add column logo_review_note text;

-- Where the customer's logo files are stored (bucket order-logos).
alter table public.order_items
  add column logo_original_path text, -- the file exactly as uploaded: use this for printing
  add column logo_preview_path text;  -- the prepared image shown in the configurator

-- Private storage for logo files. No policies: only the website server
-- (secret key) can read or write; the browser uploads through one-time
-- signed links that the server creates per order.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-logos', 'order-logos', false, 10485760, array['image/png', 'image/jpeg', 'image/svg+xml'])
on conflict (id) do nothing;
