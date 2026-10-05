// Dependency-free state model. This does not launch or simulate a visual browser.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const manifest=await read('data/lessons.json');
const script=await readFile(path.join(root,'lesson.js'),'utf8');
let focused=null;
class Element {
 constructor(tag='div',dataset={}){this.tag=tag;this.dataset=dataset;this.hidden=false;this.open=false;this.checked=false;this.value='';this.textContent='';this.events={};this.attributes={};this.children=[];this.className='';}
 addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
 fire(name){for(const fn of this.events[name]||[])fn({preventDefault(){}});}
 setAttribute(name,value){this.attributes[name]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 focus(){focused=this;}
}
let total=0;
for(const id of manifest.lessonIds){
 const data=await read(`data/lessons/${id}.json`);
 const questions=data.exercises.map(q=>{
  const el=new Element('fieldset',{answer:String(q.answer),question:q.id});
  el.inputs=q.options.map((_,i)=>{const input=new Element('input');input.value=String(i);return input;});
  el.details=[new Element('details'),new Element('details')];
  el.parts={'.answer-feedback':new Element(),'.check-answer':new Element('button'),'.explanation':new Element('p')};
el.parts['.explanation'].textContent=q.explanation;
  el.querySelector=s=>s==='input:checked'?el.inputs.find(i=>i.checked):s==='input'?el.inputs[0]:el.parts[s];
  el.querySelectorAll=s=>s==='input'?el.inputs:s==='details'?el.details:[];
  return el;
 });
 const parts=Object.fromEntries(['.quiz-progress','.reset-quiz','.self-progress','.lesson-print'].map(c=>[c,new Element()]));
 const checks=data.selfCheck.map(()=>new Element('input'));
 const board=data.sections.some(s=>s.html.includes('data-count-board'))?new Element():null;
 const details=[...questions.flatMap(q=>q.details),new Element('details')];details.at(-1).open=true;
 const window=new Element();let prints=0;window.print=()=>prints++;
 const document={querySelector:s=>parts[s],querySelectorAll:s=>s==='.question'?questions:s==='.self-checks input'?checks:s==='[data-count-board]'?(board?[board]:[]):s==='details'?details:[],createElement:tag=>new Element(tag),documentElement:{classList:{add(name){assert.equal(name,'lesson-ready');}}}};
 vm.runInNewContext(script,{document,window,Set,Number});
 const select=(q,j)=>{q.inputs.forEach((input,i)=>{input.checked=i===j;});q.inputs[j].fire('change');};
 for(let i=0;i<questions.length;i++){
  const q=questions[i],answer=data.exercises[i].answer;
  q.parts['.check-answer'].fire('click');assert.equal(q.parts['.answer-feedback'].dataset.result,'pending');
  select(q,(answer+1)%q.inputs.length);q.parts['.check-answer'].fire('click');assert.equal(q.parts['.answer-feedback'].dataset.result,'retry');assert.ok(q.parts['.answer-feedback'].textContent.includes(data.exercises[i].explanation));
  select(q,answer);assert.equal(q.parts['.answer-feedback'].textContent,'');q.parts['.check-answer'].fire('click');assert.equal(q.parts['.answer-feedback'].dataset.result,'correct');
  q.parts['.check-answer'].fire('click');
 }
 assert.ok(parts['.quiz-progress'].textContent.includes(`已嘗試 ${questions.length}／${questions.length} 題，目前 ${questions.length} 題`),'Repeated checks cannot inflate score');
 select(questions[0],(data.exercises[0].answer+1)%questions[0].inputs.length);assert.ok(parts['.quiz-progress'].textContent.includes(`目前 ${questions.length-1} 題`),'Changing a checked answer invalidates previous correctness');
 checks.forEach(c=>{c.checked=true;c.fire('change');});assert.ok(parts['.self-progress'].textContent.includes(`${checks.length}／${checks.length}`));
 checks[0].checked=false;checks[0].fire('change');assert.ok(parts['.self-progress'].textContent.includes(`${checks.length-1}／${checks.length}`));
 questions.forEach(q=>q.details.forEach(d=>{d.open=true;}));
 parts['.reset-quiz'].fire('click');assert.ok(questions.every(q=>q.inputs.every(i=>!i.checked)&&q.details.every(d=>!d.open)&&q.parts['.answer-feedback'].textContent===''));assert.equal(focused,questions[0].inputs[0]);assert.ok(parts['.quiz-progress'].textContent.includes('已嘗試 0'));assert.equal(checks.at(-1).checked,true,'Quiz reset does not silently clear self assessment');
 const prior=details.map(d=>d.open);window.fire('beforeprint');window.fire('beforeprint');assert.ok(details.every(d=>d.open));window.fire('afterprint');assert.deepEqual(details.map(d=>d.open),prior);parts['.lesson-print'].fire('click');assert.equal(prints,1);
 if(board){
  const frame=board.children.find(n=>n.className==='ten-frame');const controls=board.children.find(n=>n.className==='count-controls');const select=controls.children.find(n=>n.tag==='select');const buttons=controls.children.filter(n=>n.tag==='button');const outcome=board.children.at(-1);const readout=board.children.find(n=>n.className==='count-readout');
  assert.equal(frame.children.length,10);assert.equal(select.children.length,10);assert.equal(select.value,'5');
  for(let target=1;target<=10;target++){
   buttons[1].fire('click');select.value=String(target);select.fire('change');buttons[0].fire('click');assert.ok(outcome.textContent.includes('現在有 0 顆'));
   frame.children.slice(0,target).forEach(c=>c.fire('click'));buttons[0].fire('click');assert.ok(outcome.textContent.startsWith('做到了！'));assert.ok(readout.textContent.includes(`現在有 ${target} 顆`));assert.equal(frame.children.filter(c=>c.attributes['aria-pressed']==='true').length,target);
   frame.children[target-1].fire('click');buttons[0].fire('click');assert.ok(!outcome.textContent.startsWith('做到了！'));frame.children[target-1].fire('click');
  }
  buttons[1].fire('click');assert.ok(frame.children.every(c=>c.attributes['aria-pressed']==='false'));assert.ok(readout.textContent.includes('沒有圓點'));
 }
 total+=questions.length;
}
console.log(`PASS: ${total} exercises through unanswered, incorrect, correct, change and repeat branches; reset/focus, self-check toggle, print reopen/restore and all ten-frame targets 1–10. DOM model only; no actual browser was run.`);
