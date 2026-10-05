// A dependency-free DOM model tests state transitions; visual QA is separate.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const data=await read('curriculum.json');
const semesters=(await Promise.all(data.gradeFiles.map(read))).flatMap(g=>g.semesters);
const normalize=s=>s.normalize('NFKC').toLocaleLowerCase('zh-TW');
let active=null;
class Element{
 constructor(dataset={}){this.dataset=dataset;this.hidden=false;this.open=false;this.value='';this.textContent='';this.events={};this.attributes={};this.children=[];}
 addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
 fire(name){for(const fn of this.events[name]||[])fn({preventDefault(){}});}
 setAttribute(name,value){this.attributes[name]=value;}
 focus(){active=this;}
 scrollIntoView(){}
 replaceChildren(){this.children=[];}
 append(child){this.children.push(child);}
}
const panels=semesters.map(s=>{
 const panel=new Element({grade:String(s.grade),semester:String(s.semester),label:`小${['一','二','三','四','五','六'][s.grade-1]}${s.semester===1?'上':'下'}學期`});
 panel.cards=s.courses.map(c=>{
  const card=new Element({course:c.id,category:c.classification==='school-defined'?'school':'national',courseSearch:normalize([c.title,c.shortTitle,c.category,...(c.languageOptions||[])].join(' '))});
  card.topics=c.topics.map(t=>new Element({topicSearch:normalize(`${t.title} ${t.group||''}`)}));
  card.elements={details:new Element(),'.summary-label':new Element(),'.topic-preview':new Element(),h3:new Element()};
  card.elements.h3.textContent=c.shortTitle||c.title;
  card.querySelector=k=>card.elements[k];
  card.querySelectorAll=k=>k==='.topic-list li'?card.topics:[];
  return card;
 });
 panel.querySelectorAll=k=>k==='.course-card'?panel.cards:[];
 return panel;
});
const selectors=['#topic-search','#subject-filter','.search-clear','.expand-all','#result-count','#catalog-title','.empty-state','#empty-message','#filter-hint','#selection-kicker','.search','.reset-button','.print-button','#courses'];
const el=Object.fromEntries(selectors.map(s=>[s,new Element()]));
const grades=Array.from({length:6},(_,i)=>new Element({grade:String(i+1)}));
const terms=[1,2].map(s=>new Element({semester:String(s)}));
const filters=['all','national','school'].map(filter=>new Element({filter}));
const document={title:'',querySelector:s=>el[s],querySelectorAll:s=>s==='.semester-panel'?panels:s==='.grade-button'?grades:s==='.semester-button'?terms:s==='.filter'?filters:s==='.course-details'?panels.flatMap(p=>p.cards.map(c=>c.elements.details)):[],createElement:()=>new Element(),documentElement:{classList:{add(){}}}};
const window=new Element();let printed=0;window.print=()=>printed++;
const location={hash:''};const stack=[''];let cursor=0;
const history={pushState(a,b,hash){stack.splice(cursor+1);stack.push(hash);cursor++;location.hash=hash;},replaceState(a,b,hash){stack[cursor]=hash;location.hash=hash;},back(){if(cursor>0){location.hash=stack[--cursor];window.fire('popstate');}},forward(){if(cursor<stack.length-1){location.hash=stack[++cursor];window.fire('popstate');}}};
vm.runInNewContext(await readFile(path.join(root,'app.js'),'utf8'),{document,window,location,history,URLSearchParams,matchMedia:()=>({matches:true})});
const panel=()=>panels.find(p=>!p.hidden);
const visible=()=>panel().cards.filter(c=>!c.hidden);
const input=value=>{el['#topic-search'].value=value;el['#topic-search'].fire('input');};
const checkCount=()=>{const cs=visible();const ts=cs.reduce((n,c)=>n+c.topics.filter(t=>!t.hidden).length,0);assert.ok(el['#result-count'].textContent.includes(`${cs.length} 類課程 · ${ts} 個`));};
assert.equal(panel().dataset.grade,'1');assert.equal(visible().length,6);assert.match(el['#result-count'].textContent,/95 個主題/);
for(let g=1;g<=6;g++)for(let s=1;s<=2;s++){
 grades[g-1].fire('click');terms[s-1].fire('click');
 assert.equal(panel().dataset.grade,String(g));assert.equal(panel().dataset.semester,String(s));
 assert.equal(visible().length,g<=2?6:10);assert.equal(panels.filter(p=>!p.hidden).length,1);checkCount();
 assert.equal(grades[g-1].attributes['aria-pressed'],'true');assert.equal(terms[s-1].attributes['aria-pressed'],'true');
}
// Back/Forward restore the selected grade and semester, not just the URL.
grades[1].fire('click');assert.equal(panel().dataset.grade,'2');
history.back();assert.equal(panel().dataset.grade,'6');history.forward();assert.equal(panel().dataset.grade,'2');
// Direct deep link including search and category restores safely.
location.hash='#g3s1?subject=mathematics&type=national&q=%E6%95%B8%E5%AD%B8';window.fire('hashchange');
assert.equal(panel().dataset.grade,'3');assert.equal(visible().length,1);assert.equal(visible()[0].dataset.course,'mathematics');checkCount();
// Unknown subjects and malformed grade hashes do not crash or hide all content.
location.hash='#g2s2?subject=unknown&type=bogus';window.fire('hashchange');assert.equal(el['#subject-filter'].value,'all');assert.equal(visible().length,6);
location.hash='#g9s3';window.fire('hashchange');assert.equal(panel().dataset.grade,'2');
location.hash='#framework';window.fire('hashchange');assert.equal(panel().dataset.grade,'2');
location.hash='#g1s1';window.fire('hashchange');
filters[1].fire('click');assert.equal(visible().length,5);assert.match(el['#result-count'].textContent,/85 個主題/);
filters[2].fire('click');assert.equal(visible().length,1);assert.match(el['#result-count'].textContent,/10 個主題/);
filters[0].fire('click');input('口腔');assert.equal(visible().length,1);assert.equal(visible()[0].elements.details.open,true);checkCount();
input('１０以內');assert.equal(visible().length,1);assert.equal(visible()[0].dataset.course,'mathematics');
input('10 數量');assert.equal(visible().length,1);
input('閩南');assert.equal(visible().length,1);assert.equal(visible()[0].dataset.course,'language-choice');
input('不存在的主題');assert.equal(visible().length,0);assert.equal(el['.empty-state'].hidden,false);
el['.reset-button'].fire('click');assert.equal(visible().length,6);assert.equal(active,el['#topic-search']);
input('<img src=x onerror=alert(1)>');assert.match(el['#empty-message'].textContent,/<img src=x/);
el['.search-clear'].fire('click');assert.equal(visible().length,6);assert.equal(el['#topic-search'].value,'');
// Subject+category intersections, and absent subjects when switching stages.
el['#subject-filter'].value='mathematics';el['#subject-filter'].fire('change');assert.equal(visible().length,1);
filters[2].fire('click');assert.equal(visible().length,0);el['.reset-button'].fire('click');
grades[2].fire('click');el['#subject-filter'].value='science';el['#subject-filter'].fire('change');assert.equal(visible().length,1);
grades[0].fire('click');assert.equal(el['#subject-filter'].value,'all');assert.equal(visible().length,6);
// Expand/collapse and printing affect only currently visible cards and restore.
el['.expand-all'].fire('click');assert.ok(visible().every(c=>c.elements.details.open));
el['.expand-all'].fire('click');assert.ok(visible().every(c=>!c.elements.details.open));
window.fire('beforeprint');window.fire('beforeprint');assert.ok(visible().every(c=>c.elements.details.open));
window.fire('afterprint');assert.ok(visible().every(c=>!c.elements.details.open));
el['.print-button'].fire('click');assert.equal(printed,1);
grades[0].fire('click');assert.equal(active,el['#catalog-title']);
// Browser URL survives a round trip with encoded Chinese and special characters.
input('分數 & 比例');const saved=location.hash;location.hash='#g4s2';window.fire('hashchange');location.hash=saved;window.fire('hashchange');assert.equal(el['#topic-search'].value,'分數 & 比例');
console.log('PASS: All 12 semester transitions, live counts, selected states, history Back/Forward, deep-link/filter restoration, invalid URL handling, category and subject intersections, normalized multiword search, language options, safe empty states, clear/reset, repeated selection, expand/collapse and print restoration.');
