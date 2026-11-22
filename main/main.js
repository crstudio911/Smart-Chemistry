(async () => {
await App.ready;
const token = App.token();
if (!token) { location.replace('../login/login.html'); return; }
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('[data-sidebar-toggle]');
const links = document.querySelectorAll('.side-nav a');
const periodicPage = !!document.querySelector('#periodic-panel');
const labPage = !!document.querySelector('#lab-panel');
const mainPage = !!document.querySelector('#home-panel');
const title = document.querySelector('#section-title');
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const svg = name => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + name); s.append(u); return s; };
let user = null, owner = '', courses = [], coursesState = 'idle', notes = [], done = new Set(), editing = null, filter = 'all', scrollTo = '', balance = 0, walletState = 'idle', viewKey = '', results = [], lastBoot = 0, booting = null;
const Player = window.Player || null;
const Quiz = window.Quiz || null;
const QUIZ_KINDS = ['homework', 'exam'];
const kindIcon = k => ({ video: 'video', pdf: 'file', homework: 'clipboard', exam: 'timer' }[k] || 'file');
function feedback(box, text, type = 'error') { if (!box) return; box.textContent = text; box.dataset.type = type; box.hidden = !text; }
function setSidebar(open) { sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); $('.scrim').hidden = !open; }
toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
$('.scrim').addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setSidebar(false); });
function parts() { return (location.hash || '#main').slice(1).split('/').map(x => decodeURIComponent(x)); }
function route() {
  const [id] = parts();
  const section = id === 'course' || id === 'lecture' ? '#courses' : '#' + id;
  const link = [...links].find(l => labPage ? l.pathname.endsWith('/lab.html') : periodicPage ? l.pathname.endsWith('/periodic.html') : l.hash === section && l.pathname === location.pathname) || links[0];
  links.forEach(l => { const on = l === link; l.classList.toggle('active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  title.textContent = link.dataset.title;
  for (const [panel, hash] of [['#profile-panel', '#profile'], ['#home-panel', '#main'], ['#courses-panel', '#courses'], ['#notes-panel', '#notes'], ['#wallet-panel', '#wallet'], ['#results-panel', '#results']]) { const p = $(panel); if (p) p.hidden = !user || link.hash !== hash || (hash === '#courses' && id === 'lecture'); }
  if ($('#lecture-panel')) $('#lecture-panel').hidden = !user || id !== 'lecture';
  setSidebar(false);
  if (mainPage && user) renderView();
  if (scrollTo && link.hash === '#courses') { const target = document.getElementById(scrollTo); scrollTo = ''; if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' })); }
}
window.addEventListener('hashchange', route);
route();
function expired(code) {
  if (!['session', 'wait', 'ban', 'reject'].includes(code)) return false;
  App.clearToken().then(() => location.replace('../login/login.html?notice=' + encodeURIComponent(code)));
  return true;
}
const fmtDate = (v, opts) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('ar-EG', opts || { day: 'numeric', month: 'long', year: 'numeric' }) : '—'; };
const fmtTime = v => new Date(v).toLocaleString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const localInput = iso => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const itemKey = (l, it) => owner + '|' + l.id + '|' + it.id;
function uniqueOpen(list) {
  const seen = new Map();
  list.forEach(c => c.lectures.forEach(l => { if (l.open && !seen.has(l.id)) seen.set(l.id, { c, l }); }));
  return [...seen.values()];
}
function lectureStats(l) { const finished = l.items.filter(it => done.has(itemKey(l, it))).length; return { finished, total: l.items.length }; }
function courseStats(c) {
  let finished = 0, total = 0;
  c.lectures.forEach(l => { if (!l.open) return; const s = lectureStats(l); finished += s.finished; total += s.total; });
  return { finished, total, percent: total ? Math.round(finished * 100 / total) : 0 };
}
function totals() {
  let finished = 0, total = 0;
  uniqueOpen(courses).forEach(({ l }) => { const s = lectureStats(l); finished += s.finished; total += s.total; });
  return { finished, total, percent: total ? Math.round(finished * 100 / total) : 0 };
}
const money = n => Number(n || 0).toLocaleString('ar-EG') + ' جنيه';
const upcoming = () => notes.filter(n => n.remindAt && !n.done && !n.notified).sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
function bar(percent) { const b = el('div', 'bar'); b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100'); b.setAttribute('aria-valuenow', String(percent)); const f = el('span'); f.style.setProperty('--p', percent); b.append(f); return b; }
function showUser(data) {
  user = data;
  $('#user-name').textContent = user.name;
  $('#user-grade').textContent = user.grade;
  const photo = user.photo && /^https:\/\/i\.ibb\.co\//.test(user.photo) ? user.photo : '';
  const letter = Array.from(String(user.name || '').trim())[0] || 'S';
  for (const id of ['#user-initials', '#profile-placeholder']) { const n = $(id); if (n) { n.textContent = letter; n.hidden = false; } }
  const shown = (img, ok) => { img.hidden = !ok; if (img.id === 'profile-photo' && $('#profile-placeholder')) $('#profile-placeholder').hidden = ok; };
  for (const id of ['#user-photo', '#profile-photo']) {
    const img = $(id);
    if (!img) continue;
    if (!photo) { img.onload = img.onerror = null; img.removeAttribute('src'); shown(img, false); continue; }
    img.onload = () => shown(img, img.naturalWidth > 8 && img.naturalHeight > 8);
    img.onerror = () => shown(img, false);
    if (img.getAttribute('src') === photo && img.complete) { shown(img, img.naturalWidth > 8 && img.naturalHeight > 8); continue; }
    shown(img, false);
    img.src = photo;
  }
  for (const [id, value] of [['name', user.name], ['student', user.studentPhone], ['grade', user.grade], ['gender', user.gender]]) { const n = $('#profile-' + id); if (n) n.textContent = value || '—'; }
  if ($('#profile-created')) $('#profile-created').textContent = fmtDate(user.createdAt);
  if ($('#profile-mode')) $('#profile-mode').textContent = user.mode === 'center' ? 'سنتر' : 'أونلاين';
  if ($('#profile-center')) $('#profile-center').textContent = user.mode === 'center' ? [user.centerName, user.scheduleLabel].filter(Boolean).join(' · ') || '—' : 'مش تابع لسنتر';
  if ($('#profile-birth')) $('#profile-birth').textContent = user.birthDate ? fmtDate(user.birthDate + 'T00:00:00') : '—';
  if ($('#welcome-name')) $('#welcome-name').textContent = user.name.split(' ')[0];
  if ($('#home-grade')) $('#home-grade').textContent = user.grade;
  if ($('#courses-grade')) $('#courses-grade').textContent = 'سنتك: ' + user.grade;
  resetProfile();
  document.body.classList.remove('pending');
  route();
}
function resetProfile() {
  if (!user || !$('#profile-form')) return;
  $('#profile-parent').textContent = user.parentPhone || '—';
  $('#profile-email').value = user.email || '';
  document.querySelectorAll('#profile-form .error').forEach(n => { n.textContent = ''; });
  document.querySelectorAll('#profile-form input').forEach(n => n.removeAttribute('aria-invalid'));
}
async function loadLocal() {
  owner = user.studentPhone;
  notes = (await DB.owned('notes', owner)) || [];
  done = new Set(((await DB.owned('progress', owner)) || []).map(p => p.key));
  const cached = await DB.get('kv', 'courses:' + owner);
  if (cached && Array.isArray(cached.courses)) courses = cached.courses.filter(c => c && Array.isArray(c.lectures));
}
function loadCourses() { return refreshBoot(false); }
function applyBoot(r) {
  if (Array.isArray(r.courses)) courses = r.courses.filter(c => c && typeof c.id === 'string' && Array.isArray(c.lectures));
  if (typeof r.balance === 'number') balance = r.balance;
  if (Array.isArray(r.results)) results = r.results;
  if (Array.isArray(r.notices)) renderNotices(r.notices);
  coursesState = 'ready';
}
function refreshBoot(silent) {
  if (booting) return booting;
  booting = (async () => {
    if (!silent && !courses.length) { coursesState = 'loading'; feedback($('#courses-feedback'), 'جاري تحميل الدورات…', 'info'); }
    if ($('#courses-retry')) $('#courses-retry').hidden = true;
    const r = await App.api('boot', { token });
    lastBoot = Date.now();
    if (!r.ok || !r.user) {
      if (expired(r.code)) return r;
      coursesState = courses.length ? 'ready' : 'error';
      if (!silent) feedback($('#courses-feedback'), courses.length ? 'تعذر التحديث، وده آخر نسخة محفوظة على جهازك.' : App.message(r.code), courses.length ? 'info' : 'error');
      if ($('#courses-retry')) $('#courses-retry').hidden = false;
      renderAll();
      return r;
    }
    feedback($('#courses-feedback'), '');
    DB.put('kv', { t: token.slice(-16), at: Date.now(), data: r }, 'boot');
    if (Quiz && Quiz.running()) { courses = r.courses || courses; balance = r.balance; results = r.results || results; return r; }
    if (!user || JSON.stringify(user) !== JSON.stringify(r.user)) showUser(r.user);
    applyBoot(r);
    renderAll();
    return r;
  })();
  booting.finally(() => { booting = null; });
  return booting;
}
function renderAll() { renderHome(); renderCourses(); renderNoteCourses(); renderNotes(); renderResults(); renderView(); }
function nextItem() {
  for (const { c, l } of uniqueOpen(courses)) { const it = l.items.find(x => !done.has(itemKey(l, x))); if (it) return { c, l, it }; }
  return null;
}
const lectureHref = (c, l, it) => '#lecture/' + encodeURIComponent(c.id) + '/' + encodeURIComponent(l.id) + (it ? '/' + encodeURIComponent(it.id) : '');
function renderHome() {
  if (!mainPage || !user) return;
  const t = totals();
  $('#home-percent').textContent = t.percent + '%';
  $('#home-ring').style.setProperty('--p', t.percent);
  $('#home-ring').setAttribute('aria-label', 'نسبة الإنجاز ' + t.percent + '%');
  $('#stat-lessons').textContent = t.finished + ' / ' + t.total;
  $('#stat-courses').textContent = String(courses.length);
  $('#stat-reminders').textContent = String(upcoming().length);
  $('#stat-notes').textContent = String(notes.filter(n => !n.done).length);
  $('#home-headline').textContent = !t.total ? 'دوراتك هتظهر هنا.' : t.percent === 100 ? 'خلّصت كل محاضراتك.' : t.finished ? `أنجزت ${t.percent}% من محاضراتك.` : 'ابدأ أول محاضرة النهارده.';
  $('#home-sub').textContent = !t.total ? (coursesState === 'loading' ? 'جاري تحميل دوراتك…' : 'لسه مفيش محاضرات مفتوحة ليك.') : t.percent === 100 ? 'راجع ملاحظاتك وخليك جاهز للامتحان.' : `فاضلك ${t.total - t.finished} من الدروس والواجبات، كمّل من مكان ما وقفت.`;
  const next = $('#home-next');
  const target = nextItem();
  next.replaceChildren();
  if (target) {
    const s = lectureStats(target.l);
    const card = el('div', 'next-lesson');
    card.append(el('span', 'profile-eyebrow', target.c.title + ' · ' + target.l.title), el('strong', '', target.it.title), bar(s.total ? Math.round(s.finished * 100 / s.total) : 0), el('small', 'muted', `${s.finished} من ${s.total} في المحاضرة`));
    const actions = el('div', 'next-actions');
    const open = el('a', 'btn primary small'); open.href = lectureHref(target.c, target.l, target.it); open.append(svg(target.it.kind === 'video' ? 'play' : kindIcon(target.it.kind)), { video: 'كمّل الفيديو', pdf: 'افتح الملف', homework: 'حل الواجب', exam: 'ادخل الامتحان' }[target.it.kind] || 'افتح');
    const all = el('a', 'btn outline small', 'افتح الدورة'); all.href = '#course/' + encodeURIComponent(target.c.id);
    actions.append(open, all);
    card.append(actions);
    next.append(card);
  } else next.append(el('p', 'empty', t.total ? 'مفيش حاجة فاضلة. شغل عظيم!' : 'أول ما تتفتح لك محاضرة، هتلاقي اللي جاي هنا.'));
  const rem = $('#home-reminders');
  const soon = upcoming().slice(0, 4);
  rem.replaceChildren(...(soon.length ? soon.map(n => { const li = el('li'); const d = el('div'); d.append(el('strong', '', n.title), el('small', '', fmtTime(n.remindAt))); li.append(svg('clock'), d); return li; }) : [el('li', 'empty', 'مفيش تذكيرات جاية. حدد ميعاد لأي ملاحظة.')]));
  const recent = $('#home-notes');
  const latest = notes.filter(n => !n.done).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3);
  recent.replaceChildren(...(latest.length ? latest.map(n => { const li = el('li'); const d = el('div'); d.append(el('strong', '', n.title), el('small', '', n.text ? n.text.slice(0, 90) : fmtDate(n.updatedAt))); li.append(svg('note'), d); return li; }) : [el('li', 'empty', 'لسه مكتبتش ملاحظات.')]));
  const list = $('#home-courses');
  list.replaceChildren(...(courses.length ? courses.map(c => { const s = courseStats(c); const row = el('a', 'progress-row'); row.href = '#course/' + encodeURIComponent(c.id); const head = el('div', 'progress-head'); head.append(el('strong', '', c.title), el('b', '', s.percent + '%')); head.lastChild.dir = 'ltr'; row.append(head, bar(s.percent), el('small', 'muted', s.total ? `${s.finished} من ${s.total}` : 'لسه مفيش محتوى مفتوح')); return row; }) : [el('p', 'empty', coursesState === 'loading' ? 'جاري التحميل…' : 'مفيش دورات ليك لحد دلوقتي.')]));
}
function cover(c, cls) {
  const box = el('div', cls);
  if (c.image && /^https:\/\/i\.ibb\.co\//.test(c.image)) { const img = el('img'); img.src = c.image; img.alt = ''; img.loading = 'lazy'; img.onerror = () => { img.remove(); box.append(svg('book')); }; box.append(img); }
  else box.append(svg('book'));
  return box;
}
function badge(text, tone) { const b = el('span', 'badge', text); if (tone) b.dataset.tone = tone; return b; }
function renderCourses() {
  if (!mainPage || !user) return;
  const t = totals();
  $('#courses-percent').textContent = t.percent + '%';
  const box = $('#courses-list');
  if (!courses.length) {
    if (coursesState === 'loading') { box.replaceChildren(); return; }
    const empty = el('div', 'courses-empty'); empty.append(svg('book'), el('h3', '', 'لسه مفيش دورات'), el('p', '', 'أول ما مستر إسلام ينشر دورات ليك، هتظهر هنا.'));
    box.replaceChildren(empty);
    return;
  }
  box.replaceChildren(...courses.map(c => {
    const s = courseStats(c);
    const card = el('a', 'course-card'); card.id = 'course-' + c.id; card.href = '#course/' + encodeURIComponent(c.id);
    const body = el('div', 'course-body');
    const tags = el('div', 'badges');
    tags.append(c.free ? badge('مجانية', 'ok') : badge('مدفوعة', 'warn'), badge(c.lectures.length + ' محاضرة'));
    if (c.owned) tags.append(badge('مشترك', 'ok'));
    body.append(tags, el('h3', '', c.title));
    if (c.description) body.append(el('p', '', c.description.length > 140 ? c.description.slice(0, 140) + '…' : c.description));
    const foot = el('div', 'course-foot'); const pct = el('b', 'course-percent', s.percent + '%'); pct.dir = 'ltr';
    foot.append(el('small', 'muted', s.total ? `${s.finished} من ${s.total} خلصتهم` : 'افتح الدورة وشوف المحاضرات'), pct);
    body.append(bar(s.percent), foot);
    card.append(cover(c, 'course-cover'), body);
    return card;
  }));
}
function findCourse(id) { return courses.find(c => c.id === id); }
function renderView() {
  if (!mainPage || !user) return;
  const [id, a, b, c] = parts();
  const list = $('#courses-list'), view = $('#course-view');
  if (id !== 'lecture') { if (Player) Player.destroy(); if (Quiz) Quiz.destroy('nav'); viewKey = ''; }
  if (id === 'course') { list.hidden = true; view.hidden = false; renderCourseView(a); }
  else { list.hidden = false; view.hidden = true; }
  if (id === 'lecture') renderLecture(a, b, c);
  if (id === 'wallet') loadWallet();
  if (id === 'results' && Date.now() - lastBoot > 30000) refreshResults();
}
function renderCourseView(id) {
  const view = $('#course-view');
  const c = findCourse(id);
  if (!c) { view.replaceChildren(el('p', 'empty', coursesState === 'loading' ? 'جاري التحميل…' : 'الدورة دي مش متاحة ليك.')); return; }
  title.textContent = c.title;
  const back = el('a', 'btn outline small'); back.href = '#courses'; back.append(svg('arrow-r'), 'كل الدورات');
  const head = el('header', 'course-hero');
  const info = el('div');
  const tags = el('div', 'badges'); tags.append(c.free ? badge('كل المحتوى مجاني', 'ok') : badge('دورة مدفوعة', 'warn'));
  if (c.owned) tags.append(badge('مشترك في الدورة كاملة', 'ok'));
  info.append(tags, el('h2', '', c.title));
  if (c.description) info.append(el('p', '', c.description));
  const s = courseStats(c);
  info.append(bar(s.percent), el('small', 'muted', s.total ? `${s.finished} من ${s.total} خلصتهم` : 'لسه مفيش محتوى مفتوح'));
  if (!c.free && c.price && !c.owned) {
    const buyAll = buyButton('course', c, 'اشترك في الدورة كاملة بـ ' + money(c.price));
    info.append(el('div', 'next-actions'));
    info.lastChild.append(buyAll);
  }
  head.append(cover(c, 'course-cover big'), info);
  const fb = el('p', 'alert'); fb.id = 'course-feedback'; fb.setAttribute('role', 'status'); fb.hidden = true;
  const lectures = el('ol', 'lectures');
  if (!c.lectures.length) lectures.append(el('li', 'empty', 'لسه مفيش محاضرات في الدورة دي.'));
  c.lectures.forEach((l, i) => {
    const li = el('li', 'lecture' + (l.open ? '' : ' locked'));
    const num = el('span', 'lecture-num', String(i + 1).padStart(2, '0')); num.dir = 'ltr';
    const body = el('div', 'lecture-body');
    const st = lectureStats(l);
    body.append(el('h3', '', l.title));
    if (l.description) body.append(el('p', 'muted', l.description));
    const kinds = el('div', 'lecture-items');
    l.items.forEach(it => { const t = el('span', 'item-chip' + (done.has(itemKey(l, it)) ? ' done' : '') + (QUIZ_KINDS.includes(it.kind) ? ' ' + it.kind : '')); t.append(svg(kindIcon(it.kind)), it.title); kinds.append(t); });
    if (!l.items.length) kinds.append(el('span', 'muted', 'المحتوى هيتضاف قريب'));
    body.append(kinds);
    const side = el('div', 'lecture-actions');
    if (l.open) {
      if (l.items.length) { const go = el('a', 'btn primary small'); go.href = lectureHref(c, l); go.append(svg('play'), st.finished ? 'كمّل' : 'ابدأ'); side.append(go, el('small', 'muted', `${st.finished} / ${st.total}`)); }
      side.prepend(badge(c.free || !l.price ? 'مجانية' : 'مفتوحة', 'ok'));
    } else {
      side.append(badge(money(l.price), 'warn'), buyButton('lecture', l, 'افتح بالمحفظة'));
      const code = el('a', 'text-link', 'عندي كود'); code.href = '#wallet'; side.append(code);
    }
    li.append(num, body, side);
    lectures.append(li);
  });
  view.replaceChildren(el('div', 'view-back'), head, fb, el('h3', 'section-label', 'المحاضرات'), lectures);
  view.firstChild.append(back);
}
function buyButton(kind, item, label) {
  const b = el('button', 'btn outline small'); b.type = 'button'; b.append(svg('wallet'), label);
  let armed = 0;
  b.addEventListener('click', async () => {
    const fb = $('#course-feedback');
    if (!armed) { armed = setTimeout(() => { armed = 0; b.lastChild.textContent = label; }, 5000); b.lastChild.textContent = 'اضغط تاني للتأكيد · ' + money(kind === 'course' ? item.price : item.price); feedback(fb, `رصيدك ${money(balance)}. هيتخصم ${money(item.price)} لو أكدت.`, 'info'); return; }
    clearTimeout(armed); armed = 0;
    App.busy(b, true);
    const r = await App.api('buy', { token, kind, id: item.id });
    App.busy(b, false);
    b.lastChild.textContent = label;
    if (expired(r.code)) return;
    if (r.ok) { balance = r.balance; feedback(fb, `تم فتح «${r.title}». رصيدك دلوقتي ${money(r.balance)}.`, 'success'); await loadCourses(); return; }
    if (r.code === 'balance') { const t = el('span', '', `رصيدك ${money(r.balance)} مش كفاية (المطلوب ${money(r.price)}). `); const a = el('a', 'text-link', 'اشحن المحفظة'); a.href = '#wallet'; fb.replaceChildren(t, a); fb.dataset.type = 'error'; fb.hidden = false; return; }
    feedback(fb, App.message(r.code));
  });
  return b;
}
async function setItem(l, it, on) {
  const key = itemKey(l, it);
  if (on) { done.add(key); await DB.put('progress', { key, owner, lecture: l.id, item: it.id, at: new Date().toISOString() }); }
  else { done.delete(key); await DB.del('progress', key); }
  renderHome(); renderCourses();
  if (parts()[0] === 'lecture') renderItems();
}
let current = null;
function renderItems() {
  if (!current) return;
  const { c, l, it } = current;
  const list = $('#lecture-items');
  list.replaceChildren(...l.items.map((x, i) => {
    const li = el('li', 'item' + (x.id === it.id ? ' active' : '') + (done.has(itemKey(l, x)) ? ' done' : ''));
    const a = el('a', 'item-link'); a.href = lectureHref(c, l, x);
    if (x.id === it.id) a.setAttribute('aria-current', 'true');
    const n = el('span', 'lecture-num', String(i + 1).padStart(2, '0')); n.dir = 'ltr';
    a.append(n, svg(kindIcon(x.kind)), el('span', '', x.title));
    const tick = el('button', 'icon-btn'); tick.type = 'button'; const on = done.has(itemKey(l, x)); tick.setAttribute('aria-pressed', String(on)); tick.setAttribute('aria-label', on ? 'إلغاء «خلصته»' : 'علّمه خلصته'); tick.append(svg('check'));
    tick.addEventListener('click', () => setItem(l, x, !done.has(itemKey(l, x))));
    li.append(a, tick);
    return li;
  }));
}
async function renderLecture(courseId, lectureId, itemId) {
  const c = findCourse(courseId);
  const l = c && c.lectures.find(x => x.id === lectureId);
  const box = $('#lecture-feedback');
  if (!c || !l) { feedback(box, coursesState === 'loading' || coursesState === 'idle' ? 'جاري التحميل…' : 'المحاضرة دي مش متاحة ليك.', coursesState === 'loading' ? 'info' : 'error'); $('#stage').replaceChildren(); $('#lecture-items').replaceChildren(); return; }
  $('#lecture-back').href = '#course/' + encodeURIComponent(c.id);
  $('#lecture-course').textContent = c.title;
  $('#lecture-title').textContent = l.title;
  title.textContent = l.title;
  if (!l.open) { feedback(box, 'المحاضرة دي مقفولة. افتحها من صفحة الدورة بالمحفظة أو بكود.', 'error'); $('#stage').replaceChildren(); $('#lecture-items').replaceChildren(); return; }
  const it = l.items.find(x => x.id === itemId) || l.items.find(x => !done.has(itemKey(l, x))) || l.items[0];
  if (!it) { feedback(box, 'المحاضرة دي لسه مفيهاش محتوى.', 'info'); return; }
  current = { c, l, it };
  renderItems();
  const key = c.id + '|' + l.id + '|' + it.id;
  if (viewKey === key) return;
  viewKey = key;
  feedback(box, '');
  const stage = $('#stage');
  if (Player) Player.destroy();
  if (Quiz) Quiz.destroy('nav');
  $('.lecture-grid').classList.toggle('quiz-mode', QUIZ_KINDS.includes(it.kind));
  if (QUIZ_KINDS.includes(it.kind)) {
    if (!Quiz) return;
    Quiz.mount(stage, {
      token, lecture: l.id, item: it.id, title: it.title, api: (action, p) => App.api(action, p), expired,
      onInfo: info => { if (info.attempt && info.attempt.status !== 'open' && !done.has(itemKey(l, it))) setItem(l, it, true); },
      onDone: () => { if (!done.has(itemKey(l, it))) setItem(l, it, true); refreshResults(); }
    });
    return;
  }
  stage.replaceChildren(el('p', 'loading-line', it.kind === 'video' ? 'جاري تجهيز الفيديو…' : 'جاري فتح الملف…'));
  const ask = mode => App.api('open', { token, lecture: l.id, item: it.id, mode });
  const r = await ask(it.kind === 'video' ? 'stream' : 'view');
  if (viewKey !== key) return;
  if (!r.ok || !r.url) { if (expired(r.code)) return; viewKey = ''; stage.replaceChildren(); feedback(box, App.message(r.code)); return; }
  if (!Player) return;
  const posKey = 'pos:' + owner + '|' + it.id;
  if (it.kind === 'video') {
    const saved = await DB.get('kv', posKey);
    Player.video(stage, {
      url: r.url, mark: r.mark, resume: saved && typeof saved.t === 'number' ? saved.t : 0,
      onProgress: (t, d) => { if (Number.isFinite(t)) DB.put('kv', { t: d && t > d - 8 ? 0 : t, at: Date.now() }, posKey); },
      onEnd: () => { if (!done.has(itemKey(l, it))) setItem(l, it, true); },
      refresh: async () => { const x = await ask('stream'); return x.ok ? x.url : ''; }
    });
  } else {
    Player.pdf(stage, { url: r.url, mark: r.mark, tab: async () => { const x = await ask('tab'); if (!x.ok) feedback(box, App.message(x.code)); return x.ok ? x.url : ''; } });
  }
}
async function loadWallet() {
  if (!$('#wallet-panel') || walletState === 'loading') return;
  walletState = 'loading';
  $('#wallet-balance').textContent = balance.toLocaleString('ar-EG');
  const r = await App.api('wallet', { token });
  walletState = 'idle';
  if (!r.ok) { if (!expired(r.code)) feedback($('#wallet-feedback'), App.message(r.code)); return; }
  balance = r.balance;
  $('#wallet-balance').textContent = r.balance.toLocaleString('ar-EG');
  const KIND = { charge: 'شحن بكود', buy: 'شراء', admin: 'من الإدارة' };
  $('#wallet-history').replaceChildren(...(r.history.length ? r.history.map(x => { const li = el('li'); const d = el('div'); d.append(el('strong', '', (KIND[x.kind] || x.kind) + (x.note ? ' · ' + x.note : '')), el('small', '', fmtTime(x.at))); const amt = el('b', 'amount' + (x.amount < 0 ? ' minus' : ''), (x.amount > 0 ? '+' : '') + x.amount.toLocaleString('ar-EG')); li.append(svg(x.amount < 0 ? 'book' : 'wallet'), d, amt); return li; }) : [el('li', 'empty', 'لسه مفيش عمليات على محفظتك.')]));
  $('#wallet-owned').replaceChildren(...(r.owned.length ? r.owned.map(x => { const li = el('li'); const d = el('div'); d.append(el('strong', '', x.title), el('small', '', x.kind === 'course' ? 'دورة كاملة' : 'محاضرة')); li.append(svg('check'), d); return li; }) : [el('li', 'empty', 'المحتوى اللي هتفتحه بكود أو بالمحفظة هيظهر هنا.')]));
}
$('#redeem-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('#redeem-code'), box = $('#wallet-feedback');
  const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  input.value = code.length > 8 ? code.slice(0, 4) + '-' + code.slice(4, 8) + '-' + code.slice(8, 12) : code;
  feedback(box, '');
  if (!fieldError(input, /^[A-HJ-NP-Z2-9]{12}$/.test(code) ? '' : 'الكود 12 حرف ورقم بالشكل XXXX-XXXX-XXXX.')) return;
  const btn = $('#redeem-submit');
  App.busy(btn, true);
  const r = await App.api('redeem', { token, code });
  App.busy(btn, false);
  if (expired(r.code)) return;
  if (!r.ok) { feedback(box, r.code === 'code_invalid' && typeof r.left === 'number' && r.left >= 0 ? App.message(r.code) + ` فاضلك ${r.left} محاولات.` : App.message(r.code)); return; }
  input.value = '';
  feedback(box, r.kind === 'wallet' ? `تم شحن ${money(r.amount)}. رصيدك دلوقتي ${money(r.balance)}.` : 'تم فتح: ' + r.unlocked.join('، ') + '.', 'success');
  balance = r.balance;
  walletState = 'idle';
  await loadWallet();
  loadCourses();
});
function renderNoteCourses() {
  const sel = $('#note-course');
  if (!sel) return;
  const value = sel.value;
  const known = courses.map(c => [c.id, c.title]);
  notes.forEach(n => { if (n.course && !known.some(k => k[0] === n.course) && n.courseTitle) known.push([n.course, n.courseTitle]); });
  sel.replaceChildren(new Option('بدون دورة', ''), ...known.map(([id, t]) => new Option(t, id)));
  sel.value = known.some(k => k[0] === value) ? value : '';
}
function fieldError(input, text) { input.setAttribute('aria-invalid', String(!!text)); const e = input.closest('.field').querySelector('.error'); if (e) e.textContent = text; return !text; }
function startNote(courseId) {
  resetNote();
  if (courseId) $('#note-course').value = courseId;
  $('#note-title').focus();
}
function resetNote() {
  if (!$('#note-form')) return;
  editing = null;
  $('#note-form').reset();
  $('#note-cancel').hidden = true;
  $('#note-save').firstChild.textContent = 'حفظ الملاحظة';
  document.querySelectorAll('#note-form [aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
  document.querySelectorAll('#note-form .error').forEach(n => { n.textContent = ''; });
}
function editNote(n) {
  editing = n;
  $('#note-title').value = n.title;
  $('#note-text').value = n.text;
  $('#note-course').value = n.course || '';
  $('#note-remind').value = n.remindAt ? localInput(n.remindAt) : '';
  $('#note-cancel').hidden = false;
  $('#note-save').firstChild.textContent = 'حفظ التعديل';
  feedback($('#note-feedback'), '');
  $('#note-form').scrollIntoView({ block: 'start' });
  $('#note-title').focus();
}
$('#note-cancel')?.addEventListener('click', () => { resetNote(); feedback($('#note-feedback'), ''); });
$('#note-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('#note-title'), x = $('#note-text'), r = $('#note-remind'), c = $('#note-course');
  t.value = t.value.trim().replace(/\s+/g, ' ');
  const a = fieldError(t, t.value.length >= 2 ? '' : 'اكتب عنوان من حرفين على الأقل.');
  const b = fieldError(x, x.value.length <= 1000 ? '' : 'الملاحظة أطول من 1000 حرف.');
  const when = r.value ? new Date(r.value) : null;
  const changed = !editing || (when ? when.toISOString() : '') !== (editing.remindAt || '');
  const d = fieldError(r, when && Number.isNaN(when.getTime()) ? 'الميعاد مش صحيح.' : when && changed && when.getTime() <= Date.now() + 30000 ? 'اختار ميعاد في المستقبل.' : '');
  if (!a || !b || !d) return;
  const now = new Date().toISOString();
  const course = courses.find(k => k.id === c.value);
  const note = Object.assign(editing || { id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)), owner, createdAt: now, done: false }, {
    title: t.value, text: x.value.trim(), course: c.value, courseTitle: course ? course.title : (editing && editing.course === c.value ? editing.courseTitle || '' : ''), remindAt: when ? when.toISOString() : '', updatedAt: now
  });
  if (changed) note.notified = false;
  await DB.put('notes', note);
  if (!editing) notes.push(note);
  const wasEdit = !!editing;
  resetNote();
  feedback($('#note-feedback'), wasEdit ? 'تم حفظ التعديل.' : note.remindAt ? 'اتحفظت الملاحظة، وهنفكرك ' + fmtTime(note.remindAt) + '.' : 'اتحفظت الملاحظة على جهازك.', 'success');
  renderHome(); renderNotes();
});
document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
  filter = btn.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { const on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  renderNotes();
}));
function renderNotes() {
  const list = $('#notes-list');
  if (!list) return;
  const shown = notes.filter(n => filter === 'all' ? true : filter === 'done' ? n.done : n.remindAt && !n.done).sort((a, b) => (a.done - b.done) || ((a.remindAt && !a.notified ? Date.parse(a.remindAt) : Infinity) - (b.remindAt && !b.notified ? Date.parse(b.remindAt) : Infinity)) || (Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
  if (!shown.length) { list.replaceChildren(el('li', 'empty', filter === 'done' ? 'مفيش ملاحظات خلصتها.' : filter === 'remind' ? 'مفيش ملاحظات بتذكير.' : 'لسه مفيش ملاحظات. اكتب أول ملاحظة فوق.')); return; }
  list.replaceChildren(...shown.map(n => {
    const li = el('li', 'note-item' + (n.done ? ' done' : ''));
    const body = el('div', 'note-body');
    body.append(el('h3', '', n.title));
    if (n.text) body.append(el('p', '', n.text));
    const meta = el('div', 'note-meta');
    const courseName = n.course ? ((courses.find(c => c.id === n.course) || {}).title || n.courseTitle) : '';
    if (courseName) { const s = el('span', 'tag'); s.append(svg('book'), courseName); meta.append(s); }
    if (n.remindAt) { const late = Date.parse(n.remindAt) <= Date.now(); const s = el('span', 'tag' + (late && !n.done ? ' late' : '')); s.append(svg('clock'), (late ? 'فات: ' : '') + fmtTime(n.remindAt)); meta.append(s); }
    meta.append(el('small', 'muted', 'آخر تعديل ' + fmtDate(n.updatedAt, { day: 'numeric', month: 'short' })));
    body.append(meta);
    const actions = el('div', 'note-actions');
    const tick = el('button', 'icon-btn'); tick.type = 'button'; tick.setAttribute('aria-label', n.done ? 'إرجاع الملاحظة' : 'علّمها خلصت'); tick.setAttribute('aria-pressed', String(!!n.done)); tick.append(svg('check'));
    tick.addEventListener('click', async () => { n.done = !n.done; n.updatedAt = new Date().toISOString(); await DB.put('notes', n); renderHome(); renderNotes(); });
    const edit = el('button', 'icon-btn'); edit.type = 'button'; edit.setAttribute('aria-label', 'تعديل الملاحظة'); edit.append(svg('edit'));
    edit.addEventListener('click', () => editNote(n));
    const del = el('button', 'icon-btn danger'); del.type = 'button'; del.setAttribute('aria-label', 'حذف الملاحظة'); del.append(svg('trash'));
    let armed = 0;
    del.addEventListener('click', async () => {
      if (!armed) { armed = setTimeout(() => { armed = 0; del.classList.remove('armed'); del.setAttribute('aria-label', 'حذف الملاحظة'); }, 4000); del.classList.add('armed'); del.setAttribute('aria-label', 'اضغط تاني للحذف'); feedback($('#note-feedback'), 'اضغط على الحذف مرة تانية للتأكيد.', 'info'); return; }
      clearTimeout(armed);
      await DB.del('notes', n.id);
      notes = notes.filter(x => x !== n);
      if (editing === n) resetNote();
      feedback($('#note-feedback'), 'اتحذفت الملاحظة.', 'success');
      renderHome(); renderNotes();
    });
    actions.append(tick, edit, del);
    li.append(body, actions);
    return li;
  }));
}
function setupNotify() {
  const btn = $('#notify-enable');
  if (!btn || !('Notification' in window)) return;
  btn.hidden = Notification.permission !== 'default';
  btn.addEventListener('click', async () => {
    const p = await Notification.requestPermission();
    btn.hidden = p !== 'default';
    feedback($('#note-feedback'), p === 'granted' ? 'تم تفعيل الإشعارات. هتوصلك التذكيرات حتى لو الصفحة في الخلفية.' : 'الإشعارات مقفولة من المتصفح، والتذكير هيظهر جوه الموقع بس.', p === 'granted' ? 'success' : 'info');
  });
}
function toastBox() { let box = $('#toasts'); if (!box) { box = el('div', 'toasts'); box.id = 'toasts'; box.setAttribute('aria-live', 'assertive'); document.body.append(box); } return box; }
function toast(n) {
  const t = el('div', 'toast');
  t.setAttribute('role', 'alert');
  const head = el('div', 'toast-head'); head.append(svg('bell'), el('strong', '', 'تذكير: ' + n.title));
  t.append(head);
  if (n.text) t.append(el('p', '', n.text.slice(0, 160)));
  const actions = el('div', 'toast-actions');
  const finish = el('button', 'btn primary small', 'خلصت'); finish.type = 'button';
  finish.addEventListener('click', async () => { n.done = true; n.updatedAt = new Date().toISOString(); await DB.put('notes', n); t.remove(); renderHome(); renderNotes(); });
  const open = el('a', 'btn outline small', 'افتح الملاحظات'); open.href = mainPage ? '#notes' : '../main/main.html#notes';
  open.addEventListener('click', () => t.remove());
  const close = el('button', 'icon-btn ghost'); close.type = 'button'; close.setAttribute('aria-label', 'إغلاق التذكير'); close.append(svg('close'));
  close.addEventListener('click', () => t.remove());
  actions.append(finish, open, close);
  t.append(actions);
  toastBox().append(t);
}
async function checkReminders() {
  const now = Date.now();
  const due = notes.filter(n => n.remindAt && !n.notified && !n.done && Date.parse(n.remindAt) <= now);
  for (const n of due) {
    n.notified = true;
    await DB.put('notes', n);
    toast(n);
    if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('تذكير: ' + n.title, { body: (n.text || '').slice(0, 120), icon: '../img/logo.png', tag: n.id }); } catch {} }
  }
  if (due.length) { renderHome(); renderNotes(); }
}
function noticeBar() {
  let bar = $('#notices');
  if (!bar) { bar = el('section', 'notices'); bar.id = 'notices'; bar.setAttribute('aria-label', 'الإشعارات'); $('.main').prepend(bar); }
  return bar;
}
async function renderNotices(list) {
  if (!owner || !Array.isArray(list)) return;
  const dismissed = new Set((await DB.get('kv', 'dismissed:' + owner)) || []);
  const shown = list.filter(n => n && typeof n.id === 'string' && !dismissed.has(n.id + ':' + n.rev));
  const bar = noticeBar();
  bar.replaceChildren(...shown.map(n => {
    const item = el('div', 'notice');
    item.dataset.level = ['info', 'warn', 'important'].includes(n.level) ? n.level : 'info';
    item.setAttribute('role', n.level === 'important' ? 'alert' : 'status');
    const body = el('div', 'notice-body');
    body.append(el('strong', '', n.title));
    if (n.body) body.append(el('p', '', n.body));
    const close = el('button', 'icon-btn ghost notice-close'); close.type = 'button'; close.setAttribute('aria-label', 'إغلاق الإشعار'); close.append(svg('close'));
    close.addEventListener('click', async () => {
      const set = new Set((await DB.get('kv', 'dismissed:' + owner)) || []);
      set.add(n.id + ':' + n.rev);
      await DB.put('kv', [...set].slice(-200), 'dismissed:' + owner);
      item.remove();
      if (!bar.children.length) bar.hidden = true;
    });
    item.append(svg(n.level === 'info' ? 'bell' : 'alert'), body, close);
    return item;
  }));
  bar.hidden = !shown.length;
}
const RESULT_STATUS = { done: ['اتسلم', 'ok'], left: ['خرجت قبل التسليم', 'warn'], time: ['الوقت خلص', 'warn'], open: ['لسه مكملتش', ''] };
async function refreshResults() {
  const r = await App.api('results', { token });
  if (r.ok && Array.isArray(r.results)) { results = r.results; renderResults(); }
  else if (!r.ok) expired(r.code);
}
function renderResults() {
  const list = $('#results-list');
  if (!list) return;
  const finished = results.filter(x => x.status !== 'open' && typeof x.score === 'number' && x.total);
  const avg = finished.length ? Math.round(finished.reduce((m, x) => m + x.score / x.total, 0) * 100 / finished.length) : 0;
  $('#results-avg').textContent = finished.length ? avg + '%' : '—';
  $('#results-count').textContent = String(finished.length);
  $('#results-exams').textContent = String(finished.filter(x => x.kind === 'exam').length);
  $('#results-best').textContent = finished.length ? Math.max(...finished.map(x => Math.round(x.score * 100 / x.total))) + '%' : '—';
  if (!results.length) { list.replaceChildren(el('li', 'empty', 'لسه محلّتش واجبات أو امتحانات. هتلاقيهم جوه المحاضرات.')); return; }
  list.replaceChildren(...results.map(x => {
    const li = el('li', 'result-row');
    const ic = el('span', 'result-icon'); ic.dataset.kind = x.kind; ic.append(svg(kindIcon(x.kind)));
    const body = el('div', 'result-body');
    const st = RESULT_STATUS[x.status] || [x.status, ''];
    const tag = badge(x.kind === 'exam' ? 'امتحان' : 'واجب', x.kind === 'exam' ? 'bad' : 'ok');
    body.append(el('strong', '', x.title), el('small', 'muted', fmtTime(x.submittedAt || x.startedAt) + ' · ' + st[0]));
    const p = x.total && typeof x.score === 'number' ? Math.round(x.score * 100 / x.total) : 0;
    const side = el('div', 'result-score');
    const sc = el('b', '', typeof x.score === 'number' ? x.score + ' / ' + x.total : '—'); sc.dir = 'ltr';
    side.append(sc, bar(p));
    li.append(ic, body, tag, side);
    return li;
  }));
}
async function loadUser() {
  $('#user-retry').hidden = true;
  const cached = await DB.get('kv', 'boot');
  const hit = cached && cached.t === token.slice(-16) && cached.data && cached.data.user ? cached.data : null;
  if (hit) await start(hit);
  else feedback($('#page-feedback'), 'جاري تحميل حسابك…', 'info');
  const r = await refreshBoot(!!hit);
  if (!user) {
    if (r && !r.ok && !expired(r.code)) { feedback($('#page-feedback'), App.message(r.code)); $('#user-name').textContent = 'تعذر تحميل الحساب'; $('#user-retry').hidden = false; }
    return;
  }
  if (!hit && r && r.ok) await start(r);
}
async function start(data) {
  if (start.done) return;
  start.done = true;
  feedback($('#page-feedback'), '');
  showUser(data.user);
  owner = user.studentPhone;
  await loadLocal();
  applyBoot(data);
  renderAll();
  checkReminders();
  if (!loadUser.timer) loadUser.timer = setInterval(checkReminders, 15000);
  if ($('#home-announcement')) Site.load().then(s => { const text = s && s.settings && s.settings.announcement; if (text) { $('#home-announcement').textContent = text; $('#home-announcement').hidden = false; } });
  const stale = () => !document.hidden && navigator.onLine && Date.now() - lastBoot > 60000 && !(Quiz && Quiz.running());
  document.addEventListener('visibilitychange', () => { if (stale()) refreshBoot(true); });
  window.addEventListener('online', () => { if (!(Quiz && Quiz.running())) refreshBoot(true); });
  setInterval(() => { if (stale() && Date.now() - lastBoot > 300000) refreshBoot(true); }, 60000);
}
$('#user-retry').addEventListener('click', loadUser);
$('#courses-retry')?.addEventListener('click', () => refreshBoot(false));
$('#profile-cancel')?.addEventListener('click', () => { $('#profile-verify').hidden = true; $('#profile-email').readOnly = false; $('#profile-password').value = ''; $('#profile-otp').value = ''; resetProfile(); feedback($('#profile-feedback'), 'تم إلغاء التغييرات غير المحفوظة.', 'info'); });
$('#profile-email')?.addEventListener('focus', () => App.prepare('profile'), { once: true });
$('#profile-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!user) return;
  const email = $('#profile-email'), box = $('#profile-feedback');
  email.value = email.value.trim().toLowerCase();
  feedback(box, '');
  if (!fieldError(email, Rules.email(email.value) ? '' : 'استخدم بريد Gmail أو Yahoo أو Hotmail أو Outlook أو iCloud.')) return;
  if (email.value === (user.email || '')) { feedback(box, 'مفيش تغييرات جديدة للحفظ.', 'info'); return; }
  const btn = $('#profile-save');
  const controls = [...document.querySelectorAll('#profile-form input, #profile-cancel')];
  App.busy(btn, true);
  controls.forEach(n => { n.disabled = true; });
  const pending = !$('#profile-verify').hidden;
  const r = pending ? await App.api('profileVerify', { token, otp: $('#profile-otp').value.trim() }) : await App.api('profile', { token, email: email.value, password: $('#profile-password').value });
  App.busy(btn, false);
  controls.forEach(n => { n.disabled = false; });
  if (expired(r.code)) return;
  if (r.ok && r.pending) { $('#profile-verify').hidden = false; $('#profile-email').readOnly = true; $('#profile-password').value = ''; $('#profile-otp').focus(); feedback(box, 'أرسلنا كودًا للبريد الجديد. اكتبه لتأكيد التغيير.', 'info'); }
  else if (r.ok && r.user) { $('#profile-verify').hidden = true; $('#profile-email').readOnly = false; $('#profile-password').value = ''; $('#profile-otp').value = ''; showUser(r.user); feedback(box, 'تم حفظ بيانات التواصل بنجاح.', 'success'); }
  else feedback(box, App.message(r.code));
});
$('[data-logout]').addEventListener('click', async () => {
  const btn = $('[data-logout]');
  App.busy(btn, true);
  const r = await App.api('logout', { token });
  App.busy(btn, false);
  if (!r.ok) { if (!expired(r.code)) feedback($('#page-feedback'), 'تعذر تسجيل الخروج من الخادم. حاول تاني.'); return; }
  await App.clearToken();
  location.replace('../login/login.html?notice=logout');
});
setupNotify();
loadUser();
})();
