-- ─────────────────────────────────────────────────────────────────────────────
--  Phase 2 · Stage 3: website content (CMS), media library and settings
--
--  How content works
--   • The texts and photos in the website code stay the default. A row here
--     only overrides one text or image slot, per language.
--   • Every entry has a draft and a published value. Visitors only ever get
--     published values, through public.published_content(); they cannot
--     read the table itself, so drafts never leak.
--   • Saving a draft or publishing is recorded in content_revisions
--     automatically, so any earlier version can be restored.
--   • Editing drafts needs content.edit; changing what is live needs
--     content.publish. The database enforces both.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────── Media library ───────────────────────
create table public.media (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null default 'site-media' check (bucket = 'site-media'),
  path          text not null unique check (path ~ '^[a-z0-9][a-z0-9/_.-]*$' and path !~ '\.\.'),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  width         integer check (width > 0),
  height        integer check (height > 0),
  alt_nl        text not null default '' check (char_length(alt_nl) <= 300),
  alt_en        text not null default '' check (char_length(alt_en) <= 300),
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger media_updated_at before update on public.media
  for each row execute function public.set_updated_at();

-- The uploader is filled in by the database, not by the caller.
create or replace function public.stamp_media_uploader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger media_uploader before insert on public.media
  for each row execute function public.stamp_media_uploader();
revoke all on function public.stamp_media_uploader() from public, anon, authenticated;

-- ─────────────────────────── Content ─────────────────────────────
-- A page groups the editable slots shown together in /beheer
-- (e.g. 'home', 'product.duo', 'global' for the announcement bar and footer).
create table public.content_pages (
  key         text primary key check (key ~ '^[a-z0-9_.-]+$'),
  label_nl    text not null,
  label_en    text not null,
  sort_order  smallint not null default 0
);

create table public.content_entries (
  id                  uuid primary key default gen_random_uuid(),
  page_key            text not null references public.content_pages (key) on update cascade on delete restrict,
  -- The dictionary key or image slot it overrides, e.g. 'home.hero.titleLine1' or 'image:hero'.
  key                 text not null check (key ~ '^[a-zA-Z0-9_.:-]+$'),
  -- 'nl' or 'en'; null = the same in both languages (typically an image).
  locale              text check (locale in ('nl', 'en')),
  kind                text not null check (kind in ('text', 'rich_text', 'image', 'link', 'boolean')),
  draft_value         jsonb,
  draft_media_id      uuid references public.media (id) on delete restrict,
  draft_updated_at    timestamptz,
  draft_updated_by    uuid references public.profiles (id) on delete set null,
  published_value     jsonb,
  published_media_id  uuid references public.media (id) on delete restrict,
  published_at        timestamptz,
  published_by        uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  unique nulls not distinct (key, locale),
  constraint content_entries_image_has_media check (
    kind <> 'image' or (draft_value is null and published_value is null)
  ),
  constraint content_entries_value_size check (
    coalesce(octet_length(draft_value::text), 0) <= 20000
    and coalesce(octet_length(published_value::text), 0) <= 20000
  )
);
create index content_entries_page_key_idx on public.content_entries (page_key);
create index content_entries_published_idx on public.content_entries (key) where published_at is not null;

-- Every saved draft, publication and restore.
create table public.content_revisions (
  id          bigint generated always as identity primary key,
  entry_id    uuid not null references public.content_entries (id) on delete cascade,
  action      text not null check (action in ('draft', 'publish', 'unpublish')),
  value       jsonb,
  media_id    uuid references public.media (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index content_revisions_entry_id_idx on public.content_revisions (entry_id, created_at desc);

-- Fills in who/when, enforces the publish permission for administrators,
-- and records a revision for every change of draft or published value.
create or replace function public.content_entry_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  draft_changed boolean;
  published_changed boolean;
begin
  draft_changed := tg_op = 'INSERT'
    and (new.draft_value is not null or new.draft_media_id is not null)
    or tg_op = 'UPDATE'
    and (new.draft_value is distinct from old.draft_value or new.draft_media_id is distinct from old.draft_media_id);
  published_changed := tg_op = 'INSERT'
    and (new.published_value is not null or new.published_media_id is not null)
    or tg_op = 'UPDATE'
    and (new.published_value is distinct from old.published_value
         or new.published_media_id is distinct from old.published_media_id);

  -- Administrators (not the server with the secret key) need content.publish
  -- to change what visitors see.
  if published_changed and current_user = 'authenticated'
     and not public.has_permission('content.publish') then
    raise exception 'Publishing requires the content.publish permission' using errcode = 'insufficient_privilege';
  end if;

  if draft_changed then
    new.draft_updated_at := now();
    new.draft_updated_by := auth.uid();
  end if;
  if published_changed then
    if new.published_value is null and new.published_media_id is null then
      new.published_at := null;
    else
      new.published_at := now();
    end if;
    new.published_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Runs with its owner's rights: editors may read revisions but not write them directly.
create or replace function public.content_entry_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.draft_value is distinct from old.draft_value
                           or new.draft_media_id is distinct from old.draft_media_id)
     or tg_op = 'INSERT' and (new.draft_value is not null or new.draft_media_id is not null) then
    insert into public.content_revisions (entry_id, action, value, media_id, created_by)
    values (new.id, 'draft', new.draft_value, new.draft_media_id, auth.uid());
  end if;
  if tg_op = 'UPDATE' and (new.published_value is distinct from old.published_value
                           or new.published_media_id is distinct from old.published_media_id)
     or tg_op = 'INSERT' and new.published_at is not null then
    insert into public.content_revisions (entry_id, action, value, media_id, created_by)
    values (new.id, case when new.published_at is null then 'unpublish' else 'publish' end,
            new.published_value, new.published_media_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger content_entries_changes before insert or update on public.content_entries
  for each row execute function public.content_entry_changes();
create trigger content_entries_revision after insert or update on public.content_entries
  for each row execute function public.content_entry_revision();
revoke all on function public.content_entry_changes(), public.content_entry_revision()
  from public, anon, authenticated;

-- What visitors may see: only published values, with image details.
-- The website calls this with the public key; drafts are never returned.
create or replace function public.published_content()
returns table (
  key          text,
  locale       text,
  kind         text,
  value        jsonb,
  media_path   text,
  media_width  integer,
  media_height integer,
  alt_nl       text,
  alt_en       text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.key, e.locale, e.kind, e.published_value, m.path, m.width, m.height,
         m.alt_nl, m.alt_en, e.published_at
  from public.content_entries e
  left join public.media m on m.id = e.published_media_id
  where e.published_at is not null;
$$;
revoke all on function public.published_content() from public;
grant execute on function public.published_content() to anon, authenticated, service_role;

-- ─────────────────────────── Settings ────────────────────────────
-- Business details, notification recipients and feature switches.
-- Values are validated by the website (Zod) before saving. Only rows marked
-- public (e.g. feature switches) are readable by visitors.
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Who changed a setting is filled in by the database, not by the caller.
create or replace function public.stamp_setting_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), case when current_user = 'authenticated' then null else new.updated_by end);
  return new;
end;
$$;
create trigger site_settings_author before insert or update on public.site_settings
  for each row execute function public.stamp_setting_author();
revoke all on function public.stamp_setting_author() from public, anon, authenticated;

-- ─────────────────────────── Row Level Security ──────────────────
alter table public.media              enable row level security;
alter table public.content_pages      enable row level security;
alter table public.content_entries    enable row level security;
alter table public.content_revisions  enable row level security;
alter table public.site_settings      enable row level security;

revoke all on public.media, public.content_pages, public.content_entries,
              public.content_revisions, public.site_settings
  from anon, authenticated;

-- Media rows hold no personal data, but visitors get them only through
-- published_content(); administrators with content or media rights read all.
grant select, delete on public.media to authenticated;
grant insert (bucket, path, mime_type, size_bytes, width, height, alt_nl, alt_en) on public.media to authenticated;
grant update (alt_nl, alt_en) on public.media to authenticated;
create policy "Editors read media" on public.media
  for select to authenticated
  using (public.has_permission('media.manage') or public.has_permission('content.edit'));
create policy "Media managers add media" on public.media
  for insert to authenticated with check (public.has_permission('media.manage'));
create policy "Media managers update media" on public.media
  for update to authenticated
  using (public.has_permission('media.manage'))
  with check (public.has_permission('media.manage'));
create policy "Media managers remove media" on public.media
  for delete to authenticated using (public.has_permission('media.manage'));

grant select on public.content_pages to authenticated;
create policy "Editors read content pages" on public.content_pages
  for select to authenticated using (public.has_permission('content.edit'));

grant select on public.content_entries to authenticated;
grant insert (page_key, key, locale, kind, draft_value, draft_media_id, published_value, published_media_id)
  on public.content_entries to authenticated;
grant update (draft_value, draft_media_id, published_value, published_media_id)
  on public.content_entries to authenticated;
create policy "Editors read content" on public.content_entries
  for select to authenticated using (public.has_permission('content.edit'));
create policy "Editors add content" on public.content_entries
  for insert to authenticated with check (public.has_permission('content.edit'));
create policy "Editors update content" on public.content_entries
  for update to authenticated
  using (public.has_permission('content.edit'))
  with check (public.has_permission('content.edit'));

grant select on public.content_revisions to authenticated;
create policy "Editors read revisions" on public.content_revisions
  for select to authenticated using (public.has_permission('content.edit'));

grant select on public.site_settings to anon, authenticated;
grant insert, update (value, is_public) on public.site_settings to authenticated;
create policy "Public settings are public" on public.site_settings
  for select to anon, authenticated using (is_public);
create policy "Settings readers read all settings" on public.site_settings
  for select to authenticated using (public.has_permission('settings.read'));
create policy "Settings managers add settings" on public.site_settings
  for insert to authenticated with check (public.has_permission('settings.manage'));
create policy "Settings managers update settings" on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ─────────────────────────── Storage: website images ─────────────
-- Public bucket: visitors can view images by URL. Only media managers can
-- upload, replace or remove. No SVG (it can contain scripts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "Media managers upload website images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and public.has_permission('media.manage'));
create policy "Media managers replace website images" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-media' and public.has_permission('media.manage'))
  with check (bucket_id = 'site-media' and public.has_permission('media.manage'));
create policy "Media managers remove website images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and public.has_permission('media.manage'));
create policy "Media managers list website images" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-media' and public.has_permission('media.manage'));

-- Administrators with order rights may download customers' logo files
-- (bucket order-logos stays private; nobody else can read it).
create policy "Order readers download logos" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-logos' and public.has_permission('orders.read'));
