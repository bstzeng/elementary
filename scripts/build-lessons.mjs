import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const json=async name=>JSON.parse(await readFile(path.join(root,name),'utf8'));
const manifest=await json('data/lessons.json');
const catalog=await json('curriculum.json');
const semesters=(await Promise.all(catalog.gradeFiles.map(json))).flatMap(g=>g.semesters);
const topicMap=new Map();
for(const semester of semesters)for(const course of semester.courses)for(const topic of course.topics)topicMap.set(topic.id,{semester,course,topic});
const approved=new Set((await json('data/approved-first-lessons.json')).lessonIds);
const gradeNames=['一','二','三','四','五','六'];
await import('./build-approved-lessons.mjs');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=items=>`<ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
const lessons=await Promise.all(manifest.lessonIds.map(id=>json(`data/lessons/${id}.json`)));
await mkdir(path.join(root,'lessons'),{recursive:true});
for(const lesson of lessons){
 if(approved.has(lesson.id))continue;
 const context=topicMap.get(lesson.id);
 if(!context)throw Error(`Unknown curriculum topic: ${lesson.id}`);
 const {course,semester,topic}=context;
 const semesterId=`g${semester.grade}s${semester.semester}`;
 const semesterName=`小${gradeNames[semester.grade-1]}${semester.semester===1?'上':'下'}`;
 const topicNumber=course.topics.findIndex(t=>t.id===lesson.id)+1;
 const nearby=lessons.filter(l=>l.id!==lesson.id&&topicMap.get(l.id).course.id===course.id&&topicMap.get(l.id).semester===semester);
 const currentIndex=course.topics.findIndex(t=>t.id===lesson.id);
 const previous=course.topics.slice(0,currentIndex).reverse().find(t=>manifest.lessonIds.includes(t.id));
 const next=course.topics.slice(currentIndex+1).find(t=>manifest.lessonIds.includes(t.id));
 const optionText=value=>['english','school-flexible'].includes(course.id)&&/^[A-Za-z][A-Za-z\s’'.,!?-]*$/.test(value)?`<span lang="en">${esc(value)}</span>`:esc(value);
 if(lesson.title!==topic.title)throw Error(`Lesson title must match existing topic: ${lesson.id}`);
 const sections=[{id:'ready',title:'準備好了嗎？'},...lesson.sections,{id:'practice',title:'換我試試看'},{id:'check',title:'我的小小收穫'},{id:'teaching',title:'給陪學大人的教學指南'},{id:'sources',title:'資料來源與課綱對照'}];
 const quiz=lesson.exercises.map((q,i)=>`<fieldset class="question" data-answer="${q.answer}" data-question="${esc(q.id)}"><legend><span class="question-number">${i+1}</span>${esc(q.question)}</legend><div class="answer-options">${q.options.map((option,j)=>`<label for="${esc(q.id)}-${j}"><input autocomplete="off" type="radio" id="${esc(q.id)}-${j}" name="${esc(q.id)}" value="${j}"><span>${optionText(option)}</span></label>`).join('')}</div><div class="question-actions"><button type="button" class="check-answer interactive-only">看看我的想法</button><details class="hint"><summary>給我一點提示</summary><p>${esc(q.hint)}</p></details></div><p class="answer-feedback" role="status" aria-live="polite" aria-atomic="true"></p><details class="answer-key"><summary>看答案與原因</summary><p><strong>參考答案：${optionText(q.options[q.answer])}</strong></p><p class="explanation">${esc(q.explanation)}</p></details></fieldset>`).join('');
 const html=`<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${semesterName}原創教材：${esc(lesson.title)}。兒童學習步驟、生活例子、練習解析與陪學教案。"><meta name="theme-color" content="#215b46"><title>${esc(lesson.title)}｜${semesterName}・elementary</title><link rel="icon" type="image/svg+xml" href="../assets/favicon.svg"><link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../lesson.css"><script src="../lesson.js" defer></script></head>
