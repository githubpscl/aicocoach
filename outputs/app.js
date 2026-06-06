/* ============================================================
   AICOCoach – KI Co-Trainer für den Amateurfußball
   Vanilla JS PWA. Daten lokal (localStorage) + optionale Cloud-Sync.
   ============================================================ */

/* ---------- Store ---------- */
const KEY = 'aicocoach_v1';
const POSITIONS = ['Torwart','Innenverteidigung','Außenverteidigung','Defensives Mittelfeld','Zentrales Mittelfeld','Offensives Mittelfeld','Flügel','Sturm'];
const FOCI = ['Ausdauer','Schnelligkeit','Passspiel','Abschluss','Defensivverhalten','Standards','Spielaufbau','Regeneration','Taktik','Zweikampf'];

const defaultState = () => ({
  team: { name: 'Mein Team', code: '' },
  players: [],
  trainings: [],
  matches: [],
  settings: { provider:'gemini', apiKey:'', model:'', supaUrl:'', supaKey:'' },
  updatedAt: Date.now()
});

let S = load();
function load(){
  try{ const r = JSON.parse(localStorage.getItem(KEY)); return r ? {...defaultState(), ...r} : defaultState(); }
  catch(e){ return defaultState(); }
}
function save(sync=true){
  S.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(S));
  if(sync && S.team.code && S.settings.supaUrl) pushCloud().catch(()=>{});
}
const uid = () => Math.random().toString(36).slice(2,10);

/* KI-Verfügbarkeit: entweder eigener Key des Nutzers, oder ein
   konfigurierter Default (sicherer Server-Proxy bzw. Direkt-Default-Key). */
function aiCfg(){ return (typeof window!=='undefined' && window.AICO_CONFIG) || {}; }
function hasAnyKey(){ const c=aiCfg(); return !!(S.settings.apiKey || c.proxyUrl || c.apiKey); }
function usingDefaultKey(){ const c=aiCfg(); return !S.settings.apiKey && !!(c.proxyUrl || c.apiKey); }

/* ---------- DOM helpers ---------- */
const $ = s => document.querySelector(s);
const view = $('#view');
function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); }
function esc(s){ return (s??'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function initials(n){ return (n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function fmtDate(d){ try{ return new Date(d).toLocaleDateString('de-DE',{day:'2-digit',month:'short'});}catch(e){return d;} }

/* ---------- Modal ---------- */
function modal(inner){
  const bg = h(`<div class="modal-bg"><div class="modal"></div></div>`);
  bg.querySelector('.modal').appendChild(inner);
  bg.addEventListener('click', e=>{ if(e.target===bg) bg.remove(); });
  $('#modalRoot').appendChild(bg);
  return bg;
}
function closeModal(){ const m=$('#modalRoot').lastChild; if(m) m.remove(); }

/* ---------- Router ---------- */
let tab = 'dashboard';
const VIEWS = { dashboard:vDashboard, squad:vSquad, training:vTraining, matches:vMatches, coach:vCoach, settings:vSettings };
function render(){
  $('#teamName').textContent = S.team.name || 'AICOCoach';
  $('#syncStatus').textContent = S.team.code && S.settings.supaUrl ? 'Cloud · '+S.team.code : 'Lokal';
  const oldFab=document.querySelector('.fab'); if(oldFab) oldFab.remove();
  view.innerHTML=''; VIEWS[tab]();
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.tab; view.scrollTop=0; render(); }));

/* ============================================================
   DASHBOARD
   ============================================================ */
function lastTrainings(n=5){ return [...S.trainings].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n); }
function lastMatches(n=5){ return [...S.matches].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n); }

function vDashboard(){
  const recent = lastMatches(5);
  const form = recent.map(m=>{ const r=m.gf>m.ga?'S':m.gf<m.ga?'N':'U'; return r; });
  const avgAtt = S.trainings.length ? Math.round(S.trainings.reduce((s,t)=>s+Object.values(t.attendance||{}).filter(Boolean).length,0)/S.trainings.length) : 0;

  view.appendChild(h(`
    <div>
      <div class="stat-grid">
        <div class="stat"><div class="n">${S.players.length}</div><div class="l">Spieler</div></div>
        <div class="stat"><div class="n">${S.trainings.length}</div><div class="l">Einheiten</div></div>
        <div class="stat"><div class="n">${S.matches.length}</div><div class="l">Spiele</div></div>
      </div>

      <h2 class="section">Letzte Form</h2>
      <div class="card">
        ${form.length ? `<div class="row"><div style="display:flex;gap:8px">${form.map(r=>`<span class="avatar" style="width:34px;height:34px;font-size:13px;background:${r==='S'?'var(--accent)':r==='N'?'var(--danger)':'var(--warn)'};color:#06231a">${r}</span>`).join('')}</div><span class="muted small">Ø ${avgAtt} beim Training</span></div>`
          : `<div class="muted small">Noch keine Spiele erfasst.</div>`}
      </div>

      <h2 class="section">Nächster Schritt</h2>
      <div class="card tap" id="goCoach">
        <div class="row">
          <div><strong>🤖 KI-Trainingsempfehlung</strong><div class="muted small">Lass die KI aus euren Daten die nächste Einheit planen.</div></div>
          <span style="font-size:22px">›</span>
        </div>
      </div>

      <h2 class="section">Letzte Einheiten</h2>
      <div class="card" id="recentT"></div>
    </div>`));

  $('#goCoach').onclick = ()=>{ tab='coach'; render(); };
  const rt = $('#recentT');
  const ts = lastTrainings(4);
  if(!ts.length) rt.innerHTML = `<div class="muted small">Noch kein Training geplant.</div>`;
  else ts.forEach(t=> rt.appendChild(h(`<div class="list-item">
      <div class="avatar" style="background:var(--card-2);color:var(--accent)">🏃</div>
      <div><strong>${fmtDate(t.date)}</strong><div class="muted tiny">${esc((t.foci||[]).join(', ')||'—')}</div></div>
      <div class="spacer"></div>
      <span class="pill">${Object.values(t.attendance||{}).filter(Boolean).length} dabei</span>
    </div>`)));
}

