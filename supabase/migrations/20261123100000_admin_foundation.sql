-- ─────────────────────────────────────────────────────────────────────────────
--  Phase 2 · Stage 3: foundation for the management environment (/beheer)
--
--  Adds administrators, roles, permissions, an audit log and payments, and
--  gives signed-in administrators access to the existing shop tables.
--
--  Security model (in addition to the initial schema)
--   • An administrator is a signed-in Supabase Auth user with an ACTIVE row
--     in public.profiles. Accounts are created by invitation only.
--   • Every administrator rule also requires a session that passed MFA
--     (JWT claim aal = 'aal2'). Without MFA an administrator sees nothing.
--   • Permissions come from the role (owner, manager, editor, support).
--     The website server still checks them too; these rules are the second,
--     independent layer.
--   • Supabase grants new tables to anon/authenticated by default, so every
--     new table first has ALL rights revoked and only what is needed granted.
--   • The audit log can be added to, never changed or deleted.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────── Roles & permissions ─────────────────
create table public.roles (
  id           text primary key check (id ~ '^[a-z_]+$'),
  name_nl      text not null,
  name_en      text not null,
  description  text,
  sort_order   smallint not null default 0
);

create table public.permissions (
  key          text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description  text not null
);

create table public.role_permissions (
  role_id     text not null references public.roles (id) on delete cascade,
  permission  text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission)
);

insert into public.roles (id, name_nl, name_en, description, sort_order) values
  ('owner',   'Eigenaar',   'Owner',   'Everything, including administrators, settings and the audit log', 1),
  ('manager', 'Manager',    'Manager', 'Shop, customers, products and content; no administrators or settings changes', 2),
  ('editor',  'Redacteur',  'Editor',  'Website content, media and statistics', 3),
  ('support', 'Klantenservice', 'Support', 'Orders and customers; no refunds, products or content', 4);

insert into public.permissions (key, description) values
  ('dashboard.view',     'See the dashboard'),
  ('orders.read',        'See orders, order items and payments'),
  ('orders.manage',      'Change order status, notes and logo review'),
  ('orders.refund',      'Refund payments through the payment provider'),
  ('customers.read',     'See customers, newsletter subscribers and privacy requests'),
  ('customers.manage',   'Edit customer details and handle privacy requests'),
  ('customers.export',   'Export all data of a customer (GDPR access request)'),
  ('customers.delete',   'Anonymise customers and remove subscribers (GDPR erasure)'),
  ('products.manage',    'Prices, availability, option prices and shipping rates'),
  ('content.edit',       'Edit website texts and images as drafts'),
  ('content.publish',    'Publish and restore website content'),
  ('media.manage',       'Upload and remove images in the media library'),
  ('analytics.view',     'See website statistics'),
  ('settings.read',      'See business settings'),
  ('settings.manage',    'Change business settings'),
  ('users.manage',       'Invite administrators, change roles, deactivate accounts'),
  ('audit.read',         'Read the audit log');

insert into public.role_permissions (role_id, permission)
select 'owner', key from public.permissions;

insert into public.role_permissions (role_id, permission) values
  ('manager', 'dashboard.view'), ('manager', 'orders.read'), ('manager', 'orders.manage'),
  ('manager', 'orders.refund'), ('manager', 'customers.read'), ('manager', 'customers.manage'),
  ('manager', 'customers.export'), ('manager', 'products.manage'), ('manager', 'content.edit'),
  ('manager', 'content.publish'), ('manager', 'media.manage'), ('manager', 'analytics.view'),
  ('manager', 'settings.read'),
  ('editor', 'dashboard.view'), ('editor', 'content.edit'), ('editor', 'content.publish'),
  ('editor', 'media.manage'), ('editor', 'analytics.view'),
  ('support', 'dashboard.view'), ('support', 'orders.read'), ('support', 'orders.manage'),
  ('support', 'customers.read'), ('support', 'customers.manage'), ('support', 'customers.export');

-- ─────────────────────────── Administrators ──────────────────────
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          extensions.citext not null unique,
  full_name      text not null check (char_length(full_name) between 1 and 120),
  role_id        text not null references public.roles (id) on delete restrict,
  active         boolean not null default true,
  invited_by     uuid references public.profiles (id) on delete set null,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.profiles is 'Administrators of /beheer. A row here (active) plus MFA is what makes a Supabase user an administrator.';
