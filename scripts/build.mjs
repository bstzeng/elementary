import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(root, 'curriculum.json'), 'utf8'));
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const sourceMap = new Map(data.sources.map(s => [s.id, s]));
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-TW');
const iconPaths = {
  mandarin: '<path d="M4 6c5-2 9-1 12 1 3-2 7-3 12-1v20c-5-2-9-1-12 1-3-2-7-3-12-1V6Z"/><path d="M16 7v20M8 11h4m-4 5h4m8-5h4m-4 5h4"/>',
  mathematics: '<rect x="5" y="4" width="22" height="24" rx="4"/><path d="M10 10h12M10 17h4m-2-2v4m6-2h4m-12 7h4m4-2 4 4m0-4-4 4"/>',
  life: '<path d="M16 28V13m0 9C5 22 3 14 5 9c8 0 12 6 11 13Zm0-7C15 6 21 3 28 4c1 8-4 12-12 11Z"/><path d="m7 27 5-1m9 0 5 1"/>',
  'health-pe': '<path d="M16 28S3 20 3 11c0-7 9-10 13-3 4-7 13-4 13 3 0 9-13 17-13 17Z"/><path d="M6 16h6l3-6 3 12 3-6h5"/>',
  'language-choice': '<path d="M4 5h19v15H11l-6 5v-5H4V5Z"/><path d="M23 11h5v14h-5v4l-5-4h-4v-5M9 11h9m-9 4h6"/>',
  flexible: '<path d="m16 3 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1 4-9Z"/><path d="m13 16 2 2 5-5"/>'
};
const svg = (content, size=28, cls='') => `<svg ${cls ? `class="${cls}" ` : ''}width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const chevron = svg('<path d="m9 13 7 7 7-7"/>', 17, 'summary-arrow');
const searchIcon = svg('<circle cx="14" cy="14" r="8"/><path d="m20 20 7 7"/>', 19);
const externalIcon = svg('<path d="M18 5h9v9M27 5 14 18M13 6H5v21h21v-9"/>', 14);
const total = data.courses.reduce((n, c) => n + c.topics.length, 0);
const cardEyebrows = { mandarin: 'LANGUAGE · 語文', mathematics: 'MATH · 數學', life: 'LIFE · 生活', 'health-pe': 'WELLBEING · 健康', 'language-choice': 'VOICES · 多元語言', flexible: 'EXPLORE · 校訂彈性' };
const cardBadges = { 'language-choice': '部定・語別擇一', flexible: '校訂・依校安排' };
const previewTopics = (topics) => {
  const chosen = [], groups = new Set();
  for (const topic of topics) {
    const group = topic.group || '';
    if (!groups.has(group)) { chosen.push(topic); groups.add(group); }
    if (chosen.length === 3) break;
  }
  for (const topic of topics) { if (chosen.length === 3) break; if (!chosen.includes(topic)) chosen.push(topic); }
  return chosen;
};
const cards = data.courses.map((course, index) => {
  const category = course.id === 'flexible' ? 'school' : 'national';
  const title = course.shortTitle || course.title;
  const metadata = normalize([title, course.description, course.classification, course.category, ...course.topics.map(t => `${t.title} ${t.group || ''}`)].join(' '));
  const courseSearch = normalize([course.title, title, course.classification, course.category, ...(course.languageOptions || [])].join(' '));
  const previews = previewTopics(course.topics);
  return `<article class="course-card" data-course="${esc(course.id)}" data-category="${category}" data-search="${esc(metadata)}" data-course-search="${esc(courseSearch)}" aria-labelledby="${esc(course.id)}-title">
  <div class="card-intro">
    <div class="card-top"><span class="course-icon">${svg(iconPaths[course.id])}</span><span class="badge">${cardBadges[course.id] || '部定課程'}</span></div>
    <p class="card-eyebrow">${esc(cardEyebrows[course.id])}</p>
    <h3 id="${esc(course.id)}-title">${esc(title)}</h3>
    <p class="course-description">${esc(course.id === 'language-choice' ? '本土語文、臺灣手語或新住民語文，依意願擇一語別。' : course.description)}</p>
    <div class="topic-preview" aria-hidden="true">${previews.map(t => `<span class="topic-chip">${esc(t.title)}</span>`).join('')}<span class="preview-more">＋${course.topics.length - previews.length}</span></div>
  </div>
  <details class="course-details">
    <summary><span class="summary-label">查看 ${course.topics.length} 個主題</span>${chevron}</summary>
    ${course.languageOptions ? `<div class="card-note"><strong>可選語別</strong><br>${course.languageOptions.map(esc).join("<br>")}</div>` : ''}
    <ol class="topic-list">${course.topics.map((topic, i) => `<li id="${esc(topic.id)}" data-topic-search="${esc(normalize(`${topic.title} ${topic.group || ''}`))}"><span class="topic-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${topic.group ? `<span class="topic-group">${esc(topic.group)}</span>` : ''}${esc(topic.title)}</span></li>`).join('')}</ol>
    ${(course.caveats || []).map(note => `<p class="card-note">${esc(note)}</p>`).join('')}
    <div class="card-sources">課綱與編排參考：${course.sourceIds.map(id => { const s = sourceMap.get(id); if (!s) throw new Error(`Unknown source: ${id}`); return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.shortTitle || s.title)}<span class="sr-only">（另開視窗）</span></a>`; }).join('、')}</div>
  </details>
</article>`;
}).join('\n');
const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Elementary 小學課程主題地圖。依臺灣十二年國教課綱整理小一上學期跨版本參考主題，包含國語文、數學、生活、健康與體育、語文選習及校訂彈性學習。">
  <meta name="theme-color" content="#215b46">
  <meta property="og:title" content="Elementary｜小一上學期・課程主題地圖">
  <meta property="og:description" content="從小一，打開學習的第一頁。先用主題卡片，看見每一門課的學習方向。">
  <meta property="og:type" content="website">
  <title>Elementary｜小一上學期・課程主題地圖</title>
  <link rel="icon" type="image/svg+xml" href="./assets/favicon.svg">
  <link rel="stylesheet" href="./styles.css">
  <script src="./app.js" defer></script>
