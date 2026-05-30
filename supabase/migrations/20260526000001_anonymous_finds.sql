-- New users should start untrusted; existing users were backfilled to true in the previous migration
alter table public.users alter column trusted set default false;

-- Allow anonymous find inserts (user_id is null, status defaults to pending)
drop policy if exists "Anonymous finds can be inserted" on public.finds;
create policy "Anonymous finds can be inserted"
  on public.finds for insert
  with check (user_id is null);

-- Allow photo uploads to the anonymous folder in the finds bucket (no auth required)
drop policy if exists "Anonymous finds photo upload" on storage.objects;
create policy "Anonymous finds photo upload"
  on storage.objects for insert
  with check (
    bucket_id = 'finds'
    and (storage.foldername(name))[1] = 'anonymous'
  );
