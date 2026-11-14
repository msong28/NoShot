-- Unfriend: end an accepted friendship WITHOUT blocking the other person.
-- Until now the only way to remove a friend was block_user(), which also hides
-- both people from each other's search. Same status the block path uses
-- ('cancelled'), so the pair can simply send a fresh request later.
create function public.remove_friend (p_friend_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  perform public.enforce_rate_limit('remove_friend', 30, interval '1 hour');
  if p_friend_id = auth.uid() then
    raise exception 'cannot unfriend yourself';
  end if;

  update public.friendships
  set status = 'cancelled',
      responded_at = now()
  where status = 'accepted'
    and (
      (requester_id = auth.uid() and addressee_id = p_friend_id)
      or (requester_id = p_friend_id and addressee_id = auth.uid())
    );
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'you are not friends with that user';
  end if;
end;
$$;

revoke execute on function public.remove_friend (uuid)
from
  public;

grant
execute on function public.remove_friend (uuid) to authenticated;
