import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { ERRORS, PROGRESS } from '../messages';
import { buildShellInvocation } from './pnpm';

export type CommandResult = {
  code: number | null;
  output: string;
};

export const runPackageScript = ({
  cwd,
  script,
  onLine,
  timeoutMs = 30 * 60 * 1000,
  signal,
}: {
  cwd: string;
  script: string;
  onLine?: (line: string) => void;
  timeoutMs?: number;
  /** 정지 신호. 이미 타임아웃이 같은 SIGTERM 을 보내고 있어서 종료 경로가 새로 생기지는 않는다. */
  signal?: AbortSignal;
}): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    if (!cwd) {
      reject(new Error(ERRORS.exposureDirMissing));
      return;
    }
    if (!existsSync(`${cwd}/package.json`)) {
      reject(new Error(ERRORS.exposureDirInvalid(cwd)));
      return;
    }

    const { command, args, viaShell } = buildShellInvocation(script);
    onLine?.(viaShell ? PROGRESS.pnpmViaShell : PROGRESS.pnpmFound(command));
    const child = spawn(command, args, { cwd, env: process.env });
    const chunks: string[] = [];

    const collect = (data: Buffer) => {
      const text = data.toString();
      chunks.push(text);
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => onLine?.(line));
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(ERRORS.commandTimeout(script)));
    }, timeoutMs);

    // 서로를 참조하지만 둘 다 호출 시점에만 상대를 읽으므로 순서 문제가 없다.
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    };

    const stop = () => {
      cleanup();
      child.kill('SIGTERM');
      reject(new Error(ERRORS.runCancelled));
    };

    if (signal?.aborted) {
      stop();
      return;
    }
    signal?.addEventListener('abort', stop, { once: true });

    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      cleanup();
      resolve({ code, output: chunks.join('').slice(-4000) });
    });
  });
