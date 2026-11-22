(() => {
  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = name => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + name); s.append(u); return s; };
  const page = document.body.dataset.page;
  function phoneRow(p, text) {
    const row = document.createElement('div'); row.className = 'contact-row';
    const num = document.createElement('b'); num.dir = 'ltr'; num.textContent = p;
    const wa = document.createElement('a'); wa.className = 'btn primary small'; wa.href = Rules.whatsapp(p, text); wa.target = '_blank'; wa.rel = 'noopener noreferrer'; wa.append(Social.icon('whatsapp'), 'واتساب');
    const call = document.createElement('a'); call.className = 'btn outline small'; call.href = 'tel:' + p; call.append(svg('phone'), 'اتصال');
    row.append(num, wa, call);
    return row;
  }
  Site.load().then(r => {
    const s = (r && r.settings) || null;
    if (page === 'about') {
      if (s && s.about) { const box = $('#about-text'); box.replaceChildren(...s.about.split(/\n{2,}|\n/).filter(Boolean).map(t => { const p = document.createElement('p'); p.textContent = t; return p; })); }
      if (r && Array.isArray(r.stages) && r.stages.length) $('#about-stages').replaceChildren(...r.stages.map(x => { const li = document.createElement('li'); li.textContent = x.name; return li; }));
      return;
    }
    if (page !== 'contact') return;
    const status = $('#contact-status');
    if (!s) { status.textContent = App.message('network'); status.dataset.type = 'error'; return; }
    const groups = {
      support: [s.support_phones || [], 'السلام عليكم، محتاج مساعدة في حسابي على Smart Chemistry.'],
      subject: [s.subject_phones || [], 'السلام عليكم، عندي سؤال في الكيمياء.'],
      teacher: [s.teacher_phone ? [s.teacher_phone] : [], 'السلام عليكم يا مستر.']
    };
    let shown = 0;
    Object.entries(groups).forEach(([k, [list, text]]) => {
      const valid = list.filter(Rules.phone);
      $('#c-' + k).hidden = !valid.length;
      if (valid.length) { shown++; document.querySelector('[data-list=' + k + ']').replaceChildren(...valid.map(p => phoneRow(p, text))); }
    });
    const social = Social.links(s.socials || {});
    $('#c-social').hidden = !social.length;
    if (social.length) {
      shown++;
      document.querySelector('[data-list=social]').replaceChildren(...social.map(a => { a.classList.add('social-wide'); a.append(document.createTextNode(a.getAttribute('aria-label'))); return a; }));
    }
    status.hidden = !!shown;
    if (!shown) status.textContent = 'لسه أرقام التواصل متضافتش. جرّب تاني بعد شوية.';
  });
})();
