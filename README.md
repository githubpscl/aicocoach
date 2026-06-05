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

## KI ohne eigenen Key – sicher per Server-Proxy

Damit die KI sofort funktioniert, **ohne dass ein Nutzer einen Key einträgt**,
und ohne dass der Key irgendwo sichtbar wird, läuft die KI über einen kleinen
**Serverless-Proxy** (Ordner [`proxy/`](proxy/), deployt auf Vercel):

- Frontend (GitHub Pages) → POST an `https://aicocoach-proxy.vercel.app/api/coach`
- Der Gemini-Key liegt **ausschließlich serverseitig** als Vercel-Env-Variable
  `GEMINI_API_KEY` – nicht im Repo, nicht im ausgelieferten Browser-Code.
- CORS lässt nur die Domain `githubpscl.github.io` zu.

Key einmalig serverseitig setzen (Key holen: <https://aistudio.google.com/app/apikey>):

```bash
cd proxy
vercel env add GEMINI_API_KEY production   # Key einfügen, wenn gefragt
vercel deploy --prod --yes                 # neu deployen, damit der Key greift
```

Trägt ein Nutzer in der App unter **Setup → KI** trotzdem einen eigenen Key
ein, hat dieser Vorrang (Direktaufruf, ohne Proxy).

> Optionaler unsicherer Fallback: Per GitHub-Secret `AICO_GEMINI_KEY` kann der
> Deploy-Workflow stattdessen einen Key direkt in `outputs/config.js` injizieren.
> Davon ist abzuraten – ein in eine statische Seite ausgelieferter Key ist im
> Browser auslesbar. Der Proxy oben ist der sichere Weg.

## Lokal testen

```bash
cd outputs
python -m http.server 8080   # dann http://localhost:8080
```

## Native App (iOS / Android)

Vorbereitet via Capacitor – siehe [outputs/MOBILE.md](outputs/MOBILE.md).
