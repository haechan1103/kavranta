# Kavranta 0.7.14 — One project can no longer hide the rest

- Loading projects no longer fails as a group. Each project loads independently, so a
  single unreadable folder can no longer empty every other project's view.
- The first-run onboarding screen now appears only when no project is registered.
  When a registered project fails to load, Kavranta names that project, shows the
  reason, and offers a retry, while the rest of the sidebar keeps working.
- A project that loads but contains no env files now shows its own project view
  instead of the registration screen.

The independently versioned Agent Bundle remains 2.6.0. This release adds no
background network access and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.14 — 프로젝트 하나가 나머지를 가리지 않음

- 프로젝트 로딩이 전체 일괄 실패하지 않습니다. 각 프로젝트가 독립적으로
  로드되어, 폴더 하나를 못 읽어도 다른 프로젝트 화면이 비워지지 않습니다.
- 첫 실행 안내 화면은 등록된 프로젝트가 진짜 없을 때만 나타납니다. 등록된
  프로젝트가 로드에 실패하면 그 프로젝트 이름과 사유를 보여주고 다시 시도할 수
  있으며, 사이드바의 나머지 프로젝트는 계속 사용할 수 있습니다.
- 로드는 되지만 env 파일이 없는 프로젝트는 등록 화면 대신 그 프로젝트의 빈
  화면을 보여줍니다.

독립적으로 버전 관리되는 Agent Bundle은 2.6.0입니다. 이 릴리스는 백그라운드 네트워크
접근과 값 되읽기를 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
