---
topic: schedules
title: 예약 발행과 큐
triggers: [예약, 예약 발행, 예약 취소, 예약 수정, 큐, 재실행, 발행 실패, 스케줄러, 파이프라인]
routes:
  - scheduler GET /health
  - scheduler POST /api/auth/login
  - scheduler GET /api/auth/me
  - scheduler POST /bot/auto-schedule
  - scheduler GET /schedules
  - scheduler GET /schedules/{id}
  - scheduler DELETE /schedules/{id}
  - scheduler POST /schedules/{id}/execute
  - scheduler GET /api/queues/dashboard
  - scheduler GET /api/queues/{accountId}/jobs
  - scheduler POST /api/queues/{accountId}/retry
  - scheduler GET /queues/stats
  - scheduler GET /api/content-pipelines
  - scheduler GET /api/content-pipelines/blocks
tools: [auto_schedule_posts, list_schedules, get_schedule, cancel_schedule, list_scheduler_accounts, dabut_login, api_get]
---

베이스 주소: `{{schedulerBaseUrl}}` · 인증: 다붓 로그인 토큰(Bearer)

이 저장소의 `scheduler-server/api.md` 는 참조하지 않는다. 지금도 `/bot/auto` 를 평문
비밀번호 본문과 함께 설명하는데 도구가 실제로 쓰는 것은 `/bot/auto-schedule` 이다.
틀린 문서는 없는 문서보다 나쁘다.

## 예약에 수정 API 가 없다

`POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다. PUT 도 PATCH 도 없다.
"예약 날짜만 바꿔줘" 는 **취소 후 재등록**이고, 되살리는 기능이 없어서 취소하면 끝이다.
사용자에게 그 사실부터 말한 뒤에 진행한다.

## 등록

`POST /bot/auto-schedule`. 최상위가 전부 snake_case 이고 zod 가 non-strict 라
이름이 어긋난 키는 400 없이 조용히 버려진다. 그 변환은 `buildAutoScheduleBody` 한 곳에
모아 두고 테스트로 이름을 고정했다.

주의할 것 셋.

1. **실패해도 HTTP 200 이다.** 계정 크리덴셜 복호화 실패나 `item_options` 길이 불일치는
   `{ success: false, message }` 로 돌아온다. status 가 아니라 본문을 봐야 한다.
2. **`account.id` 는 네이버 로그인 id 다.** `list_scheduler_accounts` 가 주는 값은
   다붓의 Mongo ObjectId 라서 `id` 로 보내면 "Account credentials not provided" 로 죽는다.
   `dabutAccountId` 로 보내야 크리덴셜 복호화 경로를 탄다.
3. **재사용 지문에 `project_id` 가 빠져 있다.** 프로젝트만 바꿔 같은 조건으로 다시 걸면
   `reused: true` 로 예전 것이 그대로 돌아오고 변경이 반영되지 않는다. 그때가 저장값이
   보낸 값과 다를 가능성이 가장 높은 경우라 반드시 `get_schedule` 로 되읽는다.
   이건 스케줄러 쪽 문제라 이 앱에서 고칠 수 없다.

원고 스타일: {{manuscriptTypes}}
이미지 출처: {{imageSources}}

## 읽기

`GET /schedules` — 최근 50건 고정. 페이지네이션이 없다. 필터는 `accountId` 와 `status`
둘뿐이고 다른 키는 조용히 버려진다. 묶음 단위 정보만 나오고 키워드와 발행 시각은 없다.

`GET /schedules/{id}` — 여기에만 `jobs` 가 있고 키워드·발행 시각·저장된 프로젝트가 나온다.
예약을 걸고 나면 반드시 이걸로 저장값을 확인한 뒤 보고한다.

묶음 상태: {{scheduleStatuses}}
건별 상태: {{scheduleJobStatuses}}
둘은 다른 값이다. 섞으면 필터가 조용히 빈 결과를 준다.

## 소유자 스코프는 서버 설정에 달려 있다

`GET /schedules`, `GET /schedules/{id}`, `DELETE /schedules/{id}` 는 셋 다
`resolveScheduleAccountScope` 를 지난다. 이 함수는 다붓 인증이 켜져 있으면 요청자의
블로그 계정 목록으로 스코프를 걸고(`accountId: { $in: ... }`), 남의 예약에는 404 를 준다.
403 이 아니라 404 인 이유는 id 의 존재까지 감추기 위해서다.

문제는 그 조건이다. `JWT_SECRET` 이나 `DABUT_APP_MONGO_URI` 가 없어 다붓 인증이 꺼진
배포에서는 스코프 함수가 `null` 을 돌려주고, 인증 훅도 통째로 꺼진다. 그때는
**토큰 없이 아무나 전부 읽고 지운다.** 즉 서버 쪽 보호는 켜져 있을 때만 있다.

그래서 이 앱은 자기 쪽에서도 소유를 따로 판정한다. 근거는 `GET /api/blog-accounts` 이고,
여기서 나온 `loginId` 집합이 "내 예약" 의 기준이다. `list_schedules` / `get_schedule` /
`cancel_schedule` 이 전부 이 판정을 통과한다. 서버 스코프가 켜져 있으면 같은 결과를 두 번
거르는 것이고, 꺼져 있으면 이 판정이 유일한 방어다.

이래서 `api_get` 으로 `/schedules` 를 직접 읽는 것과 `list_schedules` 도구를 쓰는 것이
같지 않다. 도구를 쓴다. `api_get` 은 도구가 없는 읽기에만 쓴다.

## 취소

`DELETE /schedules/{id}` 는 삭제가 아니라 소프트 취소다. 큐에서 잡을 빼고 status 를
cancelled 로 바꾼다. 문서는 남아 계속 읽히지만 되살리는 엔드포인트는 없다.

이미 발행된 건까지 status 를 cancelled 로 덮는다. **올라간 글은 네이버에서 내려가지
않는다.** 전체 건수를 "안 올라간다" 로 말하면 거짓이 된다.

## 큐와 재실행

- `GET /api/queues/dashboard` — 계정별 큐 현황
- `GET /api/queues/{accountId}/jobs` — 그 계정의 큐 잡
- `POST /api/queues/{accountId}/retry` — 실패한 잡 재시도
- `GET /queues/stats` — 전체 통계
- `POST /schedules/{id}/execute` — pending·generating 인 건만 다시 큐에 넣는다.
  cancelled 는 다시 안 들어간다

## 파이프라인

- `GET /api/content-pipelines/blocks` — 쓸 수 있는 블록 목록
- `GET /api/content-pipelines` — 저장된 파이프라인
- `POST /api/content-pipelines`, `DELETE /api/content-pipelines/{key}` — 쓰기라 도구가 없다
