import { constants as fsConstants, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export const LEGACY_CONFIG_FILES = [
  'settings.json',
  'accounts.json',
  'profiles.json',
  'services.json',
] as const;

type LegacyConfigFile = (typeof LEGACY_CONFIG_FILES)[number];

type ConfigMigrationOptions = {
  sourceDir: string;
  targetDir: string;
  fallbackSources?: Partial<Record<LegacyConfigFile, string>>;
};

const isFile = (filePath: string) => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const isEmptyDirectory = (dirPath: string) =>
  !existsSync(dirPath) || readdirSync(dirPath).length === 0;

const sourcePathFor = (
  sourceDir: string,
  fileName: LegacyConfigFile,
  fallbackSources: ConfigMigrationOptions['fallbackSources'],
) => {
  const primary = join(sourceDir, fileName);
  if (isFile(primary)) return primary;

  const fallback = fallbackSources?.[fileName];
  return fallback && isFile(fallback) ? fallback : null;
};

/** 새 설정 폴더가 비어 있을 때만 옛 설정을 복사한다. 원본은 백업으로 남긴다. */
export const migrateLegacyConfig = ({
  sourceDir,
  targetDir,
  fallbackSources,
}: ConfigMigrationOptions) => {
  if (!isEmptyDirectory(targetDir)) return [];

  const sources = LEGACY_CONFIG_FILES.flatMap((fileName) => {
    const sourcePath = sourcePathFor(sourceDir, fileName, fallbackSources);
    return sourcePath ? [{ fileName, sourcePath }] : [];
  });

  if (sources.length === 0) return [];

  mkdirSync(targetDir, { recursive: true });
  sources.forEach(({ fileName, sourcePath }) => {
    copyFileSync(sourcePath, join(targetDir, fileName), fsConstants.COPYFILE_EXCL);
  });

  return sources.map(({ fileName }) => fileName);
};
