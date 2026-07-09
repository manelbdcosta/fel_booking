alter table members add column password_hash text;
alter table members add column password_set_at text;

create table if not exists password_reset_tokens (
  id text primary key,
  member_id text not null references members(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null default (datetime('now'))
);

create index if not exists password_reset_tokens_lookup
  on password_reset_tokens (email, expires_at, used_at);
