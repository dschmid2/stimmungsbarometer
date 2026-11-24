-- =====================================================================
-- Stimmungsbarometer – Datenbankschema
--
-- Alle Tabellen liegen im eigenen Schema "stimmung" und sind NICHT über die
-- Supabase-API erreichbar. Zugriff gibt es nur über die Funktionen mit der
-- Vorsilbe "sb_" im Schema "public". Jede Funktion prüft selbst, wer sie
-- aufruft (angemeldete Person oder Terminal mit geheimem Token).
--
-- Datenschutz: Stimmen werden ohne Personenbezug und nur auf die Stunde
-- genau gespeichert.
-- =====================================================================

create schema if not exists stimmung;
revoke all on schema stimmung from public;

-- ------------------------------------------------------------- Tabellen
create table stimmung.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  timezone    text not null default 'Europe/Zurich',
  created_at  timestamptz not null default now()
);

create table stimmung.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table stimmung.members (
  org_id      uuid not null references stimmung.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on stimmung.members (user_id);

create table stimmung.invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references stimmung.organizations(id) on delete cascade,
  email       text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role        text not null check (role in ('admin', 'viewer')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);
create index on stimmung.invites (email);

create table stimmung.questions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references stimmung.organizations(id) on delete cascade,
  text        text not null check (length(trim(text)) between 1 and 160),
  labels      text[] not null default array['Nicht gut', 'Geht so', 'Gut']
              check (array_length(labels, 1) = 3),
  active      boolean not null default false,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on stimmung.questions (org_id);
create unique index questions_one_active on stimmung.questions (org_id) where active;

create table stimmung.terminals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references stimmung.organizations(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 60),
  token_hash    bytea not null unique,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  last_vote_at  timestamptz,
  revoked_at    timestamptz
);
create index on stimmung.terminals (org_id);

create table stimmung.pairings (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null check (code ~ '^[0-9]{6}$'),
  secret_hash          bytea not null unique,
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null default now() + interval '15 minutes',
  claimed_terminal_id  uuid references stimmung.terminals(id) on delete cascade
);
create index on stimmung.pairings (code);

create table stimmung.votes (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references stimmung.organizations(id) on delete cascade,
  terminal_id   uuid references stimmung.terminals(id) on delete set null,
  question_id   uuid not null references stimmung.questions(id) on delete cascade,
  value         smallint not null check (value between 0 and 2),
  voted_hour    timestamptz not null   -- nur auf die Stunde genau
);
create index on stimmung.votes (org_id, voted_hour);

-- Verteidigung in der Tiefe: RLS an, keine Policies. Die Tabellen sind ohnehin
-- nicht über die API erreichbar; alle Zugriffe laufen über die Funktionen unten.
alter table stimmung.organizations   enable row level security;
alter table stimmung.platform_admins enable row level security;
alter table stimmung.members         enable row level security;
alter table stimmung.invites         enable row level security;
alter table stimmung.questions       enable row level security;
alter table stimmung.terminals       enable row level security;
alter table stimmung.pairings        enable row level security;
alter table stimmung.votes           enable row level security;

-- ------------------------------------------------------------- Hilfsfunktionen
create or replace function stimmung.hash(p_secret text)
returns bytea language sql immutable set search_path = '' as $$
  select extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256')
$$;

create or replace function stimmung.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from stimmung.platform_admins where user_id = auth.uid())
$$;

