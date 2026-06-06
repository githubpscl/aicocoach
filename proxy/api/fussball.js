/* ============================================================
   AICOCoach – fussball.de / BFV Daten-Proxy
   ------------------------------------------------------------
   Serverseitig, weil fussball.de CORS blockt und Ergebnisse per
   Webfont verschleiert. Wir laden die zur Antwort passende Font
   (export.fontface) und dekodieren Glyphe->Ziffer über die echten
   Glyph-Namen ("zero".."nine") – dieselbe Technik, die Amateur-
   Fußball-Apps nutzen.

   Aktionen:
     ?action=search&q=FC Stern München     -> Vereine [{name,id}]
     ?action=teams&clubId=<ID>             -> Mannschaftsnamen des Vereins
     ?action=matches&clubId=<ID>&team=...  -> Spiele (mit dekodierten Toren)
   ============================================================ */
import opentype from "opentype.js";

const ALLOWED_ORIGINS = [
  "https://githubpscl.github.io",
  "http://localhost:8080", "http://localhost:8099", "http://127.0.0.1:8080"
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const N2D = { zero:"0", one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9", hyphen:"-" };

async function fdText(url){ const r = await fetch(url, { headers:{ "User-Agent":UA, "Accept":"text/html,application/xhtml+xml" } }); if(!r.ok) throw new Error("fussball.de "+r.status); return r.text(); }
async function fdBuf(url){ const r = await fetch(url, { headers:{ "User-Agent":UA } }); if(!r.ok) throw new Error("font "+r.status); return Buffer.from(await r.arrayBuffer()); }

const fontCache = {};
async function fontMap(obfId){
  if(fontCache[obfId]) return fontCache[obfId];
  const b = await fdBuf(`https://www.fussball.de/export.fontface/-/format/ttf/id/${obfId}/type/font`);
  const f = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const map = {}; const gim = f.tables.cmap.glyphIndexMap;
  for(const ch of Object.keys(gim)){ const g = f.glyphs.get(gim[ch]); if(g && N2D[g.name]!==undefined) map[+ch] = N2D[g.name]; }
  fontCache[obfId] = map; return map;
}
async function decodeScoreCell(cell){
  const obf = (cell.match(/data-obfuscation="([^"]+)"/)||[])[1];
  if(!obf) return null;
  const map = await fontMap(obf);
  const span = h => [...h.matchAll(/&#x([0-9A-Fa-f]+);/g)].map(x=> map[parseInt(x[1],16)] ?? "?").join("");
  const l = (cell.match(/score-left"[^>]*>([\s\S]*?)<\/span>/)||[])[1] || "";
  const r = (cell.match(/score-right"[^>]*>([\s\S]*?)<\/span>/)||[])[1] || "";
  const gf = span(l), ga = span(r);
  if(!/^\d+$/.test(gf) || !/^\d+$/.test(ga)) return null;
  return { gf:+gf, ga:+ga };
}
function isoDate(s){ // "24.05.26" -> "2026-05-24"
  const m = (s||"").match(/(\d{2})\.(\d{2})\.(\d{2,4})/); if(!m) return "";
  let y = m[3]; if(y.length===2) y = "20"+y;
  return `${y}-${m[2]}-${m[1]}`;
}
function stripTeam(html){ return ((html.match(/data-alt="([^"]+)"/)||[])[1] || (html.match(/club-name"?>\s*([^<]+)</)||[])[1] || "").replace(/&#8203;/g,"").replace(/\s+/g," ").trim(); }

async function clubSearch(q){
  const d = await fdText(`https://www.fussball.de/suche/-/text/${encodeURIComponent(q)}`);
  const seen = new Set(); const out = [];
  for(const m of d.matchAll(/\/verein\/([a-z0-9-]+)\/-\/id\/([0-9A-Z]+)/g)){
    if(seen.has(m[2])) continue; seen.add(m[2]);
    out.push({ id:m[2], slug:m[1], name:m[1].replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()) });
  }
  return out.slice(0, 15);
}
async function clubMatches(clubId){
  const urls = [
    `https://www.fussball.de/ajax.club.prev.games/-/id/${clubId}/mode/PAGE`,
    `https://www.fussball.de/ajax.club.next.games/-/id/${clubId}/mode/PAGE`
  ];
  const matches = []; const teamSet = new Set();
  for(const u of urls){
    let d; try{ d = await fdText(u); }catch(e){ continue; }
    const clubCells = [...d.matchAll(/<td class="column-club[^"]*">([\s\S]*?)<\/td>/g)].map(m=>m[1]);
    const names = clubCells.map(stripTeam);
    const scoreCells = [...d.matchAll(/<td class="column-score">([\s\S]*?)<\/td>/g)].map(m=>m[1]);
    const dateCells = [...d.matchAll(/<td class="column-date">([\s\S]*?)<\/td>/g)].map(m=>m[1]);
    names.forEach(n=>n && teamSet.add(n));
    let lastIso = "";
    for(let i=0;i<scoreCells.length;i++){
      const home = names[2*i], away = names[2*i+1];
      if(!home || !away) continue;
      const iso = isoDate(dateCells[i]); if(iso) lastIso = iso;   // Datum pro Spieltag nur einmal -> übernehmen
      const score = /data-obfuscation/.test(scoreCells[i]) ? await decodeScoreCell(scoreCells[i]) : null;
      matches.push({ date: iso || lastIso, home, away, gf: score?score.gf:null, ga: score?score.ga:null, finished: !!score });
    }
  }
  return { teams:[...teamSet].sort((a,b)=>a.localeCompare(b)), matches };
}

export default async function handler(req, res){
  const origin = req.headers.origin || "";
  if(ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.status(204).end();

  const { action, q, clubId, team } = req.query || {};
  try{
    if(action==="search"){
      if(!q) return res.status(400).json({ error:"q fehlt" });
      return res.status(200).json({ clubs: await clubSearch(q) });
    }
    if(action==="teams" || action==="matches"){
      if(!clubId) return res.status(400).json({ error:"clubId fehlt" });
      const { teams, matches } = await clubMatches(clubId);
      if(action==="teams") return res.status(200).json({ teams });
      const filtered = team ? matches.filter(m=> m.home===team || m.away===team) : matches;
      // aus Team-Perspektive
      const mapped = filtered.map(m=>{ const home = m.home===team; return {
        date:m.date, opponent: home?m.away:m.home, home, gf: m.gf, ga: m.ga, finished:m.finished }; });
      return res.status(200).json({ team, count:mapped.length, matches:mapped, teams });
    }
    return res.status(400).json({ error:"unbekannte action" });
  }catch(e){ return res.status(502).json({ error:String(e?.message||e) }); }
}
