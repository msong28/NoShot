-- Follow-up to 20260718090000_bets_core.sql, added as a separate migration
-- rather than editing the already-applied one (it's live on noshot-dev).
--
-- profiles' own RLS only lets a user select their own row, so rendering a
-- roster of bet participants needs the same security-definer escape hatch
-- Milestones 3/4 used (get_profiles_for_relations / get_group_member_profiles)
-- -- gated here by "caller is themselves a participant in this bet".
create function public.get_bet_participant_profiles (p_bet_id uuid) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.bet_participants bp
  join public.profiles p on p.id = bp.user_id
  where bp.bet_id = p_bet_id
    and p.deleted_at is null
    and exists (
      select 1 from public.bet_participants self
      where self.bet_id = p_bet_id and self.user_id = auth.uid()
    );
$$;

revoke execute on function public.get_bet_participant_profiles (uuid)
from
  public;

grant
execute on function public.get_bet_participant_profiles (uuid) to authenticated;
