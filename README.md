# Stimmungsbarometer

Niederschwellige Stimmungsabfrage für Mitarbeitende: Ein Bildschirm stellt eine Frage, davor stehen drei Buzzer (rot, gelb, grün). Die Antworten landen anonym in der Cloud und lassen sich pro Organisation auswerten.

Ein Projekt von Kulturarchitekt.

## Was die Anwendung kann

| Bereich | Wer | Was |
| --- | --- | --- |
| `/terminal` | Gerät am Bildschirm, ohne Konto | Zeigt einen Kopplungscode, danach die aktive Frage. Buzzer senden die Tasten 1/2/3. Variierende Sounds, Offline-Puffer. |
| `/app` → Auswertung | alle Mitglieder | Antworten, Stimmungsindex, Verlauf pro Tag, Tageszeit, Standorte, CSV-Export |
| `/app` → Fragen | Admins | Fragen anlegen, bearbeiten, aktiv setzen, archivieren |
| `/app` → Terminals | Admins | Terminal per Code koppeln, umbenennen, entkoppeln, Online-Status |
| `/app` → Team | Admins | Personen einladen (Admin oder Lesezugriff), Rollen ändern |
| Organisationen | Plattform-Admins | Neue Kunden-Organisation anlegen |

**Datenschutz:** Stimmen werden ohne Personenbezug und nur auf die Stunde genau gespeichert. Auswahlen mit weniger als 5 Antworten blendet die Auswertung aus.

## Aufbau

- **Frontend:** React + Vite + TypeScript, gehostet auf Vercel (`vercel.json`)
- **Backend:** Supabase (Postgres + Auth per E-Mail-Link)
- Alle Tabellen liegen im Schema `stimmung` und sind **nicht** über die Supabase-API erreichbar. Zugriff nur über Funktionen `public.sb_*` (SECURITY DEFINER), die selbst prüfen, wer aufruft: Mitglied mit Rolle oder Terminal mit geheimem Token.
- Das Schema teilt sich das Supabase-Projekt „wertebarometer“, berührt aber dessen Tabellen nicht.

```
supabase/migrations/   Datenbankschema und Funktionen
supabase/tests/        Ablauf-Test (lokal gegen Postgres)
src/                   Webanwendung
raspi/                 Buzzer-Dienst und Kiosk-Einrichtung für den Raspberry Pi
hardware/              3D-Druckdateien für das Buzzer-Pult (OpenSCAD + STL)
```

## Entwicklung

```bash
cp .env.example .env.local   # Supabase-URL und Publishable Key
npm install
npm run dev                  # http://localhost:5173
npm test                     # Unit-Tests
npm run build
```

Datenbank-Test lokal (Postgres mit Supabase-Nachbildung, siehe `supabase/tests/local_harness.sql`):

```bash
psql -f supabase/tests/local_harness.sql
psql -d sbtest -f supabase/migrations/20261124120000_stimmung_schema.sql
psql -d sbtest -f supabase/tests/flow_test.sql
```

## Einmalige Einrichtung in Supabase

1. **Redirect-URL erlauben:** Supabase-Dashboard → Authentication → URL Configuration → *Redirect URLs* → die Adresse der App mit `/app` hinzufügen, z. B. `https://stimmungsbarometer.vercel.app/app` (und für lokale Entwicklung `http://localhost:5173/app`). Die *Site URL* nicht ändern, sie gehört zum Wertebarometer.
2. **Plattform-Admin:** ist gesetzt (Tabelle `stimmung.platform_admins`). Weitere per SQL:
   `insert into stimmung.platform_admins (user_id) select id from auth.users where email = '…';`

Hinweis: Die E-Mail-Vorlage für den Anmeldelink ist im Supabase-Projekt gemeinsam mit dem Wertebarometer.

## Terminal einrichten (Raspberry Pi)

1. Raspberry Pi OS (64-bit, mit Desktop) installieren, WLAN einrichten.
2. Ordner `raspi/` auf den Pi kopieren, dort `bash install.sh` ausführen, neu starten.
3. Der Bildschirm zeigt einen 6-stelligen Code. In der App unter **Terminals → Terminal koppeln** eingeben.

Ein Benutzerkonto auf dem Terminal ist nicht nötig. Entkoppeln geht jederzeit in der App; das Gerät zeigt dann wieder einen Code. Versteckt am Terminal: linke obere Ecke 3 Sekunden halten öffnet ein Menü (Vollbild, Ton, Entkoppeln).

Bauanleitung für das Buzzer-Pult (Gehäuse, Verdrahtung, LEDs): siehe `hardware/` und die separate Bauanleitung.
