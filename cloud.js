/* ---------- Záloha do cloudu: OneDrive (Microsoft Graph, PKCE) a Google Disk (appDataFolder) ----------
   Princip jako v BadGuns a BadCars: hlavní jsou data v zařízení, záloha je soubor badmove-backup.json
   ve složce aplikace (OneDrive: Apps/BadMove, Google Disk: skrytá data aplikace).
   Zálohuje se vždy do jednoho připojeného úložiště. Synchronizace slučuje oba směry:
   - každý záznam nese updatedAt (nastavuje se automaticky při uložení),
   - smazané záznamy se pamatují v data.tomb (id → čas smazání), aby se ze zálohy nevracely,
   - datum začátku (start) se slučuje na to dřívější.
   Ukázková data (demo) se nezálohují. */

const CFG = Object.assign({ clientId: '', tenant: 'common', googleClientId: '' }, window.BADMOVE_CONFIG || {});
const REDIRECT = location.origin + location.pathname.replace(/index\.html$/, '');
const COLS = ['goals', 'days', 'trainings', 'records', 'library'];
const CUR_KEY = 'badmove.cloud', PEND_KEY = 'badmove.auth.pending', LAST_KEY = 'badmove.lastBackup',
      WAS_KEY = 'badmove.cloud.was', CHANGE_KEY = 'badmove.lastChange';
const OD_AUTH = 'https://login.microsoftonline.com/' + CFG.tenant + '/oauth2/v2.0/';
const OD_SCOPE = 'Files.ReadWrite.AppFolder offline_access';
const OD_FILE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/badmove-backup.json';
const GD_SCOPE = 'https://www.googleapis.com/auth/drive.appdata', GD_API = 'https://www.googleapis.com/drive/v3/files',
      GD_UP = 'https://www.googleapis.com/upload/drive/v3/files', GD_NAME = 'badmove-backup.json';

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
const conflictErr = () => { const e = new Error('conflict'); e.conflict = true; return e; };
// token patří ke konkrétní registraci; po změně client ID se starý zahodí a je potřeba se přihlásit znovu
const tokKey = p => 'badmove.tok.' + p;
const cidOf = p => p === 'gdrive' ? CFG.googleClientId : CFG.clientId;
const getTok = p => { try { const t = JSON.parse(lsGet(tokKey(p))); return t && t.cid === cidOf(p) ? t : null; } catch (e) { return null; } };
const setTok = (p, t) => lsSet(tokKey(p), JSON.stringify(Object.assign({ cid: cidOf(p) }, t)));
// starší verze uměla jen OneDrive bez volby úložiště
if (getTok('onedrive') && !lsGet(CUR_KEY)) lsSet(CUR_KEY, 'onedrive');
if (lsGet(WAS_KEY) === '1') lsSet(WAS_KEY, 'onedrive');

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

