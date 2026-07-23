-- Follow-up to 20260722120000_account_deletion.sql and this session's
-- RequireProfile fix: a deleted account being permanently unusable is
-- correct for someone who was *suspended* by a moderator, but wrong for
-- someone who self-deleted -- they should be able to come back and use the
-- same login again. Since profiles.id is the same uuid as auth.users.id
-- (one row per identity, 1:1 by construction) and an OAuth identity like
-- Google always maps back to the same existing auth.users row, there's no
-- way to give them a literal second/separate account under the same
-- email -- reactivating this same row is the closest equivalent, and from
-- the user's perspective ("sign up again with the same email") it's the
-- same experience.
create function public.reactivate_account_request (
  p_display_name text,
  p_username text,
  p_birth_year integer
) returns public.profiles language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.profiles;
  v_normalized_username text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and status = 'deleted'
  ) then
    raise exception 'only a deleted account can be reactivated';
  end if;

  if char_length(trim(coalesce(p_display_name, ''))) < 1 then
    raise exception 'display name is required';
  end if;

  v_normalized_username := lower(trim(coalesce(p_username, '')));

  update public.profiles
  set status = 'active',
      deleted_at = null,
      username = v_normalized_username,
      display_name = trim(p_display_name),
      birth_year = p_birth_year,
      age_acknowledged_at = now()
  where id = auth.uid()
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'that username is already taken';
end;
$$;

revoke execute on function public.reactivate_account_request (text, text, integer)
from
  public;

grant
execute on function public.reactivate_account_request (text, text, integer) to authenticated;
