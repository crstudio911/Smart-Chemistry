App.ready.then(() => { if (App.token()) location.replace('../main/main.html'); });
const $ = s => document.querySelector(s);
const tabs = document.querySelectorAll('[data-tab]');
const panels = { login: $('#login-panel'), register: $('#register-panel'), forgot: $('#forgot-panel'), reject: $('#reject-panel'), fix: $('#fix-panel') };
const HEADINGS = {
  login: ['01 / ACCOUNT', 'أهلًا برجوعك', 'خطوتك الجاية تبدأ من هنا.'],
  register: ['01 / ACCOUNT', 'بداية جديدة مع البروف', 'خلّينا نتعرف عليك.'],
  forgot: ['02 / RECOVERY', 'استعادة كلمة المرور', 'هنتأكد إن الحساب ده بتاعك الأول.'],
  reject: ['03 / REVIEW', 'مراجعة حسابك', 'محتاجين نصحح كام حاجة.'],
  fix: ['03 / REVIEW', 'تصحيح البيانات', 'عدّل اللي كان غلط وابعته للمراجعة.']
};
function showTab(name) {
  const [chapter, title, sub] = HEADINGS[name];
  document.querySelector('.chapter').textContent = chapter;
  $('#auth-title').textContent = title;
  $('#auth-subtitle').textContent = sub;
  $('#auth-tabs').hidden = name !== 'login' && name !== 'register';
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
function busy(btn, on) { App.busy(btn, on); tabs.forEach(t => { t.disabled = on; }); $('#step-back').disabled = on; $('#step-next').disabled = on; }
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
  if (r.ok && r.token) { await App.setToken(r.token); alertBox(box, 'تم تسجيل الدخول بنجاح. جاري فتح حسابك…', 'success'); App.busy(btn, true); location.replace('../main/main.html'); return; }
  if (r.code === 'reject' && r.fix) { pass.value = ''; openReject(r); return; }
  alertBox(box, App.message(r.code), r.code === 'wait' ? 'info' : 'error');
});
const steps = [...document.querySelectorAll('.step')];
const dots = [...document.querySelectorAll('.stepper li')];
let current = 0;
let photoData = '';
let gradesLoaded = false;
let centers = [];
function fillCenters(prefix, gradeSel, keepCenter, keepSchedule) {
  const cs = $('#' + prefix + '-center'), ss = $('#' + prefix + '-schedule');
  cs.replaceChildren(new Option(centers.length ? 'اختار السنتر' : 'مفيش سناتر متاحة دلوقتي', ''), ...centers.map(c => new Option(c.address ? c.name + ' — ' + c.address : c.name, c.id)));
  if (keepCenter && centers.some(c => c.id === keepCenter)) cs.value = keepCenter;
  const fillSchedules = keep => {
    const c = centers.find(x => x.id === cs.value);
    const grade = $(gradeSel).value;
    const list = c ? c.schedules.filter(x => !x.grade || x.grade === grade) : [];
    ss.replaceChildren(new Option(!c ? 'اختار السنتر الأول' : list.length ? 'اختار الميعاد' : 'مفيش مواعيد لسنتك في السنتر ده', ''), ...list.map(x => new Option(x.label, x.id)));
    if (keep && list.some(x => x.id === keep)) ss.value = keep;
  };
  fillSchedules(keepSchedule);
  cs.onchange = () => fillSchedules('');
  $(gradeSel).onchange = () => fillSchedules(ss.value);
}
function modeSync(name, box) {
  const sync = () => { const m = document.querySelector('[name=' + name + ']:checked'); $(box).hidden = !m || m.value !== 'center'; };
  document.querySelectorAll('[name=' + name + ']').forEach(r => r.addEventListener('change', sync));
  return sync;
}
const regModeSync = modeSync('mode', '#center-fields');
const fixModeSync = modeSync('fix-mode', '#fix-center-fields');
function checkMode(name, prefix, errId) {
  const m = document.querySelector('[name=' + name + ']:checked');
  $('#' + errId).textContent = m ? '' : 'اختار أونلاين أو سنتر.';
  if (!m) return null;
  if (m.value === 'online') return { mode: 'online', center: '', schedule: '' };
  const c = $('#' + prefix + '-center'), s = $('#' + prefix + '-schedule');
  const a = setError(c, c.value ? '' : 'اختار السنتر اللي بتحضر فيه.');
  const b = setError(s, s.value ? '' : 'اختار الميعاد.');
  return a && b ? { mode: 'center', center: c.value, schedule: s.value } : null;
}
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
function fillGrades(sel, list, first, keep) {
  sel.replaceChildren(new Option(first, ''), ...list.map(g => new Option(g, g)));
  if (keep && list.includes(keep)) sel.value = keep;
}
async function loadGrades() {
  const sel = $('#reg-grade'), box = $('#grade-alert');
  sel.replaceChildren(new Option('جاري التحميل...', ''));
  alertBox(box, '');
  const r = await App.api('grades');
  if (!r.ok || !Array.isArray(r.grades)) {
    sel.replaceChildren(new Option('تعذر التحميل', ''));
    alertBox(box, App.message(r.code));
    $('#grade-retry').hidden = false;
    return;
  }
  $('#grade-retry').hidden = true;
  gradesLoaded = true;
  centers = Array.isArray(r.centers) ? r.centers : [];
  fillGrades(sel, r.grades, 'اختار سنتك الدراسية');
  fillCenters('reg', '#reg-grade');
  const centerChoice = document.querySelector('[name=mode][value=center]');
  centerChoice.disabled = !centers.length;
  centerChoice.closest('.choice').classList.toggle('off', !centers.length);
  if (!r.grades.length) alertBox(box, 'لا توجد سنوات دراسية متاحة حاليًا.');
}
$('#grade-retry').addEventListener('click', loadGrades);
const validators = [
  () => {
    const n = $('#reg-name'), p = $('#reg-password'), c = $('#reg-confirm'), bd = $('#reg-birth');
    n.value = Rules.cleanName(n.value);
    const a = setError(n, Rules.name(n.value) ? '' : 'اكتب اسمك كلمتين أو أكتر، بالعربي أو الإنجليزي بس.');
    const e = setError(bd, !bd.value ? 'اختار تاريخ ميلادك.' : bd.value < Rules.minBirth ? 'مواليد 2006 أو قبلها مش متاح لهم التسجيل. أقدم تاريخ مسموح 1 يناير 2007.' : Rules.birth(bd.value) ? '' : 'تاريخ الميلاد مش صحيح.');
    const b = setError(p, Rules.password(p.value) ? '' : 'كلمة المرور لازم تكون 6 أحرف أو أكتر، إنجليزي وأرقام ورموز بس.');
    const d = setError(c, c.value && c.value === p.value ? '' : 'كلمة المرور مش متطابقة.');
    return a && e && b && d;
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
    const m = checkMode('mode', 'reg', 'mode-error');
    return !!gender && b && !!m;
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
  $('#photo-feedback').textContent = '';
  $('#photo-preview').hidden = true;
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { err.textContent = 'ارفع صورة JPG أو PNG أو WEBP أقل من 10 ميجا.'; return; }
  try {
    photoData = await compress(file);
    $('#photo-preview img').src = photoData;
    $('#photo-preview').hidden = false;
    err.textContent = '';
    $('#photo-feedback').textContent = 'الصورة جاهزة للتسجيل.';
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
    birthDate: $('#reg-birth').value,
    password: $('#reg-password').value,
    studentPhone: $('#reg-student').value,
    parentPhone: $('#reg-parent').value,
    gender: document.querySelector('[name=gender]:checked').value,
    grade: $('#reg-grade').value,
    ...checkMode('mode', 'reg', 'mode-error'),
    email: $('#reg-email').value,
    photo: photoData.split(',')[1],
    agree: true
  });
  busy(btn, false);
  if (r.ok) {
    $('#register-form').reset();
    regModeSync();
    photoData = '';
    $('#photo-preview').hidden = true;
    goStep(0);
    showTab('login');
    alertBox($('#login-alert'), 'تم إنشاء حسابك بنجاح. حسابك تحت المراجعة ولم يتم تفعيله بعد؛ سجّل الدخول بعد موافقة الإدارة.', 'success');
    return;
  }
  if (r.code === 'exists') goStep(1);
  if (r.code === 'center') { goStep(2); gradesLoaded = false; loadGrades(); }
  if (r.code === 'birth') goStep(0);
  alertBox(box, App.message(r.code));
});
$('#reg-birth').min = Rules.minBirth;
$('#reg-birth').max = Rules.today();
goStep(0);
document.querySelectorAll('[data-to-login]').forEach(b => b.addEventListener('click', () => showTab('login')));
const forgot = { phone: '', parentPhone: '', ticket: '', timer: 0, resendAt: 0, expiresAt: 0 };
const boxes = [...document.querySelectorAll('#otp-boxes input')];
function forgotStep(name) {
  for (const [k, sel] of [['check', '#forgot-form'], ['otp', '#otp-form'], ['pass', '#newpass-form'], ['support', '#support-view']]) $(sel).hidden = k !== name;
  if (name === 'otp') boxes[0].focus();
  else if (name === 'check') $('#forgot-phone').focus();
  else if (name === 'pass') $('#new-password').focus();
}
function openForgot() {
  showTab('forgot');
  const typed = $('#login-phone').value;
  if (Rules.phone(typed) && !$('#forgot-phone').value) $('#forgot-phone').value = typed;
  ['#forgot-alert', '#otp-alert', '#newpass-alert'].forEach(id => alertBox($(id), ''));
  forgotStep('check');
}
$('#forgot-open').addEventListener('click', openForgot);
$('#forgot-birth').max = Rules.today();
async function showSupport(reason) {
  forgotStep('support');
  alertBox($('#support-reason'), reason || '', 'info');
  const list = $('#support-list');
  list.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'جاري تحميل أرقام الدعم…' }));
  const r = await Site.load();
  const phones = r && r.settings && Array.isArray(r.settings.support_phones) ? r.settings.support_phones.filter(Rules.phone) : [];
  if (!phones.length) { list.replaceChildren(Object.assign(document.createElement('p'), { className: 'alert', textContent: r ? 'أرقام الدعم لسه متضافتش. تواصل مع المستر أو السنتر مباشرة.' : App.message('network') })); return; }
  const me = $('#forgot-phone').value, parent = $('#forgot-parent').value;
  const text = ['السلام عليكم، محتاج مساعدة في استعادة حسابي على Smart Chemistry.', 'رقمي المسجل: ' + (Rules.phone(me) ? me : '……'), 'رقم ولي الأمر المسجل: ' + (Rules.phone(parent) ? parent : '……'), 'وهبعت نفس الصورة الشخصية اللي سجلت بيها للتحقق من الهوية.'].join('\n');
  list.replaceChildren(...phones.map((p, i) => {
    const a = document.createElement('a');
    a.className = 'btn ' + (i ? 'outline' : 'primary') + ' full support-btn';
    a.href = Rules.whatsapp(p, text);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'icon'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#chat'); svg.append(use);
    const num = document.createElement('span'); num.dir = 'ltr'; num.textContent = p;
    a.append(svg, 'تواصل مع دعم المنصة', num);
    return a;
  }));
}
document.querySelectorAll('[data-support]').forEach(b => b.addEventListener('click', () => showSupport('')));
function otpValue() { return boxes.map(b => b.value).join(''); }
function setOtp(v) { const d = Rules.digits(v).slice(0, 6); boxes.forEach((b, i) => { b.value = d[i] || ''; }); boxes[Math.min(d.length, 5)].focus(); }
boxes.forEach((b, i) => {
  b.addEventListener('input', () => {
    const d = Rules.digits(b.value);
    if (d.length > 1) { setOtp(otpValue().slice(0, i) + d); }
    else { b.value = d; if (d && i < 5) boxes[i + 1].focus(); }
    $('#otp-boxes').removeAttribute('aria-invalid');
    if (otpValue().length === 6) $('#otp-form').requestSubmit();
  });
  b.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault(); }
    if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
    if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
  });
  b.addEventListener('paste', e => { e.preventDefault(); setOtp((e.clipboardData || window.clipboardData).getData('text')); if (otpValue().length === 6) $('#otp-form').requestSubmit(); });
  b.addEventListener('focus', () => b.select());
});
const mmss = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
function tick() {
  const now = Date.now();
  const left = Math.max(0, Math.round((forgot.expiresAt - now) / 1000));
  const wait = Math.max(0, Math.round((forgot.resendAt - now) / 1000));
  $('#otp-timer').textContent = left ? 'الكود صالح لمدة ' + mmss(left) : 'الكود انتهى. اطلب كود جديد.';
  const resend = $('#otp-resend');
  resend.disabled = wait > 0;
  resend.textContent = wait > 0 ? 'إعادة الإرسال بعد ' + wait + ' ث' : 'إعادة إرسال الكود';
}
function startTimer(expiresIn, resendIn) {
  forgot.expiresAt = Date.now() + expiresIn * 1000;
  forgot.resendAt = Date.now() + resendIn * 1000;
  clearInterval(forgot.timer);
  tick();
  forgot.timer = setInterval(tick, 1000);
}
async function requestCode(btn, box) {
  App.busy(btn, true);
  const r = await App.api('forgot', { phone: forgot.phone, parentPhone: forgot.parentPhone, birthDate: forgot.birthDate });
  App.busy(btn, false);
  if (r.ok) {
    $('#otp-email').textContent = r.email || '';
    setOtp('');
    alertBox($('#otp-alert'), '');
    startTimer(r.expiresIn || 600, r.resendIn || 60);
    forgotStep('otp');
    return true;
  }
  if (r.code === 'no_email') { showSupport('مفيش بريد إلكتروني متسجل على حسابك، فمش هنقدر نبعتلك كود. فريق الدعم هيساعدك تسترجع حسابك.'); return false; }
  if (r.code === 'cooldown' && r.wait) { forgot.resendAt = Date.now() + r.wait * 1000; tick(); }
  alertBox(box, App.message(r.code), r.code === 'cooldown' ? 'info' : 'error');
  if (r.code === 'mismatch' || r.code === 'forgot_locked') box.append(' ', Object.assign(document.createElement('button'), { type: 'button', className: 'link', textContent: 'تواصل مع الدعم', onclick: () => showSupport('') }));
  return false;
}
$('#forgot-form').addEventListener('submit', async e => {
  e.preventDefault();
  const p = $('#forgot-phone'), g = $('#forgot-parent'), b = $('#forgot-birth'), box = $('#forgot-alert');
  alertBox(box, '');
  const a = setError(p, Rules.phone(p.value) ? '' : 'اكتب رقمك المسجل، 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015.');
  const c = setError(g, Rules.phone(g.value) ? (g.value === p.value ? 'رقم ولي الأمر لازم يكون مختلف عن رقمك.' : '') : 'اكتب رقم ولي الأمر المسجل في حسابك.');
  const d = setError(b, b.value ? '' : 'اختار تاريخ ميلادك.');
  if (!a || !c || !d) return;
  Object.assign(forgot, { phone: p.value, parentPhone: g.value, birthDate: b.value });
  await requestCode(e.submitter || $('#forgot-form [type=submit]'), box);
});
$('#otp-resend').addEventListener('click', e => requestCode(e.currentTarget, $('#otp-alert')));
$('#otp-change').addEventListener('click', () => { clearInterval(forgot.timer); forgotStep('check'); });
$('#otp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const box = $('#otp-alert'), btn = $('#otp-submit');
  const code = otpValue();
  if (btn.disabled) return;
  if (!/^\d{6}$/.test(code)) { $('#otp-boxes').setAttribute('aria-invalid', 'true'); alertBox(box, 'اكتب الكود كامل، 6 أرقام.'); return; }
  App.busy(btn, true);
  const r = await App.api('forgotVerify', { phone: forgot.phone, otp: code });
  App.busy(btn, false);
  if (r.ok && r.ticket) { forgot.ticket = r.ticket; clearInterval(forgot.timer); alertBox($('#newpass-alert'), 'تم التحقق من الكود.', 'success'); forgotStep('pass'); return; }
  $('#otp-boxes').setAttribute('aria-invalid', 'true');
  alertBox(box, r.code === 'otp_wrong' && typeof r.left === 'number' ? `الكود غلط. فاضلك ${r.left} محاولات.` : App.message(r.code));
  if (r.code === 'otp_expired') { forgot.expiresAt = 0; tick(); }
  setOtp('');
});
$('#newpass-form').addEventListener('submit', async e => {
  e.preventDefault();
  const p = $('#new-password'), c = $('#new-confirm'), box = $('#newpass-alert');
  alertBox(box, '');
  const a = setError(p, Rules.password(p.value) ? '' : 'كلمة المرور لازم تكون 6 أحرف أو أكتر، إنجليزي وأرقام ورموز بس.');
  const b = setError(c, c.value && c.value === p.value ? '' : 'كلمة المرور مش متطابقة.');
  if (!a || !b) return;
  const btn = e.submitter || $('#newpass-form [type=submit]');
  App.busy(btn, true);
  const r = await App.api('forgotReset', { phone: forgot.phone, ticket: forgot.ticket, password: p.value });
  App.busy(btn, false);
  if (!r.ok) { alertBox(box, App.message(r.code)); if (r.code === 'ticket_expired') setTimeout(() => forgotStep('check'), 1500); return; }
  $('#newpass-form').reset();
  $('#forgot-form').reset();
  $('#login-phone').value = forgot.phone;
  Object.assign(forgot, { phone: '', parentPhone: '', birthDate: '', ticket: '' });
  showTab('login');
  alertBox($('#login-alert'), 'تم تغيير كلمة المرور بنجاح، والقديمة اتمسحت. سجّل دخولك بالكلمة الجديدة.', 'success');
  $('#login-password').focus();
});
const FIX_FIELDS = { name: '#fix-name', parent_missing: '#fix-parent', parent_wrong: '#fix-parent', birth: '#fix-birth', grade: '#fix-grade', gender: '#fix-gender-field', photo: '#fix-photo-field', center: '#fix-mode-field' };
const fixState = { token: '', codes: [], photo: '' };
function openReject(r) {
  fixState.token = r.fix;
  fixState.codes = (r.reasons && Array.isArray(r.reasons.codes)) ? r.reasons.codes : [];
  fixState.data = r.data || {};
  const list = $('#reject-reasons');
  const items = (r.reasons && Array.isArray(r.reasons.list)) ? r.reasons.list : [];
  list.replaceChildren(...items.map(x => { const li = document.createElement('li'); li.textContent = x.label; return li; }));
  list.hidden = !items.length;
  const note = r.reasons && r.reasons.note;
  $('#reject-note').hidden = !note;
  $('#reject-note').textContent = note ? 'ملاحظة الإدارة: ' + note : '';
  showTab('reject');
}
$('#fix-back').addEventListener('click', () => showTab('reject'));
$('#fix-open').addEventListener('click', async () => {
  const d = fixState.data || {};
  $('#fix-name').value = d.name || '';
  $('#fix-birth').value = d.birthDate || '';
  $('#fix-birth').max = Rules.today();
  $('#fix-parent').value = d.parentPhone || '';
  $('#fix-email').value = d.email || '';
  document.querySelectorAll('[name=fix-gender]').forEach(i => { i.checked = i.value === d.gender; });
  fixState.photo = '';
  $('#fix-preview').hidden = true;
  $('#fix-photo-label').textContent = fixState.codes.includes('photo') ? 'لازم ترفع صورة شخصية جديدة وواضحة' : 'ارفع صورة جديدة لو محتاج';
  document.querySelectorAll('#fix-form .field').forEach(f => f.classList.remove('needs-fix'));
  fixState.codes.forEach(c => { const sel = FIX_FIELDS[c]; const f = sel && $(sel); const field = f && (f.classList.contains('field') ? f : f.closest('.field')); if (field) field.classList.add('needs-fix'); });
  ['#fix-name', '#fix-birth', '#fix-parent', '#fix-email', '#fix-grade'].forEach(id => setError($(id), ''));
  alertBox($('#fix-alert'), '');
  showTab('fix');
  const sel = $('#fix-grade');
  sel.replaceChildren(new Option('جاري التحميل...', ''));
  const r = await App.api('grades');
  const list = r.ok && Array.isArray(r.grades) ? r.grades : [];
  fillGrades(sel, d.grade && !list.includes(d.grade) ? [d.grade, ...list] : list, 'اختار سنتك الدراسية', d.grade);
  centers = r.ok && Array.isArray(r.centers) ? r.centers : [];
  document.querySelectorAll('[name=fix-mode]').forEach(i => { i.checked = i.value === (d.mode || 'online'); });
  fillCenters('fix', '#fix-grade', d.center, d.schedule);
  fixModeSync();
  ($('#fix-form .needs-fix input, #fix-form .needs-fix select') || $('#fix-name')).focus();
});
$('#fix-photo').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  const err = $('#fix-photo-error');
  fixState.photo = '';
  $('#fix-preview').hidden = true;
  err.textContent = '';
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) { err.textContent = 'ارفع صورة JPG أو PNG أو WEBP أقل من 10 ميجا.'; return; }
  try { fixState.photo = await compress(file); $('#fix-preview img').src = fixState.photo; $('#fix-preview').hidden = false; } catch { err.textContent = 'تعذر قراءة الصورة. جرّب صورة تانية.'; }
});
$('#fix-form').addEventListener('submit', async e => {
  e.preventDefault();
  const n = $('#fix-name'), bd = $('#fix-birth'), g = $('#fix-parent'), gr = $('#fix-grade'), em = $('#fix-email'), box = $('#fix-alert');
  alertBox(box, '');
  n.value = Rules.cleanName(n.value);
  em.value = em.value.trim().toLowerCase();
  const gender = document.querySelector('[name=fix-gender]:checked');
  const ok = [
    setError(n, Rules.name(n.value) ? '' : 'اكتب اسمك كلمتين أو أكتر، بالعربي أو الإنجليزي بس.'),
    setError(bd, !bd.value ? 'اختار تاريخ ميلادك.' : bd.value < Rules.minBirth ? 'مواليد 2006 أو قبلها مش متاح لهم التسجيل.' : Rules.birth(bd.value) ? '' : 'تاريخ الميلاد مش صحيح.'),
    setError(g, Rules.phone(g.value) ? '' : 'رقم ولي الأمر لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015.'),
    setError(gr, gr.value ? '' : 'اختار سنتك الدراسية.'),
    setError(em, Rules.email(em.value) ? '' : 'استخدم بريد من Gmail أو Yahoo أو Hotmail أو Outlook أو iCloud.')
  ].every(Boolean);
  $('#fix-gender-error').textContent = gender ? '' : 'اختار النوع.';
  const where = checkMode('fix-mode', 'fix', 'fix-mode-error');
  const photoOk = !fixState.codes.includes('photo') || !!fixState.photo;
  $('#fix-photo-error').textContent = photoOk ? '' : 'لازم ترفع صورة شخصية جديدة وواضحة.';
  if (!ok || !gender || !photoOk || !where) { ($('#fix-form [aria-invalid=true]') || $('#fix-form')).scrollIntoView({ block: 'center' }); return; }
  const btn = $('#fix-submit');
  App.busy(btn, true);
  const r = await App.api('fix', { fix: fixState.token, name: n.value, birthDate: bd.value, parentPhone: g.value, gender: gender.value, grade: gr.value, ...where, email: em.value, photo: fixState.photo ? fixState.photo.split(',')[1] : '' });
  App.busy(btn, false);
  if (r.ok) {
    fixState.token = ''; fixState.photo = '';
    $('#fix-form').reset();
    showTab('login');
    alertBox($('#login-alert'), 'تم إرسال التصحيح. حسابك رجع تحت المراجعة، وهتقدر تدخل أول ما الإدارة توافق.', 'success');
    return;
  }
  if (r.code === 'fix_expired') { showTab('login'); alertBox($('#login-alert'), App.message('fix_expired'), 'info'); return; }
  alertBox(box, App.message(r.code));
});
const notice = new URLSearchParams(location.search).get('notice');
if (notice) alertBox($('#login-alert'), notice === 'logout' ? 'تم تسجيل الخروج بنجاح.' : App.message(notice), notice === 'logout' ? 'success' : notice === 'wait' ? 'info' : 'error');
if (location.hash === '#register') showTab('register');
if (location.hash === '#forgot') openForgot();
