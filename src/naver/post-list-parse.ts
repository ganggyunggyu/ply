import { parseLogNo } from './blog-id';
import { decodePostTitle } from './post-title';

export type ParsedPost = { logNo: string; title: string; addDate: string };
export type RecentPost = ParsedPost & { postUrl: string };

const sliceBalancedArray = (text: string, start: number): string | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth += 1;
    if (ch === ']') { depth -= 1; if (depth === 0) return text.slice(start, i + 1); }
  }

  return null;
};

/** 네이버가 pagingHtml 안 작은따옴표를 이스케이프해서 표준 JSON 이 아닐 때가 있다. */
const readPostListArray = (text: string): unknown[] => {
  try {
    const parsed = JSON.parse(text) as { postList?: unknown };
    if (Array.isArray(parsed.postList)) return parsed.postList;
  } catch {
    // 아래 괄호 균형 스캔으로 넘어간다
  }

  const keyAt = text.indexOf('"postList"');
  if (keyAt < 0) return [];
  const start = text.indexOf('[', keyAt);
  if (start < 0) return [];
  const slice = sliceBalancedArray(text, start);
  if (!slice) return [];

  try {
    return JSON.parse(slice) as unknown[];
  } catch {
    return [];
  }
};

export const parsePostListResponse = (raw: string): ParsedPost[] => {
  const cleaned = raw.replace(/\\'/g, "'");

  return readPostListArray(cleaned).flatMap((item) => {
    const row = item as { logNo?: unknown; title?: unknown; addDate?: unknown };
    const logNo = parseLogNo(row.logNo);
    if (!logNo) return [];

    return [{
      logNo,
      title: decodePostTitle(String(row.title ?? '')),
      addDate: String(row.addDate ?? ''),
    }];
  });
};
