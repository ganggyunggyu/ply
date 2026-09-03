# 21lab 서비스 API 통합 명세

> **에이전트가 읽는 문서는 여기가 아니라 `docs/api/` 다.**
>
> 이 문서는 사람이 읽는 조사 기록이다. 넓지만 기계가 검사하지 않아서 늙는다.
> 에이전트가 실제로 읽는 것은 `docs/api/*.md` 여섯 장이고, 그쪽은
> `src/api-docs.test.ts` 가 스냅샷·도구 이름·허용목록과 대조해 고정한다.
>
> 둘이 다르면 `docs/api/` 쪽이 맞다. 여기를 고쳤다면 `docs/api/` 도 같이 고치고
> `npm run api:sync` 로 스냅샷을 갱신한다. (바이로는 아직 도구도 문서도 없다.)


## 이 문서에 대하여

| 항목 | 값 |
|---|---|
| 무엇인가 | 다붓 / 바이로 / 스케줄러 / 노출지기 4개 서비스의 HTTP API 전수 명세 |
| 왜 있나 | Ply 에이전트가 "가서 직접 하세요"를 하지 않으려면 어떤 API 가 있고 무엇이 없는지 알아야 한다 |
| 출처 | **각 저장소 소스코드에서 직접 추출.** 기존 문서(`api.md` 등)를 옮긴 것이 아니다 |
| 마지막 확인일 | **2026-09-03** |
| 라이브 검증 | 같은 날 4개 배포 URL 에 실제 요청을 보내 상태코드/스키마 확인 |
| 코드 변경 | **없음.** 조사 전용. 이 문서를 만들며 어떤 저장소도 수정하지 않았다 |

**틀린 문서는 없는 문서보다 나쁘다.** 아래 규칙을 지켜라.

1. 이 문서와 실제 응답이 다르면 **실제 응답이 맞다.** 문서를 고쳐라.
2. 다붓만 `/openapi.json` 이 공개돼 있다(200). 다붓 관련 의심이 들면 문서 대신 그걸 읽어라.
3. 나머지 3개는 스키마 엔드포인트가 **없다.** 이 문서가 유일한 출처다. 그래서 이 문서가 낡으면 에이전트가 400 을 맞는다.
4. `scheduler-server/api.md` 는 **완전히 낡았다.** 파이썬 시절 API 를 문서화하고 있고 실제 Fastify 라우트에 하나도 없다. 컨텍스트에 넣지 마라. → §6-9

### 확인 명령 (문서 신선도 재검증)

```bash
# 다붓 — 오퍼레이션 수와 인증 걸린 수
curl -s https://blog-analyzer.fly.dev/openapi.json | python3 -c "
import json,sys; d=json.load(sys.stdin); p=d['paths']
ops=[(k,m) for k,v in p.items() for m in v if m in ('get','post','put','delete','patch')]
sec=[1 for k,v in p.items() for m,o in v.items() if isinstance(o,dict) and o.get('security')]
print('paths',len(p),'ops',len(ops),'secured',len(sec))"
# 2026-09-03 기준: paths 132 ops 149 secured 27

# 나머지 3개 생존 확인
curl -s -o /dev/null -w "viro %{http_code}\n"      https://cafe-bot-two.vercel.app/api/accounts
curl -s -o /dev/null -w "sched %{http_code}\n"     https://21lab-scheduler.fly.dev/health
curl -s -o /dev/null -w "nochul %{http_code}\n"    https://blog-cron-bot-production.up.railway.app/api/health
```

---

## 목차

