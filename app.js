/* All twelve semesters are in HTML. This script enhances navigation and filtering. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const panels = $$('.semester-panel');
  const grades = $$('.grade-button');
  const terms = $$('.semester-button');
  const filters = $$('.filter');
  const search = $('#topic-search');
  const subject = $('#subject-filter');
  const clear = $('.search-clear');
  const expand = $('.expand-all');
  const result = $('#result-count');
  const heading = $('#catalog-title');
  const defaults = () => ({ grade: 1, semester: 1, category: 'all', subject: 'all', query: '' });
  let state = defaults();
  let printState = null;
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-TW').trim();
  const activePanel = () => panels.find(p => +p.dataset.grade === state.grade && +p.dataset.semester === state.semester);
  const cards = () => [...activePanel().querySelectorAll('.course-card')];
  const visibleCards = () => cards().filter(card => !card.hidden);
  function readHash() {
    if (!location.hash) return defaults();
    const match = /^#g([1-6])s([12])(?:\?(.*))?$/.exec(location.hash);
    if (!match) return null;
    const params = new URLSearchParams(match[3] || '');
    return { grade: +match[1], semester: +match[2], category: ['national','school'].includes(params.get('type')) ? params.get('type') : 'all', subject: params.get('subject') || 'all', query: (params.get('q') || '').slice(0,100) };
  }
  function writeHash(replace = false) {
    const params = new URLSearchParams();
    if (state.category !== 'all') params.set('type',state.category);
    if (state.subject !== 'all') params.set('subject',state.subject);
    if (state.query) params.set('q',state.query);
    const hash = `#g${state.grade}s${state.semester}${params.size ? `?${params}` : ''}`;
    if (hash === location.hash) return;
    history[replace ? 'replaceState' : 'pushState'](null,'',hash);
  }
  function updateExpand() {
    const visible = visibleCards();
    expand.hidden = !visible.length;
    expand.textContent = visible.length && visible.every(c => c.querySelector('details').open) ? '收合全部' : '展開全部';
  }
  function updateSubjects() {
    const choices = cards().map(c => ({ id: c.dataset.course, title: c.querySelector('h3').textContent }));
    if (!choices.some(c => c.id === state.subject)) state.subject = 'all';
    subject.replaceChildren();
    for (const choice of [{id:'all',title:'全部科目'},...choices]) {
      const option = document.createElement('option');
      option.value = choice.id;
      option.textContent = choice.title;
      subject.append(option);
    }
    subject.value = state.subject;
  }
  function applyFilters() {
    const query = normalize(state.query);
    const words = query.split(/\s+/).filter(Boolean);
    const includesAll = text => words.every(word => text.includes(word));
    let courseCount = 0;
    let topicCount = 0;
    for (const card of cards()) {
      const categoryMatch = state.category === 'all' || card.dataset.category === state.category;
      const subjectMatch = state.subject === 'all' || card.dataset.course === state.subject;
      const courseMatch = query && includesAll(card.dataset.courseSearch);
      const topics = [...card.querySelectorAll('.topic-list li')];
      let matches = 0;
      for (const topic of topics) {
        const match = !query || courseMatch || includesAll(topic.dataset.topicSearch);
        topic.hidden = !match;
        if (match) matches++;
      }
      card.hidden = !categoryMatch || !subjectMatch || !matches;
      if (!card.hidden) { courseCount++; topicCount += matches; }
      card.querySelector('.summary-label').textContent = query ? `查看 ${matches} 個符合主題` : `查看 ${topics.length} 個主題`;
      card.querySelector('.topic-preview').hidden = !!query;
      if (query && !card.hidden) card.querySelector('details').open = true;
    }
    clear.hidden = !search.value;
    filters.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.filter === state.category)));
    result.textContent = `${activePanel().dataset.label}：${courseCount} 類課程 · ${topicCount} 個${query ? '符合' : ''}主題`;
    $('.empty-state').hidden = courseCount > 0;
    $('#empty-message').textContent = query ? `「${state.query.trim()}」在目前學期與篩選條件下沒有結果。可清除篩選，或切換年級、學期再找找。` : '目前的科目與課程類型沒有交集。請改選全部科目或重設篩選。';
    $('#filter-hint').textContent = `搜尋範圍：${activePanel().dataset.label}`;
    updateExpand();
  }
  function showSelection() {
    const panel = activePanel();
    panels.forEach(p => { p.hidden = p !== panel; });
    grades.forEach(b => b.setAttribute('aria-pressed',String(+b.dataset.grade === state.grade)));
    terms.forEach(b => b.setAttribute('aria-pressed',String(+b.dataset.semester === state.semester)));
    heading.textContent = `${panel.dataset.label}・課程主題`;
    $('#selection-kicker').textContent = `GRADE ${String(state.grade).padStart(2,'0')} / SEMESTER ${String(state.semester).padStart(2,'0')} · 第${['一','二','三'][Math.ceil(state.grade/2)-1]}學習階段`;
    document.title = `Elementary｜${panel.dataset.label}・課綱主題地圖`;
    search.value = state.query;
    updateSubjects();
    applyFilters();
  }
  function changeSelection(next) {
    const unchanged = state.grade === next.grade && state.semester === next.semester;
    state = { ...state, ...next };
    showSelection();
    writeHash();
    if (unchanged) {
      heading.focus({preventScroll:true});
      $('#courses').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  }
  grades.forEach(b => b.addEventListener('click',() => changeSelection({grade:+b.dataset.grade,semester:state.semester})));
  terms.forEach(b => b.addEventListener('click',() => changeSelection({grade:state.grade,semester:+b.dataset.semester})));
  filters.forEach(b => b.addEventListener('click',() => {state.category=b.dataset.filter;applyFilters();writeHash();}));
  subject.addEventListener('change',() => {state.subject=subject.value;applyFilters();writeHash();});
  search.addEventListener('input',() => {state.query=search.value.slice(0,100);applyFilters();writeHash(true);});
  $('.search').addEventListener('submit',event => {event.preventDefault();state.query=search.value.slice(0,100);applyFilters();writeHash(true);});
  clear.addEventListener('click',() => {state.query='';search.value='';applyFilters();writeHash(true);search.focus();});
  $('.reset-button').addEventListener('click',() => {state.category='all';state.subject='all';state.query='';search.value='';subject.value='all';applyFilters();writeHash();search.focus();});
  expand.addEventListener('click',() => {
    const visible = visibleCards();
    const open = !visible.every(c => c.querySelector('details').open);
    visible.forEach(c => {c.querySelector('details').open=open;});
    updateExpand();
  });
  $$('.course-details').forEach(detail => detail.addEventListener('toggle',updateExpand));
  function onNavigate() {const next=readHash();if(next){state=next;showSelection();}}
  window.addEventListener('popstate',onNavigate);
  window.addEventListener('hashchange',onNavigate);
  window.addEventListener('beforeprint',() => {
    if (printState) return;
    printState=visibleCards().map(c => [c.querySelector('details'),c.querySelector('details').open]);
    printState.forEach(([detail]) => {detail.open=true;});
  });
  window.addEventListener('afterprint',() => {
    if(printState)printState.forEach(([detail,open])=>{detail.open=open;});
    printState=null;updateExpand();
  });
  $('.print-button').addEventListener('click',() => window.print());
  state=readHash()||defaults();
  showSelection();
  document.documentElement.classList.add('js-ready');
})();
