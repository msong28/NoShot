-- Batched sibling of get_bet_participant_profiles (20260718091500,
-- 20260722090500) for list screens (Home, Bets tab) that need every bet's
-- opponent name in one round trip instead of one RPC call per row.
-- profiles' own RLS only lets a user select their own row, so this needs
-- the same security-definer escape hatch, gated per-bet exactly like the
-- single-bet version: caller is a participant OR a member of the bet's
-- group.
create function public.get_bets_participant_profiles (p_bet_ids uuid[]) returns table (
  bet_id uuid,
  id uuid,
  username text,
  display_name text
) language sql stable security definer
set
  search_path = '' as $$
  select bp.bet_id, p.id, p.username, p.display_name
  from public.bet_participants bp
  join public.profiles p on p.id = bp.user_id
  where bp.bet_id = any (p_bet_ids)
    and p.deleted_at is null
    and (
      exists (
        select 1 from public.bet_participants self
        where self.bet_id = bp.bet_id and self.user_id = auth.uid()
      )
      or exists (
        select 1 from public.bets b
        where b.id = bp.bet_id
          and b.group_id in (select public.get_my_group_ids())
      )
    );
$$;

revoke execute on function public.get_bets_participant_profiles (uuid[])
from
  public;

grant
execute on function public.get_bets_participant_profiles (uuid[]) to authenticated;
