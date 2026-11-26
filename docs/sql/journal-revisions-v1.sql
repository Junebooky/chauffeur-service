-- Reviewed additive rollout script; do not apply automatically.
-- Existing production schema: chauffeur.journal_articles is RLS-enabled and
-- only the server role can read/write it. Abort if client access exists.
begin;
do $$
begin
 if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='chauffeur' and c.relname='journal_articles' and c.relrowsecurity) then
  raise exception 'Journal RLS must already be enabled';
 end if;
 if has_table_privilege('anon','chauffeur.journal_articles','SELECT,INSERT,UPDATE,DELETE')
 or has_table_privilege('authenticated','chauffeur.journal_articles','SELECT,INSERT,UPDATE,DELETE')
 or has_any_column_privilege('anon','chauffeur.journal_articles','SELECT,INSERT,UPDATE,REFERENCES')
 or has_any_column_privilege('authenticated','chauffeur.journal_articles','SELECT,INSERT,UPDATE,REFERENCES') then
  raise exception 'Unexpected client grants: review before rollout';
 end if;
end $$;
alter table chauffeur.journal_articles
 add column revision_draft jsonb,
 add column revision_token uuid,
 add constraint journal_revision_pair_check check (
  (revision_draft is null and revision_token is null) or
  (status='approved' and revision_draft is not null and revision_token is not null and jsonb_typeof(revision_draft)='object')
 );
commit;
-- Public fields remain unchanged until the owner approves a saved revision.
-- No new public grants, policies, triggers, or security definer functions.
