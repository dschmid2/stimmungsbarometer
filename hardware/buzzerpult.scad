// =====================================================================
//  Buzzer-Pult für das Stimmungsbarometer
//  Raspberry Pi 4 + 3 beleuchtete Arcade-Buttons 60 mm
//  Parametrisch, OpenSCAD 2021+. Alle Maße in mm.
//
//  Koordinaten: X = Breite (links→rechts, von vorn gesehen),
//               Y = Tiefe (0 = Vorderkante, D = Rückseite zum Monitor),
//               Z = Höhe (0 = Tischfläche).
//
//  Teile:  part = "shell"  -> Oberteil (Pultdeckel mit Wänden)
//          part = "base"   -> Bodenplatte mit Pi-Halterung
//          part = "test"   -> Lochtest für den Button-Durchmesser
//          part = "assembly" -> Zusammenbau-Ansicht (nicht drucken)
//  print_orient = true legt das Oberteil mit der Pultfläche aufs Druckbett.
// =====================================================================

part         = "assembly";
print_orient = false;

// ---------- Hauptmaße ----------
W   = 240;     // Breite
D   = 150;     // Tiefe
Hf  = 55;      // Höhe vorn (Oberkante)
Hr  = 82;      // Höhe hinten (Oberkante)
t   = 2.5;     // Wandstärke
tt  = 3.0;     // Stärke der Pultfläche (Button-Mutter muss greifen)
bt  = 3.0;     // Stärke der Bodenplatte
rc  = 6;       // Eckradius (senkrechte Kanten)

// ---------- Buttons ----------
btn_hole_nom = 24;   // Bohrung laut Button-Hersteller
hole_clr   = 0.3;    // Zugabe: gedruckte Löcher werden etwas kleiner (mit Lochtest prüfen)
btn_hole   = btn_hole_nom + hole_clr;
btn_pitch  = 75;     // Abstand der Button-Mitten
btn_y      = 55;     // Lage der Buttons in der Tiefe (von vorn, auf der Pultfläche)
btn_cap    = 60;     // Kappendurchmesser (nur Darstellung)
btn_below  = 52.5;   // Bautiefe unter der Platte inkl. Mikroschalter
btn_env_d  = 40;     // Freiraum-Durchmesser unter der Platte (Schalter + LED-Fassung)

// ---------- Weiter-Button (weiss, kleiner, abgesetzt hinten rechts) ----------
next_on    = true;   // false = Gehäuse ohne Weiter-Button
next_cap   = 44;     // Kappendurchmesser
next_hole  = btn_hole; // gleiche 24-mm-Bohrung wie die Farbbuttons
next_x     = W/2 + btn_pitch;  // hinter dem grünen Button
next_y     = 118;    // Lage in der Tiefe (Kappen-Abstand zu den Farbbuttons ca. 11 mm)
next_below = 52.5;   // Bautiefe unter der Platte (vorsichtig wie bei den grossen Buttons)
next_env_d = 36;     // Freiraum-Durchmesser unter der Platte

// Platz für die ULN2003-Treiberplatine (nur zur Kollisionsprüfung, wird nicht gedruckt)
uln_box    = [[110, 100, 3], [52, 38, 18]];   // [Ecke x,y,z], [Grösse]

// ---------- Raspberry Pi ----------
pi_model   = 3;      // 3 = Raspberry Pi 3 B/B+ (Standard), 4 = Raspberry Pi 4
pi_L = 85;  pi_W = 56;  pi_T = 1.4;
pi_so      = 8;      // Höhe der Auflagen; hoch genug, damit die Schnapphaken federn können
pi_gap     = 1.5;    // Abstand Platinenkante – Innenseite Rückwand
pi_holes   = [[3.5,3.5],[61.5,3.5],[3.5,52.5],[61.5,52.5]];   // (u,v), v=0 Anschlusskante; gleich bei Pi 3 und 4
// Werkzeuglose Halterung: Zentrierstifte durch die Montagelöcher (Ø 2,75 im Pi) + Schnapphaken
pin_d      = 2.4;    // Stift-Durchmesser
pin_h      = 2.5;    // Stift-Länge über der Auflage
clip_w     = 6;      // Breite eines Hakens
clip_t     = 1.6;    // Stärke des federnden Stegs (dünner = leichter einzurasten)
clip_gap   = 0.2;    // Luft zwischen Steg und Platinenkante
clip_lip   = 1.0;    // so weit greift die Nase über die Platine
// Hakenpositionen: [Kante, Position entlang der Kante]
//   "front" = Kante mit der GPIO-Leiste (v = 56), Position in u
//   "inner" = kurze Kante ohne Buchsen (u = 0, SD-Karten-Seite), Position in v (SD-Karte liegt bei v 22–34)
pi_clips   = [["front", 3], ["front", 72], ["inner", 10], ["inner", 46]];
// Niederhalter am Oberteil: Nase an der Rückwand über der Platinenkante, zwischen Klinke und LAN-Buchse
pi_hold_u  = [58.5, 63.5];
// Anschlüsse an der Rückseite (u = Abstand ab Platinenecke)
pi_power_u = pi_model == 3 ? 10.6 : 11.2;            // Pi 3: Micro-USB, Pi 4: USB-C
pi_hdmi_u  = pi_model == 3 ? [32.0] : [26.0, 39.5];  // Pi 3: HDMI, Pi 4: 2 × Micro-HDMI
pi_audio_u = 53.5;
// Fenster in der Rückwand: muss die Stecker-Ummantelungen durchlassen
win_u      = pi_model == 3 ? [3.5, 44.0] : [3.7, 47.0];   // Bereich in u
win_z      = pi_model == 3 ? [-4.0, 14.0] : [-3.5, 10.5]; // Unterkante relativ zur Platinenoberseite, Höhe

