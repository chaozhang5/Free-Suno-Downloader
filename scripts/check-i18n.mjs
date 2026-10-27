import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { localePrefixes, manifest } from './route-data.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const englishPath = new URL('../src/i18n/messages.en.json', import.meta.url);
const before = readFileSync(englishPath, 'utf8');
execFileSync(process.execPath, [new URL('./extract-messages.mjs', import.meta.url).pathname]);
assert.equal(readFileSync(englishPath, 'utf8'), before, 'Run extract-messages.mjs and translate newly extracted copy before shipping');
const source = read('src/i18n/messages.en.json');
const articles = read('src/content/articles.json');
const overrides = read('src/i18n/overrides.json');
assert.equal(Object.keys(localePrefixes).length, 18);
assert.deepEqual(new Set(manifest.indexableLocales), new Set(Object.keys(localePrefixes)));
const tokens = (value) => [...value.matchAll(/\{\w+\}/g)].map(([token]) => token).sort();
const check = (original, translated, location) => {
  assert.equal(typeof translated, 'string', `${location}: missing translation`);
  assert.ok(translated.trim(), `${location}: empty translation`);
  assert.doesNotMatch(translated, /ZXQ\s*\d+\s*QXZ|\uFFFD/, `${location}: invalid translation token`);
  assert.deepEqual(tokens(translated), tokens(original), `${location}: interpolation changed`);
  if (original.length > 100) assert.notEqual(translated, original, `${location}: English prose was left untranslated`);
};
for (const locale of Object.keys(localePrefixes).filter((code) => code !== 'en')) {
  const messages = { ...read(`src/i18n/messages.${locale}.json`), ...overrides[locale] };
  for (const [key, value] of Object.entries(source)) check(value, messages[key], `${locale}/${key}`);
  const translated = read(`src/content/articles.${locale}.json`);
  if (locale === 'zh-CN') {
    // Guard against known literal translations of music terminology. Coverage
    // alone cannot catch a complete but misleading translation.
    const incorrectTerms = /阀杆|词干|主干|发电机|发生器|制作人员名单|音频工件|一代人|下一代教|记录字符|交付速度|合唱团|桥梁改变|仪器仪表|音乐盒口音|有机动力学|剥离桥|切分音槽|招标/;
    const incorrectTerm = JSON.stringify({ messages, articles: translated }).match(incorrectTerms)?.[0];
    assert.equal(incorrectTerm, undefined,
      'Chinese copy contains a known mistranslation of a music term');
  }
  assert.deepEqual(translated.map(({ slug }) => slug), articles.map(({ slug }) => slug));
  for (const [index, article] of articles.entries()) {
    const copy = translated[index];
    const location = `${locale}/${article.slug}`;
    for (const key of ['title', 'description', 'intro', 'toolLabel']) check(article[key], copy[key], `${location}/${key}`);
    assert.equal(copy.category, article.category, `${location}: category lookup key changed`);
    assert.deepEqual(copy.related, article.related, `${location}: related slugs changed`);
    assert.equal(copy.sections.length, article.sections.length, `${location}: missing section`);
    article.sections.forEach((section, i) => {
      check(section.heading, copy.sections[i].heading, `${location}/section ${i}`);
      assert.equal(copy.sections[i].paragraphs.length, section.paragraphs.length, `${location}: missing paragraph`);
      section.paragraphs.forEach((text, j) => check(text, copy.sections[i].paragraphs[j], `${location}/${i}/${j}`));
    });
    assert.equal(copy.faq.length, article.faq.length, `${location}: missing FAQ`);
    article.faq.forEach((faq, i) => {
      for (const key of ['question', 'answer']) check(faq[key], copy.faq[i][key], `${location}/faq ${i}/${key}`);
    });
    assert.deepEqual(copy.sources.map(({ url }) => url), article.sources.map(({ url }) => url), `${location}: source URLs changed`);
    article.sources.forEach((item, i) => check(item.label, copy.sources[i].label, `${location}/source ${i}`));
  }
  console.log(`${locale}: ${Object.keys(source).length} UI messages and ${articles.length} complete articles checked`);
}