-- Rolle der angemeldeten Person in einer Organisation (Plattform-Admins = admin)
create or replace function stimmung.role_in(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when stimmung.is_platform_admin() then 'admin'
    else (select role from stimmung.members where org_id = p_org and user_id = auth.uid())
  end
$$;

create or replace function stimmung.require(p_org uuid, p_min text)
returns void language plpgsql stable security definer set search_path = '' as $$
declare r text := stimmung.role_in(p_org);
begin
  if r is null or (p_min = 'admin' and r <> 'admin') then
    raise exception 'Keine Berechtigung für diese Organisation' using errcode = '42501';
  end if;
end $$;

create or replace function stimmung.terminal_by_token(p_token text)
returns stimmung.terminals language sql stable security definer set search_path = '' as $$
  select t.* from stimmung.terminals t
  where t.token_hash = stimmung.hash(p_token) and t.revoked_at is null
$$;

-- =====================================================================
-- Öffentliche Funktionen: Terminal (ohne Benutzerkonto, mit Geheimnis)
-- =====================================================================

-- Terminal fordert einen Kopplungscode an. Das Geheimnis bleibt im Gerät und
-- wird nach der Kopplung zum Zugangsschlüssel des Terminals.
create or replace function public.sb_terminal_pair_start()
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  v_secret text := encode(extensions.gen_random_bytes(24), 'hex');
  v_code   text;
  v_tries  int := 0;
  v_exp    timestamptz;
begin
  delete from stimmung.pairings where expires_at < now() - interval '1 day';
  if (select count(*) from stimmung.pairings
      where claimed_terminal_id is null and created_at > now() - interval '1 minute') > 30 then
    raise exception 'Zu viele Kopplungsversuche, bitte kurz warten' using errcode = '54000';
  end if;
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from stimmung.pairings
                          where code = v_code and expires_at > now() and claimed_terminal_id is null);
    v_tries := v_tries + 1;
    if v_tries > 20 then raise exception 'Kein freier Code' using errcode = '54000'; end if;
  end loop;
  insert into stimmung.pairings (code, secret_hash) values (v_code, stimmung.hash(v_secret))
  returning expires_at into v_exp;
  return json_build_object('code', v_code, 'secret', v_secret, 'expires_at', v_exp);
end $$;

create or replace function public.sb_terminal_pair_status(p_secret text)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select json_build_object(
       'status', case when p.claimed_terminal_id is not null then 'paired'
                      when p.expires_at < now() then 'expired'
                      else 'pending' end)
     from stimmung.pairings p where p.secret_hash = stimmung.hash(p_secret)),
    json_build_object('status', 'unknown'))
$$;

-- Konfiguration für das Terminal: Organisation, Standort, aktive Frage
create or replace function public.sb_terminal_config(p_token text)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare t stimmung.terminals;
begin
  t := stimmung.terminal_by_token(p_token);
  if t.id is null then return json_build_object('status', 'revoked'); end if;
  update stimmung.terminals set last_seen_at = now()
   where id = t.id and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  return json_build_object(
    'status', 'ok',
    'terminal', json_build_object('id', t.id, 'name', t.name),
    'organization', (select json_build_object('id', o.id, 'name', o.name)
                     from stimmung.organizations o where o.id = t.org_id),
    'question', (select json_build_object('id', q.id, 'text', q.text, 'labels', q.labels)
                 from stimmung.questions q where q.org_id = t.org_id and q.active and not q.archived));
end $$;

-- Eine Stimme abgeben. p_at = Zeitpunkt am Gerät (für nachgeholte Offline-Stimmen).
create or replace function public.sb_terminal_vote(p_token text, p_question uuid, p_value int, p_at timestamptz default null)
returns json language plpgsql volatile security definer set search_path = '' as $$
declare
  t    stimmung.terminals;
  v_at timestamptz := coalesce(p_at, now());
begin
  t := stimmung.terminal_by_token(p_token);
  if t.id is null then return json_build_object('ok', false, 'reason', 'revoked'); end if;
  if p_value not between 0 and 2 then return json_build_object('ok', false, 'reason', 'value'); end if;
  if not exists (select 1 from stimmung.questions where id = p_question and org_id = t.org_id) then
    return json_build_object('ok', false, 'reason', 'question');
  end if;
  -- Zeitpunkt vom Gerät nur übernehmen, wenn plausibel (bis 7 Tage zurück)
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '7 days' then v_at := now(); end if;
  -- Schutz gegen Dauerfeuer: höchstens eine Stimme pro Sekunde und Terminal (Live-Stimmen)
  if p_at is null and t.last_vote_at is not null and t.last_vote_at > now() - interval '1 second' then
    return json_build_object('ok', false, 'reason', 'too_fast');
  end if;
  insert into stimmung.votes (org_id, terminal_id, question_id, value, voted_hour)
  values (t.org_id, t.id, p_question, p_value, date_trunc('hour', v_at));
  update stimmung.terminals set last_vote_at = now(), last_seen_at = now() where id = t.id;
  return json_build_object('ok', true);
