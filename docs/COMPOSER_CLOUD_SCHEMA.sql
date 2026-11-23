-- Production composer storage: apply only to the dedicated Frequency Healer project.
create table public.fh_composer_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object' and
    payload->>'version' = 'marina-composer-1' and
    jsonb_typeof(payload->'compositions') = 'array' and
    jsonb_typeof(payload->'sessions') = 'array' and
    octet_length(payload::text) <= 5000000,
    false
  )),
  updated_at timestamptz not null default now()
);
alter table public.fh_composer_v1 enable row level security;
revoke all on public.fh_composer_v1 from anon, authenticated;
grant select, insert, update on public.fh_composer_v1 to authenticated;
create policy composer_owner_select on public.fh_composer_v1 for select to authenticated
  using ((select auth.uid()) = user_id);
create policy composer_owner_insert on public.fh_composer_v1 for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy composer_owner_update on public.fh_composer_v1 for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.fh_composer_revision_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.revision <> 1 then
    raise exception 'Initial revision must be 1' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.revision <> old.revision + 1) then
    raise exception 'Invalid composer revision' using errcode = '23514';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.fh_composer_revision_guard() from public;
create trigger fh_composer_revision before insert or update on public.fh_composer_v1
  for each row execute function public.fh_composer_revision_guard();
