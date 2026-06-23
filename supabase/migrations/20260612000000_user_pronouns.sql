create type public.pronoun_preference as enum ('neutral', 'masculine', 'feminine', 'none');

alter table public.users
  add column pronouns public.pronoun_preference not null default 'neutral';
