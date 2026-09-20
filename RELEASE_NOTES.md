# Kavranta 0.7.10 — Credentialed API actions

- Add Action Protocol 0.2.0. A local Action Pack can now declare an allowlisted JSON
  request body and an allowlisted response projection for one fixed HTTPS endpoint.
- Let a connected agent call a credentialed API, such as a model gateway, and receive
  only the selected result fields. The API key is injected into the fixed request
  header and never reaches the agent, the plan, the result, or the audit record.
- Reject a request body that contains a bound secret, and scrub every projected value
  against the bound secrets. Request and response sizes are bounded.
- Keep Action Protocol v1 unchanged. A v2 clause is rejected on a v1 pack.

The independently versioned Agent Bundle remains 2.4.0. This release adds no
background network access and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.10 — 자격 증명 기반 API Action

- Action Protocol 0.2.0을 추가했습니다. 로컬 Action Pack이 하나의 고정 HTTPS
  엔드포인트에 대해 허용된 JSON 요청 본문과 허용된 응답 투영을 선언할 수 있습니다.
- 연결된 에이전트가 모델 게이트웨이 같은 자격 증명 기반 API를 호출하고 선택된 결과
  필드만 받도록 합니다. API 키는 고정 요청 헤더에만 주입되며 에이전트, 계획, 결과,
  감사 기록에는 전달되지 않습니다.
- 비밀 값이 포함된 요청 본문은 거부하고, 투영된 모든 값을 비밀 값과 대조해
  스크럽합니다. 요청·응답 크기에는 상한이 있습니다.
- Action Protocol v1은 변경되지 않습니다. v1 팩에 v2 절을 넣으면 거부됩니다.

독립적으로 버전 관리되는 Agent Bundle은 2.4.0입니다. 이 릴리스는 백그라운드 네트워크
접근과 값 되읽기를 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/kavranta/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
