create table if not exists account_invites (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  email text not null,
  role text not null check (role in ('member', 'coach')),
  token_hash text not null unique,
  expires_at text not null,
  accepted_at text,
  created_by text references members(id) on delete set null,
  created_at text not null default (datetime('now'))
);

create index if not exists account_invites_lookup
  on account_invites (email, expires_at, accepted_at);
