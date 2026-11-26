# Stimmungsbarometer – Konzept und Entscheidungen

Stand: 26.11.2026 · Kulturarchitekt (Change-Management, Transformation, Unternehmensentwicklung)

## Idee

Niederschwellige Stimmungsabfrage unter Mitarbeitenden, ähnlich den Smiley-Terminals am öffentlichen WC: Ein Bildschirm stellt eine Frage, davor stehen drei Buzzer (rot / gelb / grün). Ein Druck genügt, anonym. Die Auswertung läuft in der Cloud, getrennt pro Kunden-Organisation. Ziel ist ein eigenes Angebot unter der Marke Kulturarchitekt.

## Abgrenzung zu fertigen Produkten

Es gibt fertige Smiley-Terminals mit Auswertung, unter anderem HappyOrNot (Finnland, auch für Mitarbeiterfeedback), feedbacknow und SayWay. Diese arbeiten mit Abo und Einrichtungsgebühr. Das Stimmungsbarometer ist die eigene Lösung: günstige Hardware, eigene Auswertung, Fragen aus der Change-Begleitung, keine laufenden Lizenzkosten.

## Grundsätze aus dem Change-Management

- **Die Frage ist wichtiger als das Gerät.** Fragen alle 2–4 Wochen wechseln, sonst wird aus Gewohnheit gedrückt.
- **Anonymität ernst nehmen.** Stimmen ohne Personenbezug, nur stundengenau gespeichert. Auswahlen mit weniger als 5 Antworten werden ausgeblendet.
- **Negatives Feedback nicht bestrafen.** Der rote Buzzer klingt komisch und mitfühlend, nie wie ein „Verloren“-Signal.
- **Mitbestimmung früh klären.** In Deutschland ist eine solche Einrichtung oft mitbestimmungspflichtig (Betriebsrat); in der Schweiz die Mitarbeitervertretung einbeziehen. Früh einbinden schafft Vertrauen. (Keine Rechtsberatung.)
- **Ergebnisse zurückspiegeln.** Die Leute drücken nur weiter, wenn sie sehen, was mit den Antworten passiert.

## Entscheidungen

| Datum | Entscheidung |
| --- | --- |
| 18.11.2026 | Eigene Lösung statt fertigem Produkt; drei Antworten (negativ / neutral / positiv) |
| 18.11.2026 | Hardware-Buzzer vor dem Bildschirm statt Touch; Buzzer senden Tasten 1/2/3 |
| 18.11.2026 | Sounds im Browser erzeugt, variieren bei jedem Druck; Richtung zeigt die Kategorie (positiv steigt, neutral bleibt, negativ fällt freundlich) |
| 20.11.2026 | Buzzer-Pult mit Raspberry Pi 4, 3D-Druck, 60-mm-Buttons mit LED, Strom nur über den Pi |
| 20.11.2026 | LED-Ruhezustand: abwechselnd pulsierende Welle rot → gelb → grün |
| 22.11.2026 | 12-V-Buttons sind möglich über Step-up-Wandler, weiterhin nur das Pi-Netzteil |
| 24.11.2026 | Eigene Webanwendung: mandantenfähig (mehrere Kunden), Vercel + Supabase, Terminals per Kopplungscode |
| 24.11.2026 | Datenbank vorerst im Supabase-Projekt „wertebarometer“ (Gratisplan: max. 2 Projekte), eigenes Schema `stimmung` |
| 24.11.2026 | Weiterentwicklung in Claude Code über dieses Repository |
| 24.11.2026 | Produktionsadresse `stimmungs-barometer.vercel.app` (`stimmungsbarometer.vercel.app` ist vergeben) |
| 25.11.2026 | Raspberry Pi 3 statt Pi 4; Button-Bohrung 24 mm; Pi ohne Schrauben (Stifte + Schnapphaken + Niederhalter am Oberteil) |
| 26.11.2026 | Nach einer Stimme springt das Terminal automatisch zur nächsten Frage; Weiter dient nur zum Überspringen |
| 26.11.2026 | Vierter Button: weisser 44-mm-„Weiter“-Button (Bohrung 24 mm) hinten rechts, um zur nächsten Frage zu wechseln. Gehäuse bleibt 240 mm breit. Hardware und Raspi-Dienst fertig (Taste 4), Web-App offen |

Verworfen: fertige programmierbare USB-Buzzer (AliExpress) am Raspi; Prototyp als claude.ai-Artefakt (Terminal brauchte ein claude.ai-Konto). Der Prototyp liegt zum Nachschlagen in [`prototyp/artefakt-prototyp.html`](prototyp/artefakt-prototyp.html); er läuft nur innerhalb von claude.ai.

