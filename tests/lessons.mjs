import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const json=async file=>JSON.parse(await read(file));
const manifest=await json('data/lessons.json');
const catalog=await json('curriculum.json');
const semesters=(await Promise.all(catalog.gradeFiles.map(json))).flatMap(g=>g.semesters);
const contexts=new Map();
for(const semester of semesters)for(const course of semester.courses)for(const topic of course.topics)contexts.set(topic.id,{semester,course,topic});
const approved=await json('data/approved-first-lessons.json');
assert.equal(new Set(manifest.lessonIds).size,manifest.lessonIds.length,'No duplicate open lesson IDs');
for(const id of approved.lessonIds)assert.ok(manifest.lessonIds.includes(id),'Original approved lessons remain open');
for(const id of manifest.lessonIds)assert.ok(contexts.has(id),`Open lesson must match catalog topic: ${id}`);
const frozen=await json('tests/fixtures/approved-lessons-sha256.json');
for(const [file,sha] of Object.entries(frozen))assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),sha,`Preserve approved lesson bytes: ${file}`);
const baseline=await json('tests/fixtures/catalog-sha256.json');
for(const [file,sha] of Object.entries(baseline))assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),sha,`Preserve existing catalog bytes: ${file}`);
const index=await read('index.html');
const homepageLessons=[...index.matchAll(/href="\.\/lessons\/([^"]+)\.html"/g)].map(m=>m[1]);
assert.deepEqual([...new Set(homepageLessons)].sort(),[...manifest.lessonIds].sort(),'Only registered authored lessons linked on homepage');
assert.equal((index.match(/class="lesson-open-label"/g)||[]).length,manifest.lessonIds.length,'One opened marker per registered topic');
const openedFirst=semesters.flatMap(s=>s.courses).filter(c=>manifest.lessonIds.includes(c.topics[0].id)).length;
assert.equal((index.match(/class="start-lesson"/g)||[]).length,openedFirst,'Every opened first lesson has a visible course entry');
assert.ok(index.includes(`詳細教材：${manifest.lessonIds.length}／${contexts.size} 主題`),'Honest public coverage counter');
assert.ok(!index.includes('尚未提供教學內容'));
let questions=0;
for(const id of manifest.lessonIds){
 const data=await json(`data/lessons/${id}.json`),{course,topic,semester}=contexts.get(id);
 assert.equal(data.id,id);assert.equal(data.title,topic.title);
 for(const key of ['course','title','subtitle','duration','intro','teachingHtml'])assert.ok(typeof data[key]==='string'&&data[key].length>0,`${id} ${key}`);
 assert.ok(data.goals.length>=3);assert.ok(data.materials.length>=2);assert.ok(data.sections.length>=6);assert.ok(data.exercises.length>=8);assert.ok(data.selfCheck.length>=3);assert.ok(data.sources.length>=2);
 assert.ok(data.teachingHtml.length>=600,`Substantive adult plan: ${id}`);
 assert.ok(data.sections.reduce((n,s)=>n+s.html.length,0)>=2500,`Substantive teaching rather than empty stub: ${id}`);
 for(const q of data.exercises){assert.ok(q.options.length>=2&&q.options.length<=5);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.explanation.length>=15&&q.hint.length>=5);assert.ok(q.id.startsWith(id),`Globally scoped question ID: ${q.id}`);}
 assert.equal(new Set(data.exercises.map(q=>q.question)).size,data.exercises.length,`No duplicate question stems: ${id}`);
 if(!approved.lessonIds.includes(id)){
  const positions=data.exercises.map(q=>q.answer);
  for(let period=1;period<=3;period++)assert.ok(!positions.every((v,i)=>v===positions[i%period]),`Avoid predictable answer-position cycle of length ${period}: ${id}`);
 }
 questions+=data.exercises.length;
 for(const s of data.sources){assert.equal(new URL(s.url).protocol,'https:');assert.ok(s.title&&s.note);}
 const file=`lessons/${id}.html`,html=await read(file);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,`Unique HTML IDs: ${id}`);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(html.includes('<html lang="zh-Hant">'));
 assert.equal((html.match(/class="question"/g)||[]).length,data.exercises.length);
 assert.equal((html.match(/class="answer-key"/g)||[]).length,data.exercises.length,'No-JS answer key for each question');
 assert.ok(html.includes(`../index.html#g${semester.grade}s${semester.semester}?subject=${course.id}`),'Exact semester/subject return link');
 if(id==='g1s2-mathematics-03'){
  const chart=html.match(/<table class="hundred-chart">([\s\S]*?)<\/table>/)?.[1];
  assert.ok(chart,'Complete native hundred-chart present');
  assert.deepEqual([...chart.matchAll(/<td>(\d+)<\/td>/g)].map(m=>Number(m[1])),Array.from({length:100},(_,i)=>i+1),'Hundred-chart numbers exactly1–100 in row order');
  const rows=[...chart.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,10);for(const row of rows)assert.equal((row[1].match(/<td>/g)||[]).length,10);
  assert.ok(/<caption>[^<]+<\/caption>/.test(chart),'Readable chart caption');
  const region=html.match(/<div\b[^>]*class="lesson-table-scroll"[^>]*>/)?.[0]||'';
  assert.ok(/tabindex="0"/.test(region)&&/role="region"/.test(region)&&/aria-label="[^"]+"/.test(region),'Chart has a labelled keyboard-scroll region');
 }


 if(id==='g3s1-english-01'){
  const chart=html.match(/<svg\b[^>]*aria-labelledby="g3s1-english-01-fig"[^>]*>[\s\S]*?<\/svg>/)?.[0];
  assert.ok(chart,'Complete original uppercase/lowercase chart is present');
  const pairs=Array.from({length:26},(_,i)=>`${String.fromCharCode(65+i)} ${String.fromCharCode(97+i)}`);
  const renderedPairs=[...chart.matchAll(/<text\b[^>]*lang="en"[^>]*>([A-Z])\s+([a-z])<\/text>/g)].map(m=>`${m[1]} ${m[2]}`);
  assert.deepEqual(renderedPairs,pairs,'All26 exact upper/lower pairs appear in alphabetical order with English language markup');
  const outsideSvgHtml=html.replace(/<svg\b[\s\S]*?<\/svg>/g,'');
  assert.ok(outsideSvgHtml.includes(`<span lang="en">${pairs.join(' ')}</span>`),'Full plain-text alphabet fallback remains available outside the image');
 }

 if(id==='g4s1-mathematics-08'){
  const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]+)"'))?.[1]||'';
  const regions=[...html.matchAll(/<div\b[^>]*class="lesson-table-scroll"[^>]*>[\s\S]*?<\/div>/g)].map(m=>m[0]).filter(r=>r.includes('g4s1-mathematics-08-'));
  assert.equal(regions.length,2,'Both protractor models have their own scroll region');
  const names=regions.map(r=>attr(r.slice(0,r.indexOf('>')+1),'aria-label'));
  assert.equal(new Set(names).size,2,'Right-start and left-start regions have distinct accessible names');
  const examples=[{side:'right',start:0,end:40,label:'從右側0讀外圈'},{side:'left',start:180,end:60,label:'從左側0讀內圈'}];
  for(const ex of examples){
   const region=regions.find(r=>r.includes(`aria-labelledby="g4s1-mathematics-08-${ex.side}"`));assert.ok(region,'Exact protractor model is present');
   const open=region.slice(0,region.indexOf('>')+1);
   assert.equal(attr(open,'role'),'region','Protractor scroll wrapper has its semantic region role');assert.equal(attr(open,'tabindex'),'0','Protractor region remains keyboard focusable');assert.ok(attr(open,'aria-label').includes(ex.label),'Accessible region name identifies the correct starting side and scale');
   const svg=region.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]||'';const svgOpen=svg.slice(0,svg.indexOf('>')+1);const style=attr(svgOpen,'style');
   assert.equal(attr(svgOpen,'viewBox'),'0 0 360 315');
   assert.ok(/min-width:\s*360px/.test(style)&&/max-width:\s*none/.test(style)&&/height:\s*auto/.test(style),'Protractor keeps readable width and undistorted geometry');
   const lines=[...svg.matchAll(/<line\b[^>]*>/g)].map(m=>m[0]);
   const angle=(x,y)=>Math.atan2(205-y,x-180)*180/Math.PI;
   const ticks=lines.filter(t=>attr(t,'stroke')==='#465e6c'&&Math.abs(Math.hypot(Number(attr(t,'x1'))-180,Number(attr(t,'y1'))-205)-145)<1e-6);
   assert.equal(ticks.length,19,'Eighteen equal ten-degree intervals have nineteen endpoints');
   ticks.forEach((t,i)=>assert.ok(Math.abs(angle(Number(attr(t,'x1')),Number(attr(t,'y1')))-i*10)<1e-6,'Every protractor tick is at its actual ten-degree position'));
   const numbered=[...svg.matchAll(/(<text\b[^>]*>)(\d+)<\/text>/g)];
   assert.deepEqual(numbered.map(m=>Number(m[2])),[0,180,30,150,60,120,90,90,120,60,150,30,180,0],'Opposite scales have correct thirty-degree labels');
   numbered.forEach(m=>assert.ok(Number(attr(m[1],'font-size'))>=16,'Scale labels are not reduced below the reviewed size'));
   const rays=lines.filter(t=>attr(t,'stroke')==='#ae3535');assert.equal(rays.length,2,'Both actual angle rays are supplied');
   rays.forEach((t,i)=>{assert.equal(Number(attr(t,'x1')),180);assert.equal(Number(attr(t,'y1')),205);assert.ok(Math.abs(angle(Number(attr(t,'x2')),Number(attr(t,'y2')))-[ex.start,ex.end][i])<1e-6,'Ray geometry matches the stated40-degree/right or120-degree/left opening');});
  }
  assert.ok(html.includes('左右方向鍵')&&html.includes('左右滑動'),'Keyboard and touch-scroll instructions are present');
 }

 if(id==='g2s1-mathematics-08'){
  const chart=html.match(/<table class="hundred-chart multiplication-chart">([\s\S]*?)<\/table>/)?.[1];
  assert.ok(chart,'Native product table uses its scoped label-width class');
  const header=chart.match(/<thead>([\s\S]*?)<\/thead>/)?.[1]||'';
  assert.deepEqual([...header.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m=>m[1]),['每組數／組數',...Array.from({length:10},(_,i)=>`${i+1}組`)],'Product table column headers identify group counts1–10');
  const body=chart.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'';
  const rows=[...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,10,'Exactly ten product rows');
  for(const [i,row] of rows.entries()){
   assert.ok(row[1].includes(`<th scope="row">每組${i+1}</th>`),'Each product row identifies its items-per-group factor');
   assert.deepEqual([...row[1].matchAll(/<td>(\d+)<\/td>/g)].map(m=>Number(m[1])),Array.from({length:10},(_,j)=>(i+1)*(j+1)),`All ten products correct in row${i+1}`);
  }
  assert.ok(/<caption id="g2s1-mathematics-08-table-caption">[^<]+<\/caption>/.test(chart),'Readable product caption');
  const region=html.match(/<div\b[^>]*class="lesson-table-scroll"[^>]*>/)?.[0]||'';
  assert.ok(/tabindex="0"/.test(region)&&/role="region"/.test(region)&&/aria-labelledby="g2s1-mathematics-08-table-caption"/.test(region)&&/aria-describedby="g2s1-mathematics-08-table-help"/.test(region),'Product table has named keyboard-scroll region and instructions');
  const css=await read('lesson.css');
  assert.ok(/\.lesson-table-scroll table\.multiplication-chart\s*\{[^}]*min-width:\s*680px/.test(css),'Product table has room for ten product columns plus labels');
  assert.ok(/\.lesson-table-scroll \.multiplication-chart th:first-child\s*\{[^}]*width:\s*110px;[^}]*white-space:\s*normal/.test(css),'Long corner and row labels have a wider wrapping column');
 }

 assert.ok(html.includes('課綱主題採跨版本參考編排'));
 assert.ok(html.includes('不會传送')||html.includes('不會傳送'));
 for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(link.startsWith('#'))assert.ok(ids.includes(link.slice(1)),`Valid lesson anchor: ${link}`);
  else if(link.startsWith('https://'))continue;
  else{assert.ok(!link.startsWith('//')&&!link.includes('javascript:'));await access(path.resolve(root,'lessons',link.split('#')[0]));}
 }
 for(const [,refs] of html.matchAll(/\baria-(?:labelledby|describedby)="([^"]+)"/g))for(const ref of refs.split(/\s+/))assert.ok(ids.includes(ref),`Valid accessible reference ${ref}`);
 for(const [,target] of html.matchAll(/\bfor="([^"]+)"/g))assert.ok(ids.includes(target),`Label target ${target}`);
 for(const tag of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.ok(tag[0].includes('rel="noopener noreferrer"'));
 for(const tag of html.matchAll(/<svg\b[^>]*>/g))assert.ok(/aria-hidden="true"|aria-label=|aria-labelledby=/.test(tag[0]),`SVG accessible name ${id}: ${tag[0]}`);
 for(const [,tag] of html.matchAll(/(<img\b[^>]*>)/g)){
  const src=tag.match(/\bsrc="([^"]+)"/)?.[1]||'';
  if(src==='../assets/favicon.svg')continue; // Existing decorative brand mark, not lesson evidence.
  assert.ok(src.startsWith('../assets/lessons/')&&!src.includes('..',3)&&!/[?#]/.test(src),`Lesson photograph is a stable local asset: ${id}`);
  assert.ok(/\balt="[^"]+"/.test(tag),`Photo has a meaningful text alternative: ${id}`);
  assert.ok(/\bwidth="[1-9]\d*"/.test(tag)&&/\bheight="[1-9]\d*"/.test(tag),`Photo reserves its intrinsic dimensions: ${id}`);
  assert.ok(/max-width:\s*100%/.test(tag)&&/height:\s*auto/.test(tag),`Photo stays responsive without JavaScript: ${id}`);
  assert.ok(!/\bsrcset=/.test(tag),'No unreviewed alternate image source');
 }
 if(id==='g3s2-social-11'){
  const src='../assets/lessons/g3s2-social-11-historic-road.jpg';
  const photo=html.match(/<img\b[^>]*src="\.\.\/assets\/lessons\/g3s2-social-11-historic-road\.jpg"[^>]*>/)?.[0]||'';
  assert.ok(photo,'The source-comparison lesson includes its authentic local archival photograph');
  assert.ok(photo.includes('width="3840"')&&photo.includes('height="3274"'),'Original archive image aspect ratio is preserved');
  assert.equal(createHash('sha256').update(await readFile(path.resolve(root,'lessons',src))).digest('hex'),'287bd8e3147da2e32880d507b0ddbf0936496c1fdf97a3b3d9deca4dd33a3d73','Authentic photo remains byte-identical to reviewed official download');
  assert.ok(html.includes('2004.020.0109.0015')&&html.includes('PDM')&&html.includes('國立臺灣歷史博物館'),'Accession, credit and item-specific public-domain mark remain visible');
 }
 assert.ok(!/<script(?! src="\.\.\/lesson.js")|<iframe|<audio|<video|autoplay|on(?:click|load|error)=|https?:\/\/[^" ]+\.js["']/i.test(html),'No external executable/embed/autoplay');
 assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon|webkitSpeech|speechSynthesis/.test(await read('lesson.js')));

}
const generatedBefore=await Promise.all(manifest.lessonIds.map(id=>read(`lessons/${id}.html`)));
execFileSync(process.execPath,[path.join(root,'scripts/build-lessons.mjs')]);
assert.deepEqual(await Promise.all(manifest.lessonIds.map(id=>read(`lessons/${id}.html`))),generatedBefore,'Deterministic full lesson build');
execFileSync(process.execPath,['--check',path.join(root,'lesson.js')]);
console.log(`PASS: ${manifest.lessonIds.length} exact registered lessons, ${questions} complete question/answer sets; original catalog hashes preserved, all static links/anchors/labels and SVG names valid, no-JS contents, no external runtime or storage, deterministic output. This is source validation, not browser/iOS visual QA.`);
