'use strict';
(() => {
  document.querySelectorAll('[data-print]').forEach(button => {
    button.addEventListener('click', () => window.print());
  });
  const form = document.querySelector('#exam-filters');
  if (!form) return;
  const cards = [...document.querySelectorAll('.exam-card')];
  const status = document.querySelector('#filter-result');
  const empty = document.querySelector('#empty-state');
  const names = ['grade', 'semester', 'course', 'phase', 'variant'];
  function restore() {
    const params = new URLSearchParams(location.search);
    for (const name of names) {
      const select = form.elements.namedItem(name);
      const value = params.get(name) || 'all';
      select.value = [...select.options].some(option => option.value === value) ? value : 'all';
    }
    form.elements.namedItem('openOnly').checked = params.get('open') === '1';
  }
  function apply(writeUrl = true) {
    let visible = 0, available = 0;
    const values = Object.fromEntries(names.map(name => [name, form.elements.namedItem(name).value]));
    const openOnly = form.elements.namedItem('openOnly').checked;
    cards.forEach(card => {
      let matches = ['grade', 'semester', 'course'].every(name => values[name] === 'all' || card.dataset[name] === values[name]);
      let cardAvailable = 0;
      card.querySelectorAll('.phase-group').forEach(group => {
        group.hidden = values.phase !== 'all' && values.phase !== group.dataset.phase;
        group.querySelectorAll('[data-variant]').forEach(row => {
          row.hidden = values.variant !== 'all' && row.dataset.variant !== values.variant;
          if (!group.hidden && !row.hidden && row.classList.contains('available')) cardAvailable++;
        });
      });
      if (openOnly && cardAvailable === 0) matches = false;
      card.hidden = !matches;
      if (matches) { visible++; available += cardAvailable; }
    });
    status.textContent = `${visible} 個學期課程 · 目前條件下有 ${available} 份可開啟`;
    empty.hidden = visible !== 0;
    if (writeUrl) {
      const url = new URL(location.href);
      names.forEach(name => values[name] === 'all' ? url.searchParams.delete(name) : url.searchParams.set(name, values[name]));
      openOnly ? url.searchParams.set('open', '1') : url.searchParams.delete('open');
      history.replaceState(null, '', url);
    }
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', () => apply());
  form.addEventListener('reset', () => setTimeout(() => apply(), 0));
  window.addEventListener('popstate', () => { restore(); apply(false); });
  restore();
  apply(false);
})();
