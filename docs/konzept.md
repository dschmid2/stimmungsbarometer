# Stimmungsbarometer – Konzept und Entscheidungen

Stand: 24.11.2026 · Kulturarchitekt (Change-Management, Transformation, Unternehmensentwicklung)

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

Verworfen: fertige programmierbare USB-Buzzer (AliExpress) am Raspi; Prototyp als claude.ai-Artefakt (Terminal brauchte ein claude.ai-Konto). Der Prototyp liegt zum Nachschlagen in [`prototyp/artefakt-prototyp.html`](prototyp/artefakt-prototyp.html); er läuft nur innerhalb von claude.ai.

## Betrieb

| Was | Wo |
| --- | --- |
| Code | https://github.com/dschmid2/stimmungsbarometer |
| Hosting | Vercel, Team „Peakpassion“, Projekt `stimmungsbarometer` |
| Produktion | https://stimmungsbarometer-peakpassion.vercel.app |
| Datenbank | Supabase-Projekt `wertebarometer` (`lxuwfwbrlfofafwscojq`, eu-west-1), Schema `stimmung` |
| Plattform-Admin | ddschmid@gmail.com |

## Offene Punkte

- [ ] Supabase: Redirect-URL `https://stimmungsbarometer-peakpassion.vercel.app/app` eintragen (Site URL nicht ändern, gehört zum Wertebarometer)
- [ ] Anmeldung per E-Mail-Link einmal end-to-end testen
- [ ] Eigener E-Mail-Versand (SMTP) in Supabase; der Standardversand ist stark begrenzt
- [ ] Später eigenes Supabase-Projekt, Standort Zürich (Pro-Plan oder ein Projekt pausieren) – dann Schema per Migration umziehen
- [ ] Lochtest drucken, Durchmesser bestätigen; 5-V- oder 12-V-Buttons entscheiden
- [ ] Eigene Domain (z. B. Subdomain von Kulturarchitekt) statt `*.vercel.app`
- [ ] Datenschutzerklärung und Hinweis am Terminal
