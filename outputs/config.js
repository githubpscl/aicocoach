/* ============================================================
   AICOCoach – Default-Konfiguration
   ------------------------------------------------------------
   Sicherer Standard: Die App nutzt den KI-Proxy (proxyUrl). Der
   echte Gemini-Key liegt NUR serverseitig (Vercel-Env-Variable),
   nicht im Repo und nicht im Browser des Nutzers.

   Trägt ein Nutzer in der App unter "Setup → KI" einen eigenen
   Key ein, hat dieser immer Vorrang.

   Reihenfolge in app.js -> callLLM():
     1. eigener Key des Nutzers  (Direktaufruf)
     2. proxyUrl                 (sicherer Server-Proxy)  ← Standard
     3. apiKey                   (optionaler Direkt-Default, unsicherer Fallback)
   ============================================================ */
window.AICO_CONFIG = {
  provider: "gemini",
  proxyUrl: "https://aicocoach-proxy.vercel.app/api/coach",  // sicherer Server-Proxy (Key liegt serverseitig)
  apiKey: "",                 // optionaler Direkt-Default-Key (Fallback) – beim Deploy injizierbar
  model: "gemini-2.5-flash",

  // Supabase: Login (Magic-Link + E-Mail/Passwort) & team-bezogene Cloud-Daten.
  // Der anon-Key ist per Design öffentlich (steckt in jeder Client-App);
  // die Daten sind durch Row Level Security + Login-Pflicht geschützt.
  supabase: {
    url: "https://gaeapuywjxqzfnbckbml.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZWFwdXl3anhxemZuYmNrYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDUwNDQsImV4cCI6MjA5NjMyMTA0NH0.n_eGPCkITVQ4Tp0qcOY4bn3AMhfrsUe62c24JE-QN-o"
  }
};
