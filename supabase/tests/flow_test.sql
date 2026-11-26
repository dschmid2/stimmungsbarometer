-- Ablauf-Test für das Stimmungsbarometer (lokal gegen eine Supabase-ähnliche DB)
-- Erwartet: jede Prüfung meldet "OK". Ein Fehler bricht ab.
\set ON_ERROR_STOP 1
begin;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1','chef@kulturarchitekt.test'),
                              ('00000000-0000-0000-0000-0000000000b2','hr@kunde.test'),
                              ('00000000-0000-0000-0000-0000000000c3','fremd@andere.test');
insert into stimmung.platform_admins values ('00000000-0000-0000-0000-0000000000a1');

create temp table ctx (k text primary key, v text);
grant all on ctx to anon, authenticated;

-- Plattform-Admin legt Organisation an und lädt HR ein
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","email":"chef@kulturarchitekt.test"}', true);
insert into ctx select 'org', public.sb_org_create('Muster AG');
select public.sb_invite((select v::uuid from ctx where k='org'), 'HR@Kunde.test', 'admin');
select public.sb_invite((select v::uuid from ctx where k='org'), 'neu@kunde.test', 'viewer');
do $$ begin assert (public.sb_can_login('neu@kunde.test')), 'eingeladene Person darf sich anmelden'; 
            assert not public.sb_can_login('fremd@andere.test'), 'fremde Person darf nicht'; raise notice 'OK Einladung/Login-Prüfung'; end $$;

-- HR sieht die Organisation
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","email":"hr@kunde.test"}', true);
do $$ declare me json := public.sb_me(); begin
  assert json_array_length(me->'organizations') = 1, 'HR sieht 1 Organisation';
  assert me->'organizations'->0->>'role' = 'admin', 'HR ist admin'; raise notice 'OK sb_me'; end $$;

-- Terminal startet Kopplung (ohne Konto)
set local role anon;
select set_config('request.jwt.claims','{}', true);
insert into ctx select 'pair', public.sb_terminal_pair_start()::text;
do $$ declare p json := (select v::json from ctx where k='pair'); begin
  assert public.sb_terminal_pair_status(p->>'secret')->>'status' = 'pending', 'pending';
  assert public.sb_terminal_config(p->>'secret')->>'status' = 'revoked', 'vor Kopplung kein Zugang';
  raise notice 'OK Kopplung gestartet, Code %', p->>'code'; end $$;
-- anon darf nicht koppeln
do $$ begin
  begin perform public.sb_terminal_claim((select v::uuid from ctx where k='org'), (select v::json->>'code' from ctx where k='pair'), 'Hack');
        raise exception 'FEHLER: anon konnte koppeln';
  exception when insufficient_privilege then raise notice 'OK anon darf nicht koppeln'; end; end $$;

-- HR gibt den Code ein
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","email":"hr@kunde.test"}', true);
select public.sb_terminal_claim((select v::uuid from ctx where k='org'), (select v::json->>'code' from ctx where k='pair'), 'Kantine');

-- Terminal holt Konfiguration und stimmt ab
set local role anon;
select set_config('request.jwt.claims','{}', true);
do $$ declare s text := (select v::json->>'secret' from ctx where k='pair'); c json; r json; begin
  assert public.sb_terminal_pair_status(s)->>'status' = 'paired', 'paired';
  c := public.sb_terminal_config(s);
  assert c->>'status' = 'ok' and c->'terminal'->>'name' = 'Kantine', 'config ok';
  r := public.sb_terminal_vote(s, (c->'question'->>'id')::uuid, 2);
  assert (r->>'ok')::boolean, 'Stimme 1';
  r := public.sb_terminal_vote(s, (c->'question'->>'id')::uuid, 0);
  assert r->>'reason' = 'too_fast', 'Dauerfeuer blockiert';
  r := public.sb_terminal_vote(s, (c->'question'->>'id')::uuid, 1, now() - interval '2 hours');
  assert (r->>'ok')::boolean, 'Offline-Stimme nachgeholt';
  r := public.sb_terminal_vote(s, (c->'question'->>'id')::uuid, 7);
  assert r->>'reason' = 'value', 'ungültiger Wert';
  r := public.sb_terminal_vote('falsch', (c->'question'->>'id')::uuid, 1);
  assert r->>'reason' = 'revoked', 'falsches Token';
  raise notice 'OK Terminal stimmt ab'; end $$;
-- anon darf keine Tabellen lesen
do $$ begin
  begin perform count(*) from stimmung.votes; raise exception 'FEHLER: anon liest Tabellen';
  exception when insufficient_privilege then raise notice 'OK Tabellen gesperrt'; end; end $$;
-- anon darf keine Verwaltungsfunktion
do $$ begin
  begin perform public.sb_stats((select v::uuid from ctx where k='org'), current_date - 7, current_date);
        raise exception 'FEHLER: anon sieht Statistik';
  exception when insufficient_privilege then raise notice 'OK Statistik für anon gesperrt'; end; end $$;

-- Fremde Person sieht nichts
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000c3","email":"fremd@andere.test"}', true);
do $$ begin
  assert json_array_length(public.sb_me()->'organizations') = 0, 'fremd sieht keine Org';
  begin perform public.sb_stats((select v::uuid from ctx where k='org'), current_date - 7, current_date);
        raise exception 'FEHLER: fremde Person sieht Statistik';
  exception when insufficient_privilege then raise notice 'OK fremde Person ausgesperrt'; end; end $$;

-- HR sieht Statistik, Fragen, Terminals; widerruft Terminal
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b2","email":"hr@kunde.test"}', true);
do $$ declare st json; org uuid := (select v::uuid from ctx where k='org'); q uuid; t uuid; begin
  st := public.sb_stats(org, current_date - 7, current_date);
  assert (select sum((e->>'neg')::int + (e->>'neu')::int + (e->>'pos')::int) from json_array_elements(st) e) = 2, '2 Stimmen gezählt';
  q := public.sb_question_save(org, null, 'Wie gut fühlen Sie sich informiert?', array['Nein','Teilweise','Ja']);
  perform public.sb_question_activate(org, q);
  assert (select count(*) from json_array_elements(public.sb_questions(org)) e where (e->>'active')::boolean) = 1, 'genau eine aktive Frage';
  t := (public.sb_terminals(org)->0->>'id')::uuid;
  perform public.sb_terminal_revoke(org, t);
  raise notice 'OK Auswertung, Fragen, Widerruf'; end $$;
set local role anon;
select set_config('request.jwt.claims','{}', true);
do $$ begin assert public.sb_terminal_config((select v::json->>'secret' from ctx where k='pair'))->>'status' = 'revoked', 'widerrufen';
  raise notice 'OK widerrufenes Terminal ausgesperrt'; end $$;

-- Viewer darf nichts ändern
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","email":"chef@kulturarchitekt.test"}', true);
do $$ begin
  perform public.sb_member_set_role((select v::uuid from ctx where k='org'), '00000000-0000-0000-0000-0000000000a1', 'viewer');
  raise notice 'OK Rollenwechsel'; end $$;
do $$ begin
  begin perform public.sb_member_remove((select v::uuid from ctx where k='org'), '00000000-0000-0000-0000-0000000000b2');
        raise exception 'FEHLER: letzter Admin entfernt';
  exception when check_violation then raise notice 'OK letzter Admin geschützt'; end; end $$;
rollback;
