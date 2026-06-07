-- ============================================================
-- Voetbal Toernooi App - Supabase Schema
-- Voer dit uit in de Supabase SQL Editor
-- ============================================================

-- Verwijder bestaande tabellen (veilig opnieuw uitvoeren)
drop table if exists matches cascade;
drop table if exists group_teams cascade;
drop table if exists groups cascade;
drop table if exists players cascade;
drop table if exists teams cascade;

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Spelers
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  level integer not null check (level between 1 and 5),
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz default now()
);

-- Poules
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Koppeltabel poule <-> team
create table group_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  unique(group_id, team_id)
);

-- Wedstrijden
create table matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  home_team_id uuid references teams(id) on delete cascade,
  away_team_id uuid references teams(id) on delete cascade,
  scheduled_time timestamptz,
  home_score integer,
  away_score integer,
  status text default 'scheduled' check (status in ('scheduled', 'played')),
  round_number integer default 1,
  field_number integer default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security: zet RLS aan en sta alle operaties toe
-- voor de anon key (publieke toegang voor dit toernooi)
-- ============================================================

alter table teams enable row level security;
alter table players enable row level security;
alter table groups enable row level security;
alter table group_teams enable row level security;
alter table matches enable row level security;

create policy "Public read/write teams" on teams for all using (true) with check (true);
create policy "Public read/write players" on players for all using (true) with check (true);
create policy "Public read/write groups" on groups for all using (true) with check (true);
create policy "Public read/write group_teams" on group_teams for all using (true) with check (true);
create policy "Public read/write matches" on matches for all using (true) with check (true);

-- ============================================================
-- Realtime: zet realtime aan voor alle tabellen
-- ============================================================
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table group_teams;
alter publication supabase_realtime add table matches;
