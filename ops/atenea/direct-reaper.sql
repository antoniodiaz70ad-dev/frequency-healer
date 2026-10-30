-- Staging only. Requires http in extensions. Leaves the existing cron OFF.
create sequence if not exists atenea_ops.direct_run_id start with 1000000000;
revoke all on sequence atenea_ops.direct_run_id from public, anon, authenticated, service_role;
create or replace function atenea_ops.run_reaper_direct()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  reaper_token text;
  protection_token text;
  run_id bigint;
  response extensions.http_response;
  payload jsonb;
  result text := 'invalid_response';
  processed_count integer;
  confirmed_count integer;
begin
  select decrypted_secret into reaper_token from vault.decrypted_secrets where name='atenea_preview_reaper_token';
  select decrypted_secret into protection_token from vault.decrypted_secrets where name='atenea_preview_vercel_automation_token';
  if coalesce(length(reaper_token),0)<32 or coalesce(length(protection_token),0)<32 then
    raise exception 'ATENEA scheduler credentials are not configured';
  end if;
  run_id := nextval('atenea_ops.direct_run_id');
  insert into atenea_ops.reaper_runs(request_id) values(run_id);
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','25000');
    perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000');
    perform extensions.http_set_curlopt('CURLOPT_FOLLOWLOCATION','0');
    select * into response from extensions.http(row(
      'POST',
      'https://frequency-healer-git-codex-atenea-invitations-50c52f-leviathan1.vercel.app/api/atenea-voz/reap',
      array[row('Authorization','Bearer '||reaper_token)::extensions.http_header,
            row('x-vercel-protection-bypass',protection_token)::extensions.http_header],
      'application/json','{}'
    )::extensions.http_request);
    perform extensions.http_reset_curlopt();
    if response.status is distinct from 200 then
      result := 'http_error';
    else
      begin
        payload := response.content::jsonb;
        if jsonb_typeof(payload->'processed')='number' and jsonb_typeof(payload->'confirmed')='number'
          and (payload->>'processed') ~ '^[0-9]+$' and (payload->>'confirmed') ~ '^[0-9]+$' then
          processed_count := (payload->>'processed')::integer;
          confirmed_count := (payload->>'confirmed')::integer;
          if processed_count between 0 and 25 and confirmed_count between 0 and processed_count then
            result := case when processed_count=confirmed_count then 'ok' else 'partial' end;
          else
            processed_count := null; confirmed_count := null;
          end if;
        end if;
      exception when others then
        processed_count := null; confirmed_count := null;
      end;
    end if;
  exception when others then
    perform extensions.http_reset_curlopt();
    result := 'http_error';
    processed_count := null; confirmed_count := null;
  end;
  update atenea_ops.reaper_runs set completed_at=clock_timestamp(), http_status=response.status,
    processed=processed_count, confirmed=confirmed_count, outcome=result where request_id=run_id;
  delete from atenea_ops.reaper_runs where requested_at < now()-interval '7 days';
  return run_id;
end;
$$;
revoke all on function atenea_ops.run_reaper_direct() from public, anon, authenticated, service_role;
do $$ declare id bigint; begin
  select jobid into strict id from cron.job where jobname='atenea-preview-reaper';
  perform cron.alter_job(id, command := 'select atenea_ops.run_reaper_direct();', active := false);
end $$;
