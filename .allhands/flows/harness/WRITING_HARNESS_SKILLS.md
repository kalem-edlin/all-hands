<goal>
Guide agents through skill creation and maintenance. Per **Context is Precious**, skills follow the hub-and-spoke model — a compact routing hub with domain-specific reference docs.
</goal>

<inputs>
- Skill domain and purpose
- Reference docs needed for the skill's knowledge areas
</inputs>

<outputs>
- Skill following hub-and-spoke conventions with schema-compliant SKILL.md and reference docs
</outputs>

<constraints>
- MUST follow hub-and-spoke pattern — SKILL.md routes, references teach
- MUST comply with skill schema (frontmatter, globs, version)
- NEVER duplicate knowledge across reference docs
</constraints>

## Execution

- Read `.allhands/principles.md` for first principle context
- Run `ah skills search` to discover the `harness-maintenance` skill
- Read the skill's `references/harness-skills.md` for skill schema, discovery mechanism, and conventions
- Create or update the skill following hub-and-spoke pattern
- Ensure glob coverage matches the skill's domain files
- Verify schema compliance and reference doc cross-linking
