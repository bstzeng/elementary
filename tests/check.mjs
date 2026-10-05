import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const json=async file=>JSON.parse(await read(file));
const manifest=await json('curriculum.json');
const sources=await json(manifest.sourceFile);
const framework=await json(manifest.frameworkFile);
const semesters=(await Promise.all(manifest.gradeFiles.map(json))).flatMap(g=>g.semesters);
const html=await read('index.html');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const topicIds=[];
assert.equal(semesters.length,12);assert.equal(manifest.gradeFiles.length,6);
assert.equal(new Set(ids).size,ids.length,'Unique HTML IDs');
assert.equal(new Set(sources.map(s=>s.id)).size,sources.length,'Unique source IDs');
const requiredLow=['mandarin','mathematics','life','health-pe','language-choice','school-flexible'];
const requiredHigh=['mandarin','mathematics','english','social','science','arts','integrated','health-pe','language-choice','school-flexible'];
const checkSources=sourceIds=>{assert.ok(sourceIds.length>0);sourceIds.forEach(id=>assert.ok(sources.some(s=>s.id===id),`Missing source ${id}`));};
for(let grade=1;grade<=6;grade++)for(let semester=1;semester<=2;semester++){
 const rows=semesters.filter(s=>s.grade===grade&&s.semester===semester);assert.equal(rows.length,1,'Every grade/semester exactly once');
 const row=rows[0];assert.ok(row.summary.length>15,'Meaningful semester summary');
 assert.deepEqual(row.courses.map(c=>c.id).sort(),(grade<=2?requiredLow:requiredHigh).toSorted());
 for(const c of row.courses){
  assert.ok(c.description&&c.topicBasis&&c.weeklyPeriods);assert.ok(c.topics.length>=5,`Meaningful coverage ${grade}/${semester}/${c.id}`);
  assert.equal(new Set(c.topics.map(t=>t.title)).size,c.topics.length,'No duplicate course topic titles');
  assert.ok(c.caveats.length);checkSources(c.sourceIds);
  assert.equal(c.classification==='school-defined',c.id==='school-flexible');
  for(const t of c.topics){assert.ok(t.id&&t.title&&t.group);topicIds.push(t.id);assert.ok(ids.includes(t.id));}
 }
}
assert.equal(new Set(topicIds).size,topicIds.length,'Unique topic IDs');
for(let grade=1;grade<=6;grade++){
 const [a,b]=semesters.filter(s=>s.grade===grade);
 for(const c of a.courses){const d=b.courses.find(x=>x.id===c.id);assert.notDeepEqual(c.topics.map(t=>t.title),d.topics.map(t=>t.title),`Real semester progression ${grade}/${c.id}`);}
}
const original=await json('tests/fixtures/approved-grade1-semester1.json');
const first=semesters.find(s=>s.grade===1&&s.semester===1);
for(const c of original.courses){const current=first.courses.find(x=>x.id===(c.id==='flexible'?'school-flexible':c.id));assert.deepEqual(current.topics.map(({title,group})=>({title,group})),c.topics.map(({title,group})=>({title,group})),'Preserve approved first-semester content');}
assert.equal(first.courses.reduce((n,c)=>n+c.topics.length,0),95);
assert.equal((html.match(/class="course-card"/g)||[]).length,104);
assert.equal((html.match(/data-topic-search=/g)||[]).length,topicIds.length,'All topics have static fallback');
assert.equal((html.match(/class="semester-panel"/g)||[]).length,12);
assert.equal(framework.stages.length,3);assert.equal(framework.issues.length,19);assert.equal(new Set(framework.issues).size,19);
assert.equal(framework.competencies.length,3);assert.equal(framework.competencies.reduce((n,c)=>n+c.items.length,0),9);
assert.ok(framework.subjects.length>=11);framework.subjects.forEach(s=>{assert.ok(s.performance.length&&s.content.length);checkSources(s.sourceIds);});
for(const s of sources){assert.equal(new URL(s.url).protocol,'https:');assert.ok(s.title&&s.note&&s.kind);}
for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
 if(link.startsWith('#'))assert.ok(ids.includes(link.slice(1)),`Valid static anchor ${link}`);
 else if(link.startsWith('./')&&link!=='./')await access(path.join(root,link.slice(2)));
 else assert.ok(link==='./'||link.startsWith('https://'),`Safe relative or HTTPS URL ${link}`);
}
for(const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.ok(match[0].includes('rel="noopener noreferrer"'));
assert.ok(html.includes('不逐字收錄所有課綱指標'));assert.ok(html.includes('不是全國統一的課本目錄'));assert.ok(html.includes('19 門部定必修科目'));assert.ok(html.includes('畢業及校曆'));
assert.ok(!html.includes('規劃中'));assert.ok(html.includes('aria-live="polite"'));assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.ok(html.includes('<html lang="zh-Hant">'));
assert.ok(!/<iframe|http:\/\/|eval\(|localStorage|sessionStorage/.test(html));
execFileSync(process.execPath,['--check',path.join(root,'app.js')]);
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')]);
assert.equal(await read('index.html'),html,'Deterministic generated HTML');
console.log(`PASS: 12 semesters, 104 course cards, ${topicIds.length} topics, ${sources.length} sources; required subject and stage coverage, exact first-semester preservation, meaningful semester differences, sources/anchors/unique IDs, framework and 19 issues, complete no-JS HTML, safe links and deterministic build.`);
