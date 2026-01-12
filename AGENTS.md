# Project Context: liminal-hq.github.io

## Description

This is a personal website/portfolio built with Next.js and deployed to GitHub Pages. The project uses modern React patterns and Tailwind CSS for styling.

## Coding Standards

- **Spelling:** Must use Canadian Spelling for things that don't require American spelling (e.g., UI strings, variables, comments). Examples: "colour", "center" -> "centre", "behavior" -> "behaviour".
- **Commit Messages:** Use Conventional Commits (e.g., `feat: add scanner`, `fix: typo in header`).

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

- `src/app`: Next.js App Router pages and layouts.
- `public`: Static assets (images, fonts, etc.).
- `.github/workflows`: CI/CD configurations (specifically `deploy.yml` for GitHub Pages).
- `out`: Output directory for static export (generated during build).

## Deployment

The project is deployed to **GitHub Pages** via GitHub Actions.

- **Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` branch.
- **Process**: Installs dependencies, builds the project, and uploads the `./out` directory as a GitHub Pages artifact.


