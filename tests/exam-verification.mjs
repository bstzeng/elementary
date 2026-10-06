// Public verification state and PDF bindings are not interchangeable gates.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const m=JSON.parse(await readFile(path.join(root,'data/exams.json'),'utf8'));
if(!m.verification){console.log('No v2 verification evidence in this draft; release verification tests apply to the sealed v2 candidate.');process.exit(0);}
const v=m.verification,out=JSON.parse(await readFile(path.join(root,'exams/manifest.json'),'utf8'));
assert.equal(m.schemaVersion,2);assert.deepEqual([...v.contentReviewedFormIds].sort(),[...m.formIds].sort());
assert.equal(out.htmlVerified,Object.keys(v.htmlVerified).length);assert.equal(out.pdfVerified,Object.keys(v.pdfVerified).length);assert.equal(out.browserPrintVerified,Object.keys(v.browserPrintVerified).length);
const index=await readFile(path.join(root,'exams/index.html'),'utf8');assert.ok(index.includes(`網頁檢查：${out.htmlVerified}／${out.forms}份`));assert.ok(index.includes(`PDF逐頁檢查：${out.pdfVerified}／${out.forms}份`));
if(!out.browserPrintVerified){assert.ok(index.includes('瀏覽器網頁列印尚未驗證'));assert.deepEqual(m.qaAcceptedFormIds,[]);}
const tmp=await mkdtemp(path.join(os.tmpdir(),'exam-verification-'));
try{
 await cp(path.join(root,'data'),path.join(tmp,'data'),{recursive:true});await mkdir(path.join(tmp,'scripts'));await cp(path.join(root,'scripts/build-exams.mjs'),path.join(tmp,'scripts/build-exams.mjs'));await cp(path.join(root,'exams'),path.join(tmp,'exams'),{recursive:true});
 const id=m.formIds[0],htmlId=Object.keys(v.htmlVerified)[0];
 assert.ok(htmlId,'This release fixture requires an actually HTML-verified source');
 const paper=path.join(tmp,'exams',id+'.html'),before=await readFile(paper);
 async function reject(name,change,regex){const bad=structuredClone(m);change(bad);await writeFile(path.join(tmp,'data/exams.json'),JSON.stringify(bad));const r=spawnSync(process.execPath,[path.join(tmp,'scripts/build-exams.mjs')],{encoding:'utf8'});assert.notEqual(r.status,0,name);assert.match(r.stderr,regex,name);assert.deepEqual(await readFile(paper),before,name+' must preserve good output');}
 await reject('HTML evidence outside allowlist',x=>x.verification.htmlVerified['g6s2-fake-final-a']=x.verification.htmlVerified[htmlId],/outside published/);
 await reject('Stale HTML content',x=>x.verification.htmlVerified[htmlId].sourceSha256='0'.repeat(64),/verification binding/);
 await reject('PDF cannot establish browser print',x=>x.qaAcceptedFormIds=[id],/original HTML and browser-print gates/);
 await reject('Student PDF path cannot target key',x=>x.verification.pdfVerified[id].student.path=x.verification.pdfVerified[id].teacher.path,/PDF role\/path/);
 await reject('Stale PDF content source',x=>x.verification.pdfVerified[id].sourceSha256='0'.repeat(64),/PDF source\/page/);
 await reject('Unreviewed PDF pages',x=>x.verification.pdfVerified[id].pageReview='unrun',/PDF source\/page/);
 await reject('PDF blob hash mismatch',x=>x.verification.pdfVerified[id].student.sha256='0'.repeat(64),/PDF bytes differ/);
 await reject('Unbound browser-print assertion',x=>x.verification.browserPrintVerified[id]={sourceSha256:'0'.repeat(64)},/verification binding/);
}finally{await rm(tmp,{recursive:true,force:true});}
console.log(`PASS separate verification: content${v.contentReviewedFormIds.length}, HTML${out.htmlVerified}, PDF${out.pdfVerified}, browser-print${out.browserPrintVerified}; eight fail-safe mutation gates.`);
