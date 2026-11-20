(async () => {
  const page = document.body.dataset.page;
  const $ = s => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const home = new URL('../index.html', location.href);
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
  if (page === 'blocked') {
    const info = await DB.get('kv', 'blocked');
    const reasons = { devtools: 'محاولة فتح أدوات المطور', source: 'محاولة عرض كود الصفحة', server: 'طلبات مشبوهة اترصدت على الخادم', attack: 'طلبات مشبوهة اترصدت على الخادم', tamper: 'محاولة تعديل الصفحة' };
    if (info && info.reason) $('#reason').textContent = 'السبب: ' + (reasons[info.reason] || reasons.tamper) + '.';
    $('#retry').addEventListener('click', async e => {
      const btn = e.currentTarget;
      App.busy(btn, true);
      const r = await App.api('site');
      App.busy(btn, false);
      if (r.ok) { await DB.del('kv', 'blocked'); say('تم رفع الإيقاف. جاري رجوعك للمنصة…', 'success'); setTimeout(() => location.replace(home), 900); return; }
      say(r.code === 'blocked' ? 'الإيقاف لسه ساري. حاول بعدين أو تواصل مع دعم المنصة.' : App.message(r.code), r.code === 'blocked' ? 'error' : 'info');
    });
  }
  if (page === 'err') {
    const target = new URL(App.token() ? '../main/main.html' : '../index.html', location.href);
    let left = 5;
    const n = $('#count');
    const go = () => location.replace(target);
    $('#home').href = target.href;
    const timer = setInterval(() => { left--; n.textContent = String(Math.max(left, 0)); if (left <= 0) { clearInterval(timer); go(); } }, 1000);
  }
  if (page === 'time') {
    let real = null;
    const draw = () => {
      $('#device-time').textContent = time(Date.now());
      $('#real-time').textContent = real ? time(Date.now() + real.offset, real.tz) : '—';
    };
    const check = async manual => {
      const t0 = Date.now();
      const r = await App.api('time');
      const t1 = Date.now();
      if (!r.ok || typeof r.now !== 'number') { if (manual) say(App.message(r.code)); return; }
      const now = r.now + (t1 - t0) / 2;
      real = { offset: now - t1, tz: r.tz || undefined };
      draw();
      const result = Rules.clock(now, t1, r.tz);
      await DB.put('kv', { at: t1, ok: result.ok, reason: result.reason }, 'time');
      if (result.ok) { say('الوقت مظبوط دلوقتي. جاري رجوعك…', 'success'); setTimeout(leave, 900); return; }
      $('#detail').textContent = result.reason === 'clock' ? `ساعة جهازك متأخرة أو متقدمة حوالي ${result.skew} دقيقة.` : `المنطقة الزمنية على جهازك مختلفة عن منطقتك بحوالي ${Math.round(result.zone / 60)} ساعة.`;
      if (manual) say('لسه الوقت مش مظبوط. فعّل «ضبط الوقت تلقائيًا» من إعدادات جهازك.', 'info');
    };
    draw();
    setInterval(draw, 1000);
    $('#retry').addEventListener('click', async e => { const btn = e.currentTarget; App.busy(btn, true); await check(true); App.busy(btn, false); });
    check(false);
  }
  if (page === 'dis') {
    const tryBack = () => { if (navigator.onLine) leave(); else say('لسه مفيش اتصال بالإنترنت.', 'info'); };
    window.addEventListener('online', () => { say('رجع الاتصال. جاري رجوعك…', 'success'); setTimeout(leave, 700); });
    $('#retry').addEventListener('click', tryBack);
  }
  if (page === 'no') {
    $('#main').href = new URL(App.token() ? '../main/main.html' : '../login/login.html', location.href).href;
    $('#main').textContent = App.token() ? 'الرئيسية' : 'تسجيل الدخول';
  }
})();
