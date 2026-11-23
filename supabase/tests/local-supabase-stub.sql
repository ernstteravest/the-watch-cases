-- Minimal stand-in for the parts of Supabase the migrations rely on, so the
-- schema tests can run on a plain local PostgreSQL 15+ (no Docker needed).
-- NEVER run this on a real Supabase project: it already has all of this.
\set ON_ERROR_STOP 1

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to current_user;

create schema extensions;
create schema auth;
create schema storage;
grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

-- Supabase's default privileges: new tables and functions are granted to the API roles.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table auth.users (id uuid primary key default gen_random_uuid(), email text);

-- The tests set the signed-in user with: set request.jwt.claims to '{"sub":"…","aal":"aal2"}'
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
