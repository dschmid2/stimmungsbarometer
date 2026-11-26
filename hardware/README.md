# Hardware – Buzzer-Pult

3D-Druckgehäuse für Raspberry Pi 3 (B/B+, wahlweise Pi 4), drei beleuchtete 60-mm-Arcade-Buttons und einen weissen 44-mm-Weiter-Button, alle mit 24-mm-Bohrung. Vollständige Bauanleitung: [`../docs/bauanleitung.md`](../docs/bauanleitung.md).

| Datei | Inhalt |
| --- | --- |
| `buzzerpult.scad` | Parametrische Quelle (OpenSCAD). Alle Masse oben in der Datei. |
| `Buzzerpult_Oberteil.stl` | Pultdeckel mit Wänden, bereits zum Drucken ausgerichtet (Pultfläche nach unten) |
| `Buzzerpult_Boden.stl` | Bodenplatte mit werkzeugloser Pi-Halterung (4 Zentrierstifte, 4 Schnapphaken), Zentrierrand, Lüftung, Mulden für Gummifüsse |
| `Buzzerpult_Lochtest.stl` | Testplatte mit Löchern 23,8/24,0/24,3/24,6/25,0 mm, um die Zugabe für die 24-mm-Bohrung zu prüfen |

## Wichtigste Parameter (`buzzerpult.scad`)

| Name | Standard | Bedeutung |
| --- | --- | --- |
| `W`, `D` | 290, 150 | Breite und Tiefe in mm |
| `Hf`, `Hr` | 55, 82 | Höhe vorn und hinten (Oberkante) |
| `btn_hole_nom` | 24 | Bohrung laut Button-Hersteller |
| `hole_clr` | 0.3 | Zugabe, weil gedruckte Löcher kleiner werden – mit dem Lochtest prüfen |
| `btn_pitch` | 75 | Abstand der Button-Mitten |
| `btn_y` | 55 | Lage der Buttons von vorn |
| `btn_below` | 52.5 | Bautiefe der Buttons unter der Platte (für die Kollisionsprüfung) |
| `next_on` | true | Weiter-Button (weiss, 44 mm) ein- oder ausschalten |
| `btn_left` | 45 | Mitte des roten Buttons ab linker Aussenkante; die Farbreihe hängt nicht mehr von `W` ab |
| `next_x`, `next_y` | 254, 34 | Weiter-Button rechts neben Grün, 21 mm zum Benutzer hin versetzt; Kappenlücke 10,7 mm |
| `uln_box` | – | Platz für die ULN2003-Platine; nur für die Kollisionsprüfung |
| `pi_model` | 3 | 3 = Raspberry Pi 3 B/B+ (Micro-USB + HDMI), 4 = Raspberry Pi 4 (USB-C + 2 × Micro-HDMI). Steuert das Fenster in der Rückwand. |
| `pi_so` | 8 | Höhe der Pi-Auflagen; bestimmt auch die Federlänge der Haken |
| `pin_d`, `pin_h` | 2.4, 2.5 | Zentrierstifte durch die Montagelöcher (Ø 2,75 im Pi) |
| `clip_t`, `clip_lip` | 1.6, 1.0 | Stärke des federnden Stegs und Überstand der Nase; dünner = leichter einzurasten |
| `pi_clips` | 2 × vorne, 2 × innen | Lage der Haken; innen ausserhalb der SD-Karte (v 22–34) |

Geometrie-Annahmen: Unter den Buttons bleibt ein Freiraum von Ø 40 mm × 52,5 mm. Er kollidiert weder mit dem Pi, den Haken noch mit Wänden oder Schraubsäulen. Dasselbe gilt für den Weiter-Button (Freiraum Ø 36 mm) und den Platz der Treiberplatine; zwischen Weiss und Grün bleiben 10,7 mm, unter dem Weiter-Schalter 3,5 mm zum Boden (bei 52,5 mm Bautiefe). Geprüft mit Schnittmengen in OpenSCAD: Pi ↔ Oberteil frei, Pi ↔ Boden nur die Stifte in den Montagelöchern, Haken-Nasen 0,15 mm und Niederhalter-Nase 0,3 mm über der Platine.

**Pi-Halterung ohne Schrauben:** Der Pi sitzt auf vier Auflagen (8 mm) mit Zentrierstiften. Zwei Haken greifen an der GPIO-Kante, zwei an der kurzen Kante ohne Buchsen (neben der SD-Karte). An der Rückwand des Oberteils sitzt eine Nase (`pi_holddown`), die beim Schliessen die Anschlusskante niederhält. Die Bodenplatte in PETG drucken, damit die Haken federn statt brechen.

## Neu exportieren

```bash
openscad -o out/shell.stl -D 'part="shell"' buzzerpult.scad
openscad -o out/base.stl  -D 'part="base"'  buzzerpult.scad
openscad -o out/test.stl  -D 'part="test"'  buzzerpult.scad
openscad -o out/assembly.png --imgsize=1400,1000 --viewall --autocenter -D 'part="assembly"' buzzerpult.scad
```

Hinweis: `part="shell"` exportiert das Oberteil in Einbaulage. Die Datei `Buzzerpult_Oberteil.stl` im Repository ist zusätzlich um `180° − Neigung` um die X-Achse gedreht und auf z = 0 gesetzt, damit sie ohne Stützen druckt. Das geht auch mit `-D 'print_orient=true'` und anschliessendem „Auf Fläche legen“ im Slicer.
