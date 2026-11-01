-- Footprint Game leaderboard schema (applied to Supabase project pokemon-footprint-game, us-east-1).
-- Re-run in the SQL Editor of a fresh project to recreate the backend.

create table public.scores (
  id          bigint generated always as identity primary key,
  name        text        not null,
  score       integer     not null,
  time_ms     integer     not null,
  mode        text        not null default 'lives3',
  lang        text        not null default 'en',
  created_at  timestamptz not null default now(),
  constraint scores_name_len       check (char_length(name) between 1 and 16),
  constraint scores_name_chars     check (name !~ '[[:cntrl:]]'),
  constraint scores_score_range    check (score between 0 and 1000),
  constraint scores_time_range     check (time_ms between 0 and 86400000),
  constraint scores_time_plausible check (time_ms >= score * 200),
  constraint scores_mode           check (mode in ('lives3')),
  constraint scores_lang           check (lang in ('en', 'ko', 'ja'))
);

comment on table public.scores is 'Footprint Game leaderboard. Public read; writes only through submit_score().';

create index scores_rank_idx on public.scores (mode, score desc, time_ms asc, id asc);
create index scores_created_at_idx on public.scores (created_at);

alter table public.scores enable row level security;

-- Anyone can read the leaderboard.
create policy "Leaderboard is publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Clients get read access only; there are no insert/update/delete grants or policies.
revoke all on table public.scores from anon, authenticated;
grant select on table public.scores to anon, authenticated;

-- The only write path: validates input, applies a global flood guard, returns the new rank.
-- (Supabase's advisor flags this SECURITY DEFINER function as anon-callable; that is intentional.)
create or replace function public.submit_score(
  p_name    text,
  p_score   integer,
  p_time_ms integer,
  p_lang    text default 'en'
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_recent integer;
  v_id     bigint;
  v_rank   bigint;
begin
  if char_length(v_name) = 0 then
    raise exception 'Name is required' using errcode = '22023';
  end if;
  v_name := left(v_name, 16);

  select count(*) into v_recent
  from public.scores s
  where s.created_at > now() - interval '1 minute';
  if v_recent >= 60 then
    raise exception 'Too many submissions right now, please try again later' using errcode = '54000';
  end if;

  insert into public.scores (name, score, time_ms, mode, lang)
  values (v_name, p_score, p_time_ms, 'lives3', case when p_lang in ('ko', 'ja') then p_lang else 'en' end)
  returning public.scores.id into v_id;

  select count(*) + 1 into v_rank
  from public.scores s
  where s.mode = 'lives3'
    and (s.score > p_score or (s.score = p_score and s.time_ms < p_time_ms));

  return json_build_object('id', v_id, 'rank', v_rank);
end;
$$;

revoke all on function public.submit_score(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_score(text, integer, integer, text) to anon, authenticated;
