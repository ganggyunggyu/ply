import { existsSync } from 'fs';
import { ERRORS } from '../messages';
import { homedir } from 'os';
import { join } from 'path';

export const SCRIPT_NAME_PATTERN = /^[a-z0-9][a-z0-9:_-]*$/i;

/**
 * GUI(Dock/Spotlight)로 띄운 macOS 앱은 PATH 가 /usr/bin:/bin:/usr/sbin:/sbin 뿐이라
 * 사용자가 설치한 pnpm 을 찾지 못한다. 흔한 설치 위치를 먼저 뒤지고, 없으면 셸에 맡긴다.
 *
 * 셸 폴백은 zsh 기준 -ilc 를 쓴다. pnpm setup 은 PNPM_HOME 을 .zshrc 에 쓰는데
 * -lc(비대화형 로그인 셸)는 .zshrc 를 읽지 않아 그 설치를 놓친다.
 */
export const pnpmCandidatePaths = (home = homedir()): string[] => {
  const fromEnv = process.env.PNPM_HOME ? [join(process.env.PNPM_HOME, 'pnpm')] : [];

  if (process.platform === 'win32') {
    return [...fromEnv, join(home, 'AppData', 'Local', 'pnpm', 'pnpm.exe')];
  }

  return [
    ...fromEnv,
    join(home, 'Library', 'pnpm', 'pnpm'),
    join(home, '.local', 'share', 'pnpm', 'pnpm'),
    '/opt/homebrew/bin/pnpm',
    '/usr/local/bin/pnpm',
  ];
};

export const findPnpm = (exists: (path: string) => boolean = existsSync): string | null =>
  pnpmCandidatePaths().find(exists) ?? null;

export const buildShellInvocation = (script: string, pnpmPath: string | null = findPnpm()) => {
  if (!SCRIPT_NAME_PATTERN.test(script)) {
    throw new Error(ERRORS.scriptNameRejected(script));
  }

  if (pnpmPath) {
    return { command: pnpmPath, args: ['run', script], viaShell: false };
  }

  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/c', `pnpm run ${script}`], viaShell: true };
  }

  const shell = process.env.SHELL || '/bin/zsh';
  const loginInteractive = shell.endsWith('zsh') ? '-ilc' : '-lc';

  return { command: shell, args: [loginInteractive, `pnpm run ${script}`], viaShell: true };
};
