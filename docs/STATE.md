# 현재 상태

마지막 갱신: 2026-09-02

## 무엇인가

Electron 43 데스크톱 브라우저. 탭마다 세션 파티션(`persist:<profileId>`)을 나눠 네이버 계정을
분리해서 쓰고, 안에 에이전트가 들어 있다. 사용자가 한국어로 시키면 도구를 골라 실제로 실행한다.

에이전트 두뇌는 **OpenRouter**를 탄다. 오픈라우터는 "어떤 도구를 어떤 인자로" 만 정하고,
실제 HTTP 요청과 브라우저 조작은 전부 이 앱이 한다. 모델은 로컬 서비스 주소를 본 적이 없다.

## 실행

```bash
npm run dev          # 개발 중 실행
npm run install:app  # 빌드 + /Applications 설치
npm run check        # 타입체크 + 테스트 132개
npm run dist         # dmg 2종 (arm64 / x64)
```

CDP 포트 기본 `18830`. OpenClaw 가 쓰는 `18828` 과 겹치지 않게 잡았다.

## 도구 19개

| 도구 | 필요한 것 |
| --- | --- |
| `ask_user` `list_accounts` `check_login` `naver_login` `publish_blog_post` `open_tab` | 없음 (브라우저 자신) |
| `list_my_posts` `delete_blog_posts` | 없음 (브라우저 자신) |
| `list_services` `open_service` | 없음 |
| `generate_manuscript` | OpenRouter 키 |
| `check_services` | 없음 |
| `dabut_login` `list_dabut_projects` `generate_manuscript_dabut` | 원고 생성 백엔드 (기본 `:8000`) |
| `list_scheduler_accounts` `auto_schedule_posts` | 예약 발행 서버 (기본 `:3000`) |
| `list_exposure_jobs` `run_exposure_check` | 노출체크 저장소 + pnpm |

노출체크 작업 목록은 코드에 박아 두지 않는다. `list_exposure_jobs` 가 설정된 저장소의
`package.json` 을 읽어 `exposure:` 로 시작하는 스크립트를 그대로 목록으로 만든다.
저장소 쪽에서 스크립트 이름을 바꿔도 어긋나지 않고, 남의 시트 이름이 이 저장소에 남지도 않는다.

주소는 패널 설정에서 지정한다. 각 서비스가 무엇을 더 요구하는지는 `docs/INSTALL.md` 를 본다.

### 글 삭제

`delete_blog_posts` 는 되돌릴 수 없으므로 프롬프트가 아니라 코드로 막는다.

- 대상은 `list_my_posts` 가 **이번 실행에서** 돌려준 logNo 만 받는다. 환각 번호와 지난 대화의 번호는 거부된다.
- `run()` 안에서 `askUser` 로 제목·날짜·logNo 를 나열하고, 승인 토큰(`CONFIRM.deleteYes`) 정확일치일 때만 진행한다.
  승인 전에는 탭도 열지 않고 CDP 도 붙지 않는다.
- 사용자가 거절하면 그 logNo 는 실행 내내 다시 확인을 띄우지 못한다. 승낙할 때까지 되묻는 경로를 막는다.
- blogId 는 `MyBlog.naver` 리다이렉트에서만 얻고, 삭제 탭에서 한 번 더 확인해 목록 때와 다르면 중단한다.
  모델 인자로 받지 않는다.
- 한 번 시도한 logNo 는 같은 실행에서 재시도할 수 없다. 실행당 상한 10건은 **성공이 아니라 시도**로 센다.
  검증이 "확인 못 함" 으로 떨어져도 상한이 열리지 않는다.
- 클릭 직전 제목을 다시 읽어 정규화 후 완전일치가 아니면 건너뛴다. 부분일치는 허용하지 않는다.
  ("다이어트 후기" 와 "다이어트 후기 3일차" 가 서로 통과하면 안 된다.)
