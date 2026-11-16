(() => {
  function shellCounts(element, elements) {
    const cores = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };
    const counts = Array(7).fill(0);
    const core = /^\[([A-Za-z]+)\]/.exec(element.ElectronConfiguration);
    if (core) {
      const previous = elements.find(e => e.AtomicNumber === cores[core[1]]);
      if (previous) shellCounts(previous, elements).forEach((n, i) => { counts[i] = n; });
    }
    for (const match of element.ElectronConfiguration.matchAll(/([1-7])[spdf](\d+)/g)) counts[Number(match[1]) - 1] += Number(match[2]);
    while (counts.length && counts[counts.length - 1] === 0) counts.pop();
    return counts;
  }
  window.AtomRules = Object.freeze({ shellCounts });
})();