## Weiter-Button: Vorgabe für die Web-App (offen)

**Stand:** Gehäuse, Verdrahtung und `raspi/buzzer.py` sind fertig. Der weisse Button sendet die Taste **4** (GPIO 23, LED über ULN2003 IN4 / GPIO 19). Die Web-App reagiert darauf noch nicht.

**Ziel:** Am Terminal kann man zur nächsten Frage wechseln. Damit kann eine Organisation mehrere Fragen gleichzeitig stellen.

**Vorschlag zur Umsetzung**

1. **Datenmodell** (neue Migration, Schema `stimmung`):
   - Statt genau einer aktiven Frage gibt es eine geordnete Fragenrunde: Spalte `position int` (null = nicht in der Runde). Index `questions_one_active` entfernen; `active` kann wegfallen oder aus `position is not null` abgeleitet werden.
   - Neue Funktion `sb_question_order(p_org uuid, p_ids uuid[])` (nur Admin) setzt Reihenfolge und Auswahl.
   - `sb_terminal_config` liefert zusätzlich `questions: [...]` in Reihenfolge. `question` bleibt als erste Frage erhalten, damit ältere Terminals weiterlaufen.
2. **Terminal** (`src/pages/Terminal.tsx`):
   - **Nach einer Stimme** springt das Terminal automatisch zur nächsten Frage, sobald „Danke!“ vorbei ist (nach `LOCK_MS`). Nach der letzten Frage geht es wieder zur ersten.
   - **Weiter** (Taste 4, auch `N` und `Enter`) überspringt die aktuelle Frage ohne Stimme; nach der letzten wieder die erste.
   - Anzeige „Frage 2 von 3“ und oben rechts ein dezenter Hinweis „Weiter: weisser Button“. Bei nur einer Frage beides ausblenden, Taste 4 ohne Wirkung.
   - Eigener, neutraler Sound (z. B. kurzes „Umblättern“), klar verschieden von den Antwort-Sounds.
   - Nach einer Zeit ohne Druck zurück zur ersten Frage.
   - Während „Danke!“ angezeigt wird, ist Weiter gesperrt (wie im Raspi-Dienst).
3. **Datenschutz:** Weiter zählt nicht als Stimme und wird nicht gespeichert (keine Verweildauer, kein Überspringen-Zähler).
4. **Verwaltung** (`src/pages/org/Questions.tsx`): mehrere Fragen in die Runde nehmen, Reihenfolge mit Hoch/Runter ändern.
5. **Tests:** Flow-Test um Reihenfolge und Zugriffssperren erweitern; die Navigation als reine Funktion (z. B. `nextIndex`) mit Unit-Test.

**Entschieden (26.11.2026):** Mit dem Abstimmen springt das Terminal zur nächsten Frage. Weiter ist nur zum Überspringen.

**Noch zu entscheiden**

- Nach wie vielen Sekunden ohne Druck geht es zurück zur ersten Frage? Vorschlag: 60 s; bis zur Entscheidung so umsetzen und als Konstante (`IDLE_RESET_MS`) in `Terminal.tsx` führen.

## Betrieb

| Was | Wo |
| --- | --- |
| Code | https://github.com/dschmid2/stimmungsbarometer |
| Hosting | Vercel, Team „Peakpassion“, Projekt `stimmungsbarometer` |
| Produktion | https://stimmungs-barometer.vercel.app |
| Datenbank | Supabase-Projekt `wertebarometer` (`lxuwfwbrlfofafwscojq`, eu-west-1), Schema `stimmung` |
| Plattform-Admin | ddschmid@gmail.com |

## Offene Punkte

- [ ] Supabase: Redirect-URL `https://stimmungs-barometer.vercel.app/app` eintragen (Site URL nicht ändern, gehört zum Wertebarometer)
- [ ] Anmeldung per E-Mail-Link einmal end-to-end testen
- [ ] Eigener E-Mail-Versand (SMTP) in Supabase; der Standardversand ist stark begrenzt
- [ ] Später eigenes Supabase-Projekt, Standort Zürich (Pro-Plan oder ein Projekt pausieren) – dann Schema per Migration umziehen
- [ ] Lochtest drucken, Zugabe für die 24-mm-Bohrung bestätigen; 5-V- oder 12-V-Buttons entscheiden
- [ ] Probedruck der Bodenplatte: Einrasten der Haken mit dem echten Pi 3 prüfen
- [ ] Weiter-Button in der Web-App umsetzen (siehe oben)
- [ ] Eigene Domain (z. B. Subdomain von Kulturarchitekt) statt `*.vercel.app`
- [ ] Datenschutzerklärung und Hinweis am Terminal
