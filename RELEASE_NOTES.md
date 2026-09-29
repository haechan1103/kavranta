# Kavranta 0.7.17 — Clearer row actions, filters, and a calmer exposure scan

- Move and delete are now icon buttons with a comfortable target, and the close
  control in every dialog is a real icon with a larger hit area. The labels you
  relied on before are still there for screen readers and tooltips.
- The missing-value filter and the search field are separate cards. The filter says
  whether it is applied, using its filled surface, tinted icon, and an `On`/`Off` state,
  so you no longer have to infer the state from a subtle tint. The redundant "showing N
  of M" line and the "show all variables" button are gone; the filter card turns itself
  off, and the search field clears on its own.
- A project that fails to load now shows a small badge next to its name instead of an
  extra line under the path.
- Removed the stray `LOCAL · OS PROTECTED` line above the account heading. It was
  hardcoded English and was never translated.
- Agent session transcripts are no longer part of the exposure scan. A coding agent
  reading its own transcript is normal operation rather than something you can act
  on, and reporting every file buried the findings you can act on under hundreds of
  identical rows. Shell history and global MCP config are still scanned, and the scan
  still never reads or returns a value. This is a deliberate scope reduction, recorded
  in ADR-0035: it is not a claim that transcripts are safe. If a secret ever leaks
  through a transcript, that directory remains readable at `~/.codex/sessions`.

The independently versioned Agent Bundle remains 2.6.0. This release adds no
background network access, sends nothing anywhere, and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.17 — 행 액션과 필터 정리, 노이즈 줄인 노출 스캔

- 이동과 삭제를 아이콘 버튼으로 바꾸고, 모든 대화상자의 닫기 버튼을 더 큰
  아이콘과 넓은 클릭 영역으로 교체했습니다. 스크린리더와 툴팁용 이름은 그대로
  유지됩니다.
- "값 없는 변수만" 필터와 검색창을 서로 다른 카드로 분리했습니다. 필터는
  활성화된 상태를 직접 표시합니다. 배경, 아이콘 배지, `적용 중`/`꺼짐` 상태로
  구분되므로 은은한 색 차이를 읽지 않아도 됩니다. 중복 정보였던 `전체 N개 중 M개
  표시` 문구와 `모든 변수 보기` 버튼은 제거했습니다. 필터 카드를 누르면 꺼지고,
  검색창은 스스로 비워집니다.
- 로드에 실패한 프로젝트가 경로 아래 별도 줄이 아니라 이름 옆 작은 뱃지로
  표시됩니다.
- 계정 화면 제목 위에 있던 `LOCAL · OS PROTECTED` 문구를 제거했습니다. 영문
  하드코딩이었고 번역된 적이 없었습니다.
- 노출 스캔에서 에이전트 세션 기록을 제외했습니다. 에이전트가 자기 세션
  기록을 읽는 것은 정상 동작이지 조치할 수 있는 발견이 아니었고, 파일별로
  보고하면 조치 가능한 항목이 수백 줄의 반복 항목에 묻혔습니다. 셸
  히스토리와 전역 MCP 설정은 계속 검사하며, 스캔은 여전히 값을 읽거나
  반환하지 않습니다. 이는 의도적인 범위 축소이며 ADR-0035에 기록했습니다.
  트랜스크립트가 안전하다는 뜻은 아닙니다. 시크릿이 세션 기록을 통해
  유출된다면 `~/.codex/sessions`는 그대로 읽을 수 있는 상태로 남습니다.

독립적으로 버전 관리되는 Agent Bundle은 2.6.0입니다. 이 릴리스는 백그라운드 네트워크
접근을 추가하지 않고, 아무것도 전송하지 않으며, 값 되읽기도 없습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
