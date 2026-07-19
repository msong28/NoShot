-- Follow-up to 20260718091500_bets_participant_profiles.sql, added as a
-- separate migration rather than editing the already-applied one.
--
-- comments_select (20260722090000) deliberately extends comment visibility
-- to a bet's group members, not just its participants (matching GR-05's
-- precedent for proof on group-scoped bets). But get_bet_participant_profiles
-- was gated on "the caller is themselves a participant" -- a group member
-- viewing the comment thread on a bet they haven't joined would resolve
-- every author as unknown. Broadening the gate to match comments' own
-- visibility rule: participant OR member of the bet's group.
create or replace function public.get_bet_participant_profiles (p_bet_id uuid) returns table (id uuid, username text, display_name text) language sql stable security definer
set
  search_path = '' as $$
  select p.id, p.username, p.display_name
  from public.bet_participants bp
  join public.profiles p on p.id = bp.user_id
  where bp.bet_id = p_bet_id
    and p.deleted_at is null
    and (
      exists (
        select 1 from public.bet_participants self
        where self.bet_id = p_bet_id and self.user_id = auth.uid()
      )
      or exists (
        select 1 from public.bets b
        where b.id = p_bet_id
          and b.group_id in (select public.get_my_group_ids())
      )
    );
$$;
