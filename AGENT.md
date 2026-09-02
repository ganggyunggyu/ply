# AGENT.md

## 프로젝트

Electron 기반 개인용 커스텀 브라우저. 목적은 두 가지다.

1. 계정별 세션을 탭 단위로 분리해서 네이버 작업을 한 창에서 처리한다.
2. `--remote-debugging-port` 를 열어둬서 기존 Playwright 스크립트가 `connectOverCDP` 로 그대로 붙는다.

## 명령

| 명령 | 설명 |
| --- | --- |
| `npm run build` | esbuild 로 `dist/` 생성 |
| `npm run dev` | 빌드 후 Electron 실행 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dist` | electron-builder 로 dmg 패키징 |
| `npm run install:app` | 패키징 후 `/Applications/GNG Browser.app` 에 설치 |
| `npm test` | `tsx --test` 로 단위 테스트 |
| `npm run check` | 타입체크 + 테스트 |

## 규칙

- 화살표 함수만 쓴다. `function` 키워드는 쓰지 않는다.
- 핸들러는 named function 으로 분리한 뒤 참조한다. 인라인 익명 핸들러를 붙이지 않는다.
- 렌더러는 `contextIsolation: true` 를 유지하고 `preload.ts` 의 `gngBrowser` 브리지로만 메인과 통신한다.
- 탭 뷰(`tabs.ts`)는 `sandbox: true` 로 만든다. 웹 콘텐츠에 Node 권한을 주지 않는다.
- 창 크기, 사이드바 너비, 툴바 높이, 기본 포트 같은 값은 `src/constants.ts` 에 모은다.
- 크롬 표면이 셋(사이드바 / 상단 툴바 / 에이전트 패널)이다. 레이아웃은 전부 `tabs.ts` 의 `layout()` 한 곳에서만
  계산한다. 각 뷰가 자기 위치를 정하지 않는다.
- 에이전트가 연 탭은 `openedByAgent: true` 로 만든다. 사이드바가 이걸로 그룹을 나눈다.
- 새 IPC 채널을 추가하면 `main.ts` 의 `registerIpcHandlers`, `preload.ts` 의 브리지, `bridge.ts` 의 타입
  세 곳을 같이 고친다. 렌더러마다 타입을 따로 선언하지 않는다.
- 시크릿(비밀번호, API 키)은 `safeStorage` 로 암호화해서만 저장한다. 평문 폴백을 만들지 않는다.
  저장소 모듈은 crypto 를 주입받는 팩토리로 만들어 Electron 없이 테스트할 수 있게 한다.
- 새 도구를 추가하면 `agent-tools.ts` 의 반환 배열과 시스템 프롬프트를 같이 갱신한다.
  되돌릴 수 없는 도구에는 설명에 그 사실을 적는다.

## 주의

- CDP 포트 기본값은 `18830`. OpenClaw 가 `18828` 을 쓰므로 겹치지 않게 유지한다.
- `remote-allow-origins=*` 는 로컬 자동화용이다. 이 앱을 신뢰할 수 없는 네트워크에 노출하지 않는다.
- 프로필 삭제는 `profiles.json` 항목만 지운다. 세션 데이터는 Electron `userData` 에 남는다.
