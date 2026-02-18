import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatPostDate, getAllPostsMeta } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | Liminal HQ",
  description: "Technical writing and studio notes from Liminal HQ.",
};

export default async function BlogIndexPage() {
  const posts = await getAllPostsMeta();

  return (
    <div className="container-custom">
      <Header />

      <main className="section space-y-10">
        <header className="relative overflow-hidden py-14 text-center md:py-20">
          <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-indigo-900/20 blur-[120px]"></div>
          <div className="pointer-events-none absolute bottom-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-orange-900/10 blur-[120px]"></div>

          <div className="mx-auto max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-3 py-1 text-xs font-medium text-orange-400 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              Liminal Log
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl">
              Notes from the <br />
              <span className="bg-gradient-to-r from-orange-400 to-pink-600 bg-clip-text text-transparent">
                Digital Frontier.
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-neutral-400">
              Technical deep dives, calm computing philosophy, and updates from our studio in Kitchener.
            </p>
          </div>
        </header>

        <section>
          <h2 className="mb-8 text-sm font-bold uppercase tracking-widest text-neutral-500">Latest Entries</h2>
          <div className="grid gap-6">
            {posts.map((post) => (
              <article key={post.slug} className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)] p-6">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                  <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                  <span aria-hidden="true">•</span>
                  <span>{post.readTimeMinutes} min read</span>
                </div>

                <h2 className="text-2xl text-white">
                  <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-[var(--accent-orange)]">
                    {post.title}
                  </Link>
                </h2>

                <p className="mt-3 text-[var(--text-muted)]">{post.excerpt}</p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li key={`${post.slug}-${tag}`} className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs text-white">
                      {tag}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
