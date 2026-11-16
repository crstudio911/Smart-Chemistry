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
    server: 'حصلت مشكلة في الخادم. حاول تاني بعد شوية.'
  };
  async function api(action, payload = {}) {
    await ready;
    let res;
    try {
      res = await fetch(window.APP_CONFIG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload, device: cache.device }),
        credentials: 'omit',
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
    initTheme, api, message,
    busy(btn, on) { btn.disabled = on; btn.classList.toggle('loading', on); btn.setAttribute('aria-busy', String(on)); },
    ready,
    token: () => cache.token,
    setToken: t => { cache.token = t; return DB.put('kv', t, 'token'); },
    clearToken: () => { cache.token = null; return DB.del('kv', 'token'); }
  };
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
    go('404.html', false);
  }
  async function report(reason) {
    if (off || leaving) return;
    await App.api('flag', { reason });
    block(reason);
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
      if (await DB.get('kv', 'blocked')) { go('404.html', false); return; }
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
      const a = document.createElement('a'); a.className = 'grade'; a.href = s.registration_open === false ? 'login/login.html' : 'login/login.html#register';
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
