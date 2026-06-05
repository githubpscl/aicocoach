/* ============================================================
   AICOCoach – sicherer KI-Proxy mit Multi-Provider-Failover
   ------------------------------------------------------------
   Alle API-Keys liegen ausschließlich serverseitig als Vercel-
   Env-Variablen – sie werden NIE an den Browser ausgeliefert.
   Das statische Frontend (GitHub Pages) ruft nur diesen Endpunkt.

   Failover: Es werden der Reihe nach alle Anbieter probiert, für
   die ein Key gesetzt ist. Schlägt einer fehl (Fehler/Rate-Limit),
   übernimmt automatisch der nächste.
     GEMINI_API_KEY      -> Google Gemini   (Standard)
     GROQ_API_KEY        -> Groq
     OPENROUTER_API_KEY  -> OpenRouter
   ============================================================ */

const ALLOWED_ORIGINS = [
  "https://githubpscl.github.io",
  "http://localhost:8080",
  "http://localhost:8099",
  "http://127.0.0.1:8080"
];

/* ---- einzelne Anbieter ---- */
async function callGemini(key, { system, user, model }) {
  const mdl = model || "gemini-2.5-flash";
  const body = { contents: [{ parts: [{ text: user }] }], generationConfig: { temperature: 0.7 } };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const j = await r.json();
  if (!r.ok) throw new Error("Gemini " + r.status + ": " + (j?.error?.message || r.status));
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini: leere Antwort");
  return text;
}

async function callGroq(key, { system, user, model }) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: model || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: system || "" }, { role: "user", content: user }],
      temperature: 0.7
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Groq " + r.status + ": " + (j?.error?.message || r.status));
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq: leere Antwort");
  return text;
}

// Free-Modelle bei OpenRouter sind oft kurzfristig überlastet -> mehrere durchprobieren.
const OPENROUTER_MODELS = [
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.3-70b-instruct:free"
];
async function callOpenRouter(key, { system, user, model }) {
  const models = model ? [model, ...OPENROUTER_MODELS] : OPENROUTER_MODELS;
  let lastErr = "";
  for (const m of models) {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "system", content: system || "" }, { role: "user", content: user }]
      })
    });
    const j = await r.json().catch(() => ({}));
    const text = j?.choices?.[0]?.message?.content?.trim();
    if (r.ok && text) return text;
    lastErr = m + " -> " + (j?.error?.message || ("HTTP " + r.status));
  }
  throw new Error("OpenRouter: " + lastErr);
}

const PROVIDERS = [
  { name: "gemini", env: "GEMINI_API_KEY", call: callGemini },
  { name: "groq", env: "GROQ_API_KEY", call: callGroq },
  { name: "openrouter", env: "OPENROUTER_API_KEY", call: callOpenRouter }
];

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Nur POST erlaubt" });

  const { system, user, model, provider } = req.body || {};
  if (!user) return res.status(400).json({ error: "Feld 'user' fehlt" });

  // Reihenfolge bestimmen: gewünschter Anbieter zuerst, dann Rest als Fallback.
  let order = PROVIDERS.slice();
  if (provider) {
    const idx = order.findIndex(p => p.name === provider);
    if (idx > 0) order = [order[idx], ...order.slice(0, idx), ...order.slice(idx + 1)];
  }

  // Nur Anbieter mit gesetztem Key versuchen.
  const available = order.filter(p => process.env[p.env]);
  if (!available.length) return res.status(500).json({ error: "Kein Anbieter-Key konfiguriert" });

  const errors = [];
  for (const p of available) {
    try {
      const text = await p.call(process.env[p.env], { system, user, model: p.name === provider ? model : undefined });
      return res.status(200).json({ text, provider: p.name });
    } catch (e) {
      errors.push(p.name + ": " + String(e?.message || e));
    }
  }
  return res.status(502).json({ error: "Alle Anbieter fehlgeschlagen – " + errors.join(" | ") });
}
