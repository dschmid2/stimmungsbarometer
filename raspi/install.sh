#!/bin/bash
# Stimmungsbarometer – Einrichtung auf dem Raspberry Pi 4 (Raspberry Pi OS mit Desktop)
# Aufruf im Ordner mit buzzer.py und buzzer.service:   bash install.sh
# Andere Adresse:                                       APP_URL=https://… bash install.sh
set -e

APP_URL="${APP_URL:-https://stimmungs-barometer.vercel.app}"
URL="$APP_URL/terminal"

echo "1/4 Pakete installieren …"
sudo apt-get update
sudo apt-get install -y python3-gpiozero python3-lgpio python3-evdev

echo "2/4 Buzzer-Dienst einrichten …"
sudo mkdir -p /opt/stimmungsbarometer
sudo cp buzzer.py /opt/stimmungsbarometer/buzzer.py
sudo cp buzzer.service /etc/systemd/system/buzzer.service
sudo systemctl daemon-reload
sudo systemctl enable --now buzzer.service

echo "3/4 Browser im Kiosk-Modus beim Anmelden starten ($URL) …"
BROWSER=$(command -v chromium || command -v chromium-browser)
FLAGS="--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run --autoplay-policy=no-user-gesture-required --check-for-update-interval=31536000"
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/stimmungsbarometer.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Stimmungsbarometer
Exec=$BROWSER $FLAGS $URL
EOF

echo "4/4 Bildschirmschoner ausschalten …"
sudo raspi-config nonint do_blanking 1 || true

echo
echo "Fertig. Jetzt neu starten:  sudo reboot"
echo "Danach zeigt der Bildschirm einen Kopplungscode. Diesen in der App unter Terminals → Terminal koppeln eingeben."
