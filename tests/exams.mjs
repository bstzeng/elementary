// Portable structural regression checks. Actual screen/print QA remains a separate gate.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {examText} from '../scripts/exam-text.mjs';
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
  assert.ok(key.includes(examText(q.answer.value).replaceAll('\n','<br>')),`${q.id} key missing`);
  if(q.teacher)assert.ok(!student.includes(examText(q.teacher).replaceAll('\n','<br>')),`${q.id} script leaked`);
  if(q.routeTopicIds){
   assert.ok(key.includes('兩條路徑擇一；只評已選語別。'));
   assert.ok(!student.includes('route-coverage'));
   for(const [route,label] of [['spoken','口語語別'],['sign','臺灣手語']]){
    const group=`<span class="route-coverage">${label}：`+q.routeTopicIds[route].map(id=>`<a href="../lessons/${id}.html">${esc(courses.flatMap(c=>c.topics).find(t=>t.id===id).title)}</a>`).join('、')+'</span>';
    assert.ok(key.includes(group),`${q.id}: ${route} coverage missing`);
   }
  }
  if(q.writingBoxes){boxes+=q.writingBoxes.length;for(const label of q.writingBoxes)assert.ok(student.includes(`${esc(label)}的書寫空格`));}
  if(['oral','listening','performance'].includes(q.kind))observed++;
 }
 if(manifest.verification?.pdfVerified?.[id]){
  const pdf=manifest.verification.pdfVerified[id];
  assert.ok(student.includes(`href="./${pdf.student.path}" download`));assert.ok(!student.includes(pdf.teacher.path));
  assert.ok(key.includes(`href="./${pdf.teacher.path}" download`));assert.ok(!key.includes(pdf.student.path));
  assert.ok(student.includes('瀏覽器網頁列印尚未驗證。')||Object.hasOwn(manifest.verification.browserPrintVerified||{},id));
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
  await cp(path.join(root,'scripts/build-exams.mjs'),path.join(tmp,'scripts/build-exams.mjs'));await cp(path.join(root,'scripts/exam-text.mjs'),path.join(tmp,'scripts/exam-text.mjs'));
  if(Object.keys(manifest.verification?.pdfVerified||{}).length)await cp(path.join(root,'exams/pdf'),path.join(tmp,'exams/pdf'),{recursive:true});
  let r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const id=manifest.formIds[0],file=path.join(tmp,'data/exams',`${id}.json`),paper=path.join(tmp,'exams',`${id}.html`);
  const before=await readFile(paper);const d=JSON.parse(await readFile(file,'utf8'));d.title+=' MUTATED';let bytes=JSON.stringify(d,null,2)+'\n';await writeFile(file,bytes);
  r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/source differs/);assert.deepEqual(await readFile(paper),before);
  d.sections[0].items[0].points+=1;bytes=JSON.stringify(d,null,2)+'\n';await writeFile(file,bytes);
  const m=structuredClone(manifest);m.sourceHashes[id]=createHash('sha256').update(bytes).digest('hex');
  // Keep this synthetic score-mutation fixture internally hash-consistent, so
  // the numeric gate is tested rather than stopping at stale-evidence checks.
  for(const kind of ['htmlVerified','pdfVerified','browserPrintVerified'])if(m.verification?.[kind]?.[id])m.verification[kind][id].sourceSha256=m.sourceHashes[id];
  await writeFile(path.join(tmp,'data/exams.json'),JSON.stringify(m));
  r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/score|rubric|blueprint/);assert.deepEqual(await readFile(paper),before);
 }finally{await rm(tmp,{recursive:true,force:true});}
}
console.log(`PASS exams: ${output.forms} forms/${qcount} questions, student/key separation, ${boxes} writing boxes, ${observed} observed tasks, explicit source hashes, catalogue links and fail-safe mutation gates. Actual browser/A4 pagination not covered.`);

// Zhuyin wrappers preserve all visible characters and cannot inject markup.
for(const syllable of ['ㄅ','ㄓ','ㄇㄚˊ','ㄏㄡˋ','ㄒㄩㄝˇ','˙ㄉㄜ','ㄉㄜ˙','ㄇㄚˉ','ㆠㄚˊ']){
 assert.equal(examText(syllable),`<span class="zhuyin-syllable">${syllable}</span>`);
}
assert.equal(examText('前ㄏㄡˋ 後\nㄌㄧㄣˊ。'), '前<span class="zhuyin-syllable">ㄏㄡˋ</span> 後\n<span class="zhuyin-syllable">ㄌㄧㄣˊ</span>。');
assert.equal(examText('<script>\"&\'ㄏㄡˋ</script>'), '&lt;script&gt;&quot;&amp;&#39;<span class="zhuyin-syllable">ㄏㄡˋ</span>&lt;/script&gt;');
assert.equal(examText('English / 數學 12+3=15 / ˋ'), 'English / 數學 12+3=15 / ˋ');
const css=await readFile(path.join(root,'exams/exam.css'),'utf8');
assert.match(css,/\.zhuyin-syllable\{[^}]*display:inline-block;white-space:nowrap;word-break:normal;overflow-wrap:normal/);
console.log('PASS Zhuyin atomic syllables: all tones, neutral prefix/suffix, extended symbols, exact Unicode and safe HTML escaping.');
