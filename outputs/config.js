/* ============================================================
   AICOCoach – Default-Konfiguration
   ------------------------------------------------------------
   WICHTIG: Hier steht KEIN echter API-Key im Klartext.
   Der echte Default-Key wird beim automatischen Deploy
   (GitHub Actions) aus dem verschlüsselten Secret AICO_GEMINI_KEY
   in die ausgelieferte Datei injiziert – das Repository selbst
   enthält ihn nie.

   Trägt ein Nutzer in der App unter "Setup → KI" einen eigenen
   Key ein, hat dieser immer Vorrang vor dem Default-Key.
   ============================================================ */
window.AICO_CONFIG = {
  provider: "gemini",
  apiKey: "",                 // wird beim Deploy gesetzt – lokal leer
  model: "gemini-2.0-flash"
};
