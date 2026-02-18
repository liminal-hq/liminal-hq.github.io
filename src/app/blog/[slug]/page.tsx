import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  formatPostDate,
  getAllPostSlugs,
  getPostBySlug,
  markdownToHtml,
} from "@/lib/blog";
import { getSiteUrl } from "@/lib/site";

const siteUrl = getSiteUrl();

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found | Liminal HQ",
    };
  }

  return {
    title: `${post.title} | Liminal HQ`,
    description: post.excerpt,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${siteUrl}/blog/${post.slug}`,
      siteName: "Liminal HQ",
      type: "article",
      publishedTime: `${post.date}T00:00:00.000Z`,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const html = await markdownToHtml(post.content);

  return (
    <div className="container-custom">
      <Header />

      <main className="section">
        <article className="mx-auto max-w-3xl">
          <Link href="/blog" className="mb-8 inline-flex text-sm text-[var(--text-muted)] transition-colors hover:text-white">
            ← Back to Blog
          </Link>

          <header className="mb-10 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <span aria-hidden="true">•</span>
              <span>{post.readTimeMinutes} min read</span>
            </div>
            <h1 className="text-4xl text-white md:text-5xl">{post.title}</h1>
            <ul className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={`${post.slug}-${tag}`} className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs text-white">
                  {tag}
                </li>
              ))}
            </ul>
          </header>

          <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </main>

      <Footer />
    </div>
  );
}