end $$;

-- =====================================================================
-- Öffentliche Funktionen: Anmeldung und Verwaltung (angemeldete Personen)
-- =====================================================================

-- Darf sich diese E-Mail anmelden? (eingeladen, Mitglied oder Plattform-Admin)
create or replace function public.sb_can_login(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from stimmung.invites where email = lower(trim(p_email)))
      or exists (select 1 from stimmung.members m join auth.users u on u.id = m.user_id
                 where lower(u.email) = lower(trim(p_email)))
      or exists (select 1 from stimmung.platform_admins a join auth.users u on u.id = a.user_id
                 where lower(u.email) = lower(trim(p_email)))
$$;

-- Wer bin ich, welche Organisationen sehe ich? Nimmt offene Einladungen an.
create or replace function public.sb_me()
returns json language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet' using errcode = '42501'; end if;
  insert into stimmung.members (org_id, user_id, role)
    select i.org_id, auth.uid(), i.role from stimmung.invites i where i.email = v_email
    on conflict (org_id, user_id) do nothing;
  delete from stimmung.invites where email = v_email;
  return json_build_object(
    'email', v_email,
    'is_platform_admin', stimmung.is_platform_admin(),
    'organizations', coalesce((
      select json_agg(json_build_object('id', o.id, 'name', o.name, 'role', stimmung.role_in(o.id)) order by o.name)
      from stimmung.organizations o
      where stimmung.is_platform_admin()
         or exists (select 1 from stimmung.members m where m.org_id = o.id and m.user_id = auth.uid())
    ), '[]'::json));
end $$;

