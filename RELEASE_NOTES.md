# Kavranta 0.7.9 — OpenCode detection and copy feedback

- Detect the OpenCode CLI from its install directory (`~/.opencode/bin`), so the
  AI tools screen finds it when the app is launched from Finder or the Dock
  instead of a shell.
- Show one shared copied or failed result for the key and value copy actions on
  each variable row.
- Hide the copy controls for redacted rows that do not expose a key or value.

The independently versioned Agent Bundle remains 2.4.0. This release adds no new
network access, value exposure, or provider behavior.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.9 — OpenCode 감지와 복사 피드백

- OpenCode CLI를 설치 경로(`~/.opencode/bin`)에서도 찾도록 했습니다. 셸이 아니라
  Finder나 Dock에서 앱을 실행해도 AI 도구 화면이 CLI를 감지합니다.
- 각 변수 행의 키·값 복사 동작에 복사 완료 또는 복사 실패 결과를 하나로
  표시합니다.
- 키나 값을 노출하지 않는 가려진 행에서는 복사 컨트롤을 숨깁니다.

독립적으로 버전 관리되는 Agent Bundle은 2.4.0입니다. 이 릴리스는 새로운 네트워크
접근, 값 노출, provider 동작을 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
