-- ─────────────────────────────────────────────────────────────────────────────
--  Phase 2 · Stage 3: own analytics, privacy (GDPR) requests, rate limits
--
--  Analytics without cookies and without personal data:
--   • no IP addresses, no cookies, no user ids;
--   • visitor_hash is a hash of (daily rotating secret + IP + browser),
--     computed on the server; it changes every day, so a visitor can be
--     counted once per day but never followed over time;
--   • only the referring website's host name is kept, not the full URL.
--  Events are written only by the website server (secret key).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.analytics_events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  type           text not null check (type in (
                   'page_view', 'configurator_open', 'add_to_cart', 'checkout_start', 'order_paid')),
  path           text not null check (char_length(path) <= 300 and path ~ '^/'),
  locale         text check (locale in ('nl', 'en')),
  referrer_host  text check (char_length(referrer_host) <= 253),
  utm_source     text check (char_length(utm_source) <= 100),
  utm_medium     text check (char_length(utm_medium) <= 100),
  utm_campaign   text check (char_length(utm_campaign) <= 100),
  device         text check (device in ('mobile', 'tablet', 'desktop')),
  country        char(2) check (country ~ '^[A-Z]{2}$'),
  visitor_hash   text check (char_length(visitor_hash) <= 64),
  order_id       uuid references public.orders (id) on delete set null,
  value_cents    integer check (value_cents >= 0)
);
create index analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index analytics_events_type_created_at_idx on public.analytics_events (type, created_at desc);

-- ─────────────────────────── Privacy requests ────────────────────
create table public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers (id) on delete set null,
  email         extensions.citext not null,
  type          text not null check (type in ('access', 'erasure', 'rectification', 'objection', 'restriction', 'portability')),
  status        text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  received_at   timestamptz not null default now(),
  -- The GDPR answer period is one month; extensions must be explained to the customer.
  due_at        timestamptz not null default (now() + interval '30 days'),
  completed_at  timestamptz,
  notes         text check (char_length(notes) <= 5000),
  handled_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint data_requests_completed check ((status in ('completed', 'rejected')) = (completed_at is not null))
);
create index data_requests_status_due_idx on public.data_requests (status, due_at);
create trigger data_requests_updated_at before update on public.data_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────── Rate limits ─────────────────────────
-- Counters per key (e.g. 'login:<ip-hash>') per time window, used by the
-- server to slow down brute-force attempts and form spam.
create table public.rate_limits (
  key           text not null check (char_length(key) <= 200),
  window_start  timestamptz not null,
  hits          integer not null default 1,
  primary key (key, window_start)
);

-- Counts one attempt and returns true while the key is within its limit.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit';
  end if;
  insert into public.rate_limits as r (key, window_start) values (p_key, v_window)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Housekeeping: drop windows older than a day.
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end;
$$;

-- ─────────────────────────── Row Level Security ──────────────────
alter table public.analytics_events  enable row level security;
alter table public.data_requests     enable row level security;
alter table public.rate_limits       enable row level security;

revoke all on public.analytics_events, public.data_requests, public.rate_limits
  from anon, authenticated;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

grant select on public.analytics_events to authenticated;
create policy "Statistics readers read events" on public.analytics_events
  for select to authenticated using (public.has_permission('analytics.view'));

grant select, insert on public.data_requests to authenticated;
grant update (status, completed_at, notes, handled_by, due_at) on public.data_requests to authenticated;
create policy "Customer readers read privacy requests" on public.data_requests
  for select to authenticated using (public.has_permission('customers.read'));
create policy "Customer managers register privacy requests" on public.data_requests
  for insert to authenticated with check (public.has_permission('customers.manage'));
create policy "Customer managers handle privacy requests" on public.data_requests
  for update to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));

-- rate_limits: no policies; only the server uses it, through hit_rate_limit().
