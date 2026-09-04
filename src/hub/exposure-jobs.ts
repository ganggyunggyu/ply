import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SCRIPT_NAME_PATTERN } from './pnpm';

export type ExposureJob = {
  key: string;
  label: string;
  script: string;
  description: string;
};

export const EXPOSURE_SCRIPT_PREFIX = 'exposure:';

/**
 * 라벨만 알고 있는 것에 붙인다. 목록 자체가 아니다.
 * 노출체크 저장소는 이 저장소에 들어 있지 않고 사람마다 스크립트가 다르므로,
 * 실행 가능한 작업을 여기에 박아 두면 그쪽에서 이름을 바꾼 순간 조용히 실패한다.
 */
const EXPOSURE_JOB_LABELS: Record<string, { label: string; description: string }> = {
  package: { label: '패키지 시트', description: '패키지 상품 키워드 노출체크' },
  general: { label: '일반 시트', description: '일반 업체 키워드 노출체크' },
  pet: { label: '반려동물', description: '반려동물 시트 노출체크' },
  cafe: { label: '카페', description: '카페 노출체크' },
  root: { label: '루트', description: '루트 시트 빠른 노출체크' },
  suite: { label: '전체', description: '전체 시트 노출체크 스위트' },
};

export const toExposureJob = (script: string): ExposureJob => {
  const key = script.slice(EXPOSURE_SCRIPT_PREFIX.length);
  const known = EXPOSURE_JOB_LABELS[key];

  return {
    key,
    label: known?.label ?? key,
    script,
    description: known?.description ?? `${key} 노출체크`,
  };
};

/** 실행 가능한 목록은 저장소의 package.json 에서 읽는다. 경로가 없거나 못 읽으면 빈 배열. */
export const listExposureJobs = (exposureBotDir: string): ExposureJob[] => {
  if (!exposureBotDir) return [];

  const manifest = join(exposureBotDir, 'package.json');
  if (!existsSync(manifest)) return [];

  try {
    const { scripts } = JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: Record<string, string> };

    return Object.keys(scripts ?? {})
      .filter((name) => name.startsWith(EXPOSURE_SCRIPT_PREFIX) && SCRIPT_NAME_PATTERN.test(name))
      .sort()
      .map(toExposureJob);
  } catch {
    return [];
  }
};

export const findExposureJob = (exposureBotDir: string, key: string): ExposureJob | null => {
  const needle = key.trim().toLowerCase();
  if (!needle) return null;

  const jobs = listExposureJobs(exposureBotDir);

  return (
    jobs.find((job) => job.key.toLowerCase() === needle) ??
    jobs.find((job) => job.script.toLowerCase() === needle) ??
    null
  );
};
