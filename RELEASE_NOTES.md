# Kavranta 0.7.7 — fix source-edit Guard false positives

- Recognize Codex's actual `apply_patch` input in `tool_input.command`, structured
  patch aliases, and freeform tool input. Ordinary source files may mention env
  filenames without being mistaken for edits to those env files.
- Keep real env-data add, update, delete, and move targets blocked. Mixed payloads,
  incomplete or nested patches, and shell-wrapped commands retain conservative
  checks; a shell command cannot claim the source-patch exemption.
- Add regression coverage for Prisma-style TypeScript tests, SQL migrations, Rust,
  and Swift source, including subprocess checks that never echo fixture content.

## Install and refresh AI connections

- macOS Apple Silicon: `aarch64.dmg`; Intel: `x64.dmg`. Both apps are Developer ID
  signed and notarized.
- macOS Homebrew: `brew install --cask haechan1103/tap/kavranta`.
- Windows 10/11 (x64 beta, unsigned): `x64-setup.exe`. SmartScreen may warn; download
  only from this official release. Organization policy may block unsigned apps.
- Existing installations can use the app's signed-update flow. The shared agent
  bundle remains 2.3.0; the corrected Broker ships with app version 0.7.7.
- After updating Kavranta, open **AI connections** and repair or update the host
  connection if prompted. Start a new agent conversation or reload the host window:
  an already-running session can retain its old versioned Guard command even when
  the current plugin configuration has changed.

This update does not grant value access, weaken env-template protection, change
storage formats, or introduce background provider access. Native packages,
provenance, and update metadata are verified by the release workflow. Guard checks
remain defense in depth, not a claim of complete operating-system isolation.

---

# Kavranta 0.7.7 — 일반 소스 편집 보호 훅 오탐 수정

- Codex가 실제로 전달하는 `tool_input.command`, 구조화된 패치 별칭, 문자열
  입력을 인식합니다. 일반 소스에 env 파일명이 언급됐다는 이유만으로 실제 env
  파일을 편집하는 작업으로 오인하지 않습니다.
- 실제 env 데이터 파일의 추가·수정·삭제·이동은 계속 차단합니다. 여러 입력이
  섞이거나 패치가 불완전·중첩된 경우, 셸로 감싼 명령은 보수적으로 검사합니다.
  셸 명령에는 소스 패치 예외를 적용하지 않습니다.
- Prisma 형태의 TypeScript 테스트, SQL 마이그레이션, Rust·Swift 소스에 대한
  회귀 검사를 추가했습니다. 프로세스 검사에서도 테스트 입력 내용을 반환하지 않습니다.

## 설치 및 AI 연결 갱신

- macOS: Apple Silicon은 `aarch64.dmg`, Intel은 `x64.dmg`를 선택하세요.
  두 앱 모두 Developer ID 서명과 공증을 거칩니다.
- Homebrew: `brew install --cask haechan1103/tap/kavranta`.
- Windows 10/11(x64 베타, 미서명): `x64-setup.exe`. SmartScreen 경고가 나타날 수
  있으며 조직 정책이 설치를 차단할 수 있습니다. 공식 릴리스의 파일만 사용하세요.
- 기존 앱의 서명된 업데이트 경로를 사용할 수 있습니다. 공통 AI 연동 번들은
  2.3.0을 유지하며 수정된 Broker는 앱 0.7.7에 포함됩니다.
- Kavranta 업데이트 후 **AI 도구 연결**에서 안내에 따라 연결을 복구·업데이트하고
  새 에이전트 대화를 시작하거나 호스트 창을 다시 여세요. 이미 실행 중인 세션은
  플러그인 설정이 바뀌어도 이전 버전의 보호 훅 실행 경로를 유지할 수 있습니다.

값 읽기 권한, env 템플릿 보호 정책, 저장 형식은 바꾸지 않았으며 백그라운드
Provider 접근도 추가하지 않았습니다. 보호 훅은 보조 방어 수단이며 완전한
운영체제 격리를 보장한다는 뜻이 아닙니다.