create index profiles_role_id_idx on public.profiles (role_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- There must always be at least one active owner, so nobody can lock the
-- business out of its own management environment by accident.
create or replace function public.keep_one_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.role_id = 'owner' and old.active)
     or (tg_op = 'UPDATE' and old.role_id = 'owner' and old.active
         and (new.role_id <> 'owner' or not new.active)) then
    if not exists (
      select 1 from public.profiles
      where role_id = 'owner' and active and id <> old.id
    ) then
      raise exception 'At least one active owner is required' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_keep_one_owner before update or delete on public.profiles
  for each row execute function public.keep_one_owner();

-- ─────────────────────────── Permission checks ───────────────────
-- Used by the rules below and by the website server. SECURITY DEFINER so
-- they can read profiles and role_permissions without exposing them.

-- True when the current session passed multi-factor authentication.
create or replace function public.session_has_mfa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- True for an active administrator with MFA.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.session_has_mfa() and exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  );
$$;

-- True when the current administrator (active, MFA) has this permission.
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.session_has_mfa() and exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    where pr.id = auth.uid() and pr.active and rp.permission = p_permission
  );
$$;

-- All permissions of the current administrator (for showing/hiding menu items).
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select rp.permission
  from public.profiles pr
  join public.role_permissions rp on rp.role_id = pr.role_id
  where pr.id = auth.uid() and pr.active and public.session_has_mfa();
$$;

revoke all on function public.session_has_mfa(), public.is_admin(),
  public.has_permission(text), public.my_permissions() from public, anon;
grant execute on function public.session_has_mfa(), public.is_admin(),
  public.has_permission(text), public.my_permissions() to authenticated, service_role;
revoke all on function public.keep_one_owner() from public, anon, authenticated;

-- ─────────────────────────── Audit log ───────────────────────────
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_email  text,          -- snapshot, so the entry stays readable after an account is removed
  action       text not null check (action ~ '^[a-z_]+\.[a-z_]+$'), -- e.g. order.status_changed
  entity       text,          -- e.g. order, customer, content_entry
  entity_id    text,
  -- What changed. Never put passwords, keys or full payment details here;
  -- personal data only where needed to understand the change.
  details      jsonb not null default '{}'::jsonb,
  ip_hash      text           -- salted hash, never the raw IP address
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- Entries can never be changed or removed, not even with the secret key.
create or replace function public.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The audit log cannot be changed or deleted' using errcode = 'insufficient_privilege';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_append_only();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_logs_append_only();
revoke all on function public.audit_logs_append_only() from public, anon, authenticated;

-- Administrators write entries only through this function, which fills in
-- who they are; they cannot pretend to be someone else.
create or replace function public.log_admin_action(
  p_action     text,
  p_entity     text default null,
  p_entity_id  text default null,
  p_details    jsonb default '{}'::jsonb,
  p_ip_hash    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Not an administrator' using errcode = 'insufficient_privilege';
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, details, ip_hash)
  values (auth.uid(), v_email, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb), p_ip_hash)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.log_admin_action(text, text, text, jsonb, text) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb, text) to authenticated, service_role;

-- ─────────────────────────── Payments ────────────────────────────
-- Payment and refund history per order. Card details never come here:
-- only the payment provider's reference and amounts.
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete restrict,
  provider         text not null check (provider in ('stripe')),
  kind             text not null check (kind in ('payment', 'refund')),
  provider_ref     text not null unique, -- e.g. Stripe payment intent or refund id
  amount_cents     integer not null check (amount_cents > 0),
  currency         char(3) not null default 'EUR' check (currency = 'EUR'),
  status           text not null check (status in ('pending', 'succeeded', 'failed', 'cancelled')),
  method           text,                 -- e.g. ideal, card, bancontact
  failure_reason   text,
  created_by       uuid references public.profiles (id) on delete set null, -- administrator, for refunds
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- The status history is written by a trigger. Administrators change order
-- statuses but have no rights on the history table itself, so the trigger
-- runs with the rights of its owner.
alter function public.log_order_status() security definer;
revoke all on function public.log_order_status() from public, anon, authenticated;

-- ─────────────────────────── Useful indexes on existing tables ───
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_requires_logo_review_idx on public.orders (created_at)
  where requires_logo_review and logo_approved_at is null;
create index if not exists newsletter_subscribers_created_at_idx on public.newsletter_subscribers (created_at desc);

-- ─────────────────────────── Row Level Security ──────────────────
alter table public.roles             enable row level security;
alter table public.permissions       enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.profiles          enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.payments          enable row level security;

