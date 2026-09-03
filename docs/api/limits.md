---
topic: limits
title: 코드를 고쳐야만 되는 것들
triggers: [안 됨, 못 함, 왜 안 되지, 새 타겟, 타겟 추가, 시트 바꾸기, 예약 수정, 계정 옮기기, 권한]
routes: []
tools: [update_exposure_preset, manage_naver_account, cancel_schedule, ask_user]
---

"할 수 없어요" 라고 말하기 전에 반드시 이 페이지를 읽는다.

여기 적힌 것은 전부 **API 로는 못 하지만 왜 못 하는지와 어디를 고쳐야 하는지가 분명한**
일들이다. "제 권한 밖이에요" 로 끝내지 않는다. 왜, 어디를, 그리고 사용자가 진짜 원하는
것이 사실 다른 것은 아닌지까지 말한다. 대부분의 경우 진짜 원하는 것은 코드 수정이 아니다.

## 노출체크 타겟을 8번째로 추가

API 로 안 된다. `EXPOSURE_TARGET_IDS` 가 유니온 타입의 원천이라 여러 곳이 함께 움직인다.
`Record<ExposureTargetId, ...>` 로 선언된 표들은 타입이 강제하니 빠뜨리면 컴파일이 죽지만,
마지막 두 개는 타입이 안 잡아 줘서 조용히 어긋난다.

노출지기 저장소 `blog-cron-bot` 에서:

```
 1 src/lib/exposure-suite/options.ts:1        EXPOSURE_TARGET_IDS  ← 여기가 원천
 2 src/lib/exposure-suite/options.ts:37       TARGET_COMMANDS      (Record 라 타입이 강제한다)
 3 src/cron-exposure-suite.ts:26              TARGET_LABELS        (Record)
 4 src/cron-exposure-suite.ts:36              TARGET_PRIORITY      (Record)
 5 package.json                               "exposure:<새이름>" 스크립트
 6 src/constants/                             그 타겟이 읽을 시트 id 와 탭 이름
 7 src/lib/tenant/preset.ts:115               LAB_21_PRESET.targets 에 시드 항목
 8 dashboard/src/shared/config/exposure-contract/index.ts:1   EXPOSURE_TARGETS
 9 dashboard/src/server/job-registry.ts:64    JOB_REGISTRY 에 실행 항목
10 dashboard/src/server/member-jobs.ts:16     JOB_REQUIRED_TARGETS
       ← 빠뜨리면 canMemberRunJob 이 false 라 아무에게도 안 보인다. 타입이 안 잡아 준다
11 dashboard/src/server/exposure-suite-options.ts:32  ALLOWED_TARGET_IDS 는 8번에서 파생돼 자동이다
12 각 저장소의 테스트                          목록 길이를 고정한 단언들
```

**사용자에게는 이렇게 말한다.**

> 이건 코드에 박혀 있어서 노출지기 저장소 열 곳 넘게를 같이 고쳐야 해요.
> 그런데 가장 흔한 오해가 하나 있어요 — 새 타겟이 필요 없는 경우가 많아요.
> 다른 시트의 키워드로 카페나 블로그 노출을 보고 싶은 거면 **카페 노출체크**로
> 코드 수정 없이 5초면 돼요. 어느 쪽인지 알려주세요.

`cafe` 타겟은 **이미 있다.** "카페 노출체크 추가" 라는 말이 새 타겟을 뜻하는 경우는 거의 없다.
거의 항상 "다른 시트를 보는 카페 체크를 하나 더 만들어 줘" 라는 뜻이고, 그건
`update_exposure_preset` 의 `add_cafe_check` 로 바로 된다.

## 노출체크 대상의 시트 주소 바꾸기

**저장은 되는데 봇이 안 읽는다.** 이게 가장 위험한 종류의 "된다" 다.

