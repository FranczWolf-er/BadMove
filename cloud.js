/* ---------- Záloha na OneDrive (Microsoft Graph, přihlášení PKCE) ----------
   Princip jako v BadGuns: hlavní jsou data v zařízení, záloha je soubor
   Apps/<aplikace>/badmove-backup.json. Synchronizace slučuje oba směry:
   - každý záznam nese updatedAt (nastavuje se automaticky při uložení),
   - smazané záznamy se pamatují v data.tomb (id → čas smazání), aby se ze zálohy nevracely,
   - datum začátku (start) se slučuje na to dřívější.
   Ukázková data (demo) se nezálohují. */

const CFG = Object.assign({ clientId: '', tenant: 'common' }, window.BADMOVE_CONFIG || {});
const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, '');
const COLS = ['goals', 'days', 'trainings', 'records', 'library'];
const TOK_KEY = 'badmove.tok.onedrive', PEND_KEY = 'badmove.auth.pending', LAST_KEY = 'badmove.lastBackup',
      WAS_KEY = 'badmove.cloud.was', CHANGE_KEY = 'badmove.lastChange';
const OD_AUTH = 'https://login.microsoftonline.com/' + CFG.tenant + '/oauth2/v2.0/';
const OD_SCOPE = 'Files.ReadWrite.AppFolder offline_access';
const OD_FILE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/badmove-backup.json';

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('vypršel čas spojení')), ms))]);
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => ('0' + x.toString(16)).slice(-2)).join(''); };
async function s256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return btoa(String.fromCharCode.apply(null, new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const authErr = () => { const e = new Error('auth'); e.auth = true; return e; };
// token patří ke konkrétní registraci; po změně client ID se starý zahodí a je potřeba se přihlásit znovu
const getTok = () => { try { const t = JSON.parse(lsGet(TOK_KEY)); return t && t.cid === CFG.clientId ? t : null; } catch (e) { return null; } };
const setTok = t => lsSet(TOK_KEY, JSON.stringify(Object.assign({ cid: CFG.clientId }, t)));

/* ---------- razítka změn a smazání ---------- */
let snap = new Map(), snapPrefs = '';
const recJson = r => { const { updatedAt, ...rest } = r; return JSON.stringify(rest); };
const prefsJson = () => JSON.stringify([data.start]);
function takeSnap() {
  snap = new Map();
  COLS.forEach(k => data[k].forEach(r => snap.set(k + ':' + r.id, { j: recJson(r), demo: !!r.demo })));
  snapPrefs = prefsJson();
}
// porovná data s posledním uložením: změněným záznamům nastaví updatedAt, zmizelé zapíše do tomb
function stampChanges() {
  const now = Date.now(), seen = new Set();
  let changed = false;
  COLS.forEach(k => data[k].forEach(r => {
    const key = k + ':' + r.id, s = snap.get(key);
    seen.add(key);
    if (data.tomb[r.id]) { delete data.tomb[r.id]; changed = true; }   // záznam znovu vložený (např. importem)
    if (!s || s.j !== recJson(r)) { r.updatedAt = now; if (!r.demo) changed = true; }
  }));
  snap.forEach((s, key) => {
    if (seen.has(key) || s.demo) return;
    data.tomb[key.slice(key.indexOf(':') + 1)] = now;
    changed = true;
  });
  if (prefsJson() !== snapPrefs) { data.prefsAt = now; changed = true; }
  return changed;
}
const persistLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

/* ---------- sloučení se zálohou ---------- */
function cloudExport() {
  const nd = a => a.filter(x => !x.demo).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { app: 'badmove', v: 1, goals: nd(data.goals), days: nd(data.days), trainings: nd(data.trainings), records: nd(data.records), library: nd(data.library),
    start: data.start, prefsAt: data.prefsAt || 0, tomb: data.tomb };
}
// vrátí true, pokud se lokální data změnila
function mergeIn(rem) {
  if (!rem || typeof rem !== 'object') return false;
  const before = JSON.stringify(cloudExport());
  const tomb = Object.assign({}, data.tomb);
  Object.entries(rem.tomb || {}).forEach(([id, t]) => { if (!(tomb[id] >= t)) tomb[id] = t; });
  COLS.forEach(k => {
    const m = new Map(data[k].map(x => [x.id, x]));
    (Array.isArray(rem[k]) ? rem[k] : []).forEach(x => {
      if (!x || !x.id) return;
      const c = m.get(x.id);
      if (!c || (x.updatedAt || 0) > (c.updatedAt || 0)) m.set(x.id, x);
    });
    data[k] = [...m.values()].filter(x => !(x.id in tomb));
  });
  data.tomb = tomb;
  if (typeof rem.start === 'string' && rem.start && rem.start < data.start) { data.start = rem.start; data.prefsAt = Math.max(data.prefsAt || 0, rem.prefsAt || 0); }
  data.trainings.sort((a, b) => b.date.localeCompare(a.date));
  persistLocal();
  takeSnap();
  return JSON.stringify(cloudExport()) !== before;
}

/* ---------- OneDrive ---------- */
async function odTokenReq(params) {
  const r = await withTimeout(fetch(OD_AUTH + 'token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() }), 15000);
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || 'token');
  const old = getTok() || {};
  setTok({ access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 });
}
const OD = {
  configured: () => !!CFG.clientId,
  async login() {
    const ver = rand(32), st = rand(8);
    lsSet(PEND_KEY, JSON.stringify({ ver, st }));
    location.href = OD_AUTH + 'authorize?' + new URLSearchParams({ client_id: CFG.clientId, response_type: 'code', redirect_uri: REDIRECT,
      response_mode: 'query', scope: OD_SCOPE, state: st, code_challenge: await s256(ver), code_challenge_method: 'S256', prompt: 'select_account' });
  },
  async token() {
    const t = getTok();
    if (!t) return null;
    if (t.exp > Date.now() + 60000) return t.access;
    if (!t.refresh) return null;
    try { await odTokenReq({ client_id: CFG.clientId, grant_type: 'refresh_token', refresh_token: t.refresh, scope: OD_SCOPE }); return getTok().access; }
    catch (e) { lsDel(TOK_KEY); return null; }
  },
  async fetch(url, opt) {
    const tok = await this.token();
    if (!tok) throw authErr();
    opt = opt || {};
    opt.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opt.headers || {});
    const r = await withTimeout(fetch(url, opt), 20000);
    if (r.status === 401) { lsDel(TOK_KEY); throw authErr(); }
    return r;
  },
  async read() {
    const m = await this.fetch(OD_FILE);
    if (m.status === 404) return { data: null, etag: null };
    if (!m.ok) throw new Error('OneDrive ' + m.status);
    const meta = await m.json(), c = await this.fetch(OD_FILE + ':/content');
    if (!c.ok) throw new Error('OneDrive ' + c.status);
    return { data: JSON.parse(await c.text()), etag: meta.eTag || null };
  },
  async write(text, etag) {
    const h = { 'Content-Type': 'application/json' };
    if (etag) h['If-Match'] = etag;
    const r = await this.fetch(OD_FILE + ':/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', headers: h, body: text });
    if (r.status === 412) { const e = new Error('conflict'); e.conflict = true; throw e; }
    if (!r.ok) throw new Error('OneDrive ' + r.status);
  }
};

/* ---------- stav a synchronizace ---------- */
let cloud = false, syncSt = 'local', pushT = null, pushing = false, again = false, cloudMsg = '', loginNeeded = false;
const signedIn = () => !!getTok();
const lastBackup = () => +(lsGet(LAST_KEY) || 0);
const SYNC_LABEL = { local: '⚠ jen v zařízení', ok: '☁ OneDrive', busy: '⟳ zálohuji…', err: '⚠ záloha selhala', off: '' };
function setSync(st) {
  syncSt = st;
  const e = $('#sync');
  if (e) { e.textContent = SYNC_LABEL[st]; e.className = 'sync ' + st; }
  renderCloudPanel();
}

async function syncOnce() {
  const rem = await OD.read();
  if (mergeIn(rem.data)) rerender();
  const text = JSON.stringify(cloudExport());
  if (rem.data && JSON.stringify(rem.data) === text) return;
  await OD.write(text, rem.etag);
}
async function syncAll() {
  if (!cloud) return;
  if (pushing) { again = true; return; }
  pushing = true; setSync('busy');
  try {
    do {
      again = false;
      for (let i = 0; i < 3; i++) {
        try { await syncOnce(); break; } catch (e) { if (e.conflict && i < 2) continue; throw e; }
      }
    } while (again);
    lsSet(LAST_KEY, String(Date.now()));
    cloudMsg = '';
    setSync('ok');
  } catch (e) {
    if (e.auth) authLost(); else { cloudMsg = e.message; setSync('err'); }
  }
  pushing = false;
}
function schedulePush() {
  if (!cloud) return;
  clearTimeout(pushT); setSync('busy');
  pushT = setTimeout(syncAll, 1500);
}
function authLost() {
  cloud = false; loginNeeded = true;
  cloudMsg = 'Přihlášení k OneDrive vypršelo, přihlas se znovu.';
  setSync('local'); updateLoginBar();
}
function updateLoginBar() { const b = $('#login-bar'); if (b) b.classList.toggle('hidden', !loginNeeded); }

// nahrazuje původní save(): razítka, uložení, naplánování zálohy
function save() {
  const changed = stampChanges();
  persistLocal();
  takeSnap();
  if (changed) { lsSet(CHANGE_KEY, String(Date.now())); schedulePush(); }
}

function cloudLogin() { if (!OD.configured()) return; OD.login(); }
function cloudLogout() {
  if (!confirm('Odpojit OneDrive? Data v zařízení i záloha na OneDrive zůstanou.')) return;
  lsDel(TOK_KEY); lsDel(WAS_KEY);
  cloud = false; loginNeeded = false; cloudMsg = '';
  setSync('local'); updateLoginBar();
}
async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return;
  history.replaceState({}, '', REDIRECT);
  let pend = null;
  try { pend = JSON.parse(lsGet(PEND_KEY)); } catch (e) {}
  lsDel(PEND_KEY);
  if (q.has('error')) { cloudMsg = 'Přihlášení selhalo: ' + (q.get('error_description') || q.get('error')); return; }
  if (!pend || pend.st !== q.get('state')) { cloudMsg = 'Přihlášení selhalo, zkus to znovu.'; return; }
  try {
    await odTokenReq({ client_id: CFG.clientId, grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT, code_verifier: pend.ver, scope: OD_SCOPE });
    lsSet(WAS_KEY, '1'); loginNeeded = false;
  } catch (e) { cloudMsg = 'Přihlášení k OneDrive selhalo: ' + e.message; }
}

