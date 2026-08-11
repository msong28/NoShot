-- Lets the creator withdraw their own bet before the other side has acted
-- on it (Phase 1 fixes: "delete bet" for a proposal nobody has agreed to
-- yet). Distinct from decline (the *other* party rejecting a proposal) and
-- from propose_cancel_bet/approve_cancel_bet (Milestone 7's mutual-consent
-- path for an *active* bet both sides already agreed to) -- withdrawing
-- your own still-pending proposal needs no one else's sign-off, since
-- nothing was agreed to yet.
--
-- A draft is deleted outright (nothing was ever shared, nothing worth a
-- record of). A pending_acceptance bet is voided instead, the same
-- terminal state an outright decline reaches, so the other party's view of
-- "they sent me a bet, then pulled it" stays intact rather than the bet
-- silently vanishing from their history.
create function public.withdraw_bet (p_bet_id uuid) returns public.bets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_bet public.bets;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_bet from public.bets where id = p_bet_id and creator_id = auth.uid();
  if v_bet.id is null then
    raise exception 'bet not found';
  end if;

  if v_bet.status = 'draft' then
    delete from public.bets where id = p_bet_id;
    return v_bet;
  end if;

  if v_bet.status <> 'pending_acceptance' then
    raise exception 'only a draft or not-yet-accepted bet can be withdrawn';
  end if;

  update public.bets set status = 'voided' where id = p_bet_id returning * into v_bet;
  return v_bet;
end;
$$;

revoke execute on function public.withdraw_bet (uuid)
from
  public;

grant
execute on function public.withdraw_bet (uuid) to authenticated;
