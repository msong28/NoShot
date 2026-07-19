-- Image proof (Milestone 12 / SOC-04, SOC-05, Appendix B).
--
-- Two-step flow, standard for Supabase Storage: the client uploads the
-- (already client-side-compressed, per SOC-05) file directly to Storage
-- first -- authorized by the storage.objects policies below, keyed off the
-- bet_id encoded as the first path segment (`{bet_id}/{filename}`, read via
-- storage.foldername()) -- then calls upload_proof() to register the
-- metadata row atomically, re-validating everything server-side rather than
-- trusting whatever the client claims about its own upload.
--
-- Private bucket + signed URLs (SOC-05): nothing here is public. Viewing a
-- proof image means creating a short-lived signed URL, which itself
-- requires passing the same SELECT policy below -- the signed-URL endpoint
-- is not a separate authorization path.
insert into
  storage.buckets (id, name, public)
values
  ('proof-assets', 'proof-assets', false);

create table public.proof_assets (
  id uuid primary key default gen_random_uuid (),
  bet_id uuid not null references public.bets (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  caption text,
  moderation_status public.content_moderation_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  constraint proof_assets_mime_type_allowed check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint proof_assets_size_limit check (
    size_bytes > 0
    and size_bytes <= 10485760
  ),
  constraint proof_assets_caption_length check (
    caption is null
    or char_length(caption) <= 500
  )
);

create index proof_assets_bet_idx on public.proof_assets (bet_id, created_at);

alter table public.proof_assets enable row level security;

revoke all on public.proof_assets
from
  anon;

grant
select
  on public.proof_assets to authenticated;

-- Same visibility shape as comments/polls: bet participants, plus (GR-05)
-- the bet's group if it's group-scoped.
create policy proof_assets_select on public.proof_assets for
select
  to authenticated using (
    bet_id in (
      select
        public.get_my_bet_ids ()
    )
    or bet_id in (
      select id
      from public.bets
      where
        group_id in (
          select
            public.get_my_group_ids ()
        )
    )
  );

-- p_storage_path must already exist as an object the caller just uploaded
-- (enforced implicitly: if the storage insert policy below let them write
-- it, the path's first segment already matches p_bet_id) -- this function
-- only re-validates participation and registers the metadata, it doesn't
-- touch Storage itself.
create function public.upload_proof (
  p_bet_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_caption text default null
) returns public.proof_assets language plpgsql security definer
set
  search_path = '' as $$
declare
  v_row public.proof_assets;
  v_tier text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.bet_participants
    where bet_id = p_bet_id and user_id = auth.uid()
  ) then
    raise exception 'only a participant can upload proof for this bet';
  end if;
  if p_storage_path not like (p_bet_id::text || '/%') then
    raise exception 'storage path must be scoped to this bet';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'unsupported image type';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 10485760 then
    raise exception 'image must be between 1 byte and 10MB';
  end if;

  if p_caption is not null then
    if char_length(p_caption) > 500 then
      raise exception 'caption must be 500 characters or fewer';
    end if;
    v_tier := public.moderate_text(p_caption);
    if v_tier = 'block' then
      raise exception 'that caption isn''t allowed';
    end if;
  end if;

  insert into public.proof_assets (
    bet_id, uploader_id, storage_path, mime_type, size_bytes, caption, moderation_status
  )
  values (
    p_bet_id, auth.uid(), p_storage_path, p_mime_type, p_size_bytes, nullif(trim(coalesce(p_caption, '')), ''),
    (case when v_tier = 'warn' then 'pending_review' else 'approved' end)::public.content_moderation_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.upload_proof (uuid, text, text, bigint, text)
from
  public;

grant
execute on function public.upload_proof (uuid, text, text, bigint, text) to authenticated;

-- Storage RLS: object paths are `{bet_id}/{filename}` -- storage.foldername()
-- reads the first path segment back out to check bet participation/group
-- membership, the same authorization shape as proof_assets_select above,
-- without needing a join back to the metadata table (which wouldn't exist
-- yet at upload time anyway).
create policy proof_assets_storage_insert on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'proof-assets'
    and (
      (storage.foldername (name)) [1]
    )::uuid in (
      select
        public.get_my_bet_ids ()
    )
  );

create policy proof_assets_storage_select on storage.objects for
select
  to authenticated using (
    bucket_id = 'proof-assets'
    and (
      (
        (storage.foldername (name)) [1]
      )::uuid in (
        select
          public.get_my_bet_ids ()
      )
      or (
        (storage.foldername (name)) [1]
      )::uuid in (
        select id
        from public.bets
        where
          group_id in (
            select
              public.get_my_group_ids ()
          )
      )
    )
  );
