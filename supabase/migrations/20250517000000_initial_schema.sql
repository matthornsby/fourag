-- Users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

-- Location privacy enum
do $$ begin
  create type public.location_privacy as enum ('public', 'approximate', 'private');
exception when duplicate_object then null;
end $$;

-- Finds table
create table if not exists public.finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  found_at timestamptz not null,
  photo_url text not null,
  lat double precision,
  lng double precision,
  location_privacy public.location_privacy not null default 'public',
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
create policy if not exists "Public profiles are viewable by everyone"
  on public.users for select using (true);

create policy if not exists "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

create policy if not exists "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

-- Finds policies
create policy if not exists "Public and approximate finds are viewable by everyone"
  on public.finds for select
  using (location_privacy in ('public', 'approximate') or auth.uid() = user_id);

create policy if not exists "Authenticated users can create finds"
  on public.finds for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own finds"
  on public.finds for update
  using (auth.uid() = user_id);

create policy if not exists "Users can delete their own finds"
  on public.finds for delete
  using (auth.uid() = user_id);

-- Clovers policies (inherit visibility from parent find)
create policy if not exists "Clovers are viewable if their find is viewable"
  on public.clovers for select
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and (finds.location_privacy in ('public', 'approximate') or finds.user_id = auth.uid())
    )
  );

create policy if not exists "Users can insert clovers on their own finds"
  on public.clovers for insert
  with check (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );

create policy if not exists "Users can update clovers on their own finds"
  on public.clovers for update
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );

create policy if not exists "Users can delete clovers on their own finds"
  on public.clovers for delete
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and finds.user_id = auth.uid()
    )
  );
