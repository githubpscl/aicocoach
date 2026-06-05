# AICOCoach – KI Co-Trainer für den Amateurfußball

Datenbasierter KI-Co-Trainer als installierbare Web-App (PWA): Kader verwalten,
Training und Spiele tracken und daraus von einer KI Trainingsempfehlungen
generieren lassen. Läuft im Browser auf Handy, Tablet und PC und lässt sich
wie eine native App installieren – oder später per Capacitor als echte
iOS-/Android-App in die Stores bringen.

> Die eigentliche Anwendung liegt im Ordner [`outputs/`](outputs/). Dort findest
> du auch die ausführliche [App-Dokumentation](outputs/README.md) und die
> Anleitung zur [nativen App](outputs/MOBILE.md).

## Live (GitHub Pages)

Die App wird bei jedem Push auf `main` automatisch über GitHub Actions deployt:

**→ https://githubpscl.github.io/aicocoach/**

Befüllt mit echten Beispieldaten für **FC Stern München II** (realer Verein,
echte Heimspielstätte & Gegner aus dem Kreis München; Spieler bewusst fiktiv
zum Schutz realer Amateure).

## Default-KI-Key (ohne Klartext im Repo)

Damit die KI-Funktion sofort ohne eigene Anmeldung funktioniert, kann ein
Default-API-Key hinterlegt werden – **ohne dass er im Repository sichtbar ist**:

1. Key als verschlüsseltes GitHub-Secret ablegen:
   ```bash
   gh secret set AICO_GEMINI_KEY
   ```
   (Key holen: <https://aistudio.google.com/app/apikey>)
2. Der Deploy-Workflow (`.github/workflows/deploy.yml`) injiziert diesen Key
   beim Build in `outputs/config.js`. Im committeten Code bleibt das Feld leer.

Trägt ein Nutzer in der App unter **Setup → KI** einen eigenen Key ein, hat
dieser immer Vorrang vor dem Default-Key.

> **Hinweis zur Sicherheit:** Ein in eine rein statische Seite ausgelieferter
> Default-Key ist im Browser des Nutzers technisch auslesbar (wie z. B. ein
> Google-Maps-Key). Deshalb den Gemini-Key in der Google Cloud Console mit
> einer **HTTP-Referrer-Beschränkung** auf `githubpscl.github.io/*` versehen –
> dann ist er nur von dieser Domain aus nutzbar. Für volle Geheimhaltung
> bräuchte es einen kleinen Serverless-Proxy (separat).

## Lokal testen

```bash
cd outputs
python -m http.server 8080   # dann http://localhost:8080
```

## Native App (iOS / Android)

Vorbereitet via Capacitor – siehe [outputs/MOBILE.md](outputs/MOBILE.md).
