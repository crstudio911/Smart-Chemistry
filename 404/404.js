(async () => {
  const page = document.body.dataset.page;
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const home = new URL('index.html', BASE);
  const back = (() => {
    const b = params.get('back') || '';
    if (!/^\/(?!\/)/.test(b) || b.includes('\\') || /\/404\//.test(b)) return null;
    const u = new URL(b, location.origin);
    return u.origin === location.origin ? u : null;
  })();
  const leave = () => location.replace(back || home);
  const say = (text, type = 'error') => { const box = $('#feedback'); if (!box) return; box.textContent = text; box.dataset.type = type; box.hidden = !text; };
  const time = (ms, zone) => new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short', ...(zone ? { timeZone: zone } : {}) }).format(new Date(ms));
  await App.ready;
  if (page === 'update') {
    const check = async manual => {
      const r = await Site.load(true);
      if (r && r.settings && !r.settings.maintenance) { leave(); return; }
      if (r && r.settings && r.settings.maintenance_message) $('#message').textContent = r.settings.maintenance_message;
      if (manual) say(r ? 'لسه الصيانة شغالة. هنرجعك أوتوماتيك أول ما تخلص.' : App.message('network'), r ? 'info' : 'error');
    };
    $('#retry').addEventListener('click', async e => { const btn = e.currentTarget; App.busy(btn, true); await check(true); App.busy(btn, false); });
    check(false);
    setInterval(() => check(false), 30000);
  }
  const supportText = {
    blocked: 'السلام عليكم، حسابي اتوقف مؤقتًا على Smart Chemistry وظهرلي «تم تأمين اتصالك». محتاج مساعدة.',
    time: 'السلام عليكم، ظهرلي إن وقت جهازي مش مظبوط على Smart Chemistry ومش عارف أظبطه.',
    err: 'السلام عليكم، ظهرلي خطأ على Smart Chemistry.',
    update: 'السلام عليكم، عندي سؤال بخصوص صيانة Smart Chemistry.',
    dis: 'السلام عليكم، عندي مشكلة في الاتصال بـ Smart Chemistry.',
    no: 'السلام عليكم، فتحت رابط على Smart Chemistry وظهرلي إن الصفحة مش موجودة.'
  };
  if (page !== 'blocked') Support.fill($('#support'), supportText[page] || supportText.err).catch(() => {});
  if (page === 'blocked') {
    const reasons = { devtools: 'محاولة فتح أدوات المطور', source: 'محاولة عرض كود الصفحة', server: 'طلبات مشبوهة اترصدت على الخادم', attack: 'طلبات مشبوهة اترصدت على الخادم', tamper: 'محاولة تعديل الصفحة' };
    const pad = n => String(n).padStart(2, '0');
    let info = null, timer = 0, checking = false;
    const draw = () => {
      if (!info) { $('#countdown').hidden = true; return; }
      const ms = Math.max(info.until - Date.now(), 0), sec = Math.ceil(ms / 1000);
      $('#countdown').hidden = false;
      $('#left').textContent = pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
      $('#until').textContent = 'لحد ' + time(info.until);
      if (ms <= 0) check(false);
    };
    const show = async () => {
      info = await DB.get('kv', 'blocked');
      if (info) info.until = Number(info.until) || Number(info.at) + 86400000;
      $('#reason').textContent = 'السبب: ' + (reasons[info && info.reason] || reasons.tamper) + '.';
      Support.fill($('#support'), supportText.blocked, info && info.support).catch(() => {});
      draw();
    };
    const check = async manual => {
      if (checking) return;
      checking = true;
      const r = await App.api('site');
      checking = false;
      if (r.ok) { clearInterval(timer); await DB.del('kv', 'blocked'); say('تم رفع الإيقاف. جاري رجوعك للمنصة…', 'success'); setTimeout(() => location.replace(home), 900); return; }
      if (r.code === 'blocked') { await show(); if (manual) say('الإيقاف لسه ساري. استنى لحد ما العداد يخلص أو تواصل مع دعم المنصة.', 'error'); return; }
      if (manual) say(App.message(r.code), 'info');
    };
    document.addEventListener('guard:blocked', show);
    $('#retry').addEventListener('click', async e => { const btn = e.currentTarget; App.busy(btn, true); await check(true); App.busy(btn, false); });
    await show();
    timer = setInterval(draw, 1000);
    setInterval(() => check(false), 60000);
    check(false);
  }
  if (page === 'err') {
    const target = new URL(App.token() ? 'main/main.html' : 'index.html', BASE);
    let left = 5;
    const n = $('#count');
    const go = () => location.replace(target);
    $('#home').href = target.href;
    const timer = setInterval(() => { left--; n.textContent = String(Math.max(left, 0)); if (left <= 0) { clearInterval(timer); go(); } }, 1000);
  }
  if (page === 'time') {
    let real = null, busy = false;
    const draw = () => {
      $('#device-time').textContent = time(Date.now());
      $('#real-time').textContent = real ? time(Date.now() + real.offset, real.tz) : '—';
    };
    const fresh = () => {
      const u = new URL(location.href);
      u.searchParams.set('t', String(Date.now()));
      location.replace(u);
    };
    const reloaded = Number(params.get('t')) || 0;
    const check = async manual => {
      if (busy) return;
      busy = true;
      const t0 = Date.now();
      const r = await App.api('time');
      const t1 = Date.now();
      busy = false;
      if (!r.ok || typeof r.now !== 'number') { if (manual) say(App.message(r.code)); return; }
      const now = r.now + (t1 - t0) / 2;
      real = { offset: now - t1, tz: r.tz || undefined };
      draw();
      const result = Rules.clock(now, t1, r.tz);
      await DB.put('kv', { at: t1, ok: result.ok, reason: result.reason }, 'time');
      if (result.ok) { say('الوقت مظبوط دلوقتي. جاري رجوعك…', 'success'); setTimeout(leave, 900); return; }
      $('#detail').textContent = result.reason === 'clock' ? `ساعة جهازك متأخرة أو متقدمة حوالي ${result.skew} دقيقة.` : `المنطقة الزمنية على جهازك مختلفة عن منطقتك بحوالي ${Math.round(result.zone / 60)} ساعة.`;
      if (manual && Date.now() - reloaded > 15000) { say('بنعيد قراءة وقت جهازك…', 'info'); setTimeout(fresh, 400); return; }
      if (manual) say('لسه الوقت مش مظبوط. فعّل «ضبط الوقت والمنطقة تلقائيًا» من إعدادات جهازك.', 'info');
    };
    let hidden = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { hidden = Date.now(); return; }
      if (hidden && Date.now() - hidden > 1500) fresh();
    });
    draw();
    setInterval(draw, 1000);
    setInterval(() => check(false), 20000);
    $('#retry').addEventListener('click', async e => { const btn = e.currentTarget; App.busy(btn, true); await check(true); App.busy(btn, false); });
    check(false);
  }
  if (page === 'dis') {
    const tryBack = () => { if (navigator.onLine) leave(); else say('لسه مفيش اتصال بالإنترنت.', 'info'); };
    window.addEventListener('online', () => { say('رجع الاتصال. جاري رجوعك…', 'success'); setTimeout(leave, 700); });
    $('#retry').addEventListener('click', tryBack);
  }
  if (page === 'no') {
    $('#main').href = new URL(App.token() ? 'main/main.html' : 'login/login.html', BASE).href;
    $('#main').textContent = App.token() ? 'الرئيسية' : 'تسجيل الدخول';
  }
})();