function renderCloudPanel() {
  const box = $('#cloud');
  if (!box) return;
  let h;
  if (!OD.configured()) {
    h = '<p class="meta">Záloha na OneDrive zatím není nastavená (config.js). Data jsou jen v tomto zařízení, zálohuj je exportem.</p>';
  } else if (signedIn() && cloud) {
    const lb = lastBackup();
    h = `<div class="kv"><span>Stav</span><b>${esc(SYNC_LABEL[syncSt] || '')}</b></div>
      <div class="kv"><span>Poslední záloha</span><b>${lb ? new Date(lb).toLocaleString('cs-CZ') : 'zatím žádná'}</b></div>
      <p class="meta">Data se zálohují automaticky po každé změně do souboru badmove-backup.json ve složce aplikace na OneDrive. Na dalším zařízení se po přihlášení sloučí a zůstanou stejná všude.</p>
      <div class="actions"><button id="cl-sync">Zálohovat teď</button><button class="ghost" id="cl-out">Odpojit</button></div>`;
  } else {
    h = `<p class="meta">Po připojení se data automaticky zálohují na tvůj OneDrive a dají se obnovit na jiném zařízení. Aplikace vidí jen svou vlastní složku.</p>
      <button class="block" id="cl-in">Připojit OneDrive</button>`;
  }
  if (cloudMsg) h += `<p class="meta warn">${esc(cloudMsg)}</p>`;
  box.innerHTML = h;
  const b1 = $('#cl-in'), b2 = $('#cl-sync'), b3 = $('#cl-out');
  if (b1) b1.onclick = cloudLogin;
  if (b2) b2.onclick = () => { clearTimeout(pushT); syncAll(); };
  if (b3) b3.onclick = cloudLogout;
}

async function cloudStartup() {
  takeSnap();
  $('#login-btn').onclick = cloudLogin;
  if (!OD.configured()) { setSync('off'); return; }
  await handleRedirect();
  if (!signedIn()) { loginNeeded = !!lsGet(WAS_KEY); setSync('local'); updateLoginBar(); return; }
  cloud = true;
  await syncAll();
}
