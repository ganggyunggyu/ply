/**
 * 이 파일은 생성물이다. 손으로 고치지 않는다.
 * 원본은 docs/api/*.md 이고 scripts/build-api-docs.mjs 가 만든다. 고칠 곳은 md 쪽이다.
 */

export const API_DOC_TOPICS = [
  "accounts",
  "exposure",
  "limits",
  "manuscripts",
  "schedules",
  "settings"
] as const;

export type ApiDocTopic = (typeof API_DOC_TOPICS)[number];

export type ApiDocPage = {
  title: string;
  triggers: string[];
  routes: string[];
  tools: string[];
  /** '## 제목' 단위로 쪼갠 본문 */
  sections: Record<string, string>;
  body: string;
};

export const API_DOCS: Record<ApiDocTopic, ApiDocPage> = {
  "accounts": {
    "title": "네이버 계정",
    "triggers": [
      "비밀번호",
      "비번",
      "패스워드",
      "계정 추가",
      "계정 등록",
      "계정 삭제",
      "계정 빼줘",
      "로그인 안 됨",
      "로그인 실패"
    ],
    "routes": [
      "dabut GET /naver-accounts",
      "dabut POST /naver-accounts",
      "dabut PUT /naver-accounts/{account_id}",
      "dabut DELETE /naver-accounts/{account_id}",
      "dabut POST /naver-accounts/import",
      "scheduler GET /api/blog-accounts",
      "scheduler GET /api/blog-accounts/{id}/credential-check"
    ],
    "tools": [
      "manage_naver_account",
      "list_accounts",
      "check_login",
      "naver_login",
      "list_scheduler_accounts",
      "api_get"
    ],
    "sections": {
      "어느 계정을 말하는 건지 가르는 법": "| 사용자가 하려는 일 | 그건 이 계정이다 |\n| --- | --- |\n| 이 브라우저에서 네이버에 로그인해서 글을 쓰거나 지운다 | 이 앱 로컬 (accounts.json) |\n| 예약 발행을 건다. 서버가 대신 로그인해서 올린다 | 다붓 (naver-accounts) |\n| 노출체크에서 이 블로그가 몇 위인지 본다 | 노출지기 프리셋의 blogIds |\n\n\"비번 바꿔줘\" 는 보통 앞의 둘 다다. 네이버에서 실제로 비밀번호를 바꾼 뒤에 오는 말이라\n한쪽만 고치면 나머지가 옛 비밀번호로 계속 로그인을 시도한다. manage_naver_account 의\nchange_password 가 두 곳을 함께 바꾸는 이유가 그것이다.\n\n세 번째(노출지기 blogIds)는 비밀번호를 저장하지 않는다. 노출체크는 로그인하지 않고\n검색 결과만 읽기 때문이다. 그러니 \"노출체크 계정 비번\" 이라는 것은 존재하지 않는다.",
      "이 앱 로컬 계정 (accounts.json)": "API 가 아니다. `~/Library/Application Support/ply/config/accounts.json` 파일이고\n비밀번호는 safeStorage 로 암호화해서 넣는다.\n\n- 목록: `list_accounts`\n- 추가·비번변경·삭제: `manage_naver_account`\n- 세션 확인: `check_login` / 로그인 시도: `naver_login`\n\nid 는 라벨에서 만든 slug 다. 그리고 그 id 가 곧 브라우저 프로필 파티션이다\n(`persist:<id>`). 그래서 비밀번호를 바꾸려고 계정을 지웠다 다시 만들면 id 가 `-2` 로\n밀리고 로그인 쿠키가 통째로 갈린다. 반드시 change_password 를 쓴다.\n\n삭제는 되돌릴 수 없고, 저장된 비밀번호도 같이 사라진다. 다만 **브라우저 프로필과 로그인\n쿠키는 남는다.** 계정을 지워도 그 프로필로 열린 탭은 여전히 네이버에 로그인된 상태다.\n\"지웠으니 로그아웃됐겠지\" 는 틀렸다.",
      "다붓 계정 (예약 발행이 쓰는 크리덴셜)": "베이스 주소: `https://blog-analyzer.fly.dev` · 인증: 다붓 로그인 토큰(Bearer). 없으면 `dabut_login`.\n\n| 하는 일 | 요청 |\n| --- | --- |\n| 목록 | `GET /naver-accounts` (`include_inactive=true` 로 꺼진 것까지) |\n| 하나 읽기 | `GET /naver-accounts/{account_id}` |\n| 추가 | `POST /naver-accounts` — name, login_id, password 가 필수 |\n| 수정 | `PUT /naver-accounts/{account_id}` — 전부 optional. 보낸 필드만 바뀐다 |\n| 삭제 | `DELETE /naver-accounts/{account_id}` |\n| 여러 건 한 번에 | `POST /naver-accounts/import` |\n\n`PUT` 의 `password` 필드가 비밀번호 변경 경로다. 응답의 `has_password` 로 저장 여부만\n알 수 있고 평문은 어디서도 나오지 않는다.\n\n읽기는 `api_get('dabut', '/naver-accounts')` 로 바로 된다. 쓰기는 도구가 한다 —\n비밀번호가 도구 인자에 실리면 그 인자는 대화 기록과 모델 요청 본문에 그대로 남는다.",
      "예약 발행 계정 (스케줄러가 보는 쪽)": "베이스 주소: `https://21lab-scheduler.fly.dev` · 인증: 같은 다붓 토큰.\n\n`GET /api/blog-accounts` 가 돌려주는 것은 다붓 계정을 스케줄러가 자기 모양으로 다시 준\n것이다. `list_scheduler_accounts` 가 이걸 부른다. **여기 나오는 `id` 는 다붓의 Mongo\nObjectId 이고, 예약 문서의 `accountId` 는 네이버 로그인 id 다.** 둘은 다른 값이다.\nauto_schedule_posts 는 앞의 것을 `dabutAccountId` 로 보내야 한다.\n\n`GET /api/blog-accounts/{id}/credential-check` 는 네이버 로그인을 시도하지 않는다.\n저장된 비밀번호가 복호화되는지만 본다. 부작용이 없어서 `api_get` 으로 열어 뒀다.\n\"예약이 로그인 실패로 죽는데 비번이 문제냐\" 는 질문에 이걸로 답한다.",
      "비밀번호가 흐르는 길": "평문 비밀번호는 **패널 카드 → 메인 프로세스 → (로컬 저장소 | 다붓)** 로만 흐른다.\n모델은 어느 지점에서도 값을 보지 못한다. 폼(`ask_user_form`)의 칸 종류에서 password 를\n뺀 것도 같은 이유다 — 폼 답은 모델에게 그대로 돌아간다.\n\n그래서 `manage_naver_account` 에는 password 파라미터가 없다. 사용자에게 설정 화면을\n열라고 말하는 대신 이 도구를 부르면 카드가 뜬다."
    },
    "body": "계정이 세 종류다. 사용자는 그 경계를 모르고 \"계정\" 이라고만 말한다. 어느 것을 말하는지부터 가른다.\n\n## 어느 계정을 말하는 건지 가르는 법\n\n| 사용자가 하려는 일 | 그건 이 계정이다 |\n| --- | --- |\n| 이 브라우저에서 네이버에 로그인해서 글을 쓰거나 지운다 | 이 앱 로컬 (accounts.json) |\n| 예약 발행을 건다. 서버가 대신 로그인해서 올린다 | 다붓 (naver-accounts) |\n| 노출체크에서 이 블로그가 몇 위인지 본다 | 노출지기 프리셋의 blogIds |\n\n\"비번 바꿔줘\" 는 보통 앞의 둘 다다. 네이버에서 실제로 비밀번호를 바꾼 뒤에 오는 말이라\n한쪽만 고치면 나머지가 옛 비밀번호로 계속 로그인을 시도한다. manage_naver_account 의\nchange_password 가 두 곳을 함께 바꾸는 이유가 그것이다.\n\n세 번째(노출지기 blogIds)는 비밀번호를 저장하지 않는다. 노출체크는 로그인하지 않고\n검색 결과만 읽기 때문이다. 그러니 \"노출체크 계정 비번\" 이라는 것은 존재하지 않는다.\n\n## 이 앱 로컬 계정 (accounts.json)\n\nAPI 가 아니다. `~/Library/Application Support/ply/config/accounts.json` 파일이고\n비밀번호는 safeStorage 로 암호화해서 넣는다.\n\n- 목록: `list_accounts`\n- 추가·비번변경·삭제: `manage_naver_account`\n- 세션 확인: `check_login` / 로그인 시도: `naver_login`\n\nid 는 라벨에서 만든 slug 다. 그리고 그 id 가 곧 브라우저 프로필 파티션이다\n(`persist:<id>`). 그래서 비밀번호를 바꾸려고 계정을 지웠다 다시 만들면 id 가 `-2` 로\n밀리고 로그인 쿠키가 통째로 갈린다. 반드시 change_password 를 쓴다.\n\n삭제는 되돌릴 수 없고, 저장된 비밀번호도 같이 사라진다. 다만 **브라우저 프로필과 로그인\n쿠키는 남는다.** 계정을 지워도 그 프로필로 열린 탭은 여전히 네이버에 로그인된 상태다.\n\"지웠으니 로그아웃됐겠지\" 는 틀렸다.\n\n## 다붓 계정 (예약 발행이 쓰는 크리덴셜)\n\n베이스 주소: `https://blog-analyzer.fly.dev` · 인증: 다붓 로그인 토큰(Bearer). 없으면 `dabut_login`.\n\n| 하는 일 | 요청 |\n| --- | --- |\n| 목록 | `GET /naver-accounts` (`include_inactive=true` 로 꺼진 것까지) |\n| 하나 읽기 | `GET /naver-accounts/{account_id}` |\n| 추가 | `POST /naver-accounts` — name, login_id, password 가 필수 |\n| 수정 | `PUT /naver-accounts/{account_id}` — 전부 optional. 보낸 필드만 바뀐다 |\n| 삭제 | `DELETE /naver-accounts/{account_id}` |\n| 여러 건 한 번에 | `POST /naver-accounts/import` |\n\n`PUT` 의 `password` 필드가 비밀번호 변경 경로다. 응답의 `has_password` 로 저장 여부만\n알 수 있고 평문은 어디서도 나오지 않는다.\n\n읽기는 `api_get('dabut', '/naver-accounts')` 로 바로 된다. 쓰기는 도구가 한다 —\n비밀번호가 도구 인자에 실리면 그 인자는 대화 기록과 모델 요청 본문에 그대로 남는다.\n\n## 예약 발행 계정 (스케줄러가 보는 쪽)\n\n베이스 주소: `https://21lab-scheduler.fly.dev` · 인증: 같은 다붓 토큰.\n\n`GET /api/blog-accounts` 가 돌려주는 것은 다붓 계정을 스케줄러가 자기 모양으로 다시 준\n것이다. `list_scheduler_accounts` 가 이걸 부른다. **여기 나오는 `id` 는 다붓의 Mongo\nObjectId 이고, 예약 문서의 `accountId` 는 네이버 로그인 id 다.** 둘은 다른 값이다.\nauto_schedule_posts 는 앞의 것을 `dabutAccountId` 로 보내야 한다.\n\n`GET /api/blog-accounts/{id}/credential-check` 는 네이버 로그인을 시도하지 않는다.\n저장된 비밀번호가 복호화되는지만 본다. 부작용이 없어서 `api_get` 으로 열어 뒀다.\n\"예약이 로그인 실패로 죽는데 비번이 문제냐\" 는 질문에 이걸로 답한다.\n\n## 비밀번호가 흐르는 길\n\n평문 비밀번호는 **패널 카드 → 메인 프로세스 → (로컬 저장소 | 다붓)** 로만 흐른다.\n모델은 어느 지점에서도 값을 보지 못한다. 폼(`ask_user_form`)의 칸 종류에서 password 를\n뺀 것도 같은 이유다 — 폼 답은 모델에게 그대로 돌아간다.\n\n그래서 `manage_naver_account` 에는 password 파라미터가 없다. 사용자에게 설정 화면을\n열라고 말하는 대신 이 도구를 부르면 카드가 뜬다."
  },
  "exposure": {
    "title": "노출지기",
    "triggers": [
      "노출체크",
      "카페체크",
      "카페 노출체크",
      "프리셋",
      "시트",
      "실행 결과",
      "노출지기",
      "순위 확인",
      "실행 묶음"
    ],
    "routes": [
      "exposure POST /api/auth/login",
      "exposure GET /api/preset",
      "exposure PUT /api/preset",
      "exposure GET /api/jobs",
      "exposure POST /api/jobs/{jobId}/run",
      "exposure GET /api/runs",
      "exposure POST /api/runs/{runId}/stop",
      "exposure GET /api/outputs",
      "exposure GET /api/pm2",
      "exposure GET /api/accounts"
    ],
    "tools": [
      "exposure_login",
      "update_exposure_preset",
      "list_exposure_jobs",
      "run_exposure_check",
      "api_get",
      "open_service"
    ],
    "sections": {
      "인증이 다르다": "다붓·스케줄러는 Bearer 토큰인데 여기는 httpOnly 쿠키 세션이다.\n`POST /api/auth/login` 에 `{ loginId, password }` 를 보내면 `dashboard_session` 쿠키가\nSet-Cookie 로 온다. 유효기간 7일. 비밀번호는 저장하지 않고 쿠키만 암호화해서 둔다.\n\n쿠키가 없거나 만료됐으면 `exposure_login` 을 부른다. 사용자에게 \"가서 로그인하세요\" 라고\n말하지 않는다. 어떤 도구든 401 을 만나면 저장된 쿠키를 지우고 다시 로그인을 요청한다.\n\n`/api/health` 와 `/api/auth/login` 만 로그인 없이 열려 있다. 나머지는 전부 프록시가 막는다.",
      "프리셋 — 이 계정이 무엇을 돌릴 수 있는지를 정하는 곳": "`GET /api/preset` → `{ member, preset }`\n`PUT /api/preset` ← `{ preset }` → 저장된 값을 그대로 돌려준다\n\n**PUT 은 전체 교체다.** 부분 갱신 엔드포인트가 없다. 그래서 프리셋을 고칠 때는 반드시\nGET 으로 지금 값을 읽고, 바꿀 항목만 갈아끼운 뒤 통째로 PUT 한다. 병합을 손으로 하면\n안 건드린 항목이 조용히 사라지고 그 실패에는 에러가 없다. `update_exposure_preset` 이\n그 병합을 코드로 한다. 모델이 프리셋 JSON 을 다시 쓰지 않는다.\n\n프리셋 안에 든 것:\n\n| 키 | 뜻 |\n| --- | --- |\n| `targets` | 코드에 박힌 노출체크 대상 7개의 켜짐/꺼짐과 시트 위치 |\n| `blogGroups` | 이름 붙인 블로그 계정 묶음. 대상들이 골라 쓴다 |\n| `runBundles` | 자주 쓰는 대상 조합에 이름을 붙인 실행 버튼 |\n| `cafeChecks` | **직접 만드는 카페 노출체크.** 코드 수정 없이 만들 수 있는 유일한 항목 |\n| `doorayWebhookUrl` | 결과 알림을 보낼 곳. https 만 받는다 |\n\n400 응답의 `error` 는 대시보드가 사용자에게 그대로 보여주려고 한국어로 쓴 문구다.\n고쳐 쓰지 말고 그대로 전달한다.",
      "update_exposure_preset 이 받는 동작": "add_cafe_check, remove_cafe_check, enable_target, disable_target, add_blog_group, set_dooray_webhook\n\n`set_target_sheet` 는 여기 없다. 대상의 시트 주소는 저장은 되지만 봇이 안 읽는다.\n이유는 limits 를 읽는다.",
      "카페 노출체크 만들기 (코드 수정 없이 되는 것)": "`update_exposure_preset` 의 `add_cafe_check`. 필요한 값은 넷이다.\n\n- `label` — 사람이 부를 이름\n- `sheetUrl` — 키워드를 읽고 결과도 쓸 구글시트 주소. `/spreadsheets/d/<id>` 가 있어야 한다\n- `tabTitle` — 그 시트 안의 탭 이름\n- `targets` — 찾을 카페·블로그 주소. `cafe.naver.com` 이면 카페, `blog.naver.com` 이면 블로그로 갈린다\n\nid 는 도구가 label 에서 만든다. 모델이 짓지 않는다. 만들고 나면 실행 목록에\n`cafe-check:<id>` 로 나타나고 `run_exposure_check` 로 바로 돌릴 수 있다.\n\n한 계정에 12개까지, 한 체크에 주소 50개까지. 주소에 쉼표를 넣을 수 없다 — 봇에\n환경변수로 쉼표를 이어 붙여 넘기기 때문에 값 안의 쉼표는 두 개로 쪼개진다.",
      "대상 켜고 끄기": "`enable_target` / `disable_target` 에 `targetId` 를 준다. id 는 `GET /api/preset` 의\n`targets[].id` 에서 온다. 없는 id 는 도구가 거부한다.\n\n`api_get` 으로 프리셋을 읽으면 `doorayWebhookUrl` 은 값이 아니라 가려진 표시로 온다.\n그 주소 자체가 인증 토큰이라 대화에 싣지 않는다. 웹훅이 걸려 있는지 없는지는 알 수 있고,\n바꾸는 것은 `set_dooray_webhook` 이 한다.\n\n**대상의 시트 주소는 바꿀 수 없다.** 저장도 되고 검증도 통과하지만 봇이 그 값을 읽지\n않는다. 자세한 건 limits 를 읽는다.",
      "실행": "`GET /api/jobs` → `{ jobs, bundles }`. 이 회원의 프리셋 기준으로 서버가 걸러 준 목록이라\n`cafe-check:*` 까지 들어 있다. `isBlocked` 가 true 면 다른 노출체크가 이미 돌고 있다는\n뜻이고 `blockReason` 에 이유가 적혀 있다.\n\n`POST /api/jobs/{jobId}/run` → `{ runId }`. 실행은 서버에서 돌기 때문에 이 앱을 닫아도\n계속 간다. 목록에서 숨기는 것만으로는 부족해서 서버가 `canMemberRunJob` 으로 한 번 더\n막는다. 못 돌리는 항목은 403 이다.\n\n수 분에서 수십 분 걸린다. `run_exposure_check` 는 실행 전에 스스로 확인 카드를 띄운다.\n사용자가 실행을 분명히 말했을 때만 부른다. \"카페 노출체크 하고 싶어\" 는 실행 요청이 아니다.",
      "결과 보기": "- `GET /api/runs` — 지금까지의 실행 목록\n- `POST /api/runs/{runId}/stop` — 도는 실행을 멈춘다\n- `GET /api/runs/{runId}/stream` — SSE. 응답이 끝나지 않아서 `api_get` 에서 뺐다\n- `GET /api/outputs` — 만들어진 결과 파일 목록\n- `GET /api/outputs/download` — 파일 내용. 대화에 부을 이유가 없어 `api_get` 에서 뺐다.\n  사용자가 파일을 원하면 `open_service` 로 화면을 연다\n- `GET /api/pm2` — 스케줄러 데몬 상태\n- `GET /api/accounts` — 관리 목록에 등록된 블로그 계정"
    },
    "body": "베이스 주소: `https://blog-cron-bot-production.up.railway.app`\n\n## 인증이 다르다\n\n다붓·스케줄러는 Bearer 토큰인데 여기는 httpOnly 쿠키 세션이다.\n`POST /api/auth/login` 에 `{ loginId, password }` 를 보내면 `dashboard_session` 쿠키가\nSet-Cookie 로 온다. 유효기간 7일. 비밀번호는 저장하지 않고 쿠키만 암호화해서 둔다.\n\n쿠키가 없거나 만료됐으면 `exposure_login` 을 부른다. 사용자에게 \"가서 로그인하세요\" 라고\n말하지 않는다. 어떤 도구든 401 을 만나면 저장된 쿠키를 지우고 다시 로그인을 요청한다.\n\n`/api/health` 와 `/api/auth/login` 만 로그인 없이 열려 있다. 나머지는 전부 프록시가 막는다.\n\n## 프리셋 — 이 계정이 무엇을 돌릴 수 있는지를 정하는 곳\n\n`GET /api/preset` → `{ member, preset }`\n`PUT /api/preset` ← `{ preset }` → 저장된 값을 그대로 돌려준다\n\n**PUT 은 전체 교체다.** 부분 갱신 엔드포인트가 없다. 그래서 프리셋을 고칠 때는 반드시\nGET 으로 지금 값을 읽고, 바꿀 항목만 갈아끼운 뒤 통째로 PUT 한다. 병합을 손으로 하면\n안 건드린 항목이 조용히 사라지고 그 실패에는 에러가 없다. `update_exposure_preset` 이\n그 병합을 코드로 한다. 모델이 프리셋 JSON 을 다시 쓰지 않는다.\n\n프리셋 안에 든 것:\n\n| 키 | 뜻 |\n| --- | --- |\n| `targets` | 코드에 박힌 노출체크 대상 7개의 켜짐/꺼짐과 시트 위치 |\n| `blogGroups` | 이름 붙인 블로그 계정 묶음. 대상들이 골라 쓴다 |\n| `runBundles` | 자주 쓰는 대상 조합에 이름을 붙인 실행 버튼 |\n| `cafeChecks` | **직접 만드는 카페 노출체크.** 코드 수정 없이 만들 수 있는 유일한 항목 |\n| `doorayWebhookUrl` | 결과 알림을 보낼 곳. https 만 받는다 |\n\n400 응답의 `error` 는 대시보드가 사용자에게 그대로 보여주려고 한국어로 쓴 문구다.\n고쳐 쓰지 말고 그대로 전달한다.\n\n## update_exposure_preset 이 받는 동작\n\nadd_cafe_check, remove_cafe_check, enable_target, disable_target, add_blog_group, set_dooray_webhook\n\n`set_target_sheet` 는 여기 없다. 대상의 시트 주소는 저장은 되지만 봇이 안 읽는다.\n이유는 limits 를 읽는다.\n\n## 카페 노출체크 만들기 (코드 수정 없이 되는 것)\n\n`update_exposure_preset` 의 `add_cafe_check`. 필요한 값은 넷이다.\n\n- `label` — 사람이 부를 이름\n- `sheetUrl` — 키워드를 읽고 결과도 쓸 구글시트 주소. `/spreadsheets/d/<id>` 가 있어야 한다\n- `tabTitle` — 그 시트 안의 탭 이름\n- `targets` — 찾을 카페·블로그 주소. `cafe.naver.com` 이면 카페, `blog.naver.com` 이면 블로그로 갈린다\n\nid 는 도구가 label 에서 만든다. 모델이 짓지 않는다. 만들고 나면 실행 목록에\n`cafe-check:<id>` 로 나타나고 `run_exposure_check` 로 바로 돌릴 수 있다.\n\n한 계정에 12개까지, 한 체크에 주소 50개까지. 주소에 쉼표를 넣을 수 없다 — 봇에\n환경변수로 쉼표를 이어 붙여 넘기기 때문에 값 안의 쉼표는 두 개로 쪼개진다.\n\n## 대상 켜고 끄기\n\n`enable_target` / `disable_target` 에 `targetId` 를 준다. id 는 `GET /api/preset` 의\n`targets[].id` 에서 온다. 없는 id 는 도구가 거부한다.\n\n`api_get` 으로 프리셋을 읽으면 `doorayWebhookUrl` 은 값이 아니라 가려진 표시로 온다.\n그 주소 자체가 인증 토큰이라 대화에 싣지 않는다. 웹훅이 걸려 있는지 없는지는 알 수 있고,\n바꾸는 것은 `set_dooray_webhook` 이 한다.\n\n**대상의 시트 주소는 바꿀 수 없다.** 저장도 되고 검증도 통과하지만 봇이 그 값을 읽지\n않는다. 자세한 건 limits 를 읽는다.\n\n## 실행\n\n`GET /api/jobs` → `{ jobs, bundles }`. 이 회원의 프리셋 기준으로 서버가 걸러 준 목록이라\n`cafe-check:*` 까지 들어 있다. `isBlocked` 가 true 면 다른 노출체크가 이미 돌고 있다는\n뜻이고 `blockReason` 에 이유가 적혀 있다.\n\n`POST /api/jobs/{jobId}/run` → `{ runId }`. 실행은 서버에서 돌기 때문에 이 앱을 닫아도\n계속 간다. 목록에서 숨기는 것만으로는 부족해서 서버가 `canMemberRunJob` 으로 한 번 더\n막는다. 못 돌리는 항목은 403 이다.\n\n수 분에서 수십 분 걸린다. `run_exposure_check` 는 실행 전에 스스로 확인 카드를 띄운다.\n사용자가 실행을 분명히 말했을 때만 부른다. \"카페 노출체크 하고 싶어\" 는 실행 요청이 아니다.\n\n## 결과 보기\n\n- `GET /api/runs` — 지금까지의 실행 목록\n- `POST /api/runs/{runId}/stop` — 도는 실행을 멈춘다\n- `GET /api/runs/{runId}/stream` — SSE. 응답이 끝나지 않아서 `api_get` 에서 뺐다\n- `GET /api/outputs` — 만들어진 결과 파일 목록\n- `GET /api/outputs/download` — 파일 내용. 대화에 부을 이유가 없어 `api_get` 에서 뺐다.\n  사용자가 파일을 원하면 `open_service` 로 화면을 연다\n- `GET /api/pm2` — 스케줄러 데몬 상태\n- `GET /api/accounts` — 관리 목록에 등록된 블로그 계정"
  },
  "limits": {
    "title": "코드를 고쳐야만 되는 것들",
    "triggers": [
      "안 됨",
      "못 함",
      "왜 안 되지",
      "새 타겟",
      "타겟 추가",
      "시트 바꾸기",
      "예약 수정",
      "계정 옮기기",
      "권한"
    ],
    "routes": [],
    "tools": [
      "update_exposure_preset",
      "manage_naver_account",
      "cancel_schedule",
      "ask_user"
    ],
    "sections": {
      "노출체크 타겟을 8번째로 추가": "API 로 안 된다. `EXPOSURE_TARGET_IDS` 가 유니온 타입의 원천이라 여러 곳이 함께 움직인다.\n`Record<ExposureTargetId, ...>` 로 선언된 표들은 타입이 강제하니 빠뜨리면 컴파일이 죽지만,\n마지막 두 개는 타입이 안 잡아 줘서 조용히 어긋난다.\n\n노출지기 저장소 `blog-cron-bot` 에서:\n\n```\n 1 src/lib/exposure-suite/options.ts:1        EXPOSURE_TARGET_IDS  ← 여기가 원천\n 2 src/lib/exposure-suite/options.ts:37       TARGET_COMMANDS      (Record 라 타입이 강제한다)\n 3 src/cron-exposure-suite.ts:26              TARGET_LABELS        (Record)\n 4 src/cron-exposure-suite.ts:36              TARGET_PRIORITY      (Record)\n 5 package.json                               \"exposure:<새이름>\" 스크립트\n 6 src/constants/                             그 타겟이 읽을 시트 id 와 탭 이름\n 7 src/lib/tenant/preset.ts:115               LAB_21_PRESET.targets 에 시드 항목\n 8 dashboard/src/shared/config/exposure-contract/index.ts:1   EXPOSURE_TARGETS\n 9 dashboard/src/server/job-registry.ts:64    JOB_REGISTRY 에 실행 항목\n10 dashboard/src/server/member-jobs.ts:16     JOB_REQUIRED_TARGETS\n       ← 빠뜨리면 canMemberRunJob 이 false 라 아무에게도 안 보인다. 타입이 안 잡아 준다\n11 dashboard/src/server/exposure-suite-options.ts:32  ALLOWED_TARGET_IDS 는 8번에서 파생돼 자동이다\n12 각 저장소의 테스트                          목록 길이를 고정한 단언들\n```\n\n**사용자에게는 이렇게 말한다.**\n\n> 이건 코드에 박혀 있어서 노출지기 저장소 열 곳 넘게를 같이 고쳐야 해요.\n> 그런데 가장 흔한 오해가 하나 있어요 — 새 타겟이 필요 없는 경우가 많아요.\n> 다른 시트의 키워드로 카페나 블로그 노출을 보고 싶은 거면 **카페 노출체크**로\n> 코드 수정 없이 5초면 돼요. 어느 쪽인지 알려주세요.\n\n`cafe` 타겟은 **이미 있다.** \"카페 노출체크 추가\" 라는 말이 새 타겟을 뜻하는 경우는 거의 없다.\n거의 항상 \"다른 시트를 보는 카페 체크를 하나 더 만들어 줘\" 라는 뜻이고, 그건\n`update_exposure_preset` 의 `add_cafe_check` 로 바로 된다.",
      "노출체크 대상의 시트 주소 바꾸기": "**저장은 되는데 봇이 안 읽는다.** 이게 가장 위험한 종류의 \"된다\" 다.\n\n`PUT /api/preset` 은 `targets[].source` / `targets[].result` 를 받아서 검증하고\n데이터베이스에 저장까지 한다. 그런데 봇이 실제로 프리셋에서 읽는 것은\n`blogGroupIds` 와 `blogIds` 뿐이다 (`src/lib/blog-id-overrides/index.ts` 의\n`applyPresetBlogIds` 가 그 두 개만 쓴다). 시트 위치는 `src/constants/` 에 박혀 있다.\n\n그래서 시트를 바꾸면 화면에도 바뀐 값이 보이고 API 도 200 을 주는데, 다음 실행은\n예전 시트를 그대로 읽는다. 아무 에러도 안 난다.\n\n이 때문에 `update_exposure_preset` 의 action 목록에 `set_target_sheet` 를 **일부러 넣지\n않았다.** 도구가 있으면 \"시트 바꿨어요\" 라고 보고한 뒤 조용히 틀린 결과가 나온다.\n\n사용자에게는 이렇게 말한다.\n\n> 그 대상의 시트는 봇 코드에 박혀 있어서 화면에서 바꿔도 실행에는 반영되지 않아요.\n> 저장은 되는데 봇이 그 값을 안 읽어서 오히려 바꾼 줄 알고 넘어가는 게 더 위험해요.\n> 다른 시트를 보시려는 거면 카페 노출체크를 새로 만드는 쪽이 확실해요. 그건 바로 돼요.",
      "예약 내용 수정": "스케줄러에 수정 엔드포인트가 없다. `POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다.\n날짜·시각·키워드·프로젝트 중 무엇을 바꾸려 해도 **취소 후 재등록**이고, 되살리는 기능이\n없어서 취소하면 그것으로 끝이다.\n\n게다가 재사용 지문에 `project_id` 가 빠져 있어서, 취소하지 않고 프로젝트만 바꿔 다시 걸면\n`reused: true` 로 옛 예약이 그대로 돌아온다. \"다시 걸면 되겠지\" 가 안 통한다.\n\n사용자에게 취소가 되돌릴 수 없다는 사실부터 말하고 확인받은 뒤에 진행한다.",
      "네이버 계정의 실제 비밀번호 변경": "우리가 못 한다. 네이버 사이트에서 사용자가 직접 바꿔야 한다.\n`manage_naver_account` 의 `change_password` 는 **바꾼 비밀번호를 우리 쪽에 반영**하는 것이지\n네이버 비밀번호를 바꾸는 것이 아니다.\n\n\"비번 바꿔줘\" 를 들으면 어느 쪽인지 먼저 가른다. 네이버에서 이미 바꾸고 온 것이면\n`change_password` 가 이 앱과 다붓 두 곳을 함께 갱신한다.",
      "노출지기 계정·블로그 목록의 소유자 구분": "`/api/accounts`, `/api/runs`, `/api/outputs`, `/api/pm2` 에는 회원 단위 소유권 확인이 없다\n(세션을 확인하는 것은 `/api/jobs` 와 `/api/preset` 뿐이다). 프록시의 서명 검사는 통과해야\n하므로 로그인 자체는 필요하지만, 로그인한 아무나 같은 것을 본다.\n\n읽기라 당장 문제는 아니지만 `POST /api/accounts` 를 도구로 붙이려면 그쪽부터 고쳐야 한다.\n그래서 계정 목록 쓰기는 도구로 열지 않았다.",
      "이 앱의 설정값 변경": "OpenRouter 키, 모델, 연동 서버 주소, 노출지기 저장소 경로, 브라우저 프로필은 도구가 없다.\nElectron IPC 로만 바뀌고 패널 `설정` 에서 사용자가 직접 넣는다.\n한 번 넣으면 다시 안 바꾸는 값이라 도구를 만들지 않은 것이다. 자세한 건 settings 를 읽는다.",
      "도구를 새로 만들 기준": "도구는 28개가 상한에 가깝다. 앞으로 요청이 오면 기본은 `api_get` + 이 문서로 처리하고,\n새 도구는 **쓰기이면서 서버에 없는 안전장치가 필요한 것**만 받는다.\n읽기는 도구를 늘리지 않는다."
    },
    "body": "\"할 수 없어요\" 라고 말하기 전에 반드시 이 페이지를 읽는다.\n\n여기 적힌 것은 전부 **API 로는 못 하지만 왜 못 하는지와 어디를 고쳐야 하는지가 분명한**\n일들이다. \"제 권한 밖이에요\" 로 끝내지 않는다. 왜, 어디를, 그리고 사용자가 진짜 원하는\n것이 사실 다른 것은 아닌지까지 말한다. 대부분의 경우 진짜 원하는 것은 코드 수정이 아니다.\n\n## 노출체크 타겟을 8번째로 추가\n\nAPI 로 안 된다. `EXPOSURE_TARGET_IDS` 가 유니온 타입의 원천이라 여러 곳이 함께 움직인다.\n`Record<ExposureTargetId, ...>` 로 선언된 표들은 타입이 강제하니 빠뜨리면 컴파일이 죽지만,\n마지막 두 개는 타입이 안 잡아 줘서 조용히 어긋난다.\n\n노출지기 저장소 `blog-cron-bot` 에서:\n\n```\n 1 src/lib/exposure-suite/options.ts:1        EXPOSURE_TARGET_IDS  ← 여기가 원천\n 2 src/lib/exposure-suite/options.ts:37       TARGET_COMMANDS      (Record 라 타입이 강제한다)\n 3 src/cron-exposure-suite.ts:26              TARGET_LABELS        (Record)\n 4 src/cron-exposure-suite.ts:36              TARGET_PRIORITY      (Record)\n 5 package.json                               \"exposure:<새이름>\" 스크립트\n 6 src/constants/                             그 타겟이 읽을 시트 id 와 탭 이름\n 7 src/lib/tenant/preset.ts:115               LAB_21_PRESET.targets 에 시드 항목\n 8 dashboard/src/shared/config/exposure-contract/index.ts:1   EXPOSURE_TARGETS\n 9 dashboard/src/server/job-registry.ts:64    JOB_REGISTRY 에 실행 항목\n10 dashboard/src/server/member-jobs.ts:16     JOB_REQUIRED_TARGETS\n       ← 빠뜨리면 canMemberRunJob 이 false 라 아무에게도 안 보인다. 타입이 안 잡아 준다\n11 dashboard/src/server/exposure-suite-options.ts:32  ALLOWED_TARGET_IDS 는 8번에서 파생돼 자동이다\n12 각 저장소의 테스트                          목록 길이를 고정한 단언들\n```\n\n**사용자에게는 이렇게 말한다.**\n\n> 이건 코드에 박혀 있어서 노출지기 저장소 열 곳 넘게를 같이 고쳐야 해요.\n> 그런데 가장 흔한 오해가 하나 있어요 — 새 타겟이 필요 없는 경우가 많아요.\n> 다른 시트의 키워드로 카페나 블로그 노출을 보고 싶은 거면 **카페 노출체크**로\n> 코드 수정 없이 5초면 돼요. 어느 쪽인지 알려주세요.\n\n`cafe` 타겟은 **이미 있다.** \"카페 노출체크 추가\" 라는 말이 새 타겟을 뜻하는 경우는 거의 없다.\n거의 항상 \"다른 시트를 보는 카페 체크를 하나 더 만들어 줘\" 라는 뜻이고, 그건\n`update_exposure_preset` 의 `add_cafe_check` 로 바로 된다.\n\n## 노출체크 대상의 시트 주소 바꾸기\n\n**저장은 되는데 봇이 안 읽는다.** 이게 가장 위험한 종류의 \"된다\" 다.\n\n`PUT /api/preset` 은 `targets[].source` / `targets[].result` 를 받아서 검증하고\n데이터베이스에 저장까지 한다. 그런데 봇이 실제로 프리셋에서 읽는 것은\n`blogGroupIds` 와 `blogIds` 뿐이다 (`src/lib/blog-id-overrides/index.ts` 의\n`applyPresetBlogIds` 가 그 두 개만 쓴다). 시트 위치는 `src/constants/` 에 박혀 있다.\n\n그래서 시트를 바꾸면 화면에도 바뀐 값이 보이고 API 도 200 을 주는데, 다음 실행은\n예전 시트를 그대로 읽는다. 아무 에러도 안 난다.\n\n이 때문에 `update_exposure_preset` 의 action 목록에 `set_target_sheet` 를 **일부러 넣지\n않았다.** 도구가 있으면 \"시트 바꿨어요\" 라고 보고한 뒤 조용히 틀린 결과가 나온다.\n\n사용자에게는 이렇게 말한다.\n\n> 그 대상의 시트는 봇 코드에 박혀 있어서 화면에서 바꿔도 실행에는 반영되지 않아요.\n> 저장은 되는데 봇이 그 값을 안 읽어서 오히려 바꾼 줄 알고 넘어가는 게 더 위험해요.\n> 다른 시트를 보시려는 거면 카페 노출체크를 새로 만드는 쪽이 확실해요. 그건 바로 돼요.\n\n## 예약 내용 수정\n\n스케줄러에 수정 엔드포인트가 없다. `POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다.\n날짜·시각·키워드·프로젝트 중 무엇을 바꾸려 해도 **취소 후 재등록**이고, 되살리는 기능이\n없어서 취소하면 그것으로 끝이다.\n\n게다가 재사용 지문에 `project_id` 가 빠져 있어서, 취소하지 않고 프로젝트만 바꿔 다시 걸면\n`reused: true` 로 옛 예약이 그대로 돌아온다. \"다시 걸면 되겠지\" 가 안 통한다.\n\n사용자에게 취소가 되돌릴 수 없다는 사실부터 말하고 확인받은 뒤에 진행한다.\n\n## 네이버 계정의 실제 비밀번호 변경\n\n우리가 못 한다. 네이버 사이트에서 사용자가 직접 바꿔야 한다.\n`manage_naver_account` 의 `change_password` 는 **바꾼 비밀번호를 우리 쪽에 반영**하는 것이지\n네이버 비밀번호를 바꾸는 것이 아니다.\n\n\"비번 바꿔줘\" 를 들으면 어느 쪽인지 먼저 가른다. 네이버에서 이미 바꾸고 온 것이면\n`change_password` 가 이 앱과 다붓 두 곳을 함께 갱신한다.\n\n## 노출지기 계정·블로그 목록의 소유자 구분\n\n`/api/accounts`, `/api/runs`, `/api/outputs`, `/api/pm2` 에는 회원 단위 소유권 확인이 없다\n(세션을 확인하는 것은 `/api/jobs` 와 `/api/preset` 뿐이다). 프록시의 서명 검사는 통과해야\n하므로 로그인 자체는 필요하지만, 로그인한 아무나 같은 것을 본다.\n\n읽기라 당장 문제는 아니지만 `POST /api/accounts` 를 도구로 붙이려면 그쪽부터 고쳐야 한다.\n그래서 계정 목록 쓰기는 도구로 열지 않았다.\n\n## 이 앱의 설정값 변경\n\nOpenRouter 키, 모델, 연동 서버 주소, 노출지기 저장소 경로, 브라우저 프로필은 도구가 없다.\nElectron IPC 로만 바뀌고 패널 `설정` 에서 사용자가 직접 넣는다.\n한 번 넣으면 다시 안 바꾸는 값이라 도구를 만들지 않은 것이다. 자세한 건 settings 를 읽는다.\n\n## 도구를 새로 만들 기준\n\n도구는 28개가 상한에 가깝다. 앞으로 요청이 오면 기본은 `api_get` + 이 문서로 처리하고,\n새 도구는 **쓰기이면서 서버에 없는 안전장치가 필요한 것**만 받는다.\n읽기는 도구를 늘리지 않는다."
  },
  "manuscripts": {
    "title": "다붓 원고와 프로젝트",
    "triggers": [
      "원고",
      "원고 생성",
      "프로젝트",
      "지침",
      "프리셋",
      "원고 이력",
      "원고 검색",
      "이미지 생성",
      "다붓"
    ],
    "routes": [
      "dabut POST /auth/app/login",
      "dabut GET /auth/app/me",
      "dabut GET /projects",
      "dabut POST /projects",
      "dabut GET /projects/{project_id}",
      "dabut PUT /projects/{project_id}",
      "dabut DELETE /projects/{project_id}",
      "dabut GET /projects/models",
      "dabut GET /projects/presets",
      "dabut GET /projects/steps",
      "dabut GET /projects/categories",
      "dabut POST /generate/project",
      "dabut GET /search/manuscripts/visible",
      "dabut GET /search/manuscript/{manuscript_id}",
      "dabut GET /search/history",
      "dabut GET /search/popular",
      "dabut GET /search/stats",
      "dabut GET /generate/image-models",
      "dabut GET /auth/app/api-keys"
    ],
    "tools": [
      "dabut_login",
      "list_dabut_projects",
      "generate_manuscript_dabut",
      "generate_manuscript",
      "api_get"
    ],
    "sections": {
      "프로젝트가 곧 원고 뽑는 방식": "프로젝트 하나에 모델·지침·전후 단계가 묶여 있다. `manuscriptType` 같은 고정 스타일보다\n프로젝트가 이긴다 — `projectId` 를 넘기면 원고 생성 단계에서 manuscriptType 은 무시된다.\n\n- `GET /projects` — 목록. `list_dabut_projects` 가 이걸 부르고 결과의 id 만 이후에 통과시킨다\n- `GET /projects/{project_id}` — 하나의 상세. 어떤 지침이 들어 있는지 확인할 때\n- `GET /projects/models` — 고를 수 있는 모델\n- `GET /projects/presets` — 프로젝트 만들 때 쓰는 프리셋\n- `GET /projects/steps` — 전후 단계 목록\n- 쓰기(`POST /projects`, `PUT`, `DELETE`, `POST /projects/{id}/duplicate`)는 도구가 없다.\n  프로젝트를 만들거나 고치는 일은 다붓 앱 화면에서 한다. `open_service` 로 열어 준다",
      "원고 생성": "`POST /generate/project` — `generate_manuscript_dabut` 이 부르는 곳. 최대 10분 걸린다.\n프로젝트의 모델·지침·전후 단계를 그대로 태운다. 실제 발행용 원고는 이걸 쓴다.\n\n`/generate/*` 아래 다른 경로가 50개 넘게 있다(모델별·업종별 직행 엔드포인트).\n전부 POST 라 `api_get` 으로 못 부르고 도구도 없다. 다붓 로그인이 안 되면\n`generate_manuscript` 로 대체한다 — 그건 OpenRouter 로 직접 쓰는 폴백이다.",
      "원고 이력": "- `GET /search/manuscripts/visible` — 보이도록 해둔 원고 목록\n- `GET /search/manuscript/{manuscript_id}` — 원고 하나\n- `GET /search/history` — 검색 이력\n- `GET /search/popular`, `GET /search/stats` — 인기 키워드와 통계\n- `POST /search/keyword`, `POST /search/all` — 검색은 POST 라 `api_get` 으로 못 부른다\n- 삭제(`DELETE /search/manuscript/{id}`)는 되돌릴 수 없어서 도구를 만들지 않았다.\n  다붓 화면에서 한다",
      "이미지": "- `GET /generate/image-models` — 쓸 수 있는 이미지 모델\n- `POST /generate/image`, `POST /generate/image-batch` — 생성. 도구 없음\n- `GET /generate/image-batch/{job_id}` — 배치 상태\n- `GET /generate/image-batch/{job_id}/download` — 파일 바이트라 `api_get` 에서 뺐다\n\n원고에 이미지를 같이 만들려면 `generate_manuscript_dabut` 의 `withImages` 를 쓴다.",
      "계정과 키": "- `GET /auth/app/me` — 지금 로그인한 다붓 계정\n- `GET /auth/app/api-keys` — 등록된 외부 API 키 목록. 키 값 자체는 나오지 않는다\n- `POST /auth/app/change-password` — 다붓 로그인 비밀번호 변경. 도구 없음.\n  네이버 계정 비밀번호와 다른 것이다. 헷갈리면 accounts 를 읽는다"
    },
    "body": "베이스 주소: `https://blog-analyzer.fly.dev` · 인증: 다붓 로그인 토큰(Bearer)\n\nFastAPI 라 `https://blog-analyzer.fly.dev/openapi.json` 이 인증 없이 열려 있다. 경로가 132개다.\n`npm run api:sync` 가 그걸 읽어 스냅샷을 갱신한다.\n\n## 프로젝트가 곧 원고 뽑는 방식\n\n프로젝트 하나에 모델·지침·전후 단계가 묶여 있다. `manuscriptType` 같은 고정 스타일보다\n프로젝트가 이긴다 — `projectId` 를 넘기면 원고 생성 단계에서 manuscriptType 은 무시된다.\n\n- `GET /projects` — 목록. `list_dabut_projects` 가 이걸 부르고 결과의 id 만 이후에 통과시킨다\n- `GET /projects/{project_id}` — 하나의 상세. 어떤 지침이 들어 있는지 확인할 때\n- `GET /projects/models` — 고를 수 있는 모델\n- `GET /projects/presets` — 프로젝트 만들 때 쓰는 프리셋\n- `GET /projects/steps` — 전후 단계 목록\n- 쓰기(`POST /projects`, `PUT`, `DELETE`, `POST /projects/{id}/duplicate`)는 도구가 없다.\n  프로젝트를 만들거나 고치는 일은 다붓 앱 화면에서 한다. `open_service` 로 열어 준다\n\n## 원고 생성\n\n`POST /generate/project` — `generate_manuscript_dabut` 이 부르는 곳. 최대 10분 걸린다.\n프로젝트의 모델·지침·전후 단계를 그대로 태운다. 실제 발행용 원고는 이걸 쓴다.\n\n`/generate/*` 아래 다른 경로가 50개 넘게 있다(모델별·업종별 직행 엔드포인트).\n전부 POST 라 `api_get` 으로 못 부르고 도구도 없다. 다붓 로그인이 안 되면\n`generate_manuscript` 로 대체한다 — 그건 OpenRouter 로 직접 쓰는 폴백이다.\n\n## 원고 이력\n\n- `GET /search/manuscripts/visible` — 보이도록 해둔 원고 목록\n- `GET /search/manuscript/{manuscript_id}` — 원고 하나\n- `GET /search/history` — 검색 이력\n- `GET /search/popular`, `GET /search/stats` — 인기 키워드와 통계\n- `POST /search/keyword`, `POST /search/all` — 검색은 POST 라 `api_get` 으로 못 부른다\n- 삭제(`DELETE /search/manuscript/{id}`)는 되돌릴 수 없어서 도구를 만들지 않았다.\n  다붓 화면에서 한다\n\n## 이미지\n\n- `GET /generate/image-models` — 쓸 수 있는 이미지 모델\n- `POST /generate/image`, `POST /generate/image-batch` — 생성. 도구 없음\n- `GET /generate/image-batch/{job_id}` — 배치 상태\n- `GET /generate/image-batch/{job_id}/download` — 파일 바이트라 `api_get` 에서 뺐다\n\n원고에 이미지를 같이 만들려면 `generate_manuscript_dabut` 의 `withImages` 를 쓴다.\n\n## 계정과 키\n\n- `GET /auth/app/me` — 지금 로그인한 다붓 계정\n- `GET /auth/app/api-keys` — 등록된 외부 API 키 목록. 키 값 자체는 나오지 않는다\n- `POST /auth/app/change-password` — 다붓 로그인 비밀번호 변경. 도구 없음.\n  네이버 계정 비밀번호와 다른 것이다. 헷갈리면 accounts 를 읽는다"
  },
  "schedules": {
    "title": "예약 발행과 큐",
    "triggers": [
      "예약",
      "예약 발행",
      "예약 취소",
      "예약 수정",
      "큐",
      "재실행",
      "발행 실패",
      "스케줄러",
      "파이프라인"
    ],
    "routes": [
      "scheduler GET /health",
      "scheduler POST /api/auth/login",
      "scheduler GET /api/auth/me",
      "scheduler POST /bot/auto-schedule",
      "scheduler GET /schedules",
      "scheduler GET /schedules/{id}",
      "scheduler DELETE /schedules/{id}",
      "scheduler POST /schedules/{id}/execute",
      "scheduler GET /api/queues/dashboard",
      "scheduler GET /api/queues/{accountId}/jobs",
      "scheduler POST /api/queues/{accountId}/retry",
      "scheduler GET /queues/stats",
      "scheduler GET /api/content-pipelines",
      "scheduler GET /api/content-pipelines/blocks"
    ],
    "tools": [
      "auto_schedule_posts",
      "list_schedules",
      "get_schedule",
      "cancel_schedule",
      "list_scheduler_accounts",
      "dabut_login",
      "api_get"
    ],
    "sections": {
      "예약에 수정 API 가 없다": "`POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다. PUT 도 PATCH 도 없다.\n\"예약 날짜만 바꿔줘\" 는 **취소 후 재등록**이고, 되살리는 기능이 없어서 취소하면 끝이다.\n사용자에게 그 사실부터 말한 뒤에 진행한다.",
      "등록": "`POST /bot/auto-schedule`. 최상위가 전부 snake_case 이고 zod 가 non-strict 라\n이름이 어긋난 키는 400 없이 조용히 버려진다. 그 변환은 `buildAutoScheduleBody` 한 곳에\n모아 두고 테스트로 이름을 고정했다.\n\n주의할 것 셋.\n\n1. **실패해도 HTTP 200 이다.** 계정 크리덴셜 복호화 실패나 `item_options` 길이 불일치는\n   `{ success: false, message }` 로 돌아온다. status 가 아니라 본문을 봐야 한다.\n2. **`account.id` 는 네이버 로그인 id 다.** `list_scheduler_accounts` 가 주는 값은\n   다붓의 Mongo ObjectId 라서 `id` 로 보내면 \"Account credentials not provided\" 로 죽는다.\n   `dabutAccountId` 로 보내야 크리덴셜 복호화 경로를 탄다.\n3. **재사용 지문에 `project_id` 가 빠져 있다.** 프로젝트만 바꿔 같은 조건으로 다시 걸면\n   `reused: true` 로 예전 것이 그대로 돌아오고 변경이 반영되지 않는다. 그때가 저장값이\n   보낸 값과 다를 가능성이 가장 높은 경우라 반드시 `get_schedule` 로 되읽는다.\n   이건 스케줄러 쪽 문제라 이 앱에서 고칠 수 없다.\n\n원고 스타일: default, update-restaurant, restaurant, restaurant/v1, restaurant/v2, pet, grok, keigo, hanryeodamwon, nyangnyang, kimdongpal, alibaba\n이미지 출처: ai, google, keyword, product, local",
      "읽기": "`GET /schedules` — 최근 50건 고정. 페이지네이션이 없다. 필터는 `accountId` 와 `status`\n둘뿐이고 다른 키는 조용히 버려진다. 묶음 단위 정보만 나오고 키워드와 발행 시각은 없다.\n\n`GET /schedules/{id}` — 여기에만 `jobs` 가 있고 키워드·발행 시각·저장된 프로젝트가 나온다.\n예약을 걸고 나면 반드시 이걸로 저장값을 확인한 뒤 보고한다.\n\n묶음 상태: pending, processing, completed, failed, cancelled\n건별 상태: pending, generating, generated, publishing, published, failed, cancelled\n둘은 다른 값이다. 섞으면 필터가 조용히 빈 결과를 준다.",
      "소유자 스코프는 서버 설정에 달려 있다": "`GET /schedules`, `GET /schedules/{id}`, `DELETE /schedules/{id}` 는 셋 다\n`resolveScheduleAccountScope` 를 지난다. 이 함수는 다붓 인증이 켜져 있으면 요청자의\n블로그 계정 목록으로 스코프를 걸고(`accountId: { $in: ... }`), 남의 예약에는 404 를 준다.\n403 이 아니라 404 인 이유는 id 의 존재까지 감추기 위해서다.\n\n문제는 그 조건이다. `JWT_SECRET` 이나 `DABUT_APP_MONGO_URI` 가 없어 다붓 인증이 꺼진\n배포에서는 스코프 함수가 `null` 을 돌려주고, 인증 훅도 통째로 꺼진다. 그때는\n**토큰 없이 아무나 전부 읽고 지운다.** 즉 서버 쪽 보호는 켜져 있을 때만 있다.\n\n그래서 이 앱은 자기 쪽에서도 소유를 따로 판정한다. 근거는 `GET /api/blog-accounts` 이고,\n여기서 나온 `loginId` 집합이 \"내 예약\" 의 기준이다. `list_schedules` / `get_schedule` /\n`cancel_schedule` 이 전부 이 판정을 통과한다. 서버 스코프가 켜져 있으면 같은 결과를 두 번\n거르는 것이고, 꺼져 있으면 이 판정이 유일한 방어다.\n\n이래서 `api_get` 으로 `/schedules` 를 직접 읽는 것과 `list_schedules` 도구를 쓰는 것이\n같지 않다. 도구를 쓴다. `api_get` 은 도구가 없는 읽기에만 쓴다.",
      "취소": "`DELETE /schedules/{id}` 는 삭제가 아니라 소프트 취소다. 큐에서 잡을 빼고 status 를\ncancelled 로 바꾼다. 문서는 남아 계속 읽히지만 되살리는 엔드포인트는 없다.\n\n이미 발행된 건까지 status 를 cancelled 로 덮는다. **올라간 글은 네이버에서 내려가지\n않는다.** 전체 건수를 \"안 올라간다\" 로 말하면 거짓이 된다.",
      "큐와 재실행": "- `GET /api/queues/dashboard` — 계정별 큐 현황\n- `GET /api/queues/{accountId}/jobs` — 그 계정의 큐 잡\n- `POST /api/queues/{accountId}/retry` — 실패한 잡 재시도\n- `GET /queues/stats` — 전체 통계\n- `POST /schedules/{id}/execute` — pending·generating 인 건만 다시 큐에 넣는다.\n  cancelled 는 다시 안 들어간다",
      "파이프라인": "- `GET /api/content-pipelines/blocks` — 쓸 수 있는 블록 목록\n- `GET /api/content-pipelines` — 저장된 파이프라인\n- `POST /api/content-pipelines`, `DELETE /api/content-pipelines/{key}` — 쓰기라 도구가 없다"
    },
    "body": "베이스 주소: `https://21lab-scheduler.fly.dev` · 인증: 다붓 로그인 토큰(Bearer)\n\n이 저장소의 `scheduler-server/api.md` 는 참조하지 않는다. 지금도 `/bot/auto` 를 평문\n비밀번호 본문과 함께 설명하는데 도구가 실제로 쓰는 것은 `/bot/auto-schedule` 이다.\n틀린 문서는 없는 문서보다 나쁘다.\n\n## 예약에 수정 API 가 없다\n\n`POST` 로 걸고 `DELETE` 로 취소하는 것뿐이다. PUT 도 PATCH 도 없다.\n\"예약 날짜만 바꿔줘\" 는 **취소 후 재등록**이고, 되살리는 기능이 없어서 취소하면 끝이다.\n사용자에게 그 사실부터 말한 뒤에 진행한다.\n\n## 등록\n\n`POST /bot/auto-schedule`. 최상위가 전부 snake_case 이고 zod 가 non-strict 라\n이름이 어긋난 키는 400 없이 조용히 버려진다. 그 변환은 `buildAutoScheduleBody` 한 곳에\n모아 두고 테스트로 이름을 고정했다.\n\n주의할 것 셋.\n\n1. **실패해도 HTTP 200 이다.** 계정 크리덴셜 복호화 실패나 `item_options` 길이 불일치는\n   `{ success: false, message }` 로 돌아온다. status 가 아니라 본문을 봐야 한다.\n2. **`account.id` 는 네이버 로그인 id 다.** `list_scheduler_accounts` 가 주는 값은\n   다붓의 Mongo ObjectId 라서 `id` 로 보내면 \"Account credentials not provided\" 로 죽는다.\n   `dabutAccountId` 로 보내야 크리덴셜 복호화 경로를 탄다.\n3. **재사용 지문에 `project_id` 가 빠져 있다.** 프로젝트만 바꿔 같은 조건으로 다시 걸면\n   `reused: true` 로 예전 것이 그대로 돌아오고 변경이 반영되지 않는다. 그때가 저장값이\n   보낸 값과 다를 가능성이 가장 높은 경우라 반드시 `get_schedule` 로 되읽는다.\n   이건 스케줄러 쪽 문제라 이 앱에서 고칠 수 없다.\n\n원고 스타일: default, update-restaurant, restaurant, restaurant/v1, restaurant/v2, pet, grok, keigo, hanryeodamwon, nyangnyang, kimdongpal, alibaba\n이미지 출처: ai, google, keyword, product, local\n\n## 읽기\n\n`GET /schedules` — 최근 50건 고정. 페이지네이션이 없다. 필터는 `accountId` 와 `status`\n둘뿐이고 다른 키는 조용히 버려진다. 묶음 단위 정보만 나오고 키워드와 발행 시각은 없다.\n\n`GET /schedules/{id}` — 여기에만 `jobs` 가 있고 키워드·발행 시각·저장된 프로젝트가 나온다.\n예약을 걸고 나면 반드시 이걸로 저장값을 확인한 뒤 보고한다.\n\n묶음 상태: pending, processing, completed, failed, cancelled\n건별 상태: pending, generating, generated, publishing, published, failed, cancelled\n둘은 다른 값이다. 섞으면 필터가 조용히 빈 결과를 준다.\n\n## 소유자 스코프는 서버 설정에 달려 있다\n\n`GET /schedules`, `GET /schedules/{id}`, `DELETE /schedules/{id}` 는 셋 다\n`resolveScheduleAccountScope` 를 지난다. 이 함수는 다붓 인증이 켜져 있으면 요청자의\n블로그 계정 목록으로 스코프를 걸고(`accountId: { $in: ... }`), 남의 예약에는 404 를 준다.\n403 이 아니라 404 인 이유는 id 의 존재까지 감추기 위해서다.\n\n문제는 그 조건이다. `JWT_SECRET` 이나 `DABUT_APP_MONGO_URI` 가 없어 다붓 인증이 꺼진\n배포에서는 스코프 함수가 `null` 을 돌려주고, 인증 훅도 통째로 꺼진다. 그때는\n**토큰 없이 아무나 전부 읽고 지운다.** 즉 서버 쪽 보호는 켜져 있을 때만 있다.\n\n그래서 이 앱은 자기 쪽에서도 소유를 따로 판정한다. 근거는 `GET /api/blog-accounts` 이고,\n여기서 나온 `loginId` 집합이 \"내 예약\" 의 기준이다. `list_schedules` / `get_schedule` /\n`cancel_schedule` 이 전부 이 판정을 통과한다. 서버 스코프가 켜져 있으면 같은 결과를 두 번\n거르는 것이고, 꺼져 있으면 이 판정이 유일한 방어다.\n\n이래서 `api_get` 으로 `/schedules` 를 직접 읽는 것과 `list_schedules` 도구를 쓰는 것이\n같지 않다. 도구를 쓴다. `api_get` 은 도구가 없는 읽기에만 쓴다.\n\n## 취소\n\n`DELETE /schedules/{id}` 는 삭제가 아니라 소프트 취소다. 큐에서 잡을 빼고 status 를\ncancelled 로 바꾼다. 문서는 남아 계속 읽히지만 되살리는 엔드포인트는 없다.\n\n이미 발행된 건까지 status 를 cancelled 로 덮는다. **올라간 글은 네이버에서 내려가지\n않는다.** 전체 건수를 \"안 올라간다\" 로 말하면 거짓이 된다.\n\n## 큐와 재실행\n\n- `GET /api/queues/dashboard` — 계정별 큐 현황\n- `GET /api/queues/{accountId}/jobs` — 그 계정의 큐 잡\n- `POST /api/queues/{accountId}/retry` — 실패한 잡 재시도\n- `GET /queues/stats` — 전체 통계\n- `POST /schedules/{id}/execute` — pending·generating 인 건만 다시 큐에 넣는다.\n  cancelled 는 다시 안 들어간다\n\n## 파이프라인\n\n- `GET /api/content-pipelines/blocks` — 쓸 수 있는 블록 목록\n- `GET /api/content-pipelines` — 저장된 파이프라인\n- `POST /api/content-pipelines`, `DELETE /api/content-pipelines/{key}` — 쓰기라 도구가 없다"
  },
  "settings": {
    "title": "이 앱의 설정",
    "triggers": [
      "설정",
      "모델 바꾸기",
      "API 키",
      "오픈라우터",
      "연동 주소",
      "엔드포인트",
      "프로필",
      "노출지기 경로",
      "로그인 상태"
    ],
    "routes": [],
    "tools": [
      "check_services",
      "list_services",
      "open_service",
      "exposure_login",
      "dabut_login",
      "api_get"
    ],
    "sections": {
      "어디에 저장되나": "`~/Library/Application Support/ply/config/`\n\n| 파일 | 내용 |\n| --- | --- |\n| `settings.json` | OpenRouter 키, 다붓 토큰, 노출지기 쿠키, 모델, 연동 주소 |\n| `accounts.json` | 네이버 계정과 암호화된 비밀번호 |\n| `profiles.json` | 브라우저 프로필 목록 |\n\n시크릿은 전부 safeStorage 로 암호화한다. 평문 폴백이 없다. 그래서 안전 저장소를 못 쓰는\n기기에서는 비밀번호와 토큰을 아예 저장하지 않고 그 사실을 그대로 알린다.",
      "에이전트가 대신 할 수 있는 것": "| 하려는 일 | 도구 |\n| --- | --- |\n| 다붓 로그인 | `dabut_login` — 카드가 뜬다 |\n| 노출지기 로그인 | `exposure_login` — 카드가 뜬다 |\n| 연동 서비스가 살아 있는지 | `check_services` |\n| 열 수 있는 화면 목록 | `list_services` / `open_service` |",
      "에이전트가 못 하는 것": "OpenRouter 키 저장, 에이전트·원고 모델 변경, 연동 서버 주소 변경, 노출지기 저장소 경로\n지정, 브라우저 프로필 추가·삭제. 전부 패널 오른쪽 위 `설정` 에서 사용자가 직접 한다.\n\n이건 \"권한 밖\" 이라서가 아니라 도구를 안 만든 것이다. 한 번 넣으면 다시 안 바꾸는 값이라\n도구 하나를 쓸 값이 없다고 봤다. 사용자가 물으면 설정 어디를 열면 되는지 한 줄로 알린다.",
      "연동 주소 (도구가 부르는 곳)": "| 이름 | 기본값 |\n| --- | --- |\n| 다붓 백엔드 | `https://blog-analyzer.fly.dev` |\n| 블로그 스케줄러 | `https://21lab-scheduler.fly.dev` |\n| 노출지기 대시보드 | `https://blog-cron-bot-production.up.railway.app` |\n| 노출지기 저장소 경로 | 비어 있음 (컴퓨터마다 달라서 기본값을 두지 않는다) |\n\n노출지기 저장소 경로는 **로컬 실행**에만 쓴다. 노출지기에 로그인돼 있으면\n`run_exposure_check` 가 원격 실행을 먼저 쓰기 때문에 경로가 없어도 노출체크가 돈다.",
      "서비스 카탈로그 (탭으로 여는 화면)": "`open_service` 가 여는 주소들이다. 도구가 API 로 부르는 곳과는 다른 목록이고,\n주소가 비어 있는 항목은 프롬프트와 도구에서 통째로 빠진다. 주소를 지어내지 않는다.",
      "api_get 이 부를 수 있는 서비스": "dabut, scheduler, exposure\n\n읽기 전용이다. 값을 바꾸는 요청은 보낼 수 없고, 경로는 허용목록에 있는 것만 통과한다.\n인증 토큰은 앱이 붙이므로 모델이 넣지 않는다."
    },
    "body": "여기는 HTTP API 가 없다. 전부 이 앱의 로컬 설정이고 Electron IPC 로만 바뀐다.\n그래서 에이전트가 대신 바꿀 수 있는 것과 없는 것이 갈린다.\n\n## 어디에 저장되나\n\n`~/Library/Application Support/ply/config/`\n\n| 파일 | 내용 |\n| --- | --- |\n| `settings.json` | OpenRouter 키, 다붓 토큰, 노출지기 쿠키, 모델, 연동 주소 |\n| `accounts.json` | 네이버 계정과 암호화된 비밀번호 |\n| `profiles.json` | 브라우저 프로필 목록 |\n\n시크릿은 전부 safeStorage 로 암호화한다. 평문 폴백이 없다. 그래서 안전 저장소를 못 쓰는\n기기에서는 비밀번호와 토큰을 아예 저장하지 않고 그 사실을 그대로 알린다.\n\n## 에이전트가 대신 할 수 있는 것\n\n| 하려는 일 | 도구 |\n| --- | --- |\n| 다붓 로그인 | `dabut_login` — 카드가 뜬다 |\n| 노출지기 로그인 | `exposure_login` — 카드가 뜬다 |\n| 연동 서비스가 살아 있는지 | `check_services` |\n| 열 수 있는 화면 목록 | `list_services` / `open_service` |\n\n## 에이전트가 못 하는 것\n\nOpenRouter 키 저장, 에이전트·원고 모델 변경, 연동 서버 주소 변경, 노출지기 저장소 경로\n지정, 브라우저 프로필 추가·삭제. 전부 패널 오른쪽 위 `설정` 에서 사용자가 직접 한다.\n\n이건 \"권한 밖\" 이라서가 아니라 도구를 안 만든 것이다. 한 번 넣으면 다시 안 바꾸는 값이라\n도구 하나를 쓸 값이 없다고 봤다. 사용자가 물으면 설정 어디를 열면 되는지 한 줄로 알린다.\n\n## 연동 주소 (도구가 부르는 곳)\n\n| 이름 | 기본값 |\n| --- | --- |\n| 다붓 백엔드 | `https://blog-analyzer.fly.dev` |\n| 블로그 스케줄러 | `https://21lab-scheduler.fly.dev` |\n| 노출지기 대시보드 | `https://blog-cron-bot-production.up.railway.app` |\n| 노출지기 저장소 경로 | 비어 있음 (컴퓨터마다 달라서 기본값을 두지 않는다) |\n\n노출지기 저장소 경로는 **로컬 실행**에만 쓴다. 노출지기에 로그인돼 있으면\n`run_exposure_check` 가 원격 실행을 먼저 쓰기 때문에 경로가 없어도 노출체크가 돈다.\n\n## 서비스 카탈로그 (탭으로 여는 화면)\n\n`open_service` 가 여는 주소들이다. 도구가 API 로 부르는 곳과는 다른 목록이고,\n주소가 비어 있는 항목은 프롬프트와 도구에서 통째로 빠진다. 주소를 지어내지 않는다.\n\n## api_get 이 부를 수 있는 서비스\n\ndabut, scheduler, exposure\n\n읽기 전용이다. 값을 바꾸는 요청은 보낼 수 없고, 경로는 허용목록에 있는 것만 통과한다.\n인증 토큰은 앱이 붙이므로 모델이 넣지 않는다."
  }
};