`PUT /api/preset` 은 `targets[].source` / `targets[].result` 를 받아서 검증하고
데이터베이스에 저장까지 한다. 그런데 봇이 실제로 프리셋에서 읽는 것은
`blogGroupIds` 와 `blogIds` 뿐이다 (`src/lib/blog-id-overrides/index.ts` 의
`applyPresetBlogIds` 가 그 두 개만 쓴다). 시트 위치는 `src/constants/` 에 박혀 있다.

그래서 시트를 바꾸면 화면에도 바뀐 값이 보이고 API 도 200 을 주는데, 다음 실행은
예전 시트를 그대로 읽는다. 아무 에러도 안 난다.

이 때문에 `update_exposure_preset` 의 action 목록에 `set_target_sheet` 를 **일부러 넣지
않았다.** 도구가 있으면 "시트 바꿨어요" 라고 보고한 뒤 조용히 틀린 결과가 나온다.

사용자에게는 이렇게 말한다.

> 그 대상의 시트는 봇 코드에 박혀 있어서 화면에서 바꿔도 실행에는 반영되지 않아요.
> 저장은 되는데 봇이 그 값을 안 읽어서 오히려 바꾼 줄 알고 넘어가는 게 더 위험해요.
> 다른 시트를 보시려는 거면 카페 노출체크를 새로 만드는 쪽이 확실해요. 그건 바로 돼요.

## 예약 내용 수정

스케줄러에 수정 엔드포인트가 없다. `POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다.
날짜·시각·키워드·프로젝트 중 무엇을 바꾸려 해도 **취소 후 재등록**이고, 되살리는 기능이
없어서 취소하면 그것으로 끝이다.

게다가 재사용 지문에 `project_id` 가 빠져 있어서, 취소하지 않고 프로젝트만 바꿔 다시 걸면
`reused: true` 로 옛 예약이 그대로 돌아온다. "다시 걸면 되겠지" 가 안 통한다.

사용자에게 취소가 되돌릴 수 없다는 사실부터 말하고 확인받은 뒤에 진행한다.

## 네이버 계정의 실제 비밀번호 변경

우리가 못 한다. 네이버 사이트에서 사용자가 직접 바꿔야 한다.
`manage_naver_account` 의 `change_password` 는 **바꾼 비밀번호를 우리 쪽에 반영**하는 것이지
네이버 비밀번호를 바꾸는 것이 아니다.

"비번 바꿔줘" 를 들으면 어느 쪽인지 먼저 가른다. 네이버에서 이미 바꾸고 온 것이면
`change_password` 가 이 앱과 다붓 두 곳을 함께 갱신한다.

## 노출지기 계정·블로그 목록의 소유자 구분

`/api/accounts`, `/api/runs`, `/api/outputs`, `/api/pm2` 에는 회원 단위 소유권 확인이 없다
(세션을 확인하는 것은 `/api/jobs` 와 `/api/preset` 뿐이다). 프록시의 서명 검사는 통과해야
하므로 로그인 자체는 필요하지만, 로그인한 아무나 같은 것을 본다.

읽기라 당장 문제는 아니지만 `POST /api/accounts` 를 도구로 붙이려면 그쪽부터 고쳐야 한다.
그래서 계정 목록 쓰기는 도구로 열지 않았다.

## 이 앱의 설정값 변경

OpenRouter 키, 모델, 연동 서버 주소, 노출지기 저장소 경로, 브라우저 프로필은 도구가 없다.
Electron IPC 로만 바뀌고 패널 `설정` 에서 사용자가 직접 넣는다.
한 번 넣으면 다시 안 바꾸는 값이라 도구를 만들지 않은 것이다. 자세한 건 settings 를 읽는다.

## 도구를 새로 만들 기준

도구는 28개가 상한에 가깝다. 앞으로 요청이 오면 기본은 `api_get` + 이 문서로 처리하고,
새 도구는 **쓰기이면서 서버에 없는 안전장치가 필요한 것**만 받는다.
읽기는 도구를 늘리지 않는다.
