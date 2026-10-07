"use client";

import { useState } from "react";

export function CodeViewer({
  path,
  content,
}: {
  path: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lines = content.split("\n");

  return (
    <div className="codeviewer">
      <div className="code-header">
        <span>{path}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="code-body">
        {lines.map((line, i) => (
          <div key={i} className="code-line">
            <span className="line-num">{i + 1}</span>
            <span className="line-content">{line || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
