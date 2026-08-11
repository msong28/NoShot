-- Broaden friend search (FR-05 follow-up): the original was a prefix-only
-- match on `username`, so "ali" found Alice but "lice" or her display name
-- didn't -- confusing for a "search for a friend" box. Now matches anywhere
-- in either `username` or `display_name`, and caps results at 10 (was 20)
-- so the picker stays a short, scannable list rather than a wall of names.
-- Same rate limit, block-exclusion, and auth checks as before; only the
-- match/order/limit logic changes.
create or replace function public.search_profiles_by_username (p_query text) returns table (id uuid, username text, display_name text) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_recent_count integer;
  v_needle text;
  v_pattern text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if length(trim(p_query)) < 3 then
    raise exception 'query must be at least 3 characters';
  end if;

  select count(*) into v_recent_count
  from public.username_search_log
  where user_id = auth.uid()
    and searched_at > now() - interval '1 minute';

  if v_recent_count >= 20 then
    raise exception 'too many searches, please wait a moment and try again';
  end if;

  insert into public.username_search_log (user_id) values (auth.uid());

  v_needle := lower(trim(p_query));
  v_pattern := '%' || v_needle || '%';

  return query
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.deleted_at is null
    and p.id <> auth.uid()
    and (p.username like v_pattern or lower(p.display_name) like v_pattern)
    and not public.is_blocked_pair(auth.uid(), p.id)
  order by
    (p.username = v_needle) desc,
    (p.username like v_needle || '%') desc,
    (lower(p.display_name) like v_needle || '%') desc,
    p.username
  limit 10;
end;
$$;