- 한 화면에 삭제 버튼이 둘 이상이면 어느 글의 제목을 읽었는지 보장할 수 없으므로 손대지 않는다.
- 삭제 판정은 **긍정 근거만** 본다. 인증된 목록 재조회에서 logNo 가 사라졌거나 `PostView` 가 404/410 일 때만
  "삭제됨" 이다. 200 응답은 비로그인 공개 뷰일 수 있어 판정하지 않는다.
  확인이 안 되면 "지워졌는지 확인 못 함" 으로 보고하고 재시도하지 않는다.

핵심 흐름(로그인 → 원고 → 글쓰기)은 외부 서비스 없이 돈다.

## 문장은 전부 상수

- `src/messages.ts` — 사용자에게 보이는 문장. HTML 에는 한글이 하나도 없다.
- `src/prompts.ts` — 모델이 읽는 도구 설명과 시스템 프롬프트.
- `site/index.html` 의 `COPY` — 랜딩 문장 94개. `[영문, 한국어]` 쌍. 마크업엔 `data-k` 만 있다.

말투를 고치려면 이 세 곳만 본다.

## 실측으로 확인한 것

- 세션 격리: 프로필 두 개로 같은 URL 을 열고 각각 다른 값을 심어도 안 섞인다.
- 탭 특정: `window.__gngTabId` 로 잡는다. URL 이 같아도 정확히 구분된다.
- 네이버 로그인 폼: `#id` `#pw` 값 주입 동작, 버튼은 `#loginBtn_column`.
- 미로그인 감지: 글쓰기 진입 시 `nid.naver.com` 리다이렉트를 잡는다.
- GUI 최소 PATH(`/usr/bin:/bin:/usr/sbin:/sbin`)로 띄워도 앱이 정상 동작한다.

## 고친 blocker

1. GUI 실행 시 `spawn('pnpm')` ENOENT → 설치 위치 4곳 탐색 후 셸(`-ilc`) 폴백.
   `zsh -lc` 는 `.zshrc` 를 안 읽어서 `pnpm setup` 설치를 놓친다.
2. `hub.ts` 절대경로 하드코딩 → 설정 패널에서 지정, `settings.json` 에 영구 저장.
3. 계정 id 네임스페이스 충돌 → `list_scheduler_accounts` 추가.
   브라우저 프로필 id 와 스케줄러 DB id 는 다른 값이다.
4. `release.yml` 에 `npm run build` 누락 → Windows 빌드가 한 번도 성공한 적 없었다.
5. dmg arm64 전용 → arm64 + x64, 파일명에 `${arch}`.
6. 네이버 로그인 버튼 셀렉터 사망(`.btn_login`) → `#loginBtn_column` + 텍스트 폴백.

## 남은 문제

| 문제 | 내용 |
| --- | --- |
| 에이전트 직렬 | `main.ts` 의 `agentRunning` 이 전역 boolean 하나라 동시에 한 작업만 돈다. 탭과 세션은 계정별로 나뉘지만 에이전트 실행은 한 번에 하나다. |
| 로그인 이후 경로 미검증 | 실계정으로 로그인 다음 단계를 끝까지 돌려본 적이 없다. 스마트에디터 셀렉터도 미검증이다. |
| CDP 포트 충돌 무감지 | 18830 을 다른 프로그램이 쓰고 있어도 UI 는 정상처럼 보인다. |

## 다음에 할 것

1. 계정 등록 후 `로그인해봐` 로 로그인 이후 경로를 끝까지 검증.
2. 원고 백엔드와 스케줄러를 띄워서 그쪽 도구 실호출.
3. `agentRunning` 을 어떻게 할지 결정.

## 참고 문서

| 문서 | 내용 |
| --- | --- |
| `AGENT.md` | 이 저장소 작업 규칙 |
| `docs/INSTALL.md` | 다른 컴퓨터에 설치 |
| `DISCLAIMER.md` | 면책 고지 |
