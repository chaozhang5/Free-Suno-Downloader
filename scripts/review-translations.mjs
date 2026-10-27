import { readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile(new URL('../src/content/articles.json', import.meta.url), 'utf8'));
const bySlug = new Map(source.map((article) => [article.slug, article]));
const locales = ['id', 'es', 'pt-BR', 'ru', 'fr', 'vi'];
const vietnameseHeadings = {
  'suno-share-link-guide': { 2: 'Quy trình bàn giao đơn giản' },
  'suno-lyrics-structure-tags': { 2: 'Dùng đúng trường trong Suno' },
  'edit-suno-lyrics': { 0: 'Xác định vấn đề cụ thể' },
  'suno-style-prompt-examples': { 1: 'Bản nhạc điện tử giàu nhịp điệu' },
  'suno-exclude-styles': { 0: 'Xác định âm thanh không mong muốn' },
  'suno-download-credits-limits': { 2: 'Lên kế hoạch xuất tệp' },
};

for (const locale of locales) {
  const file = new URL(`../src/content/articles.${locale}.json`, import.meta.url);
  const articles = JSON.parse(await readFile(file, 'utf8'));
  for (const article of articles) {
    article.sources = bySlug.get(article.slug).sources;
    if (locale === 'id' && article.slug === 'suno-commercial-use') {
      article.faq[0].answer = 'Tidak. Menurut Suno, berlangganan di kemudian hari tidak otomatis memberi hak komersial secara retroaktif untuk lagu yang dibuat dengan paket gratis.';
    }
    if (locale === 'id' && article.slug === 'suno-download-credits-limits') {
      const answer = article.faq.find((item) => item.answer.startsWith('No Suno'));
      if (answer) answer.answer = 'Tidak. Menurut Suno, unduhan uji coba hanya untuk penggunaan pribadi dan nonkomersial, serta tidak memberikan hak penggunaan komersial.';
    }
    if (locale !== 'vi') continue;
    for (const [index, heading] of Object.entries(vietnameseHeadings[article.slug] ?? {})) article.sections[Number(index)].heading = heading;
    if (article.slug === 'suno-share-link-guide') {
      article.faq[1].question = 'Liên kết /s/ và /song/ có luôn hiển thị cùng những tệp không?';
      article.toolLabel = 'Thử với một liên kết bài hát công khai';
    }
    const revise = (value) => value.replaceAll('Mặt trời', 'Suno').replaceAll('mặt trời', 'Suno')
      .replaceAll('phơi bày', 'hiển thị').replaceAll('hải quan', 'tùy chỉnh');
    article.description = revise(article.description);
    article.intro = revise(article.intro);
    article.sections = article.sections.map((section) => ({ ...section, heading: revise(section.heading), paragraphs: section.paragraphs.map(revise) }));
    article.faq = article.faq.map((item) => ({ question: revise(item.question), answer: revise(item.answer) }));
    article.toolLabel = revise(article.toolLabel);
  }
  await writeFile(file, JSON.stringify(articles, null, 2) + '\n');
}
