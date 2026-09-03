---
topic: exposure
title: 노출지기
triggers: [노출체크, 카페체크, 카페 노출체크, 프리셋, 시트, 실행 결과, 노출지기, 순위 확인, 실행 묶음]
routes:
  - exposure POST /api/auth/login
  - exposure GET /api/preset
  - exposure PUT /api/preset
  - exposure GET /api/jobs
  - exposure POST /api/jobs/{jobId}/run
  - exposure GET /api/runs
  - exposure POST /api/runs/{runId}/stop
  - exposure GET /api/outputs
  - exposure GET /api/pm2
  - exposure GET /api/accounts
tools: [exposure_login, update_exposure_preset, list_exposure_jobs, run_exposure_check, api_get, open_service]
---

베이스 주소: `{{exposureDashboardUrl}}`

## 인증이 다르다

다붓·스케줄러는 Bearer 토큰인데 여기는 httpOnly 쿠키 세션이다.
`POST /api/auth/login` 에 `{ loginId, password }` 를 보내면 `dashboard_session` 쿠키가
Set-Cookie 로 온다. 유효기간 7일. 비밀번호는 저장하지 않고 쿠키만 암호화해서 둔다.

쿠키가 없거나 만료됐으면 `exposure_login` 을 부른다. 사용자에게 "가서 로그인하세요" 라고
말하지 않는다. 어떤 도구든 401 을 만나면 저장된 쿠키를 지우고 다시 로그인을 요청한다.

`/api/health` 와 `/api/auth/login` 만 로그인 없이 열려 있다. 나머지는 전부 프록시가 막는다.

## 프리셋 — 이 계정이 무엇을 돌릴 수 있는지를 정하는 곳

`GET /api/preset` → `{ member, preset }`
`PUT /api/preset` ← `{ preset }` → 저장된 값을 그대로 돌려준다

**PUT 은 전체 교체다.** 부분 갱신 엔드포인트가 없다. 그래서 프리셋을 고칠 때는 반드시
GET 으로 지금 값을 읽고, 바꿀 항목만 갈아끼운 뒤 통째로 PUT 한다. 병합을 손으로 하면
안 건드린 항목이 조용히 사라지고 그 실패에는 에러가 없다. `update_exposure_preset` 이
그 병합을 코드로 한다. 모델이 프리셋 JSON 을 다시 쓰지 않는다.

프리셋 안에 든 것:

| 키 | 뜻 |
| --- | --- |
| `targets` | 코드에 박힌 노출체크 대상 7개의 켜짐/꺼짐과 시트 위치 |
| `blogGroups` | 이름 붙인 블로그 계정 묶음. 대상들이 골라 쓴다 |
| `runBundles` | 자주 쓰는 대상 조합에 이름을 붙인 실행 버튼 |
| `cafeChecks` | **직접 만드는 카페 노출체크.** 코드 수정 없이 만들 수 있는 유일한 항목 |
| `doorayWebhookUrl` | 결과 알림을 보낼 곳. https 만 받는다 |

400 응답의 `error` 는 대시보드가 사용자에게 그대로 보여주려고 한국어로 쓴 문구다.
고쳐 쓰지 말고 그대로 전달한다.

## update_exposure_preset 이 받는 동작

{{presetActions}}

`set_target_sheet` 는 여기 없다. 대상의 시트 주소는 저장은 되지만 봇이 안 읽는다.
이유는 limits 를 읽는다.

## 카페 노출체크 만들기 (코드 수정 없이 되는 것)

`update_exposure_preset` 의 `add_cafe_check`. 필요한 값은 넷이다.

- `label` — 사람이 부를 이름
- `sheetUrl` — 키워드를 읽고 결과도 쓸 구글시트 주소. `/spreadsheets/d/<id>` 가 있어야 한다
- `tabTitle` — 그 시트 안의 탭 이름
- `targets` — 찾을 카페·블로그 주소. `cafe.naver.com` 이면 카페, `blog.naver.com` 이면 블로그로 갈린다

id 는 도구가 label 에서 만든다. 모델이 짓지 않는다. 만들고 나면 실행 목록에
`cafe-check:<id>` 로 나타나고 `run_exposure_check` 로 바로 돌릴 수 있다.

한 계정에 12개까지, 한 체크에 주소 50개까지. 주소에 쉼표를 넣을 수 없다 — 봇에
환경변수로 쉼표를 이어 붙여 넘기기 때문에 값 안의 쉼표는 두 개로 쪼개진다.

## 대상 켜고 끄기

`enable_target` / `disable_target` 에 `targetId` 를 준다. id 는 `GET /api/preset` 의
`targets[].id` 에서 온다. 없는 id 는 도구가 거부한다.

`api_get` 으로 프리셋을 읽으면 `doorayWebhookUrl` 은 값이 아니라 가려진 표시로 온다.
그 주소 자체가 인증 토큰이라 대화에 싣지 않는다. 웹훅이 걸려 있는지 없는지는 알 수 있고,
바꾸는 것은 `set_dooray_webhook` 이 한다.

**대상의 시트 주소는 바꿀 수 없다.** 저장도 되고 검증도 통과하지만 봇이 그 값을 읽지
않는다. 자세한 건 limits 를 읽는다.

## 실행

`GET /api/jobs` → `{ jobs, bundles }`. 이 회원의 프리셋 기준으로 서버가 걸러 준 목록이라
`cafe-check:*` 까지 들어 있다. `isBlocked` 가 true 면 다른 노출체크가 이미 돌고 있다는
뜻이고 `blockReason` 에 이유가 적혀 있다.

`POST /api/jobs/{jobId}/run` → `{ runId }`. 실행은 서버에서 돌기 때문에 이 앱을 닫아도
계속 간다. 목록에서 숨기는 것만으로는 부족해서 서버가 `canMemberRunJob` 으로 한 번 더
막는다. 못 돌리는 항목은 403 이다.

수 분에서 수십 분 걸린다. `run_exposure_check` 는 실행 전에 스스로 확인 카드를 띄운다.
사용자가 실행을 분명히 말했을 때만 부른다. "카페 노출체크 하고 싶어" 는 실행 요청이 아니다.

## 결과 보기

- `GET /api/runs` — 지금까지의 실행 목록
- `POST /api/runs/{runId}/stop` — 도는 실행을 멈춘다
- `GET /api/runs/{runId}/stream` — SSE. 응답이 끝나지 않아서 `api_get` 에서 뺐다
- `GET /api/outputs` — 만들어진 결과 파일 목록
- `GET /api/outputs/download` — 파일 내용. 대화에 부을 이유가 없어 `api_get` 에서 뺐다.
  사용자가 파일을 원하면 `open_service` 로 화면을 연다
- `GET /api/pm2` — 스케줄러 데몬 상태
- `GET /api/accounts` — 관리 목록에 등록된 블로그 계정
