(() => {
  const elements = window.CHEM_ELEMENTS;
  const families = { 'Alkali metal': 'فلزات قلوية', 'Alkaline earth metal': 'فلزات قلوية أرضية', 'Transition metal': 'فلزات انتقالية', 'Post-transition metal': 'فلزات بعد انتقالية', Metalloid: 'أشباه فلزات', Nonmetal: 'لافلزات', Halogen: 'هالوجينات', 'Noble gas': 'غازات نبيلة', Lanthanide: 'لانثانيدات', Actinide: 'أكتينيدات' };
  const grid = document.querySelector('#periodic-grid');
  const search = document.querySelector('#element-search');
  const familyFilter = document.querySelector('#family-filter');
  const stateFilter = document.querySelector('#state-filter');
  const dialog = document.querySelector('#element-dialog');
  let selected = 1;
  function put(id, text) { document.getElementById(id).textContent = text; }
  function node(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; }
  Object.entries(families).forEach(([value, label]) => {
    const option = node('option', '', label); option.value = value; familyFilter.append(option);
    const key = node('span', 'family-key', label); key.dataset.family = value; document.querySelector('#family-legend').append(key);
  });
  for (let group = 1; group <= 18; group++) { const label = node('span', 'group-label', group); label.style.gridColumn = String(group); label.style.gridRow = '1'; grid.append(label); }
  for (const [row, label] of [[9, 'اللانثانيدات'], [10, 'الأكتينيدات']]) { const el = node('span', 'series-label', label); el.style.gridRow = String(row); grid.append(el); }
  for (const [row, text] of [[7, '57–71'], [8, '89–103']]) { const el = node('span', 'series-marker', text); el.style.gridRow = String(row); el.style.gridColumn = '3'; grid.append(el); }
  const buttons = elements.map(e => {
    const b = node('button', 'element-cell'); b.type = 'button'; b.dataset.family = e.GroupBlock; b.dataset.number = e.AtomicNumber; b.style.gridColumn = String(e.GridColumn); b.style.gridRow = String(e.GridRow); b.setAttribute('aria-label', e.AtomicNumber + ' ' + e.ArabicName + ' ' + e.Symbol); b.title = e.ArabicName + ' / ' + e.Name;
    b.append(node('span', 'cell-number', e.AtomicNumber), node('strong', '', e.Symbol), node('span', 'cell-name', e.ArabicName));
    b.addEventListener('click', () => openElement(e.AtomicNumber)); grid.append(b); return b;
  });
  function normalize(s) { return String(s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).trim(); }
  function matches(e, query, family, state) {
    const q = normalize(query);
    const text = normalize(e.ArabicName + ' ' + e.Name + ' ' + e.Symbol);
    const queryMatch = !q || (/^\d+$/.test(q) ? String(e.AtomicNumber) === q : text.includes(q));
    const stateMatch = !state || (state === 'predicted' ? !['Solid', 'Liquid', 'Gas'].includes(e.StandardState) : e.StandardState === state);
    return queryMatch && (!family || family === e.GroupBlock) && stateMatch;
  }
  window.PeriodicRules = Object.freeze({ matches });
  function filter() {
    let count = 0;
    elements.forEach((e, i) => { const on = matches(e, search.value, familyFilter.value, stateFilter.value); buttons[i].classList.toggle('dimmed', !on); buttons[i].disabled = !on; if (on) count++; });
    put('result-count', count); document.querySelector('#no-elements').hidden = count > 0;
  }
  search.addEventListener('input', filter); familyFilter.addEventListener('change', filter); stateFilter.addEventListener('change', filter);
  document.querySelector('#filter-reset').addEventListener('click', () => { search.value = ''; familyFilter.value = ''; stateFilter.value = ''; filter(); search.focus(); });
  function stateName(state) { return ({ Solid: 'صلب', Liquid: 'سائل', Gas: 'غاز', 'Expected to be a Solid': 'صلب (متوقع)', 'Expected to be a Gas': 'غاز (متوقع)' })[state] || 'غير معروفة'; }
  function openElement(n, updateHash = true) {
    const e = elements.find(el => el.AtomicNumber === n); if (!e) return;
    selected = n; dialog.dataset.family = e.GroupBlock;
    put('element-category', families[e.GroupBlock]); put('element-number', e.AtomicNumber); put('element-symbol', e.Symbol); put('element-weight', e.AtomicWeight + ' u'); put('element-title', e.ArabicName); put('element-english', e.Name); put('element-state', stateName(e.StandardState));
    const properties = document.querySelector('#element-properties'); properties.replaceChildren();
    const config = e.ElectronConfiguration.replace(' (predicted)', ' (متوقع)');
    const values = [['العدد الذري', e.AtomicNumber, ''], ['الكتلة الذرية المصدرية', e.AtomicWeight, 'u'], ['الدورة', e.Period, ''], ['المجموعة', e.Group || 'سلسلة ' + families[e.GroupBlock], ''], ['التوزيع الإلكتروني', config, ''], ['حالات التأكسد', e.OxidationStates, ''], ['السالبية الكهربائية (باولنغ)', e.Electronegativity, ''], ['نصف القطر الذري', e.AtomicRadius, 'pm'], ['طاقة التأين الأولى', e.IonizationEnergy, 'eV'], ['الألفة الإلكترونية', e.ElectronAffinity, 'eV'], ['درجة الانصهار', e.MeltingPoint, 'K'], ['درجة الغليان', e.BoilingPoint, 'K'], ['الكثافة', e.Density, 'g/cm³'], ['سنة الاكتشاف', e.YearDiscovered === 'Ancient' ? 'معروف منذ القدم' : e.YearDiscovered, '']];
    values.forEach(([label, value, unit]) => { const item = node('div'); const v = value === '' || value === undefined || value === null ? 'غير متاحة في المصدر' : String(value) + (unit ? ' ' + unit : ''); const dd = node('dd', '', v); if (/[a-zA-Z0-9]/.test(v)) dd.dir = 'ltr'; item.append(node('dt', '', label), dd); properties.append(item); });
    document.querySelector('#element-source').href = 'https://pubchem.ncbi.nlm.nih.gov/element/' + e.AtomicNumber;
    document.querySelector('#element-previous').disabled = n === 1; document.querySelector('#element-next').disabled = n === 118;
    if (updateHash) history.replaceState(null, '', '#element-' + n);
    if (!dialog.open) dialog.showModal();
  }
  document.querySelector('#element-previous').addEventListener('click', () => openElement(selected - 1)); document.querySelector('#element-next').addEventListener('click', () => openElement(selected + 1)); document.querySelector('#element-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { history.replaceState(null, '', location.pathname); buttons[selected - 1]?.focus({ preventScroll: true }); });
  function fromHash() { const match = /^#element-(\d+)$/.exec(location.hash); if (match) openElement(Number(match[1]), false); }
  grid.addEventListener('keydown', e => { const index = buttons.indexOf(document.activeElement); if (index < 0) return; const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 18, ArrowUp: -18 }; const step = steps[e.key]; if (step === undefined) return; e.preventDefault(); let next = index + step; while (buttons[next]?.disabled) next += Math.sign(step); buttons[next]?.focus(); });
  window.addEventListener('hashchange', fromHash); fromHash();
})();
