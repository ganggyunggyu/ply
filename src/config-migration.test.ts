import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { LEGACY_CONFIG_FILES, migrateLegacyConfig } from './config-migration';
import { createProfileStore } from './profiles';

const dirs: string[] = [];

const makeDirs = () => {
  const root = mkdtempSync(join(tmpdir(), 'ply-config-migration-'));
  const sourceDir = join(root, 'old', 'config');
  const targetDir = join(root, 'new', 'config');
  dirs.push(root);
  mkdirSync(sourceDir, { recursive: true });

  return { sourceDir, targetDir };
};

const writeConfig = (dirPath: string, fileName: string, content: string) => {
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, fileName), content, 'utf8');
};

after(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

test('새 설정 경로가 비었으면 옛 설정 파일을 복사한다', () => {
  const { sourceDir, targetDir } = makeDirs();
  LEGACY_CONFIG_FILES.forEach((fileName) => writeConfig(sourceDir, fileName, `old:${fileName}`));

  const copied = migrateLegacyConfig({ sourceDir, targetDir });

  assert.deepEqual(copied, LEGACY_CONFIG_FILES);
  LEGACY_CONFIG_FILES.forEach((fileName) => {
    assert.equal(readFileSync(join(targetDir, fileName), 'utf8'), `old:${fileName}`);
  });
});

test('새 설정 경로에 파일이 하나라도 있으면 아무것도 복사하지 않는다', () => {
  const { sourceDir, targetDir } = makeDirs();
  writeConfig(sourceDir, 'accounts.json', 'old account');
  writeConfig(sourceDir, 'settings.json', 'old settings');
  writeConfig(targetDir, 'settings.json', 'new settings');

  const copied = migrateLegacyConfig({ sourceDir, targetDir });

  assert.deepEqual(copied, []);
  assert.equal(readFileSync(join(targetDir, 'settings.json'), 'utf8'), 'new settings');
  assert.equal(existsSync(join(targetDir, 'accounts.json')), false);
});

test('이관을 두 번 실행해도 첫 결과가 그대로 남는다', () => {
  const { sourceDir, targetDir } = makeDirs();
  writeConfig(sourceDir, 'settings.json', 'first');

  assert.deepEqual(migrateLegacyConfig({ sourceDir, targetDir }), ['settings.json']);
  writeFileSync(join(sourceDir, 'settings.json'), 'changed later', 'utf8');

  assert.deepEqual(migrateLegacyConfig({ sourceDir, targetDir }), []);
  assert.equal(readFileSync(join(targetDir, 'settings.json'), 'utf8'), 'first');
});

test('이관 뒤에도 옛 설정 파일은 남아 있다', () => {
  const { sourceDir, targetDir } = makeDirs();
  writeConfig(sourceDir, 'accounts.json', 'backup');

  migrateLegacyConfig({ sourceDir, targetDir });

  assert.equal(readFileSync(join(sourceDir, 'accounts.json'), 'utf8'), 'backup');
});

test('과거 홈 폴더의 프로필 목록도 대체 원본으로 가져온다', () => {
  const { sourceDir, targetDir } = makeDirs();
  const oldProfileFile = join(sourceDir, '..', 'profiles.json');
  writeConfig(join(sourceDir, '..'), 'profiles.json', 'legacy profiles');

  const copied = migrateLegacyConfig({
    sourceDir,
    targetDir,
    fallbackSources: { 'profiles.json': oldProfileFile },
  });

  assert.deepEqual(copied, ['profiles.json']);
  assert.equal(readFileSync(join(targetDir, 'profiles.json'), 'utf8'), 'legacy profiles');
  assert.equal(readFileSync(oldProfileFile, 'utf8'), 'legacy profiles');
});

test('이관한 프로필 목록을 새 설정 저장소가 그대로 읽는다', () => {
  const { sourceDir, targetDir } = makeDirs();
  const profiles = [{ id: 'work', label: '업무' }];
  writeConfig(sourceDir, 'profiles.json', JSON.stringify(profiles));

  migrateLegacyConfig({ sourceDir, targetDir });

  const store = createProfileStore({ filePath: join(targetDir, 'profiles.json') });
  assert.deepEqual(store.list(), profiles);
});

test('못 푸는 암호문은 옮기지 않는다', () => {
  const { sourceDir, targetDir } = makeDirs();
  writeFileSync(
    join(sourceDir, 'settings.json'),
    JSON.stringify({ apiKeyCipher: 'dead', schedulerLabel: '21lab' }),
  );
  writeFileSync(
    join(sourceDir, 'accounts.json'),
    JSON.stringify([{ id: 'a', naverId: 'a', passwordCipher: 'dead' }]),
  );

  migrateLegacyConfig({ sourceDir, targetDir, canDecrypt: () => false });

  const settings = JSON.parse(readFileSync(join(targetDir, 'settings.json'), 'utf-8'));
  const accounts = JSON.parse(readFileSync(join(targetDir, 'accounts.json'), 'utf-8'));

  assert.equal(settings.apiKeyCipher, undefined, '못 푸는 키가 그대로 넘어왔다');
  assert.equal(settings.schedulerLabel, '21lab', '암호문이 아닌 값까지 지웠다');
  assert.equal(accounts[0].passwordCipher, undefined, '못 푸는 비번이 그대로 넘어왔다');
  assert.equal(accounts[0].naverId, 'a', '계정 정보까지 지웠다');
});

test('풀 수 있는 암호문은 그대로 옮긴다', () => {
  const { sourceDir, targetDir } = makeDirs();
  writeFileSync(join(sourceDir, 'settings.json'), JSON.stringify({ apiKeyCipher: 'live' }));

  migrateLegacyConfig({ sourceDir, targetDir, canDecrypt: () => true });

  const settings = JSON.parse(readFileSync(join(targetDir, 'settings.json'), 'utf-8'));
  assert.equal(settings.apiKeyCipher, 'live');
});
