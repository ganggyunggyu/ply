import { createDecipheriv, pbkdf2Sync } from 'crypto';
import { execFileSync } from 'child_process';

/** macOS 크롬은 v10/v11 두 prefix 만 쓴다. v20(App-Bound)은 Windows 전용이라 여기선 못 푼다. */
const SUPPORTED_PREFIXES = ['v10', 'v11'];
const AES_IV = Buffer.alloc(16, 0x20);
const DOMAIN_HASH_LEN = 32;

/**
 * 크롬 Safe Storage 키를 키체인에서 꺼낸다. 이 execFile 이 실행되는 순간 macOS 가 키체인 접근
 * 승인 창을 띄운다. 사용자가 허용을 눌러야 값이 온다. 거부하거나 항목이 없으면 던진다 —
 * 조용히 빈 값으로 넘어가면 쿠키가 통째로 안 풀리는데 원인을 알 수 없게 된다.
 */
export const readSafeStorageKey = (): string => {
  const raw = execFileSync(
    'security',
    ['find-generic-password', '-w', '-s', 'Chrome Safe Storage', '-a', 'Chrome'],
    { encoding: 'utf-8' },
  );

  const key = raw.trim();
  if (!key) throw new Error('키체인에서 Chrome Safe Storage 키를 찾지 못했다');

  return key;
};

export const deriveAesKey = (safeStorageKey: string): Buffer =>
  pbkdf2Sync(safeStorageKey, 'saltysalt', 1003, 16, 'sha1');

/**
 * 복호화 결과 앞 32바이트가 도메인 SHA256 prefix 인 최신 크롬 포맷이 있다. 붙어 있으면 앞부분이
 * 사람이 못 읽는 바이너리라, 그대로 utf-8 로 읽으면 값 앞에 깨진 문자가 낀다. prefix 를 떼면
 * 나머지가 읽히므로, "앞 32바이트에 제어문자가 섞여 있으면 도메인 prefix 로 보고 뗀다"로 판정한다.
 */
const stripDomainPrefix = (plain: Buffer): Buffer => {
  if (plain.length <= DOMAIN_HASH_LEN) return plain;

  const head = plain.subarray(0, DOMAIN_HASH_LEN);
  const hasControlBytes = head.some((byte) => byte < 0x20 && byte !== 0x09);

  return hasControlBytes ? plain.subarray(DOMAIN_HASH_LEN) : plain;
};

/**
 * 쿠키 하나를 복호화한다. 실패는 던진다 — 부르는 쪽이 이 쿠키만 건너뛰고 나머지를 계속 처리한다.
 * v20 등 못 다루는 prefix 도 던진다.
 */
export const decryptCookieValue = (encrypted: Buffer, aesKey: Buffer): string => {
  if (encrypted.length < 3) throw new Error('암호문이 너무 짧다');

  const prefix = encrypted.subarray(0, 3).toString('latin1');
  if (!SUPPORTED_PREFIXES.includes(prefix)) throw new Error(`지원하지 않는 쿠키 포맷: ${prefix}`);

  const body = encrypted.subarray(3);
  const decipher = createDecipheriv('aes-128-cbc', aesKey, AES_IV);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]);

  return stripDomainPrefix(plain).toString('utf-8');
};
