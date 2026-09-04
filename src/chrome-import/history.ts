import { historyPath } from './paths';
import { withCopiedDb } from './sqlite';
import { webkitToUnixMs } from './webkit-time';

export type ImportedVisit = {
  url: string;
  title: string;
  visitCount: number;
  /** Unix epoch ms. 0 이면 방문 시각 기록이 없는 항목. */
  lastVisit: number;
};

/**
 * 최근 방문순 상한. 무제한으로 긁으면 저장 파일이 수십 MB로 불어나고 사이드바 렌더도 못 버틴다.
 * 5000건이면 검색으로 원하는 걸 찾기에 충분하고 파일도 몇 MB 안에 든다.
 */
const MAX_VISITS = 5000;

export const readChromeHistory = (profileFolder: string): Promise<ImportedVisit[]> =>
  withCopiedDb(historyPath(profileFolder), (db) => {
    const result = db.exec(
      `SELECT url, title, visit_count, last_visit_time
       FROM urls
       WHERE url LIKE 'http%'
       ORDER BY last_visit_time DESC
       LIMIT ${MAX_VISITS}`,
    );

    const rows = result[0]?.values ?? [];

    return rows.map((row) => {
      const [url, title, visitCount, lastVisitTime] = row;

      return {
        url: String(url ?? ''),
        title: String(title ?? ''),
        visitCount: Number(visitCount ?? 0),
        lastVisit: webkitToUnixMs(Number(lastVisitTime ?? 0)),
      };
    });
  });
