-- Security-review follow-up: 20260723140000_additional_rate_limits.sql
-- capped upload_proof() at 20/hour, but that only throttles the metadata
-- RPC. The actual client flow does a *separate*, unthrottled write straight
-- to Storage first (see proof_assets_storage_insert policy in
-- 20260722110000_proof_assets.sql) -- storage.objects RLS only checks bet
-- participation, never call frequency. Anyone with a valid session and a
-- bet_id they participate in could call the Storage REST API directly
-- (bypassing our app's JS, upload_proof(), and its rate limit entirely) and
-- write unlimited objects (each up to the bucket's own 10MB cap) into that
-- bet's folder, at real storage cost, without ever registering a
-- proof_assets row.
--
-- A trigger is the only enforcement point that can't be bypassed by calling
-- the Storage API directly, since it fires on the same table Storage itself
-- writes to. Kept as a separate action/budget from upload_proof's own
-- 20/hour (rather than sharing one counter) so a normal upload -- one
-- storage insert + one RPC call -- doesn't silently halve the limit either
-- layer documents on its own.
create function public.proof_storage_rate_limit () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if new.bucket_id = 'proof-assets' then
    perform public.enforce_rate_limit('proof_storage_upload', 30, interval '1 hour');
  end if;
  return new;
end;
$$;

create trigger proof_storage_rate_limit_trigger before insert on storage.objects for each row
execute function public.proof_storage_rate_limit ();
