# Kavranta 0.7.6 — find the right variable, finish the first task

- Search the selected project by variable name, file path/display name, or group.
  Results keep each occurrence's file identity and never search values.
- Jump directly from the overview to the next missing variable. A project without
  discovered data files now shows setup and recovery guidance.
- Combine name/group/description search with the missing-values filter. Unsaved
  drafts survive filter changes; existing-value reveals are cleared when hidden,
  and late reveal responses cannot restore them.
- Try the EN/KO [interactive website](https://haechan1103.github.io/kavranta/) with
  synthetic file selections, explicit impact preview, and production unselected.
- Read the install-first guides and [90-day roadmap](https://github.com/haechan1103/kavranta/blob/main/ROADMAP.md).
- Update the development-only Vitest toolchain to 4.1.11 for
  [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9).

## Install

- macOS Apple Silicon: `aarch64.dmg`; Intel: `x64.dmg`. Both apps are Developer ID
  signed and notarized.
- macOS Homebrew: `brew install --cask haechan1103/tap/kavranta`.
- Windows 10/11 (x64 beta, unsigned): `x64-setup.exe`. SmartScreen may warn; download
  only from this official release. Organization policy may block unsigned apps.
- Existing installations can use the app's signed-update flow. The shared agent
  bundle remains 2.3.0; this update does not add broker permissions or storage formats.

No runtime migration, automatic links, background provider sync, or application
telemetry is introduced. The website is an illustration, not a real environment
editor. Native packages, provenance, and update metadata are verified by the release
workflow; external user-retention targets remain unmeasured.

---

# Kavranta 0.7.6 — 필요한 변수를 찾고 첫 작업을 끝내기

- 선택한 프로젝트의 변수명, 파일 경로·표시 이름, 그룹을 검색합니다. 같은
  이름의 변수도 파일별로 구분하며 값은 검색하지 않습니다.
- 개요에서 다음 빈 변수로 바로 이동합니다. 탐색된 데이터 파일이 없으면
  설정과 복구 방법을 안내합니다.
- 이름·그룹·설명 검색과 값 없음 필터를 함께 사용합니다. 필터를 바꿔도
  입력 중인 초안은 유지하고, 표시했던 기존 값은 숨기며 늦은 응답도 무효화합니다.
- [영어·한국어 웹 체험](https://haechan1103.github.io/kavranta/?lang=ko)에서
  샘플 파일을 직접 고르고 영향 범위를 확인할 수 있습니다. Production은 기본 선택하지 않습니다.
- 설치와 첫 작업을 앞세운 가이드, [90일 로드맵](https://github.com/haechan1103/kavranta/blob/main/ROADMAP.md)을 추가했습니다.
- 개발용 Vitest 도구를 4.1.11로 올려 파일 읽기 취약점 경고를 해소했습니다.

## 설치

- macOS: Apple Silicon은 `aarch64.dmg`, Intel은 `x64.dmg`를 선택하세요.
  두 앱 모두 Developer ID 서명과 공증을 거칩니다.
- Homebrew: `brew install --cask haechan1103/tap/kavranta`.
- Windows 10/11(x64 베타, 미서명): `x64-setup.exe`. SmartScreen 경고가 나타날 수
  있으며 조직 정책이 설치를 차단할 수 있습니다. 공식 릴리스의 파일만 사용하세요.
- 기존 앱의 서명된 업데이트 경로를 사용할 수 있습니다. 공통 AI 연동 번들은
  2.3.0을 유지하며 Broker 권한이나 저장 형식을 추가하지 않습니다.

런타임 변경, 자동 변수 연결, 백그라운드 Provider 동기화, 앱 텔레메트리는
추가하지 않았습니다. 웹 체험은 실제 파일을 편집하지 않는 예시입니다.
외부 사용자의 재사용 목표를 이미 달성했다고 주장하지 않습니다.
