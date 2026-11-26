# CLAUDE.md – Stimmungsbarometer

Anonyme Stimmungsabfrage für Mitarbeitende: Buzzer-Pult (Raspberry Pi + 3 Buttons) vor einem Bildschirm, Auswertung als mandantenfähige Webanwendung. Produkt von Kulturarchitekt (Change-Management). Hintergrund und Entscheidungen: `docs/konzept.md`.

## Sprache und Ton

- Oberfläche, Doku und Commit-Nachrichten auf **Deutsch** (Schweiz: „ss“ statt „ß“ in neuen Texten ist ok, bestehende Texte nicht umschreiben). Nutzer werden gesiezt.
- Texte aus Sicht der Nutzer, kurz und konkret. Fehlermeldungen sagen, was zu tun ist.
- Negatives Feedback nie abwertend darstellen (Sounds, Texte, Farben).

## Aufbau

```
src/                  React 18 + Vite + TypeScript (SPA, react-router)
  lib/api.ts          Alle Datenbankaufrufe (RPC sb_*), Typen
  lib/stats.ts        Auswertungslogik (rein, getestet)
  lib/voteQueue.ts    Offline-Warteschlange des Terminals (rein, getestet)
  lib/sounds.ts       Buzzer-Sounds (Web Audio)
  pages/Terminal.tsx  Kiosk-Seite /terminal (ohne Login, Kopplungscode)
  pages/org/*         Auswertung, Fragen, Terminals, Team
supabase/migrations/  SQL-Migrationen (Schema stimmung + public.sb_*)
supabase/tests/       local_harness.sql (Supabase-Nachbildung) + flow_test.sql
raspi/                buzzer.py (GPIO → Tasten 1/2/3 + Weiter = 4, LED-Welle), install.sh (Kiosk)
hardware/             OpenSCAD-Quelle + STL für das Buzzer-Pult
docs/                 Konzept, Bauanleitung, Bilder, alter Prototyp
```

## Sicherheitsmodell (wichtig)

- Alle Tabellen liegen im Schema `stimmung`, das **nicht** über die Supabase-API freigegeben ist. RLS ist an, ohne Policies.
- Zugriff nur über `public.sb_*`-Funktionen: `security definer`, `set search_path = ''`, voll qualifizierte Namen (`stimmung.…`, `extensions.digest`).
- Jede Verwaltungsfunktion ruft zuerst `stimmung.require(p_org, 'viewer'|'admin')` auf. Plattform-Admins (`stimmung.platform_admins`) gelten überall als Admin.
- Terminal-Funktionen (`sb_terminal_*`) laufen für `anon` und prüfen das Geräte-Geheimnis per SHA-256-Hash (`stimmung.terminal_by_token`).
- Rechte werden am Ende jeder Migration explizit gesetzt: zuerst `revoke all … from public, anon, authenticated`, dann `grant execute` gezielt. Neue Funktionen immer in diese Liste aufnehmen.
- Datenschutz: Stimmen ohne Personenbezug, nur `voted_hour` (stundengenau). Auswertung blendet Gruppen < 5 aus (`MIN_GROUP` in `src/lib/stats.ts`). Nicht aufweichen.

## Geteiltes Supabase-Projekt – Vorsicht

Die Datenbank liegt im Projekt **`wertebarometer`** (`lxuwfwbrlfofafwscojq`), einem anderen, produktiven Produkt.
- Niemals Tabellen, Funktionen, Auth-Einstellungen oder die Site URL des Wertebarometers ändern. Eigene Objekte nur im Schema `stimmung` oder mit Präfix `public.sb_`.
- Auth-Benutzer und E-Mail-Vorlage sind geteilt. Neue Redirect-URLs nur ergänzen.
- Migrationen: neue Datei unter `supabase/migrations/` (Zeitstempel-Präfix), zuerst lokal testen, dann einspielen (Supabase MCP `apply_migration` oder `supabase db push`). Nach DDL die Security-Advisors prüfen; erwartet sind nur „RLS enabled no policy“ und „security definer executable“ für die `sb_*`-Funktionen.

## Befehle

```bash
npm install
npm run dev          # http://localhost:5173 (braucht .env.local, siehe .env.example)
npm test             # vitest
npm run build        # tsc -b && vite build
```

Datenbank lokal testen (Postgres 16):

```bash
sudo -u postgres psql -f supabase/tests/local_harness.sql
sudo -u postgres psql -d sbtest -f supabase/migrations/20261124120000_stimmung_schema.sql
sudo -u postgres psql -d sbtest -f supabase/tests/flow_test.sql   # alle Zeilen "OK …"
```

Bei Schemaänderungen den Flow-Test erweitern, besonders Zugriffssperren (anon, fremde Person, Viewer).

## Deployment

- Vercel-Projekt `stimmungsbarometer` (Team Peakpassion), verknüpft mit diesem Repo. `main` → Produktion (`https://stimmungs-barometer.vercel.app`), jeder Branch/PR → Vorschau (mit Vercel-Login geschützt).
- Umgebungsvariablen: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (öffentlich, im Browser).
- SPA-Rewrites in `vercel.json`.
- Raspi: `raspi/install.sh` öffnet `$APP_URL/terminal`. Bei Domainwechsel dort und in der README anpassen.

## Verhalten, das zusammenpassen muss

- Sperrzeit nach einem Druck: `LOCK_MS = 2800` in `pages/Terminal.tsx` und `LOCK_S = 2.8` in `raspi/buzzer.py`.
- Tastenbelegung: 1/2/3 (auch Ziffernblock, A/S/D, Pfeiltasten) in `Terminal.tsx`; `buzzer.py` sendet KEY_1..KEY_3.
- Server-Rate-Limit: 1 Live-Stimme pro Sekunde und Terminal (`sb_terminal_vote`); nachgereichte Offline-Stimmen tragen `p_at` und sind ausgenommen.
- Weiter-Button (weiss): `buzzer.py` sendet KEY_4 (GPIO 23, LED GPIO 19). Die Web-App soll Taste 4 als „nächste Frage“ verstehen – **noch nicht umgesetzt**, Vorgabe in `docs/konzept.md` → „Weiter-Button“.
- Ein Terminal-Token ist das Geheimnis aus `sb_terminal_pair_start`; nach dem Koppeln wird es zum Zugangsschlüssel. Entkoppeln = `revoked_at` setzen.

## Offene Punkte

Siehe `docs/konzept.md` → „Offene Punkte“.
