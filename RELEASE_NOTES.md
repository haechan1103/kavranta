# Kavranta 0.7.20 — A redesigned workspace

- **One table per env file.** Each row shows the name and description, the masked
  value with reveal and copy, AI access, and which other files share the key. Filter
  by Empty, Pending, or AI cannot read; select rows to mark several for deletion.
- **Edits are staged and saved together.** Typed values and deletions stay pending,
  highlighted with Revert, until you press Save or ⌘S. The save bar names every file
  Save will touch, including linked members, asks once before deleting, and keeps any
  item that failed pending with its name. Leaving a file with pending changes asks
  first, and a file changed outside Kavranta keeps what you typed.
- **A details panel beside the table.** Click a row for its description, AI access,
  linked files, setup guide, recent AI activity, Move, and Mark for deletion. On narrow
  windows it opens as a drawer; ⌘I toggles it.
- **Compare files.** A new view lists every variable against every env file as Set,
  Value A/B/C, Empty, Missing, or Defined twice, with "Differences only". Equality is
  computed in Rust per request; no value, length, or hash is returned, stored, or
  offered to AI agents.
- **Source view.** A Table / Source switch shows the file's own order, comments, and
  groups with every value masked. Commented-out assignments, secret-like comments, and
  unreadable lines are withheld by the backend.
- **Review before pushing.** Push variables now shows the destination, source file,
  each name with its remote type, and a warning when the provider keeps no previous
  value. Nothing is sent until you press Push on that step.
- **⌘K search and a top bar.** Find any variable name, file, view, or command from
  anywhere; ⌘↵ copies a value without opening the file. Search never reads values.
- **Readable everywhere.** One type scale with platform minimum sizes, AA contrast,
  plainer wording, app-owned confirmation dialogs, errors that stay until dismissed,
  and automatic light or dark appearance. The sidebar lists env files first.
- **Claude desktop app detection.** On macOS, the Claude Code copy bundled with the
  Claude desktop app is detected, so the Kavranta connection installs without a
  separate CLI.

This release adds no network access, telemetry, or value readback. Project manifests
and app data from earlier versions load unchanged. The Agent Bundle remains **2.7.0**.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.20 — 새로 설계한 작업 화면

- **env 파일마다 하나의 표.** 한 줄에 이름과 설명, 보기·복사가 되는 가려진 값, AI 접근,
  같은 키를 쓰는 다른 파일이 나옵니다. 비어 있음·변경 대기·AI 읽기 불가로 거르고, 여러
  행을 골라 한 번에 삭제 표시할 수 있습니다.
- **수정은 모아 두었다가 한 번에 저장.** 입력한 값과 삭제는 저장 또는 ⌘S를 누를 때까지
  되돌리기와 함께 대기 상태로 표시됩니다. 저장 바는 연결된 파일까지 저장으로 바뀌는
  파일을 모두 알려주고, 삭제 전에는 한 번만 묻고, 실패한 항목은 이름과 함께 대기 상태로
  남깁니다. 대기 중인 변경이 있으면 파일을 떠나기 전에 묻고, 다른 곳에서 파일이 바뀌어도
  입력한 값은 유지합니다.
- **표 옆의 상세 패널.** 행을 누르면 설명, AI 접근, 연결된 파일, 설정 가이드, 최근 AI 활동,
  그룹 이동, 삭제 표시를 볼 수 있습니다. 좁은 창에서는 서랍으로 열리며 ⌘I로 여닫습니다.
- **파일 비교.** 새 화면에서 모든 변수를 모든 env 파일과 맞대어 있음, 값 A/B/C, 비어 있음,
  없음, 중복 정의로 보여주고 "차이만 보기"를 제공합니다. 같은지 여부는 요청마다 Rust에서
  계산하며 값·길이·해시를 돌려주거나 저장하거나 AI 에이전트에 제공하지 않습니다.
- **파일 원문 보기.** 표 / 파일 원문 전환으로 파일에 적힌 순서, 주석, 그룹을 값은 모두
  가린 채 볼 수 있습니다. 주석 처리된 할당, 비밀처럼 보이는 주석, 해석할 수 없는 줄은
  백엔드에서 내용을 보내지 않습니다.
- **올리기 전 검토.** 환경변수 올리기가 보낼 곳, 가져올 파일, 변수별 원격 유형을 먼저
  보여주고, 이전 값을 보관하지 않는 대상이면 경고합니다. 그 단계에서 올리기를 눌러야
  전송됩니다.
- **⌘K 검색과 상단 바.** 어디서든 변수 이름, 파일, 화면, 명령을 찾고, ⌘↵로 파일을 열지
  않고 값을 복사합니다. 검색은 값을 읽지 않습니다.
- **어디서나 읽기 쉽게.** 플랫폼 최소 크기를 지키는 하나의 글자 크기 체계, AA 대비, 더
  쉬운 문구, 앱 자체 확인 창, 닫을 때까지 남는 오류, 자동 라이트·다크 모드를 적용했습니다.
  사이드바는 env 파일을 맨 위에 둡니다.
- **Claude 데스크톱 앱 감지.** macOS에서 Claude 데스크톱 앱에 포함된 Claude Code를
  감지하므로, 별도 CLI 없이 Kavranta 연결을 설치할 수 있습니다.

이 릴리스는 네트워크 접근, 텔레메트리, 값 되읽기를 추가하지 않습니다. 이전 버전의
프로젝트 매니페스트와 앱 데이터는 그대로 열립니다. Agent Bundle은 **2.7.0**으로
유지됩니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직 미서명
  상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
