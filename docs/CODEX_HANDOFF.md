# CODEX_HANDOFF

기준 커밋 `0c868c9` (v0.1.4). 이 문서의 모든 `파일:줄` 은 이 커밋 기준이다.
기준선: `npm run check` 통과 (tests 279 / fail 0). 작업 후에도 이 수치가 줄면 안 된다.

작업은 D(결함) / F(기능) 으로 나뉜다. 각 작업은 독립적으로 집어 들 수 있게 썼고, 의존이 있는 것만 명시했다.

---

## 0. 저장소 규칙

작업 전에 이것부터 지킨다. `AGENT.md` 와 같은 내용이며 여기 요약한다.

- **화살표 함수만.** `function` 키워드를 쓰지 않는다. 핸들러는 named function 으로 분리한 뒤 참조한다.
- **한국어 문장의 자리는 두 곳뿐이다.**
  - 사용자에게 보이는 문장 → `src/messages.ts` (`ONBOARDING` / `EMPTY_STATE` / `CHAT` / `PANEL` / `SIDEBAR` / `TOOLBAR` / `SETTINGS` / `ERRORS` / `CONFIRM` / `PROGRESS` / `SERVICE_LABELS`)
  - 모델이 읽는 문장 → `src/prompts.ts` (`TOOL_DESCRIPTIONS` / `TOOL_PARAMS` / `TOOL_RESULTS` / `buildAgentSystemPrompt`)
  - `.ts` 로직 파일이나 `panel.ts` 안에 한국어 리터럴을 새로 박지 않는다.
- **되돌릴 수 없는 작업은 도구의 `run()` 안에서 직접 확인 게이트를 건다.** 프롬프트 문장으로 막지 않는다.
  기존 패턴: `agent-tools.ts:439` `requestDeleteApproval`, `agent-tools.ts:726` `requestScheduleCancelApproval`.
  승인 판정은 정확 일치 (`agent-tools.ts:348` `isDeleteApproved`, `:623` `isCancelApproved`, 문구는 `messages.ts:215` `CONFIRM`).
- **검증은 `npm run check`** (`tsc --noEmit` + `tsx --test`). 이것만 통과하면 되는 게 아니라 **새 로직에는 테스트를 붙인다.**
- **테스트가 붙지 않는 파일이 있다.** `main.ts` 는 Electron 런타임, `panel.ts` / `sidebar.ts` / `renderer.ts` 는 브라우저 번들이다.
  판정 로직은 순수 모듈로 빼서 테스트한다. 기존 선례: `question-form.ts`(패널 폼 판정), `tool-output.ts`, `service-form.ts`, `scheduler-enums.ts`.
  **새 판정 로직을 `main.ts` / `panel.ts` 안에 그대로 두면 이 문서의 완료 조건을 만족하지 못한다.**
- **개인 계정·실주소를 코드에 새로 박지 않는다.** 서비스 주소 기본값은 `hub.ts:22-26` 의 기존 값만 유지한다.
  블로그 id, 네이버 id, 로컬 저장소 경로를 소스나 테스트에 넣지 않는다 (`agent-tools.test.ts:542` 가 프롬프트에 `example.com` 이 없음을 이미 검사한다).
- **새 IPC 채널은 3곳을 같이 고친다.** `main.ts` 의 `registerIpcHandlers`, `preload.ts` 의 브리지, `bridge.ts` 의 타입.
- **새 도구는 2곳을 같이 고친다.** `agent-tools.ts:1728-1751` 의 반환 배열, `prompts.ts:342` 의 시스템 프롬프트.
- **시크릿은 `safeStorage` 로만.** 평문 폴백을 만들지 않는다. 저장소 모듈은 crypto 를 주입받는 팩토리로 만든다.
- **레이아웃 계산은 `tabs.ts` 의 `layout()` 한 곳에서만.** 각 뷰가 자기 위치를 정하지 않는다.
- 상수(창 크기, 포트, 사이드바 너비 등)는 `src/constants.ts`.

---

## 1. 작업 목록과 순서

### 병렬 그룹 A — 서로 독립. 아무 순서로 동시에 진행 가능
| ID | 제목 | 주 파일 | 크기 |
|---|---|---|---|
| D1 | 다붓 로그인 대기 타임아웃 (앱 고착) | `main.ts` | 소 |
| D2 | 오늘 날짜 주입 + 과거 예약일 거부 | `prompts.ts`, `agent-tools.ts` | 소 |
| D3 | 조용히 끝나는 실행에 폴백 문구 | `openrouter.ts`, `panel.ts` | 소 |
| D7 | `getAgentStatus` 를 패널 `init()` 에서 호출 | `panel.ts` | 극소 |
| D6 | `agentBusy` 문구 정정 | `messages.ts` | 극소 |
| D11 | stale 문서 정리 (도구 23개, 기본 주소) | `docs/STATE.md`, `README.md` | 소 |
| D8 | 계정/프로필 삭제 시 세션 파티션 정리 | `main.ts`, `accounts.ts`, `profiles.ts` | 중 |
| D10 | 다붓 `articleHtml` 유실 정리 | `agent-tools.ts` | 소 |

### 병렬 그룹 B — 그룹 A 와 독립이나 서로 겹침이 큼. 한 사람이 순서대로
| ID | 제목 | 선행 | 크기 |
|---|---|---|---|
| D5 | 작업용 탭 정리 + 포커스 강탈 제거 | 없음 | 중 |
| D4 | 정지 버튼 + AbortSignal | 없음 (D3 과 파일 겹침) | 중 |
| F1 | 로그인 인계 (캡차/2차인증) | **D1** | 중 |
| F3 | `publish_blog_post` 확인 게이트 | 없음 | 중 |

### 순차 구간 — 선행이 끝나야 시작
| ID | 제목 | 선행 | 이유 |
|---|---|---|---|
| F4 | 스텝 로그 + 리플레이 | D5 | 탭이 새면 캡처 대상이 어긋난다 |
| D9 | 프로필 ↔ 계정 id 통합 | D8 | 파티션 정리와 같은 자리를 만진다 |
| F2 | 계정별 병렬 실행 슬롯 | **D5, D1, D4** | 탭 누수가 배수로 늘고, 정지 수단 없이 병렬은 위험 |
| F5 | 셀렉터 캐시 + self-healing | **F4** | 실패 증거 없이 손대면 오탐이 삭제로 이어진다 |

---

## 2. 작업 상세

---

### D1. 다붓 로그인 대기에 타임아웃이 없어 앱 전체가 고착된다

**목적**
`requestDabutLogin` 이 영원히 안 풀리면 `runAgent` 의 `finally` 가 안 돌아 `agentRunning` 이 `true` 로 굳는다.
패널·사이드바·툴바 셋 다 '실행 중' 으로 남고 앱을 죽여야 풀린다. 이걸 없앤다.

