"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { FileNode } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Spinner, ErrorState, EmptyState } from "@/components/ui";

export function FileTree({
  workspaceId,
  onSelectFile,
}: {
  workspaceId: string;
  onSelectFile: (path: string, content: string) => void;
}) {
  const { t } = useLang();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

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

  function filterNodes(nodes: FileNode[], q: string): FileNode[] {
    if (!q) return nodes;
    const result: FileNode[] = [];
    for (const n of nodes) {
      if (n.type === "dir" && n.children) {
        const filtered = filterNodes(n.children, q);
        if (filtered.length > 0 || n.name.toLowerCase().includes(q.toLowerCase())) {
          result.push({ ...n, children: filtered });
        }
      } else if (n.name.toLowerCase().includes(q.toLowerCase()) || n.path.toLowerCase().includes(q.toLowerCase())) {
        result.push(n);
      }
    }
    return result;
  }

  function renderNode(node: FileNode, depth: number = 0): React.ReactNode {
    const indent = { paddingLeft: `${depth * 16 + 4}px` };
    if (node.type === "dir") {
      const isOpen = search ? true : expanded.has(node.path);
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

  if (loading) return <Spinner label={t("loadingFiles")} />;
  if (error) return <ErrorState message={error} />;

  const displayTree = search ? filterNodes(tree, search) : tree;

  if (tree.length === 0) {
    return <EmptyState icon="▣" title={t("noFiles")} description={t("noFilesDesc")} />;
  }

  return (
    <>
      <div className="file-search">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchFiles")}
        />
      </div>
      <div className="filetree">{displayTree.map((node) => renderNode(node))}</div>
    </>
  );
}
