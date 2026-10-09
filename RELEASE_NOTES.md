# Kavranta 0.7.18 — Diagnostics that name the cause

- **A malformed tool call now says which argument is wrong.** Every tool schema rejects
  unexpected fields, but a single generic sentence was returned for an unexpected field, a
  missing field, a wrong type, and a misspelled key alike. A coding agent that added one
  extra field was told only that the arguments were invalid, and reasonably concluded the
  tool was broken and the capability did not exist. The message now names the argument, and
  a type failure is reported without echoing the submitted value.
- **A broker that cannot run is named separately from a repair that is merely due.** These
  were the same badge. The first means the Guard runs and the paths are stale; the second
  means the Guard cannot start at all, so guarded file tools fail closed and the app looks
  broken. The second is now named, with what it means and what to do.
- **A link that fails to open now says so.** Clicking a guide link could do nothing with no
  explanation: the desktop opener's exit status was discarded and the renderer swallowed the
  rejection, so a link that never opened looked exactly like one that did. Failures are
  reported, and the URL stays in the anchor so it can be copied.
- **A pasted value in descriptive text is flagged.** A value pasted into a variable
  description, a group name, or guide prose is stored in the project manifest, rendered, and
  eligible for a commit. The plan summary now names the rule that matched, and the write is
  never blocked. Detection reads no value: it is pattern matching over text you already
  typed. Secret shapes live in `config/secret-patterns.json`, shared with the repository
  boundary scan so the warning and the commit-time guard cannot drift apart.
- **Deployment destinations can be recorded and reused.** A project can record where it
  deploys, and a later push reuses that destination and names it in the plan for review.
  Recording supplies where, never whether: it is a reviewed plan like any other mutation,
  it pushes nothing, and a push still needs its own plan and approval.
- **OpenCode repair no longer deadlocks.** `opencode.json` and `opencode.jsonc` are both
  valid config names and either can hold a `kavranta` entry. Ownership is now decided per
  entry by shape rather than by how many entries exist, so the configuration that used to
  report a permanent conflict is recognised as Kavranta's own.

The Agent Bundle is now **2.7.0** (was 2.6.0) for the recorded-deployment-target
capability. This release adds no background network access, sends nothing anywhere, and no
value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.18 — 원인을 밝히는 진단

- **잘못된 도구 호출이 어느 인자가 문제인지 알려줍니다.** 모든 도구 스키마가 예상 밖
  필드를 거부하는데, 초과 필드·누락 필드·형식 오류·키 이름 오타에 모두 같은 문장이
  돌아왔습니다. 초과 필드 하나를 넣은 에이전트는 "인자가 올바르지 않다"는 말만 듣고
  도구가 깨졌다고 판단했습니다. 이제 문제 인자를 이름으로 알려주며, 형식 오류는 제출된
  값을 되돌려주지 않습니다.
- **실행할 수 없는 broker를 단순 복구 필요와 구분합니다.** 이전에는 같은 배지였습니다.
  하나는 Guard가 돌지만 경로가 낡은 상태이고, 다른 하나는 Guard가 아예 시작하지 못해
  파일 접근 도구가 차단되면서 앱이 고장난 것처럼 보이는 상태입니다. 후자를 이름으로
  표시하고, 그 의미와 할 일을 안내합니다.
- **열리지 않는 링크가 이제 이유를 표시합니다.** 가이드 링크를 눌러도 아무 일이 없을 수
  있었습니다. 데스크톱 opener의 종료 상태가 버려지고 렌더러가 실패를 삼켜서, 안 열리는
  링크와 열리는 링크가 똑같이 보였습니다. 실패를 알리고, 주소는 복사할 수 있게 남깁니다.
- **설명 텍스트에 붙여넣은 값이 표시됩니다.** 변수 설명·그룹 이름·가이드 본문에 붙여넣은
  값은 프로젝트 manifest에 저장되고 화면에 표시되며 커밋 대상이 됩니다. 이제 plan
  요약이 일치한 규칙 이름을 알려주고, 쓰기는 차단되지 않습니다. 탐지는 값을 읽지
  않습니다 — 이미 입력한 텍스트에 대한 패턴 매칭입니다. 비밀 형태는
  `config/secret-patterns.json`에 있어 저장소 경계 검사와 공유되므로, 경고와 커밋 시
  방어가 어긋날 수 없습니다.
- **배포 대상을 기록하고 재사용할 수 있습니다.** 프로젝트가 배포 위치를 기록하면 이후
  푸시가 그 대상을 재사용하고, 검토를 위해 plan에 이름을 표시합니다. 기록은 "어디"만
  제공하고 "보낼지"는 제공하지 않습니다 — 다른 변경과 같은 검토 절차를 거치고, 아무것도
  전송하지 않으며, 푸시는 여전히 별도 plan과 승인이 필요합니다.
- **OpenCode 복구가 더 이상 막히지 않습니다.** `opencode.json`과 `opencode.jsonc`는 모두
  유효한 설정 이름이고 어느 쪽이든 `kavranta` 항목을 가질 수 있습니다. 이제 소유권을
  항목 수가 아니라 각 항목의 형식으로 판단하므로, 영구 충돌로 보고되던 구성이
  Kavranta의 것으로 인식됩니다.

Agent Bundle은 배포 대상 기록 기능으로 **2.7.0**(기존 2.6.0)이 되었습니다. 이 릴리스는
백그라운드 네트워크 접근을 추가하지 않고, 아무것도 전송하지 않으며, 값 되읽기도 없습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직 미서명
  상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