create or replace function public.sb_org_create(p_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not stimmung.is_platform_admin() then
    raise exception 'Nur Plattform-Admins können Organisationen anlegen' using errcode = '42501';
  end if;
  insert into stimmung.organizations (name) values (trim(p_name)) returning id into v_id;
  insert into stimmung.members (org_id, user_id, role) values (v_id, auth.uid(), 'admin');
  insert into stimmung.questions (org_id, text, active)
    values (v_id, 'Wie geht es Ihnen heute bei der Arbeit?', true);
  return v_id;
end $$;

create or replace function public.sb_org_rename(p_org uuid, p_name text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  update stimmung.organizations set name = trim(p_name) where id = p_org;
end $$;

-- ------------------------------------------------------------- Fragen
create or replace function public.sb_questions(p_org uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'viewer');
  return coalesce((
    select json_agg(json_build_object('id', q.id, 'text', q.text, 'labels', q.labels,
                    'active', q.active, 'archived', q.archived, 'created_at', q.created_at,
                    'votes', (select count(*) from stimmung.votes v where v.question_id = q.id))
           order by q.active desc, q.archived, q.created_at desc)
    from stimmung.questions q where q.org_id = p_org), '[]'::json);
end $$;

create or replace function public.sb_question_save(p_org uuid, p_id uuid, p_text text, p_labels text[])
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid := p_id;
begin
  perform stimmung.require(p_org, 'admin');
  if v_id is null then
    insert into stimmung.questions (org_id, text, labels, active)
    values (p_org, trim(p_text), p_labels,
            not exists (select 1 from stimmung.questions where org_id = p_org and active))
    returning id into v_id;
  else
    update stimmung.questions set text = trim(p_text), labels = p_labels
     where id = v_id and org_id = p_org;
  end if;
  return v_id;
end $$;

create or replace function public.sb_question_activate(p_org uuid, p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  if not exists (select 1 from stimmung.questions where id = p_id and org_id = p_org) then
    raise exception 'Frage nicht gefunden' using errcode = 'P0002';
  end if;
  update stimmung.questions set active = false where org_id = p_org and active;
  update stimmung.questions set active = true, archived = false where id = p_id and org_id = p_org;
end $$;

create or replace function public.sb_question_archive(p_org uuid, p_id uuid, p_archived boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  update stimmung.questions set archived = p_archived, active = case when p_archived then false else active end
   where id = p_id and org_id = p_org;
end $$;

-- ------------------------------------------------------------- Terminals
create or replace function public.sb_terminals(p_org uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'viewer');
  return coalesce((
    select json_agg(json_build_object('id', t.id, 'name', t.name, 'created_at', t.created_at,
                    'last_seen_at', t.last_seen_at, 'last_vote_at', t.last_vote_at,
                    'revoked', t.revoked_at is not null) order by t.revoked_at nulls first, t.name)
    from stimmung.terminals t where t.org_id = p_org), '[]'::json);
end $$;

-- Kopplungscode eingeben: macht aus dem wartenden Gerät ein Terminal dieser Organisation
create or replace function public.sb_terminal_claim(p_org uuid, p_code text, p_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  p stimmung.pairings;
  v_id uuid;
begin
  perform stimmung.require(p_org, 'admin');
  select * into p from stimmung.pairings
   where code = trim(p_code) and claimed_terminal_id is null and expires_at > now()
   order by created_at desc limit 1 for update;
  if p.id is null then
    raise exception 'Code unbekannt oder abgelaufen' using errcode = 'P0002';
  end if;
  insert into stimmung.terminals (org_id, name, token_hash)
  values (p_org, trim(p_name), p.secret_hash) returning id into v_id;
  update stimmung.pairings set claimed_terminal_id = v_id where id = p.id;
  return v_id;
end $$;

create or replace function public.sb_terminal_rename(p_org uuid, p_id uuid, p_name text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  update stimmung.terminals set name = trim(p_name) where id = p_id and org_id = p_org;
end $$;

create or replace function public.sb_terminal_revoke(p_org uuid, p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  update stimmung.terminals set revoked_at = now() where id = p_id and org_id = p_org and revoked_at is null;
end $$;

-- ------------------------------------------------------------- Team
create or replace function public.sb_members(p_org uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'viewer');
  return json_build_object(
    'members', coalesce((
      select json_agg(json_build_object('user_id', m.user_id, 'email', u.email, 'role', m.role,
                      'is_me', m.user_id = auth.uid()) order by u.email)
      from stimmung.members m join auth.users u on u.id = m.user_id where m.org_id = p_org), '[]'::json),
    'invites', coalesce((
      select json_agg(json_build_object('id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at)
             order by i.created_at desc)
      from stimmung.invites i where i.org_id = p_org), '[]'::json));
end $$;

create or replace function public.sb_invite(p_org uuid, p_email text, p_role text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(trim(p_email)); v_user uuid;
begin
  perform stimmung.require(p_org, 'admin');
  if p_role not in ('admin', 'viewer') then raise exception 'Unbekannte Rolle' using errcode = '22023'; end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is not null then
    insert into stimmung.members (org_id, user_id, role) values (p_org, v_user, p_role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  else
    insert into stimmung.invites (org_id, email, role, created_by) values (p_org, v_email, p_role, auth.uid())
    on conflict (org_id, email) do update set role = excluded.role;
  end if;
end $$;

create or replace function public.sb_invite_delete(p_org uuid, p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  delete from stimmung.invites where id = p_id and org_id = p_org;
end $$;

create or replace function public.sb_member_set_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  if p_role not in ('admin', 'viewer') then raise exception 'Unbekannte Rolle' using errcode = '22023'; end if;
  if p_role = 'viewer' and (select count(*) from stimmung.members where org_id = p_org and role = 'admin') <= 1
     and exists (select 1 from stimmung.members where org_id = p_org and user_id = p_user and role = 'admin') then
    raise exception 'Mindestens eine Person muss Admin bleiben' using errcode = '23514';
  end if;
  update stimmung.members set role = p_role where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.sb_member_remove(p_org uuid, p_user uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform stimmung.require(p_org, 'admin');
  if (select count(*) from stimmung.members where org_id = p_org and role = 'admin') <= 1
     and exists (select 1 from stimmung.members where org_id = p_org and user_id = p_user and role = 'admin') then
    raise exception 'Mindestens eine Person muss Admin bleiben' using errcode = '23514';
  end if;
  delete from stimmung.members where org_id = p_org and user_id = p_user;
end $$;

-- ------------------------------------------------------------- Auswertung
-- Zählt Stimmen je Tag, Stunde, Terminal und Frage (Ortszeit der Organisation).
create or replace function public.sb_stats(p_org uuid, p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = '' as $$
declare v_tz text;
begin
  perform stimmung.require(p_org, 'viewer');
  select timezone into v_tz from stimmung.organizations where id = p_org;
  return coalesce((
    select json_agg(r) from (
      select (v.voted_hour at time zone v_tz)::date as day,
             extract(hour from v.voted_hour at time zone v_tz)::int as hour,
             v.terminal_id, v.question_id,
             count(*) filter (where v.value = 0) as neg,
             count(*) filter (where v.value = 1) as neu,
             count(*) filter (where v.value = 2) as pos
      from stimmung.votes v
      where v.org_id = p_org
        and v.voted_hour >= (p_from::timestamp at time zone v_tz)
        and v.voted_hour <  ((p_to + 1)::timestamp at time zone v_tz)
      group by 1, 2, 3, 4
      order by 1, 2) r), '[]'::json);
end $$;

-- ------------------------------------------------------------- Rechte
-- Supabase gibt neuen Funktionen in "public" standardmässig Ausführungsrechte.
-- Wir legen sie ausdrücklich fest.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'stimmung')
             and (p.proname like 'sb\_%' or n.nspname = 'stimmung')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.sb_terminal_pair_start()                        to anon, authenticated;
grant execute on function public.sb_terminal_pair_status(text)                   to anon, authenticated;
grant execute on function public.sb_terminal_config(text)                        to anon, authenticated;
grant execute on function public.sb_terminal_vote(text, uuid, int, timestamptz)  to anon, authenticated;
grant execute on function public.sb_can_login(text)                              to anon, authenticated;

grant execute on function public.sb_me()                                         to authenticated;
grant execute on function public.sb_org_create(text)                             to authenticated;
grant execute on function public.sb_org_rename(uuid, text)                       to authenticated;
grant execute on function public.sb_questions(uuid)                              to authenticated;
grant execute on function public.sb_question_save(uuid, uuid, text, text[])      to authenticated;
grant execute on function public.sb_question_activate(uuid, uuid)                to authenticated;
grant execute on function public.sb_question_archive(uuid, uuid, boolean)        to authenticated;
grant execute on function public.sb_terminals(uuid)                              to authenticated;
grant execute on function public.sb_terminal_claim(uuid, text, text)             to authenticated;
grant execute on function public.sb_terminal_rename(uuid, uuid, text)            to authenticated;
grant execute on function public.sb_terminal_revoke(uuid, uuid)                  to authenticated;
grant execute on function public.sb_members(uuid)                                to authenticated;
grant execute on function public.sb_invite(uuid, text, text)                     to authenticated;
grant execute on function public.sb_invite_delete(uuid, uuid)                    to authenticated;
grant execute on function public.sb_member_set_role(uuid, uuid, text)            to authenticated;
grant execute on function public.sb_member_remove(uuid, uuid)                    to authenticated;
grant execute on function public.sb_stats(uuid, date, date)                      to authenticated;
