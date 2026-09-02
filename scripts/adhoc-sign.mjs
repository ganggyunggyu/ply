import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * macOS 애드혹 재서명 (electron-builder afterPack 훅).
 *
 * `mac.identity: null` 이라 electron-builder 는 재서명을 건너뛴다. 그러면 번들 내용은
 * 바뀌었는데 Electron 원본의 linker-signed 서명만 남아서 서명이 내용과 어긋난다.
 * 다운로드로 격리 속성이 붙은 앱을 열면 Gatekeeper 가 "손상되었기 때문에 열 수 없습니다" 를
 * 띄우는데, 이 다이얼로그에는 우회 버튼이 없다.
 *
 * 애드혹으로 다시 서명하면 같은 상황이 "확인할 수 없는 개발자" 로 내려가고
 * 시스템 설정의 "그래도 열기" 경로가 살아난다. 정식 서명/공증을 대신하지는 않는다.
 */
const signAdhoc = (appPath) => {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};

export default async ({ appOutDir, packager, electronPlatformName }) => {
  if (electronPlatformName !== 'darwin') return;
  if (process.platform !== 'darwin') return;

  const appPath = join(appOutDir, `${packager.appInfo.productFilename}.app`);

  try {
    signAdhoc(appPath);
    console.log(`  • ad-hoc signed  ${appPath}`);
  } catch (error) {
    console.warn(`  ⚠ ad-hoc signing failed, shipping unsigned: ${error.message}`);
  }
};
