-- Account deletion & privacy (Milestone 14 / AUTH-05, PRD §9.5).
--
-- Not a hard delete: profiles.deleted_at has existed since Milestone 1
-- specifically so counterparties can retain coherent, pseudonymized
-- balance/history references after a user deletes their account, per
-- §9.5's "preserve minimal pseudonymized ledger and audit references"
-- requirement. Only identity fields are scrubbed here -- friendships,
-- group memberships, bets, and obligations all keep pointing at this same
-- profile row, unaffected by this migration.
create function public.delete_account_request () returns public.profiles language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.profiles;
  v_anon_username text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and deleted_at is not null) then
    raise exception 'account is already deleted';
  end if;

  -- 8 lowercase hex chars, well within profiles_username_format's 3-20
  -- charset -- and the existing profiles_username_lower_idx unique index
  -- already excludes deleted_at is not null rows, so this never needs to
  -- worry about colliding with another deleted row's placeholder.
  v_anon_username := 'deleted_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  update public.profiles
  set status = 'deleted',
      deleted_at = now(),
      username = v_anon_username,
      display_name = 'Deleted user',
      birth_year = null,
      age_acknowledged_at = null
  where id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'profile not found';
  end if;

  -- A pending request naming a now-deleted user would otherwise sit
  -- forever in the other party's list with nothing they can do about it --
  -- the same "clean up the dangling pending state" reasoning block_user()
  -- already applies to friendships. Accepted friendships and active group
  -- memberships are deliberately left untouched: that's the actual history
  -- counterparties need to keep coherent.
  update public.friendships
  set status = 'cancelled',
      responded_at = now()
  where status = 'pending'
    and (requester_id = auth.uid() or addressee_id = auth.uid());

  update public.group_members
  set status = 'declined'
  where user_id = auth.uid()
    and status = 'invited';

  -- Best-effort session revocation: stops future token refreshes for this
  -- user immediately. This project has no Edge Functions / service-role
  -- secret available to a Postgres function, so a direct delete against
  -- auth.sessions (cascading to auth.refresh_tokens) is the only revocation
  -- path available from inside this transaction. Note this closes the door
  -- on renewal, not necessarily every request already in flight on an
  -- already-issued, not-yet-expired access token -- Postgres RLS decodes
  -- the JWT and doesn't re-check session validity per request. See the
  -- privacy policy placeholder for the same caveat stated in plain language.
  delete from auth.sessions where user_id = auth.uid();

  return v_row;
end;
$$;

revoke execute on function public.delete_account_request ()
from
  public;

grant
execute on function public.delete_account_request () to authenticated;

-- Tighten profiles' direct-update surface: status/deleted_at/username must
-- only change via delete_account_request() (or a future dedicated RPC),
-- never a raw client update. The blanket UPDATE grant from Milestone 1
-- predates this function and, unpatched, would let a client self-set
-- status = 'deleted' directly -- bypassing anonymization and session
-- revocation entirely. profiles_update_own's row-level check (id =
-- auth.uid()) is unchanged; only the column set a direct update can touch
-- shrinks.
revoke update on public.profiles
from
  authenticated;

grant
update (display_name, birth_year, age_acknowledged_at) on public.profiles to authenticated;
