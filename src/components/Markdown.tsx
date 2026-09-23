import "./Markdown.css";
import type { ReactNode } from "react";

import * as api from "../lib/api";

interface Props {
  source: string;
}

/**
 * Minimal, dependency-free Markdown renderer. It builds React nodes directly, so
 * raw HTML in the source is never injected. Supports headings, lists, fenced code,
 * inline code, bold, [text](url) links, and bare http(s) URLs.
 */
export function Markdown({ source }: Props) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  const isBlockStart = (line: string) =>
    /^(#{1,6}\s|[-*]\s|\d+\.\s|```)/.test(line);

  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim() === "") {
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
      const text = inline(heading[2]!, key);
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
            <li key={itemIndex}>{inline(item, key + itemIndex)}</li>
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
            <li key={itemIndex}>{inline(item, key + itemIndex)}</li>
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
    blocks.push(<p key={key++}>{inline(paragraph.join(" "), key)}</p>);
  }

  return <div className="markdown">{blocks}</div>;
}

const inlinePattern =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)]+)/g;

function inline(text: string, seed: number): ReactNode[] {
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
    } else if (match[3] && match[4]) {
      const label = match[3].match(/^\[([^\]]+)\]/)?.[1] ?? match[4];
      nodes.push(<ExternalLink key={nodeKey++} url={match[4]} label={label} />);
    } else if (match[5]) {
      nodes.push(<ExternalLink key={nodeKey++} url={match[5]} label={match[5]} />);
    }
    last = inlinePattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
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
