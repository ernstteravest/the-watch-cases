-- Checks for the Phase 2 rules: administrators, MFA, permissions, audit log,
-- content drafts/publishing, settings, analytics and storage.
-- Run on a TEST database after all migrations, seed.sql and schema.test.sql
-- (see supabase/README.md). Any failure raises an error.
\set ON_ERROR_STOP 1

-- Test accounts (fixed ids so the steps below can refer to them).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'manager@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'editor@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'support@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'former@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'stranger@example.com'),
  ('00000000-0000-0000-0000-000000000010', 'drafter@example.com');

-- A test-only role that may edit drafts but not publish.
insert into public.roles (id, name_nl, name_en) values ('drafter', 'Test', 'Test');
insert into public.role_permissions (role_id, permission) values ('drafter', 'content.edit');

insert into public.profiles (id, email, full_name, role_id, active) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.com',   'Owner',   'owner',   true),
  ('00000000-0000-0000-0000-00000000000b', 'manager@example.com', 'Manager', 'manager', true),
  ('00000000-0000-0000-0000-00000000000c', 'editor@example.com',  'Editor',  'editor',  true),
  ('00000000-0000-0000-0000-00000000000d', 'support@example.com', 'Support', 'support', true),
  ('00000000-0000-0000-0000-00000000000e', 'former@example.com',  'Former',  'owner',   false),
  ('00000000-0000-0000-0000-000000000010', 'drafter@example.com', 'Drafter', 'drafter', true);

insert into public.content_pages (key, label_nl, label_en) values ('home', 'Home', 'Home');
insert into storage.objects (bucket_id, name) values ('order-logos', 'test/logo.png');

-- ── Visitors (anon) ───────────────────────────────────────────────
set role anon;
set request.jwt.claims to '';
do $$ begin
  begin perform 1 from public.profiles; raise exception 'FAIL: anon read profiles';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.audit_logs; raise exception 'FAIL: anon read audit log';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.payments; raise exception 'FAIL: anon read payments';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.content_entries; raise exception 'FAIL: anon read content drafts';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.analytics_events; raise exception 'FAIL: anon read analytics';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.data_requests; raise exception 'FAIL: anon read privacy requests';
  exception when insufficient_privilege then null; end;
  begin perform public.hit_rate_limit('x', 1, 60); raise exception 'FAIL: anon used rate limits';
  exception when insufficient_privilege then null; end;
  begin perform public.log_admin_action('test.action'); raise exception 'FAIL: anon wrote audit log';
  exception when insufficient_privilege then null; end;
  begin insert into public.analytics_events (type, path) values ('page_view', '/'); raise exception 'FAIL: anon wrote analytics';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.published_content()) <> 0 then raise exception 'nothing is published yet'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'order-logos') then raise exception 'FAIL: anon sees logos'; end if;
end $$;
reset role;

-- ── A signed-in user without an administrator profile ─────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000f","aal":"aal2"}';
do $$ begin
  if public.is_admin() then raise exception 'FAIL: stranger is admin'; end if;
  if (select count(*) from public.orders) <> 0 then raise exception 'FAIL: stranger reads orders'; end if;
  if (select count(*) from public.customers) <> 0 then raise exception 'FAIL: stranger reads customers'; end if;
  if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL: stranger reads profiles'; end if;
  begin perform public.log_admin_action('test.action'); raise exception 'FAIL: stranger wrote audit log';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── An owner WITHOUT MFA sees nothing but their own profile ───────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}';
do $$ begin
  if public.is_admin() then raise exception 'FAIL: admin without MFA'; end if;
  if (select count(*) from public.orders) <> 0 then raise exception 'FAIL: orders visible without MFA'; end if;
  if (select count(*) from public.my_permissions()) <> 0 then raise exception 'FAIL: permissions without MFA'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'own profile should be readable'; end if;
end $$;
reset role;

-- ── A deactivated owner sees nothing ──────────────────────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000e","aal":"aal2"}';
do $$ begin
  if public.is_admin() then raise exception 'FAIL: deactivated account is admin'; end if;
  if (select count(*) from public.orders) <> 0 then raise exception 'FAIL: deactivated account reads orders'; end if;
end $$;
reset role;

