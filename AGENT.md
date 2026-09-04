# AGENT.md

## 프로젝트

Electron 기반 개인용 커스텀 브라우저. 목적은 두 가지다.

1. 계정별 세션을 탭 단위로 분리해서 네이버 작업을 한 창에서 처리한다.
2. `--remote-debugging-port` 를 열어둬서 기존 Playwright 스크립트가 `connectOverCDP` 로 그대로 붙는다.

## 명령

| 명령 | 설명 |
| --- | --- |
| `npm run build` | API 문서 생성 후 esbuild 로 `dist/` 생성 |
| `npm run api:docs` | `docs/api/*.md` -> `src/api-docs.generated.ts` (build 가 먼저 부른다) |
| `npm run api:sync` | 세 서비스의 라우트 스냅샷 갱신. 다붓·노출지기·스케줄러 저장소가 있어야 한다 |
| `npm run dev` | 빌드 후 Electron 실행 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dist` | electron-builder 로 dmg 패키징 |
| `npm run install:app` | 패키징 후 `/Applications/Ply.app` 에 설치 |
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
- **도구 31개가 상한에 가깝다.** 새 요청은 기본적으로 `api_get` + `docs/api/` 문서로 처리하고,
  새 도구는 "쓰기이면서 서버가 안 해 주는 안전장치가 필요한 것" 만 받는다. 읽기는 도구를 늘리지 않는다.
- 되돌릴 수 없거나 오래 걸리는 도구는 `run()` 안에서 스스로 확인 카드를 띄운다.
  프롬프트에만 적으면 막지 못한다. `delete_blog_posts` 의 `requestDeleteApproval` 패턴을 복사한다.
- 비밀번호는 도구 인자로 받지 않는다. 도구 인자는 `tool_start` 이벤트로 대화 기록에 남고
  OpenRouter 요청 본문에도 실린다. 패널 카드로 받아 메인에서 `safeStorage` 로 저장한다.
  (`manage_naver_account`, `dabut_login`, `exposure_login` 이 전부 이 경로다.)
- **카드의 첫 줄(`lead`)은 코드가 만든다.** 모델이 준 `reason` 은 `note` 로만 내려가고
  라벨이 붙는다. lead 를 모델에게 내주면 `read_page` 로 들어온 주입 문장이 "비밀번호를
  넣어주세요" 자리에 앉는다. `src/panel-cards.test.ts` 가 소스를 읽어 이걸 고정한다.
- **크리덴셜 카드의 거절은 끈적해야 한다.** 사용자가 되돌려보낸 카드를 같은 실행에서 다시
  띄우지 않는다(`touchedAccountIds`, `declinedCards`). 안 그러면 모델이 `max_iterations`
  까지 비밀번호 칸을 다시 띄울 수 있고, 정품 카드라 사용자는 구분할 근거가 없다.
- **쓰기 결과는 서버가 되돌려준 값으로 보고한다.** 보내기 전 요약을 사실로 말하지 않는다.
  노출지기는 저장 직전에 `blogIds` 를 정규화하고 못 쓰는 값을 200 과 함께 조용히 버린다.
  `describeSavedPreset` 이 그 되읽기다.
- `api_get` 응답은 `redactSecrets` 를 지나 나간다. 비밀번호·토큰·웹훅 주소는 값이 지워진다.
  두레이 인커밍 웹훅 URL 은 그 자체가 인증 토큰이다.
- API 참조 문서는 `docs/api/*.md` 에 쓰고 실행 가능한 값은 `{{자리표시자}}` 로 둔다.
  값은 `scripts/build-api-docs.mjs` 가 코드에서 채우고, 목록에 없는 자리표시자가 있으면 빌드가 죽는다.
  문서가 적은 경로·도구·허용목록은 `src/api-docs.test.ts` 가 스냅샷과 대조해 고정한다.

## 주의

- CDP 포트 기본값은 `18830`. OpenClaw 가 `18828` 을 쓰므로 겹치지 않게 유지한다.
- `remote-allow-origins=*` 는 로컬 자동화용이다. 이 앱을 신뢰할 수 없는 네트워크에 노출하지 않는다.
- 프로필 삭제는 `profiles.json` 항목만 지운다. 세션 데이터는 Electron `userData` 에 남는다.
- 계정 삭제(`accounts.remove`)도 json 만 지운다. 브라우저 프로필과 로그인 쿠키는 남는다.
  확인 문구에 그 사실을 반드시 적는다.
- 비밀번호 변경은 `accounts.ts` 의 `updatePassword` 를 쓴다. `remove` + `add` 로 흉내내면
  `nextAccountId` 의 slug 규칙 때문에 id 가 `-2` 로 밀리고 프로필 파티션이 통째로 갈린다.
- 네이버 계정 저장소가 두 곳이다(이 앱의 `accounts.json`, 다붓의 `/naver-accounts`).
  비밀번호를 바꿀 때는 반드시 두 곳을 함께 갱신하고 결과도 따로 보고한다.
- `npm run api:sync` 를 아무도 안 돌리면 스냅샷이 늙는다. 테스트는 스냅샷과 문서만 대조하므로
  둘 다 늙으면 통과한다. 90일이 지나면 테스트가 경고를 찍는다(실패시키지는 않는다 — 오프라인에서 빌드가 죽으면 안 된다).
