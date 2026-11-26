-- Lokale Nachbildung der Supabase-Umgebung für Tests (Rollen anon/authenticated, auth.uid(), pgcrypto)
-- Aufruf: sudo -u postgres psql -f supabase/tests/local_harness.sql   (legt die Datenbank sbtest neu an)
drop database if exists sbtest; create database sbtest;
\c sbtest
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth; create schema extensions;
create extension pgcrypto schema extensions;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
-- Supabase-ähnliche Standardrechte
alter default privileges in schema public grant execute on functions to anon, authenticated;
