import { useState } from "react";
import { WorkflowDemo } from "./WorkflowDemo";
import { LinkPlayground } from "./LinkPlayground";
import { useSiteLocale } from "./SiteLocale";

const repository = "https://github.com/haechan1103/kavranta";
const downloads = `${repository}/releases/latest`;
const installCommand = "brew install --cask haechan1103/tap/kavranta";

export function LandingPage() {
  const { locale, copy: c, setLocale } = useSiteLocale();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        {c.skip}
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label={c.home}>
          <img src="./brand/kavranta-logo.svg" alt="" />
          kavranta
        </a>
        <nav aria-label={c.navigation}>
          <a href="#try">{c.try}</a>
          <a href="#features">{c.features}</a>
          <a href="#guide">{c.guide}</a>
        </nav>
        <div className="nav-actions">
          <div className="language-switch" aria-label="Language">
            <button
              lang="en"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <button
              lang="ko"
              aria-pressed={locale === "ko"}
              onClick={() => setLocale("ko")}
            >
              한국어
            </button>
          </div>
          <a href={repository} className="github-link">
            GitHub
          </a>
          <a className="button button-small" href="#download">
            {c.download}
          </a>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <h1>
            {c.hero[0]}
            <br />
            <span>{c.hero[1]}</span>
            <span className="hero-asterisk" aria-hidden="true">
              ✳
            </span>
          </h1>
          <p>{c.heroBody}</p>
          <div className="hero-actions">
            <a className="button" href="#try">
              {c.heroCta}
            </a>
            <a className="text-link" href="#download">
              {c.heroSecondary} ↗
            </a>
          </div>
          <div className="hero-note">
            {c.heroNote.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </section>

        <LinkPlayground />
        <WorkflowDemo />

        <section className="integrations-strip" aria-label={c.tools}>
          <p>{c.tools}</p>
          <div>
            {[
              "GitHub Actions",
              "Cloudflare",
              "Expo EAS",
              "AWS",
              "Claude Code",
              "Codex",
              "Copilot",
              "Cursor",
            ].map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </section>
        <section className="features-section section-shell" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{c.featureEyebrow}</span>
              <h2>
                {c.featureTitle[0]}
                <br />
                {c.featureTitle[1]}
              </h2>
            </div>
            <p>{c.featureBody}</p>
          </div>
          <div className="feature-grid">
            {c.cards.map((card, index) => (
              <article className="feature-card" key={card.title}>
                <span className="feature-index">0{index + 1}</span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="local-section section-shell" id="local-first">
          <div className="local-copy">
            <span className="eyebrow">{c.localEyebrow}</span>
            <h2>
              {c.localTitle[0]}
              <br />
              {c.localTitle[1]}
            </h2>
            <p>{c.localBody}</p>
            <a
              className="text-link"
              href={`${repository}/blob/main/SECURITY.md`}
            >
              {c.security} ↗
            </a>
          </div>
          <div className="local-facts">
            {c.facts.map((fact, index) => (
              <article key={fact.title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{fact.title}</h3>
                  <p>{fact.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="guide-section section-shell" id="guide">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{c.guideEyebrow}</span>
              <h2>{c.guideTitle}</h2>
            </div>
            <a
              className="text-link"
              href={`${repository}/blob/main/${locale === "ko" ? "README.ko.md" : "README.md"}`}
            >
              {c.fullGuide} ↗
            </a>
          </div>
          <ol className="guide-steps">
            {c.steps.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <code>{step.hint}</code>
              </li>
            ))}
          </ol>
        </section>
        <section className="faq-section section-shell">
          <div>
            <h2>{c.faqTitle}</h2>
          </div>
          <div className="faq-list">
            {c.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <span>+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="download-section" id="download">
          <div className="download-mark" aria-hidden="true">
            ✳
          </div>
          <span className="eyebrow">{c.downloadEyebrow}</span>
          <h2>
            {c.downloadTitle[0]}
            <br />
            {c.downloadTitle[1]}
          </h2>
          <p>{c.downloadBody}</p>
          <div className="download-buttons">
            <a className="button" href={downloads}>
              {c.mac}
            </a>
            <a className="button button-outline" href={downloads}>
              {c.windows}
            </a>
          </div>
          <div className="install-command">
            <code>{installCommand}</code>
            <button onClick={() => void copyInstall()} aria-label={c.copyLabel}>
              {copyState === "copied"
                ? c.copied
                : copyState === "failed"
                  ? c.copyFailed
                  : c.copy}
            </button>
          </div>
          <p className="download-fine-print">{c.downloadNote}</p>
        </section>
      </main>
      <footer className="site-footer">
        <a className="brand" href="#">
          <img src="./brand/kavranta-logo.svg" alt="" />
          kavranta
        </a>
        <span>{c.footer}</span>
        <div>
          <a href={`${repository}/blob/main/ROADMAP.md`}>{c.roadmap}</a>
          <a href={`${repository}/discussions`}>{c.feedback}</a>
          <a href={`${repository}/blob/main/SECURITY.md`}>{c.security}</a>
        </div>
      </footer>
    </>
  );
}
