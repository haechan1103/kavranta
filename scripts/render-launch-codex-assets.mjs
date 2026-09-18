import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const brandDir = path.join(root, "assets", "brand");
const outDir = path.join(root, "assets", "launch");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const logo = (await readFile(path.join(brandDir, "kavranta-logo.svg"))).toString(
  "base64",
);

await mkdir(outDir, { recursive: true });

const person = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.3 3.1-5.4 7-5.4S19 16.7 19 20"/></svg>`;
const shield = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>`;
const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6L16 9.4"/></svg>`;
const lock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>`;

function userRow(prompt) {
  return `<div class="user"><span class="who">${person} USER</span><span class="divider"></span><span class="prompt">${prompt}</span></div>`;
}

function step(number, title, tool, meta) {
  return `<div class="step">
    <span class="num">${number}</span>
    <div class="step-main">
      <div class="step-title">${title}</div>
      <code class="tool">${tool}</code>
    </div>
    ${meta ? `<div class="step-meta">${meta}</div>` : ""}
  </div>`;
}

function banner(text) {
  return `<div class="banner"><span class="banner-icon">${shield}</span><span class="banner-divider"></span><span class="banner-text">${text}</span></div>`;
}

function footnote(text) {
  return `<div class="footnote"><span class="foot-icon">${lock}</span>${text}</div>`;
}

const base = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1600px; height: 1000px; overflow: hidden; }
  body {
    padding: 58px 64px;
    background: radial-gradient(circle at 12% 4%, rgba(71, 236, 158, .10), transparent 40%), #08130f;
    color: #f4f8f6;
    font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .eyebrow { color: #5fe0ac; font-size: 23px; font-weight: 720; letter-spacing: .14em; text-transform: uppercase; }
  .eyebrow .x { color: #7d8f88; }
  h1 { margin-top: 16px; font-size: 60px; line-height: 1.06; letter-spacing: -.045em; }
  h1 .accent { color: #5fe0ac; }
  .user {
    display: flex; align-items: center; gap: 20px; margin-top: 30px;
    border: 1px solid rgba(255, 255, 255, .13); border-radius: 16px; padding: 20px 26px;
    background: rgba(255, 255, 255, .015);
  }
  .who { display: flex; align-items: center; gap: 12px; color: #8ba59b; font-size: 21px; font-weight: 720; }
  .who svg, .foot-icon svg, .banner-icon svg { width: 30px; height: 30px; }
  .divider, .banner-divider { width: 1px; height: 34px; background: rgba(255, 255, 255, .16); }
  .prompt { font-size: 23px; line-height: 1.35; }
  .prompt b { color: #5fe0ac; font-weight: 700; }
  .terminal { margin-top: 26px; border: 1px solid rgba(255, 255, 255, .13); border-radius: 18px; overflow: hidden; }
  .term-title { display: flex; align-items: center; gap: 9px; height: 52px; padding: 0 22px; background: rgba(255, 255, 255, .03); color: #9fb3ac; font-size: 20px; }
  .dot { width: 13px; height: 13px; border-radius: 50%; background: #ff5f57; }
  .dot:nth-child(2) { background: #ffbd2e; }
  .dot:nth-child(3) { background: #28c840; }
  .term-title .label { margin-left: 8px; }
  .step { display: flex; align-items: center; gap: 22px; padding: 24px 26px; border-top: 1px solid rgba(255, 255, 255, .09); }
  .num {
    flex: none; display: grid; place-items: center; width: 46px; height: 46px;
    border: 2px solid #46d79c; border-radius: 12px; color: #5fe0ac; font-size: 23px; font-weight: 760;
  }
  .step-main { flex: 1; }
  .step-title { font-size: 26px; font-weight: 720; }
  .tool { color: #63d3ff; font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 21px; }
  .step-meta { color: #9fb3ac; font-size: 21px; text-align: right; }
  .banner {
    display: flex; align-items: center; gap: 22px; margin-top: 26px;
    border: 1px solid rgba(95, 224, 172, .3); border-radius: 18px; padding: 26px 34px;
    background: rgba(53, 208, 160, .06);
  }
  .banner-icon { color: #5fe0ac; }
  .banner-text { font-size: 34px; font-weight: 780; letter-spacing: -.02em; }
  .footnote { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; color: #a9bdb5; font-size: 23px; }
  .footnote code { color: #cfe9df; }
  .foot-icon { color: #6fdfb4; }
`;