/* ============================================================
   KADER / SPIELERPROFILE
   ============================================================ */
function vSquad(){
  view.appendChild(h(`<div><h2 class="section">Kader (${S.players.length})</h2><div id="plist"></div></div>`));
  const list = $('#plist');
  if(!S.players.length) list.appendChild(h(`<div class="empty"><span class="em">👥</span>Noch keine Spieler.<br>Tippe auf + um den Kader aufzubauen.</div>`));
  const byPos = {};
  S.players.forEach(p=>{ (byPos[p.position]=byPos[p.position]||[]).push(p); });
  POSITIONS.filter(pos=>byPos[pos]).forEach(pos=>{
    const card = h(`<div class="card"><div class="muted tiny" style="margin-bottom:6px">${pos.toUpperCase()}</div></div>`);
    byPos[pos].forEach(p=>{
      const av = p.availability||'fit';
      const tag = av==='fit'?'pos':av==='angeschlagen'?'warn':'dng';
      const it = h(`<div class="list-item tap">
        <div class="avatar">${initials(p.name)}</div>
        <div><strong>${esc(p.name)}</strong><div class="muted tiny">${p.age?p.age+' J · ':''}${esc(p.position)}</div></div>
        <div class="spacer"></div><span class="pill ${tag}">${av}</span></div>`);
      it.onclick = ()=> playerForm(p);
      card.appendChild(it);
    });
    list.appendChild(card);
  });
  addFab(()=>playerForm());
}

function playerForm(p){
  const e = p || { id:uid(), name:'', position:POSITIONS[7], age:'', strengths:'', weaknesses:'', availability:'fit' };
  const m = modal(h(`<div>
    <div class="modal-head"><h3>${p?'Spieler bearbeiten':'Neuer Spieler'}</h3><button class="btn gho sm" id="x">✕</button></div>
    <label>Name</label><input id="f_name" value="${esc(e.name)}" placeholder="Vor- und Nachname"/>
    <div class="grid2">
      <div><label>Position</label><select id="f_pos">${POSITIONS.map(o=>`<option ${o===e.position?'selected':''}>${o}</option>`).join('')}</select></div>
      <div><label>Alter</label><input id="f_age" type="number" inputmode="numeric" value="${e.age||''}" placeholder="z.B. 24"/></div>
    </div>
    <label>Verfügbarkeit</label><select id="f_av">${['fit','angeschlagen','verletzt','gesperrt'].map(o=>`<option ${o===e.availability?'selected':''}>${o}</option>`).join('')}</select>
    <label>Stärken</label><input id="f_str" value="${esc(e.strengths)}" placeholder="z.B. Kopfball, Tempo"/>
    <label>Schwächen / Entwicklungsfelder</label><input id="f_wk" value="${esc(e.weaknesses)}" placeholder="z.B. schwacher Fuß, Ausdauer"/>
    <div class="divider"></div>
    <button class="btn" id="save">Speichern</button>
    ${p?'<button class="btn dng" style="margin-top:8px" id="del">Spieler löschen</button>':''}
  </div>`));
  m.querySelector('#x').onclick=closeModal;
  m.querySelector('#save').onclick=()=>{
    e.name=$('#f_name').value.trim(); if(!e.name) return toast('Name fehlt');
    e.position=$('#f_pos').value; e.age=$('#f_age').value; e.availability=$('#f_av').value;
    e.strengths=$('#f_str').value.trim(); e.weaknesses=$('#f_wk').value.trim();
    if(!p) S.players.push(e);
    save(); closeModal(); render(); toast('Gespeichert');
  };
  if(p) m.querySelector('#del').onclick=()=>{ if(confirm('Spieler wirklich löschen?')){ S.players=S.players.filter(x=>x.id!==e.id); save(); closeModal(); render(); } };
}

/* ============================================================
   TRAINING
   ============================================================ */
function vTraining(){
  view.appendChild(h(`<div><h2 class="section">Trainingseinheiten</h2><div id="tlist"></div></div>`));
  const list=$('#tlist');
  const ts=[...S.trainings].sort((a,b)=>b.date.localeCompare(a.date));
  if(!ts.length) list.appendChild(h(`<div class="empty"><span class="em">🏃</span>Noch keine Einheiten.<br>Plane mit + dein erstes Training.</div>`));
  ts.forEach(t=>{
    const present=Object.values(t.attendance||{}).filter(Boolean).length;
    const loads=Object.values(t.load||{}).filter(x=>x); const avgL=loads.length?(loads.reduce((a,b)=>a+b,0)/loads.length).toFixed(1):'–';
    const c=h(`<div class="card tap"><div class="row">
      <div><strong>${fmtDate(t.date)}</strong><div class="muted small">${esc((t.foci||[]).join(', ')||'Kein Schwerpunkt')}</div></div>
      <div style="text-align:right"><span class="pill pos">${present} da</span><div class="muted tiny">Ø Belastung ${avgL}</div></div>
    </div></div>`);
    c.onclick=()=>trainingForm(t);
    list.appendChild(c);
  });
  addFab(()=>trainingForm());
}

