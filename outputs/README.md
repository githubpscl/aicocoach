# AICOCoach – KI Co-Trainer für den Amateurfußball

Eine installierbare Web-App (PWA), die als datenbasierter Co-Trainer dient: Kader verwalten, Training und Spiele tracken und daraus von einer KI Trainingsempfehlungen generieren lassen. Läuft auf Handy, Tablet und PC im Browser und lässt sich wie eine echte App installieren.

## Funktionen

- **Kader & Spielerprofile** – Position, Alter, Stärken/Schwächen, Verfügbarkeit (fit/angeschlagen/verletzt/gesperrt)
- **Trainings-Tracking** – Einheiten mit Schwerpunkten, Anwesenheit und Belastung (1–5) pro Spieler
- **Spiel- & Leistungsdaten** – Ergebnisse, Tore, Einsatzminuten, Vorlagen, Torschützenliste
- **KI-Coach** – erstellt aus allen Daten einen Vorschlag für die nächste Einheit oder beantwortet eigene Fragen
- **Offline-fähig** und **geräteübergreifend** per optionaler Cloud-Sync

---

## Vorbefüllt mit Beispieldaten

Beim ersten Start lädt die App automatisch einen kompletten Beispiel-Datensatz für **FC Stern München II** (18 Spieler, 18 Trainingseinheiten, 12 Spiele mit Torschützen) – so siehst du sofort, wie alles zusammenspielt. Neu laden oder zurücksetzen kannst du jederzeit unter *Setup → Demo* bzw. *Setup → Alle Daten löschen*.

Was daran echt ist: der Verein FC Stern München 1919 e.V., die Heimspielstätte BSA Feldbergstraße (Feldbergstr. 65, 81825 München) und die Gegnervereine aus dem Kreis München. **Die einzelnen Spieler sind bewusst fiktiv** – echten Amateurspielern erfundene Fitness-, Verletzungs- oder Leistungsdaten zuzuschreiben wäre nicht in Ordnung. Ersetze sie einfach durch deinen echten Kader.

Die KI- und Sync-Anbindungen sind **echte APIs** (Google Gemini / Groq / OpenRouter bzw. Supabase) – sobald du einen Key einträgst, arbeitet die App live damit.

## 1. Schnellstart (lokal testen)

Die App besteht aus statischen Dateien. Zum Testen reicht ein lokaler Server (wegen Service-Worker/PWA nicht direkt per Doppelklick öffnen):

```bash
cd <ordner-mit-den-dateien>
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen.

## 2. Online stellen (von anderen Geräten abrufbar)

Damit Handy & Co. die App erreichen, muss sie einmal kostenlos gehostet werden. Empfohlen, weil ohne Account/Build:

**Netlify Drop (am einfachsten):**
1. Auf <https://app.netlify.com/drop> gehen
2. Den kompletten Ordner mit allen Dateien per Drag & Drop hochladen
3. Du bekommst sofort eine URL wie `https://dein-name.netlify.app` – diese auf jedem Gerät öffnen

**Alternativen:** GitHub Pages (Repo anlegen → Settings → Pages), Vercel, Cloudflare Pages. Alle haben einen ausreichenden Gratis-Tarif.

Auf dem Handy dann im Browser-Menü „Zum Startbildschirm hinzufügen" wählen – die App erscheint wie eine native App mit eigenem Icon.

## 3. KI aktivieren (kostenlose LLM-API)

In der App unter **Setup → KI** einen Anbieter wählen und einen kostenlosen API-Key einfügen:

| Anbieter | Key holen | Hinweis |
|---|---|---|
| **Google Gemini** (empfohlen) | <https://aistudio.google.com/app/apikey> | Mit Google-Konto, großzügiges Gratis-Kontingent |
| **Groq** | <https://console.groq.com/keys> | Sehr schnell, kostenlos |
| **OpenRouter** | <https://openrouter.ai/keys> | Modell mit `:free` im Namen wählen |

Der Key wird nur lokal auf deinem Gerät gespeichert. Danach im Tab **KI-Coach** auf „Trainingsempfehlung erstellen" tippen.

## 4. Daten auf mehreren Geräten teilen (optional)

Standardmäßig liegen die Daten nur auf dem jeweiligen Gerät. Für gemeinsame Daten (z.B. zwei Trainer) eine kostenlose Supabase-Datenbank anbinden:

1. Kostenloses Projekt auf <https://supabase.com> anlegen
2. Im **SQL Editor** ausführen:

   ```sql
   create table aico_state (
     team_code text primary key,
     data jsonb,
     updated_at timestamptz default now()
   );
   alter table aico_state enable row level security;
   create policy "team access" on aico_state
     for all using (true) with check (true);
   ```

3. In **Project Settings → API** die `Project URL` und den `anon public` Key kopieren
4. In der App unter **Setup → Geräteübergreifend** eintragen und einen frei wählbaren **Team-Code** vergeben (z.B. `fcbeispiel2026`)
5. Auf dem zweiten Gerät dieselben drei Werte eintragen → die Daten werden synchronisiert (⟳ oben rechts oder „Laden/Hochladen")

> Hinweis: Die offene Policy oben ist für ein kleines Amateurteam praktikabel, aber der Team-Code sollte schwer zu erraten sein. Für höhere Sicherheit später echte Auth ergänzen.

---

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | App-Grundgerüst & Navigation |
| `app.js` | Gesamte Logik (Daten, Ansichten, KI, Sync) |
| `seed.js` | Beispiel-Datensatz FC Stern München II |
| `styles.css` | Mobile-first Design |
| `manifest.json` | PWA-Konfiguration (Installierbarkeit) |
| `sw.js` | Service Worker (Offline-Betrieb) |
| `icon.svg`, `icon-192.png`, `icon-512.png` | App-Icons |

## Datenschutz

Alle Daten bleiben standardmäßig auf dem Gerät (Browser-Speicher). API-Keys werden nicht an Dritte außer den gewählten LLM-Anbieter gesendet. Cloud-Sync ist optional und nutzt nur deine eigene Supabase-Instanz.

## Weiterentwicklung Richtung native App

Die App ist als PWA gebaut und damit bereits auf allen Geräten installierbar. Für eine native iOS/Android-App später kann das gleiche UI z.B. mit Capacitor verpackt oder die Logik nach React Native/Expo überführt werden – Datenmodell und Sync bleiben dabei nutzbar.