revoke all on public.roles, public.permissions, public.role_permissions,
              public.profiles, public.audit_logs, public.payments
  from anon, authenticated;

-- Roles and permissions: administrators may read them; changes only via migrations.
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
create policy "Administrators read roles" on public.roles
  for select to authenticated using (public.is_admin());
create policy "Administrators read permissions" on public.permissions
  for select to authenticated using (public.is_admin());
create policy "Administrators read role permissions" on public.role_permissions
  for select to authenticated using (public.is_admin());

-- Profiles: you can read your own (also before MFA, so the login screen
-- knows whether you are an administrator); user managers read and change all.
-- New administrators are created by the server after an invitation.
grant select on public.profiles to authenticated;
grant update (full_name, role_id, active) on public.profiles to authenticated;
create policy "Read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "User managers read profiles" on public.profiles
  for select to authenticated using (public.has_permission('users.manage'));
create policy "User managers update profiles" on public.profiles
  for update to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- Audit log: read with permission; writing only through log_admin_action()
-- or by the server.
grant select on public.audit_logs to authenticated;
create policy "Read audit log" on public.audit_logs
  for select to authenticated using (public.has_permission('audit.read'));

-- Payments: read with order rights; written only by the server (webhook, refunds).
grant select on public.payments to authenticated;
create policy "Read payments" on public.payments
  for select to authenticated using (public.has_permission('orders.read'));

-- ── Existing shop tables: administrator access ──
-- Only the columns an administrator may change are granted; amounts,
-- addresses and payment references stay as the customer placed them.

grant select on public.customers to authenticated;
grant update (first_name, last_name, phone) on public.customers to authenticated;
create policy "Administrators read customers" on public.customers
  for select to authenticated using (public.has_permission('customers.read'));
create policy "Administrators update customers" on public.customers
  for update to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));

grant select on public.orders to authenticated;
grant update (status, notes, logo_approved_at, logo_review_note) on public.orders to authenticated;
create policy "Administrators read orders" on public.orders
  for select to authenticated using (public.has_permission('orders.read'));
create policy "Administrators update orders" on public.orders
  for update to authenticated
  using (public.has_permission('orders.manage'))
  with check (public.has_permission('orders.manage'));

grant select on public.order_items to authenticated;
create policy "Administrators read order items" on public.order_items
  for select to authenticated using (public.has_permission('orders.read'));

grant select on public.order_status_history to authenticated;
create policy "Administrators read status history" on public.order_status_history
  for select to authenticated using (public.has_permission('orders.read'));

grant select on public.newsletter_subscribers to authenticated;
grant update (unsubscribed_at) on public.newsletter_subscribers to authenticated;
grant delete on public.newsletter_subscribers to authenticated;
create policy "Administrators read subscribers" on public.newsletter_subscribers
  for select to authenticated using (public.has_permission('customers.read'));
create policy "Administrators unsubscribe subscribers" on public.newsletter_subscribers
  for update to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));
create policy "Administrators remove subscribers" on public.newsletter_subscribers
  for delete to authenticated using (public.has_permission('customers.delete'));

-- Products, option prices and shipping rates: visitors keep reading the
-- active rows (existing rules); product managers also see inactive rows
-- and change prices and availability. New models are added via migrations,
-- because their photos and texts live in the website code.
grant update (price_from_cents, active, sort_order) on public.products to authenticated;
create policy "Product managers read all products" on public.products
  for select to authenticated using (public.has_permission('products.manage'));
create policy "Product managers update products" on public.products
  for update to authenticated
  using (public.has_permission('products.manage'))
  with check (public.has_permission('products.manage'));

grant insert, update, delete on public.option_prices to authenticated;
create policy "Product managers read all option prices" on public.option_prices
  for select to authenticated using (public.has_permission('products.manage'));
create policy "Product managers add option prices" on public.option_prices
  for insert to authenticated with check (public.has_permission('products.manage'));
create policy "Product managers update option prices" on public.option_prices
  for update to authenticated
  using (public.has_permission('products.manage'))
  with check (public.has_permission('products.manage'));
create policy "Product managers remove option prices" on public.option_prices
  for delete to authenticated using (public.has_permission('products.manage'));

grant update (price_cents, active) on public.shipping_rates to authenticated;
create policy "Product managers read all shipping rates" on public.shipping_rates
  for select to authenticated using (public.has_permission('products.manage'));
create policy "Product managers update shipping rates" on public.shipping_rates
  for update to authenticated
  using (public.has_permission('products.manage'))
  with check (public.has_permission('products.manage'));
