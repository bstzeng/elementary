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
 assert.ok(!/<script(?! src="\.\.\/lesson.js")|<iframe|<audio|<video|autoplay|on(?:click|load|error)=|https?:\/\/[^" ]+\.js["']/i.test(html),'No external executable/embed/autoplay');
 assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon|webkitSpeech|speechSynthesis/.test(await read('lesson.js')));

}
const generatedBefore=await Promise.all(manifest.lessonIds.map(id=>read(`lessons/${id}.html`)));
execFileSync(process.execPath,[path.join(root,'scripts/build-lessons.mjs')]);
assert.deepEqual(await Promise.all(manifest.lessonIds.map(id=>read(`lessons/${id}.html`))),generatedBefore,'Deterministic full lesson build');
execFileSync(process.execPath,['--check',path.join(root,'lesson.js')]);
console.log(`PASS: ${manifest.lessonIds.length} exact registered lessons, ${questions} complete question/answer sets; original catalog hashes preserved, all static links/anchors/labels and SVG names valid, no-JS contents, no external runtime or storage, deterministic output. This is source validation, not browser/iOS visual QA.`);
