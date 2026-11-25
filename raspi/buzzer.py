#!/usr/bin/env python3
"""
Stimmungsbarometer – Buzzer-Dienst für Raspberry Pi 3 und 4

Liest die drei Arcade-Buttons an den GPIO-Pins, meldet sich beim System als
Tastatur und "tippt" 1 / 2 / 3. Die Cloud-Anwendung im Browser versteht diese
Tasten. Die LEDs in den Buttons geben Rückmeldung:

  Ruhezustand : die drei pulsieren abwechselnd, rot → gelb → grün (siehe IDLE_MODE)
  Nach Druck  : der gedrückte Button blinkt hell, die anderen gehen aus,
                nach LOCK_S Sekunden wieder Ruhezustand. In dieser Zeit
                werden weitere Drücke ignoriert (wie in der Web-App).

Damit die Tasten im Browser ankommen, braucht die Seite den Fokus. Der Dienst
klickt deshalb nach dem Start und danach regelmäßig in einer Ruhephase einmal
in die Bildschirmmitte (eigene virtuelle Maus).

Start zum Testen:   sudo python3 buzzer.py --test
Dauerbetrieb:       als systemd-Dienst (siehe buzzer.service)
"""

import argparse
import signal
import threading
import math
import time

from gpiozero import Button, PWMLED
from evdev import UInput, AbsInfo, ecodes as e

# ------------------------------------------------------------------ Einstellungen
# Reihenfolge: rot (negativ), gelb (neutral), grün (positiv)
BUTTON_PINS = [17, 27, 22]          # Mikroschalter: NO -> GPIO, COM -> GND
LED_PINS    = [5, 6, 13]            # -> ULN2003 IN1, IN2, IN3
KEYS        = [e.KEY_1, e.KEY_2, e.KEY_3]
NAMES       = ["rot", "gelb", "grün"]

LOCK_S        = 2.8      # Sperrzeit nach einem Druck (gleich wie in der Web-App)
IDLE_MODE     = "wave"   # "wave" = abwechselnd pulsieren (rot → gelb → grün),
                         # "dim" = gedimmt leuchten, "pulse" = alle gleichzeitig pulsieren, "on" = voll
IDLE_LEVEL    = 0.35     # Helligkeit im Modus "dim" (0..1)
WAVE_PERIOD_S = 3.0      # Modus "wave": Dauer eines Durchlaufs über alle drei Buttons
WAVE_MIN      = 0.04     # Modus "wave": Grundglimmen, damit kein Button ganz dunkel ist
WAVE_MAX      = 1.0      # Modus "wave": Spitzenhelligkeit
BLINK_ON      = 0.12     # Blinktakt nach dem Druck
BLINK_OFF     = 0.12
FOCUS_FIRST_S = 30       # erster Fokus-Klick nach dem Start (Browser braucht Zeit)
FOCUS_EVERY_S = 600      # danach alle 10 Minuten ...
FOCUS_QUIET_S = 60       # ... aber nur, wenn seit 60 s niemand gedrückt hat
BOUNCE_S      = 0.05     # Entprellung der Mikroschalter
# --------------------------------------------------------------------------------

ABS_MAX = 32767


