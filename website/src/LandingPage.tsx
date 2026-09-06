import { useState } from "react";
import { WorkflowDemo } from "./WorkflowDemo";

const repository = "https://github.com/haechan1103/kavranta";
const downloads = `${repository}/releases/latest`;
const installCommand = "brew install --cask haechan1103/tap/kavranta";

export function LandingPage() {
  const [copyState, setCopyState] = useState("복사");
  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyState("복사됨 ✓");
    } catch {
      setCopyState("명령어를 선택해 복사하세요");
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Kavranta 홈">
          <img src="/brand/kavranta-logo.svg" alt="" />
          kavranta
        </a>
        <nav aria-label="메인 메뉴">
          <a href="#demo">작동 방식</a>
          <a href="#features">기능</a>
          <a href="#guide">시작 가이드</a>
        </nav>
        <div className="nav-actions">
          <a
            href={repository}
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            GitHub
          </a>
          <a className="button button-small" href="#download">
            다운로드
          </a>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <h1>
            환경변수는 연결하고,
            <br />
            <span>비밀은 지키세요.</span>
            <span className="hero-asterisk" aria-hidden="true">
              ✳
            </span>
          </h1>
          <p>
            흩어진 환경변수를 한곳에서. AI에게는 필요한 작업만.
            <br className="desktop-break" /> 설정부터 연결, 배포까지 — 쓰던 파일
            그대로 이어집니다.
          </p>
          <div className="hero-actions">
            <a className="button" href="#download">
              Kavranta 시작하기
            </a>
            <a className="text-link" href="#demo">
              <span className="play-icon">▷</span> 실제 흐름 살펴보기
            </a>
          </div>
          <div className="hero-note">
            <span>macOS & Windows</span>
            <i />
            <span>무료 · MIT License</span>
            <i />
            <span>계정 가입 없이</span>
          </div>
        </section>

        <WorkflowDemo />

        <section className="integrations-strip" aria-label="지원 도구">
          <p>지금 사용하는 도구와, 자연스럽게.</p>
          <div>
            <span>◉ GitHub Actions</span>
            <span>☁ Cloudflare</span>
            <span>◈ Expo EAS</span>
            <span className="aws-wordmark">aws</span>
            <span>✳ Claude Code</span>
            <span>⌘ Codex</span>
            <span>◉ Copilot</span>
          </div>
        </section>

        <section className="features-section section-shell" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LESS COPY. MORE FLOW.</span>
              <h2>
                반복하던 설정에,
                <br />
                하나의 흐름을.
              </h2>
            </div>
            <p>
              파일을 찾고, 값을 옮기고, 다시 확인하던 시간.
              <br />
              Kavranta에서 한 번에 이어가세요.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-link">
              <span className="feature-index">01 / CONNECT</span>
              <div className="link-illustration" aria-hidden="true">
                <div>
                  <code>AUTH_SECRET</code>
                  <span>••••••••</span>
                </div>
                <span className="link-stem" />
                <div className="linked-nodes">
                  <span>
                    Local <b>✓</b>
                  </span>
                  <span>
                    Development <b>✓</b>
                  </span>
                  <span>
                    API <b>✓</b>
                  </span>
                </div>
              </div>
              <h3>세 파일의 값, 한 번의 저장.</h3>
              <p>
                같이 쓸 변수만 명시적으로 연결하세요. 어디서 수정하든 연결된
                모든 파일에 반영되고, 저장 전에 영향 범위를 확인할 수 있습니다.
              </p>
            </article>
            <article className="feature-card feature-protect">
              <span className="feature-index">02 / PROTECT</span>
              <div className="protection-illustration" aria-hidden="true">
                <span className="shield-symbol">K</span>
                <div>
                  <code>AUTH_SECRET</code>
                  <span>
                    이름은 확인 가능 <b>✓</b>
                  </span>
                  <span>
                    보호된 값 읽기 <b>차단</b>
                  </span>
                </div>
              </div>
              <h3>작업은 맡기고, 값은 보호하고.</h3>
              <p>
                AI는 변수명과 상태를 확인하고 허용된 작업을 수행합니다. 보호된
                값은 일반 조회와 대화에 반환되지 않습니다.
              </p>
            </article>
            <article className="feature-card feature-ship">
              <span className="feature-index">03 / SHIP</span>
              <div className="ship-illustration" aria-hidden="true">
                <div>
                  <span>↗</span>
                  <strong>GitHub Actions</strong>
                  <small>sample-app / staging</small>
                </div>
                <p>
                  <span>✓</span> AUTH_SECRET <b>전송 완료</b>
                </p>
              </div>
              <h3>고른 값만, 원하는 목적지로.</h3>
              <p>
                GitHub, Cloudflare, EAS, AWS로 선택한 값을 전송하세요. 소스
                파일과 목적지를 지정하면 결과만 간결하게 돌아옵니다.
              </p>
            </article>
          </div>
        </section>

        <section className="local-section section-shell" id="local-first">
          <div className="local-copy">
            <span className="eyebrow">ROOTED IN YOUR PROJECT.</span>
            <h2>
              파일은 원래 자리에.
              <br />
              주도권은 당신에게.
            </h2>
            <p>
              주석도, 파일 순서도, 개발 서버를 켜는 명령도.
              <br />
              익숙한 프로젝트의 모습을 그대로 유지합니다.
            </p>
            <a
              className="text-link"
              href={`${repository}/blob/main/SECURITY.md`}
            >
              보안 모델 자세히 보기 <span>↗</span>
            </a>
          </div>
          <div className="local-facts">
            <article>
              <span>01</span>
              <div>
                <h3>기존 파일을 충실하게</h3>
                <p>요청한 부분을 편집하고 나머지 주석과 형식을 보존합니다.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>팀에는 암호화해서</h3>
                <p>
                  선택한 변수를 암호화 패키지로 공유하고, 충돌은 적용 전에
                  확인합니다.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Git 위험은 미리 확인</h3>
                <p>
                  ignore 누락, 추적 중인 파일, 기록에 남은 경로를 구분해
                  알려줍니다.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="guide-section section-shell" id="guide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A SMALL START. A BETTER WORKFLOW.</span>
              <h2>첫 프로젝트까지, 세 단계.</h2>
            </div>
            <a
              className="text-link"
              href={`${repository}/blob/main/README.ko.md`}
            >
              전체 가이드 읽기 ↗
            </a>
          </div>
          <ol className="guide-steps">
            <li>
              <span>01</span>
              <h3>프로젝트를 등록하세요.</h3>
              <p>
                앱을 설치하고 프로젝트 폴더를 선택하세요. 지원하는 env 파일을
                찾아 한곳에 모아줍니다.
              </p>
              <code>프로젝트 추가 → 폴더 선택</code>
            </li>
            <li>
              <span>02</span>
              <h3>쓰는 AI 도구를 연결하세요.</h3>
              <p>
                AI 도구 연결 화면에서 사용 중인 도구를 연결하고 표시되는 보호
                상태를 확인하세요.
              </p>
              <code>AI 도구 연결 → 연결 설치</code>
            </li>
            <li>
              <span>03</span>
              <h3>하고 싶은 일을 말하세요.</h3>
              <p>
                새 에이전트 세션에서 변수 추가, 연결, 재사용을 요청하세요. 배포
                전에는 Provider 로그인이 필요합니다.
              </p>
              <code>“환경변수 구조를 값 없이 확인해줘.”</code>
            </li>
          </ol>
        </section>

        <section className="faq-section section-shell">
          <div>
            <span className="eyebrow">GOOD TO KNOW.</span>
            <h2>궁금할 만한 것들.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>
                환경변수는 어디에 저장되나요?<span>+</span>
              </summary>
              <p>
                값은 프로젝트가 이미 사용하는 env 파일에 남습니다. Kavranta의
                프로젝트 메타데이터에는 접근 정책과 연결 관계만 저장됩니다.
              </p>
            </details>
            <details>
              <summary>
                AI가 보호된 값을 전혀 볼 수 없나요?<span>+</span>
              </summary>
              <p>
                Kavranta Broker는 보호된 값의 읽기를 차단합니다. 직접 파일
                접근의 방어 수준은 AI 도구의 권한 설정과 Guard에 따라
                달라집니다. 평문 파일에 접근할 수 있는 다른 프로세스나 손상된
                운영체제까지 격리하지는 않습니다.
              </p>
            </details>
            <details>
              <summary>
                연결과 배포는 자동으로 동기화되나요?<span>+</span>
              </summary>
              <p>
                직접 연결한 프로젝트 내 변수들은 저장할 때 함께 변경됩니다.
                Provider 배포는 명시적으로 요청한 단방향 전송입니다. GitHub
                Secret은 다시 읽을 수 없어 현재 값의 일치를 보장하지 않습니다.
              </p>
            </details>
            <details>
              <summary>
                어떤 컴퓨터에서 사용할 수 있나요?<span>+</span>
              </summary>
              <p>
                macOS Apple Silicon·Intel과 Windows 10/11 x64를 지원합니다.
                Windows 설치 파일은 현재 미서명 베타이며 SmartScreen 경고가
                표시되거나 조직 정책에 따라 차단될 수 있습니다.
              </p>
            </details>
          </div>
        </section>

        <section className="download-section" id="download">
          <div className="download-mark" aria-hidden="true">
            ✳
          </div>
          <span className="eyebrow">YOUR NEXT PROJECT, A LITTLE LIGHTER.</span>
          <h2>
            설정은 가볍게.
            <br />
            개발은 계속.
          </h2>
          <p>당신의 다음 프로젝트에 Kavranta를 더하세요.</p>
          <div className="download-buttons">
            <a className="button" href={downloads}>
              macOS 다운로드
            </a>
            <a className="button button-outline" href={downloads}>
              Windows 베타
            </a>
          </div>
          <div className="install-command">
            <code>{installCommand}</code>
            <button
              onClick={() => void copyInstall()}
              aria-label="Homebrew 설치 명령 복사"
            >
              {copyState}
            </button>
          </div>
          <p className="download-fine-print">
            macOS: Apple Silicon · Intel &nbsp; / &nbsp; Windows: x64 미서명
            베타
            <br />
            다운로드 버튼에서 공식 GitHub Release의 운영체제별 파일을
            선택하세요.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <a className="brand" href="#">
          <img src="/brand/kavranta-logo.svg" alt="" />
          kavranta
        </a>
        <span>Built for your files. Made for your flow.</span>
        <div>
          <a href={repository}>GitHub ↗</a>
          <a href={`${repository}/blob/main/SECURITY.md`}>보안</a>
          <a href={`${repository}/blob/main/LICENSE`}>MIT License</a>
        </div>
      </footer>
    </>
  );
}
