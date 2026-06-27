-- Move admin status from a hardcoded username list into the database.

-- Add is_admin flag; everyone defaults to non-admin.
alter table public.users add column is_admin boolean not null default false;

-- Seed the existing hardcoded admins (see former ADMIN_USERNAMES in src/lib/constants.ts).
update public.users set is_admin = true where username in ('Matt', 'matthornsby');

-- Privilege columns must only ever be changed by the service role (server actions
-- using the service-role client). The "Users can update their own profile" RLS policy
-- otherwise lets any authenticated user update any column of their own row from the
-- browser — including self-promoting to admin or self-marking trusted. This trigger
-- silently preserves both columns for non-service-role updates rather than raising,
-- so the normal profile-edit flow keeps working untouched.
create or replace function public.protect_privileged_user_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.is_admin := old.is_admin;
    new.trusted := old.trusted;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_user_columns on public.users;
create trigger protect_privileged_user_columns
  before update on public.users
  for each row execute function public.protect_privileged_user_columns();