/* ---------- úložiště ---------- */
async function odTokenReq(params) {
  const r = await withTimeout(fetch(OD_AUTH + 'token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() }), 15000);
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || 'token');
  const old = getTok('onedrive') || {};
  setTok('onedrive', { access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 });
}
async function cfetch(p, url, opt) {
  const tok = await PROV[p].token();
  if (!tok) throw authErr();
  opt = opt || {};
  opt.headers = Object.assign({ Authorization: 'Bearer ' + tok }, opt.headers || {});
  const r = await withTimeout(fetch(url, opt), 20000);
  if (r.status === 401) { lsDel(tokKey(p)); throw authErr(); }
  return r;
}
const PROV = {
  onedrive: {
    name: 'OneDrive', where: 'složka Apps/BadMove na OneDrive',
    configured: () => !!CFG.clientId,
    async login() {
      const ver = rand(32), st = rand(8);
      lsSet(PEND_KEY, JSON.stringify({ p: 'onedrive', ver, st }));
      location.href = OD_AUTH + 'authorize?' + new URLSearchParams({ client_id: CFG.clientId, response_type: 'code', redirect_uri: REDIRECT,
        response_mode: 'query', scope: OD_SCOPE, state: st, code_challenge: await s256(ver), code_challenge_method: 'S256', prompt: 'select_account' });
    },
    async finish(pend, q) {
      if (q.has('error')) throw new Error(q.get('error_description') || q.get('error'));
      if (!q.has('code')) return false;
      if (pend.st !== q.get('state')) throw new Error('neplatný stav');
      await odTokenReq({ client_id: CFG.clientId, grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT, code_verifier: pend.ver, scope: OD_SCOPE });
      return true;
    },
    async token() {
      const t = getTok('onedrive');
      if (!t) return null;
      if (t.exp > Date.now() + 60000) return t.access;
      if (!t.refresh) return null;
      try { await odTokenReq({ client_id: CFG.clientId, grant_type: 'refresh_token', refresh_token: t.refresh, scope: OD_SCOPE }); return getTok('onedrive').access; }
      catch (e) { lsDel(tokKey('onedrive')); return null; }
    },
    async read() {
      const m = await cfetch('onedrive', OD_FILE);
      if (m.status === 404) return { data: null, etag: null };
      if (!m.ok) throw new Error('OneDrive ' + m.status);
      const meta = await m.json(), c = await cfetch('onedrive', OD_FILE + ':/content');
      if (!c.ok) throw new Error('OneDrive ' + c.status);
      return { data: JSON.parse(await c.text()), etag: meta.eTag || null };
    },
    async write(text, etag) {
      const h = { 'Content-Type': 'application/json' };
      if (etag) h['If-Match'] = etag;
      const r = await cfetch('onedrive', OD_FILE + ':/content?@microsoft.graph.conflictBehavior=replace', { method: 'PUT', headers: h, body: text });
      if (r.status === 412) throw conflictErr();
      if (!r.ok) throw new Error('OneDrive ' + r.status);
    }
  },
  gdrive: {
    name: 'Google Disk', where: 'skrytá data aplikace na Google Disku',
    configured: () => !!CFG.googleClientId,
    // implicitní tok OAuth: token platí asi hodinu, pak je potřeba se znovu přihlásit (obvykle bez hesla)
    async login() {
      const st = rand(8);
      lsSet(PEND_KEY, JSON.stringify({ p: 'gdrive', st }));
      location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: CFG.googleClientId, redirect_uri: REDIRECT,
        response_type: 'token', scope: GD_SCOPE, state: st, include_granted_scopes: 'true' });
    },
    async finish(pend, q, h) {
      if (h.has('error')) throw new Error(h.get('error'));
      if (!h.has('access_token')) return false;
      if (pend.st !== h.get('state')) throw new Error('neplatný stav');
      setTok('gdrive', { access: h.get('access_token'), exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 });
      return true;
    },
    async token() { const t = getTok('gdrive'); return t && t.exp > Date.now() + 60000 ? t.access : null; },
    async fileMeta() {
      const r = await cfetch('gdrive', GD_API + '?' + new URLSearchParams({ spaces: 'appDataFolder', q: "name='" + GD_NAME + "' and trashed=false", fields: 'files(id,version)', pageSize: '10' }));
      if (!r.ok) throw new Error('Google Disk ' + r.status);
      const j = await r.json();
      return (j.files || [])[0] || null;
    },
    async read() {
      const f = await this.fileMeta();
      if (!f) return { data: null, etag: null };
      const c = await cfetch('gdrive', GD_API + '/' + f.id + '?alt=media');
      if (!c.ok) throw new Error('Google Disk ' + c.status);
      return { data: JSON.parse(await c.text()), etag: f.id + '@' + f.version };
    },
    async write(text, etag) {
      if (etag) {
        const f = await this.fileMeta();
        if (!f || f.id + '@' + f.version !== etag) throw conflictErr();
        const r = await cfetch('gdrive', GD_UP + '/' + f.id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text });
        if (!r.ok) throw new Error('Google Disk ' + r.status);
        return;
      }
      if (await this.fileMeta()) throw conflictErr();
      const bd = 'bm' + rand(8);
      const body = '--' + bd + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: GD_NAME, parents: ['appDataFolder'] }) +
        '\r\n--' + bd + '\r\nContent-Type: application/json\r\n\r\n' + text + '\r\n--' + bd + '--';
      const r = await cfetch('gdrive', GD_UP + '?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body });
      if (!r.ok) throw new Error('Google Disk ' + r.status);
    }
  }
};
const provList = () => Object.keys(PROV).filter(k => PROV[k].configured());
const curProv = () => { const p = lsGet(CUR_KEY); return p && PROV[p] && PROV[p].configured() ? p : null; };
const pname = () => { const p = curProv() || lsGet(WAS_KEY); return p && PROV[p] ? PROV[p].name : 'cloudu'; };

/* ---------- stav a synchronizace ---------- */
let cloud = false, syncSt = 'local', pushT = null, pushing = false, again = false, cloudMsg = '', loginNeeded = false;
const signedIn = () => { const p = curProv(); return !!(p && getTok(p)); };
const lastBackup = () => +(lsGet(LAST_KEY) || 0);
const syncLabel = st => ({ local: '⚠ jen v zařízení', ok: '☁ ' + pname(), busy: '⟳ zálohuji…', err: '⚠ záloha selhala', off: '' })[st];
function setSync(st) {
  syncSt = st;
  const e = $('#sync');
  if (e) { e.textContent = syncLabel(st); e.className = 'sync ' + st; }
  renderCloudPanel();
}