**건드릴 파일**
- `src/main.ts:85-96` — `pendingDabutLogins` / `requestDabutLogin`. resolve 만 있고 reject 도 타이머도 없다.
- `src/main.ts:98-115` — `QUESTION_TIMEOUT_MS` + `pushQuestion`. **이미 올바른 패턴이 여기 있다.** 주석(`:100-101`)이 이 함정을 그대로 서술해 놨다.
- `src/main.ts:356-363` — `agent:dabutLoginDone`. 유일한 resolve 경로.
- `src/main.ts:270-286` — `agentRunning` 토글과 `finally`.
- `src/messages.ts:141` `ERRORS` — 타임아웃 문구 (`questionTimeout` 이 이미 있다. 재사용하거나 다붓용을 따로 둔다).
- `src/agent-tools.ts:1276` `dabutLogin` 도구 — 지금은 `requestDabutLogin` 의 결과 문자열을 그대로 쓴다. reject 를 잡아 `TOOL_RESULTS` 문구로 바꿔야 한다 (`askUserTool` 이 `:1194-1198` 에서 하는 것과 같은 모양).

**구현 방향**
1. `pendingQuestions` 와 `pendingDabutLogins` 가 같은 모양이므로 **대기 레지스트리를 순수 모듈로 뺀다.** 새 파일 `src/pending.ts` 를 만들고
   `createPendingRegistry({ timeoutMs, onTimeout })` 정도로 `push(payload) → Promise` / `settle(id, value) → boolean` / `size` 를 노출한다.
   타이머 제어를 테스트하려면 `setTimeout`/`clearTimeout` 을 주입받는 형태로 만든다 (`accounts.ts` 가 crypto 를 주입받는 것과 같은 이유).
2. `main.ts` 의 `pushQuestion` 과 `requestDabutLogin` 을 둘 다 이 레지스트리로 바꾼다. 채널 전송(`sendToPanel`)만 각자 남긴다.
3. `dabutLogin` 도구의 `run()` 에서 reject 를 `catch` 해서 `RESULT.*` 문구를 돌려준다. 예외가 도구 밖으로 나가면 실행 전체가 죽는다.

**완료 조건 (전부 만족)**
- `npm run check` 통과, 기존 279 테스트 유지.
- `src/pending.test.ts` 신규. 최소 3개:
  - `settle` 이 불리면 promise 가 그 값으로 resolve 되고 타이머가 해제된다.
  - 타임아웃이 지나면 promise 가 reject 되고 레지스트리에서 항목이 사라진다(`size === 0`).
  - 타임아웃 이후에 도착한 `settle` 은 `false` 를 돌려주고 아무것도 안 한다.
- `src/agent-tools.test.ts` 에 1개 추가: `requestDabutLogin` 이 reject 하도록 스텁을 준 상태에서 `dabut_login` 도구의 `run()` 이 **던지지 않고** 문자열을 돌려준다.
- `grep -n "new Promise" src/main.ts` 결과에 타이머 없는 대기 promise 가 남아 있지 않다.

**주의**
- 타임아웃 값은 `QUESTION_TIMEOUT_MS`(10분)와 같게 둔다. 새 상수를 만들 거면 `constants.ts` 에.
- 패널 쪽(`panel.ts:915-946` 부근 `requestAgentDabutLogin`)은 타임아웃 후 `agent:dabutLoginDone` 을 보내도 `false` 만 받는다. 카드가 남아 있으면 사용자가 눌렀는데 아무 일도 안 일어난 것처럼 보인다. 카드에 만료 표시를 넣거나 제거한다. 문구는 `messages.ts`.

---

### D2. 오늘 날짜가 프롬프트에 없고, 과거 날짜가 그대로 예약 등록된다

**목적**
모델이 날짜를 지어내고 검증도 없어서, 지난 날짜로 예약이 걸리면 스케줄러 워커가 밀린 job 으로 보고 즉시 집어간다.
관측된 "예약이 즉시 돌았다" 와 가장 잘 맞는 경로다.

**건드릴 파일**
- `src/prompts.ts:342` `buildAgentSystemPrompt` — 현재 날짜·시각·타임존이 한 글자도 없다 (`grep -n "Date\|toISOString" src/prompts.ts` → 0건).
- `src/prompts.ts:79` `PARAM.scheduleDate` — "YYYY-MM-DD 형식의 실제 날짜" 라고만 한다.
- `src/prompts.ts:145,163` `TOOL_RESULTS.scheduleDateRequired` / `scheduleDateFormat` — 거부 문구가 있는 자리.
- `src/agent-tools.ts:212-220` `isCalendarDate` — 형식과 달력 유효성만 본다. `2026-02-31` 은 잡지만 `2025-01-01` 은 통과한다. 게다가 `Date.parse(\`${value}T00:00:00Z\`)` 로 **UTC** 판정인데 사용자와 스케줄러는 KST 다.
- `src/agent-tools.ts:232-315` `buildAutoScheduleInput` — `:245-248` 에서 형식만 보고 "오늘 이후" 검사가 없다. `:267` `startHour` 는 optional.
- `src/hub.ts:373` — `startHour` 가 `undefined` 면 body 에서 통째로 빠져 서버 기본값이 쓰인다.

**구현 방향**
1. `buildAgentSystemPrompt` 를 **오늘 날짜를 인자로 받도록** 바꾼다. `buildAgentSystemPrompt({ today: 'YYYY-MM-DD' })` 처럼.
   함수 안에서 `new Date()` 를 부르면 테스트가 시계에 묶인다. 호출부는 `main.ts:277` 한 곳뿐이다.
   KST 문자열을 만드는 순수 함수(예: `toKstDate(now: Date): string`)를 따로 두고 테스트한다.
2. 프롬프트 본문에 한 줄 추가: 오늘 날짜와 타임존이 KST 라는 것, "내일"/"모레" 는 이 값을 기준으로 계산하라는 것.
3. `buildAutoScheduleInput` 에 `today` 를 넘겨 `scheduleDate < today` 면 거부한다. 새 `TOOL_RESULTS` 문구를 `prompts.ts` 에 만든다.
4. `isCalendarDate` 의 UTC 판정을 유지하되(문자열 되찍기용으로는 맞다), **비교는 문자열 사전순으로** 한다. `YYYY-MM-DD` 는 사전순 = 시간순이라 타임존 변환이 필요 없다.
5. `startHour` 를 `required` 에 넣는다 (`agent-tools.ts:1423` 의 `required` 배열). 모델이 모르면 `ask_user_form` 으로 묻게 프롬프트에 적는다.

**완료 조건**
- `npm run check` 통과.
- `src/agent-tools.test.ts` 에 4개 추가:
  - `buildAutoScheduleInput` 이 `scheduleDate` = 어제일 때 `ok: false` 를 주고 결과 문자열이 `TOOL_RESULTS` 의 새 문구와 정확히 같다.
  - 오늘 날짜는 통과한다.
  - `startHour` 누락이 `ok: false` 로 떨어진다.
  - `buildAgentSystemPrompt({ today: '2026-09-03' })` 결과 문자열에 `'2026-09-03'` 이 포함된다.
