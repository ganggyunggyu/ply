import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
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
  /** 이 암호문을 지금 풀 수 있는가. 못 풀면 그 값을 안 옮긴다. */
  canDecrypt?: (cipher: string) => boolean;
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


/**
 * 옛 설정에 들어 있는 암호문 중 지금 못 푸는 것을 털어낸다.
 *
 * safeStorage 는 앱 이름으로 된 키체인 항목을 쓴다. 이름이 바뀌면 옛 암호문은 잠긴 채로
 * 남는다. 그대로 옮기면 화면에는 "키 저장됨" 이라고 뜨는데 쓰려는 순간 아무것도 없다.
 * 아예 안 옮겨야 온보딩이 처음부터 다시 물어본다.
 */
const CIPHER_FIELDS = ['apiKeyCipher', 'schedulerTokenCipher', 'exposureCookieCipher', 'passwordCipher'];

const stripDeadSecrets = (value: unknown, canDecrypt: (cipher: string) => boolean): unknown => {
  if (Array.isArray(value)) return value.map((item) => stripDeadSecrets(item, canDecrypt));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (CIPHER_FIELDS.includes(key) && typeof item === 'string') {
        return canDecrypt(item) ? [[key, item] as const] : [];
      }

      return [[key, stripDeadSecrets(item, canDecrypt)] as const];
    }),
  );
};

/** 실패하면 원본을 그대로 복사한다. 못 읽는 파일을 손대서 망가뜨리지 않는다. */
const copyWithoutDeadSecrets = (
  sourcePath: string,
  targetPath: string,
  canDecrypt: (cipher: string) => boolean,
) => {
  try {
    const parsed = JSON.parse(readFileSync(sourcePath, 'utf-8')) as unknown;
    writeFileSync(targetPath, `${JSON.stringify(stripDeadSecrets(parsed, canDecrypt), null, 2)}\n`, {
      encoding: 'utf-8',
      flag: 'wx',
    });
  } catch {
    copyFileSync(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
  }
};

/** 새 설정 폴더가 비어 있을 때만 옛 설정을 복사한다. 원본은 백업으로 남긴다. */
export const migrateLegacyConfig = ({
  sourceDir,
  targetDir,
  fallbackSources,
  canDecrypt,
}: ConfigMigrationOptions) => {
  if (!isEmptyDirectory(targetDir)) return [];

  const sources = LEGACY_CONFIG_FILES.flatMap((fileName) => {
    const sourcePath = sourcePathFor(sourceDir, fileName, fallbackSources);
    return sourcePath ? [{ fileName, sourcePath }] : [];
  });

  if (sources.length === 0) return [];

  mkdirSync(targetDir, { recursive: true });
  sources.forEach(({ fileName, sourcePath }) => {
    const targetPath = join(targetDir, fileName);
    if (canDecrypt) copyWithoutDeadSecrets(sourcePath, targetPath, canDecrypt);
    else copyFileSync(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
  });

  return sources.map(({ fileName }) => fileName);
};