async function syncOnce() {
  const P = PROV[curProv()], rem = await P.read();
  if (mergeIn(rem.data)) rerender();
  const text = JSON.stringify(cloudExport());
  if (rem.data && JSON.stringify(rem.data) === text) return;
  await P.write(text, rem.etag);
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
  cloudMsg = 'Přihlášení k ' + pname() + ' vypršelo, přihlas se znovu.';
  setSync('local'); updateLoginBar();
}
function updateLoginBar() {
  const b = $('#login-bar');
  if (!b) return;
  b.classList.toggle('hidden', !loginNeeded);
  const t = $('#login-txt'); if (t) t.textContent = 'Přihlášení k ' + pname() + ' vypršelo, záloha čeká.';
}

// nahrazuje původní save(): razítka, uložení, naplánování zálohy
function save() {
  const changed = stampChanges();
  persistLocal();
  takeSnap();
  if (changed) { lsSet(CHANGE_KEY, String(Date.now())); schedulePush(); }
}

function cloudLogin(p) {
  p = p || curProv() || lsGet(WAS_KEY) || provList()[0];
  if (!PROV[p] || !PROV[p].configured()) return;
  const c = curProv();
  if (c && c !== p) lsDel(tokKey(c));
  lsSet(CUR_KEY, p);
  PROV[p].login();
}
function cloudLogout() {
  const p = curProv();
  if (!confirm('Odpojit ' + pname() + '? Data v zařízení i záloha zůstanou.')) return;
  if (p) lsDel(tokKey(p));
  lsDel(CUR_KEY); lsDel(WAS_KEY);
  cloud = false; loginNeeded = false; cloudMsg = '';
  setSync('local'); updateLoginBar();
}
async function handleRedirect() {
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  if (!q.has('code') && !q.has('error') && !h.has('access_token') && !h.has('error')) return;
  history.replaceState({}, '', REDIRECT);
  let pend = null;
  try { pend = JSON.parse(lsGet(PEND_KEY)); } catch (e) {}
  lsDel(PEND_KEY);
  if (!pend || !PROV[pend.p]) { cloudMsg = 'Přihlášení selhalo, zkus to znovu.'; return; }
  try {
    if (await PROV[pend.p].finish(pend, q, h)) { lsSet(CUR_KEY, pend.p); lsSet(WAS_KEY, pend.p); loginNeeded = false; }
  } catch (e) { cloudMsg = 'Přihlášení k ' + PROV[pend.p].name + ' selhalo: ' + e.message; }
}

function renderCloudPanel() {
  const box = $('#cloud');
  if (!box) return;
  const list = provList(), p = curProv();
  let h;
  if (!list.length) {
    h = '<p class="meta">Záloha do cloudu zatím není nastavená (config.js). Data jsou jen v tomto zařízení, zálohuj je exportem.</p>';
  } else if (signedIn() && cloud) {
    const lb = lastBackup();
    h = `<div class="kv"><span>Úložiště</span><b>${esc(PROV[p].name)}</b></div>
      <div class="kv"><span>Stav</span><b>${esc(syncLabel(syncSt) || '')}</b></div>
      <div class="kv"><span>Poslední záloha</span><b>${lb ? new Date(lb).toLocaleString('cs-CZ') : 'zatím žádná'}</b></div>
      <p class="meta">Data se zálohují automaticky po každé změně do souboru badmove-backup.json (${esc(PROV[p].where)}). Na dalším zařízení se po přihlášení sloučí a zůstanou stejná všude.</p>
      <div class="actions"><button id="cl-sync">Zálohovat teď</button><button class="ghost" id="cl-out">Odpojit</button></div>`;
  } else {
    h = `<p class="meta">Po připojení se data automaticky zálohují a dají se obnovit na jiném zařízení. Aplikace vidí jen svou vlastní složku. Vyber jedno úložiště.</p>
      <div class="stack">${list.map(k => `<button class="block" data-cl="${k}">Připojit ${esc(PROV[k].name)}</button>`).join('')}</div>`;
  }
  if (cloudMsg) h += `<p class="meta warn">${esc(cloudMsg)}</p>`;
  box.innerHTML = h;
  box.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => cloudLogin(b.dataset.cl));
  const b2 = $('#cl-sync'), b3 = $('#cl-out');
  if (b2) b2.onclick = () => { clearTimeout(pushT); syncAll(); };
  if (b3) b3.onclick = cloudLogout;
}

async function cloudStartup() {
  takeSnap();
  $('#login-btn').onclick = () => cloudLogin();
  if (!provList().length) { setSync('off'); return; }
  await handleRedirect();
  if (!signedIn()) { loginNeeded = !!(lsGet(WAS_KEY) && PROV[lsGet(WAS_KEY)] && PROV[lsGet(WAS_KEY)].configured()); setSync('local'); updateLoginBar(); return; }
  cloud = true;
  await syncAll();
}
