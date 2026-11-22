const Player = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const icon = name => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + name); s.append(u); return s; };
  const btn = (name, label, cls = '') => { const b = el('button', 'pl-btn ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(icon(name)); return b; };
  const clock = s => { if (!Number.isFinite(s) || s < 0) s = 0; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  let active = null;
  function guard(root) {
    const stop = e => e.preventDefault();
    root.addEventListener('contextmenu', stop);
    root.addEventListener('dragstart', stop);
    root.addEventListener('selectstart', stop);
    root.addEventListener('copy', stop);
  }
  function watermark(root, mark, onTamper) {
    const wm = el('div', 'pl-mark');
    wm.setAttribute('aria-hidden', 'true');
    const text = [mark.name, mark.phone].filter(Boolean).join(' - ');
    wm.textContent = text;
    root.append(wm);
    let timer = 0, checkTimer = 0, blocked = false;
    const move = () => {
      const w = root.clientWidth, h = root.clientHeight;
      const mw = wm.offsetWidth || 160, mh = wm.offsetHeight || 24;
      wm.style.setProperty('--x', Math.max(0, Math.random() * (w - mw)).toFixed(0) + 'px');
      wm.style.setProperty('--y', Math.max(0, Math.random() * (h - mh - 56)).toFixed(0) + 'px');
      timer = setTimeout(move, 3500 + Math.random() * 3500);
    };
    move();
    const check = () => {
      if (!root.isConnected) { clearTimeout(timer); clearInterval(checkTimer); watch.disconnect(); return; }
      if (blocked || !onTamper) return;
      const style = getComputedStyle(wm), r = wm.getBoundingClientRect(), host = root.getBoundingClientRect();
      let hidden = false;
      for (let n = wm; n && n !== root.parentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) < 0.15) hidden = true; }
      const bad = hidden || wm.parentNode !== root || wm.textContent !== text || wm.className !== 'pl-mark' || style.clipPath !== 'none' || r.width < 8 || r.height < 8 || r.right <= host.left || r.left >= host.right || r.bottom <= host.top || r.top >= host.bottom;
      if (bad) { blocked = true; clearTimeout(timer); onTamper(); }
    };
    const watch = new MutationObserver(check);
    watch.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    checkTimer = setInterval(check, 500);
    return () => { clearTimeout(timer); clearInterval(checkTimer); watch.disconnect(); };
  }
  function destroy() { if (active) { active(); active = null; } }
  function video(box, opt) {
    destroy();
    const root = el('div', 'player');
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'مشغل الفيديو');
    const v = document.createElement('video');
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    v.preload = 'metadata';
    v.disablePictureInPicture = true;
    v.setAttribute('disablePictureInPicture', '');
    v.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    v.setAttribute('disableRemotePlayback', '');
    v.src = opt.url;
    const shade = el('div', 'pl-shade');
    const big = btn('play', 'تشغيل', 'pl-big');
    const spin = el('div', 'pl-spin'); spin.hidden = true;
    const note = el('div', 'pl-note'); note.hidden = true;
    const bar = el('div', 'pl-bar');
    const seek = el('div', 'pl-seek');
    const buffered = el('span', 'pl-buffered'), played = el('span', 'pl-played');
    const range = el('input', 'pl-range'); range.type = 'range'; range.min = '0'; range.max = '1000'; range.step = '1'; range.value = '0'; range.setAttribute('aria-label', 'مكان التشغيل');
    const tip = el('span', 'pl-tip'); tip.dir = 'ltr'; tip.hidden = true;
    seek.append(buffered, played, range, tip);
    const play = btn('play', 'تشغيل'), back = btn('rewind', 'رجوع 10 ثواني'), fwd = btn('forward', 'تقديم 10 ثواني');
    const time = el('span', 'pl-time', '0:00 / 0:00'); time.dir = 'ltr';
    const mute = btn('volume', 'كتم الصوت');
    const vol = el('input', 'pl-vol'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = '1'; vol.setAttribute('aria-label', 'مستوى الصوت');
    const speed = el('button', 'pl-btn pl-speed', '1x'); speed.type = 'button'; speed.setAttribute('aria-label', 'سرعة التشغيل'); speed.dir = 'ltr';
    const full = btn('expand', 'ملء الشاشة');
    const keys = btn('keyboard', 'اختصارات الكيبورد', 'pl-keys');
    const help = el('div', 'pl-help'); help.hidden = true; help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'اختصارات الكيبورد');
    const helpBox = el('div', 'pl-help-box');
    helpBox.append(el('strong', '', 'اختصارات الكيبورد'));
    const list = el('dl', 'pl-help-list');
    [['K / Space', 'تشغيل وإيقاف'], ['F', 'ملء الشاشة'], ['M', 'كتم الصوت'], ['← / →', 'رجوع وتقديم 5 ثواني'], ['J / L', 'رجوع وتقديم 10 ثواني'], ['↑ / ↓', 'علو ووطي الصوت'], ['0 - 9', 'انتقل لجزء من الفيديو'], ['Home / End', 'البداية والنهاية'], ['< / >', 'أبطأ وأسرع'], ['?', 'إظهار الاختصارات']].forEach(([k, t]) => { const d = el('div'); const dt = el('dt', '', k); dt.dir = 'ltr'; d.append(dt, el('dd', '', t)); list.append(d); });
    const helpClose = el('button', 'btn outline small', 'تمام'); helpClose.type = 'button';
    helpBox.append(list, helpClose);
    help.append(helpBox);
    const pulse = el('div', 'pl-pulse'); pulse.setAttribute('aria-hidden', 'true'); pulse.append(icon('play'));
    const row = el('div', 'pl-row');
    const left = el('div', 'pl-group'), right = el('div', 'pl-group');
    right.append(play, back, fwd, time);
    left.append(mute, vol, speed, keys, full);
    row.append(right, left);
    bar.append(seek, row);
    const tapL = el('div', 'pl-tap pl-tap-l'), tapR = el('div', 'pl-tap pl-tap-r');
    const flash = el('div', 'pl-flash');
    root.append(v, shade, tapR, tapL, big, spin, pulse, flash, note, bar, help);
    box.replaceChildren(root);
    guard(root);
    const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
    let locked = false;
    let hideTimer = 0, lastSave = 0, retried = 0, endReported = false, resumeAt = Number(opt.resume) || 0;
    const showBar = () => { root.classList.add('ui'); clearTimeout(hideTimer); if (!v.paused) hideTimer = setTimeout(() => root.classList.remove('ui'), 2600); };
    const flashMsg = t => { flash.textContent = t; flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); };
    const setIcon = (b, name) => b.querySelector('use').setAttribute('href', '#' + name);
    const beat = name => { setIcon(pulse, name); pulse.classList.remove('on'); void pulse.offsetWidth; pulse.classList.add('on'); };
    const toggle = () => { if (locked) return; if (v.paused) { v.play().catch(() => {}); beat('play'); } else { v.pause(); beat('pause'); } };
    const setRate = r => { v.playbackRate = r; speed.textContent = r + 'x'; flashMsg('السرعة ' + r + 'x'); showBar(); };
    const setVol = x => { v.volume = Math.round(Math.min(1, Math.max(0, x)) * 100) / 100; v.muted = v.volume === 0; flashMsg('الصوت ' + Math.round(v.volume * 100) + '%'); showBar(); };
    const goTo = t => { if (!Number.isFinite(v.duration)) return; v.currentTime = Math.min(Math.max(0, t), v.duration - 0.2); draw(); showBar(); };
    const showHelp = on => { help.hidden = !on; if (on) helpClose.focus({ preventScroll: true }); else root.focus({ preventScroll: true }); };
    const jump = s => { if (!Number.isFinite(v.duration)) return; v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration - 0.2); flashMsg((s > 0 ? '+' : '−') + Math.abs(s) + ' ث'); showBar(); };
    const draw = () => {
      const d = v.duration || 0;
      const p = d ? v.currentTime / d : 0;
      played.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      if (!range.matches(':active')) range.value = String(Math.round(p * 1000));
      let b = 0;
      for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 1) b = Math.max(b, v.buffered.end(i));
      buffered.style.setProperty('--p', (d ? b / d * 100 : 0).toFixed(2) + '%');
      time.textContent = clock(v.currentTime) + ' / ' + clock(d);
    };
    v.addEventListener('loadedmetadata', () => { if (resumeAt > 5 && resumeAt < v.duration - 5) { v.currentTime = resumeAt; flashMsg('كمّلنا من ' + clock(resumeAt)); } resumeAt = 0; draw(); });
    v.addEventListener('timeupdate', () => {
      draw();
      if (Date.now() - lastSave > 5000 && opt.onProgress) { lastSave = Date.now(); opt.onProgress(v.currentTime, v.duration); }
      if (!endReported && v.duration && v.currentTime / v.duration >= 0.9) { endReported = true; if (opt.onEnd) opt.onEnd(); }
    });
    v.addEventListener('progress', draw);
    v.addEventListener('play', () => { if (locked) { v.pause(); return; } setIcon(play, 'pause'); play.setAttribute('aria-label', 'إيقاف مؤقت'); root.classList.add('playing'); big.hidden = true; showBar(); });
    v.addEventListener('pause', () => { setIcon(play, 'play'); play.setAttribute('aria-label', 'تشغيل'); root.classList.remove('playing'); root.classList.add('ui'); if (opt.onProgress) opt.onProgress(v.currentTime, v.duration); });
    v.addEventListener('waiting', () => { spin.hidden = false; });
    v.addEventListener('playing', () => { if (locked) { v.pause(); return; } retried = 0; spin.hidden = true; note.hidden = true; });
    v.addEventListener('canplay', () => { spin.hidden = true; });
    v.addEventListener('ended', () => { if (opt.onEnd && !endReported) { endReported = true; opt.onEnd(); } });
    v.addEventListener('volumechange', () => { setIcon(mute, v.muted || v.volume === 0 ? 'mute' : 'volume'); mute.setAttribute('aria-label', v.muted ? 'تشغيل الصوت' : 'كتم الصوت'); if (!v.muted) vol.value = String(v.volume); });
    v.addEventListener('error', async () => {
      if (locked) return;
      if (!opt.refresh || retried > 2) { spin.hidden = true; note.textContent = 'تعذر تشغيل الفيديو. تأكد من الإنترنت وجرّب تاني.'; note.hidden = false; return; }
      retried++;
      const at = v.currentTime, was = !v.paused;
      spin.hidden = false;
      const url = await opt.refresh();
      if (!url) { spin.hidden = true; note.textContent = 'انتهت صلاحية رابط التشغيل. افتح المحاضرة تاني.'; note.hidden = false; return; }
      resumeAt = at;
      v.src = url;
      if (was) v.play().catch(() => {});
    });
    big.addEventListener('click', toggle);
    play.addEventListener('click', toggle);
    back.addEventListener('click', () => jump(-10));
    fwd.addEventListener('click', () => jump(10));
    shade.addEventListener('click', () => { if (matchMedia('(pointer:coarse)').matches) { if (root.classList.contains('ui') && !v.paused) root.classList.remove('ui'); else showBar(); return; } toggle(); });
    let tapAt = 0, tapSide = '';
    [[tapL, -10, 'l'], [tapR, 10, 'r']].forEach(([zone, s, side]) => zone.addEventListener('click', e => {
      const now = Date.now();
      if (now - tapAt < 320 && tapSide === side) { jump(s); tapAt = 0; e.stopPropagation(); return; }
      tapAt = now; tapSide = side;
      setTimeout(() => { if (tapAt === now) { if (matchMedia('(pointer:coarse)').matches) { if (root.classList.contains('ui') && !v.paused) root.classList.remove('ui'); else showBar(); } else toggle(); } }, 330);
    }));
    range.addEventListener('input', () => { if (v.duration) { v.currentTime = Number(range.value) / 1000 * v.duration; draw(); } });
    mute.addEventListener('click', () => { v.muted = !v.muted; flashMsg(v.muted ? 'الصوت مكتوم' : 'الصوت ' + Math.round(v.volume * 100) + '%'); });
    keys.addEventListener('click', () => showHelp(help.hidden));
    helpClose.addEventListener('click', () => showHelp(false));
    help.addEventListener('click', e => { if (e.target === help) showHelp(false); });
    seek.addEventListener('pointermove', e => { if (!v.duration || e.pointerType !== 'mouse') return; const r = seek.getBoundingClientRect(); const x = Math.min(Math.max(e.clientX - r.left, 0), r.width); tip.textContent = clock(x / r.width * v.duration); tip.style.setProperty('--x', x + 'px'); tip.hidden = false; });
    seek.addEventListener('pointerleave', () => { tip.hidden = true; });
    range.addEventListener('change', () => root.focus({ preventScroll: true }));
    vol.addEventListener('change', () => root.focus({ preventScroll: true }));
    root.addEventListener('click', e => { if (e.detail > 0 && e.target.closest('.pl-bar button')) root.focus({ preventScroll: true }); });
    vol.addEventListener('input', () => { v.volume = Number(vol.value); v.muted = v.volume === 0; });
    speed.addEventListener('click', () => { const i = SPEEDS.indexOf(v.playbackRate); setRate(SPEEDS[(i + 1) % SPEEDS.length]); });
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    full.addEventListener('click', async () => {
      if (root.classList.contains('pseudo-full')) { root.classList.remove('pseudo-full'); onFs(); return; }
      try {
        if (fsEl()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
          else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
          else root.classList.toggle('pseudo-full');
          try { await screen.orientation.lock('landscape'); } catch {}
        }
      } catch { root.classList.toggle('pseudo-full'); }
      onFs();
    });
    const onFs = () => { const on = fsEl() === root || root.classList.contains('pseudo-full'); setIcon(full, on ? 'shrink' : 'expand'); full.setAttribute('aria-label', on ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    root.addEventListener('mousemove', showBar);
    root.addEventListener('pointerdown', e => { if (!e.target.closest('button,input')) root.focus({ preventScroll: true }); });
    const typing = t => t instanceof Element && (t.isContentEditable || t.matches('textarea,select,input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button])'));
    const onKey = e => {
      if (!root.isConnected || locked || e.ctrlKey || e.metaKey || e.altKey || e.repeat && !/^arrow/i.test(e.key)) return;
      if (typing(e.target)) return;
      const focus = document.activeElement;
      const inside = !focus || focus === document.body || root.contains(focus) || fsEl() === root || root.classList.contains('pseudo-full');
      if (!inside && !root.matches(':hover')) return;
      const box = root.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight || box.width === 0) return;
      if (!help.hidden) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); showHelp(false); } return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const code = e.code;
      let done = true;
      if (k === ' ' || k === 'k' || code === 'KeyK') toggle();
      else if (k === 'f' || code === 'KeyF') full.click();
      else if (k === 'm' || code === 'KeyM') mute.click();
      else if (k === 'ArrowRight') jump(5);
      else if (k === 'ArrowLeft') jump(-5);
      else if (k === 'l' || code === 'KeyL') jump(10);
      else if (k === 'j' || code === 'KeyJ') jump(-10);
      else if (k === 'ArrowUp') setVol((v.muted ? 0 : v.volume) + 0.05);
      else if (k === 'ArrowDown') setVol((v.muted ? 0 : v.volume) - 0.05);
      else if (k === 'Home') goTo(0);
      else if (k === 'End') goTo(v.duration);
      else if (/^Digit[0-9]$|^Numpad[0-9]$/.test(code) && Number.isFinite(v.duration)) goTo(v.duration * Number(code.slice(-1)) / 10);
      else if (k === '>' || (e.shiftKey && code === 'Period')) setRate(SPEEDS[Math.min(SPEEDS.indexOf(v.playbackRate) + 1, SPEEDS.length - 1)] || 1);
      else if (k === '<' || (e.shiftKey && code === 'Comma')) setRate(SPEEDS[Math.max(SPEEDS.indexOf(v.playbackRate) - 1, 0)] || 1);
      else if (k === '?' || (e.shiftKey && code === 'Slash')) showHelp(true);
      else if (k === 'Escape' && root.classList.contains('pseudo-full')) full.click();
      else done = false;
      if (done) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onKey, true);
    const hidden = () => { if (document.hidden && !v.paused) v.pause(); };
    document.addEventListener('visibilitychange', hidden);
    const unmark = watermark(root, opt.mark || {}, () => { locked = true; root.dataset.locked = 'true'; v.pause(); v.removeAttribute('src'); v.load(); spin.hidden = true; big.hidden = true; note.textContent = 'توقف الفيديو لحماية المحتوى. حدّث الصفحة لاستعادة العلامة المائية والتشغيل.'; note.hidden = false; });
    root.classList.add('ui');
    active = () => {
      if (opt.onProgress && v.currentTime) opt.onProgress(v.currentTime, v.duration);
      clearTimeout(hideTimer); unmark();
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('keydown', onKey, true);
      v.pause(); v.removeAttribute('src'); v.load();
      root.remove();
    };
    return { root, video: v };
  }
  let lib = null;
  const HERE = new URL('.', document.currentScript ? document.currentScript.src : location.href);
  function pdfjs() {
    if (!lib) lib = import(new URL('vendor/pdf.min.mjs', HERE).href).then(m => { m.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', HERE).href; return m; }).catch(e => { lib = null; throw e; });
    return lib;
  }
  async function pdf(box, opt) {
    destroy();
    const root = el('div', 'reader');
    const tools = el('div', 'rd-tools');
    const out = btn('minus', 'تصغير'), inn = btn('plus', 'تكبير'), fit = btn('expand', 'ملء العرض');
    const info = el('span', 'rd-info', 'جاري فتح الملف…');
    const copy = el('button', 'btn outline small rd-copy'); copy.type = 'button'; copy.append(icon('download'), 'حمّل نسختك');
    tools.append(el('div', 'pl-group'), info, copy);
    tools.firstChild.append(out, inn, fit);
    const pages = el('div', 'rd-pages');
    root.append(tools, pages);
    box.replaceChildren(root);
    guard(root);
    let closed = false, doc = null, scale = 0, io = null;
    const mark = [opt.mark && opt.mark.name, opt.mark && opt.mark.phone].filter(Boolean).join(' - ');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      const w = window.open('', '_blank');
      const url = opt.tab ? await opt.tab() : '';
      copy.disabled = false;
      if (w && url) { try { w.opener = null; } catch {} w.location.replace(url); }
      else if (w) w.close();
      if (!url && opt.onError) opt.onError();
    });
    const unmark = watermark(root, opt.mark || {}, null);
    active = () => { closed = true; unmark(); if (io) io.disconnect(); if (doc) doc.destroy(); root.remove(); };
    try {
      const m = await pdfjs();
      if (closed) return;
      doc = await m.getDocument({ url: opt.url, isEvalSupported: false, withCredentials: false, rangeChunkSize: 262144, disableStream: false, disableAutoFetch: true }).promise;
    } catch {
      if (!closed) info.textContent = 'تعذر فتح الملف. تأكد من الإنترنت وجرّب تاني.';
      return;
    }
    if (closed) return;
    info.textContent = doc.numPages + ' صفحة';
    const first = await doc.getPage(1);
    const base = first.getViewport({ scale: 1 });
    const fitScale = () => Math.min(2.2, Math.max(0.4, (pages.clientWidth - 24) / base.width));
    scale = fitScale();
    const holders = [];
    for (let i = 1; i <= doc.numPages; i++) { const h = el('div', 'rd-page'); h.dataset.page = String(i); holders.push(h); pages.append(h); }
    const rendered = new Map();
    async function render(h) {
      const n = Number(h.dataset.page);
      if (rendered.get(n) === scale) return;
      rendered.set(n, scale);
      const page = await doc.getPage(n);
      if (closed) return;
      const vp = page.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width * ratio); c.height = Math.floor(vp.height * ratio);
      c.style.width = Math.floor(vp.width) + 'px'; c.style.height = Math.floor(vp.height) + 'px';
      const ctx = c.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
      if (mark) {
        ctx.save();
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.globalAlpha = 0.11; ctx.fillStyle = '#1167B1'; ctx.font = '600 ' + Math.round(16 * scale) + 'px "IBM Plex Sans Arabic", sans-serif'; ctx.textAlign = 'center';
        ctx.translate(vp.width / 2, vp.height / 2); ctx.rotate(-Math.PI / 6);
        for (let y = -vp.height; y < vp.height; y += 150 * scale) for (let x = -vp.width; x < vp.width; x += 320 * scale) ctx.fillText(mark, x, y);
        ctx.restore();
      }
      if (closed) return;
      h.replaceChildren(c);
      h.style.removeProperty('min-height');
    }
    function layout() {
      rendered.clear();
      holders.forEach(h => { h.style.minHeight = Math.floor(base.height * scale) + 'px'; h.style.width = Math.floor(base.width * scale) + 'px'; });
      holders.forEach(h => { if (h.getBoundingClientRect().top < window.innerHeight * 2) render(h); });
    }
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) render(e.target); }), { rootMargin: '600px 0px' });
    holders.forEach(h => io.observe(h));
    layout();
    const zoom = f => { scale = Math.min(3, Math.max(0.4, f)); layout(); };
    out.addEventListener('click', () => zoom(scale / 1.2));
    inn.addEventListener('click', () => zoom(scale * 1.2));
    fit.addEventListener('click', () => zoom(fitScale()));
    if (opt.onOpen) opt.onOpen(doc.numPages);
    return { root };
  }
  return { video, pdf, destroy, pdfjs };
})();
window.Player = Player;