class Buzzerpult:
    def __init__(self, test=False):
        self.test = test
        self.lock = threading.Lock()
        self.locked_until = 0.0
        self.last_press = 0.0
        self.stop = threading.Event()
        self.anim_lock = threading.Lock()
        self.animating = False
        self.wave_t0 = 0.0

        self.leds = [PWMLED(p) for p in LED_PINS]
        self.buttons = [Button(p, pull_up=True, bounce_time=BOUNCE_S) for p in BUTTON_PINS]

        # Virtuelle Tastatur: mit vollem Grundtastensatz registriert, damit sie
        # vom System sicher als Tastatur erkannt wird. Gesendet werden nur 1/2/3.
        self.kbd = UInput({e.EV_KEY: list(range(e.KEY_ESC, e.KEY_KPDOT + 1))},
                          name="Stimmungsbarometer Buzzer")
        # Virtuelle Maus mit absoluter Position (für den Fokus-Klick)
        self.mouse = UInput({
            e.EV_KEY: [e.BTN_LEFT, e.BTN_RIGHT],
            e.EV_ABS: [(e.ABS_X, AbsInfo(0, 0, ABS_MAX, 0, 0, 0)),
                       (e.ABS_Y, AbsInfo(0, 0, ABS_MAX, 0, 0, 0))],
        }, name="Stimmungsbarometer Fokus")

        for i, b in enumerate(self.buttons):
            b.when_pressed = (lambda idx=i: self.on_press(idx))

    # ---------------------------------------------------------------- LEDs
    def idle(self):
        if IDLE_MODE == "wave":
            with self.anim_lock:
                self.wave_t0 = time.monotonic()
                self.animating = True
            return
        for led in self.leds:
            if IDLE_MODE == "pulse":
                led.pulse(fade_in_time=1.6, fade_out_time=1.6)
            elif IDLE_MODE == "on":
                led.on()
            else:
                led.value = IDLE_LEVEL

    @staticmethod
    def wave_level(t, i):
        # Jeder Button hat seinen eigenen Zeitpunkt im Durchlauf (um 1/3 versetzt).
        # cos² mit abgeschnittener negativer Hälfte: ein Button glüht auf, während
        # der vorige ausklingt – die Welle läuft von links nach rechts.
        phase = 2 * math.pi * (t / WAVE_PERIOD_S - i / 3)
        b = max(0.0, math.cos(phase)) ** 2
        return WAVE_MIN + (WAVE_MAX - WAVE_MIN) * b

    def wave_loop(self):
        while not self.stop.wait(0.02):          # ca. 50 Bilder pro Sekunde
            with self.anim_lock:
                if not self.animating:
                    continue
                t = time.monotonic() - self.wave_t0
                for i, led in enumerate(self.leds):
                    led.value = self.wave_level(t, i)

    def feedback(self, idx):
        with self.anim_lock:
            self.animating = False                 # Welle anhalten, bevor geblinkt wird
        for i, led in enumerate(self.leds):
            if i == idx:
                n = max(1, int(LOCK_S / (BLINK_ON + BLINK_OFF)) - 2)
                led.blink(on_time=BLINK_ON, off_time=BLINK_OFF, n=n, background=True)
            else:
                led.off()

    def startup_show(self):
        # kurzes Lauflicht als Lebenszeichen
        for _ in range(2):
            for led in self.leds:
                led.on(); time.sleep(0.15); led.off()
        self.idle()

    # ---------------------------------------------------------------- Eingaben
    def send_key(self, key):
        self.kbd.write(e.EV_KEY, key, 1); self.kbd.syn()
        time.sleep(0.03)
        self.kbd.write(e.EV_KEY, key, 0); self.kbd.syn()

    def focus_click(self):
        m = self.mouse
        m.write(e.EV_ABS, e.ABS_X, ABS_MAX // 2); m.write(e.EV_ABS, e.ABS_Y, ABS_MAX // 2); m.syn()
        time.sleep(0.05)
        m.write(e.EV_KEY, e.BTN_LEFT, 1); m.syn(); time.sleep(0.05)
        m.write(e.EV_KEY, e.BTN_LEFT, 0); m.syn(); time.sleep(0.05)
        # Mauszeiger in die Ecke schieben, damit er nicht stört
        m.write(e.EV_ABS, e.ABS_X, ABS_MAX); m.write(e.EV_ABS, e.ABS_Y, ABS_MAX); m.syn()
        if self.test:
            print("Fokus-Klick in die Bildschirmmitte")

    def on_press(self, idx):
        now = time.monotonic()
        with self.lock:
            if now < self.locked_until:
                return
            self.locked_until = now + LOCK_S
            self.last_press = now
        if self.test:
            print(f"Button {NAMES[idx]} gedrückt -> Taste {idx + 1}")
        self.send_key(KEYS[idx])
        self.feedback(idx)
        threading.Timer(LOCK_S, self.idle).start()

    # ---------------------------------------------------------------- Hintergrund
    def focus_loop(self):
        if self.stop.wait(FOCUS_FIRST_S):
            return
        self.focus_click()
        while not self.stop.wait(FOCUS_EVERY_S):
            if time.monotonic() - self.last_press > FOCUS_QUIET_S:
                self.focus_click()

    def run(self):
        threading.Thread(target=self.wave_loop, daemon=True).start()
        self.startup_show()
        threading.Thread(target=self.focus_loop, daemon=True).start()
        if self.test:
            print("Bereit. Buttons drücken, Strg+C zum Beenden.")
        signal.signal(signal.SIGTERM, lambda *_: self.stop.set())
        try:
            while not self.stop.wait(1):
                pass
        except KeyboardInterrupt:
            pass
        finally:
            self.stop.set()
            with self.anim_lock:
                self.animating = False
            for led in self.leds:
                led.off()
            self.kbd.close(); self.mouse.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Stimmungsbarometer Buzzer-Dienst")
    ap.add_argument("--test", action="store_true", help="Drücke in der Konsole anzeigen")
    args = ap.parse_args()
    Buzzerpult(test=args.test).run()