- KST 변환 함수에 테스트 2개: UTC 15:00 (= KST 익일 00:00) 이 다음 날짜를 준다 / UTC 14:59 는 당일을 준다.
- `grep -n "new Date()" src/prompts.ts` 가 0건.

**주의**
- `hub.ts` 의 `buildAutoScheduleBody` 는 건드리지 않는다. snake_case 매핑은 이미 테스트로 고정돼 있다(`hub.test.ts`).
- 서버가 날짜를 어떻게 해석하는지는 이 저장소에서 확인할 수 없다. **여기서 하는 건 "잘못된 값이 나가지 않게 막는 것" 뿐이다.** 커밋 메시지나 문서에 "즉시 발행 버그를 고쳤다" 라고 쓰지 않는다.

---

### D3. 실행이 아무 출력 없이 조용히 끝난다

**목적**
스피너가 사라지고 화면에 아무것도 안 남는 경우를 없앤다.

**건드릴 파일**
- `src/openrouter.ts:181` — `if (message.content)` 일 때만 `assistant` 이벤트를 쏜다.
- `src/openrouter.ts:183-189` — `tool_calls` 가 0개면 그대로 `done: 'end'` 로 return. `content: null` + tool_calls 없음은 툴콜 모델에서 흔하다.
- `src/panel.ts:497-509` `handleAgentEvent` — `event.text.trim()` 이 있어야만 카드를 그리고, `done` 은 `reason === 'max_iterations'` 일 때만 문구를 찍는다.
- `src/openrouter.ts:169-179` — `usage` 이벤트를 쏘는데 `handleAgentEvent` 에 `usage` 분기가 없다. 같은 자리라 함께 처리한다.
- `src/messages.ts:46` `CHAT` — 폴백 문구와 usage 표기 문구 자리.
- `src/bridge.ts` — `AgentEvent` 의 `done` 에 필드를 추가하면 여기 타입도 같이 고친다.

**구현 방향**
1. `done` 이벤트에 `hadOutput: boolean` 같은 필드를 실어 보낸다. 루프 안에서 assistant 이벤트를 한 번이라도 쐈는지 추적한다.
2. `handleAgentEvent` 에서 `reason === 'end' && !hadOutput` 이면 `CHAT` 의 폴백 문구를 카드로 찍는다.
3. `usage` 분기를 추가한다. 누적 토큰을 칩이나 상태줄에 표시한다. 단가는 `models.ts` 에 이미 있다.

**완료 조건**
- `npm run check` 통과.
- `src/openrouter.test.ts` 에 2개 추가:
  - 모델이 `{ content: null, tool_calls: [] }` 로 답하면 `done` 이벤트에 `hadOutput: false` 가 실린다.
  - 텍스트로 답하면 `hadOutput: true` 다.
- 판정을 `panel.ts` 밖에서 검증할 수 있어야 한다. 분기가 한 줄이면 `panel.ts` 에 둬도 되지만, usage 누적/포맷은 순수 함수로 빼고 테스트를 붙인다 (`tool-output.ts` 와 같은 결).

**주의**
- `panel.ts` 는 테스트가 안 붙으므로 로직을 거기 쌓지 않는다.
- 폴백 문구는 사용자에게 보이므로 반드시 `messages.ts`. 해요체.

---

### D4. 정지 버튼이 없다

**목적**
잘못 시킨 실행을 멈출 수 있게 한다. 루프 안에 `publish_blog_post` / `delete_blog_posts` 가 있으므로 편의가 아니라 안전 문제다.

**건드릴 파일**
- `src/panel.html:105` — `send` 버튼 하나뿐. 정지 버튼을 여기 추가한다.
- `src/panel.ts:394-397` `setRunning` — 실행 중 상태 전환 자리.
- `src/openrouter.ts:150-231` `runAgentLoop` — `AbortSignal` 이 없다 (`grep -rn "abort" src/` → 0건).
- `src/main.ts:240-287` `runAgent` — `AbortController` 를 여기서 만들고 보관한다.
- `src/main.ts:registerIpcHandlers` + `src/preload.ts` + `src/bridge.ts` — 새 IPC `agent:cancel` 3곳 동시 수정.
- `src/messages.ts` — 버튼 라벨(`PANEL`)과 중단 결과 문구(`CHAT`).

**구현 방향**
1. `runAgentLoop` 에 `signal?: AbortSignal` 을 받아 **반복 시작 지점과 각 도구 호출 직전** 두 곳에서 확인한다. 중단되면 `done: 'cancelled'` 이벤트를 쏘고 지금까지의 `messages` 를 그대로 반환한다.
2. **도구 실행 중간에는 끊지 않는다.** `publish` / `delete` 가 반쯤 실행된 상태로 남으면 최악이다. 취소는 "다음 도구를 부르지 않는다" 의 의미로만 구현한다. 이 결정을 `openrouter.ts` 에 주석으로 남긴다.
3. axios 요청에도 signal 을 넘겨 대기 중인 completion 은 즉시 끊는다.
4. 패널에 정지 버튼을 붙이고 `done: 'cancelled'` 를 받으면 중단 문구를 찍는다.

**완료 조건**
- `npm run check` 통과.
- `src/openrouter.test.ts` 에 3개 추가:
  - 이미 abort 된 signal 을 주면 도구가 **한 번도** 호출되지 않고 `done: 'cancelled'` 가 나온다.
  - 첫 도구 실행 후 abort 하면 두 번째 도구가 호출되지 않는다.
  - abort 되어도 진행 중이던 도구의 결과는 `messages` 에 남는다.
- `bridge.ts` 의 `AgentEvent` union 에 `'cancelled'` 가 포함되어 타입체크가 통과한다.

**주의**
- `agentRunning` 해제는 `main.ts:285` 의 `finally` 가 이미 한다. 취소 경로에서 이중 해제하지 않는다.
- F2(병렬)를 나중에 하면 컨트롤러는 실행 id 별로 보관해야 한다. 지금부터 `Map<runId, AbortController>` 형태로 두면 F2 에서 안 뜯는다.

---

### D5. 에이전트 탭 누수 + 사용자 화면 강탈

**목적**
작업용 탭이 영구히 남는 것과, 에이전트가 탭을 열 때마다 사용자가 보던 화면을 뺏는 것을 없앤다.

**건드릴 파일**
- `src/tabs.ts:122-161` `createTab` — 끝에서 무조건 `selectTab(tab.id)` 를 부른다(`:157`). `openedByAgent` 분기가 없다.
- `src/tabs.ts:164` `closeTab` — 이미 있다. `agent-tools.ts` 전체에 `closeTab` 문자열이 0건이다.
- 작업용 탭 4곳 (닫아야 함): `agent-tools.ts:877`(로그인), `:961-965`(발행), `:1002`(목록), `:1066-1070`(삭제).
- 남겨야 하는 2곳 (사용자가 보라고 연 탭): `agent-tools.ts:1142`(`open_service`), `:1165`(`open_tab`).
- `src/naver.ts:89-100` `findPageByTabId` — 열린 **모든** 페이지에 `page.evaluate` 를 돈다. 누수될수록 탭 특정이 선형으로 느려진다.
- `src/sidebar.ts:90-99` — 이미 에이전트 탭을 별도 섹션으로 접어 보여준다.

