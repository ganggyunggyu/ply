import type { Frame, Page } from 'playwright-core';
import { ERRORS } from '../messages';

/** clickFirstAvailable 과 다르다. 정확히 하나일 때만 누른다. 여러 개면 던진다. */
export const clickExactlyOne = async (
  scope: Page | Frame,
  selectors: string[],
  timeout = 5000,
): Promise<boolean> => {
  for (const selector of selectors) {
    const locator = scope.locator(selector);
    let count = 0;

    try {
      count = await locator.count();
    } catch {
      continue;
    }

    if (count === 0) continue;
    if (count > 1) throw new Error(ERRORS.deleteAmbiguousTarget);

    try {
      if (await locator.first().isVisible({ timeout })) {
        await locator.first().click();
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

export const clickFirstAvailable = async (
  scope: Page | Frame,
  selectors: string[],
  timeout = 5000,
): Promise<boolean> => {
  for (const selector of selectors) {
    try {
      const locator = scope.locator(selector).first();
      if (await locator.isVisible({ timeout })) {
        await locator.click();
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};