// ---------- Verschraubung ----------
boss_d     = 9;
boss_pilot = 2.6;    // für M3-Kunststoffschrauben (z. B. 3×12) – für Gewindeeinsätze M3: 4.0
boss_depth = 14;
bosses = [[6.5,6.5],[W-6.5,6.5],[W-6.5,D-6.5],[104,D-6.5],[6.5,80]];

// ---------- abgeleitet ----------
a      = atan((Hr-Hf)/D);           // Neigung der Pultfläche
function ztop(y) = Hf + (Hr-Hf)*y/D;
board_z0 = bt + pi_so;               // Unterseite Platine
board_z1 = board_z0 + pi_T;          // Oberseite Platine
function pix(u) = t + 3 + (pi_L - u);     // Pi um 180° gedreht: Anschlüsse nach hinten, USB/LAN nach links
function piy(v) = D - t - pi_gap - v;
btn_x = [W/2 - btn_pitch, W/2, W/2 + btn_pitch];

$fn = 64;

// =====================================================================
module rrect(w, d, r) {
  offset(r) offset(-r) square([w, d]);
}

module side_profile(y0, y1, zb, inset) {
  // Querschnitt in der YZ-Ebene: unten zb, oben Pultfläche minus inset (senkrecht gemessen)
  dz = inset / cos(a);
  polygon([[y0, zb], [y1, zb], [y1, ztop(y1) - dz], [y0, ztop(y0) - dz]]);
}

module prism(x0, x1, y0, y1, zb, inset) {
  translate([x0, 0, 0]) rotate([90, 0, 90])
    linear_extrude(x1 - x0) side_profile(y0, y1, zb, inset);
}

module outer_solid() {
  intersection() {
    prism(0, W, 0, D, bt, 0);
    linear_extrude(Hr + 10) rrect(W, D, rc);
  }
}

module inner_void() {
  intersection() {
    prism(t, W - t, t, D - t, bt - 1, tt);
    translate([t, t, -1]) linear_extrude(Hr + 10) rrect(W - 2*t, D - 2*t, rc - t);
  }
}

module btn_axis(i) {
  translate([btn_x[i], btn_y, ztop(btn_y)]) rotate([a, 0, 0]) children();
}

module next_axis() {
  translate([next_x, next_y, ztop(next_y)]) rotate([a, 0, 0]) children();
}

module bosses_solid() {
  for (p = bosses) translate([p[0], p[1], bt]) cylinder(d = boss_d, h = Hr);
}

module rslot(len, w) { hull() { circle(d = w); translate([len, 0]) circle(d = w); } }

