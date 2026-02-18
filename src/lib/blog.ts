import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const BLOG_DIRECTORY = path.join(process.cwd(), "content", "blog");
const WORDS_PER_MINUTE = 220;

export interface BlogPostMeta {
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  tags: string[];
  readTimeMinutes: number;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
}

interface ParsedPost {
  meta: BlogPostMeta;
  content: string;
}

function isPublished(draft: unknown): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return draft !== true;
}

function isValidDate(date: string): boolean {
  const value = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(value.getTime());
}

function calculateReadTimeMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

function assertString(value: unknown, fieldName: string, fileName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid or missing '${fieldName}' in ${fileName}`);
  }

  return value.trim();
}

function assertTags(value: unknown, fileName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error(`Invalid or missing 'tags' in ${fileName}`);
  }

  return value.map((item) => item.trim());
}

function parsePost(fileName: string, fileContent: string): ParsedPost | null {
  const { data, content } = matter(fileContent);

  if (!isPublished(data.draft)) {
    return null;
  }

  const title = assertString(data.title, "title", fileName);
  const date = assertString(data.date, "date", fileName);
  const slug = assertString(data.slug, "slug", fileName);
  const excerpt = assertString(data.excerpt, "excerpt", fileName);
  const tags = assertTags(data.tags, fileName);

  if (!isValidDate(date)) {
    throw new Error(`Invalid 'date' in ${fileName}. Use YYYY-MM-DD.`);
  }

  return {
    meta: {
      title,
      date,
      slug,
      excerpt,
      tags,
      readTimeMinutes: calculateReadTimeMinutes(content),
    },
    content,
  };
}

async function getParsedPosts(): Promise<ParsedPost[]> {
  const fileNames = await readdir(BLOG_DIRECTORY);
  const markdownFiles = fileNames.filter(
    (fileName) => fileName.endsWith(".md") && !fileName.startsWith("_")
  );

  const parsedPosts = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const filePath = path.join(BLOG_DIRECTORY, fileName);
      const fileContent = await readFile(filePath, "utf8");
      return parsePost(fileName, fileContent);
    })
  );

  return parsedPosts
    .filter((post): post is ParsedPost => post !== null)
    .sort(
      (a, b) =>
        new Date(`${b.meta.date}T00:00:00.000Z`).getTime() -
        new Date(`${a.meta.date}T00:00:00.000Z`).getTime()
    );
}

export async function getAllPostsMeta(): Promise<BlogPostMeta[]> {
  const posts = await getParsedPosts();
  return posts.map((post) => post.meta);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const posts = await getParsedPosts();
  const post = posts.find((item) => item.meta.slug === slug);

  if (!post) {
    return null;
  }

  return {
    ...post.meta,
    content: post.content,
  };
}

export async function getAllPostSlugs(): Promise<string[]> {
  const posts = await getParsedPosts();
  return posts.map((post) => post.meta.slug);
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return processed.toString();
}

export function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
