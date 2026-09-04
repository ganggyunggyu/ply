import type { Frame, Page } from 'playwright-core';
import { ERRORS } from '../messages';
import { clickFirstAvailable } from './click-helpers';
import { sleep } from './browser-connect';

const TITLE_SELECTOR = '.se-documentTitle .se-text-paragraph';
const BODY_SELECTOR = '.se-component.se-text .se-text-paragraph';

const PUBLISH_OPEN_SELECTORS = [
  '[data-click-area="tpb.publish"]',
  'button[class*="publish_btn"]',
  '.publish_btn__m9KHH',
];

export const typeTitle = async (page: Page, frame: Frame, title: string) => {
  await frame.click(TITLE_SELECTOR);
  await page.keyboard.type(title, { delay: 12 });
};

export const typeBody = async (page: Page, frame: Frame, body: string) => {
  await frame.click(BODY_SELECTOR);

  const lines = body.split('\n');

  for (const [index, line] of lines.entries()) {
    if (line.trim()) await page.keyboard.type(line, { delay: 8 });
    if (index < lines.length - 1) await page.keyboard.press('Enter');
  }
};

export const openPublishDialog = async (page: Page, frame: Frame) => {
  const opened = (await clickFirstAvailable(frame, PUBLISH_OPEN_SELECTORS)) ||
    (await clickFirstAvailable(page, PUBLISH_OPEN_SELECTORS));

  if (!opened) throw new Error(ERRORS.publishButtonNotFound);

  await sleep(3000);
};
