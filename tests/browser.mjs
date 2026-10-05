// Requires Playwright and a supported Chromium runtime; not part of dependency-free npm test.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,`.${p==='/'?'/index.html':p}`);if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const url=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}`;
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url);await page.waitForSelector('.js-ready');
 const visible=selector=>page.locator(`${selector}:visible`);
 assert.equal(await visible('.course-card').count(),6);assert.match(await page.locator('#result-count').textContent(),/95 個主題/);
 for(let grade=1;grade<=6;grade++)for(let semester=1;semester<=2;semester++){
  await page.locator(`[data-grade="${grade}"].grade-button`).click();await page.locator(`[data-semester="${semester}"].semester-button`).click();
  assert.equal(await visible('.semester-panel').count(),1);assert.equal(await visible('.course-card').count(),grade<=2?6:10);
  assert.equal(await visible('.semester-panel').getAttribute('id'),`g${grade}s${semester}`);
 }
 await page.locator('.grade-button[data-grade="2"]').click();await page.goBack();assert.equal(await visible('.semester-panel').getAttribute('id'),'g6s2');await page.goForward();assert.equal(await visible('.semester-panel').getAttribute('id'),'g2s2');
 await page.goto(`${url}#g5s1?subject=mathematics`);assert.equal(await visible('.course-card').count(),1);assert.equal(await page.locator('#subject-filter').inputValue(),'mathematics');
 await page.reload();assert.equal(await visible('.semester-panel').getAttribute('id'),'g5s1');assert.equal(await visible('.course-card').count(),1);
 await page.goto(`${url}#g1s1`);await page.locator('[data-filter="national"]').click();assert.equal(await visible('.course-card').count(),5);
 await page.locator('[data-filter="school"]').click();assert.equal(await visible('.course-card').count(),1);assert.match(await page.locator('#result-count').textContent(),/10 個主題/);
 await page.locator('[data-filter="all"]').click();await page.locator('#topic-search').fill('口腔');assert.equal(await visible('.course-card').count(),1);assert.equal(await visible('.topic-list li').count(),1);
 await page.locator('#topic-search').fill('１０以內');assert.equal(await visible('.course-card').getAttribute('data-course'),'mathematics');
 await page.locator('#topic-search').fill('閩南');assert.equal(await visible('.course-card').getAttribute('data-course'),'language-choice');
 await page.locator('#topic-search').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('.empty-state img').count(),0);assert.equal(await visible('.course-card').count(),0);
 await page.locator('.reset-button').click();assert.equal(await visible('.course-card').count(),6);assert.equal(await page.locator('#topic-search').evaluate(e=>document.activeElement===e),true);
 await page.locator('#subject-filter').selectOption('mathematics');assert.equal(await visible('.course-card').count(),1);await page.locator('[data-filter="school"]').click();assert.equal(await visible('.course-card').count(),0);await page.locator('.reset-button').click();
 await page.locator('.expand-all').click();assert.equal(await visible('.course-details[open]').count(),6);assert.equal(await visible('.topic-list li').count(),95);
 await page.locator('.expand-all').click();assert.equal(await visible('.course-details[open]').count(),0);
 const summary=visible('.course-details summary').first();await summary.focus();await page.keyboard.press('Enter');assert.equal(await visible('.course-details[open]').count(),1);await page.keyboard.press('Space');assert.equal(await visible('.course-details[open]').count(),0);
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await visible('.course-details[open]').count(),6);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await visible('.course-details[open]').count(),0);
 await page.locator('.grade-button[data-grade="1"]').click();assert.equal(await page.locator('#catalog-title').evaluate(e=>e===document.activeElement),true);
 await mkdir(path.join(root,'review'),{recursive:true});
 for(const width of [333,390,768,1280]){
  await page.setViewportSize({width,height:900});await page.goto(`${url}#g6s2`);await page.waitForSelector('.js-ready');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}`);
  const bounds=await visible('.course-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{left:r.left,right:r.right};}));assert.ok(bounds.every(r=>r.left>=0&&r.right<=width));
  if(width===333||width===1280)await page.screenshot({path:path.join(root,'review',`curriculum-${width}.png`),fullPage:true});
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:333,height:844}});const nojs=await context.newPage();await nojs.goto(url);
 assert.equal(await nojs.locator('.semester-panel:visible').count(),12);assert.equal(await nojs.locator('.course-card').count(),104);assert.equal(await nojs.locator('.search:visible').count(),0);assert.equal(await nojs.locator('.no-script nav a').count(),12);
 await nojs.locator('#g6s2 .course-details summary').first().click();assert.equal(await nojs.locator('#g6s2 .course-details[open]').count(),1);
 assert.ok(await nojs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();assert.deepEqual(errors,[]);
 console.log('PASS: actual-browser 12-semester navigation, Back/Forward, shareable URL and reload, subject/category/search intersections, keyboard, print restore, 333/390/768/1280px layout, reduced motion and all-semester no-JS fallback.');
}finally{if(browser)await browser.close();server.close();}
