import "./Markdown.css";
import { useEffect, useState, type ReactNode } from "react";

import * as api from "../lib/api";

interface Props {
  source: string;
  /** Project and guide context needed to load local attachments. */
  projectId?: string;
  guideKey?: string;
}

interface ImageTarget {
  kind: "local" | "remote" | "unsupported";
  file?: string;
  url?: string;
}

/**
 * Minimal, dependency-free Markdown renderer. It builds React nodes directly, so
 * raw HTML in the source is never injected. Supports headings, lists, fenced code,
 * inline code, bold, [text](url) links, bare http(s) URLs, and ![alt](src) images.
 * Local images must live in the guide's `attachments/` folder and load through the
 * desktop backend; remote image URLs render as links and are never fetched.
 */
export function Markdown({ source, projectId, guideKey }: Props) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  const renderInline = (text: string, seed: number) =>
    inline(text, seed, projectId, guideKey);

  const isBlockStart = (line: string) =>
    /^(#{1,6}\s|[-*]\s|\d+\.\s|```|!\[)/.test(line);

  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const blockImage = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (blockImage) {
      blocks.push(
        <ImageBlock
          key={key++}
          alt={blockImage[1] ?? ""}
          src={blockImage[2] ?? ""}
          projectId={projectId}
          guideKey={guideKey}
        />,
      );
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]!.startsWith("```")) {
        code.push(lines[index]!);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="md-code" key={key++}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const text = renderInline(heading[2]!, key);
      key += 8;
      const level = heading[1]!.length;
      if (level <= 1) blocks.push(<h3 className="md-heading" key={key++}>{text}</h3>);
      else if (level === 2) blocks.push(<h4 className="md-heading" key={key++}>{text}</h4>);
      else blocks.push(<h5 className="md-heading" key={key++}>{text}</h5>);
      index += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, key + itemIndex)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, key + itemIndex)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() !== "" &&
      !isBlockStart(lines[index]!)
    ) {
      paragraph.push(lines[index]!);
      index += 1;
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join(" "), key)}</p>);
  }

  return <div className="markdown">{blocks}</div>;
}

const inlinePattern =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(!\[([^\]]*)\]\(([^)\s]+)\))|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)]+)/g;

function inline(text: string, seed: number, projectId?: string, guideKey?: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let nodeKey = seed * 1000;
  let match: RegExpExecArray | null;
  inlinePattern.lastIndex = 0;
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      nodes.push(<code key={nodeKey++}>{match[1].slice(1, -1)}</code>);
    } else if (match[2]) {
      nodes.push(<strong key={nodeKey++}>{match[2].slice(2, -2)}</strong>);
    } else if (match[3]) {
      nodes.push(
        <InlineImage
          key={nodeKey++}
          alt={match[4] ?? ""}
          src={match[5] ?? ""}
          projectId={projectId}
          guideKey={guideKey}
        />,
      );
    } else if (match[6] && match[7]) {
      const label = match[6].match(/^\[([^\]]+)\]/)?.[1] ?? match[7];
      nodes.push(<ExternalLink key={nodeKey++} url={match[7]} label={label} />);
    } else if (match[8]) {
      nodes.push(<ExternalLink key={nodeKey++} url={match[8]} label={match[8]} />);
    }
    last = inlinePattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function classifyImage(src: string): ImageTarget {
  if (/^https?:\/\//.test(src)) return { kind: "remote", url: src };
  const local = src.match(/^(?:\.\/)?attachments\/([^/\s]+)$/);
  if (local?.[1]) return { kind: "local", file: local[1] };
  return { kind: "unsupported" };
}

function ImageBlock({
  alt,
  src,
  projectId,
  guideKey,
}: {
  alt: string;
  src: string;
  projectId?: string;
  guideKey?: string;
}) {
  const target = classifyImage(src);
  if (target.kind === "remote" && target.url) {
    return (
      <p>
        <ExternalLink url={target.url} label={alt || target.url} />
      </p>
    );
  }
  if (target.kind === "local" && target.file && projectId && guideKey) {
    return (
      <figure className="md-figure">
        <GuideImage projectId={projectId} guideKey={guideKey} file={target.file} alt={alt} />
        {alt && <figcaption>{alt}</figcaption>}
      </figure>
    );
  }
  return <p className="md-image-missing">{alt || src}</p>;
}

function InlineImage({
  alt,
  src,
  projectId,
  guideKey,
}: {
  alt: string;
  src: string;
  projectId?: string;
  guideKey?: string;
}) {
  const target = classifyImage(src);
  if (target.kind === "remote" && target.url) {
    return <ExternalLink url={target.url} label={alt || target.url} />;
  }
  if (target.kind === "local" && target.file && projectId && guideKey) {
    return <GuideImage projectId={projectId} guideKey={guideKey} file={target.file} alt={alt} />;
  }
  return <span className="md-image-missing">{alt || src}</span>;
}

function GuideImage({
  projectId,
  guideKey,
  file,
  alt,
}: {
  projectId: string;
  guideKey: string;
  file: string;
  alt: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setMissing(false);
    void api
      .readGuideAttachment(projectId, guideKey, file)
      .then((attachment) => {
        if (cancelled) return;
        if (!attachment) setMissing(true);
        else setDataUrl(`data:${attachment.mimeType};base64,${attachment.base64}`);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, guideKey, file]);

  if (missing) return <span className="md-image-missing">{alt || file}</span>;
  if (!dataUrl) return <span className="md-image-loading" aria-hidden="true" />;
  return <img className="md-image" src={dataUrl} alt={alt} />;
}

function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      rel="noreferrer"
      onClick={(event) => {
        event.preventDefault();
        void api.openExternal(url);
      }}
    >
      {label}
    </a>
  );
}
