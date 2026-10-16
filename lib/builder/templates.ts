// SERVER-ONLY. Builds a bot's repo files from templates/<name>: the AI fills
// only the declared content file (lib/bot-builder/template-filler.ts), the
// result is validated, and the spec-derived content is the fallback. Owner
// edits (configOverride) and the cached first fill (filledConfig) win, so reruns
// are deterministic. Prompts only ever contain the spec — never secrets.

import { readTemplate, fillTemplate } from "@/lib/bot-builder/template-filler";
import { resolveBotBuilderModel } from "@/lib/bot-builder/requirements-agent";
import { redactSecrets } from "@/lib/redact";
import { assembleFiles, contentFromSpec, contentPath, normalizeContent, templateFor } from "./template-content";
import type { BuilderDeps } from "./types";

export const templatesAdapter: BuilderDeps["templates"] = {
  async build(req, ctx) {
    const spec = req.spec;
    const template = templateFor(spec);
    const warnings: string[] = [];
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    let content = req.configOverride ? normalizeContent(template, req.configOverride) : null;
    if (!content && req.filledConfig) content = normalizeContent(template, req.filledConfig);

    if (!content) {
      const model = resolveBotBuilderModel();
      if (model) {
        try {
          const fill = await fillTemplate(model, spec);
          usage = fill.usage;
          warnings.push(...fill.warnings.map((w) => redactSecrets(String(w)).slice(0, 300)));
          const file = fill.files.find((f) => f.path === contentPath(template));
          if (file) content = normalizeContent(template, JSON.parse(file.content));
          if (!content) warnings.push("AI fill was not valid; used your answers directly");
        } catch {
          warnings.push("AI fill unavailable; used your answers directly");
        }
      }
    }
    if (!content) content = normalizeContent(template, contentFromSpec(spec)) ?? contentFromSpec(spec);

    const files = assembleFiles(readTemplate(template), template, content, { botUsername: ctx.botUsername });
    return { template, files, content, warnings, usage };
  },
};
