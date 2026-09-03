import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * 다운로드 링크가 실제 빌드 산출물과 갈라지는 걸 막는다.
 *
 * site/index.html 의 RELEASE.files 와 README 의 표는 electron-builder 가 만드는
 * 파일명을 손으로 옮겨 적은 값이라 package.json 을 고치면 조용히 404 가 된다.
 * 특히 win 의 arch 를 하나라도 늘리면 electron-builder 가 `-${arch}` 를 통째로 지워
 * `Ply-Setup-win.exe` 를 뱉는다. 그 순간을 여기서 잡는다.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readRepoFile = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

type TargetConfig = { target: string; arch?: string[] };

const pkg = JSON.parse(readRepoFile('package.json'));

const archesOf = (platform: 'mac' | 'win'): string[] => {
  const [entry] = pkg.build[platform].target as TargetConfig[];
  return entry?.arch ?? [];
};

/**
 * electron-builder 의 macroExpander 와 같은 규칙.
 * arch 가 null 이면 `-${arch}` 가 앞의 구분자까지 같이 지워진다.
 */
const expandArtifactName = (pattern: string, arch: string | null, ext: string) =>
  (arch === null ? pattern.replace(/[-_]?\$\{arch\}/, '') : pattern.replace('${arch}', arch)).replace('${ext}', ext);

const expectedAssets = () => {
  const macArches = archesOf('mac');
  const winArches = archesOf('win');
  const macPattern = pkg.build.mac.artifactName as string;
  const winPattern = pkg.build.win.artifactName as string;

  return {
    macArm: expandArtifactName(macPattern, macArches.includes('arm64') ? 'arm64' : null, 'dmg'),
    macIntel: expandArtifactName(macPattern, macArches.includes('x64') ? 'x64' : null, 'dmg'),
    win: expandArtifactName(winPattern, winArches.length === 1 ? (winArches[0] as string) : null, 'exe'),
  };
};

test('win 은 arch 를 정확히 하나만 빌드해야 파일명에 -x64 가 남는다', () => {
  assert.deepEqual(
    archesOf('win'),
    ['x64'],
    'win.target 의 arch 를 늘리면 artifactName 에서 -${arch} 가 사라져 다운로드 링크가 404 가 된다',
  );
});

test('mac 은 arm64 와 x64 를 둘 다 빌드한다', () => {
  assert.deepEqual(archesOf('mac').slice().sort(), ['arm64', 'x64']);
});

test('site/index.html 의 RELEASE.files 가 실제 산출물 이름과 같다', () => {
  const html = readRepoFile('site/index.html');

  Object.entries(expectedAssets()).forEach(([key, name]) => {
    assert.ok(
      html.includes(`${key}: '${name}'`),
      `site/index.html 의 RELEASE.files.${key} 가 '${name}' 이 아니다`,
    );
  });
});

test('README 설치 표가 실제 산출물 이름과 같다', () => {
  const readme = readRepoFile('README.md');

  Object.values(expectedAssets()).forEach((name) => {
    assert.ok(readme.includes(`\`${name}\``), `README 에 ${name} 이 없다`);
  });
});

test('docs/INSTALL.md 설치 표가 실제 산출물 이름과 같다', () => {
  const install = readRepoFile('docs/INSTALL.md');

  Object.values(expectedAssets()).forEach((name) => {
    assert.ok(install.includes(`\`${name}\``), `docs/INSTALL.md 에 ${name} 이 없다`);
  });
});

test('파일명에 버전이 들어가면 releases/latest/download 링크가 깨진다', () => {
  Object.values(expectedAssets()).forEach((name) => {
    assert.ok(!name.includes(pkg.version), `${name} 에 버전이 들어 있다`);
    assert.ok(!name.includes('${version}'), `${name} 에 version 매크로가 남아 있다`);
  });
});

test('소개 페이지의 버전 표기가 package.json 과 같다', () => {
  const html = readRepoFile('site/index.html');

  assert.ok(
    html.includes(`version: '${pkg.version}'`),
    `site/index.html 의 RELEASE.version 이 package.json 의 ${pkg.version} 과 다르다`,
  );
});
