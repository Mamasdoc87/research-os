-- Research OS schema — Azure Database for PostgreSQL version.
-- Run this against your Azure Postgres database (e.g. via Azure Portal's
-- Query Editor, or any Postgres client pointed at your connection string).

create extension if not exists "uuid-ossp";

-- One row per person who signs in with Microsoft. We don't run our own
-- passwords — the id here is the unique id Microsoft gives that person.
create table if not exists profiles (
  id text primary key,             -- Microsoft account id (from Azure AD)
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  owner_id text not null references profiles(id) on delete cascade,
  title text not null,
  note text,
  status text not null default 'new', -- new | worth_pursuing | shelved | became_project
  onedrive_file_id text,              -- id of the synced copy in OneDrive, once created
  created_at timestamptz not null default now()
);

create table if not exists literature_checks (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  summary text not null,
  novelty_score int,
  key_papers jsonb,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id text not null references profiles(id) on delete cascade,
  idea_id uuid references ideas(id),
  name text not null,
  stage text not null default 'planning',
  created_at timestamptz not null default now()
);

create index if not exists ideas_owner_idx on ideas(owner_id);
create index if not exists projects_owner_idx on projects(owner_id);
