window.APP_CONFIG = Object.freeze({
  api: 'https://smartchemistry.mahmoudmomajeed.workers.dev/api'
});
const BASE = new URL('.', (document.currentScript && document.currentScript.src) || location.href);
const DB = (() => {
  const memory = { kv: new Map(), notes: new Map(), progress: new Map() };
  const keys = { notes: 'id', progress: 'key' };
  let opened = null;
  function open() {
    if (opened) return opened;
    opened = new Promise(resolve => {
      try {
        const req = indexedDB.open('smart-chemistry', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
          if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' }).createIndex('owner', 'owner');
          if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'key' }).createIndex('owner', 'owner');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
    return opened;
  }
  async function run(name, mode, fn, fallback) {
    const db = await open();
    if (!db) return fallback(memory[name]);
    return new Promise(resolve => {
      try {
        const tx = db.transaction(name, mode);
        const req = fn(tx.objectStore(name));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = tx.onabort = () => resolve(fallback(memory[name]));
      } catch { resolve(fallback(memory[name])); }
    });
  }
  return {
    persistent: async () => !!(await open()),
    get: (name, key) => run(name, 'readonly', st => st.get(key), m => m.get(key)),
    put: (name, value, key) => run(name, 'readwrite', st => (key === undefined ? st.put(value) : st.put(value, key)), m => { m.set(key === undefined ? value[keys[name]] : key, value); }),
    del: (name, key) => run(name, 'readwrite', st => st.delete(key), m => { m.delete(key); }),
    owned: (name, owner) => run(name, 'readonly', st => st.index('owner').getAll(owner), m => [...m.values()].filter(v => v.owner === owner))
  };
})();
const App = (() => {
  const root = document.documentElement;
  const cache = { token: null, theme: 'dark', device: '' };
  function newDevice() { const a = new Uint8Array(16); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); }
  function legacy(k) { try { const v = localStorage.getItem(k); localStorage.removeItem(k); return v; } catch { return null; } }
  const ready = (async () => {
    const oldToken = legacy('sc-token'), oldTheme = legacy('sc-theme');
    if (oldToken) await DB.put('kv', oldToken, 'token');
    if (oldTheme) await DB.put('kv', oldTheme, 'theme');
    cache.token = (await DB.get('kv', 'token')) || null;
    cache.theme = (await DB.get('kv', 'theme')) === 'light' ? 'light' : 'dark';
    const device = await DB.get('kv', 'device');
    if (typeof device === 'string' && /^[a-f0-9]{32}$/.test(device)) cache.device = device;
    else { cache.device = newDevice(); await DB.put('kv', cache.device, 'device'); }
    applyTheme(cache.theme);
  })();
  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-label', theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
      b.querySelector('use')?.setAttribute('href', theme === 'dark' ? '#sun' : '#moon');
    });
  }
  function initTheme() {
    if (initTheme.done) return;
    initTheme.done = true;
    applyTheme(cache.theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
      const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(t);
      cache.theme = t;
      DB.put('kv', t, 'theme');
    }));
  }
  const messages = {
    network: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول تاني.',
    wrong_password: 'كلمة المرور الحالية غير صحيحة.',
    invalid: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
    locked: 'محاولات كتير غلط. استنى ربع ساعة وحاول تاني.',
    wait: 'حسابك تحت المراجعة ولم يتم تفعيله بعد. بياناتك وصلت للإدارة؛ تقدر تسجّل الدخول بعد الموافقة على حسابك.',
    ban: 'حسابك موقوف بواسطة الإدارة. مش هتقدر تسجّل الدخول لحد ما يتم رفع الإيقاف.',
    exists: 'رقم الطالب ده مسجل قبل كده.',
    email_exists: 'البريد الإلكتروني ده مستخدم في حساب تاني.',
    parent_same: 'رقم ولي الأمر لازم يكون مختلف عن رقم الطالب.',
    validation: 'في بيانات مش صحيحة. راجع الخطوات وحاول تاني.',
    upload: 'تعذر رفع الصورة. حاول تاني.',
    session: 'انتهت الجلسة. سجل دخولك تاني.',
    closed: 'التسجيل مقفول حاليًا. تابع الإعلانات وحاول بعدين.',
    maintenance: 'المنصة تحت الصيانة دلوقتي. حاول تاني بعد شوية.',
    birth: 'تاريخ الميلاد لازم يكون من 1 يناير 2007 أو بعده.',
    reject: 'حسابك اترفض من الإدارة. سجّل دخولك علشان تشوف السبب وتصحح بياناتك.',
    blocked: 'تم إيقاف استخدامك للمنصة مؤقتًا بسبب نشاط مشبوه.',
    mismatch: 'البيانات دي مش مطابقة لأي حساب. راجع رقمك ورقم ولي الأمر وتاريخ الميلاد.',
    forgot_locked: 'محاولات كتير غلط. استنى ساعة وحاول تاني، أو تواصل مع دعم المنصة.',
    cooldown: 'استنى دقيقة قبل ما تطلب كود جديد.',
    otp_limit: 'طلبت أكواد كتير. استنى ساعة وحاول تاني.',
    mail: 'تعذر إرسال الكود على بريدك دلوقتي. حاول بعد شوية أو تواصل مع الدعم.',
    otp_wrong: 'الكود غلط. راجعه وحاول تاني.',
    otp_expired: 'الكود انتهى أو اتقفل. اطلب كود جديد.',
    ticket_expired: 'انتهت مهلة تغيير كلمة المرور. ابدأ من الأول.',
    fix_expired: 'انتهت مهلة التصحيح. سجّل دخولك تاني علشان تكمل.',
    photo_required: 'لازم ترفع صورة شخصية جديدة وواضحة.',
    no_email: 'مفيش بريد إلكتروني متسجل على الحساب ده.',
    center: 'اختار السنتر والميعاد اللي بتحضر فيه، أو اختار أونلاين.',
    locked_content: 'المحتوى ده مقفول. افتحه من صفحة الدورة بالمحفظة أو بكود.',
    balance: 'رصيدك مش كفاية. اشحن المحفظة بكود.',
    owned: 'المحتوى ده مفتوح ليك بالفعل.',
    not_found: 'المحتوى ده مش متاح دلوقتي.',
    code_invalid: 'الكود ده غلط أو اتوقف.',
    code_expired: 'الكود ده انتهت صلاحيته.',
    code_used: 'الكود ده اتستخدم قبل كده.',
    code_mine: 'أنت استخدمت الكود ده قبل كده.',
    redeem_locked: 'محاولات كتير غلط. استنى ساعة وجرّب تاني.',
    quiz_done: 'أنت سلّمت ده قبل كده.',
    quiz_left: 'خرجت من الامتحان، فاتقفل على إجاباتك.',
    quiz_soon: 'لسه متفتحش.',
    quiz_closed: 'الوقت المسموح خلص.',
    quiz_time: 'الوقت خلص.',
    slow: 'طلبات كتير ورا بعض. استنى دقيقة وحاول تاني.',
    human: 'تعذر التحقق من جهازك. حدّث الصفحة وحاول تاني.',
    server: 'حصلت مشكلة في الخادم. حاول تاني بعد شوية.'
  };
  const HUMAN = ['register', 'forgot', 'fix', 'profile'];
  const proofs = new Map();
  function prepare(action) {
    const hit = proofs.get(action);
    if (hit && hit.until > Date.now()) return hit.proof;
    const until = Date.now() + 8 * 60000;
    const proof = send('challenge', { for: action }).then(r => (r.ok && typeof r.c === 'string' ? Pow.solve(r.c, r.n, r.bits) : null)).catch(() => null);
    proofs.set(action, { until, proof });
    proof.then(p => { if (!p && proofs.get(action)?.proof === proof) proofs.delete(action); });
    return proof;
  }
  async function api(action, payload = {}, opts = {}) {
    if (!HUMAN.includes(action)) return send(action, payload, opts);
    for (let i = 0; i < 2; i++) {
      const pow = await prepare(action);
      proofs.delete(action);
      if (!pow) return { ok: false, code: 'network' };
      const r = await send(action, { ...payload, pow }, opts);
      if (r.code !== 'human') return r;
    }
    return { ok: false, code: 'human' };
  }
  async function send(action, payload = {}, opts = {}) {
    await ready;
    let res;
    try {
      res = await fetch(window.APP_CONFIG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload, device: cache.device }),
        credentials: 'omit',
        keepalive: !!opts.keepalive,
        signal: AbortSignal.timeout(45000)
      });
    } catch { return { ok: false, code: 'network' }; }
    let data;
    try { data = await res.json(); } catch { return { ok: false, code: 'server' }; }
    if (!data || typeof data.ok !== 'boolean') return { ok: false, code: 'server' };
    if (data.code === 'blocked') Guard.block('server');
    else if (data.code === 'maintenance') Guard.go('update.html');
    return data;
  }
  const message = code => messages[code] || messages.server;
  return {
    initTheme, api, message, prepare,
    busy(btn, on) { btn.disabled = on; btn.classList.toggle('loading', on); btn.setAttribute('aria-busy', String(on)); },
    ready,
    token: () => cache.token,
    setToken: t => { cache.token = t; return DB.put('kv', t, 'token'); },
    clearToken: () => { cache.token = null; return DB.del('kv', 'token'); }
  };
})();
const Pow = (() => {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const W = new Uint32Array(64), buf = new Uint8Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  function head(str) {
    const n = str.length, len = ((n + 72) >> 6) << 6, b = len === buf.length ? buf.fill(0) : new Uint8Array(len);
    for (let i = 0; i < n; i++) b[i] = str.charCodeAt(i) & 255;
    b[n] = 0x80;
    const bits = n * 8;
    b[len - 4] = bits >>> 24; b[len - 3] = bits >>> 16; b[len - 2] = bits >>> 8; b[len - 1] = bits;
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let o = 0; o < len; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], c = W[i - 2];
        W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(c, 17) ^ r(c, 19) ^ (c >>> 10))) | 0;
      }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return h0 >>> 0;
  }
  const pause = () => new Promise(done => { const ch = new MessageChannel(); ch.port1.onmessage = () => { ch.port1.close(); done(); }; ch.port2.postMessage(0); });
  async function solve(c, seed, bits) {
    if (typeof seed !== 'string' || !/^[A-Za-z0-9_-]{16,40}$/.test(seed)) return null;
    const n = Math.min(Math.max(Number(bits) || 18, 1), 24), shift = 32 - n, prefix = seed + '.';
    for (let x = 0; x < 1e9; x += 4000) {
      for (let y = x; y < x + 4000; y++) if (head(prefix + y) >>> shift === 0) return { c, x: String(y) };
      await pause();
    }
    return null;
  }
  return Object.freeze({ head, solve });
})();
const Rules = Object.freeze({
  name: v => /^[\u0621-\u064Aa-zA-Z]{2,}( [\u0621-\u064Aa-zA-Z]{2,})+$/.test(v) && v.length <= 60,
  password: v => /^[\x21-\x7E]{6,64}$/.test(v),
  phone: v => /^01[0125][0-9]{8}$/.test(v),
  email: v => v === '' || (/^[a-z0-9._%+-]{1,64}@(gmail|yahoo|hotmail|outlook|live|icloud|msn)\.com$/.test(v) && v.length <= 100),
  birth: (v, today = Rules.today()) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= Rules.minBirth && v <= today;
  },
  minBirth: '2007-01-01',
  today: () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
  clock: (serverNow, deviceNow, tz) => {
    const skew = Math.round(Math.abs(deviceNow - serverNow) / 60000);
    if (skew > 10) return { ok: false, reason: 'clock', skew, zone: 0 };
    let zone = 0;
    try {
      if (tz) {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(serverNow));
        const real = Number(parts.find(p => p.type === 'hour').value) * 60 + Number(parts.find(p => p.type === 'minute').value);
        const d = new Date(deviceNow);
        const local = d.getHours() * 60 + d.getMinutes();
        const diff = Math.abs(real - local) % 1440;
        zone = Math.min(diff, 1440 - diff);
      }
    } catch { zone = 0; }
    return zone > 90 ? { ok: false, reason: 'zone', skew, zone } : { ok: true, reason: '', skew, zone };
  },
  whatsapp: (phone, text) => 'https://wa.me/20' + String(phone).slice(1) + (text ? '?text=' + encodeURIComponent(text) : ''),
  cleanName: v => v.trim().replace(/\s+/g, ' '),
  digits: v => v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '')
});
App.initTheme();
const Guard = (() => {
  const off = document.documentElement.dataset.guard === 'off';
  let leaving = false;
  const here = () => location.pathname + location.search + location.hash;
  function go(page, back = true) {
    if (off || leaving) return;
    leaving = true;
    location.replace(new URL('404/' + page + (back ? '?back=' + encodeURIComponent(here()) : ''), BASE));
  }
  async function block(reason) {
    if (off) return;
    await DB.put('kv', { at: Date.now(), reason }, 'blocked');
    go('secured.html', false);
  }
  async function report(reason) {
    if (off || leaving) return;
    if (reason === 'tamper') { await App.api('flag', { reason }); block(reason); }
    else go('secured.html');
  }
  async function checkTime() {
    const last = await DB.get('kv', 'time');
    const age = last ? Date.now() - last.at : -1;
    if (last && last.ok && age >= 0 && age < 1800000) return;
    const t0 = Date.now();
    const r = await App.api('time');
    const t1 = Date.now();
    if (!r.ok || typeof r.now !== 'number') return;
    const result = Rules.clock(r.now + (t1 - t0) / 2, t1, r.tz);
    await DB.put('kv', { at: t1, ok: result.ok, reason: result.reason }, 'time');
    if (!result.ok) go('time.html');
  }
  if (!off) {
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      const devtools = e.key === 'F12' || (mod && (e.shiftKey || e.altKey) && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(e.code));
      const source = mod && e.code === 'KeyU';
      if (!devtools && !source) return;
      e.preventDefault();
      e.stopPropagation();
      report(source ? 'source' : 'devtools');
    }, true);
    window.addEventListener('offline', () => go('dis.html'));
    window.addEventListener('error', async e => {
      if (!e.filename || !e.filename.startsWith(BASE.href) || e.filename.includes('/vendor/') || /ResizeObserver/.test(e.message || '')) return;
      const last = await DB.get('kv', 'err');
      if (typeof last === 'number' && Date.now() - last < 60000 && Date.now() >= last) return;
      await DB.put('kv', Date.now(), 'err');
      go('err.html');
    });
    App.ready.then(async () => {
      const blocked = await DB.get('kv', 'blocked');
      if (blocked && Date.now() - blocked.at < 86400000) { go('secured.html', false); return; }
      if (blocked) await DB.del('kv', 'blocked');
      if (!navigator.onLine) { go('dis.html'); return; }
      Site.load().then(r => { if (r && r.settings && r.settings.maintenance) go('update.html'); });
      checkTime();
    });
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname }).catch(() => {});
  return { go, block, report, checkTime };
})();
const Site = (() => {
  let cached = null;
  async function fetchSite(fresh) {
    if (!fresh) {
      const c = await DB.get('kv', 'site');
      const age = c ? Date.now() - c.at : -1;
      if (c && c.data && age >= 0 && age < 60000) return c.data;
    }
    const r = await App.api('site');
    if (!r.ok) return null;
    await DB.put('kv', { at: Date.now(), data: r }, 'site');
    return r;
  }
  const load = fresh => (fresh ? fetchSite(true) : cached || (cached = fetchSite(false)));
  return { load };
})();
(() => {
  const grid = document.querySelector('#grades .grades');
  const note = document.querySelector('#site-announcement');
  if (!grid && !note) return;
  Site.load().then(r => {
    if (!r) return;
    const s = r.settings || {};
    const text = s.maintenance ? (s.maintenance_message || App.message('maintenance')) : s.announcement;
    if (note && text) { note.textContent = text; note.hidden = false; }
    if (!grid || !Array.isArray(r.stages) || !r.stages.length) return;
    const icon = grid.querySelector('.more svg');
    grid.replaceChildren(...r.stages.map(st => {
      const a = document.createElement('a'); a.className = 'grade'; a.href = App.token() ? 'main/main.html#courses' : s.registration_open === false ? 'login/login.html' : 'login/login.html#register';
      const el = document.createElement('div'); el.className = 'element'; el.dir = 'ltr'; el.setAttribute('aria-hidden', 'true');
      const n = document.createElement('small'); n.textContent = st.number || '';
      const b = document.createElement('b'); b.textContent = st.symbol || st.name.trim().charAt(0);
      const e = document.createElement('span'); e.textContent = st.element || '';
      el.append(n, b, e);
      const h = document.createElement('h3'); h.textContent = st.name;
      const p = document.createElement('p'); p.textContent = st.description || '';
      const more = document.createElement('span'); more.className = 'more'; more.textContent = s.registration_open === false ? 'تسجيل الدخول' : 'ابدأ';
      if (icon) more.append(icon.cloneNode(true));
      a.append(el, h, p, more);
      return a;
    }));
  });
})();
(() => {
  const menu = document.querySelector('[data-menu]');
  const nav = document.querySelector('#nav');
  if (!menu || !nav) return;
  const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
})();

