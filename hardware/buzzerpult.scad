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
btn_hole   = 24.5;   // Montageloch – mit Lochtest prüfen! (typisch 24 mm, manche 28 mm)
btn_pitch  = 75;     // Abstand der Button-Mitten
btn_y      = 55;     // Lage der Buttons in der Tiefe (von vorn, auf der Pultfläche)
btn_cap    = 60;     // Kappendurchmesser (nur Darstellung)
btn_below  = 52.5;   // Bautiefe unter der Platte inkl. Mikroschalter
btn_env_d  = 40;     // Freiraum-Durchmesser unter der Platte (Schalter + LED-Fassung)

// ---------- Raspberry Pi 4 ----------
pi_L = 85;  pi_W = 56;  pi_T = 1.4;
pi_so      = 5;      // Höhe der Abstandshalter
pi_gap     = 1.5;    // Abstand Platinenkante – Innenseite Rückwand
pi_holes   = [[3.5,3.5],[61.5,3.5],[3.5,52.5],[61.5,52.5]];   // (u,v), v=0 Anschlusskante
pi_hole_d  = 2.4;    // Vorbohrung M2.5 (selbstschneidend) – für Gewindeeinsätze 3.2
// Anschlüsse an der Längskante (u = Abstand ab Platinenecke)
pi_usbc_u  = 11.2;  pi_hdmi0_u = 26.0;  pi_hdmi1_u = 39.5;  pi_audio_u = 53.5;

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

module bosses_solid() {
  for (p = bosses) translate([p[0], p[1], bt]) cylinder(d = boss_d, h = Hr);
}

module rslot(len, w) { hull() { circle(d = w); translate([len, 0]) circle(d = w); } }

// ------------------------------- Oberteil ---------------------------------
module shell() {
  difference() {
    intersection() {
      outer_solid();
      union() {
        difference() { outer_solid(); inner_void(); }
        bosses_solid();
      }
    }
    // Button-Löcher (senkrecht zur Pultfläche)
    for (i = [0:2]) btn_axis(i) cylinder(d = btn_hole, h = 3*tt + 10, center = true);

    // Schraublöcher in den Säulen
    for (p = bosses) translate([p[0], p[1], bt - 0.01]) cylinder(d = boss_pilot, h = boss_depth);

    // Rückwand: Fenster für USB-C (Strom) und beide Micro-HDMI
    x_a = pix(pi_hdmi1_u + 7.5); x_b = pix(pi_usbc_u - 7.5);
    translate([x_a, D - t - 1, board_z1 - 3.5])
      rotate([-90, 0, 0]) linear_extrude(t + 2)
        translate([0, -(10.5)]) rrect(x_b - x_a, 10.5, 2.5);
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
      // Pi-Abstandshalter
      for (h = pi_holes) translate([pix(h[0]), piy(h[1]), bt - 0.01]) cylinder(d = 6.5, h = pi_so);
    }
    // Schrauben von unten in die Säulen (Senkkopf)
    for (p = bosses) translate([p[0], p[1], -0.01]) {
      cylinder(d = 3.4, h = bt + 1);
      cylinder(d1 = 6.6, d2 = 3.4, h = 1.8);
    }
    // Pi-Schraublöcher
    for (h = pi_holes) translate([pix(h[0]), piy(h[1]), 1.0]) cylinder(d = pi_hole_d, h = pi_so + bt);
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
  ds = [24, 25, 26, 28, 30];
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
  // Anschlüsse hinten
  color("silver") for (u = [pi_usbc_u, pi_hdmi0_u, pi_hdmi1_u])
    translate([pix(u) - 4.5, piy(7.5), board_z1]) cube([9, 8.5, 3.3]);
  color("black") translate([pix(pi_audio_u) - 3.5, piy(12), board_z1]) cube([7, 12, 6]);
  // USB/LAN links
  color("silver") translate([pix(pi_L + 2.5), piy(54), board_z1]) cube([21, 52, 16]);
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
}

// ------------------------------- Ausgabe ----------------------------------
if (part == "shell") {
  if (print_orient) rotate([180 - a, 0, 0]) translate([0, 0, 0]) shell(); else shell();
} else if (part == "base") base();
else if (part == "test") hole_test();
else if (part=="assembly") assembly();