</head>
<body>
<a class="skip-link" href="#courses">跳到課程主題</a>
<header class="site-header">
  <div class="header-inner shell">
    <a class="brand" href="./" aria-label="Elementary 小學課程主題地圖首頁"><img src="./assets/favicon.svg" width="37" height="37" alt=""><span><span class="brand-name">elementary</span><span class="brand-caption">小學課程主題地圖</span></span></a>
    <nav class="header-links" aria-label="主要導覽"><a href="#courses">課程主題</a><a href="#about">關於這裡</a><a class="repo-link" href="https://github.com/bstzeng/elementary" target="_blank" rel="noopener noreferrer" aria-label="GitHub 原始碼（另開視窗）">GitHub ${externalIcon}</a></nav>
  </div>
</header>
<main class="shell">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <div class="eyebrow">LITTLE STEPS, BIG DISCOVERIES</div>
      <h1 id="hero-title">小學六年，<br><span>從這一頁開始。</span></h1>
      <p class="hero-description">把大大的學習世界，整理成一張張小卡片。<br>從小一上學期出發，一起看見每一門課的學習方向。</p>
      <div class="hero-meta"><a class="primary-link" href="#courses">探索本學期主題 ${svg('<path d="M5 16h22m-8-8 8 8-8 8"/>', 17)}</a><span class="catalog-status">主題整理版 · 尚未提供教學內容</span></div>
    </div>
    <div class="hero-art"><img src="./assets/learning-garden.svg" width="520" height="390" alt="打開的書本裡長出一株小花，身旁有字母、數字與暖暖的太陽"><span class="art-caption">讓每一份好奇，慢慢發芽。</span></div>
  </section>
  <section class="grade-panel" aria-label="年級與學期">
    <div class="grade-select"><span class="control-label">選擇年級</span><div class="grade-options" aria-label="年級">
      <button class="grade-button" type="button" aria-current="true" aria-label="小一，目前顯示">小一</button>
      ${['二','三','四','五','六'].map(n => `<button class="grade-button" type="button" disabled aria-label="小${n}，規劃中">小${n}<span class="planned">規劃中</span></button>`).join('')}
    </div></div>
    <div class="semester-options" aria-label="學期"><button class="semester-button" type="button" aria-current="true" aria-label="上學期，目前顯示">上學期</button><button class="semester-button" type="button" disabled>下學期 · 規劃中</button></div>
  </section>
  <section id="courses" class="catalog" aria-labelledby="catalog-title">
    <div class="section-top"><div><span class="section-kicker">GRADE 01 / SEMESTER 01</span><h2 id="catalog-title">小一上學期・課程主題</h2><p class="section-copy">先認識主題，再慢慢探索。點開卡片，查看完整清單。</p></div>
      <form class="search js-only" role="search"><label class="sr-only" for="topic-search">搜尋課程與主題</label>${searchIcon}<input id="topic-search" type="search" placeholder="搜尋主題，例如：注音、數字、校園" autocomplete="off" maxlength="100"><button class="search-clear" type="button" aria-label="清除搜尋" hidden>${svg('<path d="m10 10 12 12m0-12L10 22"/>', 18)}</button></form>
    </div>
    <noscript><p class="no-script">你仍可點開每張卡片，查看全部主題；搜尋與篩選需要啟用 JavaScript。</p></noscript>
    <div class="toolbar js-only"><div class="filters" role="group" aria-label="篩選課程類型"><button type="button" class="filter" data-filter="all" aria-pressed="true">全部課程</button><button type="button" class="filter" data-filter="national" aria-pressed="false">部定課程</button><button type="button" class="filter" data-filter="school" aria-pressed="false">校訂彈性</button></div><div class="results"><span id="result-count" role="status" aria-live="polite" aria-atomic="true">${data.courses.length} 類課程 · ${total} 個主題</span><button class="expand-all" type="button">展開全部</button></div></div>
    <div class="course-grid">${cards}</div>
    <div class="empty-state" hidden>${svg('<circle cx="14" cy="14" r="8"/><path d="m20 20 7 7m-17-8h7"/>', 36)}<h3>還沒找到這個主題</h3><p id="empty-message">試試其他關鍵字，或切換課程類型。</p><button class="reset-button" type="button">重設搜尋與篩選</button></div>
    <aside class="scope-note" aria-label="課綱與收錄範圍">${svg('<circle cx="16" cy="16" r="12"/><path d="M16 14v8m0-12h.01"/>', 20)}<div><h3>這份主題地圖怎麼看？</h3><p>依臺灣十二年國教（108 課綱）整理；這是跨版本的入門主題參考，不是全國統一的上學期課本目錄。實際進度請以學校課程計畫與教材版本為準。</p><details><summary>查看課程分類與範圍說明 ${chevron}</summary><ul>${data.meta.caveats.map(c => `<li>${esc(c)}</li>`).join('')}</ul></details></div></aside>
  </section>
  <section id="about" class="roadmap" aria-labelledby="roadmap-title"><div class="roadmap-copy"><span class="roadmap-icon">${svg('<path d="M16 28V13m0 9C5 22 3 14 5 9c8 0 12 6 11 13Zm0-7C15 6 21 3 28 4c1 8-4 12-12 11Z"/>', 27)}</span><div><h2 id="roadmap-title">一張持續長大的學習地圖</h2><p>目標收集小一到小六的課程。現在，先把小一上學期的主題整理好。</p></div></div><span class="roadmap-label">目前階段：主題目錄</span></section>
  <section id="sources" class="sources-section" aria-labelledby="sources-title"><h2 id="sources-title">課綱與資料來源</h2><p>課程分類以官方課綱為準；主題名稱以本站原創方式歸納，未重製教科書課文或教材。核對日期：${esc(data.meta.verifiedOn || '2026-10-05')}。</p><ul class="source-links">${data.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.shortTitle || s.title)}<span class="sr-only">（另開視窗）</span></a></li>`).join('')}</ul></section>
</main>
<footer class="site-footer"><div class="footer-inner shell"><p><span class="footer-brand">elementary</span>小小一步，慢慢長大。</p><p>臺灣國小課程主題整理 · 非教育主管機關官方網站</p></div></footer>
</body>
</html>`;
await writeFile(path.join(root, 'index.html'), html);
console.log(`Built index.html: ${data.courses.length} course categories, ${total} topics, ${data.sources.length} sources.`);
