# Kavranta 0.7.8 — OpenCode integration

- Add OpenCode to the AI tools screen with the same redacted, approval-based
  Kavranta Broker workflow used by the other supported coding agents.
- Install the shared `kavranta-env` Skill, a local MCP connection, and a fail-closed
  Guard plugin through OpenCode's documented global configuration interfaces.
- Refuse to overwrite an unrelated `kavranta` MCP entry, plugin, Skill, or malformed
  global configuration. Existing app-owned files can be repaired or upgraded.
- Report the connection as configured—not active—until a newly started OpenCode
  process loads it. Restart OpenCode after installation or an update.
- Bound Guard input, output, and execution time; block the tool call with a
  value-free error if the Broker is missing, times out, or returns an invalid
  decision.

The independently versioned Agent Bundle is now 2.4.0. This release does not grant
OpenCode broader access than other hosts, register arbitrary projects, read values
into the UI, or add background network access.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.8 — OpenCode 연동

- 다른 지원 코딩 에이전트와 같은 값 비노출·승인 기반 Kavranta Broker 흐름을
  OpenCode에서도 사용할 수 있도록 AI 도구 화면에 OpenCode를 추가했습니다.
- OpenCode가 문서화한 전역 설정 인터페이스로 공용 `kavranta-env` Skill, 로컬
  MCP 연결, 실패 시 차단되는 Guard 플러그인을 설치합니다.
- 다른 주체가 만든 동일 이름의 `kavranta` MCP 항목·플러그인·Skill 또는 손상된
  전역 설정을 덮어쓰지 않습니다. 앱이 소유한 기존 파일만 복구·업데이트합니다.
- 새 OpenCode 프로세스가 구성을 읽기 전에는 활성화됐다고 주장하지 않고
  `구성됨`으로 표시합니다. 설치 또는 업데이트 뒤 OpenCode를 다시 시작하세요.
- Guard 입력·출력·실행 시간을 제한하고 Broker 누락·시간 초과·잘못된 응답은
  값이 없는 오류와 함께 도구 호출을 차단합니다.

독립적으로 버전 관리되는 Agent Bundle은 2.4.0입니다. 이 릴리스는 OpenCode에
다른 호스트보다 넓은 권한을 주거나, 임의 프로젝트를 등록하거나, 값을 UI로
읽거나, 백그라운드 네트워크 접근을 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
