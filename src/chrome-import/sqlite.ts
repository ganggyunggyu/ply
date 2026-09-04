import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import initSqlJs, { type Database } from 'sql.js';

/**
 * wasm 바이너리 위치. 배포/실행(electron dist/main.js)에서는 __dirname(=dist)에 build.mjs 가
 * 복사해 둔 사본을 쓴다. tsx 로 소스를 바로 돌리는 테스트에서는 그 사본이 없으므로 node_modules
 * 원본으로 폴백한다. 파일을 직접 읽어 wasmBinary 로 넘겨서 locateFile/fetch 를 아예 안 타게 한다.
 */
const wasmCandidates = () => [
  join(__dirname, 'sql-wasm.wasm'),
  join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
];

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

const loadSql = () => {
  if (sqlPromise) return sqlPromise;

  const path = wasmCandidates().find((candidate) => existsSync(candidate));
  if (!path) throw new Error('sql-wasm.wasm 을 찾지 못했다');

  const buf = readFileSync(path);
  const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  sqlPromise = initSqlJs({ wasmBinary });

  return sqlPromise;
};

/**
 * 크롬이 켜져 있으면 원본 DB 파일이 잠겨 있다. 원본을 직접 열면 잠금 충돌로 크롬 쪽이 깨질 수
 * 있어서, 임시 폴더로 복사한 사본만 읽는다. 사본은 끝나면 반드시 지운다.
 */
export const withCopiedDb = async <T>(sourcePath: string, run: (db: Database) => T): Promise<T> => {
  if (!existsSync(sourcePath)) throw new Error(`파일이 없다: ${sourcePath}`);

  const dir = mkdtempSync(join(tmpdir(), 'ply-chrome-'));
  const copy = join(dir, 'db.sqlite');

  try {
    copyFileSync(sourcePath, copy);
    const SQL = await loadSql();
    const db = new SQL.Database(readFileSync(copy));

    try {
      return run(db);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