**구현 방향**
1. `createTab` 에서 `openedByAgent === true` 면 `selectTab` 을 건너뛴다. 활성 탭이 하나도 없을 때만 선택한다.
2. 작업용 4곳을 `try/finally` 로 감싸 `tabManager.closeTab(tabId)` 를 부른다. **기존 `finally` 의 `browser.close()` 와 순서를 지킨다** — 페이지를 먼저 놓고 탭을 닫는다.
3. 로그인 탭은 예외 판단이 필요하다. F1(로그인 인계)에서 이 탭을 사람에게 넘기므로, **캡차/2차인증으로 빠지는 경로에서는 닫지 않는다.** 지금은 그 경로도 `return` 이므로 `finally` 가 무조건 닫아버린다. F1 을 같은 사람이 맡으면 함께, 아니면 로그인 탭만 `block !== null` 일 때 남기는 분기를 지금 넣어 둔다.
4. 반복되는 "탭 열고 → 페이지 잡고 → 반드시 닫기" 를 헬퍼로 묶는다 (예: `withAgentTab(...)`). 4곳이 같은 모양이다.

**완료 조건**
- `npm run check` 통과.
- `src/agent-tools.test.ts` 에 3개 추가 (기존 스텁 `TabManager` 를 쓴다):
  - `publish_blog_post` 가 성공하면 `closeTab` 이 생성된 tabId 로 정확히 1회 호출된다.
  - `publish_blog_post` 가 도중에 던져도 `closeTab` 이 호출된다.
  - `open_tab` / `open_service` 는 `closeTab` 을 호출하지 않는다.
- `src/tabs.ts` 에 대한 테스트가 없다면, `selectTab` 분기 판정만 순수 함수로 빼서 테스트한다 (`shouldFocusNewTab({ openedByAgent, hasActive })` 같은 형태).
- `grep -n "closeTab" src/agent-tools.ts` 가 4건 이상.

**주의**
- 사용자가 그 탭을 보고 있는 중에 닫히면 화면이 튄다. 1번(포커스 강탈 제거)을 먼저 해야 2번이 안전하다.
- `naver_login` 성공 후 탭을 닫아도 세션 쿠키는 `persist:` 파티션에 남는다. `check_login` 은 쿠키만 보므로 영향 없다.

---

### D6. `agentBusy` 문구가 하지 않는 약속을 한다

**목적**
`messages.ts:152` 는 "지금 다른 작업이 돌고 있어요. 끝나면 이어서 할게요." 인데 큐가 없다.
`main.ts:243` 이 그냥 throw 하고 패널은 에러 카드로 찍은 뒤 메시지를 버린다. 사용자는 예약된 줄 알고 기다린다.

**건드릴 파일**
- `src/messages.ts:152` `ERRORS.agentBusy`

**구현 방향**
큐를 만들지 않는다면 문구를 사실대로 바꾼다. "지금 다른 작업이 돌고 있어요. 끝난 뒤에 다시 보내 주세요." 정도.
F2(병렬)를 하면 이 문구는 "같은 계정으로 이미 작업이 돌고 있어요" 로 다시 바뀐다.

**완료 조건**
- `npm run check` 통과.
- 문구에 "이어서" 나 그에 준하는 대기 약속 표현이 없다.

**주의** 극소 작업이다. 단독 커밋으로 낸다. F2 를 맡은 사람과 겹치면 F2 쪽에 합친다.

---

### D7. `getAgentStatus` 가 배선만 되고 아무도 안 부른다

**목적**
실행 중에 패널이 리로드되면 패널만 대기 상태로 보이고, 메시지를 보내면 `agentBusy` 에러가 난다.

**건드릴 파일**
- `src/bridge.ts:132` — 타입 있음.
- `src/preload.ts:33` — 브리지 있음.
- `src/main.ts:335` — 핸들러 있음.
- `src/panel.ts:1258-1307` `init()` — **호출만 없다.** `:1297` 의 `api.onAgentRunning(setRunning)` 옆이 자리다.

**구현 방향**
`init()` 안에서 `const { running } = await api.getAgentStatus();` 를 부르고 `setRunning(running)` 한다.
`Promise.all` 배열(`panel.ts:1259-1263`)에 끼워 넣는 게 자연스럽다.

**완료 조건**
- `npm run check` 통과.
- `grep -n "getAgentStatus" src/panel.ts` 가 1건 이상.

**주의** 1줄이다. D3 이나 D4 를 맡은 사람이 같이 처리해도 된다.

---

### D8. 계정·프로필을 지워도 세션이 디스크에 남는다

**목적**
`session.fromPartition(...).clearStorageData()` 가 `src/` 전체에 0건이다.
계정을 지워도 `persist:<id>` 의 네이버 쿠키가 그대로 남는다. `AGENT.md` 의 "주의" 마지막 줄이 이미 인정한 문제다.

**건드릴 파일**
- `src/accounts.ts:103-106` `remove` — 파일에서만 지운다.
- `src/profiles.ts:61-67` `removeProfile` — 파일에서만 지운다.
- `src/profiles.ts:15` `partitionOf`
- `src/main.ts:329`(`account:remove`) / `:326`(`profile:remove`) 부근 IPC 핸들러 — **Electron 의존은 여기서 처리한다.**
- `src/messages.ts` — 확인 문구.

**구현 방향**
1. `accounts.ts` / `profiles.ts` 는 Electron 을 import 하지 않는다(테스트가 붙어 있다). 파티션 정리는 **`main.ts` 의 IPC 핸들러에서** `session.fromPartition(partitionOf(id)).clearStorageData()` 로 한다.
2. 계정 삭제는 세션 소실을 동반하므로 확인을 받는다. 패널 UI 에서 확인하거나, 도구화하지 않고 설정 패널에서만 가능하게 유지한다.
3. `naver_logout` 도구를 만들 거라면 `agent-tools.ts` 반환 배열(`:1728`)과 프롬프트를 같이 고친다. **이건 되돌릴 수 없는 축은 아니지만 사용자가 의도치 않게 로그아웃되면 나머지 작업이 전부 막히므로 확인 게이트를 붙인다.**

**완료 조건**
- `npm run check` 통과.
- `src/accounts.test.ts` 에 1개 추가: `remove` 가 저장 파일에서만 지우고 crypto/세션에 손대지 않는다(계약 고정).
- `grep -n "clearStorageData" src/main.ts` 가 2건 (계정·프로필).
- 새 도구를 만들었다면 `agent-tools.test.ts` 의 도구 개수·이름 검사를 갱신한다.

**주의**
- `default` 프로필은 삭제 대상이 아니다 (`profiles.ts:62` 가 이미 막는다). 파티션도 지우면 안 된다.
- 삭제 중에 그 파티션을 쓰는 탭이 열려 있으면 Electron 이 조용히 실패할 수 있다. 먼저 해당 프로필 탭을 닫는다.

---

