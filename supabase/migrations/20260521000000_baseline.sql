-- Baseline migration — represents the full schema as it exists in production.
-- Mark as already applied after linking: supabase migration repair --status applied 20260521000000

-- Location privacy enum
do $$ begin
  create type public.location_privacy as enum ('public', 'approximate', 'private');
exception when duplicate_object then null;
end $$;

-- Users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

-- Finds table
create table if not exists public.finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  found_at timestamptz not null,
  photo_url text not null,
  lat double precision,
  lng double precision,
  location_privacy public.location_privacy not null default 'public',
  location_name text,
  notes text,
  created_at timestamptz not null default now()
);

-- Clovers table
create table if not exists public.clovers (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references public.finds (id) on delete cascade,
  leaf_count integer not null check (leaf_count >= 4),
  annotation_x real,
  annotation_y real,
  annotation_radius real
);

-- Indexes
create index if not exists finds_user_id_idx on public.finds (user_id);
create index if not exists finds_found_at_idx on public.finds (found_at desc);
create index if not exists clovers_find_id_idx on public.clovers (find_id);

-- Row Level Security
alter table public.users enable row level security;
alter table public.finds enable row level security;
alter table public.clovers enable row level security;

-- Users policies
drop policy if exists "Public profiles are viewable by everyone" on public.users;
create policy "Public profiles are viewable by everyone"
  on public.users for select using (true);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

-- Finds policies
drop policy if exists "Public and approximate finds are viewable by everyone" on public.finds;
create policy "Public and approximate finds are viewable by everyone"
  on public.finds for select
  using (location_privacy in ('public', 'approximate') or auth.uid() = user_id);

drop policy if exists "Authenticated users can create finds" on public.finds;
create policy "Authenticated users can create finds"
  on public.finds for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own finds" on public.finds;
create policy "Users can update their own finds"
  on public.finds for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own finds" on public.finds;
create policy "Users can delete their own finds"
  on public.finds for delete
  using (auth.uid() = user_id);

-- Clovers policies (inherit visibility from parent find)
drop policy if exists "Clovers are viewable if their find is viewable" on public.clovers;
create policy "Clovers are viewable if their find is viewable"
  on public.clovers for select
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and (finds.location_privacy in ('public', 'approximate') or finds.user_id = auth.uid())
    )
  );

drop policy if exists "Users can insert clovers on their own finds" on public.clovers;
create policy "Users can insert clovers on their own finds"
  on public.clovers for insert
  with check (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update clovers on their own finds" on public.clovers;
create policy "Users can update clovers on their own finds"
  on public.clovers for update
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete clovers on their own finds" on public.clovers;
create policy "Users can delete clovers on their own finds"
  on public.clovers for delete
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );

-- Function: auto-create a public.users row when a new auth.users row is inserted
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (
    new.id,
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$;

-- Trigger: fire handle_new_user() after each auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket
insert into storage.buckets (id, name, public) values ('finds', 'finds', true)
  on conflict (id) do nothing;

drop policy if exists "Public finds bucket read" on storage.objects;
create policy "Public finds bucket read"
  on storage.objects for select
  using (bucket_id = 'finds');

drop policy if exists "Users can upload to their folder" on storage.objects;
create policy "Users can upload to their folder"
  on storage.objects for insert
  with check (
    bucket_id = 'finds'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete from their folder" on storage.objects;
create policy "Users can delete from their folder"
  on storage.objects for delete
  using (
    bucket_id = 'finds'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
