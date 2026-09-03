# Ply

Playwright/CDP 로 바로 붙을 수 있는 커스텀 브라우저. Electron `WebContentsView` 로 탭을 만들고,
탭마다 세션 파티션을 분리해서 계정별 로그인 상태를 따로 유지한다. 안에 네이버 작업을 대신 하는
에이전트가 들어 있다.

> **먼저 읽을 것** — 이 앱은 네이버에 자동으로 로그인하고, 글을 쓰고, 지운다.
> 자동화 이용은 대상 서비스의 약관에 걸릴 수 있고 계정 제재로 이어질 수 있다.
> 위험은 전부 사용자가 진다. [DISCLAIMER.md](DISCLAIMER.md) 를 읽고 판단할 것.

## 에이전트

오른쪽 패널(`⌘J` / `Ctrl+J`)에 한국어로 적으면 도구를 골라 직접 실행한다.

```
myblog01 계정으로 강아지유치원 키워드 글 2개 초안 만들어줘
패키지 시트 노출체크 돌려줘
내일 날짜로 이 키워드들 4건 예약 걸어줘
```

두뇌는 OpenRouter 를 탄다. 기본값은 에이전트 `minimax/minimax-m2.5`, 원고 `deepseek/deepseek-v3.2` 이고
패널 설정에서 바꾼다. API 키는 `safeStorage` 로 암호화해 이 기기에만 저장한다.

값이 모자라면 지어내지 않고 `ask_user` 로 되묻는다. 원고 스타일, 발행 날짜, 계정, 하루 몇 건인지가 여기 해당한다.

### 도구

19개다.

| 도구 | 하는 일 | 필요한 것 |
| --- | --- | --- |
| `ask_user` | 부족한 값을 사용자에게 되묻는다 | 없음 |
| `list_accounts` / `check_login` / `naver_login` | 계정 확인, 세션 점검, 로그인 | 없음 |
| `generate_manuscript` | OpenRouter 로 원고 생성 | OpenRouter 키 |
| `publish_blog_post` | 스마트에디터를 몰아 실제 발행 | 없음 |
| `list_my_posts` / `delete_blog_posts` | 내 글 목록 조회, **글 삭제** | 없음 |
| `list_services` / `open_service` | 등록해 둔 서비스 목록, 탭으로 열기 | 없음 |
| `open_tab` | 임의 URL 을 탭으로 연다 | 없음 |
| `check_services` | 아래 연동 서비스가 켜져 있는지 확인 | 없음 |
| `dabut_login` / `list_dabut_projects` / `generate_manuscript_dabut` | 원고 생성 백엔드 로그인·프로젝트·원고 | 원고 생성 백엔드 |
| `list_scheduler_accounts` / `auto_schedule_posts` | 스케줄러 계정 조회, 예약 발행 등록 | 블로그 스케줄러 |
| `list_exposure_jobs` / `run_exposure_check` | 노출체크 작업 목록, 실행 | 노출체크 저장소 + pnpm |

`delete_blog_posts` 는 되돌릴 수 없어서 프롬프트가 아니라 코드로 막아 뒀다. 같은 실행에서
`list_my_posts` 가 돌려준 logNo 만 받고, 승인 토큰 정확일치 전에는 탭도 열지 않는다.
전체 방어 목록은 [docs/STATE.md](docs/STATE.md) 에 있다.

### 연동 서비스

| 기능 | 서비스 | 기본 주소 |
| --- | --- | --- |
| 원고 생성(고품질) | 원고 생성 백엔드 | `http://127.0.0.1:8000` |
| 예약 발행 | 블로그 스케줄러 | `http://127.0.0.1:3000` |
| 노출체크 | 노출체크 저장소 | 패널 설정에서 경로 지정 |

**이 서비스들은 없어도 된다.** 핵심 흐름(계정 등록 → 로그인 → 원고 생성 → 블로그 글쓰기)은
OpenRouter 키 하나만 있으면 외부 서비스 없이 전부 돈다. 예약 발행과 노출체크만 위 서비스를 요구하고,
그건 이 저장소에 들어 있지 않은 별도의 비공개 프로젝트다. 주소는 패널 설정에서 직접 넣는다.

`src/services.ts` 의 주소는 전부 `example.com` 플레이스홀더다. 자기 주소로 바꿔서 쓴다.

