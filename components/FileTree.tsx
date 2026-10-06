"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { FileNode } from "@/lib/types";

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
    const indent = { paddingLeft: `${depth * 16 + 8}px` };
    if (node.type === "dir") {
      const isOpen = expanded.has(node.path);
      return (
        <div key={node.path}>
          <button
            className="tree-row"
            style={indent}
            onClick={() => toggle(node.path)}
          >
            <span>{isOpen ? "▾" : "▸"}</span> {node.name}/
          </button>
          {isOpen &&
            node.children?.map((child) => renderNode(child, depth + 1))}
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
        <span> </span> {node.name}
      </button>
    );
  }

  if (loading) return <p>Loading files...</p>;
  if (error) return <p style={{ color: "#ff6b6b" }}>{error}</p>;

  return (
    <div className="filetree">
      {tree.length === 0 ? (
        <p>No files found</p>
      ) : (
        tree.map((node) => renderNode(node))
      )}
    </div>
  );
}
