# Liminal HQ

**Digital tools for the spaces in between.**
An independent studio building local-first applications.
We build software that feels more human without becoming less powerful.

## Projects

- **[Threshold](https://github.com/liminal-hq/threshold)** – Flexible time window alarms for life-first scheduling.
- **[Liminal Notes](https://github.com/ScottMorris/liminal-notes)** – Local-first, Markdown-based note-taking.
- **[Flow](https://github.com/liminal-hq/flow)** – Calm, local-first focus sessions for intentional deep work.
- **[City Sim 1000](https://github.com/ScottMorris/city-sim-1000)** – Low-poly city simulation in the browser.
- **[Emoji Nook](https://github.com/liminal-hq/emoji-nook)** – Native Linux emoji picker for GNOME, KDE, and other desktop environments.
- **[SMDU](https://github.com/ScottMorris/smdu)** – Terminal disk usage analyser.
- **[Coherence Chat Exporter](https://github.com/liminal-hq/coherence-chat-exporter)** – CLI for archiving AI conversations into organised, tagged Markdown across providers.
- **[Keep Note Converter](https://github.com/ScottMorris/keep-note-converter)** – Installable Next.js PWA that converts pasted rich text into Google Keep-compatible markup.

## Site Architecture

This portfolio is built with modern web standards:

- **Next.js 16** (App Router, Static Export)
- **React 19**
- **Tailwind CSS 4**
- **TypeScript**
- **Metadata routes** for `sitemap.xml` and `robots.txt`
- **RSS feed** generated during build

## Development

```bash
nvm use
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view locally.

The repo includes a `.nvmrc` file so local development and GitHub Actions use the same Node.js version (`22.21.1`).

## Configuration

Environment variables used by the site:

- `NEXT_PUBLIC_SITE_URL` or `SITE_URL` for metadata, sitemap, robots, and RSS URLs (defaults to `https://liminalhq.ca`).
- `PAGES_BASE_PATH` for GitHub Pages deployments when the site is served from a subpath.

## Deployment

Automated via **GitHub Actions** to GitHub Pages. Pushing to `main` builds and deploys the `out/` directory.
The deploy workflow reads the Node.js version from `.nvmrc`, installs dependencies with `pnpm`, and builds the static export from `out/`.

## Blog

Blog posts live in `content/blog` as Markdown files with front matter.

### Add a new post

1. Copy `content/blog/_template.md` to a new file named `YYYY-MM-DD-your-slug.md`.
2. Fill in front matter fields:
   - `title`
   - `date` (format: `YYYY-MM-DD`)
   - `slug` (URL path, for example `wear-os-tauri`)
   - `excerpt`
   - `tags` (string array)
   - `draft` (`true` or `false`)
3. Write the article body in standard Markdown below the front matter.
4. Run `pnpm build` and confirm the post appears at `/blog`.

Draft behaviour:
- `draft: true` posts are hidden in production builds.
- Draft posts still appear during local development.

RSS feed:
- Generated at build time to `public/blog/feed.xml`.
- Published URL: `/blog/feed.xml`.
- Override site URL by setting `SITE_URL` or `NEXT_PUBLIC_SITE_URL` during build (default: `https://liminalhq.ca`).

## Testing

```bash
pnpm lint
pnpm test
```