// Niederhalter: kleine Nase an der Rückwand, liegt nach dem Zusammenbau 0,3 mm über der
// Platinenkante und verhindert, dass die Rückseite des Pi beim Einstecken der Kabel abhebt.
// Unterseite mit 45°-Schräge zur Wand, damit sie ohne Stützen druckt.
module pi_holddown() {
  x0 = pix(pi_hold_u[1]); x1 = pix(pi_hold_u[0]);
  z0 = board_z1 + 0.3;
  reach = (D - t) - piy(0) + 1.0;          // von der Wand bis 1 mm über die Platine
  translate([x0, D - t + 0.01, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0)
    polygon([[0, z0], [-reach, z0], [-reach, z0 + 2], [0, z0 + 2 + reach]]);
}

// ------------------------------- Oberteil ---------------------------------
module shell() {
  difference() {
    intersection() {
      outer_solid();
      union() {
        difference() { outer_solid(); inner_void(); }
        bosses_solid();
        pi_holddown();
      }
    }
    // Button-Löcher (senkrecht zur Pultfläche)
    for (i = [0:2]) btn_axis(i) cylinder(d = btn_hole, h = 3*tt + 10, center = true);
    if (next_on) next_axis() cylinder(d = next_hole, h = 3*tt + 10, center = true);

    // Schraublöcher in den Säulen
    for (p = bosses) translate([p[0], p[1], bt - 0.01]) cylinder(d = boss_pilot, h = boss_depth);

    // Rückwand: Fenster für Strom (Pi 3: Micro-USB, Pi 4: USB-C) und HDMI
    x_a = pix(win_u[1]); x_b = pix(win_u[0]);
    translate([x_a, D - t - 1, board_z1 + win_z[0]])
      rotate([-90, 0, 0]) linear_extrude(t + 2)
        translate([0, -win_z[1]]) rrect(x_b - x_a, win_z[1], 2.5);
    // Rückwand: Audio-Klinke
    translate([pix(pi_audio_u), D - t - 1, board_z1 + 3]) rotate([-90, 0, 0]) cylinder(d = 8, h = t + 2);

    // linke Wand: USB-A und LAN (Service-Zugang, z. B. Tastatur bei der Einrichtung)
    translate([-1, piy(55), board_z1 - 0.8])
      rotate([90, 0, 90]) linear_extrude(t + 2) rrect(piy(1.5) - piy(55), 18.5, 2);

    // Lüftungsschlitze Rückwand (oben, Warmluft entweicht nach hinten)
    for (x = [14 : 8 : 92]) translate([x, D + 1, 34]) rotate([90, 0, 0])
      linear_extrude(t + 2) rotate(90) rslot(28, 3.2);
    for (x = [116 : 8 : W - 18]) translate([x, D + 1, 34]) rotate([90, 0, 0])
      linear_extrude(t + 2) rotate(90) rslot(28, 3.2);
    // Lüftungsschlitze linke Wand über dem Pi
    for (y = [96 : 8 : 140]) translate([-1, y, 33]) rotate([90, 0, 90])
      linear_extrude(t + 2) rotate(90) rslot(12, 3.2);
  }
}

// ------------------------------- Boden ------------------------------------
rim_h = 3; rim_w = 1.6; rim_clr = 0.3;

// Schnapphaken: federnder Steg neben der Platinenkante, Nase greift über die Platine.
// Profil im lokalen System: Platinenkante bei y = 0, Platine bei y > 0.
module clip_profile() {
  zu = board_z1 + 0.15;                     // Unterseite der Nase knapp über der Platine
  polygon([
    [-clip_gap - clip_t, bt - 0.01], [-clip_gap, bt - 0.01], [-clip_gap, zu],
    [clip_lip, zu], [clip_lip, zu + 0.5],   // kurze senkrechte Kante, dann Einführschräge
    [-clip_gap, zu + 2.8], [-clip_gap - clip_t, zu + 2.8]
  ]);
}
module clip_local() {          // Kante entlang x, Platine in +y
  translate([-clip_w/2, 0, 0]) rotate([90, 0, 90]) linear_extrude(clip_w) clip_profile();
}
module pi_clip(edge, pos) {
  if (edge == "front")        // Kante v = 56, Platine liegt in +y
    translate([pix(pos), piy(pi_W), 0]) clip_local();
  else if (edge == "inner")   // Kante u = 0, Platine liegt in −x
    translate([pix(0), piy(pos), 0]) rotate([0, 0, 90]) clip_local();
}

module base() {
  difference() {
    union() {
      linear_extrude(bt) rrect(W, D, rc);
      // Zentrierrand – das Oberteil sitzt darüber
      difference() {
        translate([t + rim_clr, t + rim_clr, bt - 0.01]) linear_extrude(rim_h)
          difference() {
            rrect(W - 2*(t + rim_clr), D - 2*(t + rim_clr), rc - t);
            translate([rim_w, rim_w]) rrect(W - 2*(t + rim_clr + rim_w), D - 2*(t + rim_clr + rim_w), max(0.5, rc - t - rim_w));
          }
        for (p = bosses) translate([p[0], p[1], 0]) cylinder(d = boss_d + 1.2, h = 20);
      }
      // Pi-Auflagen mit Zentrierstiften (keine Schrauben)
      for (h = pi_holes) translate([pix(h[0]), piy(h[1]), bt - 0.01]) {
        cylinder(d = 6.5, h = pi_so);
        translate([0, 0, pi_so - 0.01]) {
          cylinder(d = pin_d, h = pin_h - 0.6);
          translate([0, 0, pin_h - 0.61]) cylinder(d1 = pin_d, d2 = pin_d - 0.8, h = 0.6);   // Fase zum Einfädeln
        }
      }
      // Schnapphaken
      for (c = pi_clips) pi_clip(c[0], c[1]);
    }
    // Schrauben von unten in die Säulen (Senkkopf)
    for (p = bosses) translate([p[0], p[1], -0.01]) {
      cylinder(d = 3.4, h = bt + 1);
      cylinder(d1 = 6.6, d2 = 3.4, h = 1.8);
    }
    // Lüftungsschlitze unter dem Pi
    for (x = [pix(76) : 7 : pix(10)]) translate([x, piy(48), -1])
      linear_extrude(bt + 2) rotate(90) rslot(piy(8) - piy(48), 3.2);
    // Vertiefungen für Gummifüße (Ø 12)
    for (p = [[22, 20], [W - 22, 20], [W - 22, D - 22], [128, D - 22], [22, 88]])
      translate([p[0], p[1], -0.01]) cylinder(d = 12.5, h = 1.0);
    // Beschriftung unten
    translate([W - 12, 40, 0.6]) rotate([0, 180, 0]) linear_extrude(1)
      text("Stimmungsbarometer", size = 6, halign = "left", font = "Liberation Sans:style=Bold");
  }
}

// ------------------------------- Lochtest ---------------------------------
module hole_test() {
  ds = [23.8, 24.0, 24.3, 24.6, 25.0];   // um die Herstellerangabe 24 mm herum
  difference() {
    linear_extrude(tt) rrect(5*36 + 6, 46, 4);
    for (i = [0:4]) {
      translate([6 + 18 + i*36, 26, -1]) cylinder(d = ds[i], h = tt + 2);
      translate([6 + 18 + i*36, 5, tt - 0.6]) linear_extrude(1)
        text(str(ds[i]), size = 5, halign = "center", font = "Liberation Sans:style=Bold");
    }
  }
}

// ------------------------------- Darstellung ------------------------------
module pi_dummy() {
  color("green") translate([pix(pi_L), piy(pi_W), board_z0]) cube([pi_L, pi_W, pi_T]);
  // Anschlüsse hinten (ragen bis 1 mm über die Platinenkante)
  color("silver") translate([pix(pi_power_u) - 4, piy(5.5), board_z1]) cube([8, 6.5, 3]);
  color("silver") for (u = pi_hdmi_u)
    if (pi_model == 3) translate([pix(u) - 7.5, piy(11), board_z1]) cube([15, 12, 6.5]);
    else translate([pix(u) - 4.5, piy(7.5), board_z1]) cube([9, 8.5, 3.3]);
  color("black") translate([pix(pi_audio_u) - 3.5, piy(12), board_z1]) cube([7, 12, 6]);
  // USB/LAN links (ragen 2,5 mm über die Platinenkante)
  color("silver") translate([pix(pi_L + 2.5), piy(54), board_z1]) cube([21, 52, 16]);
  // SD-Karte unten an der inneren kurzen Kante
  color("dimgray") translate([pix(0) - 12, piy(34), board_z0 - 1.5]) cube([14.5, 12, 1.5]);
}

module button_dummy(i, c) {
  btn_axis(i) {
    color(c) cylinder(d = btn_cap, h = 15);
    color("dimgray") translate([0, 0, -tt - btn_below]) cylinder(d = 28, h = btn_below);
  }
}

module assembly() {
  color("whitesmoke") shell();
  color("lightgray") base();
  pi_dummy();
  button_dummy(0, "red"); button_dummy(1, "gold"); button_dummy(2, "limegreen");
  if (next_on) next_axis() {
    color("white") cylinder(d = next_cap, h = 13);
    color("dimgray") translate([0, 0, -tt - next_below]) cylinder(d = 26, h = next_below);
  }
  %translate(uln_box[0]) cube(uln_box[1]);
}

// ------------------------------- Ausgabe ----------------------------------
if (part == "shell") {
  if (print_orient) rotate([180 - a, 0, 0]) translate([0, 0, 0]) shell(); else shell();
} else if (part == "base") base();
else if (part == "test") hole_test();
else if (part=="assembly") assembly();
