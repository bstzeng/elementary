// Dependency-free reproducible assessment build. Student papers contain no teacher data.
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const manifest=await read('data/exams.json');
const courses=await read('data/exam-courses.json');
if(new Set(manifest.formIds).size!==manifest.formIds.length||manifest.formIds.length>624)throw Error('Invalid or duplicate form inventory');
const forms=await Promise.all(manifest.formIds.map(async id=>{
 const bytes=await readFile(path.join(root,`data/exams/${id}.json`));
 if(createHash('sha256').update(bytes).digest('hex')!==manifest.sourceHashes?.[id])throw Error(`${id}: source differs from explicit reviewed/draft manifest`);
 const form=JSON.parse(bytes.toString('utf8'));
 if(form.id!==id)throw Error(`${id}: file ID mismatch`);
 return form;
}));
const qaAccepted=new Set(manifest.qaAcceptedFormIds||[]);
if([...qaAccepted].some(id=>!manifest.formIds.includes(id)))throw Error('QA acceptance outside published forms');
// Verification dimensions remain separate; legacy combined acceptance is never
// inferred from content, HTML or independently typeset PDF checks.
const verification=manifest.verification;
if(manifest.schemaVersion===2&&!verification)throw Error('Missing separate verification record');
const htmlVerified=new Set(Object.keys(verification?.htmlVerified||{}));
const pdfVerified=new Set(Object.keys(verification?.pdfVerified||{}));
const browserPrintVerified=new Set(Object.keys(verification?.browserPrintVerified||{}));
for(const id of [...htmlVerified,...pdfVerified,...browserPrintVerified])if(!manifest.formIds.includes(id))throw Error('Verification outside published forms');
if(verification){
 if(new Set(verification.contentReviewedFormIds).size!==verification.contentReviewedFormIds.length||verification.contentReviewedFormIds.some(id=>!manifest.formIds.includes(id))||(!manifest.draft&&verification.contentReviewedFormIds.length!==manifest.formIds.length))throw Error('Content verification coverage mismatch');
 for(const kind of ['htmlVerified','browserPrintVerified'])for(const [id,row] of Object.entries(verification[kind]||{}))if(row.sourceSha256!==manifest.sourceHashes[id]||!/^[a-f0-9]{40}$/.test(row.observedCommit)||!/^[a-f0-9]{64}$/.test(row.receiptSha256))throw Error(`${id}: invalid ${kind} verification binding`);
 for(const [id,row] of Object.entries(verification.pdfVerified||{})){
  if(row.sourceSha256!==manifest.sourceHashes[id]||row.pageReview!=='passed'||!/^[a-f0-9]{64}$/.test(row.receiptSha256))throw Error(`${id}: invalid PDF source/page verification`);
  for(const role of ['student','teacher']){
   const f=row[role];
   if(!f||f.path!==`pdf/${id}-${role}.pdf`||!Number.isInteger(f.pages)||f.pages<1)throw Error(`${id}: invalid PDF role/path/pages`);
   const bytes=await readFile(path.join(root,'exams',f.path));
   if(bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error(`${id}: PDF bytes differ from verified manifest`);
  }
 }
 if([...qaAccepted].some(id=>!htmlVerified.has(id)||!browserPrintVerified.has(id)))throw Error('Legacy combined acceptance requires original HTML and browser-print gates');
}
const out=path.join(root,'exams');await mkdir(out,{recursive:true});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paras=x=>`<p>${esc(x).replaceAll('\n','<br>')}</p>`;
const list=xs=>`<ul>${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const gradeNames=['','一','二','三','四','五','六'];
const names=new Map(courses.flatMap(c=>c.topics.map(t=>[t.id,t.title])));
const topicLinks=ids=>ids.map(id=>`<a href="../lessons/${esc(id)}.html">${esc(names.get(id))}</a>`).join('、');
const scopeLinks=q=>q.routeTopicIds?`兩條路徑擇一；只評已選語別。<br><span class="route-coverage">口語語別：${topicLinks(q.routeTopicIds.spoken)}</span><br><span class="route-coverage">臺灣手語：${topicLinks(q.routeTopicIds.sign)}</span>`:topicLinks(q.topicIds);
const shell=(title,body,kind='index')=>`<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="#215b46"><title>${esc(title)}｜Elementary</title><link rel="stylesheet" href="./exam.css"><script src="./exam.js" defer></script></head><body class="${kind}"><a class="skip-link" href="#main">跳到主要內容</a>${body}</body></html>\n`;
function validate(d){
 if(!manifest.formIds.includes(d.id)||!Array.isArray(d.sections))throw Error(`Unknown assessment ${d.id}`);
 const course=courses.find(c=>c.id===`g${d.grade}s${d.semester}-${d.course}`);
 if(!course||!['midterm','final'].includes(d.phase)||!['A','B','C'].includes(d.variant))throw Error(`${d.id}: invalid catalogue metadata`);
 if(d.id!==`${course.id}-${d.phase}-${d.variant.toLowerCase()}`)throw Error(`${d.id}: ID metadata mismatch`);
 const main=new Set(d.phase==='midterm'?course.midtermTopics:course.finalMainTopics),review=new Set(d.phase==='final'?course.finalReviewPool:[]);
 const qs=d.sections.flatMap(s=>s.items);
 if(new Set(qs.map(q=>q.id)).size!==qs.length)throw Error(`${d.id}: duplicate question IDs`);
 if(d.phase==='final'&&qs.filter(q=>q.scope==='review').reduce((n,q)=>n+q.points,0)!==20)throw Error(`${d.id}: final review scope mismatch`);
 for(const s of d.sections)if(d.blueprint.find(b=>b.id===s.id)?.points!==s.items.reduce((n,q)=>n+q.points,0))throw Error(`${d.id}: section blueprint mismatch`);
 if(qs.reduce((n,q)=>n+q.points,0)!==100)throw Error(`${d.id}: score not100`);
 for(const q of qs){
  if(!q.answer?.value||!q.answer?.explanation||q.answer.scoring.reduce((n,s)=>n+s.points,0)!==q.points)throw Error(`${q.id}: incomplete key/rubric`);
  if(q.kind==='choice'&&q.options[q.answer.correctIndex]!==q.answer.value)throw Error(`${q.id}: choice answer mismatch`);
  if(!q.topicIds.length||q.topicIds.some(id=>!names.has(id)||!(q.scope==='main'?main:review).has(id)))throw Error(`${q.id}: topic outside assessment scope`);
  if(q.routeTopicIds){
   const r=q.routeTopicIds;
   if(d.course!=='language-choice'||Object.keys(r).sort().join(',')!=='sign,spoken'||Object.values(r).some(ids=>!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!q.topicIds.includes(id)))||new Set(Object.values(r).flat()).size!==new Set(q.topicIds).size)throw Error(`${q.id}: invalid alternative route topic mapping`);
  }
  if(['oral','listening','performance'].includes(q.kind)&&!q.teacher)throw Error(`${q.id}: missing observed-task protocol`);
  if(q.observationParts&&q.observationParts.reduce((n,s)=>n+s.points,0)!==q.points)throw Error(`${q.id}: partial observation score mismatch`);
  if(q.diagram&&/<script|\bon\w+\s*=|javascript:|<foreignObject/i.test(q.diagram))throw Error(`${q.id}: unsafe SVG`);
 }
}
function paperStatus(id){
 if(!verification)return qaAccepted.has(id)?'本卷已完成畫面與A4列印驗收。':'試行開放：本卷內容已審查，實際畫面與A4列印驗收中。';
 return '內容已獨立審查。'+(htmlVerified.has(id)?'網頁題目與答案已檢查。':'網頁呈現待實測。')+(pdfVerified.has(id)?'獨立排版PDF已逐頁檢查。':'PDF尚未開放。')+(browserPrintVerified.has(id)?'瀏覽器網頁列印已檢查。':'瀏覽器網頁列印尚未驗證。');
}
function paper(d,key){
 const title=`${d.title}・${key?'教師答案與施測說明':'學生題目卷'}`;
 const pdf=verification?.pdfVerified?.[d.id]?.[key?'teacher':'student'];
 const pdfLink=pdf?`<a class="pdf-download" href="./${pdf.path}" download>下載${key?'教師PDF（含答案）':'學生PDF'}（${pdf.pages}頁）</a>`:'';
 const nav=`<header class="sitebar no-print"><a class="brand" href="../">elementary</a><nav aria-label="考卷導覽"><a href="./">返回考卷區</a><a href="${d.id}${key?'':'-key'}.html">${key?'學生題目卷':'教師答案卷（含答案）'}</a>${pdfLink}<button type="button" data-print>列印${key?'答案卷':'題目卷'}</button></nav></header>`;
 const draft=manifest.draft?'<div class="draft-banner">內部編寫預覽・尚未通過獨立審查</div>':`<div class="qa-status no-print">${paperStatus(d.id)}</div>`;
 let body=`<main id="main" class="paper"><div class="paper-heading">${draft}<p class="eyebrow">${key?'TEACHER KEY · 教師用':'STUDENT PAPER · 學生用'}</p><h1>${esc(d.title)}</h1><p class="paper-type">${key?'教師答案與施測說明':'學生題目卷'}</p><p>${esc(d.duration)}</p><p class="score-meta">滿分 100 分 · ${key?'未觀察的口語／實作項目請分開記錄。':'匿名代號（可留空）：＿＿＿＿　日期：＿＿＿＿'}</p></div>`;
 body+=key?`<section class="teacher-intro"><h2>施測前請先讀</h2>${list(d.teacherNotes)}<h3>準備材料</h3>${list(d.materials)}<h3>三份卷的設計</h3>${paras(d.parallelDesign)}</section>`:`<section class="student-intro"><h2>作答提醒</h2>${list(d.instructions)}<p class="scope-notice">本卷依本館跨版本主題編排，教師須依已教內容與學習需要調整。</p></section>`;
 body+=`<div class="blueprint">${d.blueprint.map(b=>`<span>${esc(b.title)} <strong>${b.points}分</strong></span>`).join('')}</div>`;
 let n=0;
 for(const section of d.sections){
  body+=`<section class="exam-section"><h2>${esc(section.title)} <span>（${section.items.reduce((a,q)=>a+q.points,0)}分）</span></h2>${paras(section.instructions)}`;
  for(const q of section.items){
   n++;
   body+=`<article class="question" id="${esc(q.id)}"><h3><span class="number">${String(n).padStart(2,'0')}</span> ${esc(q.prompt)} <span class="points">（${q.points}分）</span></h3>`;
   if(q.stimulus)body+=`<div class="stimulus">${paras(q.stimulus)}</div>`;
   if(q.diagram)body+=`<figure class="exam-figure">${q.diagram}</figure>`;
   if(q.writingBoxes&&!key)body+=`<div class="writing-boxes" aria-label="大方格作答區">${q.writingBoxes.map(label=>`<div class="writing-field"><span>${esc(label)}</span><div class="writing-square" aria-label="${esc(label)}的書寫空格"></div></div>`).join('')}</div>`;
   if(q.options)body+=`<ol class="options" type="A">${q.options.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`;
   if(key){
    if(q.teacher)body+=`<div class="teacher-protocol"><h4>教師施測</h4>${paras(q.teacher)}</div>`;
    body+=`<div class="answer-key"><h4>參考答案</h4>${paras(q.answer.value)}<h4>解答理由</h4>${paras(q.answer.explanation)}<h4>給分方式</h4><ul>${q.answer.scoring.map(s=>`<li><strong>${s.points}分：</strong>${esc(s.criterion)}</li>`).join('')}</ul></div><p class="coverage">${q.scope==='review'?'前半核心回顧':'本階段主題'}：${scopeLinks(q)}</p>`;
   if(q.observationParts)body+=`<div class="observation-parts"><h4>分項施測紀錄</h4>${q.observationParts.map(part=>`<p>${esc(part.label)}：□ 已施測 □ 未觀察　得分＿＿／${part.points}　支持方式＿＿＿＿</p>`).join('')}</div>`;
    if(['oral','listening','performance'].includes(q.kind))body+='<p class="teacher-record">施測紀錄：□ 已施測　□ 未觀察　得分：＿＿／'+q.points+'　支持方式：＿＿＿＿＿＿</p>';
   } else {
    if(['oral','listening','performance'].includes(q.kind)) {
     body+='<p class="observation-note">與教師一起完成；本題依實際表現觀察記錄。</p>';
    } else if(q.kind!=='choice') {
     body+=`<div class="response-space" aria-label="作答空間">${'<div class="response-line"></div>'.repeat(q.responseLines??2)}</div>`;
    }
   }
   body+='</article>';
  }
  body+='</section>';
 }
 if(key)body+=`<section class="key-sources"><h2>範圍與參考來源</h2><p>題目、短文與插圖為本館原創。官方課綱不規定本卷的學期或段考次序。本卷未經常模或統計等值檢驗，不能單靠紙筆答案判定聆聽、發音、手語或動作技能。</p><ul>${d.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>：${esc(s.note)}</li>`).join('')}</ul></section>`;
 body+=`<footer class="paper-footer">Elementary 原創評量 · ${esc(d.id)} · ${key?'教師答案卷':'學生題目卷（不含答案）'}</footer></main>`;
 return shell(title,nav+body,key?'key':'student');
}
function catalogue(){
 const ids=new Set(forms.map(f=>f.id)),subjects=[...new Map(courses.map(c=>[c.course,c.title]))];
 const modes={'written':'紙筆為主','mixed-language':'讀寫＋聽說','performance':'情境與實作','language-packet':'選習語言評量包','school-packet':'校訂評量包'};
 const cards=courses.map(c=>{
  const open=forms.filter(f=>f.id.startsWith(c.id+'-')).length;
  const groups=[['midterm','期中'],['final','期末']].map(([phase,label])=>`<div class="phase-group" data-phase="${phase}"><h4>${label}</h4><ul class="variant-list">${['A','B','C'].map(v=>{
   const id=`${c.id}-${phase}-${v.toLowerCase()}`;
   const title=`小${gradeNames[c.grade]}${c.semester===1?'上':'下'}學期${c.title}${label}${v}`;
   return ids.has(id)?`<li data-variant="${v.toLowerCase()}" class="available"><span class="variant-tag">${v}卷</span><a href="./${id}.html" aria-label="${esc(title)}學生題目卷">題目卷</a><a href="./${id}-key.html" aria-label="${esc(title)}教師答案卷">答案與解析</a></li>`:`<li data-variant="${v.toLowerCase()}" class="planned"><span class="variant-tag">${v}卷</span><span>編寫與審查中</span></li>`;
  }).join('')}</ul></div>`).join('');
  return `<article class="exam-card" data-grade="${c.grade}" data-semester="${c.semester}" data-course="${c.course}" data-open="${open}"><p class="card-kicker">小${gradeNames[c.grade]}・${c.semester===1?'上':'下'}學期</p><h3>${esc(c.title)}</h3><p class="mode-label">${modes[c.mode]}</p><p class="card-count">${open?`${open} / 6 份${manifest.draft?'內部預覽':'可開啟'}${manifest.draft?'':` · ${verification?`${forms.filter(f=>f.id.startsWith(c.id+'-')&&htmlVerified.has(f.id)).length}份網頁已檢查 · ${forms.filter(f=>f.id.startsWith(c.id+'-')&&pdfVerified.has(f.id)).length}份PDF已檢查`:`${forms.filter(f=>f.id.startsWith(c.id+'-')&&qaAccepted.has(f.id)).length}份完成畫面／列印驗收` }`}`:'共6份，尚未開放'}</p>${groups}<details><summary>看參考範圍與使用條件</summary><p>${esc(c.scopePolicy)}</p><p>${esc(c.timePolicy)}</p>${list(c.caveats)}<a href="../#g${c.grade}s${c.semester}">返回本學期教材</a></details></article>`;
 }).join('');
 const select=(label,name,opts)=>`<label>${label}<select name="${name}">${opts.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label>`;
 const controls=`<form class="filters no-print" id="exam-filters" aria-label="篩選考卷">${select('年級','grade',[['all','全部年級'],...[1,2,3,4,5,6].map(g=>[g,'小'+gradeNames[g]])])}${select('學期','semester',[['all','全部學期'],['1','上學期'],['2','下學期']])}${select('課程','course',[['all','全部課程'],...subjects])}${select('評量','phase',[['all','期中＋期末'],['midterm','期中'],['final','期末']])}${select('卷別','variant',[['all','A＋B＋C'],['a','A卷'],['b','B卷'],['c','C卷']])}<label class="check-label"><input type="checkbox" name="openOnly">只看已開放</label><button type="reset">清除篩選</button></form>`;
 let body=`<header class="sitebar"><a class="brand" href="../">elementary</a><nav aria-label="主要導覽"><a href="../">課程教材</a><a href="#use">使用說明</a></nav></header><main id="main" class="exam-shell"><section class="exam-hero"><div><p class="eyebrow">LEARNING CHECKPOINTS</p><h1>每一步學習，<br>都有練習的方向。</h1><p class="hero-copy">從小一到小六，按學期與課程挑一份評量。<br>題目卷、答案與解析分開，方便陪孩子練習。</p></div><div class="hero-tally"><strong>${forms.length}</strong><span>${manifest.draft?'份已編寫・尚未審查的內部預覽':'份內容已審查・可開啟'}</span><small>目標 624 份 · 104 個學期課程</small>${manifest.draft?'':`${verification?`<small>網頁檢查：${htmlVerified.size}／${forms.length}份</small><small>PDF逐頁檢查：${pdfVerified.size}／${forms.length}份</small><small>瀏覽器列印：${browserPrintVerified.size}／${forms.length}份已驗證</small>`:`<small>畫面／列印驗收：${qaAccepted.size}／${forms.length}份</small>`}`}</div></section>`;
 if(manifest.draft)body+='<p class="draft-banner">本頁是內部預覽，尚未發布；目前不得稱為已完成或已開放624份。</p>';
 else if(verification)body+=`<p class="qa-status">已開放${forms.length}份內容審查通過的原創評量；其中${htmlVerified.size}份網頁、${pdfVerified.size}份獨立排版PDF已檢查。PDF逐頁檢查和瀏覽器網頁列印是不同項目；本批瀏覽器網頁列印尚未驗證。其餘規劃中的卷別不計入已開放份數。</p>`;
 else if(qaAccepted.size<forms.length)body+=`<p class="qa-status">首批試行卷已可開啟，內容已經獨立審查；其中${forms.length-qaAccepted.size}份仍在進行實際畫面與A4列印驗收。其餘規劃中的卷別沒有空白連結，也不算已完成。</p>`;
 body+=`<section class="use-notice" id="use"><h2>先依學校進度選，再開始作答。</h2><p>這些是依本館跨版本主題編排的原創評量建議。課綱沒有全國一致的期中、期末範圍，教師須確認已教內容、語別和支持需求。本卷未經常模化或統計等值檢驗。</p><ul><li>每課程每學期規劃期中、期末各 A／B／C 三卷。期中以前半主題為參考；期末主要是後半，含前半核心回顧。</li><li>學生卷不含答案；教師卷有逐題答案、理由、配分、範圍連結及必要施測腳本。已提供PDF的卷別可從題目／答案頁分開下載，以A4、實際大小列印；PDF頁面已檢查，實體印表機輸出未測試。網頁列印功能依瀏覽器支援，本館尚未驗證網頁A4分頁。本站是公開練習資源，線上可開啟答案；正式施測請只發學生題目卷。</li><li>語文聽說、生活、藝術、健體等含真人觀察或實作，不以紙筆代替完整能力。選習語言一次只選一種語別；需指定模型的項目由合格教師備妥後才施測。</li><li>未觀察的項目分開記錄，不當作答錯。本網站不需要兒童帳號，不蒐集姓名、錄音、照片或分數。</li></ul></section><section aria-labelledby="library-title"><div class="list-heading"><div><p class="eyebrow">CHOOSE YOUR PAPER</p><h2 id="library-title">考卷與評量包</h2></div><p id="filter-result" role="status" aria-live="polite">共104個學期課程，${forms.length}份${manifest.draft?'內部預覽':'可開啟'}</p></div>${controls}<noscript><p>JavaScript 未啟用，以下顯示全部課程；仍可開啟題目、答案與列印。</p></noscript><p id="empty-state" hidden>這個篩選目前沒有已開放的評量，請放寬條件或查看編寫中的課程。</p><div class="exam-grid">${cards}</div></section><footer class="index-footer"><a href="../">返回六年教材總覽</a><p>Elementary · 讓理解被看見，也為不同學習方式留空間。</p></footer></main>`;
 return shell('六年考卷與評量包',body);
}
forms.forEach(validate);
for(const f of await readdir(out))if(/^g\d+s\d+-.+\.html$/.test(f))await unlink(path.join(out,f));
for(const form of forms){await writeFile(path.join(out,form.id+'.html'),paper(form,false));await writeFile(path.join(out,form.id+'-key.html'),paper(form,true));}
await writeFile(path.join(out,'index.html'),catalogue());
const output={draft:manifest.draft,qaAccepted:qaAccepted.size,htmlVerified:htmlVerified.size,pdfVerified:pdfVerified.size,browserPrintVerified:browserPrintVerified.size,forms:forms.length,questions:forms.reduce((n,f)=>n+f.sections.reduce((m,s)=>m+s.items.length,0),0),inventory:624,documents:forms.length*2,ids:forms.map(f=>f.id)};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Built exams: ${output.forms} forms, ${output.questions} questions, ${output.documents} student/key documents; ${manifest.draft?'INTERNAL DRAFT':'reviewed manifest'}.`);
