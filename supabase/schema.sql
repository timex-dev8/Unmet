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
