# Kavranta 0.7.15 — Value-free diagnostics and visible project load failures

- Export a diagnostics report for a bug report. The report lists app and platform
  version, agent connection health, and per-project structure, variable names,
  presence, access policy, parser issue counts, and Git exposure counts.
- The report is built from an allowlist that has no field able to hold a value, and
  Rust writes it directly. Values and absolute folder paths cannot reach the file,
  and nested files are reduced to bare names so your folder layout is not reported.
- A project that fails to load is now marked in the project switcher and in the
  sidebar, so a broken project is visible before you open it instead of after.

The independently versioned Agent Bundle remains 2.6.0. This release adds no
background network access, sends nothing anywhere, and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.15 — 값 없는 진단 리포트와 프로젝트 오류 표시

- 버그 제보를 위한 진단 리포트를 내보냅니다. 앱·플랫폼 버전, AI 도구 연결
  상태, 프로젝트별 구조·변수 이름·값 존재 여부·접근 정책·파싱 경고 수·Git 노출
  개수를 담습니다.
- 리포트는 값을 담을 수 없는 필드가 없는 allowlist로 만들고 Rust가 직접
  기록합니다. 값과 절대 경로는 파일에 들어갈 수 없고, 중첩 파일은 이름만
  남겨 폴더 구조도 노출되지 않습니다.
- 로드에 실패한 프로젝트를 프로젝트 전환 화면과 사이드바에 표시해, 열기 전에
  미리 보이도록 했습니다.

독립적으로 버전 관리되는 Agent Bundle은 2.6.0입니다. 이 릴리스는 백그라운드 네트워크
접근을 추가하지 않고, 아무것도 전송하지 않으며, 값 되읽기도 없습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
