const Quiz = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const icon = name => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + name); s.append(u); return s; };
  const button = (cls, text, name) => { const b = el('button', cls); b.type = 'button'; if (name) b.append(icon(name)); if (text) b.append(document.createTextNode(text)); return b; };
  const LABELS = { abc: ['a', 'b', 'c', 'd', 'e', 'f'], ABC: ['A', 'B', 'C', 'D', 'E', 'F'], num: ['1', '2', '3', '4', '5', '6'], ar: ['أ', 'ب', 'ج', 'د', 'هـ', 'و'] };
  const KIND = { homework: 'واجب', exam: 'امتحان' };
  const STATUS = { done: 'اتسلم', left: 'خرجت من الامتحان قبل ما تسلّم، فاتحسبت إجاباتك لحد ما خرجت', time: 'الوقت خلص واتسلمت إجاباتك لوحدها' };
  const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  const when = v => new Date(v).toLocaleString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  let active = null;
  function destroy(reason) { if (!active) return; const a = active; active = null; a.stop(reason || 'nav'); }
  const running = () => !!(active && active.running && active.running());
  function ring(score, total) {
    const p = total ? Math.round(score * 100 / total) : 0;
    const box = el('div', 'q-ring'); box.style.setProperty('--p', p); box.setAttribute('role', 'img'); box.setAttribute('aria-label', 'النتيجة ' + p + '%');
    const b = el('b', '', p + '%'); b.dir = 'ltr';
    box.append(b, el('span', '', score + ' من ' + total));
    return box;
  }
  async function pdfDoc(url) {
    const m = await Player.pdfjs();
    return m.getDocument({ url, isEvalSupported: false, withCredentials: false, rangeChunkSize: 262144, disableAutoFetch: true }).promise;
  }
  async function renderPage(doc, n, canvas, width, mark, maxH) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.4, Math.max(0.4, Math.min(width / base.width, maxH ? maxH / base.height : Infinity)));
    const vp = page.getViewport({ scale });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(vp.width * ratio); canvas.height = Math.floor(vp.height * ratio);
    canvas.style.width = Math.floor(vp.width) + 'px'; canvas.style.height = Math.floor(vp.height) + 'px';
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
    if (mark) {
      ctx.save(); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 0.1; ctx.fillStyle = '#1167B1'; ctx.font = '600 ' + Math.round(15 * scale) + 'px "IBM Plex Sans Arabic", sans-serif'; ctx.textAlign = 'center';
      ctx.translate(vp.width / 2, vp.height / 2); ctx.rotate(-Math.PI / 6);
      for (let y = -vp.height; y < vp.height; y += 140 * scale) for (let x = -vp.width; x < vp.width; x += 300 * scale) ctx.fillText(mark, x, y);
      ctx.restore();
    }
  }
  function mount(box, opt) {
    destroy();
    const root = el('div', 'quiz');
    box.replaceChildren(root);
    const where = { token: opt.token, lecture: opt.lecture, item: opt.item };
    const state = { closed: false, run: null };
    active = { stop: reason => { state.closed = true; if (state.run) state.run.leave(reason); else root.remove(); }, running: () => !!(state.run && state.run.live) };
    const me = active;
    const loading = () => root.replaceChildren(el('p', 'loading-line', 'جاري التحميل…'));
    const fail = (text, retry) => { const card = el('div', 'q-card q-intro'); card.append(el('p', 'alert', text)); if (retry) { const b = button('btn outline small', 'إعادة المحاولة', 'refresh'); b.addEventListener('click', retry); card.append(b); } root.replaceChildren(card); };
    async function info() {
      loading();
      const r = await opt.api('quizInfo', where);
      if (state.closed) return;
      if (!r.ok) { if (opt.expired && opt.expired(r.code)) return; fail(App.message(r.code), info); return; }
      if (opt.onInfo) opt.onInfo(r);
      if (r.attempt && r.attempt.status !== 'open') { result(r); return; }
      intro(r);
    }
    function meta(q) {
      const row = el('div', 'q-meta');
      const chip = (name, text) => { const c = el('span', 'q-chip'); c.append(icon(name), text); return c; };
      row.append(chip('list', q.count + ' سؤال'), chip('clock', q.minutes ? q.minutes + ' دقيقة' : 'من غير وقت'), chip(q.type === 'pdf' ? 'file' : 'note', q.type === 'pdf' ? 'ورقة أسئلة PDF' : 'أسئلة اختيار من متعدد'));
      if (q.endsAt) row.append(chip('lock', 'يتقفل ' + when(q.endsAt)));
      return row;
    }
    function intro(r) {
      const q = r.quiz, at = r.attempt;
      const card = el('section', 'q-card q-intro');
      const badge = el('span', 'badge', KIND[q.kind]); badge.dataset.tone = q.kind === 'exam' ? 'bad' : 'ok';
      card.append(badge, el('h3', '', opt.title || q.title), meta(q));
      const rules = el('ul', 'q-rules');
      const rule = t => rules.append(el('li', '', t));
      if (q.kind === 'exam') {
        rule('أول ما تدوس «ابدأ» الوقت بيبدأ يعد، ومش بيقف.');
        rule('متقفلش الصفحة ومتخرجش منها. لو خرجت من صفحة الامتحان أو قفلتها أو عملت تحديث، الامتحان بيتقفل على الإجابات اللي جاوبتها.');
        rule('لو فتحت تطبيق أو تبويب تاني هيوصلك تنبيه مرة واحدة، والمرة التانية الامتحان بيتسلّم لوحده.');
        rule('لما الوقت يخلص إجاباتك بتتسلم لوحدها.');
      } else {
        rule(q.minutes ? 'الوقت بيبدأ أول ما تبدأ، ولما يخلص إجاباتك بتتسلم لوحدها.' : 'مفيش وقت. تقدر تقفل وترجع تكمل من مكان ما وقفت.');
        rule('إجاباتك بتتحفظ أول بأول.');
        rule('بعد ما تسلّم مش هتقدر تغيّر إجاباتك.');
      }
      card.append(rules);
      const box2 = el('p', 'alert'); box2.hidden = true; box2.setAttribute('role', 'status');
      const now = Date.now() + ((r.now || Date.now()) - Date.now());
      const soon = q.startsAt && Date.parse(q.startsAt) > now, over = q.endsAt && Date.parse(q.endsAt) <= now;
      const actions = el('div', 'q-actions');
      if (soon) { box2.textContent = 'هيتفتح ' + when(q.startsAt) + '.'; box2.dataset.type = 'info'; box2.hidden = false; }
      else if (over && !at) { box2.textContent = 'الوقت المسموح خلص، ومحدش يقدر يبدأ دلوقتي.'; box2.dataset.type = 'error'; box2.hidden = false; }
      else {
        const go = button('btn primary', at ? 'كمّل' : q.kind === 'exam' ? 'ابدأ الامتحان' : 'ابدأ الواجب', at ? 'play' : q.kind === 'exam' ? 'timer' : 'play');
        let armed = 0;
        go.addEventListener('click', async () => {
          if (q.kind === 'exam' && !armed) { armed = setTimeout(() => { armed = 0; go.lastChild.textContent = 'ابدأ الامتحان'; }, 6000); go.lastChild.textContent = 'متأكد؟ دوس تاني والوقت هيبدأ'; return; }
          clearTimeout(armed);
          App.busy(go, true);
          const s = await opt.api('quizStart', where);
          App.busy(go, false);
          if (state.closed) return;
          if (!s.ok) {
            if (opt.expired && opt.expired(s.code)) return;
            if ((s.code === 'quiz_done' || s.code === 'quiz_left') && s.attempt) { info(); return; }
            box2.textContent = s.code === 'quiz_soon' ? 'هيتفتح ' + when(s.startsAt) + '.' : App.message(s.code); box2.dataset.type = 'error'; box2.hidden = false; return;
          }
          take(s);
        });
        actions.append(go);
        if (at) actions.append(el('small', 'muted', 'جاوبت ' + at.answered + ' من ' + at.total));
      }
      card.append(box2, actions);
      root.replaceChildren(card);
    }
    function take(s) {
      const q = s.quiz, paper = s.paper, at = s.attempt;
      const exam = q.kind === 'exam';
      const labels = LABELS[paper.labels] || LABELS.abc;
      const count = paper.count;
      const order = Array.isArray(at.order) && at.order.length === count ? at.order : Array.from({ length: count }, (_, i) => i);
      const answers = Array.isArray(at.answers) && at.answers.length === count ? at.answers.slice() : Array(count).fill(-1);
      const skew = (s.now || Date.now()) - Date.now();
      const local = 'quiz:' + at.id;
      let idx = Math.max(0, order.findIndex(o => answers[o] < 0)), exits = at.exits || 0, dirty = false, lastSave = Date.now(), live = true, sending = false, warned = false, timer = 0, doc = null;
      if (idx < 0) idx = 0;
      if (!exam) DB.get('kv', local).then(x => { if (x && Array.isArray(x.answers) && x.answers.length === count && x.answers.filter(n => n >= 0).length >= answers.filter(n => n >= 0).length) { x.answers.forEach((n, i) => { answers[i] = n; }); draw(); } });
      const run = { live: true, leave: reason => stop(reason) };
      state.run = run;
      const wrap = el('div', 'q-run' + (exam ? ' q-full' : ''));
      if (exam) { document.body.classList.add('exam-mode'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', q.title); }
      const head = el('header', 'q-head');
      const titleBox = el('div', 'q-title'); titleBox.append(el('span', 'badge', KIND[q.kind]), el('strong', '', opt.title || q.title));
      titleBox.firstChild.dataset.tone = exam ? 'bad' : 'ok';
      const time = el('div', 'q-timer'); time.setAttribute('role', 'timer'); time.setAttribute('aria-live', 'off'); time.dir = 'ltr';
      const progress = el('span', 'q-progress');
      head.append(titleBox, progress, time);
      const warn = el('p', 'alert q-warn'); warn.hidden = true; warn.setAttribute('role', 'alert');
      const stage = el('div', 'q-stage');
      const choices = el('div', 'q-choices'); choices.setAttribute('role', 'radiogroup');
      const palette = el('nav', 'q-palette'); palette.setAttribute('aria-label', 'الأسئلة');
      const prev = button('btn outline', 'السابق', 'arrow-r'), next = button('btn primary', 'التالي', ''), finish = button('btn outline q-finish', 'سلّم', 'check');
      next.append(icon('arrow-l'));
      const nav = el('div', 'q-nav'); nav.append(prev, next, finish);
      const confirmBox = el('div', 'q-confirm'); confirmBox.hidden = true;
      wrap.append(head, warn, stage, choices, nav, confirmBox, palette);
      root.replaceChildren(wrap);
      if (exam) wrap.focus && wrap.focus();
      const mark = [s.mark && s.mark.name, s.mark && s.mark.phone].filter(Boolean).join(' · ');
      const remaining = () => (at.deadline ? at.deadline - (Date.now() + skew) : Infinity);
      function tick() {
        if (!at.deadline) { time.hidden = true; return; }
        const left = remaining();
        time.textContent = clock(left);
        time.dataset.level = left <= 60000 ? 'bad' : left <= 300000 ? 'warn' : '';
        if (left <= 0 && live) submit('time');
      }
      function stateNow() { return { answers: answers.slice(), exits }; }
      function persist() { DB.put('kv', { answers: answers.slice(), exits, at: Date.now() }, local); }
      async function save(force, keepalive) {
        if (!live || sending || (!dirty && !force)) return;
        dirty = false; lastSave = Date.now();
        const r = await App.api('quizSave', { token: opt.token, attempt: at.id, ...stateNow() }, keepalive ? { keepalive: true } : undefined);
        if (!r.ok && (r.code === 'quiz_time' || r.code === 'quiz_done')) submit('time');
        else if (!r.ok) dirty = true;
      }
      const autosave = setInterval(() => { if (dirty && Date.now() - lastSave > 25000) save(); }, 5000);
      timer = setInterval(tick, 1000);
      function pick(j) {
        const o = order[idx];
        answers[o] = answers[o] === j ? -1 : j;
        dirty = true;
        persist();
        draw();
        if (answers[o] >= 0 && idx < count - 1 && exam) setTimeout(() => { if (live && order[idx] === o) { idx++; draw(); } }, 260);
      }
      function drawChoices(list) {
        const o = order[idx];
        choices.replaceChildren(...list.map((text, j) => {
          const b = el('button', 'q-choice' + (answers[o] === j ? ' on' : '')); b.type = 'button';
          b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(answers[o] === j));
          const l = el('b', 'q-label', labels[j] || String(j + 1));
          b.append(l);
          if (text !== null) { const t = el('span', 'q-choice-text', text); t.dir = 'auto'; b.append(t); }
          b.addEventListener('click', () => pick(j));
          return b;
        }));
        choices.classList.toggle('compact', list.every(x => x === null));
      }
      let pageKey = '';
      function draw() {
        const o = order[idx];
        const answered = answers.filter(n => n >= 0).length;
        progress.textContent = 'سؤال ' + (idx + 1) + ' من ' + count + ' · جاوبت ' + answered;
        if (paper.type === 'questions') {
          const qq = paper.questions[o];
          const card = el('div', 'q-question');
          const n = el('span', 'q-num', String(idx + 1).padStart(2, '0')); n.dir = 'ltr';
          const t = el('p', 'q-text', qq.text); t.dir = 'auto';
          card.append(n, t);
          stage.replaceChildren(card);
          drawChoices(qq.choices);
        } else {
          const key = String(o);
          if (pageKey !== key) {
            pageKey = key;
            const holder = el('div', 'q-page');
            const canvas = document.createElement('canvas');
            const wm = el('div', 'q-mark', mark); wm.setAttribute('aria-hidden', 'true');
            holder.append(el('p', 'loading-line', 'جاري تحميل السؤال…'), wm);
            stage.replaceChildren(holder);
            (async () => {
              try {
                if (!doc) doc = await pdfDoc(paper.url);
                if (!live || pageKey !== key) return;
                await renderPage(doc, o + 1, canvas, Math.min(stage.clientWidth || 700, 900) - 4, mark, Math.max(380, window.innerHeight - 280));
                if (!live || pageKey !== key) return;
                holder.replaceChildren(canvas, wm);
              } catch { if (pageKey === key) holder.replaceChildren(el('p', 'alert', 'تعذر تحميل صفحة السؤال. تأكد من الإنترنت ودوس التالي ثم السابق.')); }
            })();
          }
          drawChoices(Array.from({ length: paper.choices }, () => null));
        }
        prev.disabled = idx === 0;
        next.hidden = idx === count - 1;
        finish.classList.toggle('primary', idx === count - 1);
        finish.classList.toggle('outline', idx !== count - 1);
        palette.replaceChildren(...order.map((oo, i) => { const b = el('button', 'q-dot' + (answers[oo] >= 0 ? ' done' : '') + (i === idx ? ' now' : ''), String(i + 1)); b.type = 'button'; b.dir = 'ltr'; b.setAttribute('aria-label', 'سؤال ' + (i + 1) + (answers[oo] >= 0 ? '، متجاوب' : '')); if (i === idx) b.setAttribute('aria-current', 'step'); b.addEventListener('click', () => { idx = i; confirmBox.hidden = true; draw(); }); return b; }));
      }
      prev.addEventListener('click', () => { if (idx > 0) { idx--; confirmBox.hidden = true; draw(); } });
      next.addEventListener('click', () => { if (idx < count - 1) { idx++; confirmBox.hidden = true; draw(); } });
      finish.addEventListener('click', () => {
        const blank = answers.filter(n => n < 0).length;
        confirmBox.replaceChildren();
        confirmBox.append(el('strong', '', blank ? 'فاضل ' + blank + ' سؤال من غير إجابة.' : 'جاوبت على كل الأسئلة.'), el('p', 'muted', 'بعد التسليم مش هتقدر تغيّر إجاباتك.'));
        const yes = button('btn primary', 'سلّم دلوقتي', 'check'), no = button('btn outline', 'ارجع للأسئلة', '');
        yes.addEventListener('click', () => submit('submit', yes));
        no.addEventListener('click', () => { confirmBox.hidden = true; });
        const row = el('div', 'q-actions'); row.append(yes, no);
        confirmBox.append(row);
        confirmBox.hidden = false;
        yes.focus();
      });
      const keys = e => {
        if (!live || e.target.closest('input,textarea')) return;
        const n = (paper.type === 'pdf' ? paper.choices : paper.questions[order[idx]].choices.length);
        const k = e.key.toLowerCase();
        const pos = labels.findIndex(x => x.toLowerCase() === k);
        if (pos >= 0 && pos < n) { e.preventDefault(); pick(pos); }
        else if (/^[1-6]$/.test(k) && Number(k) <= n) { e.preventDefault(); pick(Number(k) - 1); }
      };
      document.addEventListener('keydown', keys);
      function onHide() {
        if (!live) return;
        if (document.hidden) {
          if (!exam) { save(true, true); return; }
          exits++;
          persist();
          if (exits >= 2) { submit('left', null, true); return; }
          save(true, true);
        } else if (exam && exits === 1 && !warned) {
          warned = true;
          warn.textContent = 'خرجت من صفحة الامتحان مرة. لو خرجت تاني الامتحان هيتسلّم لوحده على إجاباتك دلوقتي.';
          warn.hidden = false;
        }
      }
      const onPageHide = () => { if (!live) return; if (exam) submit('left', null, true); else save(true, true); };
      const onUnload = e => { if (live && exam) { e.preventDefault(); e.returnValue = ''; } };
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('beforeunload', onUnload);
      function cleanup() {
        live = false; run.live = false;
        clearInterval(timer); clearInterval(autosave);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('beforeunload', onUnload);
        document.removeEventListener('keydown', keys);
        document.body.classList.remove('exam-mode');
        if (doc) { try { doc.destroy(); } catch {} doc = null; }
      }
      async function submit(reason, btn, keepalive) {
        if (!live || sending) return;
        sending = true;
        if (btn) App.busy(btn, true);
        const r = await App.api('quizSubmit', { token: opt.token, attempt: at.id, ...stateNow(), reason }, keepalive ? { keepalive: true } : undefined);
        if (btn) App.busy(btn, false);
        sending = false;
        if (!r.ok) {
          if (opt.expired && opt.expired(r.code)) { cleanup(); return; }
          if (keepalive || state.closed) { cleanup(); return; }
          warn.textContent = App.message(r.code) + ' إجاباتك محفوظة، جرّب تسلّم تاني.'; warn.hidden = false;
          return;
        }
        cleanup();
        DB.del('kv', local);
        if (opt.onDone) opt.onDone(r);
        if (state.closed || me !== active) { root.remove(); return; }
        state.run = null;
        result(r);
      }
      function stop(reason) {
        if (!live) { root.remove(); return; }
        if (exam) submit('left', null, true).then(() => root.remove());
        else { save(true, true); cleanup(); root.remove(); }
      }
      tick();
      draw();
    }
    function result(r) {
      const q = r.quiz, at = r.attempt, rv = r.review;
      const card = el('section', 'q-card q-result');
      const badge = el('span', 'badge', KIND[q.kind] + ' · ' + (at.status === 'done' ? 'اتسلم' : at.status === 'left' ? 'اتقفل' : 'الوقت خلص'));
      badge.dataset.tone = at.status === 'done' ? 'ok' : 'warn';
      const top = el('div', 'q-result-top');
      const text = el('div');
      text.append(badge, el('h3', '', opt.title || q.title), el('p', 'muted', STATUS[at.status] || ''));
      if (at.submittedAt) text.append(el('small', 'muted', 'اتسلم ' + when(at.submittedAt)));
      top.append(ring(at.score || 0, at.total), text);
      card.append(top);
      if (rv) {
        const right = rv.key.filter((k, i) => rv.answers[i] === k).length, blank = rv.answers.filter(n => n < 0).length;
        const stats = el('div', 'q-stats');
        const st = (v, t, tone) => { const d = el('div', 'q-stat'); d.dataset.tone = tone; const b = el('b', '', String(v)); b.dir = 'ltr'; d.append(b, el('span', '', t)); return d; };
        stats.append(st(right, 'صح', 'ok'), st(rv.key.length - right - blank, 'غلط', 'bad'), st(blank, 'من غير إجابة', ''));
        card.append(stats);
        const show = button('btn outline', 'راجع إجاباتك', 'eye');
        const list = el('ol', 'q-review'); list.hidden = true;
        show.addEventListener('click', () => { list.hidden = !list.hidden; show.lastChild.textContent = list.hidden ? 'راجع إجاباتك' : 'اخفي المراجعة'; if (!list.hidden && !list.childElementCount) review(list, r); });
        card.append(show, list);
      } else card.append(el('p', 'alert', q.review === 'close' && q.endsAt ? 'الإجابات الصح هتظهر بعد ما الوقت المسموح يخلص ' + when(q.endsAt) + '.' : 'الإجابات الصح مش هتظهر في ده.'));
      card.querySelector('.alert:not([data-type])')?.setAttribute('data-type', 'info');
      root.replaceChildren(card);
    }
    async function review(list, r) {
      const rv = r.review, labels = LABELS[r.quiz.labels] || LABELS.abc;
      const mark = [r.mark && r.mark.name, r.mark && r.mark.phone].filter(Boolean).join(' · ');
      let doc = null;
      const items = rv.key.map((k, i) => {
        const yours = rv.answers[i];
        const li = el('li', 'q-review-item ' + (yours === k ? 'right' : yours < 0 ? 'blank' : 'wrong'));
        const head = el('div', 'q-review-head');
        head.append(el('b', '', 'سؤال ' + (i + 1)), el('span', 'badge', yours === k ? 'صح' : yours < 0 ? 'من غير إجابة' : 'غلط'));
        head.lastChild.dataset.tone = yours === k ? 'ok' : yours < 0 ? '' : 'bad';
        li.append(head);
        if (rv.questions) {
          const qq = rv.questions[i];
          const t = el('p', 'q-text', qq.text); t.dir = 'auto'; li.append(t);
          const ol = el('div', 'q-choices review');
          qq.choices.forEach((c, j) => { const d = el('div', 'q-choice' + (j === k ? ' right' : '') + (j === yours && j !== k ? ' wrong' : '')); d.append(el('b', 'q-label', labels[j]), el('span', 'q-choice-text', c)); d.lastChild.dir = 'auto'; ol.append(d); });
          li.append(ol);
        } else {
          const canvas = document.createElement('canvas'); canvas.className = 'q-review-page';
          li.append(canvas);
          const row = el('p', 'muted', 'الإجابة الصح: ' + labels[k] + (yours >= 0 && yours !== k ? ' · إجابتك: ' + labels[yours] : ''));
          li.append(row);
          li.dataset.page = String(i + 1);
        }
        return li;
      });
      list.replaceChildren(...items);
      if (rv.questions || !r.paper || !r.paper.url) return;
      try {
        doc = await pdfDoc(r.paper.url);
        const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const c = e.target.querySelector('canvas'); renderPage(doc, Number(e.target.dataset.page), c, Math.min(list.clientWidth || 600, 640), mark).catch(() => {}); }), { rootMargin: '400px 0px' });
        items.forEach(x => io.observe(x));
      } catch {}
    }
    info();
  }
  return { mount, destroy, running };
})();
window.Quiz = Quiz;
