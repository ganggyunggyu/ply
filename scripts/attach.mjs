import { chromium } from 'playwright-core';

const CDP_PORT = Number(process.env.PLY_CDP_PORT ?? 18830);

const main = async () => {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const [context] = browser.contexts();

  if (!context) throw new Error('Ply 컨텍스트를 찾지 못했습니다');

  const pages = context.pages().filter((page) => !page.url().startsWith('file://'));

  console.log(`열린 탭 ${pages.length}개`);
  for (const page of pages) {
    console.log(`- ${await page.title()} :: ${page.url()}`);
  }

  await browser.close();
};

await main();
