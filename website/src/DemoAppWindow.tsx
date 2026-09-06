import type { DemoFrame } from "./demoStory";
import { TrafficLights } from "./DemoWindowChrome";
export function DemoAppWindow({
  hasVariable,
  hasValue,
  linked,
  complete,
  deployed,
  visibleLines,
}: Pick<
  DemoFrame,
  | "hasVariable"
  | "hasValue"
  | "linked"
  | "complete"
  | "deployed"
  | "visibleLines"
>) {
  return (
    <div className="app-window" aria-label="앱 반영 미리보기">
      <div className="window-bar">
        <TrafficLights />
        <span>Kavranta</span>
        <span className="window-status">로컬 프로젝트</span>
      </div>
      <div className="demo-app-layout">
        <aside className="demo-sidebar">
          <div className="demo-brand">
            <img src="/brand/kavranta-logo.svg" alt="" /> Kavranta
          </div>
          <div className="demo-project">
            <span>S</span> sample-app <small>⌄</small>
          </div>
          <div className="demo-nav-item">
            ⌁ <span>프로젝트 개요</span>
          </div>
          <div className="demo-nav-item">
            ◇ <span>접근 검토</span>
          </div>
          <div className="demo-nav-item">
            ◷ <span>AI 활동</span>
            <i className="live-dot" />
          </div>
          <p className="demo-nav-label">ENV FILES</p>
          <div className="demo-nav-item selected">
            ▤ <span>Local</span>
            <small>{hasVariable ? 4 : 3}</small>
          </div>
          <div className={`demo-nav-item ${linked ? "linked-file" : ""}`}>
            ▤ <span>Development</span>
            {linked && <small>↗</small>}
          </div>
          <div className="demo-sidebar-footer">
            <span className="live-dot" /> AI 도구 연결됨
          </div>
        </aside>
        <div className="demo-editor">
          <div className="editor-breadcrumb">
            sample-app <span>/</span> 환경변수
          </div>
          <div className="editor-heading">
            <div>
              <h3>Local environment</h3>
              <p>{hasVariable ? 4 : 3}개 변수 · 2개 그룹</p>
            </div>
            <span className="demo-add-label">+ 새 변수</span>
          </div>
          <div className="editor-tabs">
            <span>전체 변수</span>
            <span>
              연결됨 <b>{linked ? 1 : 0}</b>
            </span>
            <span>
              값 없음 <b>{hasVariable && !hasValue ? 1 : 0}</b>
            </span>
          </div>
          <div className="demo-group">
            <header>
              <span>⌄ &nbsp; Application</span>
              <small>2 VARIABLES</small>
            </header>
            <DemoRow
              name="APP_NAME"
              description="애플리케이션 이름"
              policy="AI 허용"
            />
            <DemoRow name="NODE_ENV" description="실행 환경" policy="AI 허용" />
          </div>
          <div className="demo-group">
            <header>
              <span>⌄ &nbsp; Authentication</span>
              <small>{hasVariable ? 2 : 1} VARIABLES</small>
            </header>
            <DemoRow name="DATABASE_URL" description="데이터베이스 연결" />
            {hasVariable && (
              <div className="animated-variable">
                <DemoRow
                  name="AUTH_SECRET"
                  description="인증 서명용 비밀값"
                  empty={!hasValue}
                  highlighted
                />
                {linked && (
                  <div className="demo-link-detail">
                    <span>↗ &nbsp; 2개 파일에 연결됨</span>
                    <code>Local</code>
                    <code>Development</code>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="demo-save-status" role="status">
            {complete ? (
              <>
                <span>✓</span>{" "}
                {deployed
                  ? "GitHub staging에 Secret 1개 전송 완료"
                  : linked
                    ? "2개 파일에 반영되었습니다"
                    : "변경사항이 저장되었습니다"}
              </>
            ) : (
              <>
                <span className="live-dot" />{" "}
                {visibleLines > 0
                  ? "AI 작업을 반영하고 있습니다"
                  : "모든 변경사항이 저장되었습니다"}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function DemoRow({
  name,
  description,
  policy = "보호됨",
  empty = false,
  highlighted = false,
}: {
  name: string;
  description: string;
  policy?: string;
  empty?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div className={`demo-variable ${highlighted ? "highlighted" : ""}`}>
      <div>
        <code>{name}</code>
        <small>{description}</small>
      </div>
      <span className={`masked-value ${empty ? "empty-value" : ""}`}>
        {empty ? "설정 필요" : "••••••••••••"}
        <span aria-hidden="true">◎</span>
      </span>
      <span className={`policy-pill ${policy === "AI 허용" ? "allowed" : ""}`}>
        {policy}
      </span>
    </div>
  );
}
