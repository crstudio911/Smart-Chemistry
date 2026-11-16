if (App.token()) location.replace('../main/main.html');
const $ = s => document.querySelector(s);
const tabs = document.querySelectorAll('[data-tab]');
const panels = { login: $('#login-panel'), register: $('#register-panel') };
function showTab(name) {
  tabs.forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
  Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== name; });
}
tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
function setError(input, text) {
  const field = input.closest('.field');
  const box = field?.querySelector('.error');
  input.setAttribute('aria-invalid', text ? 'true' : 'false');
  if (box) box.textContent = text || '';
  return !text;
}
function alertBox(el, text, type = 'error') { el.textContent = text; el.dataset.type = type; el.hidden = !text; }
function busy(btn, on) { btn.disabled = on; btn.classList.toggle('loading', on); }
document.querySelectorAll('[data-phone]').forEach(i => i.addEventListener('input', () => { i.value = Rules.digits(i.value).slice(0, 11); }));
document.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', () => {
  const input = b.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  b.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  b.querySelector('use').setAttribute('href', show ? '#eye-off' : '#eye');
}));
const loginForm = $('#login-form');
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const phone = $('#login-phone'), pass = $('#login-password'), box = $('#login-alert');
  alertBox(box, '');
  const a = setError(phone, Rules.phone(phone.value) ? '' : 'اكتب رقم صحيح من 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015.');
  const b = setError(pass, pass.value ? '' : 'اكتب كلمة المرور.');
  if (!a || !b) return;
  const btn = loginForm.querySelector('[type=submit]');
  busy(btn, true);
  const r = await App.api('login', { phone: phone.value, password: pass.value });
  busy(btn, false);
  if (r.ok && r.token) { App.setToken(r.token); location.replace('../main/main.html'); return; }
  alertBox(box, App.message(r.code), r.code === 'wait' ? 'info' : 'error');
});
const steps = [...document.querySelectorAll('.step')];
const dots = [...document.querySelectorAll('.stepper li')];
let current = 0;
let photoData = '';
let gradesLoaded = false;
function goStep(i) {
  current = i;
  steps.forEach((s, n) => { s.hidden = n !== i; });
  dots.forEach((d, n) => { d.classList.toggle('active', n === i); d.classList.toggle('done', n < i); if (n === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
  $('#step-back').hidden = i === 0;
  $('#step-next').hidden = i === steps.length - 1;
  $('#register-submit').hidden = i !== steps.length - 1;
  if (i === 2 && !gradesLoaded) loadGrades();
  steps[i].querySelector('input,select,button')?.focus();
}
async function loadGrades() {
  const sel = $('#reg-grade'), box = $('#grade-alert');
  sel.innerHTML = '<option value="">جاري التحميل...</option>';
  alertBox(box, '');
  const r = await App.api('grades');
  if (!r.ok || !Array.isArray(r.grades)) {
    sel.innerHTML = '<option value="">تعذر التحميل</option>';
    alertBox(box, App.message(r.code));
    $('#grade-retry').hidden = false;
    return;
  }
  $('#grade-retry').hidden = true;
  gradesLoaded = true;
  sel.innerHTML = '<option value="">اختار سنتك الدراسية</option>';
  r.grades.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.append(o); });
  if (!r.grades.length) alertBox(box, 'لا توجد سنوات دراسية متاحة حاليًا.');
}
$('#grade-retry').addEventListener('click', loadGrades);
const validators = [
  () => {
    const n = $('#reg-name'), p = $('#reg-password'), c = $('#reg-confirm');
    n.value = Rules.cleanName(n.value);
    const a = setError(n, Rules.name(n.value) ? '' : 'اكتب اسمك كلمتين أو أكتر، بالعربي أو الإنجليزي بس.');
    const b = setError(p, Rules.password(p.value) ? '' : 'كلمة المرور لازم تكون 6 أحرف أو أكتر، إنجليزي وأرقام ورموز بس.');
    const d = setError(c, c.value && c.value === p.value ? '' : 'كلمة المرور مش متطابقة.');
    return a && b && d;
  },
  () => {
    const s = $('#reg-student'), g = $('#reg-parent');
    const a = setError(s, Rules.phone(s.value) ? '' : 'رقم الطالب لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015.');
    let b = setError(g, Rules.phone(g.value) ? '' : 'رقم ولي الأمر لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015.');
    if (a && b && s.value === g.value) b = setError(g, 'رقم ولي الأمر لازم يكون مختلف عن رقم الطالب.');
    return a && b;
  },
  () => {
    const gender = document.querySelector('[name=gender]:checked');
    const genderBox = $('#gender-error');
    genderBox.textContent = gender ? '' : 'اختار النوع.';
    const g = $('#reg-grade');
    const b = setError(g, g.value ? '' : 'اختار سنتك الدراسية.');
    return !!gender && b;
  },
  () => { $('#photo-error').textContent = photoData ? '' : 'لازم ترفع صورة شخصية ليك.'; return !!photoData; },
  () => {
    const e = $('#reg-email'), t = $('#reg-terms');
    e.value = e.value.trim().toLowerCase();
    const a = setError(e, Rules.email(e.value) ? '' : 'استخدم بريد من Gmail أو Yahoo أو Hotmail أو Outlook أو iCloud.');
    $('#terms-error').textContent = t.checked ? '' : 'لازم توافق على شروط الاستخدام وسياسة الخصوصية.';
    return a && t.checked;
  }
];
$('#step-next').addEventListener('click', () => { if (validators[current]()) goStep(current + 1); });
$('#step-back').addEventListener('click', () => goStep(current - 1));
function compress(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(); };
    img.src = url;
  });
}
$('#reg-photo').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  const err = $('#photo-error');
  photoData = '';
  $('#photo-preview').hidden = true;
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { err.textContent = 'ارفع صورة JPG أو PNG أو WEBP أقل من 10 ميجا.'; return; }
  try {
    photoData = await compress(file);
    $('#photo-preview img').src = photoData;
    $('#photo-preview').hidden = false;
    err.textContent = '';
  } catch { err.textContent = 'تعذر قراءة الصورة. جرّب صورة تانية.'; }
});
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => document.getElementById(b.dataset.open)?.showModal()));
document.querySelectorAll('dialog').forEach(d => {
  d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
});
$('#register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const box = $('#register-alert');
  alertBox(box, '');
  for (let i = 0; i < validators.length; i++) if (!validators[i]()) { goStep(i); validators[i](); return; }
  const btn = $('#register-submit');
  busy(btn, true);
  const r = await App.api('register', {
    name: $('#reg-name').value,
    password: $('#reg-password').value,
    studentPhone: $('#reg-student').value,
    parentPhone: $('#reg-parent').value,
    gender: document.querySelector('[name=gender]:checked').value,
    grade: $('#reg-grade').value,
    email: $('#reg-email').value,
    photo: photoData.split(',')[1],
    agree: true
  });
  busy(btn, false);
  if (r.ok) {
    $('#register-form').reset();
    photoData = '';
    $('#photo-preview').hidden = true;
    goStep(0);
    showTab('login');
    alertBox($('#login-alert'), 'تم إنشاء حسابك بنجاح. حسابك دلوقتي تحت المراجعة.', 'success');
    return;
  }
  if (r.code === 'exists') goStep(1);
  alertBox(box, App.message(r.code));
});
goStep(0);
if (location.hash === '#register') showTab('register');
