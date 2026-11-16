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
let user = null, owner = '', courses = [], coursesState = 'idle', notes = [], done = new Set(), editing = null, filter = 'all', scrollTo = '';
function feedback(box, text, type = 'error') { if (!box) return; box.textContent = text; box.dataset.type = type; box.hidden = !text; }
function setSidebar(open) { sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); $('.scrim').hidden = !open; }
toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
$('.scrim').addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setSidebar(false); });
function route() {
  const id = (location.hash || '#main').slice(1);
  const link = [...links].find(l => labPage ? l.pathname.endsWith('/lab.html') : periodicPage ? l.pathname.endsWith('/periodic.html') : l.hash === '#' + id) || links[0];
  links.forEach(l => { const on = l === link; l.classList.toggle('active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  title.textContent = link.dataset.title;
  for (const [panel, hash] of [['#profile-panel', '#profile'], ['#home-panel', '#main'], ['#courses-panel', '#courses'], ['#notes-panel', '#notes']]) { const p = $(panel); if (p) p.hidden = !user || link.hash !== hash; }
  setSidebar(false);
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
const lessonKey = (c, l) => owner + '|' + c.id + '|' + l;
function courseStats(c) { const finished = c.lessons.filter(l => done.has(lessonKey(c, l))).length; return { finished, total: c.lessons.length, percent: c.lessons.length ? Math.round(finished * 100 / c.lessons.length) : 0 }; }
function totals() {
  let finished = 0, total = 0;
  courses.forEach(c => { const s = courseStats(c); finished += s.finished; total += s.total; });
  return { finished, total, percent: total ? Math.round(finished * 100 / total) : 0 };
}
const upcoming = () => notes.filter(n => n.remindAt && !n.done && !n.notified).sort((a, b) => Date.parse(a.remindAt) - Date.parse(b.remindAt));
function bar(percent) { const b = el('div', 'bar'); b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100'); b.setAttribute('aria-valuenow', String(percent)); const f = el('span'); f.style.setProperty('--p', percent); b.append(f); return b; }
function showUser(data) {
  user = data;
  $('#user-name').textContent = user.name;
  $('#user-grade').textContent = user.grade;
  const photo = user.photo && /^https:\/\/i\.ibb\.co\//.test(user.photo) ? user.photo : '';
  for (const id of ['#user-photo', '#profile-photo']) {
    const img = $(id);
    if (!img) continue;
    img.hidden = !photo;
    if (photo) { img.src = photo; img.onerror = () => { img.hidden = true; if ($('#profile-placeholder')) $('#profile-placeholder').hidden = false; }; }
  }
  if ($('#profile-placeholder')) $('#profile-placeholder').hidden = !!photo;
  for (const [id, value] of [['name', user.name], ['student', user.studentPhone], ['grade', user.grade], ['gender', user.gender]]) { const n = $('#profile-' + id); if (n) n.textContent = value || '—'; }
  if ($('#profile-created')) $('#profile-created').textContent = fmtDate(user.createdAt);
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
  if (cached && Array.isArray(cached.courses)) courses = cached.courses;
}
async function loadCourses() {
  if (!mainPage) return;
  coursesState = 'loading';
  feedback($('#courses-feedback'), courses.length ? '' : 'جاري تحميل الدورات…', 'info');
  $('#courses-retry').hidden = true;
  renderCourses();
  const r = await App.api('courses', { token });
  if (r.ok && Array.isArray(r.courses)) {
    courses = r.courses.filter(c => c && typeof c.id === 'string' && Array.isArray(c.lessons));
    coursesState = 'ready';
    feedback($('#courses-feedback'), '');
    DB.put('kv', { at: new Date().toISOString(), courses }, 'courses:' + owner);
  } else {
    if (expired(r.code)) return;
    coursesState = 'error';
    feedback($('#courses-feedback'), courses.length ? 'تعذر تحديث الدورات، وده آخر نسخة محفوظة على جهازك.' : App.message(r.code), courses.length ? 'info' : 'error');
    $('#courses-retry').hidden = false;
  }
  renderAll();
}
function renderAll() { renderHome(); renderCourses(); renderNoteCourses(); renderNotes(); }
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
  $('#home-headline').textContent = !t.total ? 'دوراتك هتظهر هنا.' : t.percent === 100 ? 'خلّصت كل دروسك.' : t.finished ? `أنجزت ${t.percent}% من دوراتك.` : 'ابدأ أول درس النهارده.';
  $('#home-sub').textContent = !t.total ? (coursesState === 'loading' ? 'جاري تحميل دورات سنتك…' : 'لسه مفيش دورات منشورة لسنتك الدراسية.') : t.percent === 100 ? 'راجع ملاحظاتك وخليك جاهز للامتحان.' : `فاضلك ${t.total - t.finished} درس، كمّل من مكان ما وقفت.`;
  const next = $('#home-next');
  const target = courses.map(c => ({ c, l: c.lessons.find(l => !done.has(lessonKey(c, l))) })).find(x => x.l);
  next.replaceChildren();
  if (target) {
    const s = courseStats(target.c);
    const card = el('div', 'next-lesson');
    card.append(el('span', 'profile-eyebrow', target.c.title), el('strong', '', target.l), bar(s.percent), el('small', 'muted', `${s.finished} من ${s.total} دروس في الدورة`));
    const actions = el('div', 'next-actions');
    const mark = el('button', 'btn primary small'); mark.type = 'button'; mark.append(svg('check'), 'خلصت الدرس ده');
    mark.addEventListener('click', () => setLesson(target.c, target.l, true));
    const open = el('a', 'btn outline small', 'افتح الدورة'); open.href = '#courses';
    open.addEventListener('click', () => { scrollTo = 'course-' + target.c.id; });
    actions.append(mark, open);
    card.append(actions);
    next.append(card);
  } else next.append(el('p', 'empty', t.total ? 'مفيش دروس فاضلة. شغل عظيم!' : 'أول ما تتنشر دورة لسنتك، هتلاقي الدرس الجاي هنا.'));
  const rem = $('#home-reminders');
  const soon = upcoming().slice(0, 4);
  rem.replaceChildren(...(soon.length ? soon.map(n => { const li = el('li'); li.append(svg('clock'), el('div', '', ''), ''); li.children[1].append(el('strong', '', n.title), el('small', '', fmtTime(n.remindAt))); return li; }) : [el('li', 'empty', 'مفيش تذكيرات جاية. حدد ميعاد لأي ملاحظة.')]));
  const recent = $('#home-notes');
  const latest = notes.filter(n => !n.done).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 3);
  recent.replaceChildren(...(latest.length ? latest.map(n => { const li = el('li'); const d = el('div'); d.append(el('strong', '', n.title), el('small', '', n.text ? n.text.slice(0, 90) : fmtDate(n.updatedAt))); li.append(svg('note'), d); return li; }) : [el('li', 'empty', 'لسه مكتبتش ملاحظات.')]));
  const list = $('#home-courses');
  list.replaceChildren(...(courses.length ? courses.map(c => { const s = courseStats(c); const row = el('a', 'progress-row'); row.href = '#courses'; row.addEventListener('click', () => { scrollTo = 'course-' + c.id; }); const head = el('div', 'progress-head'); head.append(el('strong', '', c.title), el('b', '', s.percent + '%')); head.lastChild.dir = 'ltr'; row.append(head, bar(s.percent), el('small', 'muted', `${s.finished} من ${s.total} دروس`)); return row; }) : [el('p', 'empty', coursesState === 'loading' ? 'جاري التحميل…' : 'مفيش دورات لسنتك لحد دلوقتي.')]));
}
function renderCourses() {
  if (!mainPage || !user) return;
  const t = totals();
  $('#courses-percent').textContent = t.percent + '%';
  const box = $('#courses-list');
  if (!courses.length) {
    if (coursesState === 'loading') { box.replaceChildren(); return; }
    const empty = el('div', 'courses-empty'); empty.append(svg('book'), el('h3', '', 'لسه مفيش دورات'), el('p', '', 'أول ما مستر إسلام ينشر دورات لسنتك، هتظهر هنا.'));
    box.replaceChildren(empty);
    return;
  }
  box.replaceChildren(...courses.map(c => {
    const s = courseStats(c);
    const card = el('article', 'course-card'); card.id = 'course-' + c.id;
    const head = el('header'); const info = el('div'); info.append(el('h3', '', c.title)); if (c.description) info.append(el('p', '', c.description));
    const pct = el('b', 'course-percent', s.percent + '%'); pct.dir = 'ltr';
    head.append(info, pct);
    const list = el('ol', 'lessons');
    c.lessons.forEach((l, i) => {
      const li = el('li'); const label = el('label', 'lesson'); const box2 = el('input'); box2.type = 'checkbox'; box2.checked = done.has(lessonKey(c, l));
      box2.addEventListener('change', () => setLesson(c, l, box2.checked));
      const num = el('span', 'lesson-num', String(i + 1).padStart(2, '0')); num.dir = 'ltr';
      label.append(box2, num, el('span', '', l)); li.append(label); if (box2.checked) li.classList.add('done'); list.append(li);
    });
    const foot = el('div', 'course-foot');
    const add = el('button', 'btn outline small'); add.type = 'button'; add.append(svg('note'), 'أضف ملاحظة للدورة');
    add.addEventListener('click', () => { location.hash = 'notes'; startNote(c.id); });
    foot.append(el('small', 'muted', `${s.finished} من ${s.total} دروس`), add);
    card.append(head, bar(s.percent), list, foot);
    return card;
  }));
}
async function setLesson(c, l, on) {
  const key = lessonKey(c, l);
  if (on) { done.add(key); await DB.put('progress', { key, owner, course: c.id, lesson: l, at: new Date().toISOString() }); }
  else { done.delete(key); await DB.del('progress', key); }
  renderHome(); renderCourses();
}
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
async function loadNotices() {
  const key = 'notices:' + owner;
  const cached = await DB.get('kv', key);
  const age = cached ? Date.now() - cached.at : -1;
  let list = cached && Array.isArray(cached.list) && age >= 0 && age < 120000 ? cached.list : null;
  if (!list) {
    const r = await App.api('notices', { token });
    if (!r.ok || !Array.isArray(r.notices)) { if (!expired(r.code) && cached && Array.isArray(cached.list)) list = cached.list; else return; }
    else { list = r.notices; await DB.put('kv', { at: Date.now(), list }, key); }
  }
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
async function loadUser() {
  feedback($('#page-feedback'), 'جاري تحميل حسابك…', 'info');
  $('#user-retry').hidden = true;
  const r = await App.api('me', { token });
  if (!r.ok || !r.user) {
    if (expired(r.code)) return;
    feedback($('#page-feedback'), App.message(r.code));
    $('#user-name').textContent = 'تعذر تحميل الحساب';
    $('#user-retry').hidden = false;
    return;
  }
  feedback($('#page-feedback'), '');
  showUser(r.user);
  owner = user.studentPhone;
  loadNotices();
  await loadLocal();
  renderAll();
  checkReminders();
  if (!loadUser.timer) loadUser.timer = setInterval(checkReminders, 15000);
  loadCourses();
  if ($('#home-announcement')) Site.load().then(s => { const text = s && s.settings && s.settings.announcement; if (text) { $('#home-announcement').textContent = text; $('#home-announcement').hidden = false; } });
}
$('#user-retry').addEventListener('click', loadUser);
$('#courses-retry')?.addEventListener('click', loadCourses);
$('#profile-cancel')?.addEventListener('click', () => { resetProfile(); feedback($('#profile-feedback'), 'تم إلغاء التغييرات غير المحفوظة.', 'info'); });
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
  const r = await App.api('profile', { token, email: email.value });
  App.busy(btn, false);
  controls.forEach(n => { n.disabled = false; });
  if (expired(r.code)) return;
  if (r.ok && r.user) { showUser(r.user); feedback(box, 'تم حفظ بيانات التواصل بنجاح.', 'success'); }
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
