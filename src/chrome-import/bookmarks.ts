import { existsSync, readFileSync } from 'fs';
import { bookmarksPath } from './paths';

export type ImportedBookmark = {
  name: string;
  url: string;
};

type BookmarkNode = {
  type?: string;
  name?: string;
  url?: string;
  children?: BookmarkNode[];
};

type BookmarksFile = {
  roots?: Record<string, BookmarkNode>;
};

/** 폴더 구조는 버리고 url 노드만 평평하게 뽑는다. javascript: 같은 스킴은 탭으로 못 여니 뺀다. */
const collectUrls = (node: BookmarkNode, out: ImportedBookmark[]) => {
  if (node.type === 'url' && node.url && /^https?:\/\//.test(node.url)) {
    out.push({ name: node.name?.trim() || node.url, url: node.url });
    return;
  }

  node.children?.forEach((child) => collectUrls(child, out));
};

/** 파싱만 하는 순수 함수. 파일 접근과 떼어 놔서 테스트가 쉽다. */
export const parseBookmarksJson = (raw: string): ImportedBookmark[] => {
  let parsed: BookmarksFile;
  try {
    parsed = JSON.parse(raw) as BookmarksFile;
  } catch {
    return [];
  }

  const out: ImportedBookmark[] = [];
  Object.values(parsed.roots ?? {}).forEach((root) => {
    if (root && typeof root === 'object') collectUrls(root, out);
  });

  return out;
};

export const readChromeBookmarks = (profileFolder: string): ImportedBookmark[] => {
  const path = bookmarksPath(profileFolder);
  if (!existsSync(path)) return [];

  try {
    return parseBookmarksJson(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
};
