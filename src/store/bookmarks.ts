import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { ImportedBookmark } from '../chrome-import/bookmarks';

export type StoredBookmark = {
  name: string;
  url: string;
};

/** url 로 중복을 없앤다. 여러 크롬 프로필을 가져오면 같은 북마크가 겹칠 수 있다. */
const dedupeByUrl = (bookmarks: StoredBookmark[]): StoredBookmark[] => {
  const seen = new Set<string>();
  return bookmarks.filter(({ url }) => (seen.has(url) ? false : (seen.add(url), true)));
};

export const createBookmarkStore = ({ filePath }: { filePath: string }) => {
  const read = (): StoredBookmark[] => {
    if (!existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredBookmark[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const write = (bookmarks: StoredBookmark[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(bookmarks, null, 2), 'utf-8');
  };

  const list = () => read();

  /** 가져온 북마크를 기존 것과 합친다. 새로 추가된 수를 돌려준다. */
  const merge = (incoming: ImportedBookmark[]): number => {
    const existing = read();
    const combined = dedupeByUrl([...existing, ...incoming]);
    write(combined);
    return combined.length - existing.length;
  };

  return { list, merge };
};

export type BookmarkStore = ReturnType<typeof createBookmarkStore>;
