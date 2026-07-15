-- Currencies (Milestone 5 / §5.1) + the deterministic moderation filter
-- decided in DECISIONS.md #3. moderate_text() is written generically so
-- later milestones (bet titles, comments, chat) can call it too, not just
-- currency names.
--
-- Known, documented limitation (see DECISIONS.md #3): this is a keyword/
-- substring filter, not an ML classifier -- it will under- and over-trigger
-- relative to real moderation. It exists to give MVP-level coverage of the
-- PRD's §10.2 hard-block / warn+queue / permit tiers without requiring an
-- external moderation API account before launch.
create function public.moderate_text (p_text text) returns text language plpgsql immutable as $$
declare
  v_normalized text := lower(p_text);
  -- Hard-block tier (PRD §10.2): credible threats/violence, non-consensual or
  -- exploitative sexual content, self-harm, illegal weapons/drugs, dangerous
  -- consumption. Deliberately no slur list here -- see DECISIONS.md #3.
  v_block text[] := array[
    'kill', 'murder', 'stab', 'shoot', 'punch', 'beat up', 'assault', 'torture',
    'maim', 'behead', 'waterboard', 'rape', 'molest', 'sexual favor', 'sexual favour',
    'sell sex', 'prostitut', 'child porn', 'child abuse', 'suicide', 'self harm',
    'self-harm', 'cut yourself', 'cut myself', 'overdose', 'heroin', 'cocaine',
    'crystal meth', 'methamphetamine', 'fentanyl', 'illegal gun', 'illegal firearm',
    'illegal weapon', 'hitman'
  ];
  -- Warn+queue tier: ambiguous alcohol/eating dares, humiliation, unclear slang.
  v_warn text[] := array[
    'shots', 'chug', 'binge drink', 'get drunk', 'blackout drunk', 'humiliat',
    'degrad', 'embarrass', 'ghost pepper', 'cinnamon challenge', 'raw egg',
    'eat the whole', 'ice bucket'
  ];
  v_term text;
begin
  foreach v_term in array v_block loop
    if v_normalized like '%' || v_term || '%' then
      return 'block';
    end if;
  end loop;

  foreach v_term in array v_warn loop
    if v_normalized like '%' || v_term || '%' then
      return 'warn';
    end if;
  end loop;

  return 'permit';
end;
$$;

-- Category slugs match `CurrencyCategoryColors` in src/constants/theme.ts
-- (already built in Milestone 0), not the PRD's prose wording verbatim --
-- e.g. "non-alcoholic drinks" -> `drinks`, "harmless actions" -> `actions`,
-- "meals" folded into `food`. `money` (that theme file's ISO-currency color)
-- deliberately has no equivalent here: §5.1 excludes money from stakes.
create type public.currency_category as enum (
  'food', 'drinks', 'items', 'favours', 'chores', 'actions', 'points', 'custom'
);

create type public.currency_moderation_status as enum ('approved', 'pending_review', 'blocked');

create table public.currencies (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  category public.currency_category not null,
  icon text,
  owner_user_id uuid references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  is_builtin boolean not null default false,
  moderation_status public.currency_moderation_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  constraint currencies_name_length check (char_length(trim(name)) between 1 and 40),
  -- A built-in has no owner; a custom currency has exactly one (personal xor
  -- group-owned), matching §5.1's "belong to their creator or group".
  constraint currencies_scope check (
    (is_builtin and owner_user_id is null and group_id is null)
    or (
      not is_builtin
      and (owner_user_id is not null) <> (group_id is not null)
    )
  )
);

create unique index currencies_owner_name_lower_idx on public.currencies (owner_user_id, lower(name))
where
  owner_user_id is not null;

create unique index currencies_group_name_lower_idx on public.currencies (group_id, lower(name))
where
  group_id is not null;

-- Server-authoritative moderation gate: overrides whatever the client sent
-- for is_builtin/moderation_status, so those can never be spoofed through
-- the insert policy below. Hard-block rejects the insert outright.
--
-- Only applies to real client requests (running as anon/authenticated,
-- the roles PostgREST switches to per-request) -- this migration's own
-- built-in-catalog seed insert below runs as the migration role and is
-- trusted by construction, so it's exempt.
create function public.currencies_apply_moderation () returns trigger language plpgsql as $$
declare
  v_tier text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new.is_builtin := false;
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

create trigger currencies_before_insert before insert on public.currencies for each row
execute function public.currencies_apply_moderation ();

alter table public.currencies enable row level security;

revoke all on public.currencies
from
  anon;

grant
select
,
insert
  on public.currencies to authenticated;

create policy currencies_select on public.currencies for
select
  to authenticated using (
    is_builtin
    or owner_user_id = auth.uid ()
    or group_id in (
      select
        public.get_my_group_ids ()
    )
  );

create policy currencies_insert on public.currencies for insert to authenticated
with
  check (
    not is_builtin
    and (
      (
        owner_user_id = auth.uid ()
        and group_id is null
      )
      or (
        owner_user_id is null
        and group_id is not null
        and exists (
          select 1 from public.group_members
          where group_members.group_id = currencies.group_id
            and group_members.user_id = auth.uid()
            and group_members.status = 'active'
        )
      )
    )
  );

-- Built-in catalog: low-risk only, per PRD §10.2 ("do not ship violent or
-- explicitly sexual built-in suggestions").
insert into
  public.currencies (name, category, icon, is_builtin, moderation_status)
values
  ('Meal', 'food', '🍽️', true, 'approved'),
  ('Coffee', 'drinks', '☕', true, 'approved'),
  ('Gift', 'items', '🎁', true, 'approved'),
  ('Favour', 'favours', '🤝', true, 'approved'),
  ('Chore', 'chores', '🧹', true, 'approved'),
  ('Harmless Dare', 'actions', '😅', true, 'approved'),
  ('Point', 'points', '⭐', true, 'approved');
