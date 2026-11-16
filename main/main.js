const token = App.token();
if (!token) location.replace('../login/login.html');
const sidebar = document.querySelector('.sidebar');
const toggle = document.querySelector('[data-sidebar-toggle]');
const links = document.querySelectorAll('.side-nav a');
const title = document.querySelector('#section-title');
function setSidebar(open) { sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); document.querySelector('.scrim').hidden = !open; }
toggle.addEventListener('click', () => setSidebar(!sidebar.classList.contains('open')));
document.querySelector('.scrim').addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setSidebar(false); });
function route() {
  const id = (location.hash || '#main').slice(1);
  const link = [...links].find(l => l.hash === '#' + id) || links[0];
  links.forEach(l => { const on = l === link; l.classList.toggle('active', on); if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  title.textContent = link.dataset.title;
  setSidebar(false);
}
window.addEventListener('hashchange', route);
route();
async function logout() {
  await App.api('logout', { token });
  App.clearToken();
  location.replace('../login/login.html');
}
document.querySelector('[data-logout]').addEventListener('click', logout);
(async () => {
  if (!token) return;
  const r = await App.api('me', { token });
  if (!r.ok) {
    if (r.code === 'network' || r.code === 'server') { document.querySelector('#user-name').textContent = App.message(r.code); return; }
    App.clearToken();
    location.replace('../login/login.html');
    return;
  }
  document.querySelector('#user-name').textContent = r.user.name;
  document.querySelector('#user-grade').textContent = r.user.grade;
  const av = document.querySelector('#user-photo');
  if (r.user.photo && /^https:\/\/i\.ibb\.co\//.test(r.user.photo)) { av.src = r.user.photo; av.hidden = false; }
  document.body.classList.remove('pending');
})();
