// DOM-model tests exercise app.js without third-party packages or a browser.
// These complement real-browser QA; they do not assert visual rendering.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(root, 'curriculum.json'), 'utf8'));
let active = null;
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('zh-TW');
class Element {
  constructor(dataset={}) { this.dataset=dataset; this.hidden=false; this.open=false; this.value=''; this.textContent=''; this.events={}; this.attributes={}; }
  addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
  fire(name) { for (const fn of this.events[name] || []) fn({preventDefault(){}}); }
  setAttribute(name, value) { this.attributes[name]=value; }
  focus() { active=this; }
  scrollIntoView() {}
}
const cards=data.courses.map(c=>{
  const card=new Element({category:c.id==='flexible'?'school':'national',courseSearch:normalize([c.title,c.shortTitle||c.title,c.classification,c.category,...(c.languageOptions||[])].join(' '))});
  card.topics=c.topics.map(t=>new Element({topicSearch:normalize(`${t.title} ${t.group||''}`)}));
  card.elements={'details':new Element(),'.summary-label':new Element(),'.topic-preview':new Element()};
  card.querySelector=s=>card.elements[s];
  card.querySelectorAll=s=>s==='.topic-list li'?card.topics:[];
  return card;
});
const selectors=['#topic-search','.search','.search-clear','#result-count','.empty-state','#empty-message','.expand-all','.reset-button','#courses','#catalog-title'];
const elements=Object.fromEntries(selectors.map(s=>[s,new Element()]));
const filters=['all','national','school'].map(filter=>new Element({filter}));
const current=[new Element(),new Element()];
const document={
  querySelector:s=>elements[s],
  querySelectorAll:s=>s==='.course-card'?cards:s==='.filter'?filters:s==='details'?cards.map(c=>c.elements.details):s==='.grade-panel [aria-current="true"]'?current:[],
  documentElement:{classList:{add(){}}}
};
const window=new Element();
vm.runInNewContext(await readFile(path.join(root,'app.js'),'utf8'),{document,window,matchMedia:()=>({matches:true})});
const search=elements['#topic-search'];
const visible=()=>cards.filter(c=>!c.hidden);
const count=()=>elements['#result-count'].textContent;
const input=value=>{search.value=value;search.fire('input');};
assert.equal(visible().length,6); assert.equal(count(),'6 類課程 · 95 個主題');
filters[1].fire('click'); assert.equal(visible().length,5); assert.ok(count().includes('85 個主題'));
filters[2].fire('click'); assert.equal(visible().length,1); assert.ok(count().includes('10 個主題'));
filters[0].fire('click'); input('口腔'); assert.equal(visible().length,1); assert.equal(count(),'1 類課程 · 1 個符合主題'); assert.equal(visible()[0].elements.details.open,true);
input('１０以內'); assert.equal(visible().length,1); assert.ok(visible()[0].dataset.courseSearch.includes('數學'));
input('10 數量'); assert.equal(visible().length,1);
input('閩南'); assert.equal(visible().length,1); assert.equal(count(),'1 類課程 · 10 個符合主題');
input('不存在的主題'); assert.equal(visible().length,0); assert.equal(elements['.empty-state'].hidden,false);
elements['.reset-button'].fire('click'); assert.equal(visible().length,6); assert.equal(search.value,''); assert.equal(active,search);
input('<img src=x onerror=alert(1)>'); assert.ok(elements['#empty-message'].textContent.includes('<img src=x'));
elements['.search-clear'].fire('click'); assert.equal(search.value,''); assert.equal(visible().length,6);
elements['.expand-all'].fire('click'); assert.equal(cards.filter(c=>c.elements.details.open).length,6);
elements['.expand-all'].fire('click'); assert.equal(cards.filter(c=>c.elements.details.open).length,0);
window.fire('beforeprint'); assert.equal(cards.filter(c=>c.elements.details.open).length,6);
window.fire('afterprint'); assert.equal(cards.filter(c=>c.elements.details.open).length,0);
current[0].fire('click'); assert.equal(active,elements['#catalog-title']);
assert.equal(elements['#catalog-title'].attributes.tabindex,'-1');
console.log('PASS: DOM-model interaction checks for filtering, counts, search, multiword/NFKC normalization, language options, empty/reset states, text-safe messages, expand/collapse, print restoration, and focus behavior. Visual browser checks remain separate.');
