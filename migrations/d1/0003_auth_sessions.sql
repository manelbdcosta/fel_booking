create table if not exists auth_tokens (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  purpose text not null check (purpose in ('sign-in')),
  expires_at text not null,
  used_at text,
  created_at text not null default (datetime('now'))
);

create index if not exists auth_tokens_lookup
  on auth_tokens (email, purpose, expires_at, used_at);

create table if not exists sessions (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  expires_at text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists sessions_member_lookup
  on sessions (member_id, expires_at);
