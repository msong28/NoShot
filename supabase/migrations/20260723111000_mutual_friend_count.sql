-- Mutual friend count between the caller and p_other_id -- Friends
-- screen's "N mutual" on incoming requests and search results. Security
-- definer since the caller's own RLS on friendships wouldn't otherwise let
-- them see p_other_id's friendships (mirrors get_profiles_for_relations /
-- get_invite_preview's existing pattern: no explicit auth.uid() null
-- check, relying on the authenticated-only grant below).
create function public.get_mutual_friend_count (p_other_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  select count(*)::integer
  from (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as friend_id
    from public.friendships
    where status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid())
  ) my_friends
  where friend_id in (
    select case when requester_id = p_other_id then addressee_id else requester_id end
    from public.friendships
    where status = 'accepted' and (requester_id = p_other_id or addressee_id = p_other_id)
  );
$$;

revoke execute on function public.get_mutual_friend_count (uuid)
from
  public;

grant
execute on function public.get_mutual_friend_count (uuid) to authenticated;