### D9. 프로필 id 와 계정 id 가 다른 네임스페이스라 침묵 실패한다

**선행: D8**

**목적**
사이드바에서 손으로 로그인해도 `check_login` 이 "세션 없음" 이라고 하는 경우를 없앤다.

**건드릴 파일**
- `src/profiles.ts:11-12` — `~/.gng-browser/profiles.json`, id 는 라벨 slug.
- `src/accounts.ts:48-56` `nextAccountId` — id 는 `label || naverId` 기반. 저장 위치는 `<userData>/config/accounts.json` (`main.ts:126`).
- `src/sidebar.ts:117,145` — **프로필 id** 로 탭을 만든다.
- `src/agent-tools.ts:877, 961-965, 1002, 1066-1070` — **계정 id** 를 `profileId` 자리에 넣는다.
- `src/main.ts:153-156` `getCookieNames` — 그 값으로 파티션을 읽는다.
- `src/prompts.ts:342` 시스템 프롬프트 — 이미 "계정 id 체계가 두 개다" 라고 적혀 있는데, 그건 브라우저 계정 vs **스케줄러** 계정 얘기다. 프로필까지 세 개인 셈이다.

**구현 방향**
두 선택지 중 하나를 고르고 그 결정을 `AGENT.md` 에 적는다.
- (A) **계정을 단일 출처로.** 계정을 추가할 때 같은 id 의 프로필을 자동 생성하고, 사이드바 프로필 목록을 계정 목록에서 파생시킨다. 파티션 id 는 계정 id 하나.
- (B) **계정에 `profileId` 필드를 추가.** 기존 계정은 마이그레이션에서 자기 id 를 채워 넣는다. 모든 파티션 접근은 이 필드를 거친다.

(A) 가 개념이 하나 줄어들어 낫지만, 이미 저장된 프로필이 있으면 마이그레이션이 필요하다. 어느 쪽이든 **마이그레이션은 순수 함수로 만들고 테스트한다** (`settings.ts` 의 `migrateServiceUrls` 가 선례).

**완료 조건**
- `npm run check` 통과.
- 마이그레이션 함수 테스트 3개: 프로필만 있는 상태 / 계정만 있는 상태 / 둘 다 있고 id 가 어긋난 상태에서 각각 기대하는 결과.
- `agent-tools.ts` 의 `createTab` 호출부가 파티션 id 를 **한 가지 경로로만** 얻는다 (헬퍼 함수 하나를 거친다).
- `AGENT.md` 의 "주의" 에 결정이 한 줄로 적혀 있다.

**주의**
- 파티션 id 를 바꾸면 기존 로그인 세션이 전부 끊긴다. 마이그레이션에서 파티션을 옮길 수 없으면 **id 를 바꾸지 말고 매핑만 추가**하는 (B) 를 택한다.
- 스케줄러 계정 id(`list_scheduler_accounts`)는 세 번째 체계다. 여기 섞지 않는다.

---

### D10. 다붓이 만든 이미지가 버려진다

**목적**
`article_html` 을 받아오는데 쓰지 않는다. 이미지를 만들어 놓고 못 넣는 상태를 정리한다.

**건드릴 파일**
- `src/hub.ts:276-277, 313-314` — `articleHtml` / `imageCount` 를 파싱한다.
- `src/agent-tools.ts:1345-1352` — `splitManuscript(result.content)` 로 평문만 쓰고 `articleHtml` 을 참조하지 않는다 (`grep -n articleHtml src/agent-tools.ts` → 0건). `images: result.imageCount` 로 개수만 보고한다.
- `src/naver.ts:474-500` `writeBlogPost` — 제목·본문 타이핑 → 발행 대화상자 → 확인이 전부다.

**구현 방향**
**이번 작업에서 이미지 삽입을 구현하지 않는다.** 스마트에디터 셀렉터가 미검증이라(`docs/STATE.md` 의 "로그인 이후 경로 미검증") 여기서 손대면 F4 없이 디버깅이 불가능하다.
지금 할 일은 두 가지다.
1. `generate_manuscript_dabut` 의 결과에 "이미지 N개가 생성됐지만 현재 발행 경로는 본문 텍스트만 넣는다" 는 사실을 `TOOL_RESULTS` 문구로 명시한다. 모델이 이미지가 들어갔다고 사용자에게 보고하는 걸 막는다.
2. `hub.ts` 의 `articleHtml` 파싱은 남긴다. 죽은 필드가 아니라 다음 작업의 입력이라는 주석을 단다.

**완료 조건**
- `npm run check` 통과.
- `src/agent-tools.test.ts` 에 1개 추가: `imageCount > 0` 인 응답에 대해 도구 출력에 이미지 미반영 안내가 포함된다.
- 시스템 프롬프트(`prompts.ts:342`)에 "이미지는 아직 본문에 들어가지 않는다" 는 한 줄이 있다.

**주의** 실제 삽입은 "나중에" 목록이다. 이 작업이 그걸 했다고 오해하게 쓰지 않는다.

---

### D11. 문서가 코드와 어긋난다

**목적**
읽는 사람이 틀린 정보를 얻는 걸 막는다.

**건드릴 파일**
- `docs/STATE.md:24` — "도구 19개". 실제 `agent-tools.ts:1728-1751` 반환 배열은 **23개**다.
- `README.md:28` — 같은 "19개".
- `README.md:52-53` — 기본 주소를 `http://127.0.0.1:8000` / `:3000` 이라고 적었는데 코드(`hub.ts:22-26`)는 `https://blog-analyzer.fly.dev` / `https://21lab-scheduler.fly.dev` 다.
- `docs/STATE.md:91-97` — "남은 문제" 표. 이 문서의 D1/D5 를 반영한다.

**실제 도구 23개 (반환 배열 순서)**
`ask_user`, `ask_user_form`, `list_accounts`, `check_login`, `naver_login`, `check_services`, `dabut_login`,
`list_dabut_projects`, `generate_manuscript_dabut`, `generate_manuscript`, `publish_blog_post`, `list_my_posts`,
`delete_blog_posts`, `list_scheduler_accounts`, `auto_schedule_posts`, `list_schedules`, `get_schedule`,
`cancel_schedule`, `list_exposure_jobs`, `run_exposure_check`, `list_services`, `open_service`, `open_tab`

문서에서 빠져 있던 4개: `ask_user_form`, `list_schedules`, `get_schedule`, `cancel_schedule`.

**구현 방향**
표를 갱신한다. 개수를 문장에 박는 대신 표의 행 수로 말하게 쓰면 다음에 또 어긋나지 않는다.
`site/index.html` 의 `h91` "네이버 탭에서 하던 일이라면 전부 대신 합니다" 도 함께 내린다.
**실제 네이버 쓰기 동사는 발행·삭제 둘뿐이다.** 수정·임시저장·카테고리·태그·이웃·댓글·통계·카페는 전부 없다.

