# Knowledge conventions

## Principles

- One enduring idea per Zettel; connect ideas rather than duplicating long passages.
- Keep research and hypotheses in `zettel/`; use `adr/` only for explicit, consequential decisions; use `specs/` for normative/testable requirements.
- `plans/` describe approaches; `milestones/` capture durable outcomes. Track actionable work and status exclusively in GitHub Issues; use PRs for implementation, review and delivery. Do not create task lists or task mirrors in the vault.
- Treat the repository Markdown as authoritative. Obsidian may be used without proprietary plugins, configuration, or external services.
- Prefer relative Markdown links, which work in GitHub and Obsidian. Optional `[[wikilinks]]` may help local navigation but should not be the only route to an important document.
- Use short, descriptive filenames; Zettel IDs use UTC date plus a unique descriptive slug (`YYYYMMDD-topic`). Never reuse an ID.
- Frontmatter is YAML with `id`, `title`, `type`, `status`, and `created`; use ISO date strings for dates. Keep link relationships as ordinary Markdown links.
- Statuses: Zettel `fleeting | literature | permanent`; ADR `proposed | accepted | superseded | rejected`; spec `draft | approved | deprecated`. Status is informative, not an automated certificate.
- A decision never silently changes: record context, options, consequences, and a link to the replacing ADR if superseded.
- Do not equate a hypothesis, a SAT solver result, an independently checked proof, and a physically reachable state. Link to exact artifacts, revision and verification boundaries.
- Store editable assets in `assets/`, preferably SVG for vector graphics; PNG remains an optional raster format. Avoid committing local `.obsidian/workspace*` or personal settings.

## Templates

Copy the matching starter file and replace placeholders:
- [Zettel](templates/zettel.md)
- [ADR](templates/adr.md)
- [Specification](templates/spec.md)

## Repository integration

`knowledge/` is the Obsidian vault root. Keep `docs/`, `results/` and source code in their existing locations. Use relative links to reference external-in-vault documents (e.g. `../../docs/WORDMARK.md` from a file inside `knowledge/zettel/`, once that document is present on the target branch). Architecture changes should be reviewed in focused PRs separate from unrelated mathematical experiments.