## 왜 만들었나

네이버 자동화 작업은 로그인 상태가 살아있는 실제 브라우저에서 돌려야 결과가 맞는다. 지금까지는
OpenClaw 프로필을 계정별로 띄워두고 `connectOverCDP` 로 붙었는데, 프로필 관리와 창 전환이 전부 바깥에
있어서 어떤 창이 어느 계정인지 매번 확인해야 했다. 이 브라우저는 그 두 가지를 한 앱 안으로 가져온다.
탭 하나가 곧 계정 하나고, 자동화 스크립트는 같은 CDP 엔드포인트에 붙어서 그 탭을 그대로 조작한다.

## 필요한 것

| 항목 | 내용 |
| --- | --- |
| Node | 22 이상 (소스에서 빌드할 때만) |
| OpenRouter API 키 | [openrouter.ai/keys](https://openrouter.ai/keys) 에서 발급. 에이전트가 이걸로 돈다 |

키는 `safeStorage`(macOS Keychain / Windows DPAPI)로 암호화해서 그 기기에만 저장한다. 어디로도 보내지 않는다.

## 설치

### 받아서 설치

[Releases](https://github.com/ganggyunggyu/ply/releases) 에서 받는다.

| 플랫폼 | 파일 |
| --- | --- |
| macOS (Apple Silicon) | `Ply-mac-arm64.dmg` |
| macOS (Intel) | `Ply-mac-x64.dmg` |
| Windows 10/11 64-bit | `Ply-Setup-win-x64.exe` |

**코드 서명이 없다.** 그래서 처음 열 때 한 번 막힌다.

- macOS: `xattr -dr com.apple.quarantine "/Applications/Ply.app"`.
  터미널이 싫으면 한 번 실행해 경고를 띄운 뒤 **시스템 설정 → 개인정보 보호 및 보안** 맨 아래
  **"그래도 열기"**. macOS 15 부터는 우클릭 → 열기 우회가 서명 없는 앱에 더는 안 통한다.
- Windows: SmartScreen 경고에서 **추가 정보 → 실행**.

자세한 건 [docs/INSTALL.md](docs/INSTALL.md).

### 소스에서 빌드

```bash
npm ci
npm run dist        # out/ 에 설치 파일 생성
```

macOS 에서는 아래 한 줄로 빌드와 `/Applications` 설치를 같이 한다. **macOS 전용 스크립트다.**
Windows 에서는 `npm run dist` 로 만든 뒤 직접 설치한다.
빌드와 릴리스는 macOS 와 Windows 만 챙긴다. Linux 는 Electron 이 도니까 소스에서 돌아가겠지만
빌드 타깃도 CI 도 없고 확인한 적도 없다.

```bash
npm run install:app
```

## 개발 중 실행

코드를 고쳐가며 확인할 때는 설치 없이 바로 띄운다.

```bash
npm run dev
```

기본 CDP 포트는 `18830`. OpenClaw 가 쓰는 `18828` 과 겹치지 않게 잡아뒀다.

```bash
PLY_CDP_PORT=19000 npm run dev   # 포트 변경
PLY_CDP_PORT=0 npm run dev       # CDP 끄기
```

## 자동화 붙이기

브라우저를 켠 상태에서:

```bash
node scripts/attach.mjs
```

기존 스크립트도 엔드포인트만 바꾸면 그대로 돌아간다.

```ts
const browser = await chromium.connectOverCDP('http://127.0.0.1:18830');
const [context] = browser.contexts();
```

## 프로필 (계정 격리)

툴바 오른쪽 셀렉트에서 프로필을 고르면 그 프로필로 새 탭이 열린다. `+` 로 프로필을 추가한다.
각 프로필은 Electron 세션 파티션 `persist:<id>` 로 매핑되고, 쿠키와 로컬 스토리지가 완전히 분리된다.
프로필 목록은 `~/Library/Application Support/ply/config/profiles.json` 에 저장된다.
이전 이름의 앱에서 처음 넘어올 때는 설정과 프로필 목록만 자동으로 복사한다. 세션과 쿠키는 옮기지
않으므로 프로필마다 네이버에 한 번씩 다시 로그인해야 한다.

## 단축키

| 키 | 동작 |
| --- | --- |
| `⌘T` | 새 탭 |
| `⌘J` | 에이전트 패널 여닫기 |
| `⌘W` | 탭 닫기 |
| `⌘L` | 주소창 포커스 |

## 테스트

```bash
npm test        # tsx --test
npm run check   # typecheck + test
```

Electron 이 없어도 돌도록 저장과 암복호화를 주입으로 뺐다. `createAccountStore({ filePath, crypto })` 형태라
가짜 crypto 로 저장 로직 전체를 검증한다.

## 구조

```text
src/
├── main.ts         Electron 메인. BaseWindow + 크롬 뷰 + 패널 뷰 + IPC
├── preload.ts      렌더러에 노출하는 gngBrowser 브리지
├── bridge.ts       메인과 렌더러가 같이 쓰는 브리지 타입 (한 곳에서만 정의)
├── tabs.ts         WebContentsView 탭 매니저
├── profiles.ts     세션 파티션 프로필 저장소
├── accounts.ts     네이버 계정 저장소 (safeStorage 주입)
├── settings.ts     API 키와 모델 설정 저장소
├── models.ts       OpenRouter 모델 프리셋과 단가
├── openrouter.ts   OpenRouter 클라이언트와 도구 호출 루프
├── agent-tools.ts  에이전트 도구 정의와 시스템 프롬프트
├── naver.ts        네이버 로그인과 스마트에디터 조작 (CDP Playwright)
├── hub.ts          다붓 / 스케줄러 / 노출지기 연동
├── url.ts          주소창 입력 정규화
├── constants.ts    창 크기, 크롬 높이, 기본 포트
├── renderer.*      상단 툴바 UI (뒤로/앞으로/주소창)
├── sidebar.*       왼쪽 세로 탭 사이드바 (프로필 스위처 + 에이전트 탭 그룹)
└── panel.*         에이전트 패널 UI
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/STATE.md](docs/STATE.md) | 현재 상태, 검증된 것, 남은 문제 |
| [docs/INSTALL.md](docs/INSTALL.md) | 다른 컴퓨터에 설치하는 방법 |
| [AGENT.md](AGENT.md) | 이 저장소 작업 규칙 |
| [DISCLAIMER.md](DISCLAIMER.md) | 면책 고지 |
| [site/index.html](site/index.html) | 소개 및 다운로드 페이지 |

## 패키징과 릴리스

```bash
npm run dist        # 현재 플랫폼 설치 파일 생성
npm run install:app # 빌드 후 /Applications 에 설치 (macOS 전용)
```

`v` 로 시작하는 태그를 밀면 `.github/workflows/release.yml` 이 macOS dmg 2종과 Windows setup.exe 를
만들어 GitHub 릴리스에 올린다. 태그 버전과 `package.json` 의 `version` 이 다르면 워크플로가 멈춘다.

```bash
npm version 0.2.0 --no-git-tag-version
git commit -am "0.2.0" && git tag v0.2.0 && git push origin main --tags
```

파일명에는 버전이 들어가지 않는다. `releases/latest/download/<파일명>` 링크가 버전을 올려도
안 깨지게 하려는 것이고, `site/index.html` 의 다운로드 버튼이 그 링크를 쓴다.
첫 릴리스를 올린 뒤에는 `site/index.html` 의 `RELEASE.published` 를 `true` 로 바꾼다.

**`build.win.target` 의 `arch` 는 하나로 유지한다.** electron-builder 는 한 플랫폼에서 arch 를
둘 이상 만들면 `artifactName` 의 `-${arch}` 를 통째로 지운다. `ia32` 를 하나 추가하는 순간
산출물이 `Ply-Setup-win.exe` 가 되고 소개 페이지의 다운로드 링크가 404 가 된다.
`src/release-assets.test.ts` 가 이걸 포함해 `package.json` · `site/index.html` · README ·
`docs/INSTALL.md` 의 파일명과 버전 표기가 어긋나는지 대조한다.

아이콘 원본은 `build-resources/icon.iconset` 에 있고, `iconutil -c icns build-resources/icon.iconset -o build-resources/icon.icns`
로 다시 만든다.

## 라이선스

[MIT](LICENSE). 있는 그대로 제공되고 아무 보증도 없다. [DISCLAIMER.md](DISCLAIMER.md) 를 같이 읽을 것.
