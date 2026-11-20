-- Checks for the schema and its security rules. Run against a test database
-- after the migration and seed (see supabase/README.md). Any failure raises.
\set ON_ERROR_STOP 1

-- ── Visitors (anon) ───────────────────────────────────────────────
set role anon;
do $$ begin
  if (select count(*) from public.products) <> 2 then raise exception 'anon should see 2 active products'; end if;
end $$;
do $$ begin
  begin perform 1 from public.customers; raise exception 'FAIL: anon read customers';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.orders; raise exception 'FAIL: anon read orders';
  exception when insufficient_privilege then null; end;
  begin insert into public.newsletter_subscribers (email, locale) values ('x@example.com', 'nl'); raise exception 'FAIL: anon wrote newsletter';
  exception when insufficient_privilege then null; end;
  begin update public.products set price_from_cents = 1; raise exception 'FAIL: anon changed prices';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Inactive products are hidden from visitors.
update public.products set active = false where slug = 'quartet-slim';
set role anon;
do $$ begin
  if (select count(*) from public.products) <> 1 then raise exception 'inactive product visible to anon'; end if;
end $$;
reset role;
update public.products set active = true where slug = 'quartet-slim';

-- ── Server (service_role) ─────────────────────────────────────────
set role service_role;
do $$
declare c uuid; o public.orders; n int;
begin
  insert into public.customers (email, first_name) values ('Test@Example.com', 'Test') returning id into c;
  -- e-mail is case-insensitive
  begin insert into public.customers (email) values ('test@example.com'); raise exception 'FAIL: duplicate e-mail accepted';
  exception when unique_violation then null; end;

  insert into public.orders (customer_id, locale, subtotal_cents, shipping_cents, total_cents, shipping_country, shipping_address)
  values (c, 'nl', 34900, 0, 34900, 'NL', '{"line1":"Damrak 1","postal_code":"1012 LG","city":"Amsterdam","country":"NL"}')
  returning * into o;
  if o.order_number !~ '^TWC-\d{4}-\d{4}$' then raise exception 'bad order number %', o.order_number; end if;
  if o.status <> 'pending_payment' then raise exception 'new order should be pending_payment'; end if;

  insert into public.order_items (order_id, product_slug, product_name, quantity, unit_price_cents, line_total_cents, configuration, engraving_text)
  values (o.id, 'duo', 'Duo', 1, 34900, 34900, '{"product":"duo","exterior":"navy","interior":"beige"}', 'A.V.');

  update public.orders set status = 'paid' where id = o.id returning * into o;
  if o.paid_at is null then raise exception 'paid_at not set'; end if;
  select count(*) into n from public.order_status_history where order_id = o.id;
  if n <> 2 then raise exception 'expected 2 status history rows, got %', n; end if;

  -- Rules the database enforces
  begin insert into public.orders (customer_id, locale, subtotal_cents, total_cents, shipping_country, shipping_address)
        values (c, 'nl', 100, 999, 'NL', '{}'); raise exception 'FAIL: wrong total accepted';
  exception when check_violation then null; end;
  begin insert into public.orders (customer_id, locale, subtotal_cents, total_cents, shipping_country, shipping_address)
        values (c, 'nl', 100, 100, 'FR', '{}'); raise exception 'FAIL: France accepted';
  exception when check_violation then null; end;
  begin insert into public.order_items (order_id, product_slug, product_name, quantity, unit_price_cents, line_total_cents, configuration)
        values (o.id, 'duo', 'Duo', 2, 100, 100, '{}'); raise exception 'FAIL: wrong line total accepted';
  exception when check_violation then null; end;

  insert into public.newsletter_subscribers (email, locale) values ('news@example.com', 'en');
end $$;
reset role;

-- ── Checkout migration (shipping rates, logo storage) ─────────────
set role anon;
do $$ begin
  if (select count(*) from public.shipping_rates) <> 3 then raise exception 'anon should see 3 shipping rates'; end if;
  if (select price_cents from public.shipping_rates where country = 'NL') <> 0 then raise exception 'NL shipping should be free'; end if;
  begin update public.shipping_rates set price_cents = 0; raise exception 'FAIL: anon changed shipping';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'order-logos' and not public) then raise exception 'private order-logos bucket missing'; end if;
end $$;

select 'ALL SCHEMA TESTS PASSED' as result;
