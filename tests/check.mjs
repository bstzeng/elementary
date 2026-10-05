import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');
const data = JSON.parse(await read('curriculum.json'));
const html = await read('index.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const topics = data.courses.flatMap(c => c.topics);
const expectedCourses = ['mandarin', 'mathematics', 'life', 'health-pe', 'language-choice', 'flexible'];
assert.deepEqual(data.courses.map(c => c.id), expectedCourses, 'Expected first-grade curriculum structure');
assert.equal(data.meta.grade, 1); assert.equal(data.meta.semester, 1);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs are unique');
assert.equal(new Set(topics.map(t => t.id)).size, topics.length, 'Topic IDs are unique');
assert.equal((html.match(/data-topic-search=/g) || []).length, topics.length, 'All topics are statically rendered');
assert.equal((html.match(/class="course-card"/g) || []).length, 6);
assert.equal((html.match(/data-category="national"/g) || []).length, 5);
assert.equal((html.match(/data-category="school"/g) || []).length, 1);
assert.equal((html.match(/class="grade-button"[^>]* disabled/g) || []).length, 5);
assert.ok(html.includes('上學期 · 規劃中') === false);
assert.ok(html.includes('下學期 · 規劃中'));
assert.ok(html.includes('不是全國統一的上學期課本目錄'));
assert.ok(html.includes('英語不是全國部定必修科目'));
assert.ok(html.includes('語別擇一'));
assert.ok(html.includes('尚未提供教學內容'));
assert.ok(html.includes('aria-live="polite"'));
assert.ok(html.includes('<html lang="zh-Hant">'));
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.equal((html.match(/<main\b/g) || []).length, 1);
for (const course of data.courses) {
  assert.equal(new Set(course.topics.map(t => t.title)).size, course.topics.length, `Duplicate titles: ${course.id}`);
  for (const sourceId of course.sourceIds) assert.ok(data.sources.some(s => s.id === sourceId), `Missing source: ${sourceId}`);
  for (const topic of course.topics) assert.ok(ids.includes(topic.id));
}
for (const source of data.sources) {
  const url = new URL(source.url);
  assert.equal(url.protocol, 'https:');
  assert.ok(/\.(edu|gov)\.tw$/.test(url.hostname), `Expected public Taiwan source: ${url.hostname}`);
}
for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (link.startsWith('#')) assert.ok(ids.includes(link.slice(1)), `Missing anchor: ${link}`);
  else if (link.startsWith('./') && link !== './') await access(path.join(root, link.slice(2)));
  else if (link !== './') assert.ok(link.startsWith('https://'), `Unsafe or root-relative link: ${link}`);
}
for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.ok(match[0].includes('rel="noopener noreferrer"'));
assert.ok(!/<iframe|<form[^>]+action=|http:\/\/|eval\(|localStorage|sessionStorage/.test(html));
execFileSync(process.execPath, ['--check', path.join(root, 'app.js')]);
execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')]);
assert.equal(await read('index.html'), html, 'Committed HTML must match deterministic build');
console.log(`PASS: 6 course cards, ${topics.length} topics, ${data.sources.length} source references, unique IDs, safe links, future-grade disabled states, curriculum caveats, complete static fallback, script syntax, deterministic build.`);