-- ── Support (MFA): orders and customers, nothing else ─────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000d","aal":"aal2"}';
do $$
declare n int; o uuid;
begin
  if not public.is_admin() then raise exception 'support should be admin'; end if;
  if (select count(*) from public.orders) = 0 then raise exception 'support should read orders'; end if;
  if (select count(*) from public.customers) = 0 then raise exception 'support should read customers'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'order-logos') then raise exception 'support should download logos'; end if;
  select id into o from public.orders limit 1;

  update public.orders set status = 'in_production', notes = 'Started' where id = o;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'support should update order status'; end if;

  begin update public.orders set total_cents = 1 where id = o; raise exception 'FAIL: support changed an amount';
  exception when insufficient_privilege then null; end;
  begin update public.orders set shipping_address = '{}' where id = o; raise exception 'FAIL: support changed an address';
  exception when insufficient_privilege then null; end;
  begin delete from public.orders where id = o; raise exception 'FAIL: support deleted an order';
  exception when insufficient_privilege then null; end;

  update public.products set price_from_cents = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: support changed prices'; end if;

  -- Cannot promote themselves.
  update public.profiles set role_id = 'owner' where id = auth.uid();
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: support changed own role'; end if;

  if (select count(*) from public.audit_logs) <> 0 then raise exception 'FAIL: support reads audit log'; end if;
  if (select count(*) from public.analytics_events) <> 0 then raise exception 'FAIL: support reads analytics'; end if;

  begin insert into public.content_entries (page_key, key, locale, kind, draft_value)
        values ('home', 'home.hero.titleLine1', 'nl', 'text', '"x"'); raise exception 'FAIL: support edited content';
  exception when insufficient_privilege then null; end;

  insert into public.data_requests (email, type) values ('test@example.com', 'access');

  -- Audit log: written through the function, with the real author.
  perform public.log_admin_action('order.status_changed', 'order', o::text, '{"to":"in_production"}');
  if (select count(*) from public.my_permissions()) <> 6 then raise exception 'support should have 6 permissions'; end if;
end $$;
reset role;

-- ── Editor: content yes, orders no ────────────────────────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","aal":"aal2"}';
do $$
declare e public.content_entries;
begin
  if (select count(*) from public.orders) <> 0 then raise exception 'FAIL: editor reads orders'; end if;
  if (select count(*) from public.customers) <> 0 then raise exception 'FAIL: editor reads customers'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'order-logos') then raise exception 'FAIL: editor sees logos'; end if;

  insert into public.content_entries (page_key, key, locale, kind, draft_value)
  values ('home', 'home.hero.titleLine1', 'nl', 'text', '"Concept"') returning * into e;
  if e.draft_updated_by <> auth.uid() then raise exception 'draft author not filled in'; end if;
  if e.published_at is not null then raise exception 'a draft must not be published'; end if;

  update public.content_entries set published_value = draft_value where id = e.id returning * into e;
  if e.published_at is null or e.published_by <> auth.uid() then raise exception 'publish not recorded'; end if;

  update public.content_entries set draft_value = '"Nieuw concept"' where id = e.id;

  insert into storage.objects (bucket_id, name) values ('site-media', 'hero/new.jpg');
  insert into public.media (path, mime_type, size_bytes, alt_nl, alt_en)
  values ('hero/new.jpg', 'image/jpeg', 1000, 'Doos', 'Box');
  begin insert into public.media (path, mime_type, size_bytes) values ('evil.svg', 'image/svg+xml', 10); raise exception 'FAIL: SVG accepted';
  exception when check_violation then null; end;
  begin insert into public.media (path, mime_type, size_bytes) values ('../secret.jpg', 'image/jpeg', 10); raise exception 'FAIL: path traversal accepted';
  exception when check_violation then null; end;
end $$;
reset role;

-- Revisions: one draft, one publish, one new draft.
do $$ begin
  if (select count(*) from public.content_revisions) <> 3 then
    raise exception 'expected 3 revisions, got %', (select count(*) from public.content_revisions);
  end if;
  if (select uploaded_by from public.media where path = 'hero/new.jpg') <> '00000000-0000-0000-0000-00000000000c' then
    raise exception 'uploader not filled in';
  end if;
end $$;

-- Visitors see the published text, never the newer draft.
set role anon;
set request.jwt.claims to '';
do $$ begin
  if (select value from public.published_content() where key = 'home.hero.titleLine1') <> '"Concept"'::jsonb then
    raise exception 'visitors should see the published value only';
  end if;
end $$;
reset role;

-- ── Drafter (content.edit without content.publish) ────────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000010","aal":"aal2"}';
do $$ begin
  update public.content_entries set draft_value = '"Nog een concept"' where key = 'home.hero.titleLine1';
  begin update public.content_entries set published_value = '"Live!"' where key = 'home.hero.titleLine1';
        raise exception 'FAIL: drafter published';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('site-media', 'x.jpg'); raise exception 'FAIL: drafter uploaded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Manager: prices and availability ──────────────────────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal2"}';
