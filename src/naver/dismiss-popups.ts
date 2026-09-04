import type { Frame } from 'playwright-core';

const POPUP_SELECTORS = [
  '.se-popup-button-cancel',
  '.se-help-panel-close-button',
  '.se-popup-close-button',
  '.se-popup-button-close',
  'button[class*="popup_close"]',
];

export const dismissPopups = async (frame: Frame) => {
  for (const selector of POPUP_SELECTORS) {
    const locator = frame.locator(selector);

    try {
      const count = await locator.count();
      for (let index = 0; index < count; index += 1) {
        const item = locator.nth(index);
        if (await item.isVisible()) await item.click({ timeout: 2000 });
      }
    } catch {
      continue;
    }
  }
};
