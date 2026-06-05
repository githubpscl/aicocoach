/* ============================================================
   AICOCoach – sicherer KI-Proxy (Vercel Serverless Function)
   ------------------------------------------------------------
   Der Gemini-API-Key liegt ausschließlich serverseitig als
   Umgebungsvariable GEMINI_API_KEY (Vercel) – er wird NIE an den
   Browser ausgeliefert. Das statische Frontend (GitHub Pages) ruft
   nur diesen Endpunkt auf.
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://githubpscl.github.io",
  "http://localhost:8080",
  "http://localhost:8099",
  "http://127.0.0.1:8080"
];

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Nur POST erlaubt" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "Server-Key nicht konfiguriert" });

  try {
    const { system, user, model } = req.body || {};
    if (!user) return res.status(400).json({ error: "Feld 'user' fehlt" });

    const mdl = model || "gemini-2.0-flash";
    const body = {
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.7 }
    };
    if (system) body.system_instruction = { parts: [{ text: system }] };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const j = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: "Gemini: " + (j?.error?.message || r.status) });
    }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Keine Antwort erhalten.";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
