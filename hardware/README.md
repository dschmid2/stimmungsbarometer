# Hardware – Buzzer-Pult

3D-Druckgehäuse für Raspberry Pi 4 und drei beleuchtete 60-mm-Arcade-Buttons. Vollständige Bauanleitung: [`../docs/bauanleitung.md`](../docs/bauanleitung.md).

| Datei | Inhalt |
| --- | --- |
| `buzzerpult.scad` | Parametrische Quelle (OpenSCAD). Alle Masse oben in der Datei. |
| `Buzzerpult_Oberteil.stl` | Pultdeckel mit Wänden, bereits zum Drucken ausgerichtet (Pultfläche nach unten) |
| `Buzzerpult_Boden.stl` | Bodenplatte mit Pi-Abstandshaltern, Zentrierrand, Lüftung, Mulden für Gummifüsse |
| `Buzzerpult_Lochtest.stl` | Testplatte mit Löchern 24/25/26/28/30 mm, um den Button-Durchmesser zu prüfen |

## Wichtigste Parameter (`buzzerpult.scad`)

| Name | Standard | Bedeutung |
| --- | --- | --- |
| `W`, `D` | 240, 150 | Breite und Tiefe in mm |
| `Hf`, `Hr` | 55, 82 | Höhe vorn und hinten (Oberkante) |
| `btn_hole` | 24.5 | Montageloch der Buttons – mit dem Lochtest prüfen |
| `btn_pitch` | 75 | Abstand der Button-Mitten |
| `btn_y` | 55 | Lage der Buttons von vorn |
| `btn_below` | 52.5 | Bautiefe der Buttons unter der Platte (für die Kollisionsprüfung) |
| `pi_*` | Pi 4 | Lage der Anschlüsse; Pi um 180° gedreht, USB-C/HDMI nach hinten |

Geometrie-Annahmen: Unter den Buttons bleibt ein Freiraum von Ø 40 mm × 52,5 mm. Er kollidiert weder mit dem Pi noch mit Wänden oder Schraubsäulen (geprüft mit einer Schnittmenge in OpenSCAD).

## Neu exportieren

```bash
openscad -o out/shell.stl -D 'part="shell"' buzzerpult.scad
openscad -o out/base.stl  -D 'part="base"'  buzzerpult.scad
openscad -o out/test.stl  -D 'part="test"'  buzzerpult.scad
openscad -o out/assembly.png --imgsize=1400,1000 --viewall --autocenter -D 'part="assembly"' buzzerpult.scad
```

Hinweis: `part="shell"` exportiert das Oberteil in Einbaulage. Die Datei `Buzzerpult_Oberteil.stl` im Repository ist zusätzlich um `180° − Neigung` um die X-Achse gedreht und auf z = 0 gesetzt, damit sie ohne Stützen druckt. Das geht auch mit `-D 'print_orient=true'` und anschliessendem „Auf Fläche legen“ im Slicer.
