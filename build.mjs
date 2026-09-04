import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const outdir = join(here, 'dist');

mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [join(src, 'main.ts'), join(src, 'preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron', 'playwright-core'],
  outdir,
  logLevel: 'info',
});

await build({
  entryPoints: [join(src, 'renderer.ts'), join(src, 'panel.ts'), join(src, 'sidebar.ts')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome130',
  outdir,
  logLevel: 'info',
});

for (const file of ['renderer.html', 'renderer.css', 'panel.html', 'panel.css', 'sidebar.html', 'sidebar.css', 'tokens.css']) {
  copyFileSync(join(src, file), join(outdir, file));
}

// sql.js 의 wasm 바이너리. chrome-import/sqlite.ts 가 __dirname(=dist) 에서 직접 읽는다.
// electron-builder files:["dist/**/*"] 가 이걸 패키징에 포함시킨다.
copyFileSync(join(here, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), join(outdir, 'sql-wasm.wasm'));

console.log('[build] dist 생성 완료');
