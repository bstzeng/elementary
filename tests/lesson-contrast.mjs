// Targeted source cascade/contrast model, not an actual browser test.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const css=await readFile(path.join(root,'lesson.css'),'utf8');
const base=await readFile(path.join(root,'styles.css'),'utf8');
const green=base.match(/--green\s*:\s*(#[0-9a-f]{6})/i)?.[1];
assert.ok(green,'Shared green color is explicit');
const targetSelectors=new Map([
 ['.lesson-page button',{specificity:[0,1,1],hover:false}],
 ['.lesson-page button:hover',{specificity:[0,2,1],hover:true}],
 ['.question-actions .check-answer',{specificity:[0,2,0],hover:false}],
 ['.question-actions .check-answer:hover',{specificity:[0,3,0],hover:true}]
]);
const rules=[];
for(const match of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
 for(const raw of match[1].split(',')){
  const selector=raw.trim(),info=targetSelectors.get(selector);
  if(!info)continue;
  const declarations=Object.fromEntries(match[2].split(';').filter(x=>x.includes(':')).map(x=>{const i=x.indexOf(':');return[x.slice(0,i).trim(),x.slice(i+1).trim()];}));
  rules.push({selector,...info,declarations,index:rules.length});
 }
}
for(const selector of targetSelectors.keys())assert.ok(rules.some(r=>r.selector===selector),`Required cascade rule: ${selector}`);
const greater=(a,b)=>a.some((v,i)=>v>b[i]&&a.slice(0,i).every((x,j)=>x===b[j]));
function appearance(hover,primary=true){
 const winners={};
 for(const rule of rules){
  if(rule.hover&&!hover)continue;
  if(!primary&&rule.selector.includes('.check-answer'))continue;
  for(const [property,value] of Object.entries(rule.declarations)){
   const prior=winners[property];
   if(!prior||greater(rule.specificity,prior.specificity)||rule.specificity.every((v,i)=>v===prior.specificity[i]))winners[property]={...rule,value};
  }
 }
 const resolve=v=>v==='var(--green)'?green:v==='white'?'#ffffff':v;
 return {background:resolve(winners.background.value),color:resolve(winners.color.value),backgroundRule:winners.background.selector};
}
function luminance(hex){
 assert.match(hex,/^#[0-9a-f]{6}$/i);
 const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
const contrast=(a,b)=>{const [light,dark]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(light+.05)/(dark+.05);};
const normal=appearance(false),hover=appearance(true);
assert.equal(hover.backgroundRule,'.question-actions .check-answer:hover','Primary hover must outrank generic lesson hover');
assert.equal(normal.color,'#ffffff');assert.equal(hover.color,'#ffffff');
assert.ok(contrast(normal.color,normal.background)>=4.5,'Normal answer-button label contrast >= 4.5:1');
assert.ok(contrast(hover.color,hover.background)>=4.5,'Hovered/touch-stuck answer-button label contrast >= 4.5:1');
const ordinary=appearance(true,false);
assert.equal(ordinary.background,'#edf4e8','Ordinary button hover remains unchanged');
assert.ok(contrast(ordinary.color,ordinary.background)>=4.5,'Ordinary hover label remains legible');
assert.ok(/button:focus-visible/.test(base),'Shared keyboard focus selector retained');
console.log(`PASS: Answer button source-cascade label contrast ${contrast(normal.color,normal.background).toFixed(2)}:1 normal and ${contrast(hover.color,hover.background).toFixed(2)}:1 hover; generic hover unchanged, focus selector retained. Source model only, not browser rendering.`);
