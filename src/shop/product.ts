import type { Page } from 'playwright-core';
import type { ShopStepResult } from './agree';
import { productUrl } from './urls';
import { BUY_SUBMIT } from './selectors';

/** 상품 상세로 이동한다. productNo 는 상품 번호다. */
export const visitProduct = async (page: Page, baseUrl: string, productNo: string | number): Promise<ShopStepResult> => {
  try {
    await page.goto(productUrl(baseUrl, productNo), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    return { ok: true, detail: `상품 ${productNo} 로 이동` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
};

/**
 * 상품 상세에서 '구매하기' 를 누른다. 버튼은 onclick 으로 product_submit 을 부르는 a 태그라 직접 클릭
 * 대신 그 요소를 눌러 준다. 주문/장바구니 페이지로 넘어갔는지로 성공을 판정한다.
 */
export const clickBuy = async (page: Page): Promise<ShopStepResult> => {
  try {
    await page.evaluate((selector) => {
      const btn = document.querySelector<HTMLElement>(selector);
      if (btn) btn.click();
    }, BUY_SUBMIT);
    await page.waitForTimeout(3000);

    const url = page.url();
    const onOrder = url.includes('/order/') || url.includes('/basket/');
    return onOrder ? { ok: true, detail: '주문 단계로 이동' } : { ok: false, detail: `주문 페이지 미도달: ${url}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
};
