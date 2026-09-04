import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { ImportedVisit } from '../chrome-import/history';

export type StoredVisit = {
  url: string;
  title: string;
  visitCount: number;
  lastVisit: number;
};

/**
 * 저장 상한. 여러 프로필을 합쳐도 이 선을 넘기지 않는다. 방문기록은 검색으로 쓰는 것이라
 * 무한정 쌓을 이유가 없고, 파일이 커지면 로드가 느려진다.
 */
const MAX_STORED = 5000;

/** url 로 중복 제거하되 방문 시각이 더 최근인 쪽을 남긴다. 그리고 최근순으로 잘라 상한을 지킨다. */
const mergeVisits = (existing: StoredVisit[], incoming: ImportedVisit[]): StoredVisit[] => {
  const byUrl = new Map<string, StoredVisit>();

  [...existing, ...incoming].forEach((visit) => {
    const prev = byUrl.get(visit.url);
    if (!prev || visit.lastVisit > prev.lastVisit) byUrl.set(visit.url, visit);
  });

  return [...byUrl.values()].sort((a, b) => b.lastVisit - a.lastVisit).slice(0, MAX_STORED);
};

export const createHistoryStore = ({ filePath }: { filePath: string }) => {
  const read = (): StoredVisit[] => {
    if (!existsSync(filePath)) return [];
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredVisit[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const write = (visits: StoredVisit[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(visits, null, 2), 'utf-8');
  };

  const list = () => read();

  /** 가져온 방문기록을 기존 것과 합친다. 합친 뒤 늘어난 건수를 돌려준다. */
  const merge = (incoming: ImportedVisit[]): number => {
    const existing = read();
    const combined = mergeVisits(existing, incoming);
    write(combined);
    return Math.max(0, combined.length - existing.length);
  };

  return { list, merge };
};

export type HistoryStore = ReturnType<typeof createHistoryStore>;
