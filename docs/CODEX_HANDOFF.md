# Codex 인계 — GNG Browser → Ply

작성 2026-09-03. 이 문서는 지금 시점의 작업 지시서다.
이전 인계 내용(ASIDE 조사, 기능 제안)은 이 파일 아래 "참고 문서" 절의 링크로 옮겼다.

---

## 저장소 규칙 (먼저 읽을 것)

- 화살표 함수만. `function` 키워드 금지. 핸들러는 named function 으로 분리한 뒤 참조한다.
- 한국어 문장은 두 곳에만 둔다. 사용자에게 보이는 것은 `src/messages.ts`, 모델이 읽는 것은 `src/prompts.ts`.
  로직 파일과 HTML 에 한국어 리터럴을 직접 쓰지 않는다.
- 되돌릴 수 없는 작업(글 삭제, 예약 취소, 계정 삭제)은 도구의 `run()` 안에 하드 확인 게이트를 둔다.
  시스템 프롬프트에만 의존하지 않는다. 기존 `delete_blog_posts` 구현을 읽고 같은 패턴을 쓴다.
- 비밀번호를 모델 컨텍스트에 넣지 않는다. 카드로 받아 메인 프로세스에서 `safeStorage` 로 저장하고,
  도구 인자·결과·진행 문구·로그 어디에도 싣지 않는다.
- 검증은 `npm run check` (= `tsc --noEmit && tsx --test src/**/*.test.ts`) 와 `npm run build`.
  현재 **443개 통과**가 기준선이다. 이보다 줄면 회귀다.
- 코드에 개인 계정 아이디나 새 실주소를 박지 않는다.
  서비스 주소 기본값(`src/services.ts`, `src/hub.ts` 의 `DEFAULT_ENDPOINTS`)은 이미 있는 것을 유지한다.

---

## 작업 1 — Ply 로 개명 (최우선, 다른 작업의 앞)

제품 이름을 `GNG Browser` 에서 `Ply` 로 바꾼다.
Ply = 겹·가닥(2-ply) + ply a trade(대신 일한다). 두 뜻이 겹치는 것이 선정 이유다.

### 아이콘은 이미 교체되어 있다
`build-resources/` 에 새 아이콘이 들어가 있다. 다시 만들지 마라.
- `icon.svg` — 원본. 링 두 개가 겹치고 앞 링이 뒤 링을 가린다(가닥 두 개의 단면)
- `icon.icns` / `icon.ico` / `icon.iconset/`
- 색: 바탕 `#22211e`, 마크 `#ece9e2`

### 바꿀 것

| 대상 | 지금 | 바뀜 |
|---|---|---|
| `package.json` `name` | `gng-browser` | `ply` |
| `package.json` `build.appId` | `kr.gng.browser` | `app.ply.browser` |
| `package.json` `build.productName` | `GNG Browser` | `Ply` |
| `build.mac.artifactName` | `GNG-Browser-mac-${arch}.${ext}` | `Ply-mac-${arch}.${ext}` |
| `build.win.artifactName` | `GNG-Browser-Setup-win-${arch}.${ext}` | `Ply-Setup-win-${arch}.${ext}` |
| `package.json` `install:app` 스크립트 | `GNG Browser.app` 경로 | `Ply.app` |
| `src/main.ts` `app.setPath('userData', ...)` | `gng-browser` | `ply` |
| `src/messages.ts` `PANEL` 등 화면 문구 | "GNG Browser" | "Ply" |
| `src/prompts.ts` `buildAgentSystemPrompt()` | "GNG Browser 안에서 도는" | "Ply 안에서 도는" |
| `src/openrouter.ts` `APP_REFERER` | `github.com/ganggyunggyu/gng-browser` | `github.com/ganggyunggyu/ply` |
| `site/index.html` `RELEASE.repo` | `ganggyunggyu/gng-browser` | `ganggyunggyu/ply` |
| `site/index.html` `RELEASE.files` | `GNG-Browser-*` | `Ply-*` |
| `site/index.html` COPY 상수 | 제품명 전부 | |
| `README.md`, `AGENT.md`, `docs/*` | | |

`grep -rn "gng-browser\|GNG Browser\|GNG-Browser\|kr.gng" --exclude-dir={node_modules,out,dist,.git}` 로 빠진 곳을 확인해라.

### 반드시 같이 넣을 것 — 설정 일회성 이관

`appId` 를 바꾸면 Electron 이 `userData` 경로를 새로 잡는다.
그러면 API 키, 네이버 계정, 다붓 토큰, 프로필이 **전부 사라진 것처럼 보인다**(파일은 옛 경로에 남는다).

`src/main.ts` 의 `handleReady()` 에 이관을 넣어라. 기존 `loadServiceUrls()` 가
`config/services.json` 을 settings 로 옮기는 패턴이 있으니 그것을 참고한다.

