# Kavranta 0.7.19 — Dependency security fixes

- **Three dependency advisories are resolved.** `aws-smithy-json` reached `0.61.9` through
  the AWS SDK crates the provider push uses, and the advisory covers `<= 0.62.6`. Because
  those crates were pinned to exact versions, the fix moves the pins: `aws-config` `1.12.0`,
  `aws-sdk-secretsmanager` `1.120.0`, `aws-sdk-ssm` `1.128.0`, `aws-sdk-kms` `1.123.0`,
  `aws-sdk-sts` `1.119.0`. The tree now resolves to a single `aws-smithy-json 0.63.1`, past
  the patched `0.62.7`. `rustls` moved to `0.23.45` for its TLS 1.3 advisory. A
  `source-map-js` override pins `^1.2.2`; that one is build- and test-time only and never
  ships.
- **Dependency auditing now runs in CI.** A daily schedule, a lockfile push to `main`, and a
  manual run check `cargo audit` over `Cargo.lock` and `npm audit --audit-level=high` over
  `package-lock.json`. The existing dependency review only inspects the packages a pull
  request adds, so an advisory published later against a dependency that has been present
  for months was invisible. These three arrived that way and were reported by email instead
  of by a failing build. That is what changed.

This release changes no application behavior beyond the dependency versions. It adds no
background network access, sends nothing anywhere, and no value readback. The Agent Bundle
remains **2.7.0**.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.19 — 의존성 보안 수정

- **의존성 권고 3건을 해결했습니다.** `aws-smithy-json`이 provider 푸시에 쓰는 AWS SDK
  크레이트를 통해 `0.61.9`로 들어왔고, 권고 범위는 `<= 0.62.6`이었습니다. 해당 크레이트가
  정확 버전으로 고정돼 있어 핀을 올렸습니다: `aws-config` `1.12.0`,
  `aws-sdk-secretsmanager` `1.120.0`, `aws-sdk-ssm` `1.128.0`, `aws-sdk-kms` `1.123.0`,
  `aws-sdk-sts` `1.119.0`. 이제 `aws-smithy-json 0.63.1` 단일 버전으로 해석되며, 패치된
  `0.62.7`을 넘습니다. `rustls`는 TLS 1.3 권고로 `0.23.45`가 되었습니다.
  `source-map-js`는 `^1.2.2`로 고정했으며, 이 패키지는 빌드·테스트 전용이라 배포물에
  포함되지 않습니다.
- **의존성 감사가 CI에서 돌아갑니다.** 매일 스케줄, `main`으로의 lockfile push, 수동
  실행에서 `Cargo.lock`에 대한 `cargo audit`과 `package-lock.json`에 대한
  `npm audit --audit-level=high`를 수행합니다. 기존 dependency review는 pull request가
  추가한 패키지만 검사하므로, 수개월 전부터 있던 의존성에 나중에 공개된 권고는 보이지
  않았습니다. 이번 3건이 정확히 그 경로로 왔고, 실패한 빌드가 아니라 이메일로
  보고되었습니다. 그것을 바꿨습니다.

이 릴리스는 의존성 버전 외에 애플리케이션 동작을 바꾸지 않습니다. 백그라운드 네트워크
접근을 추가하지 않고, 아무것도 전송하지 않으며, 값 되읽기도 없습니다. Agent Bundle은
**2.7.0**으로 유지됩니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직 미서명
  상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
