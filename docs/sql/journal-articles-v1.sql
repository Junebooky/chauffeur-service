-- Additive, isolated content schema. Never grant public roles access to drafts.
begin;
create table if not exists chauffeur.journal_articles (
 id uuid primary key default gen_random_uuid(),
 slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 100 and slug <> 'sitemap'),
 lang text not null check (lang in ('en','ko')),
 title text not null check (length(title) between 5 and 160),
 description text not null check (length(description) between 10 and 320),
 intro text not null check (length(intro) between 20 and 1200),
 sections jsonb not null check (jsonb_typeof(sections)='array' and jsonb_array_length(sections) between 2 and 12),
 status text not null default 'draft' check (status in ('draft','approved','archived')),
 publish_at timestamptz,
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(slug,lang),
 check (status <> 'approved' or (publish_at is not null and approved_at is not null and approved_by is not null))
);
alter table chauffeur.journal_articles enable row level security;
revoke all on chauffeur.journal_articles from public,anon,authenticated;
grant select,insert,update on chauffeur.journal_articles to service_role;
create index if not exists journal_public_idx on chauffeur.journal_articles(lang,publish_at desc) where status='approved';
commit;