**완료 조건**
- 문서의 도구 표 행 수가 23이고, 각 이름이 `agent-tools.ts` 반환 배열과 일치한다.
- `README.md` 의 기본 주소가 `hub.ts:22-26` 과 문자열까지 같다.
- `site/index.html` 에서 "전부" 류의 범위 주장이 사라졌다.
- 가능하면 테스트로 고정한다: 반환 배열의 도구 이름 목록을 `agent-tools.test.ts` 에 스냅샷으로 박아 두면 다음에 도구를 추가할 때 테스트가 먼저 깨진다.

**주의** `hub.ts` 의 기본 주소는 이미 배포된 실주소다. **문서를 코드에 맞추는 것이지 코드를 문서에 맞추는 게 아니다.** 새 주소를 만들거나 개인 경로를 적지 않는다.

---

### F1. 로그인 인계 (캡차 / 2차인증)

**선행: D1** (인계 대기가 D1 의 타이머를 타야 안전하다)

**목적**
계정 여러 개를 도는 중 캡차나 기기등록이 뜨면, 그 탭을 사람에게 넘기고 끝나면 이어서 나머지를 돈다.
지금은 문자열만 돌려주고 실행이 그냥 끝나서 처음부터 다시 시켜야 한다.

**건드릴 파일**
- `src/agent-tools.ts:895-898` — `detectLoginBlock` 결과로 `RESULT.blockedByCaptcha` / `blockedByTwoFactor` / `wrongCredentials` 를 return 하고 끝난다.
- `src/naver.ts:162-176` `detectLoginBlock` — `'captcha' | 'two_factor' | 'error' | null` 을 이미 정확히 판별한다.
- `src/agent-tools.ts:877` — 로그인 탭. 이미 우리 창 안에 있다.
- `main.ts:98-115` `askUser` / `pushQuestion` — 10분 타이머를 그대로 쓴다.
- `src/agent-tools.ts:325` `hasNaverSession` + `getCookieNames` — 재개 판정에 쓴다.
- `src/messages.ts` `CONFIRM` / `PROGRESS`, `src/prompts.ts` `TOOL_RESULTS`.

**구현 방향**
1. `block !== null` 이면 return 하지 말고 **그 탭을 사용자에게 보여주고**(`tabManager.selectTab`) `askUser` 로 "직접 풀고 완료를 눌러 주세요" 를 띄운다.
2. 사용자가 완료하면 쿠키를 다시 읽어(`getCookieNames` + `hasNaverSession`) 세션이 생겼는지 확인한다. 생겼으면 성공, 아니면 실패 문구.
3. 폴링을 쓸 거면 짧은 간격 × 정해진 횟수로 상한을 둔다. 무한 대기를 만들지 않는다.
4. `wrongCredentials`(비밀번호 틀림)는 인계 대상이 아니다. 그대로 return 한다.
5. **인계 중에는 스크린샷·DOM 캡처를 하지 않는다.** F4 를 나중에 붙일 때 이 예외를 반드시 지킨다 — 비밀번호가 디스크에 남으면 `safeStorage` 로 지켜온 게 무너진다.

**완료 조건**
- `npm run check` 통과.
- `src/agent-tools.test.ts` 에 4개 추가 (`detectLoginBlock` 과 `getCookieNames` 를 스텁으로):
  - `captcha` 감지 시 `askUser` 가 정확히 1회 호출된다.
  - 인계 후 쿠키가 생기면 성공 문구를 돌려준다.
  - 인계 후에도 쿠키가 없으면 실패 문구를 돌려준다.
  - `error`(비밀번호 틀림)는 `askUser` 를 부르지 않는다.
- 재개 판정(쿠키 폴링 상한, 성공/실패 결정)이 순수 함수로 분리되어 테스트된다.

**주의**
- **캡차를 우리가 풀지 않는다.** 사람에게 넘기는 것만 구현한다. 자동 우회 코드를 넣지 않는다.
- D5(탭 정리)와 충돌한다. 인계 경로에서는 로그인 탭을 닫으면 안 된다. 두 작업을 한 사람이 맡거나, D5 쪽에 `block !== null` 이면 남기는 분기를 먼저 넣는다.
- 10분 대기 동안 실행 슬롯을 점유한다. F2 이전에는 그 사이 다른 작업을 못 한다는 걸 문구로 알린다.

---

### F2. 계정별 병렬 실행 슬롯

**선행: D5, D1, D4**

**목적**
`main.ts:53` 의 `let agentRunning = false` 가 앱 전체에 하나뿐이라 계정 3개를 동시에 못 돌린다.
탭과 세션은 `persist:<profileId>` 로 갈리는데 실행 슬롯만 단수다. `docs/STATE.md:95` 가 이미 인정했다.

**건드릴 파일**
- `src/main.ts:53` 선언, `:243` 가드, `:270-271` / `:285-286` 토글, `:335` `agent:status`.
- `src/main.ts:147-151` `broadcastAgentStatus` — 지금은 boolean 하나를 세 뷰에 쏜다.
- `src/agent-tools.ts:790-799` — 게이트 상태(`knownPosts` / `knownSchedules` / `knownProjectIds` / `attemptedLogNos` / `refusedLogNos`)가 **이미 실행 단위**다. `createNaverTools` 가 실행마다 새로 불린다.
- `src/panel.ts:58` `running`, `:394` `setRunning`, `:497-509` `handleAgentEvent` — 실행별 레인이 필요하다.
- `src/bridge.ts` — `agent:running` 이벤트 페이로드 타입 변경.
- `src/messages.ts:152` `agentBusy` (D6 참조).

**구현 방향**
1. `agentRunning` 을 `Map<profileId, runId>` 로 바꾼다. **동일 계정 중복 실행은 계속 막는다** — 같은 `persist:` 파티션에 두 실행이 붙으면 `findPageByTabId`(`naver.ts:89-100`)의 탭 특정이 깨진다.
2. `agent:run` 이 실행 id 를 돌려주고, 모든 에이전트 이벤트(`agent:event` / `agent:progress` / `agent:question` / `agent:dabut-login`)에 실행 id 를 실어 보낸다.
3. 패널이 실행 id 별 레인으로 로그를 그린다. 질문 카드도 어느 실행의 것인지 표시한다.
4. `agent:status` 를 실행 목록으로 바꾼다 (D7 이 이걸 소비한다).
5. 어느 계정으로 시작할지는 **사용자 메시지 시점에 알 수 없다.** 모델이 `list_accounts` 를 부른 뒤에야 정해진다. 그러므로 (a) 실행 시작 시점에는 슬롯을 잡지 않고, (b) 계정을 만지는 첫 도구에서 그 계정 슬롯을 잡는 방식이 현실적이다. 이 판정을 순수 함수로 만든다.

**완료 조건**
- `npm run check` 통과.
- 슬롯 관리 로직이 `main.ts` 밖의 모듈로 분리되고 테스트 4개:
  - 서로 다른 계정 2개가 동시에 슬롯을 잡을 수 있다.
  - 같은 계정으로 두 번째 요청은 거부되고 `ERRORS.agentBusy` 계열 문구가 나온다.
  - 실행이 끝나면 슬롯이 해제된다.
  - 실행이 던져도 슬롯이 해제된다.