- 새 `userData/config/` 가 비어 있고 옛 경로에 파일이 있으면 한 번만 복사한다
  - macOS 옛 경로: `~/Library/Application Support/gng-browser/config/`
  - Windows 옛 경로: `%APPDATA%/gng-browser/config/`
- 옮길 파일: `settings.json`, `accounts.json`, `profiles.json`, `services.json`
- 옛 파일은 **지우지 마라.** 백업으로 남긴다.
- 세션 파티션(`persist:<profileId>`)은 userData 아래에 있으므로 네이버 로그인 쿠키는 따라오지 않는다.
  이관 후 첫 실행에서 재로그인이 필요하다는 것을 `messages.ts` 문구로 안내해라.

**완료 조건**
- `npm run check` 443개 이상 통과, `npm run build` 통과
- 이관 로직에 단위 테스트: 새 경로가 비었고 옛 경로에 파일이 있으면 복사한다 /
  새 경로에 이미 파일이 있으면 복사하지 않는다 / 두 번 돌려도 결과가 같다 / 옛 파일이 남아 있다
- `grep -rn "GNG"` 결과가 0건 (docs 의 과거 이력 서술은 예외로 두되 그 사실을 보고에 적을 것)

### 저장소·배포는 사람이 한다
`gh repo rename`, Vercel 프로젝트명 변경, 태그 푸시는 **하지 마라.**
코드 수정과 검증까지만 하고 보고해라. `ganggyunggyu/ply` 는 비어 있는 것을 확인해 뒀다.

---

## 작업 2 — API 결손 채우기

`docs/API_SPEC.md` (1552줄) 에 네 서비스의 API 전수와 결손 목록이 있다. **먼저 읽어라.**
아래는 그중 상위 5개다. 서로 독립이므로 병렬로 맡겨도 된다.

### 2-1. 스케줄러 enum 조회 API
`manuscriptType` 12개가 코드에만 있어서 에이전트가 모른다. 실제로 `리뷰형` 을 보내 400 이 났다.
지금은 `src/scheduler-enums.ts` 에 상수로 복사해 뒀는데, 스케줄러가 값을 바꾸면 조용히 어긋난다.
→ `scheduler-server` 에 `GET /api/meta/enums` 추가. `schedule.route.ts:46-49` 의 zod enum 을 그대로 반환.
→ 주의: 이 enum 이 `schedule.route.ts:47` 과 `schemas/dto.ts:26` **두 곳에 중복 정의**돼 있다. 같이 정리해라.

### 2-2. 스케줄러 예약 수정 + 멱등성 지문
`PATCH /schedules/:id` 가 없다. "예약 시간 바꿔줘" 가 불가능하다.
그리고 `projectId` 가 멱등성 지문에서 빠져 있어(`schedule-idempotency.service.ts:28`, `:72-81`),
키워드·계정·날짜가 같고 `project_id` 만 바꾼 재요청은 **새 예약이 안 만들어지고 옛 프로젝트로 발행된다.**
응답은 `success:true` 로 오는 무음 오작동이다.
→ `PATCH` 추가와 지문 수정을 **한 커밋에서** 같이 해라. 따로 고치면 안 된다.

### 2-3. 노출지기 프리셋 PATCH
`PUT /api/preset` 이 전체 교체다. `targets` 만 보내면 나머지가 400 없이 전부 삭제된다.
→ `blog-cron-bot/dashboard/src/app/api/preset/route.ts` 에 `PATCH` 추가. deep-merge 후 `parsePreset` 통과.

### 2-4. 바이로 댓글 잡 조회
등록은 `POST /api/agent/prepare` op=`comment-job` 으로 되는데 상태 확인은 UI 뿐이다.
`claim` 은 뽑으면 `running` 으로 바꾸는 부작용이 있어 조회용으로 못 쓴다.
→ `cafe-bot/src/app/api/agent/jobs/route.ts` (목록) + `.../jobs/[jobId]/route.ts` (단건).
`src/features/manual-comment-job/actions.ts:339` 의 `getManualCommentJobsAction` 재사용.

### 2-5. 바이로 잡 취소
잘못 등록한 댓글 잡을 되돌릴 방법이 없다. Mongo 직접 수정뿐.
→ `POST /api/agent/jobs/[jobId]/cancel`. status enum(`src/shared/models/manual-comment-job.ts:8,105`)에 `'cancelled'` 추가.

---

## 작업 3 — 다붓 백엔드 무인증 차단 (보류)

> **2026-09-04 사용자 결정: 지금은 건드리지 않는다.** 인증이 필요해지면 그때 붙인다.
> 아래는 그때를 위한 기록이다. 먼저 시작하지 마라.

