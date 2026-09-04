import type { Page, Frame } from 'playwright-core';
import type { ShopStepResult } from './agree';
import { ORDER_ZIP_SEARCH, ORDER_ADDR2, ORDER_BANK, ORDER_BANK_OPTION, ORDER_NAME, ORDER_PAYMENT, POSTCODE_HOSTS, POSTCODE_INPUT, POSTCODE_RESULT } from './selectors';

export type OrderInput = {
  depositorName: string;
  address: string;
  detailAddress?: string;
  /** 결제까지 실제로 누를지. 기본은 false — 주문서만 채우고 멈춘다. 돈이 나가는 단계라 명시할 때만 누른다. */
  clickPayment?: boolean;
};

const findPostcodeFrame = async (page: Page): Promise<Frame | null> => {
  for (let i = 0; i < 15; i += 1) {
    const frame = page.frames().find((f) => POSTCODE_HOSTS.some((host) => f.url().includes(host)));
    if (frame) return frame;
    await page.waitForTimeout(1000);
  }
  return null;
};

const fillAddress = async (page: Page, address: string, detailAddress: string) => {
  await page.click(ORDER_ZIP_SEARCH);
  await page.waitForTimeout(2000);

  const frame = await findPostcodeFrame(page);
  if (!frame) throw new Error('우편번호 iframe(카카오/다음)을 찾지 못했다');

  const input = await frame.waitForSelector(POSTCODE_INPUT, { timeout: 10_000 });
  await input.click({ force: true });
  await input.fill(address);
  await input.press('Enter');
  await page.waitForTimeout(3000);

  const result = await frame.$(POSTCODE_RESULT);
  if (!result) throw new Error('주소 검색 결과가 없다');
  await result.click();
  await page.waitForTimeout(2500);

  const addr2 = await page.$(ORDER_ADDR2);
  if (addr2 && (await addr2.isVisible())) await addr2.fill(detailAddress);
};

/** 무통장 은행 옵션을 고른다. 기업은행이 있으면 그걸, 없으면 첫 유효 옵션을 쓴다. */
const selectBank = async (page: Page) => {
  const options = await page.$$eval(ORDER_BANK_OPTION, (opts) =>
    opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent?.trim() ?? '' })),
  );
  const pick = options.find((o) => o.value !== '-1' && o.text.includes('기업은행')) ?? options.find((o) => o.value !== '-1');
  if (!pick) throw new Error('선택 가능한 은행 옵션이 없다');
  await page.selectOption(ORDER_BANK, pick.value);
};

/** 주문서를 채운다. clickPayment 를 켜지 않는 한 결제 버튼은 누르지 않는다. */
export const placeOrder = async (page: Page, input: OrderInput): Promise<ShopStepResult> => {
  try {
    await fillAddress(page, input.address, input.detailAddress ?? '');
    await selectBank(page);
    await page.fill(ORDER_NAME, input.depositorName).catch(() => {});

    if (!input.clickPayment) return { ok: true, detail: '주문서 작성 완료(결제는 누르지 않음)' };

    await page.click(ORDER_PAYMENT);
    await page.waitForTimeout(3000);
    return { ok: true, detail: '주문 완료' };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
};
