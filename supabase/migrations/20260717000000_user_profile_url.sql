-- Let users add a link to their profile — admin-only for now to avoid spam,
-- since regular signup has no other spam gate.
alter table public.users add column profile_url text;

-- Extend the privileged-column guard so non-admins can't smuggle a profile_url
-- through the normal "Users can update their own profile" RLS policy (which
-- otherwise allows any authenticated user to update any column of their own
-- row from the browser). Admins can still set their own profile_url through
-- the regular profile-edit flow; the service role can always set it.
create or replace function public.protect_privileged_user_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.is_admin := old.is_admin;
    new.trusted := old.trusted;
    if not old.is_admin then
      new.profile_url := old.profile_url;
    end if;
  end if;
  return new;
end;
$$;
