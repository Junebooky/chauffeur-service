-- OAuth state is single-use and credentials never leave the server.
create table if not exists chauffeur.gmail_oauth_states (
 state_hash text primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 redirect_uri text not null, verifier text not null, expires_at timestamptz not null
);
create table if not exists chauffeur.gmail_connections (
 owner_id uuid not null references auth.users(id) on delete cascade,
 redirect_uri text not null, email text not null, encrypted_refresh_token text not null,
 connected_at timestamptz not null default now(), primary key(owner_id,redirect_uri)
);
alter table chauffeur.gmail_oauth_states enable row level security;
alter table chauffeur.gmail_connections enable row level security;
revoke all on chauffeur.gmail_oauth_states,chauffeur.gmail_connections from public,anon,authenticated;
grant select,insert,update,delete on chauffeur.gmail_oauth_states,chauffeur.gmail_connections to service_role;