const browser = await chromium.launch({ executablePath: chromePath });

async function render(name, markup) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html lang="en"><head><style>${base}${markup.style ?? ""}</style></head><body>${markup.body}</body></html>`);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await context.close();
  console.log(`rendered ${name}.png`);
}

try {
  await render("kavranta-codex-workflow-en", {
    body: `
      <div class="eyebrow">CODEX <span class="x">×</span> KAVRANTA</div>
      <h1>No values shown. <span class="accent">Deploy in one sentence.</span></h1>
      ${userRow("Kavranta, push only what staging needs from <b>.env.deploy.staging</b> to GitHub staging. Never show values.")}
      <div class="terminal">
        <div class="term-title"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span class="label">Codex Terminal</span></div>
        ${step("1", "Inspect project structure", "kavranta.inspect_project", "0 values exposed · 3 targets found")}
        ${step("2", "Build a safe delivery plan", "kavranta.plan_provider_push", "GitHub · staging · Secret/Variable classified")}
        ${step("3", "Apply the plan", "kavranta.apply_plan", "3 succeeded · 0 failed")}
      </div>
      ${banner("Codex sees names, policy, and results — never the values.")}
      ${footnote("Only the selected names leave the project. Actual values stay behind the Rust core.")}
    `,
  });

  await render("kavranta-codex-create-reuse-en", {
    style: `
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 30px; }
      .card { border: 1px solid rgba(255, 255, 255, .13); border-radius: 18px; padding: 28px 30px; }
      .card h3 { font-size: 27px; font-weight: 720; margin: 16px 0 6px; }
      .card code { color: #63d3ff; font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 20px; }
      .flow { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 30px 0; color: #9fb3ac; font-size: 20px; }
      .node { display: grid; place-items: center; gap: 8px; }
      .glyph { display: grid; place-items: center; width: 66px; height: 66px; border: 2px solid #46d79c; border-radius: 15px; color: #5fe0ac; }
      .glyph svg { width: 34px; height: 34px; }
      .arrow { color: #6f7f79; font-size: 30px; }
      .done { display: flex; align-items: center; gap: 14px; border-top: 1px solid rgba(255,255,255,.1); padding-top: 22px; color: #b9f5df; font-size: 22px; }
      .done svg { width: 32px; height: 32px; }
      .tag { display: inline-grid; place-items: center; width: 46px; height: 46px; border: 2px solid #46d79c; border-radius: 12px; color: #5fe0ac; font-weight: 760; font-size: 22px; }
    `,
    body: `
      <div class="eyebrow">01 &nbsp; CREATE &amp; REUSE</div>
      <h1>Generate a secret, or <span class="accent">reuse one across projects.</span></h1>
      ${userRow("Create <b>AUTH_SECRET</b> fresh, and pull <b>GEMINI_API_KEY</b> from another project. Don't show values.")}
      <div class="grid">
        <div class="card">
          <span class="tag">1</span>
          <h3>Generate a new secret</h3>
          <code>kavranta.plan_stdin_value_write</code>
          <div class="flow">
            <span class="node"><span class="glyph">&gt;_</span>openssl</span>
            <span class="arrow">→</span>
            <span class="node"><span class="glyph">◌◌◌◌</span>stdin</span>
            <span class="arrow">→</span>
            <span class="node"><span class="glyph">K</span>Kavranta</span>
          </div>
          <div class="done">${check} AUTH_SECRET created</div>
        </div>
        <div class="card">
          <span class="tag">2</span>
          <h3>Reuse from another project</h3>
          <code>kavranta.plan_copy_variable_from_project</code>
          <div class="flow">
            <span class="node"><span class="glyph">${shield}</span>Registered project</span>
            <span class="arrow">→</span>
            <span class="node"><span class="glyph">K</span>Current project</span>
          </div>
          <div class="done">${check} GEMINI_API_KEY copied</div>
        </div>
      </div>
      ${banner("0 actual values exposed to Codex.")}
      ${footnote("Values move only inside the Rust core and a one-time stdin boundary.")}
    `,
  });

  await render("kavranta-codex-test-en", {
    style: `
      .cols { display: grid; grid-template-columns: 1fr 1.05fr 1fr; gap: 22px; margin-top: 30px; align-items: stretch; }
      .lane { border: 1px solid rgba(255,255,255,.13); border-radius: 18px; padding: 24px 26px; }
      .lane h3 { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 720; margin-bottom: 20px; }
      .lane h3 svg { width: 30px; height: 30px; color: #5fe0ac; }
      .chipbox { border: 1px solid rgba(99, 211, 255, .35); border-radius: 12px; padding: 14px 16px; color: #8fd8ff; font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 19px; margin-bottom: 12px; }
      .chipbox .arw { color: #7d8f88; }
      .mini { border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 12px 15px; color: #cfe9df; font-size: 19px; margin-bottom: 12px; }
      .ok { display: flex; align-items: center; gap: 12px; color: #b9f5df; font-size: 21px; }
      .ok svg { width: 28px; height: 28px; }
      .hub { border: 1px solid rgba(95, 224, 172, .45); border-radius: 18px; padding: 24px 22px; text-align: center; background: rgba(53, 208, 160, .05); }
      .hub .k { display: grid; place-items: center; width: 72px; height: 72px; margin: 0 auto 14px; border: 2px solid #46d79c; border-radius: 18px; color: #5fe0ac; font-size: 30px; font-weight: 780; }
      .hub h4 { font-size: 27px; font-weight: 760; }
      .hub p { color: #5fe0ac; font-size: 21px; margin-top: 4px; }
      .hub ul { list-style: none; margin-top: 18px; display: grid; gap: 12px; color: #b9cac2; font-size: 19px; text-align: left; }
      .hub li { display: flex; align-items: center; gap: 10px; }
      .hub li svg { width: 26px; height: 26px; color: #5fe0ac; flex: none; }
      .chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px; }
      .chip { display: flex; align-items: center; justify-content: center; gap: 12px; border: 1px solid rgba(255,255,255,.13); border-radius: 14px; padding: 18px; color: #cfe9df; font-size: 21px; }
      .chip svg { width: 28px; height: 28px; color: #5fe0ac; }
    `,
    body: `
      <div class="eyebrow">02 &nbsp; TEST WITHOUT REVEAL</div>
      <h1>Test APIs and CLIs <span class="accent">without revealing values.</span></h1>
      ${userRow("Check API and CLI connectivity with <b>PAYMENTS_API_TOKEN</b>. Don't show values or response bodies.")}
      <div class="cols">
        <div class="lane">
          <h3>${person} HTTPS API check</h3>
          <div class="chipbox">PAYMENTS_API_TOKEN <span class="arw">→</span> Authorization header</div>
          <div class="mini"><b>GET</b> /health</div>
          <div class="ok">${check} 200 OK · 284 ms</div>
        </div>
        <div class="hub">
          <div class="k">K</div>
          <h4>Kavranta</h4>
          <p>Action Pack</p>
          <ul>
            <li>${shield} Safe delivery</li>
            <li>${check} Allowlisted results only</li>
          </ul>
        </div>
        <div class="lane">
          <h3>&gt;_ Local CLI check</h3>
          <div class="chipbox">PAYMENTS_API_TOKEN <span class="arw">→</span> stdin</div>
          <div class="mini">payments-cli verify</div>
          <div class="ok">${check} Exit 0 · healthy</div>
        </div>
      </div>
      <div class="chips">
        <div class="chip">${shield} No values in arguments</div>
        <div class="chip">${shield} No response bodies</div>
        <div class="chip">${shield} No values in logs</div>
      </div>
      ${banner("Codex confirmed status · time · exit code.")}
    `,
  });
} finally {
  await browser.close();
}

console.log(`Launch Codex assets in ${path.relative(root, outDir)}`);
