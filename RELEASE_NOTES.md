# Kavranta 0.7.11 — Desktop secret input and variable guides

- Ask for missing secrets in the desktop app. A connected agent can request several
  values at once; the user types them in one window, and the agent receives only
  per-name outcomes.
- Store a short, value-free markdown guide for a variable. The app shows it from the
  variable row and from the input window, and opens http(s) links in the system browser.
- Scan a registered project for files an agent could read that may hold secrets.
  Results are paths, kinds, and dispositions only. User-allowed and managed files stay
  quiet.
- Agent Bundle 2.5.0 updates Codex, Claude Code, GitHub Copilot, Cursor, and OpenCode
  together. Use Update on each detected AI tool after installing this app.

This release adds no background network access and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.11 — 데스크톱 시크릿 입력과 변수 가이드

- 빠진 시크릿을 데스크톱 앱에서 받습니다. 연결된 에이전트가 여러 값을 한 번에
  요청하면 사용자가 한 창에서 입력하고, 에이전트는 이름별 결과만 받습니다.
- 변수에 값이 없는 짧은 마크다운 가이드를 저장합니다. 앱은 변수 행과 입력 창에서
  가이드를 보여주고, http(s) 링크는 시스템 브라우저로 엽니다.
- 등록 프로젝트에서 에이전트가 읽을 수 있는 시크릿 후보 파일을 점검합니다. 결과는
  경로, 종류, 처분뿐입니다. 사용자가 허용한 파일과 관리 파일은 조용히 둡니다.
- Agent Bundle 2.5.0은 Codex, Claude Code, GitHub Copilot, Cursor, OpenCode를 함께
  갱신합니다. 이 앱을 설치한 뒤 감지된 AI 도구마다 Update를 실행하세요.

이 릴리스는 백그라운드 네트워크 접근과 값 되읽기를 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
