# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal studio site for Liminal HQ, built with Next.js 16 (App Router, static export) and deployed to GitHub Pages. Content is a mix of hard-coded portfolio data and Markdown-driven blog posts.

## Commands

Run from the project root. Use the repo's pinned Node version first (`.nvmrc`, currently `22.21.1`):

```bash
nvm use
pnpm install
pnpm dev            # localhost:3000
pnpm build           # runs scripts/generate-rss.mjs, then `next build` (static export to ./out)
pnpm lint            # eslint
pnpm test            # tsx --test tests/**/*.test.ts
```

Run a single test file directly with `tsx`, e.g. `pnpm exec tsx --test tests/work-section-accent.test.ts`.

There is no separate typecheck script — TypeScript errors surface during `pnpm build`.

## Architecture

- **Static export, no server runtime.** `next.config.ts` sets `output: "export"`. `PAGES_BASE_PATH` is injected at build time by the deploy workflow when the site is served from a subpath; don't assume a Node server is available at runtime.
- **`src/app`** — App Router routes, layouts, and metadata routes (`sitemap.ts`, `robots.ts`). `layout.tsx` loads the two site fonts (Inter, Space Grotesk) and sets shared metadata (uses `getSiteUrl()` for canonical/OG URLs).
- **`src/components`** — presentational sections composed directly in `src/app/page.tsx` (Header, HeroSection, PhilosophySection, WorkSection, LabSection, Footer). Section components fetch their own data (e.g. `LabSection` calls `getAllPostsMeta()` directly as an async Server Component).
- **`src/lib`** — shared logic: `blog.ts` (Markdown pipeline — parses front matter with `gray-matter`, validates required fields, renders via `remark`/`remark-gfm`/`remark-rehype`/`rehype-highlight`, computes read time) and `site.ts` (`getSiteUrl()`, reads `NEXT_PUBLIC_SITE_URL`/`SITE_URL`, falls back to `https://liminalhq.ca`).
- **`content/blog`** — Markdown source of truth for posts. Copy `content/blog/_template.md` to `YYYY-MM-DD-your-slug.md`; required front matter: `title`, `date` (`YYYY-MM-DD`), `slug`, `excerpt`, `tags` (string array), `draft`. `blog.ts` throws on missing/invalid front matter, so a malformed post fails the build. `draft: true` posts are hidden only when `NODE_ENV === "production"`; they still render locally.
- **Portfolio data lives in code, not content**: `src/components/work-section-data.ts` defines `selectedWork` and `experiments` (`ProjectCard[]`) rendered by `WorkSection`/related components. Each card's `accentColour` drives both badge and outline styling via `getProjectAccentStyles`/`getProjectCardCssVariables` — the outline must always track the badge colour (enforced by `tests/work-section-accent.test.ts`). Extend these arrays rather than hard-coding new project markup elsewhere.
- **RSS feed**: `scripts/generate-rss.mjs` runs before `next build` (see the `build` script) and writes `public/blog/feed.xml` from the same blog data used by the app.
- **Theme tokens**: colours, gradients, and surface values are defined as CSS custom properties in `src/app/globals.css` (`--accent-orange`, `--accent-purple`, `--bg-color`, `--text-muted`, etc.) and Tailwind 4 is loaded via `@import "tailwindcss"` — prefer these tokens over new hard-coded colour values.
- **Deployment**: `.github/workflows/deploy.yml` builds on every push to `main` (Node version from `.nvmrc`, pnpm install, `pnpm run build`, `PAGES_BASE_PATH` from `actions/configure-pages`) and publishes `./out` to GitHub Pages.

## Conventions

- **Canadian spelling** for UI strings, variables, and comments where it doesn't conflict with API/technical terms (e.g. "colour", "behaviour", "centre").
- **Conventional Commits** for commit messages (`feat:`, `fix:`, `docs:`, `test:`, etc.). Use `test:` for test-only changes, not `fix:`. Body explains what/why, not how; use **bold labels** instead of markdown headings.
  - Avoid raw backticks/`$()` in `-m` commit messages (shell expansion risk) — prefer single-quoted `-m` strings or `git commit -F <file>` for anything with backticked code.
- **PR titles**: human-readable summaries starting with a capital letter, no Conventional Commit prefixes, describing outcome/behaviour rather than internal process. Every PR needs at least one category label (`bug`, `enhancement`, `chore`, `documentation`, `infrastructure`); add scope labels (`accessibility`, `ui/ux`, `blog`, `content`, `seo`) where relevant. Don't reference internal planning docs/queue labels in PR titles or descriptions. Open PRs ready for review by default — draft only when explicitly asked or clearly blocked.
- **Markdown formatting**: don't hard-wrap prose — write each paragraph/bullet as a single unwrapped line and let the renderer reflow it. Applies to commit bodies, PR/issue descriptions and comments, and docs under `content/`.
- **Git workflow**: don't push (especially force-push) unless explicitly requested.
- **Docs**: when user-facing behaviour, navigation, project listings, blog structure, or deployment changes, update `README.md` and/or `AGENTS.md` alongside the code change — scoped only to what changed.
- **License headers**: new or substantially rewritten `.ts`/`.tsx`/`.js` files in `src/` (and related scripts) get a short header before imports, matching existing files in that area:
  ```ts
  // Brief one-line summary of what this file does
  //
  // (c) Copyright 2026 Liminal HQ, Scott Morris
  // SPDX-License-Identifier: MIT
  ```
  Don't add headers to generated files, lockfiles, config files, Markdown content, workflow files, or static assets, and don't retrofit untouched files just for consistency.
- Prefer extending existing data files and patterns (e.g. `work-section-data.ts`, theme tokens, established App Router/Tailwind patterns) over introducing new abstractions or dependencies.
