# Kavranta 0.7.12 — Rich variable guides with images

- Illustrate a variable guide with local images. Drop a file under
  `.env-manager/guides/attachments/` and reference it as
  `![caption](attachments/<file>)`. Remote images are shown as links and never
  fetched.
- Page through long guides one `## ` section at a time with Previous and Next
  buttons. Short guides still show whole on one screen.
- Re-read an edited guide with the Refresh button. The app never polls the file.
- Secret input windows now resolve the requesting project, so guide buttons appear
  even when another project is selected.
- The AI activity screen renders every audit category instead of blanking on new
  ones.
- Agent Bundle 2.6.0 updates Codex, Claude Code, GitHub Copilot, Cursor, and OpenCode
  together. Use Update on each detected AI tool after installing this app.

This release adds no background network access and no value readback.

## Install

- macOS (Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: download the `aarch64` DMG.
- Intel Mac: download the `x86_64` DMG.
- Windows 10/11 x64 beta: download the `x64-setup.exe` installer. This beta remains
  intentionally unsigned; Microsoft Defender SmartScreen may warn.

---

# Kavranta 0.7.12 — 이미지가 들어가는 변수 가이드

- 변수 가이드에 로컬 이미지를 넣을 수 있습니다. `.env-manager/guides/attachments/`
  아래에 파일을 두고 `![설명](attachments/<파일>)`로 참조하세요. 원격 이미지는
  링크로만 보이고 내려받지 않습니다.
- 긴 가이드는 `## ` 섹션마다 이전·다음 버튼으로 넘겨 봅니다. 짧은 가이드는 그대로
  한 화면에 나옵니다.
- AI가 가이드를 고쳤으면 새로고침 버튼으로 다시 읽습니다. 앱이 파일을 계속
  감시하지 않습니다.
- 시크릿 입력 창이 요청한 프로젝트를 직접 찾아 가이드 버튼을 보여줍니다. 다른
  프로젝트를 보고 있어도 됩니다.
- AI 활동 화면이 새 감사 카테고리에서도 하얗게 비지 않고 모두 표시합니다.
- Agent Bundle 2.6.0은 Codex, Claude Code, GitHub Copilot, Cursor, OpenCode를 함께
  갱신합니다. 이 앱을 설치한 뒤 감지된 AI 도구마다 Update를 실행하세요.

이 릴리스는 백그라운드 네트워크 접근과 값 되읽기를 추가하지 않습니다.

## 설치

- macOS(Homebrew): `brew install --cask haechan1103/tap/kavranta`
- Apple Silicon: `aarch64` DMG를 받으세요.
- Intel Mac: `x86_64` DMG를 받으세요.
- Windows 10/11 x64 베타: `x64-setup.exe`를 받으세요. 이 베타는 정책상 아직
  미서명 상태이므로 Microsoft Defender SmartScreen 경고가 나타날 수 있습니다.
