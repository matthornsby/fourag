insert into storage.buckets (id, name, public) values ('finds', 'finds', true)
  on conflict (id) do nothing;

-- Anyone can view objects in the finds bucket
drop policy if exists "Public finds bucket read" on storage.objects;
create policy "Public finds bucket read"
  on storage.objects for select
  using (bucket_id = 'finds');

-- Authenticated users can upload to their own folder
drop policy if exists "Users can upload to their folder" on storage.objects;
create policy "Users can upload to their folder"
  on storage.objects for insert
  with check (
    bucket_id = 'finds'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete from their own folder
drop policy if exists "Users can delete from their folder" on storage.objects;
create policy "Users can delete from their folder"
  on storage.objects for delete
  using (
    bucket_id = 'finds'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
