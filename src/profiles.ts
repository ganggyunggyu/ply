import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ERRORS } from './messages';

export type Profile = {
  id: string;
  label: string;
};

const DEFAULT_PROFILES: Profile[] = [{ id: 'default', label: '일반 브라우징' }];

export const partitionOf = (profileId: string) => `persist:${profileId}`;

export const createProfileStore = ({ filePath }: { filePath: string }) => {
  const readProfiles = (): Profile[] => {
    if (!existsSync(filePath)) return DEFAULT_PROFILES;

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Profile[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES;
    } catch (error) {
      console.error(ERRORS.profilesFileUnreadable, error);
      return DEFAULT_PROFILES;
    }
  };

  const writeProfiles = (profiles: Profile[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(profiles, null, 2), 'utf-8');
  };

  const slugify = (label: string) =>
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile';

  const list = () => readProfiles();

  const add = (label: string) => {
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

  const remove = (profileId: string) => {
    if (profileId === 'default') return list();

    const remaining = readProfiles().filter(({ id }) => id !== profileId);
    writeProfiles(remaining.length > 0 ? remaining : DEFAULT_PROFILES);

    return list();
  };

  return { list, add, remove };
};
