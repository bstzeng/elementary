import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async name => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const data = await read('curriculum.json');
const sources = await read(data.sourceFile);
const lessonManifest = await read('data/lessons.json');
const openLessons = new Set(lessonManifest.lessonIds);
const lessonHref = id => `./lessons/${id}.html`;
const lessonLink = topic => `<a class="start-lesson" href="${esc(lessonHref(topic.id))}">開始第一主題 <span aria-hidden="true">→</span><span class="sr-only">：${esc(topic.title)}</span></a>`;
const framework = await read(data.frameworkFile);
const semesters = (await Promise.all(data.gradeFiles.map(read))).flatMap(g => g.semesters);
const sourceMap = new Map(sources.map(s => [s.id, s]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-TW');
const gradeNames = ['一','二','三','四','五','六'];
const semesterTitle = s => `小${gradeNames[s.grade-1]}${s.semester === 1 ? '上' : '下'}學期`;
const iconPaths = {
  mandarin:'<path d="M4 6c5-2 9-1 12 1 3-2 7-3 12-1v20c-5-2-9-1-12 1-3-2-7-3-12-1V6Z"/><path d="M16 7v20M8 11h4m-4 5h4m8-5h4m-4 5h4"/>',
  mathematics:'<rect x="5" y="4" width="22" height="24" rx="4"/><path d="M10 10h12M10 17h4m-2-2v4m6-2h4m-12 7h4m4-2 4 4m0-4-4 4"/>',
  life:'<path d="M16 28V13m0 9C5 22 3 14 5 9c8 0 12 6 11 13Zm0-7C15 6 21 3 28 4c1 8-4 12-12 11Z"/>',
  'health-pe':'<path d="M16 28S3 20 3 11c0-7 9-10 13-3 4-7 13-4 13 3 0 9-13 17-13 17Z"/><path d="M6 16h6l3-6 3 12 3-6h5"/>',
  'language-choice':'<path d="M4 5h19v15H11l-6 5v-5H4V5Z"/><path d="M23 11h5v14h-5v4l-5-4h-4v-5M9 11h9m-9 4h6"/>',
  'school-flexible':'<path d="m16 3 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1 4-9Z"/>',
  english:'<path d="M4 6h24v17H16l-7 6v-6H4Z"/><path d="m9 18 4-9 4 9m-7-3h6m5-6v9"/>',
  social:'<circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c8 7 8 17 0 24-8-7-8-17 0-24ZM6 10h20M6 22h20"/>',
  science:'<path d="M11 4h10m-8 0v9L5 25c-1 2 0 3 2 3h18c2 0 3-1 2-3l-8-12V4M9 20h14"/><circle cx="15" cy="22" r="1"/>',
  arts:'<path d="M16 4C8 4 3 9 3 16s5 12 11 12c6 0 2-6 6-6h4c7 0 6-18-8-18Z"/><circle cx="10" cy="12" r="1"/><circle cx="17" cy="9" r="1"/><circle cx="23" cy="13" r="1"/><circle cx="8" cy="19" r="1"/>',
  integrated:'<circle cx="10" cy="10" r="4"/><circle cx="23" cy="11" r="3"/><path d="M3 27v-4a7 7 0 0 1 14 0v4m3-7a6 6 0 0 1 9 5v2M8 24h4"/>'
};
const svg=(body,size=28,cls='')=>`<svg ${cls?`class="${cls}" `:''}width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const chevron=svg('<path d="m9 13 7 7 7-7"/>',17,'summary-arrow');
const searchIcon=svg('<circle cx="14" cy="14" r="8"/><path d="m20 20 7 7"/>',19);
const externalIcon=svg('<path d="M18 5h9v9M27 5 14 18M13 6H5v21h21v-9"/>',14);
const eyebrows={mandarin:'LANGUAGE · 語文',mathematics:'MATH · 數學',life:'LIFE · 生活','health-pe':'WELLBEING · 健康','language-choice':'VOICES · 多元語言','school-flexible':'EXPLORE · 校訂彈性',english:'ENGLISH · 英語',social:'SOCIETY · 社會',science:'SCIENCE · 自然',arts:'ARTS · 藝術',integrated:'GROW · 綜合活動'};
const sourceType=s=>s.kind.startsWith('official')?'官方課綱／說明':'學期編排實例';
const sourceLinks=ids=>ids.map(id=>{const s=sourceMap.get(id);if(!s)throw Error(`Unknown source ${id}`);return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.shortTitle||s.title)}<span class="sr-only">（另開視窗）</span></a>`;}).join('、');
function renderCard(c,s){
 const prefix=`g${s.grade}s${s.semester}-${c.id}`;
 const openCount=c.topics.filter(t=>openLessons.has(t.id)).length;
 const category=c.classification==='school-defined'?'school':'national';
 const chosen=[],groups=new Set();
 for(const t of c.topics){if(!groups.has(t.group)){chosen.push(t);groups.add(t.group);}if(chosen.length===3)break;}
 for(const t of c.topics){if(chosen.length===3)break;if(!chosen.includes(t))chosen.push(t);}
 const courseSearch=normalize([c.title,c.shortTitle,c.category,...(c.languageOptions||[])].join(' '));
 return `<article class="course-card" data-course="${esc(c.id)}" data-category="${category}" data-course-search="${esc(courseSearch)}" aria-labelledby="${prefix}-title">
 <div class="card-intro"><div class="card-top"><span class="course-icon">${svg(iconPaths[c.id]||iconPaths['school-flexible'])}</span><span class="badge">${esc(c.badge|| (category==='school'?'校訂・依校安排':'部定課程'))}</span></div>
 <p class="card-eyebrow">${esc(eyebrows[c.id])}</p><h3 id="${prefix}-title">${esc(c.shortTitle||c.title)}</h3>
 <p class="course-description">${esc(c.description)}</p><p class="course-periods">${esc(c.weeklyPeriods)}<span>學期參考範圍</span></p>
 ${openLessons.has(c.topics[0].id)?lessonLink(c.topics[0]):''}${openCount?`<p class="lesson-count">已開放 ${openCount}／${c.topics.length} 個主題教材</p>`:''}<div class="topic-preview" aria-hidden="true">${chosen.map(t=>`<span class="topic-chip">${esc(t.title)}</span>`).join('')}<span class="preview-more">＋${c.topics.length-chosen.length}</span></div></div>
 <details class="course-details"><summary><span class="summary-label">查看 ${c.topics.length} 個主題</span>${chevron}</summary>
 ${c.languageOptions?`<p class="card-note"><strong>依意願選一語別</strong><br>${c.languageOptions.map(esc).join('、')}</p>`:''}
 <p class="topic-basis">${esc(c.topicBasis)}</p><ol class="topic-list">${c.topics.map((t,i)=>`<li id="${esc(t.id)}" data-topic-search="${esc(normalize(`${t.title} ${t.group||''}`))}"><span class="topic-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span>${t.group?`<span class="topic-group">${esc(t.group)}</span>`:''}${openLessons.has(t.id)?`<a class="topic-lesson-link" href="${esc(lessonHref(t.id))}">${esc(t.title)}<span class="lesson-open-label">教材已開放</span></a>`:esc(t.title)}</span></li>`).join('')}</ol>
 ${(c.caveats||[]).map(n=>`<p class="card-note">${esc(n)}</p>`).join('')}
 <div class="card-sources">${c.sourceIds.map(id=>{const source=sourceMap.get(id);return `<div><span>${sourceType(source)}：</span>${sourceLinks([id])}</div>`;}).join('')}</div></details></article>`;
}
function renderFrameworkSubject(s) {
 const labels={stage1:'一、二年級',stage2:'三、四年級',stage3:'五、六年級'};
 const list=items=>`<ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
 return `<article class="framework-subject"><h3>${esc(s.title)}</h3><p class="framework-stage">${esc(s.stageNote||s.stages?.join('、')||'依各領域課綱')}</p><h4>學習表現重點</h4>${list(s.performance)}<h4>學習內容重點</h4>${list(s.content)}
 ${s.stageProgression?`<h4>階段銜接</h4><ul>${s.stageProgression.map(p=>`<li><strong>${esc(labels[p.stage]||p.stage)}</strong>：${esc(p.summary)}</li>`).join('')}</ul>`:''}
 ${s.languageOptions?`<details class="language-framework"><summary>各語別的學習方式與官方來源 ${chevron}</summary>${s.languageOptions.map(l=>`<section><h4>${esc(l.title)}</h4><p>${l.performance.map(esc).join('')}</p>${list(l.content)}<p class="card-sources">${sourceLinks(l.sourceIds)}</p></section>`).join('')}<p>以上為不同語別的閱讀導覽，學生依意願選習一項；細節與程度依各語別課綱及學校安排。</p></details>`:''}
 <p class="card-sources">${sourceLinks(s.sourceIds)}</p></article>`;
}
const topicCount=semesters.reduce((n,s)=>n+s.courses.reduce((m,c)=>m+c.topics.length,0),0);
const cardCount=semesters.reduce((n,s)=>n+s.courses.length,0);
const lessonCoverageText=openLessons.size===topicCount
 ? `全部 ${topicCount} 個參考主題已提供原創教材、練習解析與陪學指南。各課的語言示範、實作條件與教學支持，請依頁面說明安排。`
 : `目前 ${openLessons.size} 個主題已有原創教材、練習解析與陪學指南，其餘 ${topicCount-openLessons.size} 個主題仍是範圍總覽，將逐批加入詳細內容。`;
