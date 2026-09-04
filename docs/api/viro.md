---
topic: viro
title: 바이로
triggers: [바이로, 카페, 카페봇, 댓글 작업, 댓글 잡, 댓글 큐, 카페 댓글, 워커 상태, 댓글 부족, 댓글 교체]
routes:
  - viro GET /api/agent/jobs
  - viro GET /api/agent/jobs/{jobId}
  - viro GET /api/agent/cafes
  - viro GET /api/agent/worker
tools: [api_get]
---

베이스 주소: `{{viroBaseUrl}}`

네이버 카페 글·댓글 자동화. 화면은 열지 않는다. 서비스 목록에 없고 `api_get` 으로만 다룬다.

## 인증이 다르다

다붓·스케줄러의 토큰이 여기서는 통하지 않는다. 바이로가 자기 DB 에 해시로 들고 있는
별도의 에이전트 토큰을 쓴다. 저장돼 있지 않으면 `api_get` 이 인증 없음으로 답한다.
그때는 사용자에게 바이로에서 토큰을 발급해 설정에 넣어달라고 말한다. 만들어 낼 수 없다.

## 댓글 작업 — 여기가 주력이다

`GET /api/agent/jobs` → `{ jobs, count }`

쿼리로 좁힌다. 셋 다 선택이다.

| 쿼리 | 값 |
|---|---|
| `status` | `pending` `running` `done` `failed` `cancelled` |
| `cafeId` | 카페 숫자 id |
| `limit` | 기본 50, 최대 100 |

모르는 `status` 를 주면 400 이 아니라 **조건에서 조용히 빠진다.** 필터가 걸린 줄 알고
전체 목록을 좁은 결과로 읽지 않도록, 돌아온 `jobs[].status` 를 직접 확인한다.

`GET /api/agent/jobs/{jobId}` → `{ job }`

남의 작업은 403 이 아니라 **404 로 답한다.** 그 id 가 존재한다는 사실 자체를 숨긴다.
그래서 404 는 "없다" 와 "내 것이 아니다" 를 구분해주지 않는다.

작업 하나에는 `results[]`(단 댓글)와 `deleteResults[]`(지운 댓글)가 따로 담긴다.
계정별 성공·실패가 각 항목의 `success`, `error` 에 있다.

## 작업 취소는 도구가 아니라 사람이 판단한다

`POST /api/agent/jobs/{jobId}/cancel` 은 **허용목록에 없다.** `api_get` 은 읽기 전용이고,
취소는 되돌릴 수 없어서 열어두지 않았다. 사용자가 취소를 원하면 화면에서 하도록 안내한다.

취소는 `pending` 인 동안에만 먹는다. 워커가 이미 집어갔으면 409 로 거절되고,
그 시점에는 댓글이 이미 달리는 중이다.

## 카페와 워커

`GET /api/agent/cafes` → `{ cafes, count }` — 이 계정에 등록된 카페. `cafeId` 를 여기서 얻는다.

`GET /api/agent/worker` → 로컬 에이전트 워커의 살아있음 여부. 큐가 밀려 있는데 작업이
안 도는 이유는 대개 워커가 꺼져 있어서다. 잡 상태만 보고 "처리 중" 이라고 말하기 전에 확인한다.

## 스캔은 읽기가 아니다

`POST /api/agent/scan/low-comment` 은 이름과 달리 **찾은 글에 댓글 작업을 큐에 넣는다.**
`POST /api/agent/scan/replacement` 는 후보만 돌려주고, 큐에 넣는 것은 `.../replacement/queue` 다.
셋 다 허용목록에 없다. 큐를 늘리는 일을 읽기 도구가 대신하지 않는다.

## 캡차는 여기서 풀지 않는다

바이로의 캡차 풀이는 스케줄러 `POST /api/captcha/solve` 로 넘어갔다.
`kind` 는 `login` `cafe-join` `cafe-create` 셋이고 `login` 만 `question` 이 필요하다.
바이로에 캡차 관련 키를 찾아보지 않는다. 없다.
