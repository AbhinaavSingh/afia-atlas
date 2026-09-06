create extension if not exists pgcrypto;

create type public.memory_status as enum ('pending', 'approved', 'rejected');

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  contributor_name text not null check (char_length(contributor_name) between 2 and 80),
  relationship text check (char_length(relationship) <= 80),
  title text not null check (char_length(title) between 3 and 120),
  story text not null check (char_length(story) between 20 and 1800),
  location_name text not null check (char_length(location_name) between 2 and 140),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  happened_at text check (char_length(happened_at) <= 40),
  image_path text,
  thumbnail_path text,
  status public.memory_status not null default 'pending',
  submitter_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create index memories_status_created_idx on public.memories (status, created_at);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  revealed boolean not null default false,
  reveal_at timestamptz not null default '2026-09-19T09:00:00-07:00',
  contributions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.submission_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index submission_attempts_ip_created_idx
  on public.submission_attempts (ip_hash, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

alter table public.memories enable row level security;
alter table public.site_settings enable row level security;
alter table public.admins enable row level security;
alter table public.submission_attempts enable row level security;

create policy "Approved memories are publicly readable"
on public.memories for select
using (
  public.is_admin()
  or (
    status = 'approved'
    and exists (
      select 1
      from public.site_settings
      where id = 1 and revealed = true
    )
  )
);

create policy "Admins can update memories"
on public.memories for update
using (public.is_admin())
with check (public.is_admin());

create policy "Site settings are publicly readable"
on public.site_settings for select
using (true);

create policy "Admins can update site settings"
on public.site_settings for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can see their role"
on public.admins for select
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'pending-memories',
    'pending-memories',
    false,
    1048576,
    array['image/webp']
  ),
  (
    'approved-memories',
    'approved-memories',
    true,
    1048576,
    array['image/webp']
  )
on conflict (id) do nothing;

create policy "Approved memory images are public"
on storage.objects for select
using (bucket_id = 'approved-memories');

create policy "Admins can view pending memory images"
on storage.objects for select
using (bucket_id = 'pending-memories' and public.is_admin());

create policy "Admins can manage approved memory images"
on storage.objects for all
using (bucket_id = 'approved-memories' and public.is_admin())
with check (bucket_id = 'approved-memories' and public.is_admin());

-- After creating the only admin user in Authentication > Users, run:
-- insert into public.admins (user_id) values ('THE-AUTH-USER-UUID');