function trainingForm(t){
  const e = t || { id:uid(), date:new Date().toISOString().slice(0,10), foci:[], attendance:{}, load:{}, notes:'' };
  const m=modal(h(`<div>
    <div class="modal-head"><h3>${t?'Einheit bearbeiten':'Neue Einheit'}</h3><button class="btn gho sm" id="x">✕</button></div>
    <label>Datum</label><input id="f_date" type="date" value="${e.date}"/>
    <label>Schwerpunkte</label><div id="foci" style="display:flex;flex-wrap:wrap;gap:6px">${FOCI.map(f=>`<span class="pill ${e.foci.includes(f)?'pos':''}" data-f="${f}" style="cursor:pointer">${f}</span>`).join('')}</div>
    <label style="margin-top:14px">Anwesenheit & Belastung (1–5)</label>
    <div id="att"></div>
    <label>Notizen</label><textarea id="f_notes" placeholder="Beobachtungen, Verletzungen, Stimmung…">${esc(e.notes)}</textarea>
    <div class="divider"></div>
    <button class="btn" id="save">Speichern</button>
    ${t?'<button class="btn dng" style="margin-top:8px" id="del">Löschen</button>':''}
  </div>`));
  m.querySelector('#x').onclick=closeModal;
  m.querySelectorAll('#foci .pill').forEach(p=>p.onclick=()=>{ const f=p.dataset.f; if(e.foci.includes(f)){e.foci=e.foci.filter(x=>x!==f);p.classList.remove('pos');}else{e.foci.push(f);p.classList.add('pos');} });
  const att=m.querySelector('#att');
  if(!S.players.length) att.innerHTML='<div class="muted small">Lege zuerst Spieler im Kader an.</div>';
  S.players.forEach(p=>{
    const present = e.attendance[p.id]!==false; e.attendance[p.id]=present;
    const row=h(`<div class="list-item">
      <div class="chk ${present?'on':''}" data-chk>${present?'✓':''}</div>
      <div><strong>${esc(p.name)}</strong></div><div class="spacer"></div>
      <div class="rate" style="width:160px">${[1,2,3,4,5].map(n=>`<button data-l="${n}" class="${e.load[p.id]===n?'on':''}">${n}</button>`).join('')}</div>
    </div>`);
    const chk=row.querySelector('[data-chk]');
    chk.onclick=()=>{ e.attendance[p.id]=!e.attendance[p.id]; chk.classList.toggle('on',e.attendance[p.id]); chk.textContent=e.attendance[p.id]?'✓':''; };
    row.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ e.load[p.id]=+b.dataset.l; row.querySelectorAll('[data-l]').forEach(x=>x.classList.toggle('on',+x.dataset.l===e.load[p.id])); });
    att.appendChild(row);
  });
  m.querySelector('#save').onclick=()=>{ e.date=$('#f_date').value; e.notes=$('#f_notes').value.trim(); if(!t) S.trainings.push(e); save(); closeModal(); render(); toast('Training gespeichert'); };
  if(t) m.querySelector('#del').onclick=()=>{ if(confirm('Einheit löschen?')){ S.trainings=S.trainings.filter(x=>x.id!==e.id); save(); closeModal(); render(); } };
}

/* ============================================================
   SPIELE / LEISTUNGSDATEN
   ============================================================ */
function vMatches(){
  view.appendChild(h(`<div>
    <div class="row" style="align-items:center"><h2 class="section" style="margin-bottom:0">Spiele</h2><div class="spacer"></div><button class="btn gho sm" id="impMatches">🔎 fussball.de</button></div>
    <div id="mlist"></div><h2 class="section">Top-Torschützen</h2><div class="card" id="scorers"></div></div>`));
  $('#impMatches').onclick=()=>importFussballModal();
  const list=$('#mlist');
  const ms=[...S.matches].sort((a,b)=>b.date.localeCompare(a.date));
  if(!ms.length) list.appendChild(h(`<div class="empty"><span class="em">⚽</span>Noch keine Spiele erfasst.</div>`));
  ms.forEach(mt=>{
    const r=mt.gf>mt.ga?'S':mt.gf<mt.ga?'N':'U';
    const col=r==='S'?'var(--accent)':r==='N'?'var(--danger)':'var(--warn)';
    const c=h(`<div class="card tap"><div class="row">
      <div><strong>${esc(mt.home?'':'@ ')}${esc(mt.opponent)}</strong><div class="muted tiny">${fmtDate(mt.date)} · ${mt.home?'Heim':'Auswärts'}</div></div>
      <div style="text-align:right"><span style="font-size:20px;font-weight:700;color:${col}">${mt.gf}:${mt.ga}</span></div>
    </div></div>`);
    c.onclick=()=>matchForm(mt);
    list.appendChild(c);
  });
  // scorers
  const goals={}; S.matches.forEach(m=>Object.entries(m.stats||{}).forEach(([pid,st])=>{ goals[pid]=(goals[pid]||0)+(st.goals||0); }));
  const top=Object.entries(goals).filter(([,g])=>g>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const sc=$('#scorers');
  if(!top.length) sc.innerHTML='<div class="muted small">Noch keine Tore erfasst.</div>';
  top.forEach(([pid,g])=>{ const p=S.players.find(x=>x.id===pid); sc.appendChild(h(`<div class="list-item"><div class="avatar">${initials(p?.name||'?')}</div><strong>${esc(p?.name||'Unbekannt')}</strong><div class="spacer"></div><span class="pill pos">${g} ⚽</span></div>`)); });
  addFab(()=>matchForm());
}

function matchForm(mt){
  const e = mt || { id:uid(), date:new Date().toISOString().slice(0,10), opponent:'', home:true, gf:0, ga:0, stats:{}, notes:'' };
  const m=modal(h(`<div>
    <div class="modal-head"><h3>${mt?'Spiel bearbeiten':'Neues Spiel'}</h3><button class="btn gho sm" id="x">✕</button></div>
    <label>Gegner</label><input id="f_opp" value="${esc(e.opponent)}" placeholder="Gegnerischer Verein"/>
    <div class="grid2">
      <div><label>Datum</label><input id="f_date" type="date" value="${e.date}"/></div>
      <div><label>Ort</label><select id="f_home"><option value="1" ${e.home?'selected':''}>Heim</option><option value="0" ${!e.home?'selected':''}>Auswärts</option></select></div>
    </div>
    <div class="grid2">
      <div><label>Tore (wir)</label><input id="f_gf" type="number" inputmode="numeric" value="${e.gf}"/></div>
      <div><label>Tore (Gegner)</label><input id="f_ga" type="number" inputmode="numeric" value="${e.ga}"/></div>
    </div>
    <label style="margin-top:14px">Einsätze (Minuten · Tore · Vorlagen)</label>
    <div id="pstat"></div>
    <label>Notizen</label><textarea id="f_notes" placeholder="Spielverlauf, Auffälligkeiten…">${esc(e.notes)}</textarea>
    <div class="divider"></div>
    <button class="btn" id="save">Speichern</button>
    ${mt?'<button class="btn dng" style="margin-top:8px" id="del">Löschen</button>':''}
  </div>`));
  m.querySelector('#x').onclick=closeModal;
  const ps=m.querySelector('#pstat');
  if(!S.players.length) ps.innerHTML='<div class="muted small">Lege zuerst Spieler an.</div>';
  S.players.forEach(p=>{
    const st=e.stats[p.id]||{min:0,goals:0,assists:0}; e.stats[p.id]=st;
    const row=h(`<div class="list-item">
      <div><strong class="small">${esc(p.name)}</strong></div><div class="spacer"></div>
      <input data-k="min" type="number" inputmode="numeric" value="${st.min}" style="width:62px;padding:8px;text-align:center" placeholder="Min"/>
      <input data-k="goals" type="number" inputmode="numeric" value="${st.goals}" style="width:48px;padding:8px;text-align:center" placeholder="⚽"/>
      <input data-k="assists" type="number" inputmode="numeric" value="${st.assists}" style="width:48px;padding:8px;text-align:center" placeholder="🅰"/>
    </div>`);
    row.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{ st[inp.dataset.k]=+inp.value||0; });
    ps.appendChild(row);
  });
  m.querySelector('#save').onclick=()=>{ e.opponent=$('#f_opp').value.trim()||'Gegner'; e.date=$('#f_date').value; e.home=$('#f_home').value==='1'; e.gf=+$('#f_gf').value||0; e.ga=+$('#f_ga').value||0; e.notes=$('#f_notes').value.trim(); if(!mt) S.matches.push(e); save(); closeModal(); render(); toast('Spiel gespeichert'); };
  if(mt) m.querySelector('#del').onclick=()=>{ if(confirm('Spiel löschen?')){ S.matches=S.matches.filter(x=>x.id!==e.id); save(); closeModal(); render(); } };
}

