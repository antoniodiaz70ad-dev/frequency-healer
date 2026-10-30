-- Apply only to the isolated Supabase project rayebpxdfatsnkbderot.
-- Preparation only: this migration creates NO credentials and leaves cron OFF.
-- Never put a token in this file, a cron command, or the request URL.

create schema if not exists atenea_ops;
revoke all on schema atenea_ops from public, anon, authenticated, service_role;

-- pg_net temporarily holds Authorization headers in its request queue.
-- Protect those headers before any future authenticated request is enqueued.
revoke all on net.http_request_queue, net._http_response from public, anon, authenticated;

create table if not exists atenea_ops.reaper_runs (
  request_id bigint primary key,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  processed integer check (processed >= 0),
  confirmed integer check (confirmed >= 0),
  outcome text not null default 'pending'
    check (outcome in ('pending', 'ok', 'partial', 'http_error', 'timeout', 'invalid_response'))
);
alter table atenea_ops.reaper_runs enable row level security;
revoke all on atenea_ops.reaper_runs from public, anon, authenticated, service_role;

create or replace function atenea_ops.collect_reaper_results()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  response record;
  payload jsonb;
  result text;
  processed_count integer;
  confirmed_count integer;
begin
  for response in
    select runs.request_id, http.status_code, http.timed_out, http.error_msg,
           http.content, http.created
    from atenea_ops.reaper_runs runs
    join net._http_response http on http.id = runs.request_id
    where runs.outcome = 'pending'
  loop
    processed_count := null;
    confirmed_count := null;
    if response.timed_out then
      result := 'timeout';
    elsif response.status_code is distinct from 200 or response.error_msg is not null then
      result := 'http_error';
    else
      result := 'invalid_response';
      begin
        payload := response.content::jsonb;
        if jsonb_typeof(payload->'processed') = 'number'
           and jsonb_typeof(payload->'confirmed') = 'number'
           and (payload->>'processed') ~ '^[0-9]+$'
           and (payload->>'confirmed') ~ '^[0-9]+$' then
          processed_count := (payload->>'processed')::integer;
          confirmed_count := (payload->>'confirmed')::integer;
          if processed_count between 0 and 25 and confirmed_count between 0 and processed_count then
            result := case when confirmed_count = processed_count then 'ok' else 'partial' end;
          else
            processed_count := null;
            confirmed_count := null;
          end if;
        end if;
      exception when others then
        processed_count := null;
        confirmed_count := null;
      end;
    end if;
    update atenea_ops.reaper_runs
      set completed_at = now(), http_status = response.status_code,
          processed = processed_count, confirmed = confirmed_count, outcome = result
      where request_id = response.request_id;
  end loop;
  -- Lost pg_net responses are failures, never evidence that remote audio stopped.
  update atenea_ops.reaper_runs set completed_at = now(), outcome = 'timeout'
    where outcome = 'pending' and requested_at < now() - interval '2 minutes';
  delete from atenea_ops.reaper_runs where requested_at < now() - interval '7 days';
end;
$$;

create or replace function atenea_ops.enqueue_reaper()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  reaper_token text;
  protection_token text;
  request_id bigint;
begin
  if has_table_privilege('anon', 'net.http_request_queue', 'select')
     or has_table_privilege('authenticated', 'net.http_request_queue', 'select') then
    raise exception 'ATENEA scheduler queue permissions are not restricted';
  end if;
  perform atenea_ops.collect_reaper_results();
  select decrypted_secret into reaper_token from vault.decrypted_secrets
    where name = 'atenea_preview_reaper_token';
  select decrypted_secret into protection_token from vault.decrypted_secrets
    where name = 'atenea_preview_vercel_automation_token';
  if coalesce(length(reaper_token), 0) < 32 or coalesce(length(protection_token), 0) < 32 then
    raise exception 'ATENEA scheduler credentials are not configured';
  end if;
  select net.http_post(
    url := 'https://frequency-healer-git-codex-atenea-invitations-50c52f-leviathan1.vercel.app/api/atenea-voz/reap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || reaper_token,
      'x-vercel-protection-bypass', protection_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) into request_id;
  insert into atenea_ops.reaper_runs(request_id) values (request_id);
  return request_id;
end;
$$;
revoke all on function atenea_ops.collect_reaper_results(), atenea_ops.enqueue_reaper()
  from public, anon, authenticated, service_role;

do $$
declare job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'atenea-preview-reaper') then
    raise exception 'ATENEA scheduler already exists; inspect it before changing it';
  end if;
  select cron.schedule('atenea-preview-reaper', '* * * * *',
    'select atenea_ops.enqueue_reaper();') into job_id;
  perform cron.alter_job(job_id, active := false);
end;
$$;