do $$
declare n int;
begin
  update public.products set price_from_cents = 34900 where slug = 'duo';
  update public.products set active = false where slug = 'quartet-slim';
  if (select count(*) from public.products) <> 2 then raise exception 'manager should see inactive products too'; end if;
  update public.shipping_rates set price_cents = 995 where country = 'BE';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'manager should set shipping rates'; end if;
  begin update public.products set slug = 'x' where slug = 'duo'; raise exception 'FAIL: manager renamed a product';
  exception when insufficient_privilege then null; end;
  begin insert into public.site_settings (key, value) values ('business.name', '"x"'); raise exception 'FAIL: manager changed settings';
  exception when insufficient_privilege then null; end;
  update public.profiles set active = false where id = '00000000-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: manager deactivated an administrator'; end if;
end $$;
reset role;

set role anon;
set request.jwt.claims to '';
do $$ begin
  if (select count(*) from public.products) <> 1 then raise exception 'visitors should only see active products'; end if;
end $$;
reset role;
update public.products set active = true where slug = 'quartet-slim';

-- ── Owner: settings, administrators, audit log ────────────────────
set role authenticated;
set request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}';
do $$
declare n int;
begin
  insert into public.site_settings (key, value, is_public, updated_by)
  values ('features.quartet_slim', 'false', true, '00000000-0000-0000-0000-00000000000d');
  insert into public.site_settings (key, value) values ('notifications.orders_email', '"orders@example.com"');
  if (select updated_by from public.site_settings where key = 'features.quartet_slim') <> auth.uid() then
    raise exception 'setting author must be the signed-in owner';
  end if;
  if (select count(*) from public.audit_logs) < 1 then raise exception 'owner should read the audit log'; end if;
  if (select actor_email from public.audit_logs order by id limit 1) <> 'support@example.com' then
    raise exception 'audit entry author wrong';
  end if;

  -- The only active owner cannot remove their own owner role.
  begin update public.profiles set role_id = 'manager' where id = auth.uid(); raise exception 'FAIL: last owner demoted';
  exception when check_violation then null; end;

  update public.profiles set full_name = 'Support Team' where id = '00000000-0000-0000-0000-00000000000d';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'owner should manage administrators'; end if;
end $$;
reset role;

set role anon;
set request.jwt.claims to '';
do $$ begin
  if (select count(*) from public.site_settings) <> 1 then raise exception 'visitors should only see public settings'; end if;
end $$;
reset role;

-- ── The audit log cannot be changed, not even by the server ───────
set role service_role;
do $$ begin
  begin update public.audit_logs set action = 'x.y'; raise exception 'FAIL: audit log changed';
  exception when insufficient_privilege then null; end;
  begin delete from public.audit_logs; raise exception 'FAIL: audit log deleted';
  exception when insufficient_privilege then null; end;
  begin truncate public.audit_logs; raise exception 'FAIL: audit log truncated';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Server: rate limits, analytics, payments ──────────────────────
do $$
declare o uuid;
begin
  if not public.hit_rate_limit('login:test', 2, 60) then raise exception 'first attempt should pass'; end if;
  if not public.hit_rate_limit('login:test', 2, 60) then raise exception 'second attempt should pass'; end if;
  if public.hit_rate_limit('login:test', 2, 60) then raise exception 'third attempt should be blocked'; end if;

  insert into public.analytics_events (type, path, locale, device, country, visitor_hash)
  values ('page_view', '/collectie', 'nl', 'mobile', 'NL', 'abc');
  begin insert into public.analytics_events (type, path) values ('page_view', 'https://evil.example'); raise exception 'FAIL: bad path accepted';
  exception when check_violation then null; end;

  select id into o from public.orders limit 1;
  insert into public.payments (order_id, provider, kind, provider_ref, amount_cents, status)
  values (o, 'stripe', 'payment', 'pi_test_1', 34900, 'succeeded');
  begin insert into public.payments (order_id, provider, kind, provider_ref, amount_cents, status)
        values (o, 'stripe', 'payment', 'pi_test_1', 34900, 'succeeded'); raise exception 'FAIL: duplicate payment accepted';
  exception when unique_violation then null; end;
end $$;
reset role;

-- The last active owner cannot be deactivated, even by the server.
do $$ begin
  begin update public.profiles set active = false where id = '00000000-0000-0000-0000-00000000000a';
        raise exception 'FAIL: last owner deactivated';
  exception when check_violation then null; end;
end $$;

select 'ALL ADMIN TESTS PASSED' as result;
