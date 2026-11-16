# Kavranta 0.7.21 — Actions you can save and replay

- **Actions work like an HTTP client.** Installed Packs sit in a side list with their
  method. The request bar shows the fixed method and URL with Send (⌘↵); each header
  picks a managed variable shown as `{{NAME}}`, and the matching variable is
  preselected. The URL, method and header names stay fixed by the Pack.
- **Body and response, finally visible.** Protocol 0.2 Packs get a Body tab, editable
  as fields or as one JSON object limited to the Pack's allowed fields, and a Response
  panel with status, duration and the projected output fields.
- **Saved requests and history.** Save a request by name (⌘S), find it under its Pack,
  overwrite or save as new, and see an unsaved-changes dot. The last 50 runs per
  project keep status, duration and output; copy a response as JSON or clear the
  history. Everything lives in local app data. Saving refuses a body that contains a
  managed value or a recognizable credential, and stored output is redacted again.
- **A calmer file table.** AI access is one icon (lock, open lock, question mark) with
  a small menu; links show an icon and a count; group actions are a plus and a pencil.
  Row state is a thin left rule instead of tinted rows, and the compare view, push
  review and source view drop their colored fills.
- **Agents can use body Packs.** The Agent Bundle 2.7.1 Skill lets a connected agent
  send allowlisted, non-secret body fields and report the projected output fields.

This release adds no network path: Actions still call only the fixed target an
installed Pack declares. Saved requests and history are never readable by agents. The
Agent Bundle is now **2.7.1**; reinstall or update the connection from AI tool
connections.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.21 — 저장하고 다시 보내는 자동 작업

- **자동 작업이 HTTP 클라이언트처럼 바뀌었습니다.** 설치한 Pack이 메서드와 함께 왼쪽
  목록에 나오고, 요청 줄에는 고정된 메서드와 주소, 보내기(⌘↵)가 있습니다. 헤더마다
  `{{변수명}}`으로 관리 변수를 고르며, 이름이 맞는 변수는 미리 선택됩니다. 주소, 메서드,
  헤더 이름은 Pack에 고정됩니다.
- **본문과 응답을 화면에서 다룹니다.** 프로토콜 0.2 Pack은 본문 탭에서 필드 또는 JSON으로
  편집하고(허용된 필드만), 응답 칸에서 상태, 걸린 시간, 응답 결과 필드를 봅니다.
- **요청 저장과 기록.** 요청에 이름을 붙여 저장(⌘S)하면 해당 Pack 아래에 나옵니다.
  덮어쓰기와 새로 저장, 저장하지 않은 변경 표시를 지원합니다. 프로젝트마다 최근 50번의
  실행 결과가 남고, 응답을 JSON으로 복사하거나 기록을 지울 수 있습니다. 모두 로컬 앱
  데이터에 저장되며, 관리 중인 값이나 키처럼 생긴 문자열이 든 본문은 저장을 거부하고
  저장되는 응답도 한 번 더 가립니다.
- **더 차분한 파일 표.** AI 접근은 아이콘 하나(자물쇠, 열린 자물쇠, 물음표)와 작은 메뉴로,
  연결은 아이콘과 숫자로, 그룹 동작은 +와 펜 아이콘으로 바뀌었습니다. 행 상태는 색칠 대신
  왼쪽 얇은 선으로 표시하고, 파일 비교·올리기 검토·파일 원문도 색 배경을 줄였습니다.
- **에이전트가 본문 있는 Pack을 씁니다.** Agent Bundle 2.7.1 Skill은 연결된 에이전트가
  허용된 비밀 아닌 본문 필드를 보내고 응답 결과 필드를 알려줄 수 있게 합니다.

이 릴리스는 새 네트워크 경로를 추가하지 않습니다. 자동 작업은 여전히 설치한 Pack이 선언한
고정 대상만 호출합니다. 저장한 요청과 기록은 에이전트가 읽을 수 없습니다. Agent Bundle은
**2.7.1**이며, AI 도구 연결 화면에서 연결을 업데이트하세요.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직 미서명
  상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