<body class="lesson-page" data-lesson="${esc(lesson.id)}"><a class="skip-link" href="#lesson-content">跳到學習內容</a><header class="site-header"><div class="header-inner lesson-shell"><a class="brand" href="../index.html#${semesterId}" aria-label="回到${semesterName}課程"><img src="../assets/favicon.svg" width="37" height="37" alt=""><span><span class="brand-name">elementary</span><span class="brand-caption">小學課程主題地圖</span></span></a><a class="back-link" href="../index.html#${semesterId}?subject=${esc(course.id)}">回到${esc(course.shortTitle||course.title)}</a></div></header>
<main class="lesson-shell"><nav class="breadcrumb" aria-label="所在位置"><a href="../index.html#${semesterId}">${semesterName}學期</a><span aria-hidden="true">／</span><span>${esc(course.shortTitle||course.title)}</span></nav>
<section class="lesson-hero" aria-labelledby="lesson-title"><div class="lesson-kicker">第${topicNumber}主題 · 原創教材已開放</div><h1 id="lesson-title">${esc(lesson.title)}</h1><p class="lesson-subtitle">${esc(lesson.subtitle)}</p><p class="lesson-intro">${esc(lesson.intro)}</p><div class="lesson-meta"><span>建議：${esc(lesson.duration)}</span><span>孩子可由大人陪讀</span><button type="button" class="lesson-print interactive-only">列印本課（含解析）</button></div><p class="lesson-scope">${esc(manifest.scope)}</p></section>
<div class="lesson-layout"><aside class="lesson-sidebar"><nav class="lesson-toc" aria-label="本課目錄"><h2>這一課怎麼走</h2><ol>${sections.map((s,i)=>`<li><a href="#${esc(s.id)}"><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</a></li>`).join('')}</ol><a class="teacher-jump" href="#teaching">大人先看教學指南 →</a></nav></aside>
<div id="lesson-content" class="lesson-content"><noscript><p class="no-script">這一課不開啟 JavaScript 也能閱讀。練習可口頭回答，再展開答案；互動數量板與即時檢查需開啟 JavaScript。</p></noscript>
<section class="lesson-section" id="ready"><span class="step-label">出發前</span><h2>準備好了嗎？</h2><h3>這一課，我會練習</h3>${list(lesson.goals)}<details class="materials"><summary>陪學大人：準備材料</summary>${list(lesson.materials)}<p>用手邊安全的材料就好。孩子可以用說、指、畫或操作表示理解，不必先會讀完所有文字。</p></details></section>
${lesson.sections.map((s,i)=>`<section class="lesson-section" id="${esc(s.id)}"><span class="step-label">一起學 ${String(i+1).padStart(2,'0')}</span><h2>${esc(s.title)}</h2><p class="child-prompt">${esc(s.childText)}</p><div class="lesson-prose">${s.html}</div><a class="section-back" href="#lesson-title">回到本課開頭 ↑</a></section>`).join('')}
<section class="lesson-section practice" id="practice"><span class="step-label">想一想，再試試</span><h2>換我試試看</h2><p>不急著猜答案。可以請大人念題目，先說出你的想法，再選一個最合適的答案。</p><p class="quiz-progress interactive-only" role="status" aria-live="polite" aria-atomic="true">已嘗試 0／${lesson.exercises.length} 題。做錯也能再試。</p>${quiz}<button type="button" class="reset-quiz interactive-only">把練習清空，再試一次</button></section>
<section class="lesson-section" id="check"><span class="step-label">看見我的進步</span><h2>我的小小收穫</h2><p>做到一項，就勾一項。還沒做到也沒關係，選一項下次再練。</p><div class="self-checks">${lesson.selfCheck.map((s,i)=>`<label><input autocomplete="off" type="checkbox" name="self-check-${i}"><span>${esc(s)}</span></label>`).join('')}</div><p class="self-progress interactive-only" role="status" aria-live="polite">目前勾選 0 項。</p><p class="privacy-note">勾選和作答只留在這次開啟的頁面，不會傳送、儲存姓名或學習紀錄；重新整理就會清空。</p></section>
<section class="lesson-section teaching-section" id="teaching"><span class="step-label">陪學大人專區</span><h2>給陪學大人的教學指南</h2><p>先看孩子的起點，再決定今天走到哪裡。以下是可調整的原創教學示例。</p><details class="teaching-guide"><summary>展開完整教案、引導語與觀察重點</summary><div class="lesson-prose">${lesson.teachingHtml}</div></details></section>
<section class="lesson-section lesson-sources" id="sources"><h2>資料來源與課綱對照</h2><p>以下官方資料用於確認課綱方向或示範用語；本站的故事、活動與題目為原創。來源不代表核定本課的學期順序。</p><ol>${lesson.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}<span class="sr-only">（另開視窗）</span></a><p>${esc(s.note)}</p></li>`).join('')}</ol><p>來源核對範圍請見各項說明。外部影音請由大人協助開啟，不會自動播放。</p></section>
<nav class="other-lessons" aria-label="${semesterName}${esc(course.shortTitle||course.title)}其他已開放教材"><h2>接著學，或回頭複習</h2>${previous?`<a href="./${esc(previous.id)}.html">上一個已開放主題：${esc(previous.title)}</a>`:''}${next?`<a href="./${esc(next.id)}.html">下一個已開放主題：${esc(next.title)}</a>`:''}${nearby.filter(l=>l.id!==previous?.id&&l.id!==next?.id).slice(0,4).map(l=>`<a href="./${esc(l.id)}.html">${esc(l.title)} <span aria-hidden="true">→</span></a>`).join('')}<a class="return-catalog" href="../index.html#${semesterId}">回到${semesterName}全部課程 →</a></nav></div></div></main>
<footer class="site-footer"><div class="footer-inner lesson-shell"><p><span class="footer-brand">elementary</span>小小一步，慢慢長大。</p><p>原創學習示例 · 非教育主管機關官方教材</p></div></footer></body></html>`;
 await writeFile(path.join(root,'lessons',`${lesson.id}.html`),html);
}
console.log(`Built ${lessons.length} registered detailed lessons across the library; six approved originals preserved.`);
