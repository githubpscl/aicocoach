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
  model: "gemini-2.5-flash"
};
