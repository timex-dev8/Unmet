-- Unmet database schema. Paste into Supabase: SQL Editor → New query → Run.
-- Flow: raw_items → clusters → cards; card_sources keeps every card linked to its originals.

create table if not exists sources (
  id text primary key,                -- e.g. 'hn'
  name text not null,
  url text
);

insert into sources (id, name, url)
values ('hn', 'Hacker News', 'https://news.ycombinator.com')
on conflict (id) do nothing;

create table if not exists raw_items (
  id bigint generated always as identity primary key,
  source_id text not null references sources(id),
  external_id text not null,          -- id at the source (HN objectID)
  url text not null,
  title text,
  body text,
  author text,
  points int default 0,
  comment_count int default 0,
  posted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  -- pipeline state
  status text not null default 'new' check (status in ('new', 'kept', 'dropped')),
  classification jsonb,
  cluster_id bigint,
  unique (source_id, external_id)
);

create table if not exists clusters (
  id bigint generated always as identity primary key,
  label text not null,
  summary text,
  category text,
  item_count int not null default 0,
  first_seen timestamptz,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

alter table raw_items
  drop constraint if exists raw_items_cluster_fk,
  add constraint raw_items_cluster_fk foreign key (cluster_id) references clusters(id) on delete set null;

create table if not exists cards (
  id bigint generated always as identity primary key,
  cluster_id bigint references clusters(id) on delete cascade,
  slug text not null unique,
  headline text not null,
  summary text not null,               -- two sentences, our own words
  who text,
  category text,
  quote text,                          -- under 15 words
  highlight text,                      -- the repeated phrase inside quote
  evidence jsonb not null default '{}', -- counts, date range, weekly mentions for the sparkline
  demand int check (demand between 0 and 100),
  competition int check (competition between 0 and 100),
  difficulty int check (difficulty between 0 and 100),
  ai_suggestions jsonb not null default '[]',
  trend text check (trend in ('rising', 'steady', 'falling')),
  review text not null default 'pending' check (review in ('pending', 'good', 'junk')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cards_feed_idx on cards (published, created_at desc, id desc);
create index if not exists cards_category_idx on cards (category);

create table if not exists card_sources (
  card_id bigint not null references cards(id) on delete cascade,
  raw_item_id bigint not null references raw_items(id) on delete cascade,
  primary key (card_id, raw_item_id)
);

create table if not exists exa_cache (
  query text primary key,
  result jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists waitlist (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Row level security: the browser (anon key) may only read published cards and their sources.
-- Everything else is written by server code using the service-role key.
alter table sources enable row level security;
alter table raw_items enable row level security;
alter table clusters enable row level security;
alter table cards enable row level security;
alter table card_sources enable row level security;
alter table exa_cache enable row level security;
alter table waitlist enable row level security;

drop policy if exists "public read published cards" on cards;
create policy "public read published cards" on cards for select using (published);

drop policy if exists "public read sources" on sources;
create policy "public read sources" on sources for select using (true);

drop policy if exists "public read card links" on card_sources;
create policy "public read card links" on card_sources for select
  using (exists (select 1 from cards c where c.id = card_id and c.published));

drop policy if exists "public read linked items" on raw_items;
create policy "public read linked items" on raw_items for select
  using (exists (
    select 1 from card_sources cs join cards c on c.id = cs.card_id
    where cs.raw_item_id = raw_items.id and c.published
  ));

-- ---------------------------------------------------------------------------
-- Stage 2, step 1: research that survives server restarts (no login needed).
-- The server writes with the service-role key (bypasses RLS); browsers can only read shared ideas.

-- Finished research results, so the same first question is instant and free (6 hours).
create table if not exists research_cache (
  key text primary key,               -- depth + normalized question
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- One row per research run, for the hourly per-visitor limit and the daily cap.
create table if not exists research_hits (
  id bigint generated always as identity primary key,
  visitor text not null,              -- SHA-256 of the IP, never the IP itself
  cost int not null,
  at timestamptz not null default now()
);
create index if not exists research_hits_visitor_idx on research_hits (visitor, at desc);
create index if not exists research_hits_at_idx on research_hits (at desc);

-- Ideas found by research, so their share links work for anyone.
create table if not exists ideas (
  slug text primary key,
  card jsonb not null,
  created_at timestamptz not null default now()
);

alter table research_cache enable row level security;
alter table research_hits enable row level security;
alter table ideas enable row level security;

drop policy if exists "public read ideas" on ideas;
create policy "public read ideas" on ideas for select using (true);

-- ---------------------------------------------------------------------------
-- Stage 2, step 2: accounts. Each signed-in person's history, synced across devices.
-- One row per user per kind; data is that browser store's JSON (see lib/sync.ts).

create table if not exists user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('threads', 'saved', 'board', 'mind', 'interests')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table user_data enable row level security;

-- Size limit per row (5 MB). NOT VALID: existing rows aren't checked, new writes are. Safe to re-run.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_data_size_check' and conrelid = 'public.user_data'::regclass) then
    alter table user_data add constraint user_data_size_check check (pg_column_size(data) < 5242880) not valid;
  end if;
end $$;

-- Only the owner can read or change their rows.
drop policy if exists "own rows: read" on user_data;
create policy "own rows: read" on user_data for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows: insert" on user_data;
create policy "own rows: insert" on user_data for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own rows: update" on user_data;
create policy "own rows: update" on user_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows: delete" on user_data;
create policy "own rows: delete" on user_data for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Stage 3: the live feed. A daily job researches niches; only problems that pass the
-- feed bar (lib/feed/bar.ts) land here. Duplicates are merged, stale cards drop out.

create table if not exists feed_cards (
  slug text primary key,
  card jsonb not null,
  topic text not null,
  category text not null,
  score int not null default 0,          -- demand, for ordering
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()  -- bumped when new evidence is merged in
);
create index if not exists feed_cards_rank_idx on feed_cards (score desc, updated_at desc);
create index if not exists feed_cards_category_idx on feed_cards (category);

-- Which niches the daily job researches, and when each last ran.
create table if not exists feed_topics (
  topic text primary key,
  origin text not null default 'seed' check (origin in ('seed', 'user')),
  last_run timestamptz,
  cards_found int not null default 0
);

alter table feed_cards enable row level security;
alter table feed_topics enable row level security;

drop policy if exists "public read feed" on feed_cards;
create policy "public read feed" on feed_cards for select using (true);

-- ---------------------------------------------------------------------------
-- Stage 4: "what's working". Real products with proof (verified revenue, top-grossing charts,
-- upvotes, stars), mixed into the feed. The evening feed job refreshes them (lib/products).

create table if not exists feed_products (
  slug text primary key,
  product jsonb not null,
  category text not null,
  score int not null default 0,          -- strength of the proof, for ordering
  updated_at timestamptz not null default now()
);
create index if not exists feed_products_rank_idx on feed_products (score desc);

alter table feed_products enable row level security;
drop policy if exists "public read products" on feed_products;
create policy "public read products" on feed_products for select using (true);

-- ---------------------------------------------------------------------------
-- Stage 5: abuse limits. Safe to re-run. The app works before this is run (it falls back to the
-- older checks), but limits only hold under parallel requests once it is.

-- Research limits in one locked step (app/api/research): check and record together, so parallel
-- requests can't all pass the same check. Accounts ("u:<user id>") have their own buckets, so guests
-- can't use up the day for them. global_day_limit counts everyone of the same kind; 0 = none.
alter table research_hits add column if not exists is_user boolean not null default false;

create or replace function take_research_slot(
  visitor text, is_user boolean, hour_limit int, day_limit int, global_day_limit int, cost int default 1
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  hour_used int;
  day_used int;
  pool_used int;
begin
  perform pg_advisory_xact_lock(hashtext('take_research_slot'));
  select coalesce(sum(h.cost) filter (where h.at > now() - interval '1 hour'), 0),
         coalesce(sum(h.cost) filter (where h.at >= day_start), 0)
    into hour_used, day_used
    from research_hits h
   where h.visitor = take_research_slot.visitor
     and h.at >= least(day_start, now() - interval '1 hour');
  if hour_used + take_research_slot.cost > hour_limit or day_used + take_research_slot.cost > day_limit then
    return false;
  end if;
  if global_day_limit > 0 then
    select coalesce(sum(h.cost), 0) into pool_used
      from research_hits h
     where h.is_user = take_research_slot.is_user and h.at >= day_start;
    if pool_used + take_research_slot.cost > global_day_limit then
      return false;
    end if;
  end if;
  insert into research_hits (visitor, cost, is_user)
  values (take_research_slot.visitor, take_research_slot.cost, take_research_slot.is_user);
  if random() < 0.02 then
    delete from research_hits where at < now() - interval '3 days'; -- keep the table small
  end if;
  return true;
end;
$$;

-- Hourly limits for the AI-only routes (/api/mind, /api/ideas, /api/interests; lib/rate-limit.ts).
create table if not exists rate_hits (
  id bigint generated always as identity primary key,
  bucket text not null,               -- route + SHA-256 of the IP, e.g. 'mind:3f2a…'
  at timestamptz not null default now()
);
create index if not exists rate_hits_bucket_idx on rate_hits (bucket, at desc);
create index if not exists rate_hits_at_idx on rate_hits (at);
alter table rate_hits enable row level security;

create or replace function take_rate_slot(bucket text, hour_limit int) returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('rate:' || take_rate_slot.bucket));
  if (select count(*) from rate_hits r where r.bucket = take_rate_slot.bucket and r.at > now() - interval '1 hour') >= hour_limit then
    return false;
  end if;
  insert into rate_hits (bucket) values (take_rate_slot.bucket);
  if random() < 0.02 then
    delete from rate_hits where at < now() - interval '26 hours'; -- keep the table small (daily pools need a day)
  end if;
  return true;
end;
$$;

-- Daily pool for the AI-only routes: everyone together per UTC day (bucket 'pool:<route>').
create or replace function take_daily_slot(bucket text, day_limit int) returns boolean
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('rate:' || take_daily_slot.bucket));
  if (select count(*) from rate_hits r
       where r.bucket = take_daily_slot.bucket
         and r.at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') >= day_limit then
    return false;
  end if;
  insert into rate_hits (bucket) values (take_daily_slot.bucket);
  return true;
end;
$$;

-- Only the server (service role) may take slots; otherwise anyone with the public key could use up
-- someone else's limit.
revoke all on function take_research_slot(text, boolean, int, int, int, int) from public, anon, authenticated;
revoke all on function take_rate_slot(text, int) from public, anon, authenticated;
revoke all on function take_daily_slot(text, int) from public, anon, authenticated;
grant execute on function take_research_slot(text, boolean, int, int, int, int) to service_role;
grant execute on function take_rate_slot(text, int) to service_role;
grant execute on function take_daily_slot(text, int) to service_role;

-- Watched niches belong to whoever added them (app/api/watch): 10 per account, removed when that
-- person stops watching, and gone with their account.
alter table feed_topics add column if not exists owner uuid references auth.users(id) on delete cascade;
create index if not exists feed_topics_owner_idx on feed_topics (owner);

-- Feed cards and shared ideas used to keep `query` (the topic someone searched) and research
-- topics: strip it from the public copies. Unmet's own seed niches keep theirs.
update ideas set card = card - 'query' where card ? 'query';
update feed_cards set card = card - 'query'
 where card ? 'query' and topic not in (select topic from feed_topics where origin = 'seed');
update feed_cards set topic = category
 where topic not in (select topic from feed_topics);
