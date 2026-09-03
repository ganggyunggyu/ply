# 다른 컴퓨터에 설치하기

## 1. 받은 파일로 설치

[Releases](https://github.com/ganggyunggyu/ply/releases) 에서 자기 플랫폼 파일을 받는다.
파일명에 버전이 들어가지 않으므로 새 버전이 나와도 이름은 그대로다.

| 플랫폼 | 파일 |
| --- | --- |
| macOS (Apple Silicon) | `Ply-mac-arm64.dmg` |
| macOS (Intel) | `Ply-mac-x64.dmg` |
| Windows 10/11 64-bit | `Ply-Setup-win-x64.exe` |

어느 맥인지 모르겠으면 애플 메뉴 → **이 Mac에 관하여**. 칩 이름이 `Apple M...` 이면 Apple Silicon,
`Intel...` 이면 Intel 이다. 반대쪽을 받으면 설치는 되고 실행만 안 된다.

### macOS

1. 위 표에서 자기 칩에 맞는 `.dmg` 를 받아서 연다.
2. `Ply.app` 을 `응용 프로그램` 으로 드래그한다.
3. 서명을 붙이지 않아서 처음 열 때 막힌다. 격리 속성을 지우는 게 가장 확실하다.

```bash
xattr -dr com.apple.quarantine "/Applications/Ply.app"
```

터미널을 쓰기 싫으면 한 번 실행해서 차단 경고를 띄운 뒤,
**시스템 설정 → 개인정보 보호 및 보안** 맨 아래의 **"그래도 열기"** 를 누른다.
macOS 15 부터는 우클릭 → 열기 우회가 서명 없는 앱에는 더 이상 동작하지 않는다.

### Windows

1. `Ply-Setup-win-x64.exe` 를 받아서 실행한다.
2. SmartScreen 경고가 뜨면 **추가 정보 → 실행** 을 누른다. 서명이 없어서 나오는 경고다.
3. 설치 경로를 고를 수 있다. 기본값 그대로 두면 된다.

## 2. 소스에서 직접 빌드

Node 22 이상이 필요하다.

```bash
git clone <저장소 주소> ply
cd ply
npm ci
npm run dist
```

`out/` 에 설치 파일이 생긴다. macOS 에서는 아래 한 줄로 빌드와 설치를 같이 한다.

```bash
npm run install:app
```

macOS 에서 Windows 설치 파일까지 만들려면 wine 이 필요하다. 그냥 GitHub Actions 를 쓰는 게 편하다.
`v` 로 시작하는 태그를 밀면 `.github/workflows/release.yml` 이 macOS 와 Windows 설치 파일을 같이 만든다.

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## 3. 첫 실행 설정

1. 앱을 열고 오른쪽 위 `◧` 버튼(또는 `⌘J` / `Ctrl+J`)으로 에이전트 패널을 연다.
2. **OpenRouter API 키** 를 넣고 저장한다. 키는 [openrouter.ai](https://openrouter.ai/keys) 에서 만든다.
   키는 OS 키체인(macOS Keychain, Windows DPAPI)으로 암호화해서 그 기기에만 저장된다. 어디로도 전송되지 않는다.
3. 에이전트 모델과 원고 모델을 고른다. 기본값은 MiniMax M2.5 와 DeepSeek V3.2 다.
4. 네이버 계정을 추가한다. 비밀번호는 선택이다. 비워두면 로그인 창에서 직접 입력하게 된다.

이전 이름의 앱에서 업데이트했다면 첫 실행 때 설정 파일만 자동으로 복사하고 옛 파일은 백업으로 남긴다.
브라우저 세션과 쿠키는 복사하지 않으므로 각 프로필에서 네이버에 한 번씩 다시 로그인해야 한다.

## 4. 연동 서비스

에이전트가 부르는 외부 서비스는 그 컴퓨터에서 같이 돌고 있어야 한다.

| 기능 | 필요한 서비스 | 기본 주소 |
| --- | --- | --- |
| 원고 생성(고품질) | 다붓 백엔드 | `http://127.0.0.1:8000` |
| 예약 발행 | 블로그 스케줄러 서버 | `http://127.0.0.1:3000` |
| 노출체크 | 노출지기 저장소 | 로컬 경로 |

서비스가 꺼져 있으면 에이전트가 `check_services` 로 확인해서 알려준다.
원고 생성은 다붓이 없어도 OpenRouter 로 대체해서 돌아간다.

이 서비스들은 각자 다시 외부 의존이 있다. 해당 저장소의 `.env` 를 먼저 맞춰야 뜬다.

| 서비스 | 추가로 필요한 것 |
| --- | --- |
| 블로그 스케줄러 | MongoDB, Redis, 구글 서비스계정 |
| 다붓 백엔드 | MongoDB, LLM API 키 |
| 노출지기 | MongoDB, 구글 서비스계정, pnpm |

### 서비스 없이도 되는 기능

계정 등록, 로그인, 블로그 글쓰기, 원고 생성(OpenRouter)은 외부 서비스 없이 동작한다.
예약 발행과 노출체크만 위 서비스를 요구한다.

## 5. 데이터가 저장되는 위치

| 내용 | macOS | Windows |
| --- | --- | --- |
| 프로필 세션(쿠키) | `~/Library/Application Support/ply` | `%APPDATA%\ply` |
| 계정 / 설정 | 같은 폴더의 `config/` | 같은 폴더의 `config\` |
| 프로필 목록 | `~/Library/Application Support/ply/config/profiles.json` | `%APPDATA%\ply\config\profiles.json` |

비밀번호와 API 키는 `config/` 안에 암호문으로만 들어간다. 평문으로 저장하지 않는다.
파일을 다른 기기로 복사해도 그쪽 키체인 키가 달라서 복호화되지 않는다. 새 기기에서는 다시 입력해야 한다.
