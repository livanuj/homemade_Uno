-- Homemade Uno — server-authoritative room documents (Req 14, 23).
--
-- Every room is a set of JSON documents addressed by a path, mirroring the
-- original document model:
--
--   room              public room doc (code, host, mode, phase, round)
--   players/<uid>     seat / team / host / presence / public card count
--   state/current     public game state (no draw-pile order)
--   hands/<uid>       a player's cards — readable by that player (+ 2v2 partner)
--   private/deck      the draw-pile order — readable by NO client
--   actions/<id>      append-only action log — readable by no client
--
-- Clients never write documents. Every game mutation goes through the `game`
-- Edge Function, which runs the pure rules engine and commits all of a room's
-- changes atomically with `commit_room` (optimistic concurrency on `rev`).
-- The only client write is a player's own presence, via `heartbeat`.

create table public.room_docs (
  room_id    text        not null,
  path       text        not null,
  doc        jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, path)
);

-- Per-room revision: bumped by every commit, so a commit based on a stale read
-- is refused and the Edge Function re-reads and retries.
create table public.room_revs (
  room_id text   primary key,
  rev     bigint not null default 0
);

alter table public.room_docs enable row level security;
alter table public.room_revs enable row level security;

revoke all on public.room_docs from anon, authenticated;
revoke all on public.room_revs from anon, authenticated;
grant select on public.room_docs to authenticated;

-- ---------------------------------------------------------------------------
-- Read rules (Req 14.6, 23.1, 23.2)
-- ---------------------------------------------------------------------------

create function public.is_room_member(p_room text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_docs
    where room_id = p_room and path = 'players/' || auth.uid()::text
  );
$$;

-- True when the target is on the caller's team (2v2 partner, or the caller).
create function public.is_partner(p_room text, p_target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_docs me
    join public.room_docs them
      on them.room_id = me.room_id and them.path = 'players/' || p_target
    where me.room_id = p_room
      and me.path = 'players/' || auth.uid()::text
      and me.doc->>'team' is not null
      and me.doc->>'team' = them.doc->>'team'
  );
$$;

create policy room_docs_read on public.room_docs
  for select to authenticated
  using (
    case
      when path like 'private/%' or path like 'actions/%' then false
      when path like 'hands/%' then
        substr(path, 7) = auth.uid()::text or public.is_partner(room_id, substr(path, 7))
      else public.is_room_member(room_id)
    end
  );

-- ---------------------------------------------------------------------------
-- Presence: a player may stamp only their own lastSeen + connectionState.
-- ---------------------------------------------------------------------------

create function public.heartbeat(p_room text, p_connection text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_connection not in ('connected', 'disconnected') then
    raise exception 'invalid connection state %', p_connection;
  end if;
  update public.room_docs
     set doc = doc || jsonb_build_object(
           'lastSeen', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
           'connectionState', p_connection),
         updated_at = now()
   where room_id = p_room
     and path = 'players/' || auth.uid()::text
     -- A player who left stays left.
     and coalesce(doc->>'connectionState', '') <> 'left';
end;
$$;

revoke all on function public.heartbeat(text, text) from public, anon;
grant execute on function public.heartbeat(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic commit for the Edge Function (service role only).
--
-- p_ops is an array of { op: "set" | "update" | "delete", path, doc? }:
--   set    — create or replace the document
--   update — shallow-merge fields into an existing document (fails if missing)
--   delete — remove the document
-- Returns the new revision, or -1 when p_rev is stale (nothing is written).
-- ---------------------------------------------------------------------------

create function public.commit_room(p_room text, p_rev bigint, p_ops jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  cur bigint;
  op  jsonb;
begin
  insert into public.room_revs (room_id) values (p_room) on conflict do nothing;
  select rev into cur from public.room_revs where room_id = p_room for update;
  if cur <> p_rev then
    return -1;
  end if;

  for op in select * from jsonb_array_elements(p_ops) loop
    case op->>'op'
      when 'set' then
        insert into public.room_docs (room_id, path, doc)
        values (p_room, op->>'path', op->'doc')
        on conflict (room_id, path)
          do update set doc = excluded.doc, updated_at = now();
      when 'update' then
        update public.room_docs
           set doc = doc || (op->'doc'), updated_at = now()
         where room_id = p_room and path = op->>'path';
        if not found then
          raise exception 'update of missing document %/%', p_room, op->>'path';
        end if;
      when 'delete' then
        delete from public.room_docs where room_id = p_room and path = op->>'path';
      else
        raise exception 'unknown op %', op->>'op';
    end case;
  end loop;

  update public.room_revs set rev = cur + 1 where room_id = p_room;
  return cur + 1;
end;
$$;

revoke all on function public.commit_room(text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.commit_room(text, bigint, jsonb) to service_role;

-- Live sync: clients subscribe to their room's documents; RLS filters rows.
alter publication supabase_realtime add table public.room_docs;
