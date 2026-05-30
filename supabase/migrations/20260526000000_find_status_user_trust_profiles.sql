-- Find status enum
create type public.find_status as enum ('pending', 'approved', 'disputed', 'rejected');

-- Add status to finds; backfill existing rows as approved, then default new rows to pending
alter table public.finds add column status public.find_status not null default 'approved';
alter table public.finds alter column status set default 'pending';

-- Add trusted flag to users; existing users are trusted
alter table public.users add column trusted boolean not null default true;

-- Make user_id nullable to support anonymous finds (inserted via service role)
alter table public.finds alter column user_id drop not null;

-- Update finds visibility: public feed only shows approved finds; owners see all their own
drop policy if exists "Public and approximate finds are viewable by everyone" on public.finds;
create policy "Public and approximate finds are viewable by everyone"
  on public.finds for select
  using (
    (location_privacy in ('public', 'approximate') and status = 'approved')
    or auth.uid() = user_id
  );

-- Update clovers visibility to match find status check
drop policy if exists "Clovers are viewable if their find is viewable" on public.clovers;
create policy "Clovers are viewable if their find is viewable"
  on public.clovers for select
  using (
    exists (
      select 1 from public.finds
      where finds.id = clovers.find_id
        and (
          (finds.location_privacy in ('public', 'approximate') and finds.status = 'approved')
          or finds.user_id = auth.uid()
        )
    )
  );

-- Index to speed up status-filtered queries
create index if not exists finds_status_idx on public.finds (status);

-- Avatars storage bucket
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "Public avatars bucket read" on storage.objects;
create policy "Public avatars bucket read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload to their avatars folder" on storage.objects;
create policy "Users can upload to their avatars folder"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete from their avatars folder" on storage.objects;
create policy "Users can delete from their avatars folder"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
