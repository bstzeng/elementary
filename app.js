/* Progressive enhancement: the complete topic directory lives in index.html. */
(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.course-card')];
  const search = document.querySelector('#topic-search');
  const form = document.querySelector('.search');
  const clear = document.querySelector('.search-clear');
  const filters = [...document.querySelectorAll('.filter')];
  const resultCount = document.querySelector('#result-count');
  const emptyState = document.querySelector('.empty-state');
  const emptyMessage = document.querySelector('#empty-message');
  const expandButton = document.querySelector('.expand-all');
  let category = 'all';
  let printState = null;
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-TW').trim();
  const visibleCards = () => cards.filter(card => !card.hidden);
  const updateExpandButton = () => {
    const visible = visibleCards();
    expandButton.hidden = !visible.length;
    expandButton.textContent = visible.length && visible.every(card => card.querySelector('details').open) ? '收合全部' : '展開全部';
  };
  function applyFilters() {
    const query = normalize(search.value);
    const terms = query.split(/\s+/).filter(Boolean);
    const includesAll = text => terms.every(term => text.includes(term));
    let courseCount = 0;
    let topicCount = 0;
    for (const card of cards) {
      const categoryMatch = category === 'all' || card.dataset.category === category;
      const courseMatch = query && includesAll(card.dataset.courseSearch);
      const topics = [...card.querySelectorAll('.topic-list li')];
      let matches = 0;
      for (const topic of topics) {
        const matched = !query || courseMatch || includesAll(topic.dataset.topicSearch);
        topic.hidden = !matched;
        if (matched) matches++;
      }
      card.hidden = !categoryMatch || !matches;
      if (!card.hidden) { courseCount++; topicCount += matches; }
      card.querySelector('.summary-label').textContent = query ? `查看 ${matches} 個符合主題` : `查看 ${topics.length} 個主題`;
      card.querySelector('.topic-preview').hidden = !!query;
      if (query && !card.hidden) card.querySelector('details').open = true;
    }
    clear.hidden = !search.value;
    resultCount.textContent = `${courseCount} 類課程 · ${topicCount} 個${query ? '符合' : ''}主題`;
    emptyState.hidden = courseCount > 0;
    emptyMessage.textContent = query ? `找不到符合「${search.value.trim()}」的主題。試試其他關鍵字，或切換課程類型。` : '這個課程類型目前沒有收錄主題，請試試其他分類。';
    updateExpandButton();
  }
  search.addEventListener('input', applyFilters);
  form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
  clear.addEventListener('click', () => { search.value = ''; applyFilters(); search.focus(); });
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    applyFilters();
  }));
  document.querySelector('.reset-button').addEventListener('click', () => {
    search.value = ''; category = 'all';
    filters.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.filter === 'all')));
    applyFilters(); search.focus();
  });
  expandButton.addEventListener('click', () => {
    const visible = visibleCards();
    const shouldOpen = !visible.every(card => card.querySelector('details').open);
    visible.forEach(card => { card.querySelector('details').open = shouldOpen; });
    updateExpandButton();
  });
  cards.forEach(card => card.querySelector('details').addEventListener('toggle', updateExpandButton));
  // Clicking an already-selected grade/semester returns focus to its content.
  document.querySelectorAll('.grade-panel [aria-current="true"]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('#courses').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    document.querySelector('#catalog-title').setAttribute('tabindex', '-1');
    document.querySelector('#catalog-title').focus({ preventScroll: true });
  }));
  // Print the currently filtered topics with their lists expanded, restoring UI afterwards.
  window.addEventListener('beforeprint', () => {
    printState = [...document.querySelectorAll('details')].map(detail => [detail, detail.open]);
    printState.forEach(([detail]) => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (printState) printState.forEach(([detail, open]) => { detail.open = open; });
    printState = null;
    updateExpandButton();
  });
  document.documentElement.classList.add('js-ready');
  applyFilters();
})();