`https://blog-analyzer.fly.dev` 가 인터넷에 열려 있고 **149개 중 122개가 무인증**이다.
저장소가 공개라 주소도 알려져 있다.

- `GET /docs`, `GET /openapi.json` 이 200 으로 공개
- 무인증 파괴적 오퍼레이션 11개. `DELETE /search/manuscript/{id}` 는 `user_id` 가 쿼리스트링이라
  아무 값이나 넣으면 남의 데이터를 지운다
- `POST /generate/claude` 등 LLM 호출 40여 개가 무인증. 서버 환경변수 키로 돌아 과금된다
- `GET/DELETE /generate/image-batch/{job_id}` 는 시작만 인증이고 조회·다운로드·삭제는 무인증
- `/bot/*` 이 네이버 id/password 를 평문 body 로 무인증 수신

**함정**: `dabut-backend/api.py` 의 `apply_account_api_keys` 미들웨어 주석에
"토큰이 없으면 아무것도 하지 않는다. 스케줄러나 봇들이 토큰 없이 부르고 있어서 여기서 막으면 그쪽이 전부 멈춘다"
라고 적혀 있다. **그냥 잠그면 사용자의 자동발행 파이프라인이 죽는다.**

단계를 나눠라.
1. `/docs`, `/openapi.json` 차단 — 깨질 것이 없다
2. 파괴적 오퍼레이션 11개 — 호출자를 먼저 조사하고 잠근다
3. LLM 호출 — 여기가 스케줄러와 얽힌다. 호출자 쪽에 토큰을 넣거나 서비스 토큰을 도입한다

환경변수 스위치로 껐다 켤 수 있게 만들어라. 배포 후 깨지면 즉시 되돌려야 한다.
`/projects*` 27개에는 이미 인증(`utils/auth.py:48-79` 의 `get_current_user`)이 걸려 있으니 같은 장치를 쓴다.

---

## 작업 4 — 에이전트 자기해결 (진행 중, 이어받을 것)

사용자 불만: "에이전트가 이런 일을 채팅으로만 입력 받아서 대신 해줄 수 있어야 하는데 왜 계속 나한테 시키는거야"

하루에 세 번 같은 일이 났다.
```
다붓 로그인   → "가서 로그인하세요"      (dabut_login 도구로 해결됨)
네이버 비번   → "설정에서 바꿔주세요"     (도구 없음)
노출체크 추가 → "노출지기 화면에서 추가"   (API 자체가 없음)
```

원인은 도구가 읽기·실행만 있고 생성·수정·삭제가 없어서다.
이 작업은 이미 착수되어 있고 `src/` 에 미커밋 변경이 있다. **현재 상태를 먼저 확인하고 이어받아라.**

남은 것:
- `manage_account` — 네이버 계정 추가·비번변경·삭제. `dabut_login` 처럼 카드로 입력을 받는다.
  삭제는 하드 확인 게이트. **네이버에서 비번을 바꿔도 앱의 `accounts.json` 은 그대로라 계속 옛 비번으로 로그인한다.**
- 다붓 프로젝트 CRUD 도구 — `PUT /projects/{id}` 로 `post_steps` 까지 고칠 수 있다.
  맛집3 이미지 문제 때 MongoDB 를 직접 건드렸는데 API 한 번이면 됐다
- API 참조 문서를 에이전트가 필요한 부분만 읽는 방식. `docs/api/` 와 `scripts/build-api-docs.mjs` 가
  이미 만들어져 있다. 문서와 실제 API 의 정합성을 테스트로 고정하는 것이 핵심이다.
  **틀린 문서는 없는 문서보다 나쁘다.**

---

## 알려진 결함 (미해결)

- `run_exposure_check` 가 로컬 저장소 경로(`exposureBotDir`)에 의존한다.
  저장소를 클론하지 않은 컴퓨터에서는 쓸 수 없다. 대시보드 API 로 돌리게 바꾸면 어디서든 된다.
- 노출체크 타겟이 `blog-cron-bot/src/lib/exposure-suite/options.ts:11` 의 유니온 타입이라
  새 타겟 추가가 코드 수정이다. 대시보드에도 추가 버튼이 없다.
- `GET /schedules` 에 소유자 필터가 없어 다른 계정 예약도 보이고, `accountId` 가 마스킹 없이 나간다.
- `cafe-bot` 의 이미지 서버 파싱이 카테고리 4개만 펼치는데 서버는 6개를 돌려준다(잠재 버그).

## 참고 문서

- `docs/API_SPEC.md` — 다붓·바이로·스케줄러·노출지기 API 전수, enum 모음, 함정 목록
- `docs/STATE.md` — 내부 작업 노트
- `src/scheduler-enums.ts` — 스케줄러 enum 사본. 주인은 스케줄러 저장소다
