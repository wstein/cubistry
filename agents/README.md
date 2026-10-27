# Agent roles and Codex skills

`AGENTS.md` is the entry point for global working rules. `.agents/skills/` contains task-specific Codex skill definitions (each with `SKILL.md`). The Obsidian-compatible `knowledge/` vault records knowledge, ADRs, specs and plans.

A role definition describes *who reviews or implements*; a skill describes *how a repeatable task is performed*. This folder may later contain architect, domain-engineer, math-verifier, artwork-designer and reviewer role briefs. No agent orchestration is implied by adding Markdown role files.

Current reusable skills: `feasibility-spike`, `proof-review`, `validate-artwork`. Every conclusion should link to reproducible evidence, and accepted ADRs are not autonomously changed.
