import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ERRORS } from './messages';

export type Profile = {
  id: string;
  label: string;
};

const CONFIG_DIR = join(homedir(), '.gng-browser');
const PROFILE_FILE = join(CONFIG_DIR, 'profiles.json');
const DEFAULT_PROFILES: Profile[] = [{ id: 'default', label: '기본' }];

export const partitionOf = (profileId: string) => `persist:${profileId}`;

const readProfiles = (): Profile[] => {
  if (!existsSync(PROFILE_FILE)) return DEFAULT_PROFILES;

  try {
    const parsed = JSON.parse(readFileSync(PROFILE_FILE, 'utf-8')) as Profile[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES;
  } catch (error) {
    console.error(ERRORS.profilesFileUnreadable, error);
    return DEFAULT_PROFILES;
  }
};

const writeProfiles = (profiles: Profile[]) => {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(PROFILE_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
};

const slugify = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile';

export const listProfiles = () => readProfiles();

export const addProfile = (label: string) => {
  const profiles = readProfiles();
  const base = slugify(label);
  const taken = new Set(profiles.map(({ id }) => id));

  let id = base;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  const created: Profile = { id, label: label.trim() || id };
  writeProfiles([...profiles, created]);

  return created;
};

export const removeProfile = (profileId: string) => {
  if (profileId === 'default') return listProfiles();

  const remaining = readProfiles().filter(({ id }) => id !== profileId);
  writeProfiles(remaining.length > 0 ? remaining : DEFAULT_PROFILES);

  return listProfiles();
};
