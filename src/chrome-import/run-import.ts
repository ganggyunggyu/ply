import type { Session } from 'electron';
import type { ChromeImportSelection, ChromeImportResult } from '../bridge';
import type { BookmarkStore } from '../store/bookmarks';
import type { HistoryStore } from '../store/history';
import { readChromeBookmarks } from './bookmarks';
import { readChromeHistory } from './history';
import { readChromeCookies } from './cookies';
import { injectCookies } from './inject-cookies';
import { isSupportedPlatform } from './paths';

export type ImportDeps = {
  bookmarkStore: BookmarkStore;
  historyStore: HistoryStore;
  getSession: (profileId: string) => Session;
};

/**
 * 선택한 세 종류를 각각 독립으로 처리한다. 하나가 실패해도(쿠키 키체인 거부 등) 나머지는 계속
 * 간다. 실패는 errors 에 담아 사용자에게 그대로 보인다 — 조용히 0건으로 넘기지 않는다.
 */
export const runChromeImport = async (
  selection: ChromeImportSelection,
  deps: ImportDeps,
): Promise<ChromeImportResult> => {
  const result: ChromeImportResult = {
    cookiesSet: 0,
    cookiesSkipped: 0,
    bookmarksAdded: 0,
    historyAdded: 0,
    errors: [],
  };

  if (!isSupportedPlatform()) {
    result.errors.push('크롬 가져오기는 지금 macOS 에서만 됩니다');
    return result;
  }

  const { profileFolder, targetProfileId, cookies, bookmarks, history } = selection;

  if (bookmarks) {
    try {
      result.bookmarksAdded = deps.bookmarkStore.merge(readChromeBookmarks(profileFolder));
    } catch (error) {
      result.errors.push(`북마크: ${(error as Error).message}`);
    }
  }

  if (history) {
    try {
      result.historyAdded = deps.historyStore.merge(await readChromeHistory(profileFolder));
    } catch (error) {
      result.errors.push(`방문기록: ${(error as Error).message}`);
    }
  }

  if (cookies) {
    try {
      const { cookies: read, skipped } = await readChromeCookies(profileFolder);
      const injected = await injectCookies(deps.getSession(targetProfileId), read);
      result.cookiesSet = injected.set;
      result.cookiesSkipped = skipped + injected.failed;
    } catch (error) {
      result.errors.push(`쿠키: ${(error as Error).message}`);
    }
  }

  return result;
};