const Social = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const PATHS = {
    facebook: ['M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3Z', 'فيسبوك'],
    youtube: ['M3 8.5A3.5 3.5 0 0 1 6.5 5h11A3.5 3.5 0 0 1 21 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 15.5ZM10 9v6l5-3Z', 'يوتيوب'],
    instagram: ['M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-1.5h.01', 'إنستجرام'],
    tiktok: ['M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.4 4.4 5 4.6', 'تيك توك'],
    telegram: ['M21 4 3 11l6 2 2 6 3-4 5 4ZM9 13l9-6', 'تيليجرام'],
    whatsapp: ['M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12Z', 'قناة واتساب']
  };
  function icon(name) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', PATHS[name][0]); s.append(p); return s; }
  function links(map) {
    return Object.keys(PATHS).filter(k => typeof map[k] === 'string' && /^https:\/\//.test(map[k])).map(k => {
      const a = document.createElement('a');
      a.href = map[k]; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'social'; a.setAttribute('aria-label', PATHS[k][1]); a.title = PATHS[k][1];
      a.append(icon(k));
      return a;
    });
  }
  return { links, label: k => (PATHS[k] || [])[1] || k, icon };
})();
(() => {
  document.querySelectorAll('[data-year]').forEach(n => { n.textContent = String(new Date().getFullYear()); });
  const boxes = document.querySelectorAll('[data-socials]');
  if (!boxes.length) return;
  Site.load().then(r => {
    const map = (r && r.settings && r.settings.socials) || {};
    boxes.forEach(b => { const list = Social.links(map); b.replaceChildren(...list); b.hidden = !list.length; });
  });
})();

App.ready.then(() => {
  if (!App.token()) return;
  function updateLinks() {
    document.querySelectorAll('a[href]').forEach(a => {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin || u.pathname !== new URL('login/login.html', BASE).pathname) return;
      const register = u.hash === '#register';
      if (register && a.closest('footer nav')) { a.hidden = true; return; }
      const courses = !!a.closest('.grade') || register;
      a.href = new URL('main/main.html' + (courses ? '#courses' : ''), BASE).href;
      const text = a.querySelector('.more') || a;
      [...text.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => n.textContent = courses ? 'دوراتي' : 'حسابي');
    });
  }
  updateLinks();
  const grid = document.querySelector('#grades .grades');
  if (grid) new MutationObserver(updateLinks).observe(grid, { childList: true });
});
