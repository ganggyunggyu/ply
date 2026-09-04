import type { Page } from 'playwright-core';
import { connectBrowser, waitForPageByTabId } from '../naver';
import type { TabManager } from '../tabs';

/**
 * 작업용 탭 하나를 열고, 끝나면 반드시 닫는다.
 *
 * 로그인·발행·목록·삭제가 전부 같은 모양이라 여기로 묶었다. 안 닫으면 탭이 실행마다 쌓이고,
 * findPageByTabId 가 열린 페이지를 전부 훑기 때문에 탭 특정이 점점 느려진다.
 *
 * 놓는 순서가 중요하다. 페이지(CDP)를 먼저 놓고 탭을 닫는다. 반대로 하면 playwright 가
 * 이미 사라진 타깃을 잡고 있다가 던진다.
 *
 * keepTab 은 사람이 그 탭에서 뭔가를 끝내야 하는 경우에만 부른다(캡차·2차 인증).
 * 그때는 화면도 그 탭으로 옮긴다. 남기기만 하고 안 보여주면 사이드바를 뒤져 찾아야 하는데,
 * 캡차와 2차 인증은 시간 제한이 있어서 그 사이에 만료된다.
 * 에이전트 탭이 화면을 뺏지 않는다는 규칙(tab-focus.ts)의 유일한 예외다.
 */
export const createWithAgentTab = ({ tabManager, cdpPort }: { tabManager: TabManager; cdpPort: number }) => {
  const withAgentTab = async <T>(
    { url, profileId }: { url: string; profileId: string },
    run: (input: { page: Page; tabId: number; keepTab: () => void }) => Promise<T>,
  ): Promise<T> => {
    const tabId = tabManager.createTab({ url, profileId, openedByAgent: true });
    let keep = false;
    const keepTab = () => {
      keep = true;
    };

    try {
      const browser = await connectBrowser(cdpPort);

      try {
        const page = await waitForPageByTabId(browser, tabId);

        return await run({ page, tabId, keepTab });
      } finally {
        await browser.close();
      }
    } finally {
      if (keep) tabManager.selectTab(tabId);
      else tabManager.closeTab(tabId);
    }
  };

  return withAgentTab;
};