- [0. 서비스 지도](#0-서비스-지도)
- [0-1. 교차 색인 — "하고 싶은 일" 별 찾기](#0-1-교차-색인--하고-싶은-일-별-찾기) ← **여기부터 읽어라**
- [0-2. 인증 요약표](#0-2-인증-요약표)
- [1. 다붓 백엔드 (dabut-backend)](#1-다붓-백엔드-dabut-backend)
  - [1-1. 앱 인증 `/auth/app`](#1-1-앱-인증-authapp)
  - [1-2. 프로젝트 `/projects`](#1-2-프로젝트-projects)
  - [1-3. 프로젝트 생성 `/generate/project`](#1-3-프로젝트-생성-generateproject)
  - [1-4. 네이버 계정 `/naver-accounts`](#1-4-네이버-계정-naver-accounts)
  - [1-5. 원고 생성 `/generate/*`](#1-5-원고-생성-generate)
  - [1-6. 검색 `/search/*`](#1-6-검색-search)
  - [1-7. 봇 `/bot/*`](#1-7-봇-bot)
  - [1-8. 분석·네이버 프록시·기타](#1-8-분석네이버-프록시기타)
- [2. 바이로 (VIRO / cafe-bot)](#2-바이로-viro--cafe-bot)
  - [2-1. 아키텍처 — 반드시 먼저 읽어라](#2-1-아키텍처--반드시-먼저-읽어라)
  - [2-2. REST 전수](#2-2-rest-전수)
  - [2-3. operation 디스패치](#2-3-operation-디스패치)
  - [2-4. 워커 루프 프로토콜](#2-4-워커-루프-프로토콜)
- [3. 스케줄러 (21lab-scheduler)](#3-스케줄러-21lab-scheduler)
  - [3-1. 전수 라우트](#3-1-전수-라우트)
  - [3-2. `/schedules` vs `/bot/auto-schedule`](#3-2-schedules-vs-botauto-schedule)
  - [3-3. `/bot/auto-schedule` 바디 전체](#3-3-botauto-schedule-바디-전체)
- [4. 노출지기 (blog-cron-bot dashboard)](#4-노출지기-blog-cron-bot-dashboard)
  - [4-1. 전수 라우트](#4-1-전수-라우트)
  - [4-2. 실행 바디는 job.kind 에 따라 4가지](#4-2-실행-바디는-jobkind-에-따라-4가지)
- [**5. enum·고정값 총람**](#5-enum고정값-총람) ← **사고 1순위 구역**
- [**6. 함정 목록**](#6-함정-목록) ← **사고 2순위 구역**
- [**7. 결손 목록**](#7-결손-목록)
- [8. 에이전트 실행 규칙 요약](#8-에이전트-실행-규칙-요약)

---

## 0. 서비스 지도

| 서비스 | 저장소 | 배포 | 스택 | 하는 일 | 스키마 공개 |
|---|---|---|---|---|---|
| **다붓** | `/Users/ganggyunggyu/Programing/21lab/dabut-backend` | `https://blog-analyzer.fly.dev` | FastAPI | 원고·이미지 생성, 원고 DB, 네이버 계정/프로젝트 보관, 네이버 로그인 프록시 | ✅ `/openapi.json`, `/docs` 무인증 200 |
| **바이로** | `/Users/ganggyunggyu/Programing/cafe-bot` | `https://cafe-bot-two.vercel.app` | Next.js 16 | 네이버 **카페** 자동화 브로커. 잡 적재 + 텍스트 생성만. 실행은 로컬 데스크톱 앱 | ❌ |
| **스케줄러** | `/Users/ganggyunggyu/Programing/21lab/blog-bot/scheduler-server` | `https://21lab-scheduler.fly.dev` | Fastify + BullMQ | 네이버 **블로그** 예약발행 큐 | ❌ |
| **노출지기** | `/Users/ganggyunggyu/Programing/blog-cron-bot/dashboard` | `https://blog-cron-bot-production.up.railway.app` | Next.js 16 | 네이버 **노출 순위 체크** 실행기 + 크론 데몬 관리 | ❌ |

### 서비스 간 실제 의존

```
                     ┌──────────────────────────┐
   바이로 ──원고요청──▶│  다붓 (blog-analyzer)     │◀──원고요청── 스케줄러
   (cafe-bot)         │  /generate/*             │   (21lab-scheduler)
        │             │  /naver-accounts         │        │
        │             │  /auth/app/login  ◀──로그인 프록시──┘
        │             └──────────────────────────┘
        │                        ▲
        │                        │ 이미지
        ▼                        │
   Viro 데스크톱 앱          localhost:3939 (이미지 서버)
   (Electron+Playwright)          ▲
                                  └── 스케줄러도 여기
   노출지기 ── 아무와도 연동 안 됨. 완전 독립.
```

- **MongoDB Atlas 클러스터 공유** `cluster0.stdrfdm.mongodb.net`, **DB 는 분리**: 바이로 `cafe-bot` / 노출지기 `sheet-test` / 스케줄러 `scheduler` / 다붓 별도
- **스케줄러의 로그인은 다붓으로 포워딩된다.** 즉 다붓 계정 = 스케줄러 계정. 토큰도 같은 다붓 JWT 를 쓴다
- **노출지기만 계정 체계가 완전히 다르다** (자체 `members` 컬렉션 + 쿠키). 다붓 토큰으로 노출지기를 못 부르고 그 반대도 안 된다 → 결손 #X1
- 이미지 서버(`localhost:3939`)를 세 프로젝트가 **각자 다른 파서**로 읽는다 → §6-8

---

## 0-1. 교차 색인 — "하고 싶은 일" 별 찾기

**서비스 이름을 모르는 채로 시작할 때 여기서 찾아라.** ❌ 는 API 가 없어서 못 하는 것(§7 결손 번호 표기).

### 계정

| 하고 싶은 일 | 어디 | 호출 |
|---|---|---|
| 네이버 계정 **목록** 보기 | 다붓 | `GET /naver-accounts` (Bearer) → §1-4 |
| 네이버 계정 **추가** | 다붓 | `POST /naver-accounts` (Bearer). **다붓에만 있다.** 스케줄러는 읽기 전용, 바이로는 Server Action 뿐 |
| 네이버 계정 **수정/삭제** | 다붓 | `PUT` / `DELETE /naver-accounts/{id}` |
| 시트에서 계정 **일괄 등록** | 다붓 | `POST /naver-accounts/import` (`dry_run:true` 로 먼저 확인) |
| 스케줄러가 쓰는 계정 목록 | 스케줄러 | `GET /api/blog-accounts` (읽기 전용) |
| 계정 비번이 복호화되는지 확인 | 스케줄러 | `GET /api/blog-accounts/:id/credential-check` |
| **카페**용 계정 목록 (평문 비번 포함) | 바이로 | `POST /api/agent/context` ⚠️ 응답 마스킹 필수 → §6-5 |
| 카페 계정 추가/수정/삭제 | ❌ 결손 #V3 | Server Action 뿐. HTTP 로 못 부른다 |
| 노출지기 체크 대상 블로그 추가 | 노출지기 | `POST /api/accounts` (`listId` 는 `suripet`/`dogmaru` **둘뿐**) |
| 앱 계정(다붓 로그인) 만들기 | 다붓 | `POST /auth/app/signup` (무인증) 또는 `POST /auth/app/users` (Bearer) |
| 앱 계정 **목록/삭제** | ❌ 결손 #D2 | `GET /auth/app/me` (본인)만 있다 |
| LLM API 키 등록 | 다붓 | `PUT /auth/app/api-keys` (Bearer) → §1-1 |

### 원고 · 이미지

| 하고 싶은 일 | 어디 | 호출 |
|---|---|---|
| 원고 하나 뽑기 (모델 지정) | 다붓 | `POST /generate/{모델}` — 54개. **무인증이면 회사 키로 과금됨** → §6-3 |
| 원고 뽑기 (프로젝트 설정대로) | 다붓 | `POST /generate/project` (Bearer) → §1-3 |
| 원고 + 이미지 + HTML 한 번에 | 다붓 | `POST /generate/gpt-with-image` 또는 `/generate/decorate` |
| 이미지만 | 다붓 | `POST /generate/image` (`count` 는 **1~10 클램프**) |
| 이미지 대량 배치 | 다붓 | `POST /generate/image-batch` (Bearer, 키워드 최대 100) → 폴링 `GET /generate/image-batch/{job_id}` |
| **카페**용 원고 (제목/본문/HTML/이미지 완성본) | 바이로 | `POST /api/agent/prepare` `operation:"post-content"`. **브라우저 없이 되는 유일한 생산 작업** |
| 카페 댓글 8개 텍스트 | 바이로 | `POST /api/agent/plan` (유효 `jobId` 필요) |
| 키워드 목록 자동 생성 | 다붓 | `POST /keyword-generator` |
| 원고 검색 | 다붓 | `POST /search/keyword` (무인증) |
| **내가 만든** 원고 목록 | ❌ 결손 #D3 | 키워드/카테고리로만 검색 가능. `owner_id` 필터가 없다 |
| 원고 수정 | 다붓 | `PATCH /search/manuscript/{id}?category=...` (**category 쿼리 필수**) |
| 원고 삭제 | 다붓 | `DELETE /search/manuscript/{id}?category=...` — **소프트 삭제. 실제로 안 지워짐** |

### 블로그 발행 · 예약

| 하고 싶은 일 | 어디 | 호출 |
|---|---|---|
| 블로그 **예약발행 걸기** | 스케줄러 | `POST /bot/auto-schedule` ← **이게 정식.** `/schedules` 는 기능 부족 레거시 → §3-2 |
| 예약 **목록** | 스케줄러 | `GET /schedules?accountId=&status=` (최근 50) |
| 예약 **단건 + 잡 상태** | 스케줄러 | `GET /schedules/:id` |
| 예약 **취소** | 스케줄러 | `DELETE /schedules/:id` (soft, `status='cancelled'`) |
| 예약 **시간/키워드 변경** | ❌ 결손 #S2 | UPDATE 가 통째로 없다. 취소 후 재생성인데 그러면 지문 재사용 함정 → §6-1 |
| 예약 중 **한 건만** 취소/변경 | ❌ 결손 #S3 | 잡 단위 조작 API 없음 |
| pending 잡 즉시 재실행 | 스케줄러 | `POST /schedules/:id/execute` ⚠️ 소유권 체크 없음 → §6-6 |
| 기존 글 **수정** 큐잉 | 스케줄러 | `POST /bot/auto-update` / `/bot/link-update` |
| 이미지만 교체 | 스케줄러 | `POST /bot/image-replace` |
| adhoc(수정) 작업 진행 확인 | 스케줄러 | `GET /api/queues/:accountId/jobs`. **`GET /schedules` 에 안 나온다** → §6-2 |
| 오늘 발행된 글 URL 목록 | ❌ 결손 #S5 | `GET /schedules/:id` 로 예약을 통째로 받아 뒤져야 한다 |
| 큐 상태 대시보드 | 스케줄러 | `GET /api/queues/dashboard` |
| 실패 잡 재시도 | 스케줄러 | `POST /api/queues/:accountId/retry` |
| **쿠키로 직접** 블로그 글쓰기 | 다붓 | `POST /blog/write` (무인증, `cookies[]` 필요) |
| 네이버 로그인해서 쿠키 얻기 | 다붓 | `POST /auth/naver/login` (무인증, IP rate limit 있음) |
| 네이버 로그인만 테스트 | 스케줄러 | `POST /bot/login-test` |

### 카페

| 하고 싶은 일 | 어디 | 호출 |
|---|---|---|
| 카페 목록 | 바이로 | `GET /api/cafes` (쿠키) 또는 `POST /api/agent/context` (Bearer) |
| 댓글 잡 **등록** | 바이로 | `POST /api/agent/prepare` `operation:"comment-job"`. **등록일 뿐 실행 아님** → §2-1 |
| 댓글 잡 **상태 조회** | ❌ 결손 #V1 | REST 없음. UI 를 열어야 한다. **1순위 결손** |
| 댓글 잡 **취소** | ❌ 결손 #V2 | 취소 수단이 0. Mongo 직접 수정뿐 |
| 댓글 계정 풀 뽑기 | 바이로 | `POST /api/agent/pool` (LRU + 중복 제외) |
| 수정 대상 글 고르기 | 바이로 | `prepare` `operation:"manual-modify"` |
| 캡차 풀기 | 바이로 | `POST /api/agent/captcha` (이미지 → 정답) |
| 발행 결과를 DB+시트에 기록 | 바이로 | `POST /api/agent/sync` `operation:"article-published"` |
| 노출 결과 기록 | 바이로 | `sync` `operation:"exposure"` (`status` 는 **한글** `노출`/`미노출`/`확인실패`) |
| 카페 개설 결과 기록 | 바이로 | `sync` `operation:"cafe-created"` |
| 닉네임 변경 기록 | 바이로 | `sync` `operation:"nickname"` |

### 노출 체크

| 하고 싶은 일 | 어디 | 호출 |
|---|---|---|
| 노출 체크 **실행** | 노출지기 | `POST /api/jobs/{jobId}/run` (jobId 16개 고정 + `cafe-check:<id>`) |
| 실행 가능 항목 목록 | 노출지기 | `GET /api/jobs` (`isBlocked`/`blockReason` 도 여기) |
| 실행 로그 실시간 | 노출지기 | `GET /api/runs/{runId}/stream` (SSE) |
| 실행 정지 | 노출지기 | `POST /api/runs/{runId}/stop` |
| 결과 파일 목록/다운로드 | 노출지기 | `GET /api/outputs` / `GET /api/outputs/download?path=` |
| **어제 결과** 다시 보기 | ❌ 결손 #N3 | `GET /api/runs` 는 **메모리 50건.** 재배포하면 소실 |
| 끝난 실행의 로그 다시 보기 | ❌ 결손 #N4 | SSE 만 있고 evict 되면 404. 로그 파일은 있는데 API 가 없다 |
| 체크 대상/시트 바꾸기 | 노출지기 | `PUT /api/preset` ⚠️ **전체 교체다. GET→수정→PUT 필수** → §6-4 |
| 프리셋 일부만 수정 | ❌ 결손 #N1 | PATCH 없음. **에이전트가 프리셋을 통째로 날릴 수 있다** |
| 크론 데몬 껐다 켜기 | 노출지기 | `POST /api/pm2/{app}/{action}` (앱 2개, 액션 3개 고정) |
| 크론 **시각** 바꾸기 | ❌ 결손 #N6 | `cronRestart` 는 읽기만 된다 |
| 1시간 뒤 실행 예약 | ❌ 결손 #N7 | "지금" 실행뿐 |

### 메타 · 스키마

| 하고 싶은 일 | 어디 |
|---|---|
| 다붓 스키마 전체 | `GET https://blog-analyzer.fly.dev/openapi.json` (무인증) |
| 다붓 카테고리 58개 | `GET /projects/categories` (Bearer) 또는 §5-1 |
| 다붓 모델 목록 | `GET /projects/models` (Bearer) 또는 §5-4 |
| 다붓 파이프라인 스텝 카탈로그 | `GET /projects/steps` (Bearer) 또는 §5-2 |
| 스케줄러 `manuscriptType` 12개 | ❌ 결손 #S1 — **API 없음. §5-6 을 읽어라.** 오늘 400 난 직접 원인 |
| 스케줄러 블록 카탈로그 | `GET /api/content-pipelines/blocks` (Bearer) — 이건 있다 |
| 노출지기 target/jobId 목록 | `GET /api/jobs` 에 일부만. 나머지는 §5-9 |
| 바이로 enum 전체 | ❌ API 없음. §5-8 |

---

## 0-2. 인증 요약표

| 서비스 | 방식 | 헤더/쿠키 | 발급 | 게이트 위치 | 끄기 가능? |
|---|---|---|---|---|---|
| 다붓 | HS256 JWT | `Authorization: Bearer <token>` | `POST /auth/app/login` | **라우터 함수마다 `Depends`** (전역 훅 아님) | – |
| 스케줄러 | **다붓과 같은 JWT** | `Authorization: Bearer <token>` | `POST /api/auth/login` (다붓으로 프록시) | Fastify 전역 `onRequest` 훅 | ⚠️ **있다** — `JWT_SECRET` 또는 `DABUT_APP_MONGO_URI` 없으면 **전 API 개방** |
| 바이로 (웹) | 쿠키 | `cafe-bot-user-id` (httpOnly, 30일) | 웹 로그인 | 각 핸들러 안에서. **미들웨어 없음** | – |
| 바이로 (에이전트) | Bearer 토큰 (32byte hex, SHA-256 저장) | `Authorization: Bearer <agentToken>` | `POST /api/agent/login` (공개, **rate limit 없음**) | `/api/agent/*` 각 핸들러 | – |
| 노출지기 | 자체 HMAC 쿠키 (JWT 아님) | `dashboard_session` (httpOnly, 7일) | `POST /api/auth/login` | Next `src/proxy.ts` 엣지 (전 경로) | 없음 (시크릿 없으면 전부 실패 = 안전한 쪽) |

**토큰은 서로 호환되지 않는다.** 다붓 ↔ 스케줄러만 같다. 노출지기·바이로는 완전 별개 → 결손 #X1

무인증 예외:

| 서비스 | 무인증 경로 |
|---|---|
| 다붓 | 149개 중 **122개.** `/docs`, `/openapi.json`, `/generate/*` 대부분, `/search/*` 전부, `/bot/*` 전부, `/auth/naver/*`, `/blog/write` |
| 스케줄러 | `PUBLIC_PREFIXES = ['/api/auth/login','/api/auth/signup','/health','/admin/queues']` — `startsWith` 매칭 |
| 바이로 | `POST /api/agent/login`, `/api/download/viro/*`, `/api/auth/[...nextauth]`. `GET /api/accounts`·`/api/cafes` 는 쿠키 없으면 **`default-user` 로 폴백해 200 + `[]`** |
| 노출지기 | `PUBLIC_PATHS = ['/login','/api/auth/login','/api/health']` |

---

## 1. 다붓 백엔드 (dabut-backend)

`REPO = /Users/ganggyunggyu/Programing/21lab/dabut-backend` — 아래 모든 `file:line` 은 이 루트 기준.

| 항목 | 값 |
|---|---|
| paths | 132 |
| operations | **149** (코드 스캔 = openapi.json, 완전 일치) |
| 인증 필요 | **27** |
| 무인증 | **122** |
| `/docs`, `/openapi.json` | **200 공개** |
| securityScheme | `HTTPBearer` 하나뿐 |

### 라우터 구성

`api.py` 가 56개 generate 라우터 + 21개 기타 라우터를 include. 등록은 `api.py:137-232`.

미들웨어 2개가 **모든** 요청 앞에 붙는다 (`api.py:100-135`):

1. `limit_llm_generation_requests` — `POST /generate/*` 만 세마포어 동시 5개 제한 (`utils/llm_concurrency.py:10`). 초과 시 실패가 아니라 **대기**
2. `apply_account_api_keys` — `/generate/*` 에서 `Authorization` 을 해석해 그 계정 API 키를 ContextVar 에 심는다 (`utils/request_api_keys.py:35-82`). **토큰이 없거나 썩어도 401 을 내지 않고 서버 환경변수 키로 진행** → §6-3

### 인증이 걸린 27개 전부

| 그룹 | 개수 | 경로 |
|---|---|---|
| 앱 계정 | 7 | `GET/PUT /auth/app/api-keys`, `DELETE /auth/app/api-keys/{provider}`, `POST /auth/app/api-keys/{provider}/test`, `POST /auth/app/change-password`, `GET /auth/app/me`, `POST /auth/app/users` |
| 프로젝트 | 11 | `/projects` 전부 |
| 네이버 계정 | 7 | `/naver-accounts` 전부 |
| 생성 | 2 | `POST /generate/project`, `POST /generate/image-batch` |

인증 실패는 항상 `401 {"detail":"로그인이 필요합니다."}` (없음/서명오류/만료/`is_active:false` 전부 동일). 인증 걸린 리소스는 `owner_id` 로 격리되고 남의 것은 404 (`routers/_shared.py:36-49`).

### 1-1. 앱 인증 `/auth/app`

`routers/auth/app_auth.py`

| 메서드 | 경로 | 용도 | 인증 | 요청 핵심 | 응답 핵심 | file:line |
|---|---|---|---|---|---|---|
| POST | `/auth/app/login` | 로그인 → JWT | – | `username`, `password` | `access_token`, `token_type:"bearer"`, `user{id,username,label,is_active}` | :106 |
| POST | `/auth/app/signup` | 공개 가입 (201) | – | `username`(2~40), `password`(**≥8**), `label` | `access_token`, `user`, `requires_api_key:true` | :126 |
| GET | `/auth/app/me` | 내 계정 | ✅ | – | `UserOut` | :192 |
| POST | `/auth/app/change-password` | 비번 변경 | ✅ | `current_password`, `new_password`(≥8) | `{ok:true}` | :197 |
| GET | `/auth/app/api-keys` | 키 등록 현황 | ✅ | – | `providers[]{provider,label,configured,masked,source}`, `encryption_available` | :215 |
| PUT | `/auth/app/api-keys` | 키 등록/수정 | ✅ | `keys:{provider:key}` — **빈 문자열 = 삭제** | `ApiKeyListResponse` | :221 |
| DELETE | `/auth/app/api-keys/{provider}` | 키 삭제 | ✅ | – | `ApiKeyListResponse` | :268 |
| POST | `/auth/app/api-keys/{provider}/test` | 키 유효성 | ✅ | `key`(비우면 저장된 키) | `{provider,label,ok,message,source}` | :284 |
| POST | `/auth/app/users` | 관리자용 계정 생성 (201) | ✅ | `username`, `password`(≥8), `label`, `copy_projects_from` | `UserOut` | :333 |

- `signup` 계정은 `allow_env_api_key=False` 로 박힌다 (`:147`). 서버 키 폴백 차단 → 본인 키 없으면 원고 생성이 400
- `PUT /api-keys`, `POST /naver-accounts` 는 서버에 `API_KEY_ENC_SECRET` 이 없으면 **503**
- `ApiKeyUpdateRequest.keys` 는 **다붓에서 유일하게 모르는 키를 400 으로 막는다** (`:238-243`)

### 1-2. 프로젝트 `/projects`

`routers/project.py` — 전부 인증

| 메서드 | 경로 | 용도 | 요청 핵심 | 응답 핵심 | file:line |
|---|---|---|---|---|---|
| GET | `/projects` | 목록 | query `include_inactive=false` | `ProjectOut[]` | :127 |
| POST | `/projects` | 생성 (201) | `ProjectCreate` | `ProjectOut` | :143 |
| GET | `/projects/{project_id}` | 단건 | – | `ProjectOut` | :138 |
| PUT | `/projects/{project_id}` | 부분 수정 | `ProjectUpdate` (전 필드 optional) | `ProjectOut` | :222 |
| DELETE | `/projects/{project_id}` | 하드 삭제 | – | `{ok:true}` | :247 |
| POST | `/projects/{project_id}/duplicate` | 복제 (201) | – | `ProjectOut` (label 에 " 복사본") | :171 |
| PUT | `/projects/reorder` | 순서 일괄 | `{ids:string[]}` (minItems 1) | `{ok:true, updated:int}` | :189 |
| GET | `/projects/steps` | **스텝 카탈로그** | – | `PIPELINE_STEPS[]` + config_schema | :99 |
| GET | `/projects/presets` | 스텝 프리셋 | – | `PIPELINE_PRESETS[]` | :105 |
| GET | `/projects/categories` | db_category 후보 | – | `string[]` (58개) | :115 |
| GET | `/projects/models` | 모델 드롭다운 | – | `[{value,label,provider,provider_label,description}]` | :121 |

`ProjectCreate` / `ProjectOut` 필드 (`schema/project.py:50-101`):

```
label(1~60, 필수)  description=""  system_prompt=""  user_prompt_template=""
prompt_files: [{name(1~200), content=""}]
model(minLength 1, 필수)
pre_steps / post_steps: [{type, config:{}}]
db_category=""  order=0  is_active=true
key(선택, POST 만) → 응답에는 항상 서버 확정 key
ProjectOut 추가: id, key, owner_id
```

**파이프라인 스텝(post_steps) 수정은 API 로 된다.** 앱 UI 로만 되는 게 아니다.

```
PUT /projects/{project_id}
Authorization: Bearer <token>
{ "post_steps": [
    {"type":"images",  "config":{"count":5,"source":"photo"}},
    {"type":"decorate","config":{"image_slots":5}}
]}
```

- `pre_steps`/`post_steps` 는 **통째로 교체.** 부분 병합 없음 → `GET` → 수정 → `PUT`
- `post_steps: []` 로 비울 수 있다. `post_steps: null` 은 **무시된다** → §6-4
- 모르는 `type` → 400 / 모르는 config 키 → 조용히 버림 / 범위 밖 숫자 → 조용히 clamp
- `phase` 를 잘못 넣어도(예: `web_search` 를 post 에) 저장은 되고 실행 시 `log.warning` 만 (`llm/pipeline_runner.py:234-235`)
- 이미지 장수만 바꾸려면 프로젝트를 안 고치고 `POST /generate/project` 의 `image_count` 로 override 가능 (`pipeline_runner.py:127`). 그 요청만 원고만 뽑으려면 `with_images:false`

### 1-3. 프로젝트 생성 `/generate/project`

`routers/generate/project_generate.py:86` — **인증 필요**

요청 (`schema/project.py:103-113`):

```
project_id (min 1, 필수)
keyword    (min 1, 필수)
ref = ""
business_name = ""     # web_search 스텝에서 업체 고정
image_count = null     # 안 주면 프로젝트 스텝의 count 사용
with_images = true     # false면 images 스텝이 있어도 안 만든다
```

응답 — **`response_model` 이 없다. 스텝 구성에 따라 키 개수가 달라진다.**

항상 있는 것:
```json
{ "content": "...", "_id": "...|null", "manuscript_id": "...|null",
  "project": {"id","key","label"}, "ref": "실제 사용된 참조" }
```
`images` 스텝이 있고 **성공했을 때만** 추가 (`pipeline_runner.py:160-171`):
```json
{ "zip_url": "https://...|null", "images": [{"url","section_title"}], "total": 5, "failed": 0 }
```
`decorate` 가 있고 성공했을 때만 (`pipeline_runner.py:194`): `{"html":"...","article_html":"..."}`

에러: 404 프로젝트 없음 / 400 모델에 맞는 API 키 없음 (`:83`) / 400 `ValueError` / 500 생성 실패.

⚠️ **스텝이 실패해도 200 이 온다. 키가 통째로 사라질 뿐이다** → §6-2

### 1-4. 네이버 계정 `/naver-accounts`

`routers/naver_account.py` — 전부 인증

| 메서드 | 경로 | 용도 | 요청 핵심 | 응답 | file:line |
|---|---|---|---|---|---|
| GET | `/naver-accounts` | 목록 | query `include_inactive`, `category`, `group` | `NaverAccountOut[]` | :87 |
| POST | `/naver-accounts` | 생성 (201) | `NaverAccountCreate` (`password` 필수) | `NaverAccountOut` | :117 |
| GET | `/naver-accounts/{id}` | 단건 | – | `NaverAccountOut` | :112 |
| PUT | `/naver-accounts/{id}` | 수정 | `NaverAccountUpdate` (`password` 생략 시 유지) | `NaverAccountOut` | :161 |
| DELETE | `/naver-accounts/{id}` | 삭제 | – | `{ok:true}` | :196 |
| GET | `/naver-accounts/categories` | facet | – | `{categories:[{name,count}], groups:[...]}` | :77 |
| POST | `/naver-accounts/import` | 시트 TSV/CSV 일괄 | `raw`(min 1), `has_header=true`, `dry_run=false`, `mode` | `NaverAccountImportResponse` | :214 |

비밀번호는 Fernet 암호화 저장. 응답에는 `has_password: bool` 만 (`schema/naver_account.py:57-58`).
제약: `name` 1~120, `login_id` 1~80. `mode` 는 `"upsert"`(기본)/`"skip"` — **openapi enum 이라 틀리면 422**.

### 1-5. 원고 생성 `/generate/*`

`project`, `image-batch` 를 뺀 전부 **무인증**.

#### A. 범용 원고 — `GenerateRequest` (`schema/generate.py:5-12`)

요청 `{service(필수), keyword(필수), ref="", category="", persona_id=null, persona_index=null, content_type=""}`

해당 경로 (전부 POST, 무인증):
`/generate/gpt-5-2`, `/gpt4o`, `/chatgpt4o`, `/gpt-ver3-clean`, `/gpt-ceo`, `/gemini-3-pro`, `/gemini-3-flash`, `/gemini-3-flash-clean`, `/gemini-new`, `/gemini-cafe`, `/gemini-ceo`, `/grok`, `/grok-new`, `/grok-ver3-clean`, `/grok-hanryeo`, `/deepseek`, `/deepseek-new`, `/solar`, `/solar-ver3-clean`, `/openai-new`, `/keigo`, `/kimdongpal`, `/nyangnyang`, `/alibaba`, `/tete`, `/hanryeo`, `/hanryeo-skill`, `/blog-filler`, `/blog-filler-pet`, `/blog-filler-restaurant`, `/test`

`/generate/claude`, `/clean-claude`, `/clean-deepseek` 는 **축소 스키마** (`service`/`keyword`/`ref` 만, `service` 에 기본값, `routers/generate/claude.py:14-17`).

응답 — `response_model` 없음. **Mongo 문서를 그대로 반환** → camelCase + `_id`:
```json
{ "content":"원고 본문", "createdAt":"...", "engine":"모델명",
  "service":"요청한 service", "category":"판정된 DB명", "keyword":"...", "_id":"..." }
```
라우터마다 필드가 조금씩 다르다. 예: `/generate/tete` 는 `contentType` 추가 + `service` 를 `"{service}_tete"` 로 저장 (`tete.py:69-76`).

#### B. 이미지·꾸미기 계열

| 경로 | 요청 | 응답 | file:line |
|---|---|---|---|
| POST `/generate/image` | `keyword`(필수), `category=""`, `count=5` | `{images:[{url,section_title}], total, failed}` | gemini_image.py:162 |
| POST `/generate/decorate` | `keyword`, `manuscript`(필수), `category=""`, `image_count=5` | `{html, article_html, zip_url\|null, images[], total, failed}` | decorate.py:75 |
| POST `/generate/gpt-with-image` | `keyword`(필수), `ref=""`, `image_count=5` | `{content, manuscript_id\|null, html, article_html, zip_url\|null, images[], total, failed}` | gpt_with_image.py:137 |
| GET `/generate/image-models` | – | `[{value,label,provider,...}]` | image_batch.py:279 |
| POST `/generate/image-batch` | ✅인증. `keywords[]`(1~100), `count=5`, `category=""`, `image_model=""` | `ImageBatchJob` (즉시 `status:"pending"`) | image_batch.py:285 |
| GET `/generate/image-batch/{job_id}` | **무인증** | `ImageBatchJob` | image_batch.py:349 |
| GET `/generate/image-batch/{job_id}/download` | **무인증.** `zip_ready` 아니면 **409** | `application/zip` | image_batch.py:358 |
| DELETE `/generate/image-batch/{job_id}` | **무인증** | `{deleted: job_id}` | image_batch.py:378 |

`ImageBatchJob` = `{job_id, status, root, count, items[{keyword,folder,status,total,failed,error,images[]}], done_keywords, total_keywords, total_images, failed_images, zip_ready, zip_name, error, elapsed}`

⚠️ `_JOBS` 는 **메모리 dict** (`:63`). 서버 재시작 = 진행 중 작업 소멸.
⚠️ 시작만 인증이고 조회/다운로드/삭제는 무인증. `job_id` 는 `uuid4().hex[:12]`. 남의 job_id 를 알면 ZIP 을 받고 지울 수 있다 → §6-5

#### C. 나머지 생성 계열

| 경로 | 요청 | 응답 | file:line |
|---|---|---|---|
| POST `/generate/batch` | `service`, `keywords[]`, `ref`, `generate_images=true`, `image_count=5` | `{total, success:int, failed:int, elapsed, results[{keyword,success:bool,...}]}` | batch.py:135 |
| POST `/generate/stream` | `model="gpt-5.6-luna"`, `system_prompt`, `user_prompt`(필수), `max_tokens=4096` | **SSE** `text/event-stream` | stream.py:21 |
| POST `/generate/comment` | `keyword`(필수) | `{success,comment,model,elapsed}` | comment.py:27 |
| POST `/generate/recomment` | `parent_comment`(필수), `keyword=""` | 동일 | recomment.py:28 |
| POST `/generate/test/comment` | `prompt`(필수), `model="gpt-5.6-luna"` | 동일 | test_comment.py:29 |
| POST `/generate/test/recomment` | `prompt`, `model` | 동일 | test_recomment.py:29 |
| POST `/generate/test/cafe-daily` | `prompt`, `model="deepseek-v4-flash"` | `{success,content,model,elapsed}` | test_cafe_daily.py:29 |
| POST `/generate/gemini-cafe-daily` | `service="cafe_daily"`, `keyword`(필수), `persona_id:int\|null`(**1~18**), `product_name="한려담원 흑염소진액"` | Mongo 문서 + `persona_id`, `persona` | gemini_cafe_daily.py:29 |
| GET `/generate/gemini-cafe-daily/personas` | – | `{count:18, personas:[{id,name,age,info,tone}]}` | gemini_cafe_daily.py:100 |
| POST `/generate/restaurant/v1`, `/v2` | `keyword`(필수), `ref`, `business_name`, `blog_name` | 문서 | restaurant_v1.py:23 / v2:23 |
| POST `/generate/restaurant-gemini` | `keyword`(필수), `ref=""` | `{content,keyword,model,char_count,elapsed}` | restaurant_gemini.py:30 |
| POST `/generate/update-restaurant` | `keyword`(필수), `ref=""` | 동일 | update_restaurant.py:30 |
| POST `/generate/cafe-total` | `keyword`(필수), `ref=""`, `model=""` | 동일 | cafe_total.py:31 |
| POST `/generate/ghost-story` | `keyword`(필수), `setting`, `style` | `{content,keyword,setting,style,model,char_count,elapsed}` | ghost_story.py:33 |
| POST `/generate/x-illustrator`, `/nyangnyang` | `keyword`(필수), `context=""` | `{content,model,elapsed}` | x_illustrator.py:31,71 |
| POST `/keyword-generator` | `categories[]`(필수), `count=60`, `include_keywords`, `exclude_keywords`, `shuffle=true`, `note=""`, `prompt_profile="default"` | `{keywords:[{keyword,category,type}], count, model}` | keyword_generator.py:39 |

#### `/generate/*` 응답 필드 의미

| 필드 | 어디서 나오나 | 타입 |
|---|---|---|
| `images` | images 스텝 성공 시 / `/generate/image`, `/decorate`, `/gpt-with-image` | `[{url, section_title}]` — **URL 문자열 배열이 아니다.** 단 `ImageBatchItem.images` 만 예외로 `string[]` |
| `zip_url` | 위와 동일 | `string \| null`. 업로드 실패나 0장이면 null |
| `article_html` | decorate 계열 | `string` — copy-content 안쪽 원고 조각만 |
| `html` | decorate 계열 | `string` — 복사 버튼 포함 전체 페이지 |
| `total` | images 계열 | `int` — **성공 장수** (`len(images)`) |
| `failed` | images 계열 | `int` — 실패 장수. `total+failed` = 요청 장수 |
| `content` | 원고 계열 전부 | `string` |
| `manuscript_id` / `_id` | project_generate, gpt-with-image | `string \| null` |

- `/generate/project` 는 위 키를 **전부 optional 로 취급**해야 한다
- `/generate/decorate`, `/generate/gpt-with-image` 는 `response_model` 이 있어 **항상 존재** (실패해도 `total:0, failed:N, zip_url:null`)
- `/generate/batch` 만 `total`/`failed` 가 **키워드 개수**이고 `success` 는 bool 이 아니라 **성공 건수 int**

### 1-6. 검색 `/search/*`

전부 **무인증**. `user_id` 는 그냥 쿼리 문자열이라 아무 값이나 넣으면 그 사람 북마크/히스토리를 읽고 지운다 → §6-5

| 메서드 | 경로 | 요청 | 응답 | file:line |
|---|---|---|---|---|
| POST | `/search/keyword` | body `query`(필수), `category`, `page≥1`, `limit 1~100` | `{documents[], total, page, limit, ...}` | keyword.py:125 |
| POST | `/search/all` | body `q`(필수), `limit 1~100` | 통합 결과 | all.py:88 |
| GET | `/search/autocomplete` | query `q`(**≥2자**), `limit 1~10` | 후보 | autocomplete.py:73 |
| GET | `/search/popular` | query `period` ∈ `today\|week\|month`, `limit 1~20` | 인기 키워드 | popular.py:89 |
| GET | `/search/stats` | query `period` ∈ `day\|week\|month` | 통계 | stats.py:107 |
| GET | `/search/manuscript/{id}` | query `category` (선택) | 원고 문서 | manuscript.py:73 |
| DELETE | `/search/manuscript/{id}` | query `category` **필수** | `{ok:true, deletedId}` (**소프트**) | manage.py:20 |
| PATCH | `/search/manuscript/{id}` | query `category` 필수 + body `{content(필수), memo}` | `{ok:true, manuscript{...}}` | manage.py:44 |
| PATCH | `/search/manuscript/{id}/visibility` | query `category` 필수 | `{ok:true, visible:bool, manuscriptId}` | manage.py:73 |
| GET | `/search/manuscripts/visible` | query `category`, `page≥1`, `limit 1~100` | `{documents[], total, skip, limit}` | manage.py:97 |
| GET/POST/DELETE | `/search/history` | query `user_id` **필수**; POST body `{keyword,category}`; DELETE query `keyword`(생략 시 전체 삭제) | – | history.py:116,135,156 |
| GET/POST | `/search/bookmarks` | query `user_id` 필수, `limit 1~100`, `offset≥0`; POST body `{manuscript_id,category,keyword,preview}` | – | bookmark.py:176,197 |
| DELETE | `/search/bookmarks` | query `user_id`, `manuscript_id` 둘 다 필수 | – | bookmark.py:250 |
| DELETE | `/search/bookmarks/{bookmark_id}` | query `user_id` 필수 | – | bookmark.py:229 |
| GET | `/search/bookmarks/check` | query `user_id`, `manuscript_id` | `{bookmarked:bool,...}` | bookmark.py:271 |

### 1-7. 봇 `/bot/*`

`routers/bot/`, prefix 는 `__init__.py:16`. **전부 무인증.** 네이버 계정 id/password 를 body 로 평문 수신.

| 메서드 | 경로 | 용도 | 요청 핵심 | file:line |
|---|---|---|---|---|
| GET | `/bot/health` | 헬스 + 큐 카운트 | – | health.py:10 |
| GET | `/bot/batch-id` | 배치 ID 발급 | → `{batch_id}` | upload.py:20 |
| POST | `/bot/upload` | ZIP 업로드 (multipart) | `file`, `batch_id` | upload.py:38 |
| GET | `/bot/pending` | pending 목록 | → `{count, manuscripts[]}` | upload.py:156 |
| DELETE | `/bot/pending` | pending 전체 삭제 | – | upload.py:181 |
| DELETE | `/bot/pending/{manuscript_id}` | 개별 삭제 | – | upload.py:166 |
| POST | `/bot/prepare` | 원고 수동 저장 | `{manuscript:{title,content,tags,category,images}}` | manuscript.py:30 |
| GET | `/bot/queue` | 상태별 목록 | query `status="pending"` | manuscript.py:62 |
| GET/DELETE | `/bot/manuscript/{id}` | 조회 / 삭제 | – | manuscript.py:73,91 |
| POST | `/bot/retry/{id}` | failed → pending | – | manuscript.py:106 |
| GET | `/bot/queues` | 진행중 큐 목록 | – | queue.py:49 |
| GET/DELETE | `/bot/queue/{queue_id}` | 상세 / 삭제(원고 복원) | – | queue.py:59,208 |
| POST | `/bot/queue/create` | 큐 생성 | `{manuscript_ids[], account_id, schedule_date}` | queue.py:74 |
| POST | `/bot/queue/create-all` | pending 전부로 큐 | query `account_id`, `schedule_date` | queue.py:96 |
| POST | `/bot/queue/start` | 큐 발행 시작 | `{queue_id, account{id,password}, use_schedule=true, schedule_date, schedule_start_hour=10, schedule_interval_hours=1, schedule_interval_minutes=0, delay_between_posts=60}` | queue.py:120 |
| POST | `/bot/start` | pending → 큐 → 발행 | `{account{id,password}, manuscript_ids, delay_between_posts=10, use_schedule=true, ...}` | start.py:39 |
| POST | `/bot/publish` | 쿠키로 직접 발행 | `{cookies[], manuscript_ids, use_schedule=false, ...}` | publish.py:38 |
| POST | `/bot/auto` | 생성+로그인+발행 풀오토 | `{account{}, keywords[], service="default", ref, generate_images=true, image_count=5, use_schedule=true, schedule_start_hour=10, schedule_interval_hours=1, delay_between_posts=10}` | auto.py:46 |
| POST | `/bot/auto-schedule` | 다중 큐 예약발행 | `{queues:[{account,keywords[],service,ref,posts_per_day,interval_hours}], start_date(필수), start_hour=10, posts_per_day=3, interval_hours=2, delay_between_queues=60, ...}` | auto_schedule.py:332 |
| POST | `/bot/upload-schedule` | ZIP + 예약발행 (multipart) | `file`, `account_id`, `password`, `start_date` 필수 | upload_schedule.py:29 |

`account` 는 **자유 dict.** `id`/`password` 없으면 400 (`queue.py:130`, `start.py:45`, `auto.py:53`).

> ⚠️ 다붓의 `/bot/auto-schedule` 과 **스케줄러의 `/bot/auto-schedule` 은 완전히 다른 API 다.** 경로가 같아 헷갈리기 쉽다. 블로그 예약발행의 정식 경로는 **스케줄러 쪽**이다(§3-3).

### 1-8. 분석·네이버 프록시·기타

| 메서드 | 경로 | 요청 | 응답 | file:line |
|---|---|---|---|---|
| POST | `/manuscript/ingest` | `{text(min 1), keywords[] ≤32개, 각 60자 이하}` | `{docId,charCount,sentenceCount,keywordCount,keywords[]}` | ingest.py:27 |
| POST | `/manuscript/toggle-visibility` | `{category, manuscript_id}` | `{success,manuscript_id,isVisible,message}` | visibility.py:23 |
| GET | `/manuscript/visibility/{category}/{manuscript_id}` | – | 노출 상태 | visibility.py:78 |
| GET | `/ref`, `/ref/{keyword}` | – | 참조문서 | get_ref.py:33,57 |
| GET | `/category/{keyword}` | – | 판정된 카테고리 | category/keyword.py:7 |
| GET | `/test/test` | – | `{message:"Test successful"}` | test/test.py:5 |
| POST | `/analysis/sub-title` | `{text, top_k=7}` | `{subtitles[], domain_hints{}}` | get_sub_title.py:21 |
| POST | `/analysis/upload-text` | multipart `files[]` | 텍스트 배열 | upload_text.py:23 |
| POST | `/api/analysis/{expression,parameter,subtitle}` | `{text(필수), category="", file_name=""}` | 각각 다름 | analyzer_router.py:57,70,83 |
| POST | `/api/analysis/template` | `{user_instructions,docs,category (전부 필수), file_name}` | `{templated_text}` | analyzer_router.py:95 |
| POST | `/api/analysis/all` | `{text,category (필수), file_name}` | `{expressions,parameters,subtitles,templated_text}` | analyzer_router.py:124 |
| POST | `/api/analysis/txt-all` | multipart `file` | `{parsed_data,expressions,parameters,subtitles,templated_text}` | analyzer_router.py:153 |
| POST | `/auth/naver/login` | `{id, password}` | 200 `{success:true,sessionId,cookies[],message}` / **400** 실패 / **429** rate limit | auth/naver.py:222 |
| POST | `/auth/naver/logout` | `{sessionId}` ← **camelCase 예외** | `{success,message}` / 404 | auth/naver.py:276 |
| GET | `/auth/naver/status` | query `sessionId` | `{valid:bool,...}` — **없음/만료 모두 200** | auth/naver.py:296 |
| POST | `/blog/write` | `{cookies[](필수), title, content, category, tags[], images[], is_public=true, schedule_time}` | 200 / **400** `{error:"WRITE_FAILED",message}` | auth/blog_write.py:35 |

---

## 2. 바이로 (VIRO / cafe-bot)

저장소 `/Users/ganggyunggyu/Programing/cafe-bot` · package `viro` v0.2.2 · 배포 `https://cafe-bot-two.vercel.app` · 로컬 3007

### 2-1. 아키텍처 — 반드시 먼저 읽어라

네이버 **카페** 바이럴 자동화. 글쓰기 + 댓글 + 대댓글 + 카페 개설 + 닉네임 변경 + 노출확인. 블로그는 안 함.

**컨트롤플레인 / 데이터플레인이 분리돼 있다:**

- **Vercel 은 브라우저를 못 띄운다.** MongoDB 에 잡을 적재하고 원고/댓글 텍스트를 생성하는 **브로커**일 뿐
- 실제 네이버 조작은 사용자 PC 의 **Viro 데스크톱 앱**(Electron + Playwright)이 한다. `agent/` 디렉터리가 그 클라이언트
- 데스크톱은 DB/Redis 자격증명이 없다. **Bearer 토큰 하나로 `/api/agent/*` 만 호출** (`src/shared/lib/agent-broker/index.ts:26-32`)
- BullMQ + Redis 큐는 **로컬 실행 경로 전용 레거시.** Vercel 에서 안 돈다

> **결론: 바이로에 "지금 실행해"는 없다.** 전부 큐 등록 → 로컬 워커가 소비.
> 에이전트가 "발행했습니다"라고 말하면 **거짓말**이다. "발행 대기열에 넣었습니다"가 맞다.

### 2-2. REST 전수

라우트는 **16개뿐.** 전부 `src/app/api/**/route.ts`.

#### 공개 / 쿠키 인증

| 메서드 | 경로 | 용도 | 인증 | 응답 | file:line |
|---|---|---|---|---|---|
| GET | `/api/accounts` | 활성 계정 요약 | 쿠키 `cafe-bot-user-id` (없으면 `default-user`) | `[{accountId,nickname,isMain}]` | accounts/route.ts:6 |
| GET | `/api/cafes` | 활성 카페 요약 | 동상 | `[{cafeId,name,isDefault}]` | cafes/route.ts:6 |
| GET/POST | `/api/auth/[...nextauth]` | 네이버 OAuth | – | NextAuth | :3 |
| GET | `/api/download/viro/mac` | dmg 리다이렉트 | 없음 | 307 → GitHub Release | :6 |
| GET | `/api/download/viro/windows` | exe 리다이렉트 | 없음 | 307 | :7 |

`/api/auth/*`(next-auth)는 **의존성만 있고 실제 인증엔 안 쓴다.** 진짜 인증은 쿠키 `cafe-bot-user-id`.

#### 에이전트 브로커 `/api/agent/*` — 전부 POST, 전부 `Authorization: Bearer <agentToken>`

| 메서드 | 경로 | 용도 | 인증 | 요청 바디 핵심 | 응답 핵심 | file:line |
|---|---|---|---|---|---|---|
| POST | `/api/agent/login` | VIRO 아이디/비번 → 토큰 | **없음(공개)** | `loginId`, `password` | `{token, displayName}` | login/route.ts:12 |
| POST | `/api/agent/claim` | 대기 잡 1건 원자적 claim | Bearer | `workerId?` | `{job: BrokerJob\|null}` | claim/route.ts:6 |
| POST | `/api/agent/heartbeat` | claim 유지 | Bearer | `jobId`(필수), `workerId?` | `{ok:boolean}` | :6 |
| POST | `/api/agent/result` | 잡 완료 리포트 | Bearer | `jobId`(필수), `status`, `results[]`, `deleteResults[]`, `errorMessage?`, `agentSummary?` | `{ok:boolean}` | :6 |
| POST | `/api/agent/accounts` | 계정 목록 **+ 평문 비번** | Bearer | `scope:'all'\|'commenter'` | `{accounts:[{accountId,password,nickname}]}` | :11 |
| POST | `/api/agent/context` | 계정 전체 + 카페 전체 **+ 평문 비번** | Bearer | `{}` | `{accounts:[{accountId,password,nickname,isMain,role,excludeFromAutoComment}], cafes:[…]}` | :8 |
| POST | `/api/agent/pool` | 잡별 댓글 계정 풀 (LRU+중복제외) | Bearer | `jobId`(필수), `ownerNickname`, `needed`, `reusableAccountIds[]` | `{pool: CommentAccount[]}` | :6 |
| POST | `/api/agent/plan` | 본문 스냅샷 → 댓글 8개 | Bearer | `jobId`(필수), `article.body`(필수), `article.title`, `article.ownerNickname` | `{comments:string[], summary?}` | :11 |
| POST | `/api/agent/captcha` | 캡차 이미지 → 정답 | Bearer | `image`(필수), `accountId`(필수), `question?`, `kind` | `{answer}` | :10 |
| POST | `/api/agent/prepare` | 실행 전 준비물 생성 | Bearer | `{operation, payload}` | operation별 | prepare/route.ts:22 |
| POST | `/api/agent/sync` | 실행 후 결과 DB/시트 반영 | Bearer | `{operation, payload}` | `{ok, sheetSynced?}` | sync/route.ts:175 |

**라이브 실측 (2026-09-03, 프로덕션):**
```
200 /  ·  200 /api/accounts → []  ·  200 /api/cafes → []  ·  307 /api/download/viro/mac
401 {"error":"unauthorized"}  — /api/agent/{claim,context,pool,prepare,sync}
400 {"error":"아이디와 비밀번호를 입력하세요"} — /api/agent/login
```

### 2-3. operation 디스패치

`prepare`/`sync` 는 **URL 이 아니라 body 의 `operation` 문자열이 라우팅 키다.** 이걸 모르면 아무것도 못 한다.

#### `/api/agent/prepare` — operation 4종 (`prepare/route.ts:34,65,73,96`)

| operation | payload | 응답 | 비고 |
|---|---|---|---|
| `post-content` | `keywords:string[]`, `ref?`, `attachImages?` | `{manuscripts:[{folderName,title,body,htmlContent,images[],category}]}` | 다붓 `/generate/tete` + 이미지 3장 |
| `comment-job` | `CreateManualCommentJobInput` 그대로 | `{success, jobId}` 200 / `{success:false,error}` **400** | 댓글 잡 등록 |
| `rewrite-content` | `tasks:[{keyword\|subject, service}]` | `{tasks:[…원본 + newTitle,newContent,images[]]}` | 다붓 `/generate/tete` |
| `manual-modify` | `cafeId`(필수), `count`, `daysLimit?`, `sortOrder?` | `{articles:[{id,articleId,writerAccountId}]}` | 수정 대상 글 조회 |

- `operation` 이 넷 중 하나가 아니면 → `400 {"error":"unsupported operation"}`
- 그 외 예외는 전부 **502** (`prepare/route.ts:128`). 400 이 아니라 502
- `comment-job` 은 payload 를 **`as unknown as` 캐스팅만 하고 검증 안 한다** (`:66-69`). `delayMinMinutes` 누락 → `NaN` → mongoose CastError → **502**

#### `/api/agent/sync` — operation 5종 (`sync/route.ts:189-199`)

| operation | payload 필수 | 하는 일 |
|---|---|---|
| `nickname` | `accountId`, `nickname` | Account 닉네임 갱신 |
| `exposure` | `cafeId`, `status`, (`articleId?`,`rank?`,`foundLink?`) | 노출 상태 DB + 구글시트 |
| `cafe-created` | `cafeId`, `cafeUrl`, `name`, `ownerAccountId`, `presetKey` | 카페 등록 + 운영시트 |
| `article-published` | `articleId`, `cafeId`, `writerAccountId` | PublishedArticle upsert + 일일카운트 + 시트 |
| `article-modified` | `originalId`, `articleId`, `cafeId`, `modifiedBy` | ModifiedArticle upsert + 원본 삭제 |

미지원 operation → `400`. 그 외 예외도 전부 **400** (`sync/route.ts:205-209`).

### 2-4. 워커 루프 프로토콜

**Ply 가 데스크톱 앱을 대체할 수 있다.** 프로토콜은 `agent/lib/broker-client.ts` 218줄이 전부.

```
POST /api/agent/login   → token
     ↓
반복 {
  POST /api/agent/claim      → {job} (없으면 null)
  POST /api/agent/context    → 계정·카페 (평문 비번 ⚠️)
  POST /api/agent/pool       → 댓글 계정 풀
  [브라우저로 카페 글 본문 수집]
  POST /api/agent/plan       → 댓글 8개 텍스트
  [브라우저로 실행 — 로그인·댓글·발행]
  POST /api/agent/heartbeat  → 주기적. 30분 넘기면 다른 워커가 잡을 뺏어간다
  POST /api/agent/result     → {jobId, status:'done'|'failed', results[]}
  POST /api/agent/sync       → 결과를 DB+시트에 기록
}
```

**Ply 도구 후보**

| 도구 | 호출 | 비고 |
|---|---|---|
| `viro_login` | `POST /api/agent/login` | 이후 전부 이 토큰 |
| `viro_list_context` | `POST /api/agent/context` | ⚠️ 평문 비번 포함 → 응답 마스킹 필수 |
| `viro_write_manuscript` | `prepare` op=`post-content` | **브라우저 없이 되는 유일한 생산 작업** |
| `viro_queue_comments` | `prepare` op=`comment-job` | 등록만 |
| `viro_plan_comments` | `POST /api/agent/plan` | 본문 던지면 댓글 8개 초안 |
| `viro_report_result` | `sync` op=`article-published`/`exposure`/`nickname` | **Ply 가 직접 조작한 뒤 결과를 바이로 DB+시트에 기록. 가장 큰 시너지** |
| `viro_pick_modify_targets` | `prepare` op=`manual-modify` | 수정 대상 목록 |
| `viro_solve_captcha` | `POST /api/agent/captcha` | 네이버 로그인 중 캡차 만나면 바로 사용 |

---

## 3. 스케줄러 (21lab-scheduler)

저장소 `/Users/ganggyunggyu/Programing/21lab/blog-bot/scheduler-server` · Fastify + BullMQ
라우트 등록: `src/routes/index.ts:8-18` — `authRoutes(app)` 를 **최상위 인스턴스에 직접** 붙여 전역 훅을 만들고 나머지는 `app.register()`.

### 3-1. 전수 라우트

27개 + Bull Board.

| 메서드 | 경로 | 용도 | 인증 | 요청 바디 핵심 | 응답 핵심 | file:line |
|---|---|---|---|---|---|---|
| GET | `/health` | 헬스체크 | **없음** | – | `status`, `timestamp` | routes/index.ts:17 |
| POST | `/api/auth/login` | 로그인 (다붓 포워딩) | **없음** | `username`, `password` | `accessToken`, `user{id,username,label,isActive}` | auth.route.ts:75 |
| POST | `/api/auth/signup` | 회원가입 (다붓 포워딩) | **없음** | `username`(3~50), `password`(≥8), `label?` | `user{...}` | auth.route.ts:105 |
| GET | `/api/auth/me` | 내 계정 | Bearer | – | `user` | auth.route.ts:135 |
| GET | `/api/blog-accounts` | 네이버 계정 목록 (**읽기 전용**) | Bearer | – | `accounts[]{id,name,loginId,blogId,isActive}` | blog-account.route.ts:11 |
| GET | `/api/blog-accounts/:id/credential-check` | 비번 복호화 확인 | Bearer | – | `ok`, `loginId`, `blogId` | :29 |
| GET | `/api/content-pipelines/blocks` | 블록 카탈로그 + 내장 파이프라인 | Bearer | – | `blocks[]`, `builtins[]` | content-pipeline.route.ts:30 |
| GET | `/api/content-pipelines` | 내 파이프라인 목록 | Bearer | – | `pipelines[]` | :35 |
| POST | `/api/content-pipelines` | 생성/덮어쓰기 (upsert by `key`) | Bearer | `key`, `label`, `blocks[]`, `description?`, `isActive?`, `order?` | `pipeline` | :44 |
| DELETE | `/api/content-pipelines/:key` | 삭제 | Bearer | – | `success` | :64 |
| GET | `/api/queues/dashboard` | 전 계정 큐 카운트 | Bearer | – | `accounts[]{accountId,maskedAccountId,generate,publish}`, `totals` | queue.route.ts:28 |
| GET | `/queues/stats` | 활성 계정 수 (레거시) | Bearer | – | `activeAccounts`, `accounts[]`(마스킹) | :37 |
| GET | `/api/queues/:accountId/jobs` | 계정 큐 잡 목록 | Bearer | query `type`,`status`,`limit` | `count`, `jobs[]` | :46 |
| POST | `/api/queues/:accountId/retry` | 실패 잡 재시도 | Bearer | `type`, `jobId` | `success`, `jobId` | :69 |
| POST | `/api/queues/:accountId/clean` | 끝난 잡 정리 | Bearer | `type`, `status?`, `grace?` | `success`, `status`, `removed` | :83 |
| POST | `/api/queues/:accountId/drain` | 계정 큐 비우기 | Bearer | – | `success`, `drained` | :93 |
| POST | `/api/queues/drain-all` | **전 계정 큐 초기화** ⚠️ | Bearer | – | `success`, … | :106 |
| POST | `/bot/login-test` | 네이버 로그인만 테스트 | Bearer | `accounts[]{id,password}` | `results[]{account,success,fromCache?,error?}` | schedule.route.ts:332 |
| POST | `/schedules` | 예약 생성 (camelCase 레거시) | Bearer | `queues[]{account{id,password},keywords[]}` | `success`, `totalJobs`, `schedules[]` | :350 |
| GET | `/schedules` | 예약 목록 (최대 50, createdAt desc) | Bearer | query `accountId?`, `status?` | `schedules[]` (**Mongo 원문**) | :422 |
| GET | `/schedules/:id` | 예약 1건 + 잡 목록 | Bearer | – | `schedule`, `jobs[]` (**Mongo 원문**) | :443 |
| DELETE | `/schedules/:id` | 예약 취소 (soft, `cancelled`) | Bearer | – | `success`, `id` | :457 |
| POST | `/schedules/:id/execute` | pending 잡 즉시 재큐잉 | Bearer | `account{id,password?,blogId?}` | `success`, `enqueued` | :488 |
| POST | `/bot/auto-schedule` | **예약 생성 (정식 경로)** | Bearer | §3-3 | `success`, `totalJobs`, `schedules[]` | :551 |
| POST | `/bot/auto-update` | 기존 글 수정 큐잉 | Bearer | `queues[]`, `log_nos`, `item_options` 등 | `success`, `totalJobs`, `updates[]` | :731 |
| POST | `/bot/link-update` | 글 URL 지정 수정 | Bearer | `keywords[]`, `links[]`, `manuscripts[]?` | `success`, `totalJobs`, `updates[]` | :881 |
| POST | `/bot/image-replace` | 이미지만 교체 | Bearer | `links[]`, `image_source?`, `image_count?`, `keyword_category?` | `success`, `totalJobs`, `updates[]` | :1044 |
| – | `/admin/queues/*` | Bull Board UI | **Basic** (`ADMIN_QUEUES_PASSWORD`) | – | HTML | app.ts:54-72 |

실측: `/health` 200, 나머지 전부 401. `/admin/queues` 401(Basic realm) → 운영에 비번 세팅됨.

### 3-2. `/schedules` vs `/bot/auto-schedule`

| | `POST /schedules` | `POST /bot/auto-schedule` |
|---|---|---|
| 스키마 | `createScheduleSchema` (`src/schemas/dto.ts:9`) | `pythonCompatSchema` (`schedule.route.ts:75`) |
| 필드 표기 | **camelCase** | **snake_case (혼합)** |
| 계정 지정 | `account.id` + `account.password` **필수** | `account.id` **또는** `account.dabutAccountId` (비번 자동 복호화) |
| 항목별 override | ❌ | `items[]`, `item_options[]` (업체명/원고타입/projectId) |
| 원고 직접 주입 | ❌ | `manuscripts[]`, `multi_images[]` |
| projectId | ❌ | `project_id`, `item_options[].projectId` |
| 커스텀 블록 파이프라인 | ❌ | ✅ `keyword_category` 로 조회 (`:564-567`) |
| manuscriptType 고정모드 | ❌ | ✅ (`alibaba` → mode `3` 강제) |
| 한려담원 UTM 시트 기록 | ❌ | ✅ (`:648-653`) |
| 계정 없을 때 | zod 400 | **200 + `success:false`** ⚠️ |

> **`/schedules` 는 기능이 부족한 레거시다. 에이전트는 `/bot/auto-schedule` 을 써라.**
> 다만 `GET`/`DELETE`/`execute` 는 `/schedules/:id` 쪽에만 있다. 생성은 `/bot/*`, 조회·취소는 `/schedules/*` 로 갈린다.

**`/bot/auto-update`·`/bot/link-update`·`/bot/image-replace` 는 스케줄 레코드를 만들지 않는다.** `buildAdhocGenerateIdentity` 로 가짜 `scheduleId`(`adhoc_update_<digest>`)를 만들어 BullMQ 에 직접 넣는다 (`src/services/schedule-idempotency.service.ts:115`). → **`GET /schedules` 에 안 나온다.** 진행 상황은 `GET /api/queues/:accountId/jobs` 로만.

### 3-3. `/bot/auto-schedule` 바디 전체

```
queues[]                      필수
  .account.id                 str?   ─┐ 둘 중 하나 필요
  .account.dabutAccountId     str?   ─┘
  .account.password           str?   (없으면 blogaccounts → cafe-bot.accounts 순 조회)
  .account.blogId             str?
  .keywords[]                 str[]  필수  ← "키워드:카테고리" 형식 지원 (lastIndexOf ':')
  .manuscripts[]              {title,content}[]?          길이 == keywords 길이
  .multi_images[]             {individual?,slide?,collage?}[]?  길이 == keywords 길이
  .items[]                    {keyword,category?,businessName?,manuscriptType?,scheduledAt,slot}[]?
  .item_options[]             {businessName?,manuscriptType?,projectId?}[]?  길이 == keywords 길이
  .blog_name                  str?
schedule_date        str?      (YYYY-MM-DD, /schedules 쪽만 regex 검증)
schedule_mode        enum      기본 '2'    ← 문자열이다. 숫자 아님
service              str       기본 'default'
ref                  str       기본 ''
generate_images      bool      기본 true
image_count          num       기본 5     ← auto-schedule 은 min/max 없음
image_source         enum      기본 'ai'
manuscript_type      enum      기본 'default'   ← §5-6, 오늘 400 난 지점
project_id           str?      (min 1)
delay_between_posts  num       기본 10    ← auto-schedule 은 min/max 없음
keyword_category     str?
start_hour           int?      0~23
interval_minutes     int?      10~720
posts_per_day        int?      1~10
```

응답은 **전 경로 camelCase** (`scheduleId`, `totalJobs`, `scheduledAt`, `generateJobId`, `maskedAccountId`).
→ **요청은 snake, 응답은 camel. 왕복 매핑이 필요하다.**

---

## 4. 노출지기 (blog-cron-bot dashboard)

저장소 `/Users/ganggyunggyu/Programing/blog-cron-bot/dashboard` · Next.js 16.2.10

### 4-1. 전수 라우트

14파일 / 16 오퍼레이션.

| 메서드 | 경로 | 용도 | 인증 | 요청 바디 핵심 | 응답 핵심 | file:line |
|---|---|---|---|---|---|---|
| GET | `/api/health` | 헬스체크 | **없음** | – | `ok` | health/route.ts:3 |
| POST | `/api/auth/login` | 로그인 | **없음** | `loginId`, `password` | `ok`, `memberId` + `Set-Cookie: dashboard_session` | auth/login/route.ts:21 |
| POST | `/api/auth/logout` | 로그아웃 | 쿠키 | – | `ok` | :4 |
| GET | `/api/jobs` | **내 프리셋에서 돌릴 수 있는 실행 항목** | 쿠키+**회원** | – | `jobs[]`, `bundles[]` | jobs/route.ts:17 |
| POST | `/api/jobs/[jobId]/run` | 실행 시작 | 쿠키+회원+**권한** | job kind 별 (§4-2) | `runId` | run/route.ts:27 |
| GET | `/api/runs` | 실행 이력 (**메모리, 최근 50**) | 쿠키 | – | `runs[]{runId,jobId,jobLabel,status,startedAt,endedAt,exitCode}` | runs/route.ts:4 |
| GET | `/api/runs/[runId]/stream` | 로그 SSE | 쿠키 | – | `event: log` / `event: done{status,exitCode}` | stream/route.ts:8 |
| POST | `/api/runs/[runId]/stop` | 실행 정지 | 쿠키 | – | `ok` | stop/route.ts:8 |
| GET | `/api/outputs` | 결과 파일 목록 (**최근 200**) | 쿠키 | – | `files[]{relativePath,fileName,sizeBytes,modifiedAt}`, `totalCount` | outputs/route.ts:4 |
| GET | `/api/outputs/download?path=` | 결과 파일 다운로드 | 쿠키 | query `path` (OUTPUT_DIR 상대) | octet-stream | download/route.ts:6 |
| GET | `/api/preset` | 내 프리셋 조회 | 쿠키+**회원** | – | `member{id,loginId,displayName}`, `preset` | preset/route.ts:14 |
| PUT | `/api/preset` | 프리셋 **통째로 교체** ⚠️ | 쿠키+**회원** | `{preset:{...}}` (§5-10) | `member`, `preset` | :29 |
| GET | `/api/accounts` | 노출체크 계정 목록 (**전역**) | 쿠키 | – | `lists[]{id,label,seed,added,removed,effective}` | accounts/route.ts:16 |
| POST | `/api/accounts` | 계정 추가/제거 | 쿠키 | `listId` + (`blogIds[]` \| `blogId`+`action`) | `lists[]` | :24 |
| GET | `/api/pm2` | 크론 데몬 상태 | 쿠키 | – | `daemons[]{name,status,pid,uptimeMs,memoryBytes,cpuPercent,restarts,cronRestart}` | pm2/route.ts:4 |
| POST | `/api/pm2/[app]/[action]` | 데몬 start/stop/restart | 쿠키 | – | `ok` | [action]/route.ts:14 |

**`POST /api/jobs` 는 없다.** 실행 항목은 코드 상수(`JOB_REGISTRY` 16개) + 프리셋 `cafeChecks` 에서 파생된다. 새 항목을 만드는 유일한 방법은 **`PUT /api/preset` 으로 `cafeChecks` 를 넣는 것**.

**인증 2단 구조:**
- `src/proxy.ts` (구 middleware) 가 `matcher:['/((?!_next/static|_next/image|favicon.ico).*)']` 로 전 경로를 감싼다. `PUBLIC_PATHS=['/login','/api/auth/login','/api/health']` 만 예외. 실패 시 `/api` 는 401 JSON, 그 외 `/login` 리다이렉트
- 세션 토큰 = `${issuedAt}.${memberId}.${HMAC-SHA256}`, 7일, `DASHBOARD_SESSION_SECRET` 서명
- `readSessionMember` 는 여기에 더해 Mongo `members` 를 다시 읽는다. **쓰는 곳은 `/api/jobs`, `/api/jobs/[jobId]/run`, `/api/preset` 뿐**
- ⚠️ **`/api/runs*`, `/api/outputs*`, `/api/accounts`, `/api/pm2*` 는 회원 식별을 안 한다** → §6-6
- 실행 권한은 `canMemberRunJob(member.preset, jobId)` 로 별도 확인 (403, `run/route.ts:41-47`)

### 4-2. 실행 바디는 job.kind 에 따라 4가지

```
kind='exposure-suite'   (jobId = 'exposure-suite')
  {
    targets?: ExposureTargetId[]   생략 시 프리셋에 켜진 전체
    concurrency?: int   1~50   기본 50
    maxPages?: int      1~9    기본 1
    targetConcurrency?: int 1~3 기본 2 (DISTRIBUTED_EXPOSURE_ENABLED=true 면 1)
  }
  ★ 4개 서비스 전체에서 **모르는 키를 400 으로 거절하는 유일한 경로**
    (ALLOWED_OPTION_KEYS — src/server/exposure-suite-options.ts:26-31, 98-103)
  targets 중복 → 400, 빈 배열 → 400, 프리셋에 없는 target → 400

kind='root-cafe-url'    (jobId='root-cafe-url-exposure')
  { url: string }   네이버 카페 글 주소
  거절: 빈 값 / cafe.naver.com 아님 / 숫자·f-e·ca-fe 형 카페ID
    src/server/root-cafe-url-options.ts:64-79

kind='cafe-check'       (jobId='cafe-check:<checkId>')
  바디 없음. 시트/대상은 프리셋에서 읽어 env 로 전달

kind='standard'         (나머지 12개)
  바디 없음 또는 {}.  그 외 값이 있으면 400 '이 항목은 실행 옵션을 받지 않음'
    src/server/job-command.ts:31-33
```

실행 충돌: 같은 job 중복 실행은 409. 다른 노출체크가 도는 중이면 `resourceGroup:'exposure'` 파일락으로 409 (`job-resource-manager.ts:36-38`). `GET /api/jobs` 의 `isBlocked`/`blockReason` 으로 미리 알 수 있다.

---

## 5. enum·고정값 총람

**여기가 가장 자주 사고나는 구역이다.** 4개 서비스의 모든 고정 목록을 한곳에 모았다.

### 위험도 표기

| 표기 | 의미 |
|---|---|
| 🔴 | **목록 밖 값이면 400/422.** 반드시 목록에서 골라라 |
| 🟡 | **목록 밖이어도 에러 없이 다른 값으로 조용히 바뀐다.** 더 위험하다 |
| ⚪ | 검증 자체가 없다. 자유 문자열 |

### 5-1. 다붓 `db_category` / `category` — 🔴 58개 고정

`_constants/categories.py:7`. `POST/PUT /projects` 의 `db_category` 가 여기 없으면 `400 "등록되지 않은 카테고리입니다: X"` (`routers/project.py:64-77`). 빈 문자열은 허용 = "키워드로 자동 판정".

```
안과, DHC_콜라겐, 가구, 거북목교정기, 애견, 결혼정보회사_결정사, 공항_김포공항,
공항_인천공항, 기타, 다이어트, 다이어트보조제, 라미네이트, 리프트권_가격, 마사지기,
맛집, 멜라논크림, 탈모앰플, 무궁핏, 무지외반증, 바디워시, 써마지, 변비, 브로멜라인,
비타민D, 서브웨이다이어트, 스마일프로, 스위치온다이어트, 스키강습, 스키장,
스키장_셔틀, 스킨부스터, 스텝퍼, 식용유_오일, 알파CD, 에리스리톨, 영양제, 영어회화,
오메가3, 울쎄라, 웨딩홀, 대치동_교육, 유산균, 유아_스키강습, 음식물쓰레기, 인테리어,
전자담배, 정기청소, 족저근막염깔창, 캐리어, 커피머신, 콜라겐, 콜라겐_크림, 탈모,
파비플로라, 헬스장, 호텔, SAT학원, 외고비_마운자로
```
런타임 확인: `GET /projects/categories` (Bearer). **API 로 추가 불가** → 결손 #D6

### 5-2. 다붓 파이프라인 `step.type` — 🔴 3개뿐

`_constants/pipeline_steps.py:20-83`. 목록 밖은 `400 "알 수 없는 스텝 종류입니다: X"` (`routers/project.py:54-57`).

| type | phase | config 키 | 값 | 위험 |
|---|---|---|---|---|
| `web_search` | pre | `use_business_name` | boolean, 기본 `true` | – |
| `images` | post | `count` | number **1~10** 기본 5 | 🟡 범위 밖은 clamp |
| | | `source` | select **`"ai"` \| `"photo"`** 기본 `"ai"` | 🟡 **options 검증 안 함.** `"banana"` 가 저장되고 런타임에 AI 로 떨어짐 |
| `decorate` | post | `image_slots` | number **0~10** 기본 5 | 🟡 clamp |

프리셋 key (`GET /projects/presets`, `pipeline_steps.py:99-133`): `simple`(스텝 없음) / `restaurant`(web_search → images:photo,5 → decorate:5, `db_category:"맛집"`) / `gpt_with_image`(images:ai,5 → decorate:5). **참조가 아니라 복사본**이다.

### 5-3. 다붓 API 키 provider — 🔴 9개 고정

`utils/api_keys.py:36-46`. `PUT /auth/app/api-keys` 는 모르는 provider 에 `400 "지원하지 않는 provider입니다: X"`.

```
openai, gemini, claude, grok, deepseek, solar, kimi, minimax, recraft
```
`recraft` 는 이미지 전용.

### 5-4. 다붓 원고 모델 `project.model` — ⚪ 검증 없음

`schema/project.py:58` 은 `minLength 1` 만 본다. **아무 문자열이나 저장되고**, 잘못된 값은 생성 시점에 `get_ai_service_type()` 판정 실패로 터진다.

정식 목록 20개 (`_constants/model_catalog.py:28-55`, `GET /projects/models`):

```
openai   : gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, gpt-5.2-2025-12-11, gpt-5-mini-2025-08-07
gemini   : gemini-3.6-flash, gemini-3.5-flash, gemini-3-flash-preview,
           gemini-3.1-pro-preview, gemini-3.5-flash-lite, gemini-3.1-flash-lite-preview
claude   : claude-opus-5
grok     : grok-4-1-fast-non-reasoning, grok-4-1-fast-reasoning
deepseek : deepseek-v4-flash, deepseek-v4-pro, deepseek-reasoner
solar    : solar-pro2
kimi     : kimi-k2.5
minimax  : MiniMax-M2.5
```

### 5-5. 다붓 이미지 모델 `image_model` — 🟡 3개, 틀려도 400 아님

`_constants/image_model_catalog.py:54-63`. 모르는 모델명은 **조용히 기본값**으로 떨어진다.

```
gpt-5.6-luna (기본), gemini-2.5-flash-image, gemini-3.1-flash-image-preview
```

### 5-6. 🔴 스케줄러 `manuscriptType` / `manuscript_type` — **12개. 오늘 400 난 지점**

`src/routes/schedule.route.ts:47` **및** `src/schemas/dto.ts:26` — **두 곳에 중복 정의돼 있다. 고칠 때 반드시 같이 고쳐라.**

```
'default' | 'update-restaurant' | 'restaurant' | 'restaurant/v1' | 'restaurant/v2'
| 'pet' | 'grok' | 'keigo' | 'hanryeodamwon' | 'nyangnyang' | 'kimdongpal' | 'alibaba'
기본값 'default'
```

⚠️ **이 목록을 물어볼 API 가 없다** → 결손 #S1. 그래서 에이전트가 추측하고 400 을 맞는다.
⚠️ `manuscript_type='alibaba'` 면 요청한 `schedule_mode` 를 무시하고 `'3'` 을 강제한다 (`src/services/schedule.service.ts:9-21`).
⚠️ **`manuscript_type` 을 `manuscriptType` 으로 잘못 보내면 400 이 아니라 조용히 `'default'` 로 처리된다** → §6-7.

### 5-7. 스케줄러 나머지 enum

```
imageSource / image_source                         🔴
  'ai' | 'google' | 'keyword' | 'product' | 'local'    기본 'ai'
  (/bot/image-replace 만 기본 'product')
  schedule.route.ts:46, 1012

scheduleMode / schedule_mode                       🔴
  '1' | '2' | '3' | '2121'   ← **문자열이다.** 1이 아니라 "1"
  기본 '2'.  '2121' = 하루 2건/1건 교대
  schemas/dto.ts:12, schedule.route.ts:49

schedule status (GET /schedules?status=)           🔴
  'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'    schemas/dto.ts:40

job status (응답 jobs[].status)
  'pending' | 'generating' | 'generated' | 'publishing' | 'published' | 'failed' | 'cancelled'
  schemas/schedule.schema.ts:46

queue type        'generate' | 'publish'
queue status      'waiting' | 'active' | 'completed' | 'failed' | 'delayed'   (GET jobs)
clean status      'completed' | 'failed'  기본 'completed'   🔴 waiting/active/delayed 넣으면 400
  lib/queue/clean-request.ts:13

content-pipeline blocks[] (13개)                   🔴 그 외 값이면 400
  excluded1 | excluded2 | excluded3 | allExcluded | maps | phone | content
  | excludeLibraryLinks | spacing | bottomSpacing | link | multiImages | whiteText
  제약: 'content' 가 **정확히 1번** 있어야 함 (0번/2번 모두 400)
  services/content-pipeline.service.ts:41-77
```

### 5-8. 바이로 enum

| 상수 | 값 | 위험 | 위치 |
|---|---|---|---|
| 댓글 잡 `mode` | `'fixed'` \| `'generate'` \| `'agent'` | 🔴 | models/manual-comment-job.ts:9,93 |
| 댓글 잡 `status` | `'pending'` \| `'running'` \| `'done'` \| `'failed'` | 🔴 | 같은 파일 :8,105 |
| `commentStyle` | `'explain'` \| `'question'` (기본 `explain`) | – | api/cafe-comment-style.ts:5,9 |
| 계정 `role` | `'writer'` \| `'commenter'` — **mongoose enum, 기본값 없음 = undefined 가능** | 🔴+함정 | models/account.ts:90 |
| captcha `kind` | `'login'` \| `'cafe-join'` \| `'cafe-create'` | 🟡 **틀리면 조용히 `'cafe-create'`** | lib/captcha-broker.ts:1 |
| 노출 `status` | `'노출'` \| `'미노출'` \| `'확인실패'` (**한글**) | 🔴 | api/agent/sync/route.ts:26 |
| manual-modify `sortOrder` | `'oldest'`(기본) \| `'newest'` \| `'random'` | 🟡 틀리면 `oldest` | api/agent/prepare/route.ts:108 |
| agent/result `status` | `'done'` \| `'failed'` | 🟡 **`'failed'` 아니면 전부 `'done'`** ← 최악 | api/agent/result/route.ts:15 |
| agent/accounts `scope` | `'all'` \| 그 외 전부 commenter | 🟡 `"ALL"` 도 commenter | api/agent/accounts/route.ts:19 |
| `CAFE_TOPIC_PRESETS.key` (6개) | `health-care`, `health-general`, `living-house`, `living-info`, `daily-social`, `family-parenting` | 🔴 | lib/naver-cafe-creation/presets.ts:24-59 |
| 데스크톱 action type (8개) | `account-login`, `cafe-join-all`, `nickname-change`, `exposure-check`, `cafe-create`, `manual-publish`, `manual-modify`, `rewrite` | 🔴 | agent/lib/desktop-action-contract.ts:34-43 |
| nickname-change `mode` | `'by-cafe'` \| `'by-account'` \| `'all'` | 🔴 | types/viro-desktop.ts:33 |
| rewrite `keywordSource` | `'pool'` \| `'custom'` | 🔴 | 같은 파일 :89 |
| **`CAFE_COMMENT_COUNT`** | **8 고정.** 랜덤/가변 개수 옵션 없음 | 고정 | api/cafe-comment-count.ts:6 |
| 기본 댓글 모델 | `deepseek-v4-flash` (`CAFE_COMMENT_MODEL` 로 override) | – | api/cafe-comment-batch-api.ts:33 |
| plan 모델 | `gpt-5.6-luna` (`MANUAL_COMMENT_GEN_MODEL`/`CAFE_COMMENT_MODEL`) | – | lib/agent-broker/index.ts:156-158 |
| 다붓 fallback 모델 | `gemini-3.1-pro-preview` | – | api/content-api.ts:10 |
| 다붓 `contentType` | `'정보성'` \| `'후기성'` \| `''` (**한글**) | ⚪ | api/content-api.ts:86 |

**키워드 문자열 자체가 enum 캐리어다.** `post-content` 의 `keywords[]` 원소는 **`"키워드:카테고리"`** 포맷. `lastIndexOf(':')` 기준 분리 — 콜론이 여러 개면 마지막 것만 구분자, 콜론 뒤가 비면 전체를 키워드로 취급 (`features/auto-comment/batch/keyword-utils.ts:2-17`). **스케줄러 `keywords[]` 도 같은 포맷을 쓴다.**

### 5-9. 노출지기 enum

```
ExposureTargetId (7개, 고정)                        🔴
  'package' | 'general' | 'dogmaru' | 'root' | 'pet' | 'suripet' | 'cafe'
  shared/config/exposure-contract/index.ts:1-11

jobId (레지스트리 16개, 고정)                        🔴
  package-exposure, general-exposure, dogmaru-exposure, root-exposure,
  cafe-only-exposure, root-cafe-url-exposure,
  package-general-dogmaru-more-exposure, root-more-exposure, dogmaru-more-finalize,
  pet-exposure, pet-exposure-9-direct, suripet-exposure, cafe-exposure,
  reexport-current-exposure, reexport-current-cafe, exposure-suite
  + 동적: 'cafe-check:<프리셋 cafeChecks[].id>'
  server/job-registry.ts:64-236

JobKind        'standard' | 'exposure-suite' | 'root-cafe-url' | 'cafe-check'
JobSection     'daily' | 'more' | 'tool'
executionMode  'local' | 'distributed'
RunStatus      'running' | 'success' | 'failed' | 'stopped' | 'unknown'   server/run-record.ts:1
DaemonAction   'start' | 'stop' | 'restart'                🔴 그 외 400
DaemonAppName  'blog-cron-direct-check-8am' | 'blog-cron-more-check-830am'   🔴 그 외 404
  server/pm2-client.ts:4-10

POST /api/accounts
  listId  'suripet' | 'dogmaru'    🔴 그 외 400 '관리 대상이 아닌 목록임'  ← **전역 하드코딩 2개뿐**
  action  'add' | 'remove'         🔴 그 외 400.  blogIds[] 를 보내면 action 무시하고 항상 add
  blogId 정규화: 소문자, blog.naver.com URL 에서 추출, /^[a-z0-9_-]{2,40}$/
  목록당 최대 500개
  app/api/accounts/route.ts, server/blog-accounts.ts:12,14-35
```

### 5-10. 노출지기 `PUT /api/preset` 의 preset 오브젝트

`server/preset.ts:10-19, 99-101, 236-435`

```
targets[]  (배열 아니면 400)
  .id            필수, 중복 불가
  .label         기본 = id
  .kind          'basic' | 'more' | 'page'      🔴 그 외 400
  .source        { sheetId, tabTitle }  둘 다 필수
  .result?       { sheetId, tabTitle }  둘 다 비면 키 자체가 제거됨
  .maxPages?     int 1~10.  🟡 **kind='page' 일 때만 저장. 아니면 조용히 버려짐**
  .blogGroupIds? blogGroups 에 없는 id 면 400
  .blogIds?      최대 500.  🟡 정규화 실패분은 조용히 탈락
  .enabled       `enabled !== false` → 🟡 **undefined 도 true 로 해석됨**
blogGroups[]   .id 필수/중복 불가, .blogIds 정규화
runBundles[]?  최대 12개. targets 는 프리셋 target id 여야 함(400). maxPages int 1~9
cafeChecks[]?  최대 12개. sheetUrl 은 /spreadsheets/d/<id> 파싱 가능해야 함(400).
               targets[] 1~50개, 쉼표 포함 불가(400), 중복 불가, 빈 줄 불가
doorayWebhookUrl?  https:// 로 시작해야 함(400)
```

### 5-11. 다붓 나머지 enum

| 필드 | 위치 | 값 | 위험 |
|---|---|---|---|
| `mode` | `POST /naver-accounts/import` | `"upsert"`(기본) \| `"skip"` | 🔴 openapi enum, 틀리면 422 |
| `action` | import 응답 | `"create"` \| `"update"` \| `"skip"` | – |
| `status` | ImageBatchJob/Item | `"pending"` \| `"running"` \| `"done"` \| `"error"` | – |
| `period` | `GET /search/popular` | `today` \| `week` \| `month` | 🔴 regex, 틀리면 422 |
| `period` | `GET /search/stats` | `day` \| `week` \| `month` | 🔴 regex, 틀리면 422 |
| `status` | `GET /bot/queue` | 기본 `"pending"` | ⚪ 검증 없음 |
| `persona_id` | `/generate/gemini-cafe-daily` | 1~18 | ⚪ **코드에 범위 검증 없음.** 목록은 `GET /generate/gemini-cafe-daily/personas` |
| `content_type` | `GenerateRequest` | `"정보성"` \| `"후기성"`, 비우면 자동 | ⚪ 검증 없음 |
| `prompt_profile` | `/keyword-generator` | `"default"` \| `"ggg"` | ⚪ 검증 없음 |
| `blog_name` | `/generate/restaurant/v2` | 블루망고/제이제이/삼남매/사랑채/호이호이/바글바글 | ⚪ 검증 없음 |
| `service` | 모든 범용 generate | **enum 아님.** `.lower()` 해서 Mongo `service` 에 그대로 저장 | ⚪ |
| `token_type` | 로그인 응답 | 항상 `"bearer"` | – |
| `source` (ApiKeyStatus) | 키 현황 | `"account"` \| `"env"` \| `"none"` | – |
| `source` (ApiKeyTest) | 키 테스트 | `"account"` \| `"env"` \| `"input"` \| `"none"` | – |

### 5-12. 범위 제약 통합표

#### 제대로 400/422 로 막는 것

| 서비스 | 필드 | 제약 | 위치 |
|---|---|---|---|
| 다붓 | `password` (signup/create/change) | **≥8** | schema/auth.py:28,35,44 |
| 다붓 | `username` | 2~40 | schema/auth.py:34,44 |
| 다붓 | `label` (project) | 1~60 | schema/project.py:51 |
| 다붓 | `prompt_files[].name` | 1~200 | schema/project.py:46 |
| 다붓 | `naver_account.name` / `login_id` | 1~120 / 1~80 | schema/naver_account.py:21,23 |
| 다붓 | search `limit` (body) / `page` | 1~100 / ≥1 | schema/search.py:8,9,14 |
| 다붓 | autocomplete `q` / `limit` | ≥2자 / 1~10 | search/autocomplete.py:75,76 |
| 다붓 | popular `limit` | 1~20 | search/popular.py:92 |
| 다붓 | bookmarks `limit` / `offset` | 1~100 / ≥0 | search/bookmark.py:179-180 |
| 다붓 | history `limit` | 1~50 | search/history.py:119 |
| 다붓 | image-batch `keywords` | 1~**100** (101개 이상 400) | image_batch.py:68,302 |
| 다붓 | ingest `keywords` | ≤32개, 각 60자 (초과 400) | ingest.py:11,40 |
| 스케줄러 | `/schedules` `imageCount` | **1~10** 기본 5 | schemas/dto.ts |
| 스케줄러 | `/schedules` `delayBetweenPostsSeconds` | 0~600 기본 10 | 〃 |
| 스케줄러 | `keywords[]`, `queues[]` | min 1개 | 〃 |
| 스케줄러 | `scheduleDate` | `/^\d{4}-\d{2}-\d{2}$/` | 〃 |
| 스케줄러 | `start_hour` / `interval_minutes` / `posts_per_day` | 0~23 / 10~720 / 1~10 | 양쪽 공통 |
| 스케줄러 | `items[].slot` | ≥1 | 〃 |
| 스케줄러 | queue jobs `limit` / clean `grace` | 1~100 기본 20 / ≥0 | queue.route.ts |
| 스케줄러 | signup `username` / `password` | 3~50 / ≥8 | auth.route.ts:105 |
| 노출지기 | exposure-suite `concurrency` / `maxPages` / `targetConcurrency` | 1~50 / 1~9 / 1~3 | exposure-suite-options.ts |
| 노출지기 | 계정 목록당 | 최대 500 | blog-accounts.ts |
| 노출지기 | `runBundles` / `cafeChecks` | 각 최대 12 | preset.ts |
| 노출지기 | `cafeChecks[].targets` | 1~50 | preset.ts |
| 바이로 | `generateMinCount`/`MaxCount` | `min≥1 && max≥min` 아니면 `{success:false}` | manual-comment-job/actions.ts:145-149 |

#### 🟡 422 가 아니라 조용히 잘리는 것

| 서비스 | 필드 | 실제 동작 | 위치 |
|---|---|---|---|
| 다붓 | `image_count`, `count` (image/decorate/gpt-with-image/image-batch) | **`min(max(v,1),10)` clamp.** `count:50` → 조용히 10 | gemini_image.py:180, decorate.py:90, gpt_with_image.py:150, image_batch.py:308 |
| 다붓 | step config `count`(1~10), `image_slots`(0~10) | `_coerce_number` clamp | pipeline_steps.py:162-175 |
| 다붓 | step config 타입 어긋남 | `"3"`→3, `"true"`→true 강제 변환 | pipeline_steps.py:148-175 |
| 다붓 | `LLM_CONCURRENCY` | 동시 `POST /generate/*` 5개 초과 시 **거절이 아니라 대기** | utils/llm_concurrency.py:10 |
| 다붓 | `IMAGE_API_CONCURRENCY` | 이미지 API 동시 5개 상한(프로세스 전역) | gemini_image.py:35 |
| 다붓 | `MAX_TEXT_LEN` (ingest) | 1e20 — 사실상 무제한 | ingest.py:10 |
| **스케줄러** | **`/bot/auto-schedule` 의 `image_count`, `delay_between_posts`** | **min/max 가 없다.** `/schedules` 는 1~10 / 0~600 인데 여기는 무제한 | pythonCompatSchema |
| 바이로 | `prepare.manual-modify.count` | **1~100 clamp.** `count:500` → 100 | prepare/route.ts:106 |
| 바이로 | `pool.needed` | `Math.max(1, needed)`, 실제 반환은 `max(needed*3, needed+5)`개 | account-pool.ts:97 |
| 바이로 | `delayMinMinutes` → `delayMinMs` | `max(0, round(min*60000))` | manual-comment-job/actions.ts:152 |
| 바이로 | `delayMaxMinutes` | `max(delayMinMs, …)` — **max<min 이면 조용히 min** | 같은 파일 :153 |
| 바이로 | 벌크 링크 등록 | **최대 50개**, 초과분 조용히 slice | 같은 파일 :245,258 |
| 바이로 | 잡 목록 조회 | 최근 **50건 고정** | 같은 파일 :339 |
| 바이로 | stale claim 회수 | **30분** 지나면 다른 워커가 뺏어감 | agent-broker/index.ts:34 |
| 바이로 | Server Action 바디 | 500MB | next.config.ts:16 |
| 바이로 | 이미지 기본 장수 | prepare 경로 3장 고정 / `searchRandomImages` 기본 5 | prepare/route.ts:49, google-image-api.ts:28 |
| 노출지기 | `GET /api/outputs` | 200개 초과분은 `totalCount` 만 다르고 목록에서 조용히 잘림 | output-scanner.ts:17,49 |
| 노출지기 | `GET /api/runs` | 최근 50건, **메모리** | runs/route.ts |

### 5-13. snake_case / camelCase 매핑표

**한 요청 안에서 섞이는 곳이 있다. 여기가 무음 사고의 주 원인이다.**

| 서비스 / 경로 | 요청 | 응답 |
|---|---|---|
| 다붓 — 요청 바디 전부 | **snake_case** (`project_id`, `image_count`, `with_images`, `business_name`, `db_category`, `pre_steps`, `post_steps`, `login_id`, `manuscript_ids`, `schedule_start_hour`, `content_type`, `persona_id`, `image_model` …) | – |
| 다붓 — Pydantic 모델 응답 | – | **snake_case** (`access_token`, `owner_id`, `has_password`, `zip_url`, `article_html`, `section_title`, `job_id`, `zip_ready`, `total_keywords` …) |
| 다붓 — **Mongo 문서 그대로 반환** ⚠️ | – | **camelCase + `_id`** (`createdAt`, `contentType`, `businessName`, `ownerId`, `projectId`, `isVisible`, `deletedId`, `charCount`, `docId`, `sessionId` …) |
| 다붓 — 검색 필터 (예외) | **camelCase** — `SearchFilters`: `dateFrom`, `dateTo`, `engine`, `hasRef`, `minLength` / `SearchSort`: `field`, `order` (`schema/search.py:17-27`) | – |
| 다붓 — 네이버 세션 (예외) | **camelCase** `sessionId` | `sessionId` |
| 스케줄러 — `/schedules`, `/schedules/:id/execute` | **camelCase** 전부 | camelCase |
| 스케줄러 — `/bot/*` | **최상위만 snake_case** ⚠️ | **camelCase** |
| 바이로 — 자기 API | **camelCase 100%** | camelCase |
| 바이로 → 다붓으로 나갈 때 ⚠️ | **snake 로 변환**: `personaId`→`persona_id`, `contentType`→`content_type`, `businessName`→`business_name`, `blogName`→`blog_name` | **다시 camel 로 읽는다** — `data.contentType` (`content-api.ts:258,332`) |
| 노출지기 | **camelCase 100%** | camelCase |

**스케줄러 `/bot/*` 의 혼합 상세:**

```
snake:  schedule_date, schedule_mode, generate_images, image_count, image_source,
        manuscript_type, project_id, delay_between_posts, keyword_category,
        start_hour, interval_minutes, posts_per_day,
        queues[].blog_name, .multi_images, .item_options, .log_nos,
        .update_count, .start_index, .end_index

camel:  queues[].account.blogId, .account.dabutAccountId,
        queues[].items[].scheduledAt / .businessName / .manuscriptType / .category,
        queues[].item_options[].businessName / .manuscriptType / .projectId,
        manuscripts[].title / .content,
        multi_images[].individual / .slide / .collage
```

**다붓 요청의 snake 예외 2곳:** `POST /auth/naver/logout` 의 `sessionId`, `AdvancedSearchRequest.filters` 안의 `dateFrom`/`dateTo`/`hasRef`/`minLength`.

### 5-14. 모르는 키를 버리는가 — **4개 서비스 전부 버린다**

| 서비스 | 검증 라이브러리 | 모드 | 근거 |
|---|---|---|---|
| 다붓 | Pydantic v2 | `extra="ignore"` (기본) | 전 저장소에 `model_config`/`ConfigDict`/`extra=` **한 줄도 없음** |
| 스케줄러 | zod | `strip` (기본) | `grep -rn "\.strict()\|\.passthrough()" src/` **결과 0건** |
| 바이로 | **없음** | 손으로 필드 추출 | `package.json` 에 zod 도 없음 |
| 노출지기 | 손으로 파싱 | destructuring | `parsePreset` 이 5개 키만 꺼냄 (`preset.ts:404-405`) |

**유일한 예외 3곳 (모르는 키를 400 으로 거절):**

1. 노출지기 `POST /api/jobs/exposure-suite/run` — `ALLOWED_OPTION_KEYS` (`exposure-suite-options.ts:26-31,98-103`)
2. 노출지기 `kind='standard'` 실행 — 바디에 값이 있으면 400 (`job-command.ts:31-33`)
3. 다붓 `PUT /auth/app/api-keys` 의 `keys` — 모르는 provider 400 (`app_auth.py:238-243`)

**다붓 라이브 실측 (2026-09-03):**
```
POST /search/keyword  {"query":"탈모","limit":2,"bogus_key":123,"limitt":99}
→ 200. bogus_key/limitt 둘 다 무시. limit 은 2 적용

POST /search/keyword  {"query":"탈모","limit":999}
→ 422 {"detail":[{"type":"less_than_equal","loc":["body","limit"], ...}]}
```

**한 단계 더:** 다붓 프로젝트 스텝의 `config` 도 카탈로그에 없는 키를 버린다 (`pipeline_steps.py:178-202`). `{"type":"images","config":{"cont":3}}` → 저장 결과 `{"count":5,"source":"ai"}`.
**바이로 추가:** Mongoose 도 `strict:true` 기본이라 스키마에 없는 필드는 저장 시 또 한 번 드롭된다.

---

## 6. 함정 목록

**실제로 사고났거나, 사고 직전인 것들.** 근거 파일:라인 포함.

### 6-1. 🔴 스케줄러: `projectId` 가 멱등성 지문에 안 들어간다 — 확진

**증상**: 키워드·계정·날짜가 같고 `project_id` 만 바꿔 재요청하면 **새 예약이 안 만들어지고 옛 프로젝트로 발행된다.** 200 + `success:true` + `totalJobs` 도 채워져 온다.

**근거**: `createSchedule` 은 `projectId` 를 **넘긴다** —
```
src/services/schedule.service.ts:380-385
  itemOverrides: items.map((item) => ({
    keyword: item.keyword, businessName: item.businessName,
    manuscriptType: item.manuscriptType, projectId: item.projectId,   ← 넘어감
  })),
```
받는 쪽이 **버린다** —
```
src/services/schedule-idempotency.service.ts:28
  itemOverrides?: Array<{ keyword: string; businessName?: string; manuscriptType?: string }>;
                                                          ↑ 타입에 projectId 없음
src/services/schedule-idempotency.service.ts:72-81
  const normalizeItemOverrides = (itemOverrides = []) =>
    itemOverrides
      .map((item) => ({ keyword, businessName, manuscriptType }))   ← projectId 탈락
      .filter((item) => item.businessName.length > 0 || item.manuscriptType.length > 0);
                                                       ← projectId 만 있는 항목은 전부 탈락
```
`ScheduleRequestFingerprintInput` 최상위에도 `project_id` 자리가 없다 (`:3-29`). **항목별 projectId 도, 요청 전체 `project_id` 도 지문에 0% 반영된다.**

**연쇄**: 같은 지문 → `status ∈ {pending, processing}` 인 기존 예약 히트 (`schedule.service.ts:387-391`) → `reused:true`. 재사용 시 잡을 새로 안 만들어 BullMQ jobId 도 `generate_<기존 scheduleJobId>` 그대로 → 중복 add 무시 → `enqueueScheduleGenerateJob` 이 `jobItem.projectId ?? projectId` 로 **DB 에 저장된 옛 projectId** 를 쓴다 (`schedule.route.ts:262`). 재사용 분기의 `existingItems` 재구성에도 `projectId` 가 빠져 있어 (`schedule.service.ts:398-404`) **응답 items 에서도 사라진다.**

**에이전트 대응**: `POST /bot/auto-schedule` 응답의 **`reused` 플래그를 반드시 확인하라.** `true` 면 새로 안 걸린 것이다.

### 6-2. 🔴 200 인데 실패인 경로 (전 서비스)

#### 다붓

| 경로 | 무슨 일이 | 근거 |
|---|---|---|
| `POST /generate/project` | post_steps(`images`,`decorate`)가 터져도 **예외를 삼키고 200**. 응답에서 `images`/`zip_url`/`html` **키가 통째로 사라진다** (null 이 아니라 부재) | pipeline_runner.py:247-248 |
| 〃 | pre step `web_search` 실패도 삼킴 → 검색 자료 없이 원고가 나온다 | pipeline_runner.py:91-92 |
| 〃 | Mongo 저장 실패해도 200. `manuscript_id`/`_id` 가 **null** | project_generate.py:169-171 |
| `POST /generate/batch` | 개별 실패는 `results[].success:false` 로만. 전부 실패해도 200. 게다가 **최상위 `success` 는 bool 이 아니라 성공 건수 int** — `if (resp.success)` 는 0건일 때만 false | batch.py:181,216,233 |
| `/bot/publish`, `/bot/start`, `/bot/queue/start`, `/bot/auto`, `/bot/auto-schedule` | 발행 실패 원고는 `results[].success:false`, 최상위는 `{"success":true, total, success_count, failed_count}` 로 200 | bot/common.py:64,126, queue.py:198 |
| `GET /generate/image-batch/{job_id}` | 작업이 죽어도 200. `status:"error"` + `error` 문자열로만 | image_batch.py:255-258 |
| `/generate/image`, `/decorate`, `/gpt-with-image` | 이미지 0장이어도 200. `total:0, failed:N` | gemini_image.py:239 |
| `GET /auth/naver/status` | 세션 없음/만료 모두 200 + `{"valid":false}` | auth/naver.py:301,318 |
| `DELETE /search/manuscript/{id}` | **소프트 삭제. 실제로 안 지워진다** | search/manage.py:20-41 |

제대로 4xx 를 내는 것 (혼동 방지): `POST /auth/naver/login` 실패 400 `{detail:{error,message}}`, `POST /blog/write` 실패 400 `{detail:{error:"WRITE_FAILED",message}}`.

#### 스케줄러

| 경로 | 무슨 일이 | 근거 |
|---|---|---|
| `POST /bot/auto-schedule` | 계정 해석/개수 검증 실패가 **200 + `{success:false, message}`** | schedule.route.ts:610-620 |
| `POST /bot/auto-update` | `manuscripts` 길이 불일치는 200+`success:false`(:744-749), 그런데 **`log_nos`/`item_options` 길이 불일치는 `throw` → 500**(:758-762, :786-790). **같은 종류의 오류가 200 과 500 으로 갈린다** | – |
| `GET /api/queues/:accountId/jobs` | 존재하지 않는 accountId 도 **200 `{count:0,jobs:[]}`**. 오타를 구분할 수 없다 | queue-manager.ts `getAccountQueueJobs` |
| `POST /api/queues/:accountId/clean` / `/drain` | 큐가 없어도 200 `success:true` | queue.route.ts:83,93 |
| `POST /schedules/:id/execute` | pending 0개여도 200 `{success:true, enqueued:0}`. 게다가 **`enqueued` 는 큐에 넣은 수가 아니라 조회한 잡 수**(루프에서 skip 된 것도 포함) | :547 |
| `reused: true` | §6-1. `success:true`, `totalJobs` 도 채워져 나온다 | – |
| `contentBlocks` | 커스텀 파이프라인이 `isActive:false` 면 조용히 `undefined` → 내장 파이프라인이 돈다 | schedule.route.ts:567 |

#### 바이로

**바이로는 예외를 던지지 않는 것이 컨벤션이다** (AGENTS.md: "Server Actions return `{success, error?}` — NEVER throw").

| 경로 | 무슨 일이 | 근거 |
|---|---|---|
| `GET /api/accounts`, `/api/cafes` | **인증 없이도 200 + `[]`** (`default-user` 폴백). DB 에러여도 `[]`, 빈 DB 여도 `[]` — **구분 불가.** 프로덕션 실측에서 실제로 `[]` | accounts/route.ts:18 |
| `POST /api/agent/heartbeat` | 잡이 내 것이 아니거나 running 이 아니면 **200 `{ok:false}`**. 에이전트가 성공한 줄 알고 계속 돈다 | heartbeat/route.ts:23 |
| `POST /api/agent/result` | 잡을 못 찾으면 **200 `{ok:false}`**. **결과 리포트가 통째로 버려진다** | result/route.ts:31 |
| `generateImages()` / `searchRandomImages()` | 네트워크 실패·빈 결과 전부 `{success:false,error}`, throw 안 함. 호출부가 `imageResult.images \|\| []` 로 받아 **이미지 0장인 채 발행 진행** | – |
| 모든 Server Action | `{success:false,error}` — **HTTP 상태로는 절대 안 드러남** | – |

`POST /api/agent/claim` 은 잡 없으면 200 `{job:null}` — 이건 정상 동작이다.

#### 노출지기

| 경로 | 무슨 일이 | 근거 |
|---|---|---|
| `POST /api/runs/[runId]/stop` | 실패를 전부 **409** 로 낸다. "실행 기록 없음"(404 여야 함)도 409 | stop/route.ts |
| `GET /api/runs/[runId]/stream` | evict 되면 404 `run not found`. **종료된 run 에 붙으면 즉시 `done` 만 오고 닫힌다** | run-query.ts:24-27 |
| `GET /api/outputs` | 200개 초과분은 `totalCount` 만 다르고 목록에서 조용히 잘림 | output-scanner.ts:17,49 |

### 6-3. 🔴 다붓: `/generate/*` 무인증 호출이 회사 키로 과금된다

`utils/request_api_keys.py:48-54` — 토큰이 없거나 만료돼도 **401 이 아니라 서버 환경변수 키로 실행**한다.

의도된 설계다. `request_api_keys.py:11-13` 주석: "스케줄러나 다른 봇들이 토큰 없이 부르고 있어서 401 을 내면 그쪽이 전부 멈춘다."

**에이전트 대응**: 계정 키로 과금하려면 **반드시 `Authorization: Bearer` 를 붙여라.** 안 붙이면 "내 키로 돈 줄 알았는데 회사 키로 돌았다"가 된다.

### 6-4. 🔴 전체 교체 API 3곳 — 부분 수정인 줄 알면 데이터가 날아간다

| 경로 | 동작 | 안전한 절차 |
|---|---|---|
| **노출지기 `PUT /api/preset`** | **전체 교체.** `targets` 만 보내면 기존 `blogGroups`/`runBundles`/`cafeChecks`/`doorayWebhookUrl` 이 **전부 삭제된다. 400 도 안 난다** | `GET /api/preset` → 전체 오브젝트 수정 → `PUT`. **중간에 실패하면 프리셋이 통째로 날아간다** → 결손 #N1 |
| 다붓 `PUT /projects/{id}` 의 `pre_steps`/`post_steps` | 배열 **통째로 교체.** 부분 병합 없음 | `GET /projects/{id}` → 배열 전체 재구성 → `PUT` |
| 스케줄러 `POST /api/content-pipelines` | **upsert 전체 교체.** `blocks` 하나 바꾸려면 전체 재전송 | `GET /api/content-pipelines` → 수정 → `POST` |

추가: **다붓 `PUT /projects/{id}` 에 `null` 을 보내면 무시하고 200 을 돌려준다** (`project.py:230`, `v is not None` 필터). "지웠는데 안 지워짐". 지우려면 `""` 또는 `[]` 를 보내야 한다. `post_steps: []` 는 통과, `post_steps: null` 은 무시.

### 6-5. 🔴 평문 비밀번호·미인증 파괴 경로

| 위치 | 문제 |
|---|---|
| 바이로 `POST /api/agent/context`, `/api/agent/accounts` | **네이버 계정 평문 비밀번호를 그대로 응답에 담는다** (`context/route.ts:20-27`, `account-pool.ts:32`). 설계상 의도(로컬 브라우저가 로그인해야 함)지만 **Ply 가 이 응답을 로그·프롬프트·스크린샷에 흘리면 안 된다** |
| 다붓 `/bot/*` 전부 | 무인증인데 네이버 계정 id/password 를 body 로 평문 수신 |
| 다붓 `POST /auth/naver/login` | 무인증. IP 기반 rate limit 만 (`auth/naver.py:228`, 초과 429) |
| 다붓 `/generate/image-batch/{job_id}` GET/download/DELETE | **시작만 인증.** `job_id` 는 `uuid4().hex[:12]`. 남의 job_id 를 알면 ZIP 을 받고 지울 수 있다 (`image_batch.py:310,349,358,378`) |
| 다붓 `/search/*` 전부 | 무인증. `DELETE /search/manuscript/{id}` 포함. `user_id` 는 쿼리 문자열이라 **아무 값이나 넣으면 그 사람 북마크/히스토리를 읽고 지운다** |
| 바이로 `POST /api/agent/login` | 공개인데 **rate limit 없음** |

### 6-6. 🔴 소유권 체크 누락

| 위치 | 문제 |
|---|---|
| 스케줄러 `POST /schedules/:id/execute` | **소유권 체크가 없다** (`:488-500`). `findById` 후 `body.account.id !== schedule.accountId` 만 본다. accountId 를 알면 남의 예약을 재큐잉할 수 있고 비번은 `findAccountById` 가 공용 디렉토리에서 자동으로 채워준다(`:502-508`) |
| 스케줄러 `/api/queues/*` 전체 | **소유권 개념 자체가 없다.** 인증만 되면 아무 `accountId` 나 넣어 남의 큐를 retry/clean/drain 할 수 있다. **`POST /api/queues/drain-all` 은 전 테넌트의 대기 잡을 한 방에 날린다** (`queue.route.ts:106`) |
| 스케줄러 인증 OFF 시 | `resolveOwnedAccountScope` 는 `authEnabled=false` 면 `null`(스코프 없음) 리턴 (`schedule-ownership.service.ts:51`). **`JWT_SECRET` 또는 `DABUT_APP_MONGO_URI` 가 없으면 전 API 가 무인증 + 전 데이터 노출** (`config/env.ts:44-46`) |
| 노출지기 `/api/runs*`, `/api/outputs*`, `/api/accounts`, `/api/pm2*` | `readSessionMember` 를 안 부른다. **로그인만 되어 있으면 누구의 세션이든 남의 실행 로그를 읽고, 남의 결과 파일을 받고, 실행을 정지시키고, 계정 목록을 고치고, 크론 데몬을 껐다 켤 수 있다** |

**고쳐진 것 (참고)**: 스케줄러 `GET /schedules`, `GET /schedules/:id`, `DELETE /schedules/:id` 는 `resolveScheduleAccountScope` → `isVisibleSchedule` 로 스코프가 걸려 있다. 남의 것은 403 이 아니라 404 로 감춘다.

### 6-7. 🔴 필드명 오타를 서버가 잡아주지 않는다 — 오늘 사고의 근본 원인 구조

§5-14 대로 4개 서비스 전부 모르는 키를 버린다. 결과:

| 잘못 보낸 것 | 서버 반응 | 실제 결과 |
|---|---|---|
| 스케줄러 `manuscriptType` (snake 자리에 camel) | **400 아님** | 조용히 `'default'` 로 처리 |
| 스케줄러 `projectId` (snake 자리에 camel) | 400 아님 | 조용히 무시 |
| 다붓 `imageCount` (snake 자리에 camel) | 400 아님 | 기본값 5 로 실행 |
| 다붓 `withImages: false` (snake 자리에 camel) | 400 아님 | `true` 로 실행 → **이미지가 생성되고 돈이 나간다** |
| 바이로 `{"jobID":"x"}` (대문자 D) | `400 jobId required` | 다른 에러 메시지가 나와 원인 추적이 꼬인다 |
| 바이로 `{"delayMinMinute":5}` (s 빠짐) | 400 아님 | 조용히 0분 |
| 노출지기 preset 오타 키 | 400 아님 | 무음 손실 |

바이로 추가 함정 — 손 파싱 패턴 (`const body = await request.json().catch(() => ({}))`) 때문에:
- **JSON 파싱 실패가 400 이 아니라 빈 객체 `{}` 다.** 깨진 JSON → 필수 필드 없음 → 엉뚱한 에러 메시지
- `String(body.x || '')` 강제변환 — `body.x` 가 객체면 `"[object Object]"` 가 들어간다

### 6-8. 🟡 이미지 서버(`localhost:3939`) 파서가 3종이다

같은 엔드포인트를 세 프로젝트가 **각자 다르게 읽는다.**

| 프로젝트 | 읽는 키 | 위치 |
|---|---|---|
| 다붓 | **전부** — `[v for v in images.values() if isinstance(v, list)]`, 중복 제거까지 | `utils/image_server.py:70-95` `flatten_image_urls()` |
| 바이로 | **4개 하드코딩** — `body`, `individual`, `slide`, `collage` | `src/shared/api/google-image-api.ts:45-50` |
| 스케줄러 | **1개** — `images.body` 만 | `src/services/manuscript.service.ts:284-301` `parseImageResponse` |

다붓은 이 사고를 **이미 겪고 고쳤다.** `flatten_image_urls()` 독스트링:
> "서버가 카테고리를 계속 늘려서(4개 -> 6개) 특정 키만 읽으면 조용히 빈 목록이 된 적이 있다. 그래서 키를 고정하지 않고 리스트인 값이면 전부 훑는다."

**현재 실제 영향은 0.** 바이로의 `searchRandomImages` 는 `content-api.ts:610` 에서 re-export 만 될 뿐 **어디서도 호출되지 않는다.** 현행 이미지 경로는 전부 `generateImages()` → 다붓 `/generate/image` (`content-api.ts:558`). **잠복 지뢰**지 현재 장애는 아니다. 살릴 거면 다붓의 `flatten_image_urls` 방식으로 포팅하는 게 맞다.

(이미지 서버 원본 저장소는 이 머신에 없다 — `image-search`/`image-setakgi-api` 모두 `/api/image/random-frames` 를 갖고 있지 않다. 실제 6개 키 이름은 서버 코드를 봐야 확정 가능.)

### 6-9. 🔴 `scheduler-server/api.md` 가 완전히 낡았다 — 컨텍스트에 넣지 마라

파이썬 시절 API 를 문서화하고 있고 **실제 Fastify 라우트에 하나도 없다**:
`POST /bot/auto`, `/bot/start`, `/bot/publish`, `/bot/upload`, `/bot/upload-schedule`, `/bot/prepare`, `GET /bot/queue`, `/bot/manuscript/{id}`, `/bot/pending`, `POST /bot/queue/create`, `GET /bot/batch-id` …

실존하는 `/bot/*` 는 **`/bot/auto-schedule`, `/bot/auto-update`, `/bot/link-update`, `/bot/image-replace`, `/bot/login-test` 5개뿐**이고, `auto-schedule` 도 문서에 `item_options`·`project_id`·`dabutAccountId`·`multi_images` 가 누락돼 있다.

**혼동 주의**: 위 낡은 경로들은 **다붓 백엔드에 실재한다**(§1-7). 같은 이름이 서로 다른 서비스에 있어서 문서를 잘못 물리면 스케줄러에 다붓 경로를 쏘게 된다.

### 6-10. 🟡 잘못된 값이 조용히 다른 값으로 바뀌는 것 (전체)

| 서비스 | 필드 | 잘못 보내면 |
|---|---|---|
| **바이로** | `agent/result` `status` | **`'failed'` 가 아니면 전부 `'done'`.** 오타 `"faild"`, `"error"`, `"FAILED"` → **실패한 잡이 성공으로 마감된다** (`result/route.ts:15`) |
| 바이로 | `agent/captcha` `kind` | 3종이 아니면 조용히 `'cafe-create'`. 로그인 캡차를 카페생성 솔버로 푼다 (`captcha/route.ts:20-23`) |
| 바이로 | `agent/accounts` `scope` | `'all'` 아니면 전부 commenter. `"ALL"` 대문자도 commenter |
| 바이로 | `prepare` `sortOrder` | `'newest'`/`'random'` 아니면 `'oldest'` |
| 바이로 | `prepare` `count` | 1~100 밖은 clamp. `count:500` → 100 |
| 바이로 | `pool` `needed` | `Number(body.needed \|\| 1)` — `"abc"` → `NaN` → `Math.max(1, NaN)` = **`NaN`** |
| 바이로 | 잡 등록 delay | `delayMax < delayMin` → 조용히 `delayMin` |
| 다붓 | step config `source` | select 인데 options 검증 안 함. `"banana"` 저장되고 런타임에 `== "photo"` 가 아니면 AI 생성으로 넘어감 (`pipeline_steps.py:201`, `pipeline_runner.py:129`) |
| 다붓 | step config `image_model` | 모르는 모델명 → 400 없이 `gpt-5.6-luna` 대체 |
| 다붓 | 저장된 post_steps 의 모르는 type | 실행 시 `log.warning` 만 찍고 건너뜀 (생성은 성공) (`pipeline_runner.py:32-35`) |
| 노출지기 | `preset.targets[].maxPages` | `kind !== 'page'` 면 **에러 없이 `undefined` 로 버려진다** (`preset.ts:166`). UI 에서 값을 넣어도 저장 안 된다 |
| 노출지기 | `preset.targets[].enabled` | `enabled !== false` 판정이라 키를 빼먹으면 **켜진 것으로 저장된다** (`preset.ts:268`) |
| 노출지기 | `blogIds` 정규화 실패분 | **에러 없이 배열에서 사라진다** (`preset.ts:177-182`, `blog-accounts.ts:54-59`). 20개 붙여넣고 17개만 저장돼도 200 |

### 6-11. 🔴 바이로: 계정 `role` 이 없으면 댓글 풀이 조용히 0개가 된다

댓글 계정 풀은 `role: 'commenter'` **완전 일치**를 요구한다 (`account-pool.ts:29,51`). 그런데 `role` 은 mongoose 에서 **기본값이 없어 undefined 일 수 있다** (`models/account.ts:90`).

→ **role 미지정 계정이 수십 개 있어도 댓글 풀이 빈 배열로 나온다. 에러는 안 난다.**

### 6-12. 🟡 마스킹을 만들어 놓고 원문도 같이 보낸다

| 마스킹 되는 곳 | 마스킹 **안 되는** 곳 |
|---|---|
| 스케줄러 POST 응답들의 `account` (`maskAccountId`, `schedule.route.ts:108-114`), `/queues/stats` | `GET /schedules` — Mongo 문서 통째 반환(`:439-440`). `accountId` 원문 + `requestFingerprint` 까지 |
| | `GET /schedules/:id` — `schedule` 원문 + `jobs[]` 원문(`:454`). `generateJobId`, `publishJobId`, `manuscriptId`, `postUrl` 포함 |
| | `GET /api/queues/dashboard` — `accounts[].accountId` 를 **원문과 `maskedAccountId` 를 나란히** 내보낸다. 마스킹 필드를 만들어놓고 원문도 같이 보내니 의미가 없다 |

비밀번호 자체는 스케줄러에서 잘 막혀 있다 — `/admin/queues` 는 `redactJobData` 포매터(`app.ts:21-25`), `credential-check` 는 `ok` 만 준다.

### 6-13. 🟡 휘발성 상태 3곳

| 위치 | 무엇이 | 잃으면 |
|---|---|---|
| 다붓 `image_batch.py:63` `_JOBS` | 이미지 배치 작업이 **메모리 dict** | 서버 재시작 = 진행 중 작업 소멸. 목록 API 도 없어 job_id 를 클라이언트가 보관해야 함 |
| 노출지기 `GET /api/runs` | 실행 이력이 **인메모리 최대 50건** | Railway 재배포 시 소실(저널로 일부 복구). **이력 DB 가 아니다** |
| 노출지기 SSE 스트림 | evict 되면 404 | 로그를 다시 볼 방법이 없다. 로그 파일(`DASHBOARD_RUN_LOG_DIR/<runId>.log`)은 있는데 노출 API 가 없다 |
| 바이로 claim | **30분** 지나면 다른 워커가 뺏어감 (`agent-broker/index.ts:34`) | heartbeat 를 안 치면 잡을 잃는다 |

---

## 7. 결손 목록

**"가서 직접 하세요"가 나오는 지점.** 각 항목에 "만들려면 어디에 무엇을" 한 줄 포함.

### 7-1. 우선순위 상위 5개

| 순위 | ID | 결손 | 왜 1순위인가 | 만들려면 |
|---|---|---|---|---|
| **1** | **#S1** | **스케줄러에 enum/스키마 조회 API 가 없다** | `manuscriptType` 12개를 몰라서 400 이 나는 게 **오늘의 실제 사고.** 가장 싸고 효과가 크다 | `scheduler-server/src/routes/` 에 `meta.route.ts` 신설 → `GET /api/meta/enums` 가 `schedule.route.ts:46-49` 의 zod enum 들을 그대로 반환. 근본책은 `@fastify/swagger` 를 `src/app.ts` 에 붙여 다붓처럼 `/openapi.json` 을 여는 것 |
| **2** | **#V1** | **바이로에 댓글 잡 조회 REST 가 없다** | 등록은 `/api/agent/prepare` 로 되는데 **상태 확인은 UI 를 열어야 한다.** "내 작업 어떻게 됐어?"에 답을 못 한다. `claim` 은 부작용(running 전환)이 있어 조회에 못 쓴다 | `cafe-bot/src/app/api/agent/jobs/route.ts` 신설 → `GET`(목록, 필터 `status`/`cafeId`) + `cafe-bot/src/app/api/agent/jobs/[jobId]/route.ts` → `GET`(단건 + `results`/`deleteResults`/`agentSummary`). 조회 로직은 `src/features/manual-comment-job/actions.ts:339` 의 `getManualCommentJobsAction` 재사용 |
| **3** | **#N1** | **노출지기 프리셋 부분 수정(PATCH)이 없다** | `PUT` 이 전체 교체라 **에이전트가 중간에 실패하면 프리셋이 통째로 날아간다.** 위험 제거가 목적 | `blog-cron-bot/dashboard/src/app/api/preset/route.ts` 에 `PATCH` 핸들러 추가 → 기존 preset 을 읽어 deep-merge 후 `parsePreset` 통과. 더 세밀하게는 `src/app/api/preset/targets/[id]/route.ts` |
| **4** | **#V2** | **바이로에 잡 취소가 아예 없다** | 잘못 등록하면 **되돌릴 방법이 0.** Mongo 직접 수정뿐 | `cafe-bot/src/app/api/agent/jobs/[jobId]/cancel/route.ts` 신설 (`POST`) 또는 `DELETE /api/agent/jobs/[jobId]` → `ManualCommentJob.status` 를 `'failed'`/신규 `'cancelled'` 로. enum 은 `src/shared/models/manual-comment-job.ts:8,105` 에 추가 |
| **5** | **#S2** | **스케줄러 예약 수정(UPDATE)이 통째로 없다** | "예약 시간 좀 바꿔줘"가 지금 불가능. 취소 후 재생성은 §6-1 `reused` 함정에 걸린다 | `scheduler-server/src/routes/schedule.route.ts` 에 `PATCH /schedules/:id` 추가 (scheduledAt, keyword, manuscriptType, projectId, businessName). 동시에 `src/services/schedule-idempotency.service.ts:28,72-81` 에 `projectId` 를 넣어 §6-1 을 같이 해결 |

### 7-2. 다붓 결손

| ID | 못 하는 것 | 왜 | 만들려면 |
|---|---|---|---|
| #D1 | 프로젝트 `min_body_chars` 설정 | `project_generate.py:145` 가 `project.get("min_body_chars")` 로 분량 보강 루프를 돌리는데 `ProjectBase`/`Create`/`Update` 어디에도 **필드가 없다.** PUT 으로 보내도 `extra="ignore"` 로 버려진다 | `dabut-backend/schema/project.py:50-101` 의 `ProjectBase` 에 `min_body_chars: int \| None = None` 추가 |
| #D2 | 앱 계정 목록/수정/삭제 | `POST /auth/app/users`(생성)와 `GET /auth/app/me`(본인)만 있다. `GET /auth/app/users`, `PUT/DELETE /auth/app/users/{id}`, 비활성화 엔드포인트 전부 없음 | `dabut-backend/routers/auth/app_auth.py` 에 목록/수정/삭제 라우트 추가 |
| #D3 | 원고를 계정/프로젝트로 조회 | 원고 문서에 `owner_id`/`projectId` 를 저장하는데(`project_generate.py:160-161`) 검색 API 는 **키워드/카테고리로만** 찾는다 | `dabut-backend/routers/search/manage.py` 에 `GET /search/manuscripts?owner_id=&project_id=` 추가 |
| #D4 | 원고 하드 삭제 | `DELETE /search/manuscript/{id}` 는 소프트 (`search/manage.py:26`) | 같은 파일에 `?hard=true` 옵션 |
| #D5 | `category` 없이 원고 삭제/수정 | 카테고리별로 DB 가 나뉘어 있어 `category` 쿼리가 **필수** | 카테고리 역인덱스 컬렉션 도입 (구조 변경) |
| #D6 | 카테고리(=DB) 추가 | `CATEGORIES` 는 하드코딩 상수. Atlas 500-collection 한도 때문에 **의도적** | `dabut-backend/_constants/categories.py` 수정 + 배포 |
| #D7 | 파이프라인 스텝 종류 추가 | `PIPELINE_STEPS` 하드코딩. 실행 핸들러가 코드에 있어야 함 | `_constants/pipeline_steps.py` + `llm/pipeline_runner.py` |
| #D8 | 이미지 배치 작업 목록 조회 | 단건만 있고 목록 없음. `_JOBS` 는 메모리 | `routers/generate/image_batch.py` 에 `GET /generate/image-batch` 추가 + `_JOBS` 를 Mongo/Redis 로 |
| #D9 | `/bot/*` 스케줄 조회/수정/취소 | 예약을 걸 수만 있고 목록·수정·취소가 없다 | 스케줄러 서버를 쓰는 것이 정답. 다붓 `/bot/*` 는 레거시 |

### 7-3. 바이로 결손

| ID | 못 하는 것 | 왜 | 만들려면 |
|---|---|---|---|
| #V1 | 댓글 잡 목록/상태 조회 REST | **1순위.** §7-1 참고 | `cafe-bot/src/app/api/agent/jobs/route.ts` |
| #V2 | 잡 취소 | **4순위.** §7-1 참고 | `cafe-bot/src/app/api/agent/jobs/[jobId]/cancel/route.ts` |
| #V3 | 계정·카페 **쓰기** REST | `/api/accounts`, `/api/cafes` 는 GET 만. C/U/D 는 Server Action 뿐이라 **HTTP 로 못 부른다** (Next.js Action ID 는 빌드마다 바뀌는 해시 + `Next-Action` 헤더 필요) | `cafe-bot/src/app/api/accounts/route.ts` 에 `POST`/`PATCH`/`DELETE` 추가. 로직은 `src/entities/account/api/index.ts` 의 `addAccountAction`/`updateAccountAction`/`deleteAccountAction` 재사용 |
| #V4 | 잡 단건 결과 조회 | `results`/`deleteResults`/`agentSummary` 를 볼 곳이 없다 | #V1 과 같은 파일 |
| #V5 | 큐/워커 상태 REST | `getQueueSummary` 상당이 Server Action 에만 | `cafe-bot/src/app/api/agent/queues/route.ts`, 로직은 `src/entities/queue/api/index.ts` |

**바이로 CRUD 축 현황** (R 만 REST, C/U/D 는 Server Action):

| 도메인 | Create | Read | Update | Delete/Cancel |
|---|---|---|---|---|
| 계정 | `addAccountAction` (SA) | ✅ `GET /api/accounts` | `updateAccountAction` (SA) | `deleteAccountAction` (SA, soft) |
| 카페 | `addCafeAction` (SA) | ✅ `GET /api/cafes` | `updateCafeAction` (SA) | `deleteCafeAction` (SA, soft) |
| **댓글 잡** | ✅ `prepare` op=`comment-job` | ❌ **REST 없음** | ❌ | ❌ **취소 API 자체가 없다** |
| 에이전트 토큰 | `issueAgentToken` (SA) + `POST /api/agent/login` | `listAgentTokens` (SA) | ❌ | `revokeAgentToken` (SA) |
| 큐(BullMQ) | `addTaskJob` (내부) | `getAllQueueStatus` 등 (SA) | ❌ | `removeJob`, `clearAllQueues` (SA) |
| 발행글 | `sync` op=`article-published` | `fetchRecentPublishedArticlesAction` (SA) | `sync` op=`article-modified` | ❌ |
| 큐 설정 | – | `getSettingsAction` (SA) | `updateSettingsAction` (SA) | – |
| 계정별 API키 | `updateAccountApiKeyAction` (SA) | `getAccountApiKeyStatusAction` (SA) | 동일 | `clearAccountApiKeyAction` (SA) |
| 사용자 | `register` (SA) | `getCurrentUser` (SA) | `changePassword` (SA) | ❌ |

### 7-4. 스케줄러 결손

| ID | 못 하는 것 | 왜 | 만들려면 |
|---|---|---|---|
| #S1 | enum/스키마 조회 API | **1순위.** §7-1 참고 | `scheduler-server/src/routes/meta.route.ts` + `@fastify/swagger` |
| #S2 | 예약 수정(UPDATE) | **5순위.** §7-1 참고 | `src/routes/schedule.route.ts` 에 `PATCH /schedules/:id` |
| #S3 | 잡 단위 조작 | 10건 중 3번째만 시각 변경/취소 불가. `ScheduleJobModel` 이 API 로 노출 안 됨 | 같은 파일에 `PATCH /schedules/:id/jobs/:jobId`, `DELETE .../jobs/:jobId` |
| #S4 | 네이버 계정 추가/수정/삭제 | `GET /api/blog-accounts` 는 **읽기 전용.** 등록은 다붓 `/naver-accounts*`(인증)에서만 | `src/routes/blog-account.route.ts` 에 다붓 `/naver-accounts` 프록시 추가 |
| #S5 | 결과 조회 API | 발행 글 URL 은 `ScheduleJob.postUrl` 에 있는데 예약을 통째로 받아야 본다. "오늘 발행된 글 목록"이 없다 | `src/routes/schedule.route.ts` 에 `GET /schedules/jobs?status=published&from=&to=` |
| #S6 | adhoc 작업 결과 추적 | `/bot/auto-update` 등은 스케줄 레코드를 안 만들어 `GET /schedules` 에 안 나온다. `adhoc_update_<digest>` 를 계산해야 찾는다 | adhoc 도 레코드를 남기거나 `GET /adhoc-jobs` 신설 (`src/services/schedule-idempotency.service.ts:115` 주변) |
| #S7 | 잡 단건 상태 조회 | `GET /api/queues/:accountId/jobs` 로 최대 100개 훑어야 한다 | `GET /jobs/:scheduleJobId` |
| #S8 | 실패 원인 조회 | `ScheduleJob.error` 는 `GET /schedules/:id` 안에만 | `GET /schedules/failures` |
| #S9 | 파이프라인 부분 수정 | `POST /api/content-pipelines` 는 upsert 전체 교체 | `src/routes/content-pipeline.route.ts` 에 `PATCH /:key` |
| #S10 | 예약 취소 복구 | DELETE 는 `cancelled` + 큐 제거. 복구 API 없음 | `POST /schedules/:id/restore` |
| #S11 | **`projectId` 가 멱등성 지문에 없음** | §6-1. 무음 오작동 | `src/services/schedule-idempotency.service.ts:28`(타입 1줄), `:72-81`(map 3줄 + filter 조건) |
| #S12 | 소유권 체크 누락 | §6-6. `drain-all` 은 전 테넌트를 날린다 | `src/routes/queue.route.ts`, `schedule.route.ts:488` 에 `resolveOwnedAccountScope` 적용 |

### 7-5. 노출지기 결손

| ID | 못 하는 것 | 왜 | 만들려면 |
|---|---|---|---|
| #N1 | 프리셋 PATCH | **3순위.** §7-1 참고 | `dashboard/src/app/api/preset/route.ts` 에 `PATCH` |
| #N2 | `cafeChecks`/`runBundles` 전용 CRUD | 하나 추가에 프리셋 전체 PUT | `dashboard/src/app/api/preset/cafe-checks/[id]/route.ts`, `.../bundles/[id]/route.ts` |
| #N3 | **실행 이력 영속화** | `GET /api/runs` 는 메모리 50건. 재배포하면 사라진다. "어제 결과 어땠어?"에 답할 수 없다 | `dashboard/src/server/run-record.ts` 를 Mongo 저장으로 바꾸고 `GET /api/runs?from=&to=` |
| #N4 | 종료된 run 로그 재조회 | SSE 만 있고 evict/재시작되면 404. 로그 파일(`DASHBOARD_RUN_LOG_DIR/<runId>.log`)은 있는데 API 가 없다 | `dashboard/src/app/api/runs/[runId]/log/route.ts` 신설 |
| #N5 | 단건 run 조회 | 상태 하나 보려면 전체를 받아 필터 | `dashboard/src/app/api/runs/[runId]/route.ts` |
| #N6 | 크론 스케줄 변경 | `/api/pm2` 는 start/stop/restart 만. `cronRestart` 는 **읽기만** | `dashboard/src/app/api/pm2/[app]/cron/route.ts` (`PUT`) + `src/server/pm2-client.ts` |
| #N7 | 1회성 지연 실행 예약 | "지금" 실행뿐 | `dashboard/src/app/api/jobs/[jobId]/schedule/route.ts` |
| #N8 | 결과 파일 필터 | 최근 200 고정, job/날짜/대상 필터 없음. 어떤 실행이 만든 파일인지 연결 정보도 없다 | `dashboard/src/app/api/outputs/route.ts` 에 query 지원 + `src/server/output-scanner.ts` |
| #N9 | 계정 목록이 전역 2개 하드코딩 | `MANAGED_LISTS` 가 코드 상수. **회원별이 아니라 전역.** 다른 목록을 만들 API 가 없고 seed 는 지울 수도 없다 | `dashboard/src/server/blog-accounts.ts:12` 를 프리셋 `blogGroups` 로 일원화 |
| #N10 | 계정 API 회원 스코프 | `/api/accounts` 가 `readSessionMember` 를 안 부른다 | `dashboard/src/app/api/accounts/route.ts` 에 `readSessionMember` 적용 |
| #N11 | enum/옵션 조회 | `options` 가 `exposure-suite` 잡에만 붙어 나온다. `ExposureTargetId` 7개, `CheckKind` 3개는 API 로 노출 안 됨 | `dashboard/src/app/api/meta/route.ts` |
| #N12 | 실행 결과 요약 | `exitCode` 만. "몇 개 중 몇 개 노출" 같은 구조화 결과는 로그 파싱뿐 | run 종료 시 요약 저장 (`src/server/run-record.ts`) |

### 7-6. 서비스 간 결손

| ID | 못 하는 것 | 왜 | 만들려면 |
|---|---|---|---|
| #X1 | 노출지기 ↔ 나머지 서비스 연동 | 노출지기 쿠키로 스케줄러를 못 부르고 그 반대도 안 된다. 계정 개념도 다르다(`members` vs 다붓 `users`) | 서비스 토큰 발급 또는 노출지기를 다붓 JWT 로 통합 (`dashboard/src/server/auth.ts` 교체) |
| #X2 | 이미지 서버 파서 통일 | §6-8. 파서가 3종 | 바이로 `src/shared/api/google-image-api.ts:45-50`, 스케줄러 `src/services/manuscript.service.ts:284-301` 을 다붓 `utils/image_server.py:70-95` 방식으로 포팅 |

---

## 8. 에이전트 실행 규칙 요약

**Ply 에이전트가 이 4개 서비스를 부를 때 반드시 지킬 것.**

### 8-1. 인증

1. 다붓·스케줄러: `POST https://blog-analyzer.fly.dev/auth/app/login` `{username,password}` → `access_token` → 이후 `Authorization: Bearer <token>`. **스케줄러도 같은 토큰을 쓴다**
2. 바이로: `POST https://cafe-bot-two.vercel.app/api/agent/login` `{loginId,password}` → `token`
3. 노출지기: `POST .../api/auth/login` `{loginId,password}` → `Set-Cookie: dashboard_session` (쿠키 유지 필요)
4. **토큰은 서로 호환되지 않는다.** 노출지기·바이로는 완전 별개

### 8-2. 요청을 만들 때

5. **필드명은 서비스마다 다르다.** 다붓 요청은 snake_case, 바이로·노출지기는 camelCase, 스케줄러 `/bot/*` 는 최상위만 snake — §5-13 표를 보고 쓸 것
6. **오타는 400 을 안 낸다. 조용히 무시된다.** §6-7. 필드명을 추측하지 말고 이 문서나 `/openapi.json` 에서 확인해라
7. **enum 은 §5 에서 골라라.** 특히 스케줄러 `manuscript_type` 12개(§5-6), 다붓 `db_category` 58개(§5-1), `step.type` 3개(§5-2), 바이로 노출 `status` 한글 3개(§5-8)
8. 숫자는 대부분 **조용히 clamp** 된다 (§5-12). `count:50` 을 보내고 50장을 기대하지 마라

### 8-3. 응답을 읽을 때

9. **200 을 받았다고 성공이 아니다.** 반드시 확인할 것:

| 호출 | 확인할 것 |
|---|---|
| 다붓 `/generate/project` | `images`/`html`/`zip_url` **키 존재 여부** (없으면 스텝 실패) |
| 다붓 `/generate/batch` | `results[].success`. 최상위 `success` 는 **건수 int** |
| 다붓 `/bot/*` | `results[].success`, `failed_count` |
| 다붓 image-batch 폴링 | `status` 가 `"error"` 인지 |
| 스케줄러 `/bot/auto-schedule` | `success` **와** `reused` 둘 다 |
| 스케줄러 `/schedules/:id/execute` | `enqueued` 는 큐에 넣은 수가 아니다 |
| 바이로 `heartbeat`, `result` | `{ok:false}` 인지 (200 이어도 실패) |
| 바이로 `GET /api/accounts` | `[]` 가 "없음"인지 "인증 실패"인지 구분 불가 |
| 모든 Server Action 계열 | `{success:false, error}` |

10. 다붓 응답 키는 **Pydantic 통과분은 snake, Mongo 문서 그대로는 camel + `_id`** 다. `/generate/*` 원고 계열은 후자라 `createdAt` 이지 `created_at` 이 아니다

### 8-4. 쓰기 작업

11. **전체 교체 API 3곳**(§6-4)은 반드시 `GET` → 수정 → `PUT/POST`. 노출지기 프리셋이 가장 위험하다
12. 다붓 `PUT /projects/{id}` 에서 값을 **지우려면 `null` 이 아니라 `""` / `[]`**
13. 다붓 `POST /projects` 는 `key` 충돌 시 409 가 아니라 **`-2`,`-3` 을 붙여 다른 key 로 만든다** (`project.py:149` → `_shared.py:26-33`). **응답의 `key` 를 반드시 다시 읽어라**
14. 바이로 `agent/result` 의 `status` 는 **`'failed'` 정확히 그 문자열만 실패다.** 오타 하나로 실패가 성공으로 기록된다

### 8-5. 말할 때

15. **바이로는 "발행했습니다"가 아니라 "발행 대기열에 넣었습니다"다.** 실행은 로컬 데스크톱 앱이 한다 (§2-1)
16. **스케줄러도 큐다.** `/bot/auto-schedule` 은 예약을 걸 뿐 발행하지 않는다
17. 바이로 댓글은 **무조건 8개.** 개수 파라미터를 만들려 하지 마라 (`CAFE_COMMENT_COUNT` 고정)
18. `keywords[]` 는 **`"키워드:카테고리"` 포맷** (바이로·스케줄러 공통)

### 8-6. 보안

19. **바이로 `/api/agent/context`·`/api/agent/accounts` 응답에 평문 비밀번호가 들어 있다.** 로그·프롬프트·스크린샷·요약에 절대 흘리지 마라
20. 다붓 `/bot/*` 에도 계정 비번을 body 로 보낸다. 요청 로그를 남기지 마라
21. **`POST /api/queues/drain-all`(스케줄러)은 전 테넌트의 대기 잡을 날린다.** 사용자 확인 없이 부르지 마라
22. 노출지기 `/api/pm2/*/stop` 은 크론 데몬을 멈춘다. 마찬가지로 확인 후에

---

## 부록: 파일 위치 빠른 참조

| 무엇 | 어디 |
|---|---|
| 다붓 라우터 등록 | `dabut-backend/api.py:137-232` |
| 다붓 인증 | `dabut-backend/utils/auth.py:48-79` |
| 다붓 카테고리 58개 | `dabut-backend/_constants/categories.py:7` |
| 다붓 스텝 카탈로그 | `dabut-backend/_constants/pipeline_steps.py:20-83` |
| 다붓 모델 카탈로그 | `dabut-backend/_constants/model_catalog.py:28-55` |
| 다붓 파이프라인 실행 | `dabut-backend/llm/pipeline_runner.py` |
| 바이로 브로커 | `cafe-bot/src/shared/lib/agent-broker/index.ts` |
| 바이로 워커 클라이언트 (218줄) | `cafe-bot/agent/lib/broker-client.ts` |
| 바이로 데스크톱 액션 계약 | `cafe-bot/agent/lib/desktop-action-contract.ts:34-43` |
| 바이로 댓글 잡 모델 | `cafe-bot/src/shared/models/manual-comment-job.ts` |
| 스케줄러 라우트 등록 | `scheduler-server/src/routes/index.ts:8-18` |
| 스케줄러 enum (중복 2곳) | `scheduler-server/src/routes/schedule.route.ts:46-49` **+** `src/schemas/dto.ts:12,26,40` |
| 스케줄러 인증 훅 | `scheduler-server/src/routes/auth.route.ts:63-73` |
| 스케줄러 멱등성 | `scheduler-server/src/services/schedule-idempotency.service.ts` |
| 노출지기 인증 프록시 | `blog-cron-bot/dashboard/src/proxy.ts:4-36` |
| 노출지기 잡 레지스트리 | `blog-cron-bot/dashboard/src/server/job-registry.ts:64-236` |
| 노출지기 프리셋 파서 | `blog-cron-bot/dashboard/src/server/preset.ts:236-435` |
| 노출지기 타겟 7개 | `blog-cron-bot/dashboard/src/shared/config/exposure-contract/index.ts:1-11` |
