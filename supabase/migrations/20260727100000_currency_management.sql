-- Phase 1 fixes: managing a personal currency preset list (edit, delete,
-- reorder). Currencies were never RPC-only (see the plain `currencies_insert`
-- policy in 20260715110000_currencies.sql) -- they're metadata/labels, not
-- money/ledger state, so the same direct-RLS-write pattern extends here
-- rather than adding a bespoke RPC.
--
-- sort_order backs manual reordering in the "Yours" list (create.tsx's
-- currency picker, currencies.tsx's management screen). Every row defaults
-- to 0; ties break on name like before until a user actually reorders.
alter table public.currencies
add column sort_order integer not null default 0;

-- The insert-time moderation trigger only reran moderate_text() because
-- name is the only client-settable field a NEW row could carry that needs
-- checking; extending it to update must NOT blindly recompute
-- moderation_status every time, or a client renaming-unrelated update
-- (like a sort_order reorder) would silently overwrite an admin's
-- moderation_actions block back to whatever the deterministic filter
-- says -- moderation state must stay server/admin-authoritative once set,
-- per the server authority model. Only actually renaming re-checks it.
create or replace function public.currencies_apply_moderation () returns trigger language plpgsql as $$
declare
  v_tier text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new.is_builtin := false;

  if tg_op = 'update' and old.name = new.name then
    return new;
  end if;

  v_tier := public.moderate_text(new.name);

  if v_tier = 'block' then
    raise exception 'that currency name isn''t allowed';
  elsif v_tier = 'warn' then
    new.moderation_status := 'pending_review';
  else
    new.moderation_status := 'approved';
  end if;

  return new;
end;
$$;

create trigger currencies_before_update before
update on public.currencies for each row
execute function public.currencies_apply_moderation ();

-- Only your own custom currency: never a built-in, never someone else's or
-- a group's (group-currency editing/deletion is out of scope for this pass).
-- A currency an admin has blocked can't be touched by its owner at all --
-- not even a reorder -- so there's no path back to visibility except
-- through moderation, not a client update.
create policy currencies_update on public.currencies for
update to authenticated using (
  not is_builtin
  and owner_user_id = auth.uid ()
  and moderation_status <> 'blocked'
)
with
  check (
    not is_builtin
    and owner_user_id = auth.uid ()
  );

-- Deleting a currency still in use (a bet_commitment, ledger_entry, manual
-- obligation, or redemption references it) hits each table's FK constraint
-- (default NO ACTION, i.e. restrict) and fails outright -- no separate
-- in-use check needed here, Postgres already refuses to orphan that history.
create policy currencies_delete on public.currencies for delete to authenticated using (
  not is_builtin
  and owner_user_id = auth.uid ()
);

-- The original migration only granted select/insert -- RLS policies alone
-- don't confer the privilege, so update/delete need the table-level grant
-- too or every attempt fails before the policies are even consulted.
grant
update,
delete on public.currencies to authenticated;
