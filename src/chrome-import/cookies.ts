import { cookiesPath } from './paths';
import { withCopiedDb } from './sqlite';
import { decryptCookieValue, deriveAesKey, readSafeStorageKey } from './cookie-crypto';
import { webkitToUnixMs } from './webkit-time';

export type ImportedCookie = {
  hostKey: string;
  name: string;
  value: string;
  path: string;
  /** Unix epoch ms. 0 이면 세션 쿠키(브라우저 닫으면 사라지는). */
  expires: number;
  secure: boolean;
  httpOnly: boolean;
};

export type CookieReadResult = {
  cookies: ImportedCookie[];
  /** 복호화에 실패해 건너뛴 쿠키 수. v20 포맷이나 깨진 값 등. */
  skipped: number;
};

export const readChromeCookies = (profileFolder: string): Promise<CookieReadResult> => {
  const aesKey = deriveAesKey(readSafeStorageKey());

  return withCopiedDb(cookiesPath(profileFolder), (db) => {
    const result = db.exec(
      `SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly FROM cookies`,
    );

    const rows = result[0]?.values ?? [];
    const cookies: ImportedCookie[] = [];
    let skipped = 0;

    rows.forEach((row) => {
      const [hostKey, name, encryptedValue, path, expiresUtc, isSecure, isHttpOnly] = row;

      try {
        const value = decryptCookieValue(Buffer.from(encryptedValue as Uint8Array), aesKey);

        cookies.push({
          hostKey: String(hostKey ?? ''),
          name: String(name ?? ''),
          value,
          path: String(path ?? '/'),
          expires: webkitToUnixMs(Number(expiresUtc ?? 0)),
          secure: Number(isSecure ?? 0) === 1,
          httpOnly: Number(isHttpOnly ?? 0) === 1,
        });
      } catch {
        skipped += 1;
      }
    });

    return { cookies, skipped };
  });
};
