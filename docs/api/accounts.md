---
topic: accounts
title: 네이버 계정
triggers: [비밀번호, 비번, 패스워드, 계정 추가, 계정 등록, 계정 삭제, 계정 빼줘, 로그인 안 됨, 로그인 실패]
routes:
  - dabut GET /naver-accounts
  - dabut POST /naver-accounts
  - dabut PUT /naver-accounts/{account_id}
  - dabut DELETE /naver-accounts/{account_id}
  - dabut POST /naver-accounts/import
  - scheduler GET /api/blog-accounts
  - scheduler GET /api/blog-accounts/{id}/credential-check
tools: [manage_naver_account, list_accounts, check_login, naver_login, list_scheduler_accounts, api_get]
---

계정이 세 종류다. 사용자는 그 경계를 모르고 "계정" 이라고만 말한다. 어느 것을 말하는지부터 가른다.

## 어느 계정을 말하는 건지 가르는 법

| 사용자가 하려는 일 | 그건 이 계정이다 |
| --- | --- |
| 이 브라우저에서 네이버에 로그인해서 글을 쓰거나 지운다 | 이 앱 로컬 (accounts.json) |
| 예약 발행을 건다. 서버가 대신 로그인해서 올린다 | 다붓 (naver-accounts) |
| 노출체크에서 이 블로그가 몇 위인지 본다 | 노출지기 프리셋의 blogIds |

"비번 바꿔줘" 는 보통 앞의 둘 다다. 네이버에서 실제로 비밀번호를 바꾼 뒤에 오는 말이라
한쪽만 고치면 나머지가 옛 비밀번호로 계속 로그인을 시도한다. manage_naver_account 의
change_password 가 두 곳을 함께 바꾸는 이유가 그것이다.

세 번째(노출지기 blogIds)는 비밀번호를 저장하지 않는다. 노출체크는 로그인하지 않고
검색 결과만 읽기 때문이다. 그러니 "노출체크 계정 비번" 이라는 것은 존재하지 않는다.

## 이 앱 로컬 계정 (accounts.json)

API 가 아니다. `~/Library/Application Support/ply/config/accounts.json` 파일이고
비밀번호는 safeStorage 로 암호화해서 넣는다.

- 목록: `list_accounts`
- 추가·비번변경·삭제: `manage_naver_account`
- 세션 확인: `check_login` / 로그인 시도: `naver_login`

id 는 라벨에서 만든 slug 다. 그리고 그 id 가 곧 브라우저 프로필 파티션이다
(`persist:<id>`). 그래서 비밀번호를 바꾸려고 계정을 지웠다 다시 만들면 id 가 `-2` 로
밀리고 로그인 쿠키가 통째로 갈린다. 반드시 change_password 를 쓴다.

삭제는 되돌릴 수 없고, 저장된 비밀번호도 같이 사라진다. 다만 **브라우저 프로필과 로그인
쿠키는 남는다.** 계정을 지워도 그 프로필로 열린 탭은 여전히 네이버에 로그인된 상태다.
"지웠으니 로그아웃됐겠지" 는 틀렸다.

## 다붓 계정 (예약 발행이 쓰는 크리덴셜)

베이스 주소: `{{dabutBaseUrl}}` · 인증: 다붓 로그인 토큰(Bearer). 없으면 `dabut_login`.

| 하는 일 | 요청 |
| --- | --- |
| 목록 | `GET /naver-accounts` (`include_inactive=true` 로 꺼진 것까지) |
| 하나 읽기 | `GET /naver-accounts/{account_id}` |
| 추가 | `POST /naver-accounts` — name, login_id, password 가 필수 |
| 수정 | `PUT /naver-accounts/{account_id}` — 전부 optional. 보낸 필드만 바뀐다 |
| 삭제 | `DELETE /naver-accounts/{account_id}` |
| 여러 건 한 번에 | `POST /naver-accounts/import` |

`PUT` 의 `password` 필드가 비밀번호 변경 경로다. 응답의 `has_password` 로 저장 여부만
알 수 있고 평문은 어디서도 나오지 않는다.

읽기는 `api_get('dabut', '/naver-accounts')` 로 바로 된다. 쓰기는 도구가 한다 —
비밀번호가 도구 인자에 실리면 그 인자는 대화 기록과 모델 요청 본문에 그대로 남는다.

## 예약 발행 계정 (스케줄러가 보는 쪽)

베이스 주소: `{{schedulerBaseUrl}}` · 인증: 같은 다붓 토큰.

`GET /api/blog-accounts` 가 돌려주는 것은 다붓 계정을 스케줄러가 자기 모양으로 다시 준
것이다. `list_scheduler_accounts` 가 이걸 부른다. **여기 나오는 `id` 는 다붓의 Mongo
ObjectId 이고, 예약 문서의 `accountId` 는 네이버 로그인 id 다.** 둘은 다른 값이다.
auto_schedule_posts 는 앞의 것을 `dabutAccountId` 로 보내야 한다.

`GET /api/blog-accounts/{id}/credential-check` 는 네이버 로그인을 시도하지 않는다.
저장된 비밀번호가 복호화되는지만 본다. 부작용이 없어서 `api_get` 으로 열어 뒀다.
"예약이 로그인 실패로 죽는데 비번이 문제냐" 는 질문에 이걸로 답한다.

## 비밀번호가 흐르는 길

평문 비밀번호는 **패널 카드 → 메인 프로세스 → (로컬 저장소 | 다붓)** 로만 흐른다.
모델은 어느 지점에서도 값을 보지 못한다. 폼(`ask_user_form`)의 칸 종류에서 password 를
뺀 것도 같은 이유다 — 폼 답은 모델에게 그대로 돌아간다.

그래서 `manage_naver_account` 에는 password 파라미터가 없다. 사용자에게 설정 화면을
열라고 말하는 대신 이 도구를 부르면 카드가 뜬다.