- `run_exposure_check` 30분 실행 중에 다른 계정 작업이 시작될 수 있음을 검증하는 테스트가 있다.

**주의**
- **D5 를 안 하고 병렬을 켜면 탭이 배수로 샌다.** 선행을 지킨다.
- 어려운 건 동시성이 아니라 패널 UI 와 중복 계정 차단이다. UI 를 먼저 스케치하고 시작한다.
- 스케줄러 `GET/DELETE /schedules` 에 소유자 스코프가 없다(`agent-tools.ts:804-806` 주석). 병렬로 여러 계정이 붙어도 `isOwnedSchedule` 게이트는 계속 실행 단위로 유지한다.

---

### F3. `publish_blog_post` 확인 게이트 (+ 계획 미리보기)

**목적**
공개 발행인데 코드 게이트가 없다. `agent-tools.ts:952-977` 의 `run()` 에 `askUser` 호출이 아예 없고, `prompts.ts:382` 의 프롬프트 문장으로만 막는다.
`delete_blog_posts`(`:1058`)와 `cancel_schedule`(`:1643`)에는 있는 게이트가 여기만 빠졌다.

**건드릴 파일**
- `src/agent-tools.ts:938-977` `publishBlogPost`.
- `src/agent-tools.ts:439` `requestDeleteApproval` / `:348` `isDeleteApproved` — **복사할 패턴.**
- `src/messages.ts:215` `CONFIRM` — 승인 문구 자리.
- `src/prompts.ts` `TOOL_RESULTS` — 취소 결과 문구.
- (계획 미리보기까지 할 경우) `src/agent-tools.ts:1202` `ask_user_form` + `src/question-form.ts`.

**구현 방향**
1. 발행 직전에 제목과 본문 첫 줄을 보여주고 정확 일치 승인을 받는다. `requestDeleteApproval` 과 같은 구조로 만든다.
2. 승인 문구는 `CONFIRM` 에 새로 만든다. 삭제 문구를 재사용하지 않는다 — 사용자가 습관으로 같은 문구를 치는 걸 막는다.
3. 매 편마다 뜨면 귀찮다. **건수 임계값**(예: 1건은 바로, 2건 이상이면 한 번에 묶어 확인) 또는 설정 토글로 조절한다. 어느 쪽이든 판정 함수는 순수 함수로.
4. 계획 미리보기(발행 전 `[계정 / 키워드 / 발행시각 / 프로젝트]` 표)는 **별도 커밋**으로 나눈다. 렌더링은 `ask_user_form` 과 `normalizeQuestionFields`(`agent-tools.ts:121`)를 그대로 재사용하므로 새 IPC 가 필요 없다.

**완료 조건**
- `npm run check` 통과.
- `src/agent-tools.test.ts` 에 4개 추가:
  - 승인 문구를 정확히 입력하면 발행이 진행된다.
  - 다른 문자열이면 발행되지 않고 취소 문구를 돌려준다 (`writeBlogPost` 스텁이 호출되지 않음을 확인).
  - 앞뒤 공백만 다른 입력은 통과한다 (`isDeleteApproved` 와 같은 `trim()` 규칙).
  - 승인 문구가 `CONFIRM.deleteYes` 와 다른 문자열이다.
- 시스템 프롬프트에 "publish_blog_post 도 실행 중 스스로 확인을 받는다" 가 적혀 있다 (`delete_blog_posts` 설명과 같은 형식).

**주의**
- 게이트를 넣으면 프롬프트의 "계획만 말하고 끝내지 마라" 규칙과 부딪혀 보일 수 있다. 프롬프트에 "게이트는 도구가 스스로 띄운다. 모델이 미리 물어볼 필요 없다" 를 명시한다 (`delete_blog_posts` 쪽에 이미 그 문장이 있다).
- 발행은 `delete` 와 달리 실패해도 재시도할 수 있다. 재시도 금지 규칙을 복사해 오지 않는다.

---

### F4. 스텝 로그 + 리플레이

**선행: D5**

**목적**
`docs/STATE.md:96` 의 "로그인 이후 경로 미검증, 스마트에디터 셀렉터 미검증" 은 증거 없이는 못 고친다.
지금은 `naver.ts:433` 이 던진 `ERRORS.publishConfirmNotFound` 한 줄만 남는다.

**건드릴 파일**
- `src/openrouter.ts:214-221` — `tool_start` / `tool_end` 훅. 여기 사이에 캡처를 건다.
- `src/agent-tools.ts:1719` — `run_exposure_check` 가 stdout 을 줄 단위로 흘린다.
- `src/panel.ts:1299-1303` — progress 가 **현재 running step 의 detail 을 갈아끼운다.** 30분 작업의 로그가 마지막 한 줄만 남는다.
- `src/naver.ts` — playwright `Page` 가 이미 있으므로 `page.screenshot()` 을 바로 쓸 수 있다.
- 저장 위치는 `app.getPath('userData')` 아래 실행 id 폴더.

**구현 방향**
1. 실행별로 `{ 시각, 도구, 인자, URL, 결과 }` 를 append-only 로 기록한다. 인자와 결과는 길이 상한을 둔다.
2. 스크린샷은 도구 실행 전후로 찍는다. **로그인 폼·인계 중에는 찍지 않는다** (F1 참조).
3. progress 를 덮어쓰지 말고 누적으로 바꾼다. 화면에는 마지막 N줄만 보이더라도 기록은 전부 남긴다.
4. 패널에 실행 타임라인 뷰를 추가한다.
5. 보관 실행 수 상한을 두고 초과분을 자동 삭제한다.

**완료 조건**
- `npm run check` 통과.
- 로그 레코드 직렬화와 보존 정책이 순수 모듈로 분리되고 테스트 4개:
  - 레코드가 시간순으로 append 된다.
  - 긴 인자/결과가 상한에서 잘린다.
  - 보관 상한을 넘으면 가장 오래된 실행이 삭제 대상으로 뽑힌다.
  - 비밀번호 필드로 표시된 값이 레코드에 남지 않는다.
- `run_exposure_check` 를 스텁으로 돌렸을 때 흘린 stdout 줄이 **전부** 기록에 남는다 (마지막 한 줄이 아니라).

**주의**
- 디스크를 먹는다. 상한을 먼저 정하고 시작한다.
- 스크린샷에 네이버 계정 정보가 찍힐 수 있다. 저장 경로를 문서화하고, 삭제 방법을 `README` 나 설정 패널에 안내한다.
- **이 기능이 만든 파일을 저장소에 커밋하지 않는다.** `.gitignore` 를 확인한다.

---

### F5. 셀렉터 캐시 + self-healing

**선행: F4**

**목적**
이 프로젝트 최대 리스크는 모델 품질이 아니라 네이버 UI 변경이다. 이미 한 번 죽었다 — `docs/STATE.md:89` 의 `.btn_login` → `#loginBtn_column`.
게다가 `naver.ts:50-51` 이 `DELETE_CONFIRM_SELECTORS` 는 "배포 JS 에만 있고 실제 실행 관측 0회" 라고 자백한다.

