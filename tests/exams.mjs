// Portable structural regression checks. Actual screen/print QA remains a separate gate.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
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

// Keep the exact circled characters while giving them a bounded, licensed font.
for(let cp=0x2460;cp<=0x2473;cp++){
 const c=String.fromCodePoint(cp);
 assert.equal(examText(c),`<span class="exam-enumeration">${c}</span>`);
}
assert.equal(examText('①「把早晨的門推開」②找詞。'), '<span class="exam-enumeration">①</span>「把早晨的門推開」<span class="exam-enumeration">②</span>找詞。');
assert.equal(examText('①ㄑㄧㄥ\n②晴'), '<span class="exam-enumeration">①</span><span class="zhuyin-syllable">ㄑㄧㄥ</span>\n<span class="exam-enumeration">②</span>晴');
assert.equal(examText('<img>①&"'), '&lt;img&gt;<span class="exam-enumeration">①</span>&amp;&quot;');
assert.match(css,/\.exam-enumeration\{display:inline-block;font-family:"Elementary Exam Markers"/);
assert.match(css,/unicode-range:U\+2460-2473/);
assert.match(css,/font-synthesis:none;white-space:nowrap/);
const markerFont=await readFile(path.join(root,'exams/fonts/elementary-exam-markers-v1.woff'));
assert.equal(markerFont.subarray(0,4).toString(),'wOFF');
assert.ok(markerFont.length<16384,'Marker-only font must remain small');
let markerOS2;
for(let i=0;i<markerFont.readUInt16BE(12);i++){
 const p=44+i*20;
 if(markerFont.subarray(p,p+4).toString()!=='OS/2')continue;
 const offset=markerFont.readUInt32BE(p+4), compressed=markerFont.readUInt32BE(p+8), original=markerFont.readUInt32BE(p+12);
 const table=markerFont.subarray(offset,offset+compressed);
 markerOS2=compressed<original?inflateSync(table):table;
 assert.equal(markerOS2.length,original);
}
assert.ok(markerOS2,'Marker font must retain OS/2 embedding metadata');
assert.equal(markerOS2.readUInt16BE(8),0,'Retain the source font’s unrestricted embedding flag');
assert.equal(markerOS2.readUInt16BE(62),64,'Retain source Regular style selection');
const markerLicense=await readFile(path.join(root,'exams/fonts/OFL-Elementary-Exam-Markers.txt'),'utf8');
assert.ok(markerLicense.includes('Elementary Exam Markers')&&markerLicense.includes('SIL OPEN FONT LICENSE')&&markerLicense.includes('Adobe'));
console.log('PASS circled-marker isolation: Unicode, escaping, bounded font CSS, same-origin small WOFF and retained license. Actual browser pixels remain a separate gate.');

// Progressive CJK punctuation fix: scoped to stimulus text, no nowrap or font change.
const stimulusPunctuationRule='@supports(text-spacing-trim:space-all){.stimulus{text-spacing-trim:space-all}}';
assert.equal(css.split(stimulusPunctuationRule).length-1,1,'Exactly one feature-gated stimulus punctuation rule');
assert.ok(!/white-space|word-break|line-break|font-family|font-size|display|overflow/.test(stimulusPunctuationRule),'The fix must not change wrapping, font selection or block geometry');
assert.equal(stimulusPunctuationRule.split('.stimulus').length-1,1);
assert.ok(!stimulusPunctuationRule.includes('.paper')&&!stimulusPunctuationRule.includes('body'),'Do not broaden beyond stimuli');
console.log('PASS stimulus punctuation rule: feature-gated space-all, unchanged wrapping/fonts and stimulus-only scope. Actual boundary/zoom pixels remain a separate gate.');