/* ============================================================
   KI-COACH
   ============================================================ */
function buildContext(){
  const avail = S.players.reduce((a,p)=>{ a[p.availability]=(a[p.availability]||0)+1; return a; },{});
  const recentT = lastTrainings(5).map(t=>({datum:t.date, schwerpunkte:t.foci, anwesend:Object.values(t.attendance||{}).filter(Boolean).length, oeBelastung:avg(Object.values(t.load||{}).filter(Boolean)) }));
  const recentM = lastMatches(5).map(m=>({datum:m.date, gegner:m.opponent, ergebnis:`${m.gf}:${m.ga}`, ort:m.home?'Heim':'Auswärts'}));
  const fociFreq={}; S.trainings.forEach(t=>(t.foci||[]).forEach(f=>fociFreq[f]=(fociFreq[f]||0)+1));
  const weakAreas = S.players.map(p=>p.weaknesses).filter(Boolean);
  return {
    team:S.team.name,
    kadergroesse:S.players.length,
    verfuegbarkeit:avail,
    letzteTrainings:recentT,
    trainingsschwerpunkteHaeufigkeit:fociFreq,
    letzteSpiele:recentM,
    entwicklungsfelderSpieler:weakAreas
  };
}
function avg(a){ return a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null; }

function vCoach(){
  view.appendChild(h(`<div>
    <h2 class="section">KI Co-Trainer</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:10px">Die KI analysiert Kader, Verfügbarkeit, letzte Trainings und Ergebnisse und schlägt die nächste Einheit vor.</div>
      <button class="btn" id="gen">⚡ Trainingsempfehlung erstellen</button>
      <button class="btn sec" style="margin-top:8px" id="ask">💬 Eigene Frage stellen</button>
    </div>
    <div id="out"></div>
    <h2 class="section">Verlauf</h2>
    <div id="hist"></div>
  </div>`));
  $('#gen').onclick=()=>runCoach('plan');
  $('#ask').onclick=()=>{ const q=prompt('Was möchtest du den Co-Trainer fragen?'); if(q) runCoach('ask',q); };
  const hist=$('#hist'); const hs=(S.aiHistory||[]).slice().reverse();
  if(!hs.length) hist.innerHTML='<div class="muted small" style="padding:4px 2px">Noch keine Empfehlungen.</div>';
  hs.forEach(item=>{ const c=h(`<div class="card tap"><div class="muted tiny">${fmtDate(item.t)} · ${item.kind==='plan'?'Trainingsplan':'Frage'}</div><div class="ai-box" style="margin-top:6px;max-height:64px;overflow:hidden">${esc(item.text.slice(0,160))}…</div></div>`); c.onclick=()=>showAI(item.text); hist.appendChild(c); });
}

async function runCoach(kind, question){
  if(!hasAnyKey()){ toast('Bitte zuerst API-Key im Setup eintragen'); tab='settings'; render(); return; }
  if(!S.players.length){ toast('Lege zuerst Spieler an'); return; }
  const out=$('#out'); out.innerHTML=`<div class="card"><span class="loader"></span> <span class="muted">KI denkt nach…</span></div>`;
  const ctx=JSON.stringify(buildContext(),null,1);
  const sys=`Du bist ein erfahrener Co-Trainer im Amateurfußball. Antworte auf Deutsch, praxisnah und motivierend. Berücksichtige, dass es Amateure sind (begrenzte Zeit, 1-2 Einheiten/Woche). Sei konkret.`;
  const task = kind==='plan'
    ? `Erstelle auf Basis dieser Teamdaten einen Vorschlag für die NÄCHSTE Trainingseinheit. Gliedere in: 1) Schwerpunkt & Begründung, 2) Aufwärmen, 3) Hauptteil mit 2-3 Übungen (inkl. Dauer), 4) Abschluss, 5) Hinweise zu einzelnen Spielern/Belastungssteuerung. Halte es kompakt.`
    : `Beantworte folgende Frage des Trainers basierend auf den Teamdaten: "${question}"`;
  const prompt=`${task}\n\nTEAMDATEN (JSON):\n${ctx}`;
  try{
    const text=await callLLM(sys,prompt);
    out.innerHTML='';
    const card=h(`<div class="card"><div class="row" style="margin-bottom:8px"><strong>🤖 Empfehlung</strong><button class="btn gho sm" id="cp">Kopieren</button></div><div class="ai-box">${esc(text)}</div></div>`);
    card.querySelector('#cp').onclick=()=>{ navigator.clipboard.writeText(text); toast('Kopiert'); };
    out.appendChild(card);
    S.aiHistory=S.aiHistory||[]; S.aiHistory.push({t:Date.now(),kind,text}); if(S.aiHistory.length>20)S.aiHistory.shift(); save(false);
  }catch(err){
    out.innerHTML=`<div class="card"><strong style="color:var(--danger)">Fehler</strong><div class="muted small" style="margin-top:6px">${esc(err.message)}</div></div>`;
  }
}
function showAI(text){ modal(h(`<div><div class="modal-head"><h3>Empfehlung</h3><button class="btn gho sm" onclick="this.closest('.modal-bg').remove()">✕</button></div><div class="ai-box">${esc(text)}</div></div>`)); }