**건드릴 파일**
- `src/naver.ts:40-60` 부근의 셀렉터 상수들, `clickFirstAvailable`.
- 캐시 저장 위치는 `settings.json` 옆.
- `src/messages.ts` / `src/prompts.ts` — 승인 문구와 모델 지시문.

**구현 방향**
1. 셀렉터 상수를 캐시 파일로 뺀다. 코드 기본값은 유지하고 캐시가 있으면 앞에 붙인다.
2. `clickFirstAvailable` 이 전부 실패하면 축약 DOM 을 모델에 주고 후보 셀렉터를 받는다.
3. `askUser` 로 "이걸로 바꿀까요?" 승인을 받는다. **자동 적용하지 않는다.**
4. 승인되면 캐시만 갱신한다. 소스는 건드리지 않는다.
5. **삭제 계열 셀렉터(`DELETE_*`)는 self-healing 대상에서 제외한다.** 잘못 치유된 삭제 확인 셀렉터가 남의 글을 지우는 시나리오가 실재한다.

**완료 조건**
- `npm run check` 통과.
- 캐시 병합·검증 로직이 순수 모듈로 분리되고 테스트 5개:
  - 캐시가 없으면 코드 기본값을 그대로 쓴다.
  - 캐시가 있으면 캐시 값이 먼저 시도된다.
  - 삭제 계열 키는 캐시에 기록되지 않는다(쓰기 시도가 거부된다).
  - 승인 없이는 캐시가 갱신되지 않는다.
  - 잘못된 모양(빈 문자열, 비-CSS 문자열)의 후보는 거부된다.
- 캐시 파일에 개인 식별 정보가 들어가지 않는다 (셀렉터 문자열만).

**주의**
- **위험이 가장 큰 작업이다.** F4 로 "무엇이 왜 실패했나" 증거가 쌓인 뒤에 시작한다.
- 자동 적용 유혹을 코드 주석으로 못박는다.

---

## 3. 보류 목록 (이번 라운드에서 하지 않음)

근거는 있으나 우선순위가 낮거나 선행이 필요하다.

| 항목 | 자리 | 왜 미루나 |
|---|---|---|
| 글 수정 / 임시저장 / 카테고리·태그 | `naver.ts:474-500` | 가장 큰 기능 구멍이지만 스마트에디터 셀렉터 실측이 필요하다. F4 이후 |
| `articleHtml` 실제 삽입 | `agent-tools.ts:1345` | 본문 입력 방식을 평문 타이핑에서 바꿔야 해서 위와 묶인다 |
| 노출체크 HTTP 트리거 | `hub.ts:25` `exposureBotDir: ''` | 대시보드가 `services.ts:36-42` 에 배포돼 있는데 로컬 `pnpm run` spawn 을 고집한다. 다른 컴퓨터에선 도구 2개가 통째로 죽는다 |
| `run_exposure_check` 승인 게이트 | `agent-tools.ts:1697`, `hub.ts:658-709` | 임의 디렉터리에서 로컬 코드를 실행하는데 게이트가 없다. 삭제·취소에는 있다. 타임아웃 30분 |
| 저장 워크플로(반복 절차 템플릿) | `settings.ts` | F2/F3 가 먼저 서야 값이 산다 |
| 대화 저장 / 새 대화 | `panel.ts:57` `history` | 모듈 변수라 초기화도 저장도 없다. 켜두면 컨텍스트가 무한히 커지고 끄면 전부 날아간다 |
| 예약 수정 | `hub.ts:411-412` | 스케줄러 지문에 `project_id` 가 빠져 있어 취소 후 재등록도 `reused` 로 떨어진다. 서버 쪽 변경이 필요 |
| 스케줄러 401 오진 | `openrouter.ts:77`, `prompts.ts:142` | 401 이 `schedulerUnreachable` 로 떨어져 "서버가 꺼져 있을 수 있다" 는 틀린 말이 나간다. 실제로는 재로그인이 답 |
| 결과 링크가 외부 크롬에서 열림 | `markdown.ts:16-23`, `main.ts:192-199` | `target="_blank"` → `setWindowOpenHandler` 가 외부 브라우저로 던진다. 자기 브라우저인데 발행된 글이 크롬에서 열린다 |
| 브라우저 기본기 | `renderer.ts:68-95` | `Menu` / `globalShortcut` / `before-input-event` / `will-download` / `context-menu` / `findInPage` / `setZoomLevel` 이 `src/` 전체에 0건. 단축키가 툴바 뷰에만 달려 있어 웹페이지에 포커스가 가면 안 먹는다. 다운로드는 조용히 실패 |
| 일일 발행 상한 | `agent-tools.ts:328` 부근 | `MAX_DELETE_PER_RUN` 과 같은 설계로. 단 "저품질을 피한다" 는 광고 문구를 쓰지 않는다 — 네이버는 기준을 공개하지 않는다 |
| 자격증명 비노출 증명 | `accounts.ts`, `prompts.ts` | 이미 `safeStorage` 로 지키고 있다. 남은 건 구현이 아니라 증명 — "비밀번호가 모델 컨텍스트에 안 들어간다" 를 고정하는 테스트 하나. 공개 저장소라 신뢰도 이득이 크다 |

### 하지 않기로 한 것
클라우드 실행 / 섀도 브라우저, 커뮤니티 스킬 마켓, reasoning level 슬라이더, 크레딧 결제,
범용 탭 요약 / `@탭` 멘션 / 범용 사이드바 챗, Deep Research 산출물 생성, Slack·Telegram 원격제어, MCP 서버·CLI 노출.

이유는 공통이다. 이 앱은 **네이버라는 좁은 도메인 + 로컬에 묶인 세션** 위에 서 있고, 그게 방어 가능한 이유다.
범용 브라우저 기능으로 넓히거나 원격 제어를 열면 승인 게이트를 우회하는 경로만 늘어난다.

---

## 4. 작업 후 체크리스트

- [ ] `npm run check` 통과. 테스트 수가 279 미만으로 줄지 않았다.
- [ ] 새 로직에 테스트가 붙었다. `main.ts` / `panel.ts` 안에 테스트 불가능한 판정 로직을 새로 쌓지 않았다.
- [ ] 새 한국어 문장이 `messages.ts` 또는 `prompts.ts` 안에만 있다.
- [ ] 도구를 추가·변경했으면 `agent-tools.ts:1728-1751` 반환 배열과 `prompts.ts:342` 시스템 프롬프트를 같이 고쳤다.
- [ ] IPC 를 추가했으면 `main.ts` / `preload.ts` / `bridge.ts` 3곳을 같이 고쳤다.
- [ ] 개인 계정·블로그 id·로컬 경로가 소스와 테스트에 없다.
- [ ] 되돌릴 수 없는 동작을 추가했으면 `run()` 안에 확인 게이트가 있다.
- [ ] `docs/STATE.md` 의 "남은 문제" 표에서 해결한 항목을 지웠다 (D11 과 겹치면 조율).
