import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildShellInvocation, findExposureJob, listExposureJobs, pnpmCandidatePaths } from './hub';

test('pnpm 을 찾으면 셸을 거치지 않고 직접 실행한다', () => {
  const { command, args, viaShell } = buildShellInvocation('exposure:package', '/opt/homebrew/bin/pnpm');

  assert.equal(command, '/opt/homebrew/bin/pnpm');
  assert.deepEqual(args, ['run', 'exposure:package']);
  assert.equal(viaShell, false);
});

test('pnpm 을 못 찾으면 셸로 넘기되 .zshrc 까지 읽는다', () => {
  const { command, args, viaShell } = buildShellInvocation('exposure:package', null);

  assert.equal(viaShell, true);

  if (process.platform === 'win32') {
    assert.equal(command, 'cmd.exe');
    return;
  }

  // pnpm setup 은 PNPM_HOME 을 .zshrc 에 쓴다. -lc 는 .zshrc 를 안 읽어서 놓친다.
  if (command.endsWith('zsh')) assert.equal(args[0], '-ilc');
  else assert.equal(args[0], '-lc');
  assert.equal(args[1], 'pnpm run exposure:package');
});

test('흔한 pnpm 설치 위치를 전부 후보에 넣는다', () => {
  const paths = pnpmCandidatePaths('/Users/tester');

  if (process.platform !== 'win32') {
    assert.ok(paths.includes('/Users/tester/Library/pnpm/pnpm'));
    assert.ok(paths.includes('/opt/homebrew/bin/pnpm'));
  }

  assert.ok(paths.length > 0);
});

test('스크립트 이름에 셸 메타문자를 못 넣는다', () => {
  assert.throws(() => buildShellInvocation('a; rm -rf /'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation('a && curl evil'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation('$(whoami)'), /실행할 수 없는/);
  assert.throws(() => buildShellInvocation(''), /실행할 수 없는/);
});

/** 노출체크 저장소는 이 저장소에 없다. package.json 만 흉내 낸 임시 디렉터리를 쓴다. */
const fakeExposureRepo = (scripts: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-exposure-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fake', scripts }));
  return dir;
};

test('저장소의 exposure: 스크립트만 작업 목록에 올린다', () => {
  const dir = fakeExposureRepo({
    'exposure:package': 'node x',
    'exposure:some-client': 'node x',
    build: 'node x',
    'cafe-bot:published:exposure': 'node x',
  });

  assert.deepEqual(
    listExposureJobs(dir).map(({ script }) => script),
    ['exposure:package', 'exposure:some-client'],
  );
});

test('라벨을 모르는 스크립트도 키를 그대로 써서 실행할 수 있다', () => {
  const dir = fakeExposureRepo({ 'exposure:package': 'node x', 'exposure:some-client': 'node x' });

  assert.equal(findExposureJob(dir, 'package')?.label, '패키지 시트');
  assert.equal(findExposureJob(dir, 'PACKAGE')?.script, 'exposure:package');
  assert.equal(findExposureJob(dir, 'some-client')?.script, 'exposure:some-client');
  assert.equal(findExposureJob(dir, 'some-client')?.label, 'some-client');
  assert.equal(findExposureJob(dir, '아무거나'), null);
});

test('경로가 없거나 저장소가 아니면 빈 목록이다', () => {
  assert.deepEqual(listExposureJobs(''), []);
  assert.deepEqual(listExposureJobs('/definitely/not/a/repo'), []);
  assert.equal(findExposureJob('', 'package'), null);
});

test('package.json 이 깨져 있어도 던지지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gng-exposure-'));
  writeFileSync(join(dir, 'package.json'), '{ not json');

  assert.deepEqual(listExposureJobs(dir), []);
});

test('목록에 오른 스크립트 이름은 전부 셸 안전하다', () => {
  const dir = fakeExposureRepo({
    'exposure:package': 'node x',
    'exposure:a; rm -rf /': 'node x',
    'exposure:$(whoami)': 'node x',
  });

  const jobs = listExposureJobs(dir);

  assert.deepEqual(jobs.map(({ script }) => script), ['exposure:package']);
  jobs.forEach(({ script }) => assert.doesNotThrow(() => buildShellInvocation(script)));
});
