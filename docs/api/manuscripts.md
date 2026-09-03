---
topic: manuscripts
title: 다붓 원고와 프로젝트
triggers: [원고, 원고 생성, 프로젝트, 지침, 프리셋, 원고 이력, 원고 검색, 이미지 생성, 다붓]
routes:
  - dabut POST /auth/app/login
  - dabut GET /auth/app/me
  - dabut GET /projects
  - dabut POST /projects
  - dabut GET /projects/{project_id}
  - dabut PUT /projects/{project_id}
  - dabut DELETE /projects/{project_id}
  - dabut GET /projects/models
  - dabut GET /projects/presets
  - dabut GET /projects/steps
  - dabut GET /projects/categories
  - dabut POST /generate/project
  - dabut GET /search/manuscripts/visible
  - dabut GET /search/manuscript/{manuscript_id}
  - dabut GET /search/history
  - dabut GET /search/popular
  - dabut GET /search/stats
  - dabut GET /generate/image-models
  - dabut GET /auth/app/api-keys
tools: [dabut_login, list_dabut_projects, generate_manuscript_dabut, generate_manuscript, api_get]
---

베이스 주소: `{{dabutBaseUrl}}` · 인증: 다붓 로그인 토큰(Bearer)

FastAPI 라 `{{dabutBaseUrl}}/openapi.json` 이 인증 없이 열려 있다. 경로가 132개다.
`npm run api:sync` 가 그걸 읽어 스냅샷을 갱신한다.

## 프로젝트가 곧 원고 뽑는 방식

프로젝트 하나에 모델·지침·전후 단계가 묶여 있다. `manuscriptType` 같은 고정 스타일보다
프로젝트가 이긴다 — `projectId` 를 넘기면 원고 생성 단계에서 manuscriptType 은 무시된다.

- `GET /projects` — 목록. `list_dabut_projects` 가 이걸 부르고 결과의 id 만 이후에 통과시킨다
- `GET /projects/{project_id}` — 하나의 상세. 어떤 지침이 들어 있는지 확인할 때
- `GET /projects/models` — 고를 수 있는 모델
- `GET /projects/presets` — 프로젝트 만들 때 쓰는 프리셋
- `GET /projects/steps` — 전후 단계 목록
- 쓰기(`POST /projects`, `PUT`, `DELETE`, `POST /projects/{id}/duplicate`)는 도구가 없다.
  프로젝트를 만들거나 고치는 일은 다붓 앱 화면에서 한다. `open_service` 로 열어 준다

## 원고 생성

`POST /generate/project` — `generate_manuscript_dabut` 이 부르는 곳. 최대 10분 걸린다.
프로젝트의 모델·지침·전후 단계를 그대로 태운다. 실제 발행용 원고는 이걸 쓴다.

`/generate/*` 아래 다른 경로가 50개 넘게 있다(모델별·업종별 직행 엔드포인트).
전부 POST 라 `api_get` 으로 못 부르고 도구도 없다. 다붓 로그인이 안 되면
`generate_manuscript` 로 대체한다 — 그건 OpenRouter 로 직접 쓰는 폴백이다.

## 원고 이력

- `GET /search/manuscripts/visible` — 보이도록 해둔 원고 목록
- `GET /search/manuscript/{manuscript_id}` — 원고 하나
- `GET /search/history` — 검색 이력
- `GET /search/popular`, `GET /search/stats` — 인기 키워드와 통계
- `POST /search/keyword`, `POST /search/all` — 검색은 POST 라 `api_get` 으로 못 부른다
- 삭제(`DELETE /search/manuscript/{id}`)는 되돌릴 수 없어서 도구를 만들지 않았다.
  다붓 화면에서 한다

## 이미지

- `GET /generate/image-models` — 쓸 수 있는 이미지 모델
- `POST /generate/image`, `POST /generate/image-batch` — 생성. 도구 없음
- `GET /generate/image-batch/{job_id}` — 배치 상태
- `GET /generate/image-batch/{job_id}/download` — 파일 바이트라 `api_get` 에서 뺐다

원고에 이미지를 같이 만들려면 `generate_manuscript_dabut` 의 `withImages` 를 쓴다.

## 계정과 키

- `GET /auth/app/me` — 지금 로그인한 다붓 계정
- `GET /auth/app/api-keys` — 등록된 외부 API 키 목록. 키 값 자체는 나오지 않는다
- `POST /auth/app/change-password` — 다붓 로그인 비밀번호 변경. 도구 없음.
  네이버 계정 비밀번호와 다른 것이다. 헷갈리면 accounts 를 읽는다
