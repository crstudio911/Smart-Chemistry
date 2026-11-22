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
    if (data.code === 'blocked') Guard.block(data.reason || 'server', data.until, data.support);
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
  const secured = document.body && document.body.dataset.page === 'blocked';
  let leaving = false, sent = 0;
  const here = () => location.pathname + location.search + location.hash;
  function go(page, back = true) {
    if (leaving || (off && page !== 'secured.html') || (secured && page === 'secured.html')) return;
    leaving = true;
    location.replace(new URL('404/' + page + (back ? '?back=' + encodeURIComponent(here()) : ''), BASE));
  }
  async function block(reason, until, support) {
    const end = Number(until) > Date.now() ? Number(until) : Date.now() + 86400000;
    await DB.put('kv', { at: Date.now(), until: end, reason: String(reason || 'tamper'), support: Array.isArray(support) ? support.filter(Rules.phone) : [] }, 'blocked');
    if (secured) document.dispatchEvent(new CustomEvent('guard:blocked'));
    else go('secured.html', false);
  }
  async function report(reason) {
    if (leaving || Date.now() - sent < 30000) return;
    sent = Date.now();
    const r = await App.api('flag', { reason });
    if (!r || r.code !== 'blocked') block(reason);
  }
  async function active() {
    const b = await DB.get('kv', 'blocked');
    if (!b) return null;
    const until = Number(b.until) || Number(b.at) + 86400000;
    if (Date.now() < until) return { ...b, until };
    await DB.del('kv', 'blocked');
    return null;
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
  const paused = () => { const t = performance.now(); debugger; return performance.now() - t > 150; };
  function watch() {
    if (document.visibilityState !== 'visible') return;
    if (paused() && paused()) report('devtools');
  }
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    const devtools = e.key === 'F12' || (mod && (e.shiftKey || e.altKey) && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(e.code));
    const source = mod && e.code === 'KeyU';
    if (!devtools && !source) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  setInterval(watch, 1500);
  if (!off) {
    window.addEventListener('offline', () => go('dis.html'));
    window.addEventListener('error', async e => {
      if (!e.filename || !e.filename.startsWith(BASE.href) || e.filename.includes('/vendor/') || /ResizeObserver/.test(e.message || '')) return;
      const last = await DB.get('kv', 'err');
      if (typeof last === 'number' && Date.now() - last < 60000 && Date.now() >= last) return;
      await DB.put('kv', Date.now(), 'err');
      go('err.html');
    });
  }
  App.ready.then(async () => {
    if (await active()) { go('secured.html', false); return; }
    if (off) return;
    if (!navigator.onLine) { go('dis.html'); return; }
    Site.load().then(r => { if (r && r.settings && r.settings.maintenance) go('update.html'); });
    checkTime();
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register(new URL('sw.js', BASE), { scope: BASE.pathname }).catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  }
  return { go, block, report, active, checkTime };
})();
const Support = (() => {
  async function phones(extra) {
    const list = (Array.isArray(extra) ? extra : []).filter(Rules.phone);
    if (list.length) return list;
    const c = await DB.get('kv', 'site');
    const cached = c && c.data && c.data.settings && Array.isArray(c.data.settings.support_phones) ? c.data.settings.support_phones.filter(Rules.phone) : [];
    if (cached.length) return cached;
    const r = await Site.load(true);
    return r && r.settings && Array.isArray(r.settings.support_phones) ? r.settings.support_phones.filter(Rules.phone) : [];
  }
  function button(phone, text, primary) {
    const a = document.createElement('a');
    a.className = 'btn ' + (primary ? 'primary' : 'outline') + ' full support-btn';
    a.href = Rules.whatsapp(phone, text);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const num = document.createElement('span'); num.dir = 'ltr'; num.textContent = phone;
    a.append(Social.icon('whatsapp'), 'تواصل مع دعم المنصة', num);
    return a;
  }
  async function fill(box, text, extra) {
    if (!box) return;
    const list = await phones(extra);
    box.replaceChildren(...list.map((p, i) => button(p, text, !i)));
    box.hidden = !list.length;
  }
  return { phones, button, fill };
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
    facebook: ['M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z', 'فيسبوك'],
    youtube: ['M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', 'يوتيوب'],
    instagram: ['M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077', 'إنستجرام'],
    tiktok: ['M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z', 'تيك توك'],
    telegram: ['M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z', 'تيليجرام'],
    whatsapp: ['M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z', 'واتساب']
  };
  function icon(name) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon brand'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS(NS, 'path'); p.setAttribute('d', PATHS[name][0]); s.append(p); return s; }
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
