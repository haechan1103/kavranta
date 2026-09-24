# Kavranta 0.7.13 — Measured scans and a leakproof check

- The exposure scan now reports its own cost: files examined, milliseconds taken,
  and the standing zero-values-read claim on one line.
- One button proves zero leaks at runtime. Five synthetic canary secrets run
  through inspect, exposure scan, redacted reads, inspect-after-write, and guide
  roundtrip in an isolated temporary project, then report passed checks and
  duration. No registry, audit log, or real project is touched.

The independently versioned Agent Bundle remains 2.6.0. This release adds no
background network access and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.13 — 측정되는 점검과 유출 증명

- 노출 점검이 비용을 스스로 보고합니다. 본 파일 수, 걸린 시간, 읽은 값 0개를
  한 줄로 표시합니다.
- 버튼 하나로 실행 중 유출 없음을 증명합니다. 합성 카나리아 비밀 5개가 확인,
  노출 점검, 가려진 읽기, 쓰기 후 재확인, 가이드 왕복을 격리된 임시 프로젝트에서
  통과한 뒤 통과 수와 시간을 보고합니다. 레지스트리, 감사 로그, 실제 프로젝트는
  건드리지 않습니다.

독립적으로 버전 관리되는 Agent Bundle은 2.6.0입니다. 이 릴리스는 백그라운드 네트워크
접근과 값 되읽기를 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
