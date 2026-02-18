import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const siteUrl = process.env.SITE_URL ?? "https://liminalhq.ca";
const blogDir = path.join(process.cwd(), "content", "blog");
const outputDir = path.join(process.cwd(), "public", "blog");
const outputPath = path.join(outputDir, "feed.xml");

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toIsoDate = (date) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value.getTime())) {
    throw new Error(`Invalid date '${date}'. Use YYYY-MM-DD.`);
  }
  return value;
};

const getPosts = async () => {
  const fileNames = await fs.readdir(blogDir);
  const markdownFiles = fileNames.filter(
    (fileName) => fileName.endsWith(".md") && !fileName.startsWith("_")
  );

  const posts = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const filePath = path.join(blogDir, fileName);
      const raw = await fs.readFile(filePath, "utf8");
      const { data } = matter(raw);

      if (data.draft === true) {
        return null;
      }

      const title = typeof data.title === "string" ? data.title.trim() : "";
      const slug = typeof data.slug === "string" ? data.slug.trim() : "";
      const date = typeof data.date === "string" ? data.date.trim() : "";
      const excerpt = typeof data.excerpt === "string" ? data.excerpt.trim() : "";

      if (!title || !slug || !date || !excerpt) {
        throw new Error(`Missing required front matter in ${fileName}`);
      }

      return { title, slug, date, excerpt, publishedAt: toIsoDate(date) };
    })
  );

  return posts
    .filter((post) => post !== null)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
};

const buildRss = (posts) => {
  const items = posts
    .map((post) => {
      const url = `${siteUrl}/blog/${post.slug}`;
      return [
        "  <item>",
        `    <title>${escapeXml(post.title)}</title>`,
        `    <link>${escapeXml(url)}</link>`,
        `    <guid isPermaLink=\"true\">${escapeXml(url)}</guid>`,
        `    <pubDate>${post.publishedAt.toUTCString()}</pubDate>`,
        `    <description>${escapeXml(post.excerpt)}</description>`,
        "  </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    "  <title>Liminal HQ Blog</title>",
    "  <description>Technical deep dives, calm computing philosophy, and updates from Liminal HQ.</description>",
    `  <link>${escapeXml(`${siteUrl}/blog`)}</link>`,
    `  <atom:link href=\"${escapeXml(`${siteUrl}/blog/feed.xml`)}\" rel=\"self\" type=\"application/rss+xml\" />`,
    items,
    "</channel>",
    "</rss>",
    "",
  ].join("\n");
};

const main = async () => {
  const posts = await getPosts();
  const rss = buildRss(posts);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, rss, "utf8");
  process.stdout.write(`Generated RSS feed at ${path.relative(process.cwd(), outputPath)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
