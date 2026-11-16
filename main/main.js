const token = App.token();
if (!token) location.replace('../login/login.html');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('[data-sidebar-toggle]');
const links = document.querySelectorAll('.side-nav a');
const periodicPage = !!document.querySelector('#periodic-panel');
const labPage = !!document.querySelector('#lab-panel');
const title = document.querySelector('#section-title');
const $ = s => document.querySelector(s);
let user = null;
function feedback(el, text, type = 'error') { el.textContent = text; el.dataset.type = type; el.hidden = !text; }
function setSidebar(open) { sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); $('.scrim').hidden = !open; }
toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
$('.scrim').addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setSidebar(false); });
function route() {
  const id = (location.hash || '#main').slice(1);
  const link = [...links].find(l => labPage ? l.pathname.endsWith('/lab.html') : periodicPage ? l.pathname.endsWith('/periodic.html') : l.hash === '#' + id) || links[0];
  links.forEach(l => { const on = l === link; l.classList.toggle('active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  title.textContent = link.dataset.title;
  for (const [panel, hash] of [['#profile-panel', '#profile'], ['#home-panel', '#main'], ['#courses-panel', '#courses']]) { const el = $(panel); if (el) el.hidden = !user || link.hash !== hash; }
  setSidebar(false);
}
window.addEventListener('hashchange', route);
route();
function expired(code) {
  if (!['session', 'wait', 'ban'].includes(code)) return false;
  App.clearToken();
  location.replace('../login/login.html?notice=' + encodeURIComponent(code));
  return true;
}
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
  for (const [id, value] of [['name', user.name], ['student', user.studentPhone], ['grade', user.grade], ['gender', user.gender]]) { const el = $('#profile-' + id); if (el) el.textContent = value || '—'; }
  const date = user.createdAt ? new Date(user.createdAt) : null;
  if ($('#profile-created')) $('#profile-created').textContent = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  if ($('#welcome-name')) $('#welcome-name').textContent = user.name.split(' ')[0];
  if ($('#home-grade')) $('#home-grade').textContent = user.grade;
  resetProfile();
  document.body.classList.remove('pending');
  route();
}
function resetProfile() {
  if (!user || !$('#profile-form')) return;
  $('#profile-parent').textContent = user.parentPhone || '—';
  $('#profile-email').value = user.email || '';
  document.querySelectorAll('#profile-form .error').forEach(el => { el.textContent = ''; });
  document.querySelectorAll('#profile-form input').forEach(el => el.removeAttribute('aria-invalid'));
}
async function loadUser() {
  if (!token) return;
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
}
$('#user-retry').addEventListener('click', loadUser);
$('#profile-cancel')?.addEventListener('click', () => { resetProfile(); feedback($('#profile-feedback'), 'تم إلغاء التغييرات غير المحفوظة.', 'info'); });
function fieldError(input, text) { input.setAttribute('aria-invalid', String(!!text)); input.closest('.field').querySelector('.error').textContent = text; return !text; }
$('#profile-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!user) return;
  const email = $('#profile-email'), box = $('#profile-feedback');
  email.value = email.value.trim().toLowerCase();
  feedback(box, '');
  const b = fieldError(email, Rules.email(email.value) ? '' : 'استخدم بريد Gmail أو Yahoo أو Hotmail أو Outlook أو iCloud.');
  if (!b) return;
  if (email.value === (user.email || '')) { feedback(box, 'مفيش تغييرات جديدة للحفظ.', 'info'); return; }
  const btn = $('#profile-save');
  const controls = [...document.querySelectorAll('#profile-form input, #profile-cancel')];
  App.busy(btn, true);
  controls.forEach(el => { el.disabled = true; });
  const r = await App.api('profile', { token, email: email.value });
  App.busy(btn, false);
  controls.forEach(el => { el.disabled = false; });
  if (expired(r.code)) return;
  if (r.ok && r.user) { showUser(r.user); feedback(box, 'تم حفظ بيانات التواصل بنجاح.', 'success'); }
  else feedback(box, App.message(r.code));
});
async function logout() {
  const btn = $('[data-logout]');
  App.busy(btn, true);
  const r = await App.api('logout', { token });
  App.busy(btn, false);
  if (!r.ok) { if (!expired(r.code)) feedback($('#page-feedback'), 'تعذر تسجيل الخروج من الخادم. حاول تاني.'); return; }
  App.clearToken();
  location.replace('../login/login.html?notice=logout');
}
$('[data-logout]').addEventListener('click', logout);
loadUser();
