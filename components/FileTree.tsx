"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { FileNode } from "@/lib/types";
import { Spinner, ErrorState, EmptyState } from "@/components/ui";

export function FileTree({
  workspaceId,
  onSelectFile,
}: {
  workspaceId: string;
  onSelectFile: (path: string, content: string) => void;
}) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { tree } = await api.getFiles(workspaceId);
        setTree(tree);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspaceId]);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function openFile(path: string) {
    try {
      const { content } = await api.getFileContent(workspaceId, path);
      onSelectFile(path, content);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function renderNode(node: FileNode, depth: number = 0): React.ReactNode {
    const indent = { paddingLeft: `${depth * 16 + 4}px` };
    if (node.type === "dir") {
      const isOpen = expanded.has(node.path);
      return (
        <div key={node.path}>
          <button className="tree-row" style={indent} onClick={() => toggle(node.path)}>
            <span className="tree-arrow">{isOpen ? "▾" : "▸"}</span>
            {node.name}
          </button>
          {isOpen && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }
    return (
      <button
        key={node.path}
        className="tree-row file"
        style={indent}
        onClick={() => openFile(node.path)}
      >
        <span className="tree-arrow">·</span>
        {node.name}
      </button>
    );
  }

  if (loading) return <Spinner label="Loading files..." />;
  if (error) return <ErrorState message={error} />;

  if (tree.length === 0) {
    return <EmptyState icon="▣" title="No files found" description="This workspace appears to be empty." />;
  }

  return <div className="filetree">{tree.map((node) => renderNode(node))}</div>;
}
