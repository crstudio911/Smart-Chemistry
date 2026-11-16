const token = App.token();
if (!token) location.replace('../login/login.html');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('[data-sidebar-toggle]');
const links = document.querySelectorAll('.side-nav a');
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
  const link = [...links].find(l => l.hash === '#' + id) || links[0];
  links.forEach(l => { const on = l === link; l.classList.toggle('active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  title.textContent = link.dataset.title;
  $('#profile-panel').hidden = !user || link.hash !== '#profile';
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
    img.hidden = !photo;
    if (photo) { img.src = photo; img.onerror = () => { img.hidden = true; $('#profile-placeholder').hidden = false; }; }
  }
  $('#profile-placeholder').hidden = !!photo;
  for (const [id, value] of [['name', user.name], ['student', user.studentPhone], ['grade', user.grade], ['gender', user.gender]]) $('#profile-' + id).textContent = value || '—';
  const date = user.createdAt ? new Date(user.createdAt) : null;
  $('#profile-created').textContent = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  resetProfile();
  document.body.classList.remove('pending');
  route();
}
function resetProfile() {
  if (!user) return;
  $('#profile-parent').value = user.parentPhone || '';
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
$('#profile-parent').addEventListener('input', e => { e.target.value = Rules.digits(e.target.value).slice(0, 11); });
$('#profile-cancel').addEventListener('click', () => { resetProfile(); feedback($('#profile-feedback'), 'تم إلغاء التغييرات غير المحفوظة.', 'info'); });
function fieldError(input, text) { input.setAttribute('aria-invalid', String(!!text)); input.closest('.field').querySelector('.error').textContent = text; return !text; }
$('#profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!user) return;
  const parent = $('#profile-parent'), email = $('#profile-email'), box = $('#profile-feedback');
  email.value = email.value.trim().toLowerCase();
  feedback(box, '');
  const a = fieldError(parent, !Rules.phone(parent.value) ? 'اكتب رقم ولي أمر صحيح من 11 رقم.' : parent.value === user.studentPhone ? App.message('parent_same') : '');
  const b = fieldError(email, Rules.email(email.value) ? '' : 'استخدم بريد Gmail أو Yahoo أو Hotmail أو Outlook أو iCloud.');
  if (!a || !b) return;
  if (parent.value === user.parentPhone && email.value === (user.email || '')) { feedback(box, 'مفيش تغييرات جديدة للحفظ.', 'info'); return; }
  const btn = $('#profile-save');
  const controls = [...document.querySelectorAll('#profile-form input, #profile-cancel')];
  App.busy(btn, true);
  controls.forEach(el => { el.disabled = true; });
  const r = await App.api('profile', { token, parentPhone: parent.value, email: email.value });
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
