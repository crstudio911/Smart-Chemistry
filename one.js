window.APP_CONFIG = Object.freeze({
  api: 'https://smartchemistry.mahmoudmomajeed.workers.dev/api'
});
const App = (() => {
  const root = document.documentElement;
  const TOKEN_KEY = 'sc-token';
  const THEME_KEY = 'sc-theme';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
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
    applyTheme(store.get(THEME_KEY) === 'light' ? 'light' : 'dark');
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
      const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(t);
      store.set(THEME_KEY, t);
    }));
  }
  const messages = {
    network: 'تعذر الاتصال بالخادم. تأكد من الإنترنت وحاول تاني.',
    invalid: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
    locked: 'محاولات كتير غلط. استنى ربع ساعة وحاول تاني.',
    wait: 'حسابك تحت المراجعة. هيتفعل أول ما تتم الموافقة عليه.',
    ban: 'تم حظر هذا الحساب.',
    exists: 'رقم الطالب ده مسجل قبل كده.',
    email_exists: 'البريد الإلكتروني ده مستخدم في حساب تاني.',
    validation: 'في بيانات مش صحيحة. راجع الخطوات وحاول تاني.',
    upload: 'تعذر رفع الصورة. حاول تاني.',
    session: 'انتهت الجلسة. سجل دخولك تاني.',
    server: 'حصلت مشكلة في الخادم. حاول تاني بعد شوية.'
  };
  async function api(action, payload = {}) {
    let res;
    try {
      res = await fetch(window.APP_CONFIG.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
    } catch { return { ok: false, code: 'network' }; }
    try { return await res.json(); } catch { return { ok: false, code: 'server' }; }
  }
  const message = code => messages[code] || messages.server;
  return {
    initTheme, api, message,
    token: () => store.get(TOKEN_KEY),
    setToken: t => store.set(TOKEN_KEY, t),
    clearToken: () => store.del(TOKEN_KEY)
  };
})();
const Rules = Object.freeze({
  name: v => /^[\u0621-\u064Aa-zA-Z]{2,}( [\u0621-\u064Aa-zA-Z]{2,})+$/.test(v) && v.length <= 60,
  password: v => /^[\x21-\x7E]{6,64}$/.test(v),
  phone: v => /^01[0125][0-9]{8}$/.test(v),
  email: v => v === '' || (/^[a-z0-9._%+-]{1,64}@(gmail|yahoo|hotmail|outlook|live|icloud|msn)\.com$/.test(v) && v.length <= 100),
  cleanName: v => v.trim().replace(/\s+/g, ' '),
  digits: v => v.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/\D/g, '')
});
App.initTheme();
(() => {
  const menu = document.querySelector('[data-menu]');
  const nav = document.querySelector('#nav');
  if (!menu || !nav) return;
  const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
})();
