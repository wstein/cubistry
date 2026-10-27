# Agent roles and Codex skills

`AGENTS.md` is the entry point for global working rules. `.agents/skills/` contains task-specific Codex skill definitions (each with `SKILL.md`). The Obsidian-compatible `knowledge/` vault records knowledge, ADRs, specs and plans.

A role definition describes *who reviews or implements*; a skill describes *how a repeatable task is performed*. This folder may later contain architect, domain-engineer, math-verifier, artwork-designer and reviewer role briefs. No agent orchestration is implied by adding Markdown role files.

For delegated implementation, the author creates a draft PR and fixes findings; a separate reviewer clears the final head, comments on the PR, and owns the change to Ready for review. The coordinator manages the author/reviewer handoff. See the [workflow](../CONTRIBUTING.md#independent-agent-review) and [PR review skill](../.agents/skills/pr-review/SKILL.md). Role prose does not spawn agents by itself.

Current reusable skills: `feasibility-spike`, `proof-review`, `validate-artwork`, `pr-review`. Every conclusion should link to reproducible evidence, and accepted ADRs are not autonomously changed.
