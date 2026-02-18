# Liminal HQ

**Digital tools for the spaces in between.**
An independent studio building local-first applications.

## Projects

- **[Liminal Notes](https://github.com/ScottMorris/liminal-notes)** – Local-first, Markdown-based note-taking.
- **[City Sim 1000](https://github.com/ScottMorris/city-sim-1000)** – Low-poly city simulation in the browser.
- **[SMDU](https://github.com/ScottMorris/smdu)** – Terminal disk usage analyser.

## Site Architecture

This portfolio is built with modern web standards:

- **Next.js 16** (App Router, Static Export)
- **React 19**
- **Tailwind CSS 4**
- **TypeScript**

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view locally.

## Deployment

Automated via **GitHub Actions** to GitHub Pages. Pushing to `main` builds and deploys the `out/` directory.

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
- Override site URL by setting `SITE_URL` during build (default: `https://liminalhq.ca`).
