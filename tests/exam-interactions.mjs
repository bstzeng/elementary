import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const blueprints=JSON.parse(fs.readFileSync(path.join(root,'data/exam-courses.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'exams/manifest.json'),'utf8'));
const opened=new Set(manifest.ids);
class Element{
 constructor(dataset={}){this.dataset=dataset;this.hidden=false;this.events={};this.value='all';this.checked=false;this.textContent='';}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
 fire(name){for(const fn of this.events[name]??[])fn({preventDefault(){}});}
}
const options={grade:['all','1','2','3','4','5','6'],semester:['all','1','2'],course:['all',...new Set(blueprints.map(b=>b.course))],phase:['all','midterm','final'],variant:['all','a','b','c']};
const controls=Object.fromEntries(Object.entries(options).map(([k,v])=>{const e=new Element();e.options=v.map(value=>({value}));return [k,e];}));
controls.openOnly=new Element();
const form=new Element();form.elements={namedItem:n=>controls[n]};
const cards=blueprints.map(b=>{
 const card=new Element({grade:String(b.grade),semester:String(b.semester),course:b.course});
 card.groups=['midterm','final'].map(phase=>{
  const group=new Element({phase});group.rows=['a','b','c'].map(variant=>{
   const row=new Element({variant});row.available=opened.has(`${b.id}-${phase}-${variant}`);row.classList={contains:s=>s==='available'&&row.available};return row;
  });group.querySelectorAll=()=>group.rows;return group;
 });card.querySelectorAll=()=>card.groups;return card;
});
const status=new Element(),empty=new Element(),print=new Element();
const document={querySelector:s=>({'#exam-filters':form,'#filter-result':status,'#empty-state':empty}[s]),querySelectorAll:s=>s==='[data-print]'?[print]:s==='.exam-card'?cards:[]};
const window=new Element();let printed=0;window.print=()=>printed++;
const location={href:'https://example.test/elementary/exams/',search:''};
const history={replaceState(a,b,url){location.href=String(url);location.search=new URL(url).search;}};
vm.runInNewContext(fs.readFileSync(path.join(root,'exams/exam.js'),'utf8'),{document,window,location,history,URL,URLSearchParams,setTimeout:fn=>fn()});
const visible=()=>cards.filter(c=>!c.hidden);
assert.equal(visible().length,104);assert.match(status.textContent,new RegExp(`${manifest.forms} 份`));
let cases=0;
for(const grade of options.grade)for(const semester of options.semester)for(const course of options.course)for(const phase of options.phase)for(const variant of options.variant){
 Object.assign(controls.grade,{value:grade});Object.assign(controls.semester,{value:semester});Object.assign(controls.course,{value:course});Object.assign(controls.phase,{value:phase});Object.assign(controls.variant,{value:variant});
 controls.openOnly.checked=false;form.fire('change');
 const expect=blueprints.filter(b=>(grade==='all'||String(b.grade)===grade)&&(semester==='all'||String(b.semester)===semester)&&(course==='all'||b.course===course));
 assert.equal(visible().length,expect.length);
 let n=0;
 for(const card of visible())for(const group of card.groups){
  assert.equal(group.hidden,phase!=='all'&&group.dataset.phase!==phase);
  for(const row of group.rows){assert.equal(row.hidden,variant!=='all'&&row.dataset.variant!==variant);if(!group.hidden&&!row.hidden&&row.available)n++;}
 }
 assert.match(status.textContent,new RegExp(`${n} 份`));
 controls.openOnly.checked=true;form.fire('change');
 assert.ok(visible().every(c=>c.groups.some(g=>!g.hidden&&g.rows.some(r=>!r.hidden&&r.available))));
 assert.equal(empty.hidden,visible().length!==0);cases++;
}
// Return to all, then restore a deep link as if reached by Back/Forward.
location.href='https://example.test/elementary/exams/?grade=1&semester=1&course=mathematics&phase=final&variant=b&open=1';location.search=new URL(location.href).search;window.fire('popstate');
assert.equal(visible().length,opened.has('g1s1-mathematics-final-b')?1:0);assert.equal(controls.variant.value,'b');
location.href='https://example.test/elementary/exams/?grade=999&course=%3Cscript%3E&phase=oops';location.search=new URL(location.href).search;window.fire('popstate');
assert.equal(controls.grade.value,'all');assert.equal(controls.course.value,'all');assert.equal(visible().length,104);
// Native reset applies after controls have returned to defaults.
for(const name of Object.keys(options))controls[name].value='all';controls.openOnly.checked=false;form.fire('reset');assert.equal(visible().length,104);assert.equal(location.search,'');
print.fire('click');print.fire('click');assert.equal(printed,2);
console.log(`PASS: ${cases} filter intersections × all/open-only, counts, no-result state, known/unknown deep links, popstate, reset, repeated print.`);