/* ---------- LLM Anbindung ----------
   Reihenfolge: 1) eigener Key des Nutzers (Direktaufruf),
   2) sicherer Server-Proxy (Key serverseitig), 3) Direkt-Default-Key (Fallback). */
async function callLLM(system, user){
  const c = aiCfg();
  // 1) Nutzer hat eigenen Key -> direkt beim gewählten Anbieter
  if(S.settings.apiKey){
    return callProviderDirect(S.settings.provider, S.settings.apiKey, S.settings.model, system, user);
  }
  // 2) Sicherer Standard: Server-Proxy hält den Key
  if(c.proxyUrl){
    const r=await fetch(c.proxyUrl,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({system, user, model:c.model||''})});
    let j={}; try{ j=await r.json(); }catch(e){}
    if(!r.ok) throw new Error(j.error||('Proxy: '+r.status));
    return (j.text||'').trim();
  }
  // 3) Fallback: Direkt-Default-Key im Client (nur falls konfiguriert)
  if(c.apiKey){
    return callProviderDirect(c.provider||'gemini', c.apiKey, c.model, system, user);
  }
  throw new Error('Kein API-Key oder Proxy konfiguriert');
}

async function callProviderDirect(provider, apiKey, model, system, user){
  if(provider==='groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({model:model||'llama-3.3-70b-versatile',messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.7})});
    if(!r.ok) throw new Error('Groq: '+r.status+' '+(await r.text()).slice(0,160));
    return (await r.json()).choices[0].message.content.trim();
  }
  if(provider==='openrouter'){
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({model:model||'meta-llama/llama-3.3-70b-instruct:free',messages:[{role:'system',content:system},{role:'user',content:user}]})});
    if(!r.ok) throw new Error('OpenRouter: '+r.status+' '+(await r.text()).slice(0,160));
    return (await r.json()).choices[0].message.content.trim();
  }
  // default: Google Gemini (free tier)
  const mdl=model||'gemini-2.0-flash';
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${encodeURIComponent(apiKey)}`,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({system_instruction:{parts:[{text:system}]},contents:[{parts:[{text:user}]}],generationConfig:{temperature:0.7}})});
  if(!r.ok) throw new Error('Gemini: '+r.status+' '+(await r.text()).slice(0,160));
  const j=await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Keine Antwort erhalten.';
}

/* ============================================================
   SETTINGS / SETUP
   ============================================================ */
function vSettings(){
  const st=S.settings;
  view.appendChild(h(`<div>
    <h2 class="section">Team</h2>
    <div class="card">
      <label>Teamname</label><input id="s_team" value="${esc(S.team.name)}"/>
    </div>

    <h2 class="section">KI (kostenlose LLM-API)</h2>
    <div class="card">
      <label>Anbieter</label>
      <select id="s_prov">
        <option value="gemini" ${st.provider==='gemini'?'selected':''}>Google Gemini (kostenloses Kontingent)</option>
        <option value="groq" ${st.provider==='groq'?'selected':''}>Groq (kostenlos)</option>
        <option value="openrouter" ${st.provider==='openrouter'?'selected':''}>OpenRouter (free Modelle)</option>
      </select>
      <label>API-Key</label><input id="s_key" type="password" value="${esc(st.apiKey)}" placeholder="${usingDefaultKey()?'Default-Key aktiv – leer lassen genügt':'hier einfügen'}"/>
      <label>Modell (optional)</label><input id="s_model" value="${esc(st.model)}" placeholder="Standard wird genutzt"/>
      ${usingDefaultKey()?'<div class="pill pos" style="margin-top:8px">✓ KI sofort einsatzbereit (Default-Key)</div>':''}
      <div class="muted tiny" id="keyhint" style="margin-top:8px"></div>
    </div>

    <h2 class="section">Geräteübergreifend (optional)</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Trage Supabase-Daten ein und vergib einen Team-Code, damit alle Trainer dieselben Daten auf jedem Gerät sehen. Ohne diese Angaben bleiben die Daten nur auf diesem Gerät.</div>
      <label>Team-Code</label><input id="s_code" value="${esc(S.team.code)}" placeholder="z.B. fcbeispiel2026"/>
      <label>Supabase URL</label><input id="s_surl" value="${esc(st.supaUrl)}" placeholder="https://xxxx.supabase.co"/>
      <label>Supabase anon Key</label><input id="s_skey" type="password" value="${esc(st.supaKey)}" placeholder="eyJ..."/>
      <div class="grid2" style="margin-top:10px">
        <button class="btn sec sm" id="pull">⬇ Laden</button>
        <button class="btn sec sm" id="push">⬆ Hochladen</button>
      </div>
    </div>

    <h2 class="section">Echte Vereinsdaten</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Suche deinen echten Verein bei <strong>fussball.de / BFV</strong> und importiere den echten Spielplan inkl. Ergebnissen (auch Amateurligen).</div>
      <button class="btn sm" id="impFussball">🔎 Verein suchen (fussball.de)</button>
      <div class="muted tiny" style="margin:10px 0 6px">Alternativ – Profiligen (stabile Quelle OpenLigaDB):</div>
      <button class="btn sec sm" id="impFootball">⚽ Liga-Daten (OpenLigaDB)</button>
    </div>

    <h2 class="section">Demo</h2>
    <div class="card">
      <div class="muted small" style="margin-bottom:8px">Beispiel-Datensatz: <strong>FC Stern München II</strong> – realer Verein, Heimspielstätte BSA Feldbergstraße & echte Gegnervereine aus dem Kreis München; Spieler fiktiv (Datenschutz).</div>
      <button class="btn sec sm" id="seed">⚽ Demo-Daten laden</button>
    </div>

    <div class="divider"></div>
    <button class="btn" id="s_save">Einstellungen speichern</button>
    <button class="btn gho" style="margin-top:8px" id="export">Daten als JSON exportieren</button>
    <button class="btn dng" style="margin-top:8px" id="reset">Alle lokalen Daten löschen</button>
    <div class="muted tiny" style="text-align:center;margin-top:16px">AICOCoach · PWA · v1</div>
  </div>`));

  const hints={gemini:'Key holen: aistudio.google.com/app/apikey (Google-Konto, gratis).',groq:'Key holen: console.groq.com/keys (gratis).',openrouter:'Key holen: openrouter.ai/keys – nutze ein Modell mit ":free".'};
  const setHint=()=>$('#keyhint').textContent=hints[$('#s_prov').value];
  $('#s_prov').onchange=setHint; setHint();

  $('#s_save').onclick=()=>{
    S.team.name=$('#s_team').value.trim()||'Mein Team';
    S.team.code=$('#s_code').value.trim().toLowerCase().replace(/\s+/g,'');
    st.provider=$('#s_prov').value; st.apiKey=$('#s_key').value.trim(); st.model=$('#s_model').value.trim();
    st.supaUrl=$('#s_surl').value.trim().replace(/\/$/,''); st.supaKey=$('#s_skey').value.trim();
    save(); render(); toast('Gespeichert');
  };
  $('#pull').onclick=async()=>{ readSettingsInputs(); try{ await pullCloud(); render(); toast('Cloud-Daten geladen'); }catch(e){ toast('Fehler: '+e.message); } };
  $('#push').onclick=async()=>{ readSettingsInputs(); try{ await pushCloud(); toast('In Cloud gespeichert'); }catch(e){ toast('Fehler: '+e.message); } };
  $('#impFussball').onclick=()=>importFussballModal();
  $('#impFootball').onclick=()=>importFootballModal();
  $('#seed').onclick=()=>loadSeed(false);
  $('#export').onclick=()=>{ const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='aicocoach-backup.json'; a.click(); };
  $('#reset').onclick=()=>{ if(confirm('Wirklich ALLE lokalen Daten löschen?')){ localStorage.removeItem(KEY); S=defaultState(); render(); toast('Zurückgesetzt'); } };
}
function readSettingsInputs(){
  S.team.code=$('#s_code').value.trim().toLowerCase().replace(/\s+/g,'');
  S.settings.supaUrl=$('#s_surl').value.trim().replace(/\/$/,''); S.settings.supaKey=$('#s_skey').value.trim();
  localStorage.setItem(KEY,JSON.stringify(S));
}

/* ---------- Cloud Sync (Supabase REST) ---------- */
function supaReady(){ return S.team.code && S.settings.supaUrl && S.settings.supaKey; }
async function pushCloud(){
  if(!supaReady()) throw new Error('Supabase-Daten unvollständig');
  const payload={ team_code:S.team.code, data:{team:S.team,players:S.players,trainings:S.trainings,matches:S.matches,aiHistory:S.aiHistory||[]}, updated_at:new Date().toISOString() };
  const r=await fetch(`${S.settings.supaUrl}/rest/v1/aico_state?on_conflict=team_code`,{method:'POST',
    headers:{'Content-Type':'application/json','apikey':S.settings.supaKey,'Authorization':'Bearer '+S.settings.supaKey,'Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify(payload)});
  if(!r.ok) throw new Error(r.status+' '+(await r.text()).slice(0,120));
}
async function pullCloud(){
  if(!supaReady()) throw new Error('Supabase-Daten unvollständig');
  const r=await fetch(`${S.settings.supaUrl}/rest/v1/aico_state?team_code=eq.${encodeURIComponent(S.team.code)}&select=data`,{
    headers:{'apikey':S.settings.supaKey,'Authorization':'Bearer '+S.settings.supaKey}});
  if(!r.ok) throw new Error(r.status+' '+(await r.text()).slice(0,120));
  const rows=await r.json();
  if(!rows.length) throw new Error('Kein Datensatz für diesen Team-Code');
  const d=rows[0].data; S.team=d.team||S.team; S.players=d.players||[]; S.trainings=d.trainings||[]; S.matches=d.matches||[]; S.aiHistory=d.aiHistory||[];
  save(false);
}
$('#syncBtn').onclick=async()=>{ if(!supaReady()){ toast('Cloud nicht eingerichtet (Setup)'); tab='settings'; render(); return; } try{ await pushCloud(); await pullCloud(); render(); toast('Synchronisiert'); }catch(e){ toast('Sync-Fehler: '+e.message); } };

/* ---------- FAB ---------- */
function addFab(fn){ const old=document.querySelector('.fab'); if(old)old.remove(); const f=h(`<button class="fab">+</button>`); f.onclick=fn; document.body.appendChild(f); }
const _origRender=render;

/* ---------- Service Worker ---------- */
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }

/* ---------- Demo-Daten ---------- */
function loadSeed(overwrite){
  if(!window.SEED_DATA){ toast('Keine Demo-Daten gefunden'); return; }
  const d=window.SEED_DATA;
  if(!overwrite && S.players.length){ if(!confirm('Vorhandene Daten durch die Demo (FC Stern München II) ersetzen?')) return; }
  S.team={...S.team, name:d.team.name};
  S.players=JSON.parse(JSON.stringify(d.players));
  S.trainings=JSON.parse(JSON.stringify(d.trainings));
  S.matches=JSON.parse(JSON.stringify(d.matches));
  S.aiHistory=[];
  save(); render(); toast('Demo-Daten geladen: '+d.team.name);
}

/* ============================================================
   ECHTE FUSSBALLDATEN – OpenLigaDB (kostenlos, ohne Key, CORS-offen)
   Quelle: https://api.openligadb.de  (DFB-/Liga-Daten, community-gepflegt)
   ============================================================ */
const OLB_BASE = 'https://api.openligadb.de';
const OLB_LEAGUES = [
  { sc:'bl1', name:'Bundesliga' },
  { sc:'bl2', name:'2. Bundesliga' },
  { sc:'bl3', name:'3. Liga' },
  { sc:'rl-bayern', name:'Regionalliga Bayern' },
  { sc:'bay', name:'Bayernliga' }
];
const olbCurrentSeason = () => { const d=new Date(); return String(d.getMonth()>=6 ? d.getFullYear() : d.getFullYear()-1); };

async function olbGet(path){
  const r = await fetch(OLB_BASE+path, { headers:{ 'Accept':'application/json' } });
  if(!r.ok) throw new Error('OpenLigaDB '+r.status);
  return r.json();
}
function olbFinalResult(m){
  const rs = m.matchResults||[];
  return rs.find(r=>r.resultTypeID===2) || rs.find(r=>/end/i.test(r.resultName||'')) || rs[rs.length-1] || null;
}
function olbMapMatch(m, teamId){
  const fin = olbFinalResult(m);
  if(!m.matchIsFinished || !fin) return null;
  const home = m.team1?.teamId===teamId;
  const opp = home ? m.team2?.teamName : m.team1?.teamName;
  const gf = home ? fin.pointsTeam1 : fin.pointsTeam2;
  const ga = home ? fin.pointsTeam2 : fin.pointsTeam1;
  return { id:'olb'+m.matchID, date:(m.matchDateTime||'').slice(0,10), opponent:opp||'Gegner',
           home:!!home, gf:gf||0, ga:ga||0, stats:{}, notes:'Importiert via OpenLigaDB' };
}

function importFootballModal(){
  const m = modal(h(`<div>
    <div class="modal-head"><h3>⚽ Echte Liga-Daten importieren</h3><button class="btn gho sm" id="x">✕</button></div>
    <div class="muted small" style="margin-bottom:10px">Lädt echte Teams, Ergebnisse & Tabellenstand aus <strong>OpenLigaDB</strong>. Profiligen sind top-aktuell; Amateurligen (Kreisliga etc.) sind dort meist nicht erfasst.</div>
    <div class="grid2">
      <div><label>Liga</label><select id="o_lg">${OLB_LEAGUES.map(l=>`<option value="${l.sc}">${l.name}</option>`).join('')}<option value="__custom">Andere (Kürzel)…</option></select></div>
      <div><label>Saison (Startjahr)</label><input id="o_se" value="${olbCurrentSeason()}" placeholder="z.B. ${olbCurrentSeason()}"/></div>
    </div>
    <div id="o_customwrap" style="display:none"><label>Liga-Kürzel</label><input id="o_custom" placeholder="z.B. rl-bayern"/></div>
    <button class="btn sec" id="o_load" style="margin-top:10px">Teams laden</button>
    <div id="o_teamwrap" style="display:none;margin-top:12px">
      <label>Dein Team</label><select id="o_team"></select>
      <div id="o_info" class="muted small" style="margin-top:8px"></div>
      <label style="margin-top:10px"><input type="checkbox" id="o_setname" checked style="width:auto;margin-right:6px"/>Teamname übernehmen</label>
      <div class="divider"></div>
      <button class="btn" id="o_import">Echte Spiele importieren</button>
      <div class="muted tiny" style="margin-top:8px">Importiert alle beendeten Spiele dieser Saison als Ergebnisse (überschreibt vorhandene Spiele). Spielerstatistiken/Kader sind in dieser freien Quelle nicht enthalten – Kader bitte manuell pflegen.</div>
    </div>
    <div id="o_msg" class="muted small" style="margin-top:10px"></div>
  </div>`));
  m.querySelector('#x').onclick=closeModal;
  const lg=m.querySelector('#o_lg'), cw=m.querySelector('#o_customwrap');
  lg.onchange=()=>{ cw.style.display = lg.value==='__custom' ? 'block':'none'; };
  const shortcut=()=> lg.value==='__custom' ? (m.querySelector('#o_custom').value.trim()) : lg.value;
  const msg=t=>{ m.querySelector('#o_msg').textContent=t; };

  let teams=[];
  m.querySelector('#o_load').onclick=async()=>{
    const sc=shortcut(), se=m.querySelector('#o_se').value.trim();
    if(!sc) return msg('Bitte Liga-Kürzel angeben.');
    msg('Lade Teams…');
    try{
      teams=await olbGet(`/getavailableteams/${encodeURIComponent(sc)}/${encodeURIComponent(se)}`);
      if(!teams.length){ msg('Keine Teams gefunden – Liga-Kürzel/Saison prüfen.'); return; }
      teams.sort((a,b)=>(a.teamName||'').localeCompare(b.teamName||''));
      const sel=m.querySelector('#o_team');
      sel.innerHTML=teams.map(t=>`<option value="${t.teamId}">${esc(t.teamName)}</option>`).join('');
      m.querySelector('#o_teamwrap').style.display='block';
      msg(`${teams.length} Teams geladen.`);
    }catch(e){ msg('Fehler: '+e.message); }
  };

  m.querySelector('#o_import').onclick=async()=>{
    const sc=shortcut(), se=m.querySelector('#o_se').value.trim();
    const teamId=+m.querySelector('#o_team').value;
    const team=teams.find(t=>t.teamId===teamId);
    msg('Lade Spiele…');
    try{
      const all=await olbGet(`/getmatchdata/${encodeURIComponent(sc)}/${encodeURIComponent(se)}`);
      const mine=all.filter(x=>x.team1?.teamId===teamId||x.team2?.teamId===teamId);
      const mapped=mine.map(x=>olbMapMatch(x,teamId)).filter(Boolean);
      if(!mapped.length){ msg('Keine beendeten Spiele für dieses Team gefunden.'); return; }
      if(m.querySelector('#o_setname').checked && team) S.team.name=team.teamName;
      S.matches=mapped;
      // Tabellenstand als Info anzeigen (optional)
      try{
        const table=await olbGet(`/getbltable/${encodeURIComponent(sc)}/${encodeURIComponent(se)}`);
        const pos=table.findIndex(t=>t.teamInfoId===teamId||t.teamName===team?.teamName);
        if(pos>=0){ const row=table[pos]; S._lastImportInfo=`Tabellenplatz ${pos+1} · ${row.points} Pkt · ${row.won}-${row.draw}-${row.lost}`; }
      }catch(e){}
      save(); closeModal(); tab='matches'; render();
      toast(`${mapped.length} echte Spiele importiert${S._lastImportInfo?' · '+S._lastImportInfo:''}`);
    }catch(e){ msg('Fehler: '+e.message); }
  };
}

/* ============================================================
   ECHTE VEREINSDATEN – fussball.de / BFV (über sicheren Proxy)
   Sucht echte Vereine, listet Mannschaften und importiert den
   echten Spielplan inkl. dekodierter Ergebnisse.
   ============================================================ */
function fbBase(){ const p=(window.AICO_CONFIG&&window.AICO_CONFIG.proxyUrl)||''; return p.replace(/\/api\/coach$/,'')||'https://aicocoach-proxy.vercel.app'; }
async function fbApi(params){ const r=await fetch(fbBase()+'/api/fussball?'+new URLSearchParams(params)); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||('Fehler '+r.status)); return j; }

function importFussballModal(){
  const m=modal(h(`<div>
    <div class="modal-head"><h3>🔎 Verein suchen (fussball.de)</h3><button class="btn gho sm" id="x">✕</button></div>
    <div class="muted small" style="margin-bottom:10px">Echte Daten von <strong>fussball.de / BFV</strong>: Verein suchen → Mannschaft wählen → echten Spielplan inkl. Ergebnissen importieren.</div>
    <label>Vereinsname</label>
    <div class="row" style="gap:6px"><input id="fb_q" placeholder="z.B. FC Stern München" style="flex:1"/><button class="btn sec sm" id="fb_search" style="width:auto">Suchen</button></div>
    <div id="fb_clubs" style="margin-top:10px"></div>
    <div id="fb_teamwrap" style="display:none;margin-top:12px">
      <label>Mannschaft</label><select id="fb_team"></select>
      <label style="margin-top:10px"><input type="checkbox" id="fb_setname" checked style="width:auto;margin-right:6px"/>Mannschaftsname als Teamname übernehmen</label>
      <div class="divider"></div>
      <button class="btn" id="fb_import">Echten Spielplan importieren</button>
      <div class="muted tiny" style="margin-top:8px">Importiert die verfügbaren Spiele (jüngste Ergebnisse + kommende). Kader/Spielernamen sind auf fussball.de meist nicht öffentlich (Datenschutz) – bitte manuell pflegen.</div>
    </div>
    <div id="fb_msg" class="muted small" style="margin-top:10px"></div>
  </div>`));
  m.querySelector('#x').onclick=closeModal;
  const msg=t=>{ m.querySelector('#fb_msg').textContent=t||''; };
  let clubId=null;

  async function loadTeams(id){
    clubId=id; msg('Lade Mannschaften…');
    try{
      const j=await fbApi({action:'teams', clubId:id});
      if(!j.teams||!j.teams.length){ msg('Keine Mannschaften gefunden.'); return; }
      m.querySelector('#fb_team').innerHTML=j.teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
      m.querySelector('#fb_teamwrap').style.display='block'; msg(`${j.teams.length} Mannschaften geladen.`);
    }catch(e){ msg('Fehler: '+e.message); }
  }

  m.querySelector('#fb_search').onclick=async()=>{
    const q=m.querySelector('#fb_q').value.trim(); if(!q) return msg('Bitte Vereinsname eingeben.');
    msg('Suche…'); m.querySelector('#fb_clubs').innerHTML=''; m.querySelector('#fb_teamwrap').style.display='none';
    try{
      const j=await fbApi({action:'search', q});
      if(!j.clubs||!j.clubs.length){ msg('Kein Verein gefunden.'); return; }
      msg('');
      const wrap=m.querySelector('#fb_clubs');
      j.clubs.forEach(c=>{ const b=h(`<button class="btn gho sm" style="display:block;width:100%;text-align:left;margin-bottom:6px">⚽ ${esc(c.name)}</button>`); b.onclick=()=>{ wrap.querySelectorAll('button').forEach(x=>x.classList.remove('sec')); b.classList.add('sec'); loadTeams(c.id); }; wrap.appendChild(b); });
      if(j.clubs.length===1) loadTeams(j.clubs[0].id);
    }catch(e){ msg('Fehler: '+e.message); }
  };
  m.querySelector('#fb_q').addEventListener('keydown',e=>{ if(e.key==='Enter') m.querySelector('#fb_search').click(); });

  m.querySelector('#fb_import').onclick=async()=>{
    const team=m.querySelector('#fb_team').value;
    msg('Lade Spielplan…');
    try{
      const j=await fbApi({action:'matches', clubId, team});
      const imported=(j.matches||[]).map(mt=>({ id:'fb'+(mt.date||'')+mt.opponent.replace(/\W/g,''), date:mt.date||new Date().toISOString().slice(0,10),
        opponent:mt.opponent, home:!!mt.home, gf: mt.finished?mt.gf:0, ga: mt.finished?mt.ga:0, stats:{}, notes:'Importiert via fussball.de'+(mt.finished?'':' (geplant)') }));
      if(!imported.length){ msg('Keine Spiele gefunden.'); return; }
      if(m.querySelector('#fb_setname').checked) S.team.name=team;
      S.matches=imported; save(); closeModal(); tab='matches'; render();
      const fin=imported.filter(x=>x.notes&&!/geplant/.test(x.notes)).length;
      toast(`${imported.length} Spiele von fussball.de importiert (${fin} mit Ergebnis)`);
    }catch(e){ msg('Fehler: '+e.message); }
  };
}

/* ---------- Init ---------- */
(async function init(){
  const firstRun = !localStorage.getItem(KEY);
  if(firstRun && window.SEED_DATA && !S.players.length){
    S.team.name=window.SEED_DATA.team.name;
    S.players=JSON.parse(JSON.stringify(window.SEED_DATA.players));
    S.trainings=JSON.parse(JSON.stringify(window.SEED_DATA.trainings));
    S.matches=JSON.parse(JSON.stringify(window.SEED_DATA.matches));
    save(false);
  }
  render();
  if(supaReady()){ try{ await pullCloud(); render(); }catch(e){} }
})();
