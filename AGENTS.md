# Project Context: liminal-hq.github.io

## Description

This is a personal website/portfolio built with Next.js and deployed to GitHub Pages. The project uses modern React patterns and Tailwind CSS for styling.

## Coding Standards

- **Spelling:** Must use Canadian Spelling for things that don't require American spelling (e.g., UI strings, variables, comments). Examples: "colour", "center" -> "centre", "behavior" -> "behaviour".
- **Commit Messages:** Use Conventional Commits (e.g., `feat: add scanner`, `fix: typo in header`).
- **TypeScript First:** Prefer explicit, readable TypeScript over loose or implicit patterns. Reuse existing types before introducing new ones.
- **Design Tokens:** Prefer existing CSS variables and shared theme tokens over hard-coded colours, spacing, or one-off styling values.
- **Pattern Consistency:** Follow established Next.js App Router, React, and Tailwind patterns already present in the repo before introducing a new approach.
- **Accessibility:** Preserve semantic HTML, keyboard focus states, and meaningful link or button labels. Do not trade accessibility for visual polish.
- **Content Changes:** Keep user-facing copy aligned with the site voice: calm, clear, concise, and product-focused.
- **Minimalism:** Avoid adding new dependencies, abstractions, or complexity unless they clearly improve maintainability or user experience.

## Commit Messages

**Format:** Use Conventional Commits format (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`).

- Use `test:` for test-related changes, including fixes to tests themselves (do not use `fix:` unless it fixes application code).

**Body Requirements:**

- Explain what and why (not how)
- Use markdown: **bold**, _italics_, `code`, bullet lists
- **NO markdown headings** - use **bold labels** for sections (not always required)
- When a commit body includes backticked code in shell commands, avoid command substitution by using single-quoted `-m` strings (preferred) or escaping backticks.
  - Example (preferred): `git commit -m 'fix: ...' -m 'Use `projectCard` in work section'`
  - Example (escape): `git commit -m "Use \`projectCard\` in work section"`

**Specific Updates**: Each commit message should reflect the specific changes made in that commit. Do not just recap the entire project history or scope. Focus on the now.

**Shell Interpolation Safety:**

- Do not pass markdown-heavy commit bodies directly via `git commit -m "..."` when they include backticks, `$()`, or shell-sensitive characters.
- Prefer writing the message to a file with a single-quoted heredoc and commit with `git commit -F <file>` to prevent shell expansion.
- If using `-m`, escape shell-sensitive characters explicitly before running the command.
- After committing, verify the stored message with `git log -1 --pretty=fuller` and amend immediately if interpolation altered content.

## Pull Request Titles

**Requirement:** PR titles must be human-readable summaries of the PR change.

- Start with a capital letter.
- Do not use Conventional Commit prefixes in PR titles (for example, no `feat:`, `fix:`, `chore:`).
- Describe the outcome or behaviour change, not internal process language.
- Ignore internal planning document notes in PR titles and descriptions unless they directly map to repository changes.
- Keep title style consistent across every open PR in the same stack.
- If one title in a stack is updated, update the rest of the open stack titles to match style and scope.
- Do not rename merged PRs unless explicitly requested.
- Keep linked issues and merge order aligned after any title changes in a stack.

## Pull Request Content

**Requirement:** PR titles and descriptions must not mention internal workflow artefacts.

- Do not mention deferred-review documents, internal queue labels, or internal-only planning notes in outward PR content.
- Keep internal triage mechanics in local runbooks, internal labels, and agent workflows only.
- Use user-facing, outcome-focused language in PR titles and descriptions.
- Only include internal process details in PR content when explicitly requested by the user.

## Pull Request Labels

**Requirement:** Every PR must include labels that describe the change and map to release-note categories.

- Add at least one category label to every PR: `feat`, `feature`, `enhancement`, `fix`, `bug`, `bugfix`, `docs`, `test`, `ci`, `build`, or `chore`.
- Add additional scope labels where helpful (for example, `site`, `blog`, `ui`, `seo`).
- Use `skip-changelog` only when a change should be excluded from generated release notes.
- Keep labels accurate as scope changes during review.

## Documentation

- **Updates:** When user-facing behaviour, navigation, project listings, blog structure, or deployment behaviour changes, update the relevant documentation in `README.md`, `AGENTS.md`, and supporting content files.
- **Accuracy:** Keep setup steps, deployment notes, and project descriptions aligned with the current codebase and GitHub Pages workflow.
- **Scope:** Update only the docs affected by the change. Do not rewrite unrelated sections while making a focused change.
- **Content:** When adding or revising portfolio entries or blog content, keep descriptions specific, current, and consistent with the site's editorial tone.

## Technology Stack

| Category        | Technology   | Version |
| --------------- | ------------ | ------- |
| Framework       | Next.js      | 16.1.1  |
| UI Library      | React        | 19.2.3  |
| Language        | TypeScript   | 5.x     |
| Styling         | Tailwind CSS | 4.x     |
| Linting         | ESLint       | 9.x     |
| Package Manager | pnpm         | 10.x    |

## Key Commands

Run these commands from the project root:

- **Install Dependencies**: `pnpm install`
- **Start Dev Server**: `pnpm dev` (Runs on `localhost:3000`)
- **Build for Production**: `pnpm build` (Outputs information to `.next`, static export to `out`)
- **Lint Code**: `pnpm lint`

## Project Structure

- `src/app`: Next.js App Router routes, layouts, metadata, and global styles.
- `src/components`: Reusable site sections and presentation components.
- `src/lib`: Shared site data, blog helpers, and metadata utilities.
- `content/blog`: Markdown source for blog posts.
- `public`: Static assets such as images, icons, and brand files.
- `.github/workflows`: CI/CD configuration, especially `deploy.yml` for GitHub Pages.
- `out`: Static export output generated during production builds.

**Structure Guidance:**

- Keep route logic in `src/app`, shared rendering in `src/components`, and reusable data/helpers in `src/lib`.
- Keep content-driven changes in `content/` where possible rather than hard-coding long-form copy into components.
- Prefer extending an existing section or data file before creating a new top-level pattern.
- Preserve the separation between content, presentation, and site metadata.

## Deployment

The project is deployed to **GitHub Pages** via GitHub Actions.

- **Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` branch.
- **Process**: Installs dependencies, builds the project, and uploads the `./out` directory as a GitHub Pages artifact.

## Licence and Copyright

- **Requirement:** New source files, and substantially rewritten source files, should include a short header as the first content in the file when the surrounding code in that area follows the same pattern.
- **Applies to:** `.ts`, `.tsx`, and `.js` source files in `src/` and related scripts where appropriate.
- **Do not add headers to:** generated files, lockfiles, config files, markdown content, workflow files, or static assets.
- **Consistency:** Preserve existing valid headers when they are already present, but do not add boilerplate headers to untouched files just for consistency.

Preferred header format for source files:

```ts
// Brief one-line summary of what this file does
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: MIT
```

- Keep the summary concise and place the header before imports.
