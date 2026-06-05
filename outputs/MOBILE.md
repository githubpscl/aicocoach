# Aus der Web-App eine echte Handy-App machen

Die App ist bereits so vorbereitet, dass sie ohne Umbau in eine native iOS-/Android-App verpackt werden kann – mit **Capacitor**. Capacitor nimmt genau diese Web-Dateien und steckt sie in ein natives App-Gerüst, das du in den App Store / Play Store bringen kannst.

Es ist nichts am Code zu ändern. Die nötigen Konfigurationsdateien (`package.json`, `capacitor.config.json`) liegen schon im Projekt.

## Voraussetzungen

- **Node.js** (https://nodejs.org)
- Für Android: **Android Studio**
- Für iOS: ein **Mac mit Xcode** (Apple verlangt das für iOS-Builds)

## Schritte

Im Projektordner im Terminal:

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Native Plattform hinzufügen (eine oder beide)
npx cap add android
npx cap add ios

# 3. Web-Dateien in die native App kopieren
npx cap sync

# 4. In der jeweiligen IDE öffnen und starten
npx cap open android   # öffnet Android Studio
npx cap open ios       # öffnet Xcode
```

In Android Studio bzw. Xcode dann auf „Run" klicken – die App läuft auf Emulator oder angeschlossenem Handy. Von dort exportierst du auch das fertige Paket für den Store.

## Wichtig nach jeder Änderung

Wenn du an den Web-Dateien (HTML/JS/CSS) etwas änderst, danach einmal:

```bash
npx cap sync
```

Damit landen die Änderungen in der nativen App.

## App-Icon & Name

- Name und App-ID stehen in `capacitor.config.json` (`appName`, `appId`).
- Für hochauflösende Store-Icons gibt es das Tool `@capacitor/assets` – es generiert aus einem großen Logo automatisch alle Icon-Größen.

## Zwei Wege parallel

Du kannst die App gleichzeitig als Website (über die Netlify-URL) **und** als installierte Handy-App betreiben – beide nutzen denselben Code. Die Website ist sofort für alle erreichbar; die native App lohnt sich, sobald du in die Stores willst oder native Funktionen (Push, Kamera, Offline-Kalender) brauchst.
