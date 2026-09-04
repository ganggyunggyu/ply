import assert from 'node:assert/strict';
import { createCipheriv, createHash } from 'node:crypto';
import { test } from 'node:test';
import { decryptCookieValue, deriveAesKey } from './cookie-crypto';

const AES_IV = Buffer.alloc(16, 0x20);

/** 크롬과 같은 방식으로 암호화한다: v10 prefix + AES-128-CBC(IV=16 spaces). 도메인 해시는 옵션. */
const encryptLikeChrome = (aesKey: Buffer, value: string, domainPrefix?: Buffer): Buffer => {
  const plain = domainPrefix ? Buffer.concat([domainPrefix, Buffer.from(value, 'utf-8')]) : Buffer.from(value, 'utf-8');
  const cipher = createCipheriv('aes-128-cbc', aesKey, AES_IV);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from('v10'), body]);
};

const aesKey = deriveAesKey('test-safe-storage-key');

test('deriveAesKey 는 16바이트 키를 만든다', () => {
  assert.equal(aesKey.length, 16);
});

test('v10 쿠키를 왕복 복호화한다', () => {
  const encrypted = encryptLikeChrome(aesKey, 'session=abc123');
  assert.equal(decryptCookieValue(encrypted, aesKey), 'session=abc123');
});

test('앞 32바이트 도메인 해시 prefix 가 붙어도 실제 값만 남긴다', () => {
  const domainHash = createHash('sha256').update('naver.com').digest(); // 32바이트, 바이너리
  const encrypted = encryptLikeChrome(aesKey, 'NID_SES=xyz', domainHash);
  assert.equal(decryptCookieValue(encrypted, aesKey), 'NID_SES=xyz');
});

test('지원하지 않는 prefix(v20)는 던진다', () => {
  const body = encryptLikeChrome(aesKey, 'x').subarray(3);
  const v20 = Buffer.concat([Buffer.from('v20'), body]);
  assert.throws(() => decryptCookieValue(v20, aesKey), /지원하지 않는/);
});

test('너무 짧은 암호문은 던진다', () => {
  assert.throws(() => decryptCookieValue(Buffer.from('v1'), aesKey), /짧다/);
});