const stageData=framework.stages.map(stage=>`<article class="stage-card"><p class="section-kicker">${esc(stage.title)}</p><h3>${esc(Array.isArray(stage.grades)?`${stage.grades[0]}–${stage.grades.at(-1)}年級`:stage.grades)}</h3><p>${esc(stage.description)}</p><p class="stage-periods">${esc(stage.weeklySummary)}</p></article>`).join('');
const html=`<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="依臺灣十二年國教課綱整理小一至小六、十二學期的課程主題總覽，含原創教材、練習解析與官方來源。"><meta name="theme-color" content="#215b46"><meta property="og:title" content="Elementary｜小學六年課綱主題地圖"><meta property="og:description" content="六個年級、十二個學期，一張張卡片看懂學習方向。"><meta property="og:type" content="website"><title>Elementary｜小學六年課綱主題地圖</title><link rel="icon" type="image/svg+xml" href="./assets/favicon.svg"><link rel="stylesheet" href="./styles.css"><script src="./app.js" defer></script></head>
<body><a class="skip-link" href="#courses">跳到課程主題</a><header class="site-header"><div class="header-inner shell"><a class="brand" href="./" aria-label="Elementary 小學課程主題地圖首頁"><img src="./assets/favicon.svg" width="37" height="37" alt=""><span><span class="brand-name">elementary</span><span class="brand-caption">小學課程主題地圖</span></span></a><nav class="header-links" aria-label="主要導覽"><a href="#courses">課程主題</a><a href="./exams/">考卷與答案</a><a href="#framework">課綱架構</a><a class="repo-link" href="https://github.com/bstzeng/elementary" target="_blank" rel="noopener noreferrer" aria-label="GitHub 原始碼（另開視窗）">GitHub ${externalIcon}</a></nav></div></header>
<main class="shell"><section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><div class="eyebrow">LITTLE STEPS, BIG DISCOVERIES</div><h1 id="hero-title">小學六年，<br><span>從這一頁開始。</span></h1><p class="hero-description">把大大的學習世界，整理成一張張小卡片。<br>小一到小六，十二個學期，看見每一步的學習方向。</p><div class="hero-meta"><a class="primary-link" href="#courses">探索課程主題 ${svg('<path d="M5 16h22m-8-8 8 8-8 8"/>',17)}</a><span class="catalog-status">${openLessons.size} 個主題 · 詳細教材已開放</span></div><p class="coverage-count">6 個年級 · 12 個學期 · ${topicCount} 個參考主題</p></div><div class="hero-art"><img src="./assets/learning-garden.svg" width="520" height="390" alt="打開的書本裡長出一株小花，身旁有字母、數字與暖暖的太陽"><span class="art-caption">讓每一份好奇，慢慢發芽。</span></div></section>
<section class="grade-panel js-only" aria-label="年級與學期"><div class="grade-select"><span class="control-label">選擇年級</span><div class="grade-options" role="group" aria-label="年級">${gradeNames.map((n,i)=>`<button class="grade-button" type="button" data-grade="${i+1}" aria-pressed="${i===0}">小${n}</button>`).join('')}</div></div><div class="semester-options" role="group" aria-label="學期"><button class="semester-button" type="button" data-semester="1" aria-pressed="true">上學期</button><button class="semester-button" type="button" data-semester="2" aria-pressed="false">下學期</button></div></section>
<section id="courses" class="catalog" aria-labelledby="catalog-title"><div class="section-top"><div><span class="section-kicker" id="selection-kicker">TWELVE SEMESTERS / CURRICULUM MAP</span><h2 id="catalog-title" tabindex="-1">小學六年・課程主題</h2><p class="section-copy">有「教材已開放」標記的主題可直接開始學習。點開卡片看清單，或<a href="#framework">先看官方課綱架構</a>。</p></div><form class="search js-only" role="search"><label class="sr-only" for="topic-search">搜尋目前學期的課程與主題</label>${searchIcon}<input id="topic-search" type="search" placeholder="搜尋本學期，例如：分數、環境" autocomplete="off" maxlength="100"><button class="search-clear" type="button" aria-label="清除搜尋" hidden>${svg('<path d="m10 10 12 12m0-12L10 22"/>',18)}</button></form></div>
<p class="reading-guide">這裡是依官方課綱整理的主題總覽。<strong>各學期的主題分配是參考編排</strong>，不是全國統一的課本目錄；不逐字收錄所有課綱指標。</p>
<noscript><div class="no-script"><p>未啟用 JavaScript 時，以下完整顯示十二學期。可用目錄跳轉並展開卡片；搜尋與篩選需啟用 JavaScript。</p><nav aria-label="十二學期目錄">${semesters.map(s=>`<a href="#g${s.grade}s${s.semester}">${semesterTitle(s)}</a>`).join('')}</nav></div></noscript>
<div class="toolbar js-only"><div class="filters" role="group" aria-label="篩選課程類型"><button type="button" class="filter" data-filter="all" aria-pressed="true">全部課程</button><button type="button" class="filter" data-filter="national" aria-pressed="false">部定課程</button><button type="button" class="filter" data-filter="school" aria-pressed="false">校訂彈性</button></div><div class="results"><span id="result-count" role="status" aria-live="polite" aria-atomic="true"></span><button class="expand-all" type="button">展開全部</button></div></div><div class="subject-toolbar js-only"><label for="subject-filter">科目</label><select id="subject-filter"><option value="all">全部科目</option></select><span id="filter-hint">搜尋範圍：目前學期</span><button class="print-button" type="button">列印目前結果</button></div>
<div id="semester-panels">${semesters.map(s=>`<section class="semester-panel" id="g${s.grade}s${s.semester}" data-grade="${s.grade}" data-semester="${s.semester}" data-label="${semesterTitle(s)}" data-stage="${Math.ceil(s.grade/2)}" aria-labelledby="g${s.grade}s${s.semester}-heading"><h2 class="semester-heading" id="g${s.grade}s${s.semester}-heading">${semesterTitle(s)}・課程主題</h2><p class="semester-summary">${esc(s.summary)}</p>${s.grade===6&&s.semester===2?'<p class="graduation-note">六下常配合畢業及校曆縮短或調整進度；專題、複習與成果活動的週次以學校計畫為準。</p>':''}<div class="course-grid">${s.courses.map(c=>renderCard(c,s)).join('')}</div></section>`).join('')}</div>
<div class="empty-state" hidden>${searchIcon}<h3>這個學期還沒找到相符主題</h3><p id="empty-message"></p><button class="reset-button" type="button">重設搜尋與篩選</button></div>
<aside class="scope-note" aria-label="課綱與收錄範圍">${svg('<circle cx="16" cy="16" r="12"/><path d="M16 14v8m0-12h.01"/>',20)}<div><h3>課綱決定學習方向，學校安排學期進度。</h3><p>低年級以生活課程統整探索；三年級起增加部定英語文，社會、自然科學、藝術及綜合活動分列。語文選習依意願擇一，校訂彈性另列示例。</p><details><summary>查看完整範圍說明 ${chevron}</summary><ul>${data.meta.caveats.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details></div></aside></section>
<section id="framework" class="framework-section" aria-labelledby="framework-title"><span class="section-kicker">OFFICIAL FRAMEWORK / 三個學習階段</span><h2 id="framework-title">六年課綱，怎麼連起來？</h2><p class="section-copy">以下歸納官方學習階段與領域重點；上方卡片再將它們展開為可閱讀的學期參考主題。</p><div class="stage-grid">${stageData}</div><p class="framework-source">階段與節數依據：${sourceLinks(['general-pdf'])}。下列為摘要，完整指標請看各科官方來源。</p>
<details class="framework-details"><summary>各領域的學習表現與學習內容 ${chevron}</summary><p class="framework-help">學習表現是學生要能做到什麼；學習內容是用來培養這些能力的知識、技能與情境。兩者需一起看。</p><div class="framework-subjects">${framework.subjects.map(renderFrameworkSubject).join('')}</div></details>
<details class="framework-details"><summary>三大核心素養面向與九大項目 ${chevron}</summary><div class="competency-grid">${framework.competencies.map(c=>`<div><h3>${esc(c.title)}</h3><ul>${c.items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div></details>
<details class="framework-details"><summary>跨領域的 19 項議題 ${chevron}</summary><p>議題融入領域課程與校訂活動，並非另外增加 19 門部定必修科目；實際融入方式及法定教育事項依相關規定與學校計畫辦理。</p><ul class="issue-list">${framework.issues.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p class="card-sources">${sourceLinks(framework.issueSourceIds||['general-pdf'])}</p></details></section>
<section id="about" class="roadmap" aria-labelledby="roadmap-title"><div class="roadmap-copy"><span class="roadmap-icon">${svg(iconPaths.life,27)}</span><div><h2 id="roadmap-title">先看懂範圍，再選擇學習方向。</h2><p>已收錄小一至小六、十二學期，共 ${cardCount} 張課程卡。主題為本站歸納。${lessonCoverageText}</p></div></div><span class="roadmap-label">詳細教材：${openLessons.size}／${topicCount} 主題</span></section>
<section id="sources" class="sources-section" aria-labelledby="sources-title"><h2 id="sources-title">課綱與資料來源</h2><p>官方來源用來核對領域架構與學習範圍；學校計畫、出版社公開資料僅作學期編排實例。核對日期：${esc(data.meta.verifiedOn)}。</p><details class="source-directory"><summary>查看總覽使用的 ${sources.length} 個來源與範圍 ${chevron}</summary><ol class="source-list">${sources.map(s=>`<li><span class="source-kind">${sourceType(s)}</span>${sourceLinks([s.id])}<p>${esc(s.note)}</p></li>`).join('')}</ol></details></section></main>
<footer class="site-footer"><div class="footer-inner shell"><p><span class="footer-brand">elementary</span>小小一步，慢慢長大。</p><p>臺灣國小課綱主題總覽 · 非教育主管機關官方網站</p></div></footer></body></html>`;
await writeFile(path.join(root,'index.html'),html);
console.log(`Built: ${semesters.length} semesters, ${cardCount} cards, ${topicCount} topics, ${sources.length} sources.`);

await import('./build-lessons.mjs');

// Independent assessment manifest; preserves the complete lesson library.
await import('./build-exams.mjs');
