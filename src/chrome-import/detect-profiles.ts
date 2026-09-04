import { existsSync, readFileSync } from 'fs';
import { localStatePath, profileDir } from './paths';

export type ChromeProfile = {
  /** "Default", "Profile 1" 같은 폴더명. 다른 chrome-import 함수들이 이걸로 파일 경로를 짠다. */
  folder: string;
  /** 크롬 설정 화면에 사람이 보던 이름. "Default" 폴더도 보통 실제 이메일/이름을 갖고 있다. */
  label: string;
};

type ProfileInfo = { name?: string; user_name?: string; gaia_name?: string };
type InfoCache = Record<string, ProfileInfo>;
type LocalState = { profile?: { info_cache?: InfoCache } };

const labelOf = (folder: string, cache: InfoCache) => {
  const entry = cache[folder];
  return entry?.gaia_name || entry?.name || entry?.user_name || folder;
};

/**
 * 프로필 폴더 자체가 없으면 목록에서 뺀다. Local State 의 info_cache 에는 등록돼 있지만
 * 실제로는 한 번도 안 켜서 폴더가 없는 프로필이 종종 있다.
 */
export const detectChromeProfiles = (): ChromeProfile[] => {
  if (!existsSync(localStatePath())) return [];

  let state: LocalState;
  try {
    state = JSON.parse(readFileSync(localStatePath(), 'utf-8')) as LocalState;
  } catch {
    return [];
  }

  const cache = state.profile?.info_cache ?? {};
  const folders = Object.keys(cache).length > 0 ? Object.keys(cache) : ['Default'];

  return folders
    .filter((folder) => existsSync(profileDir(folder)))
    .map((folder) => ({ folder, label: labelOf(folder, cache) }));
};
