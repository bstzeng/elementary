// Portable structural regression checks. Actual screen/print QA remains a separate gate.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const manifest=await read('data/exams.json'),output=await read('exams/manifest.json'),courses=await read('data/exam-courses.json');
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
assert.equal(courses.length,104);assert.equal(manifest.targetForms,624);assert.equal(output.forms,manifest.formIds.length);
assert.deepEqual(output.ids,manifest.formIds);assert.equal(new Set(manifest.formIds).size,manifest.formIds.length);
if(process.env.EXAM_RELEASE==='1')assert.equal(manifest.draft,false,'A draft cannot pass release gates');
let qcount=0,observed=0,boxes=0;
for(const id of manifest.formIds){
 const data=await readFile(path.join(root,'data/exams',`${id}.json`));
 assert.equal(createHash('sha256').update(data).digest('hex'),manifest.sourceHashes[id]);
 const d=JSON.parse(data),questions=d.sections.flatMap(s=>s.items);qcount+=questions.length;
 const student=await readFile(path.join(root,'exams',`${id}.html`),'utf8');
 const key=await readFile(path.join(root,'exams',`${id}-key.html`),'utf8');
 assert.equal((student.match(/class="question"/g)||[]).length,questions.length);
 assert.equal((key.match(/class="answer-key"/g)||[]).length,questions.length);
 assert.ok(!/class="(?:answer-key|teacher-protocol|key-sources|teacher-record|observation-parts)"/.test(student));
 assert.ok(!/class="(?:response-space|observation-note|writing-boxes)"/.test(key));
 assert.ok(!/correctIndex|"answer":|teacherNotes/.test(student));
 for(const q of questions){
  assert.ok(key.includes(esc(q.answer.value)),`${q.id} key missing`);
  if(q.teacher)assert.ok(!student.includes(esc(q.teacher)),`${q.id} script leaked`);
  if(q.writingBoxes){boxes+=q.writingBoxes.length;for(const label of q.writingBoxes)assert.ok(student.includes(`${esc(label)}的書寫空格`));}
  if(['oral','listening','performance'].includes(q.kind))observed++;
 }
 const ids=[...student.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
}
assert.equal(qcount,output.questions);
const index=await readFile(path.join(root,'exams/index.html'),'utf8');
assert.equal((index.match(/class="exam-card"/g)||[]).length,104);
assert.equal((index.match(/class="available"/g)||[]).length,manifest.formIds.length);
for(const row of index.match(/<li[^>]*class="planned"[^>]*>.*?<\/li>/g)||[])assert.ok(!row.includes('<a '));
// Mutation tests are isolated: reject unreviewed edits and reject bad scores before deleting a valid build.
if(manifest.formIds.length){
 const tmp=await mkdtemp(path.join(os.tmpdir(),'elementary-exam-test-'));
 try{
  await cp(path.join(root,'data'),path.join(tmp,'data'),{recursive:true});
  await mkdir(path.join(tmp,'scripts'),{recursive:true});await mkdir(path.join(tmp,'exams'),{recursive:true});
  await cp(path.join(root,'scripts/build-exams.mjs'),path.join(tmp,'scripts/build-exams.mjs'));
  let r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const id=manifest.formIds[0],file=path.join(tmp,'data/exams',`${id}.json`),paper=path.join(tmp,'exams',`${id}.html`);
  const before=await readFile(paper);const d=JSON.parse(await readFile(file,'utf8'));d.title+=' MUTATED';let bytes=JSON.stringify(d,null,2)+'\n';await writeFile(file,bytes);
  r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/source differs/);assert.deepEqual(await readFile(paper),before);
  d.sections[0].items[0].points+=1;bytes=JSON.stringify(d,null,2)+'\n';await writeFile(file,bytes);
  const m=structuredClone(manifest);m.sourceHashes[id]=createHash('sha256').update(bytes).digest('hex');await writeFile(path.join(tmp,'data/exams.json'),JSON.stringify(m));
  r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/score|rubric|blueprint/);assert.deepEqual(await readFile(paper),before);
 }finally{await rm(tmp,{recursive:true,force:true});}
}
console.log(`PASS exams: ${output.forms} forms/${qcount} questions, student/key separation, ${boxes} writing boxes, ${observed} observed tasks, explicit source hashes, catalogue links and fail-safe mutation gates. Actual browser/A4 pagination not covered.`);
