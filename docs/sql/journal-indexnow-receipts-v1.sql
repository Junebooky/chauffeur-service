-- Applied to the shared project using chauffeur_journal_indexnow_receipts_v1.
create table if not exists chauffeur.journal_indexnow_receipts (
 url text not null check (url ~ '^https://www[.]jpchauffeurkorea[.]com/(ko/)?journal/[a-z0-9]+(-[a-z0-9]+)*/$' and length(url)<=220),
 revision timestamptz not null,
 action text not null check (action in ('publish','archive')),
 submitted_at timestamptz not null default now(),
 primary key(url,revision,action)
);
alter table chauffeur.journal_indexnow_receipts enable row level security;
revoke all on table chauffeur.journal_indexnow_receipts from public, anon, authenticated;
grant select,insert on table chauffeur.journal_indexnow_receipts to service_role;
