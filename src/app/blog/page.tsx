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

      <main className="space-y-10 pb-24 pt-4 md:pt-6">
        <header className="relative py-8 text-center md:py-12">
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
              Technical deep dives, calm computing philosophy, and updates from our studio.
            </p>
          </div>
        </header>

        <section>
          <h2 className="mb-8 text-sm font-bold uppercase tracking-widest text-neutral-500">Latest Entries</h2>
          <div className="grid gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#0a0a0a] p-6 transition-all duration-300 hover:border-neutral-700 hover:shadow-2xl hover:shadow-orange-900/10 md:p-9"
              >
                <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-orange-500 to-pink-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                <ul className="mb-6 flex flex-wrap gap-3">
                  {post.tags.map((tag) => (
                    <li
                      key={`${post.slug}-${tag}`}
                      className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-400 transition-colors group-hover:border-neutral-700"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>

                <h3 className="text-3xl font-bold leading-tight md:text-5xl">
                  <Link href={`/blog/${post.slug}`} className="relative inline-block">
                    <span className="transition-opacity duration-300 group-hover:opacity-0">{post.title}</span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-r from-[#ffb27a] to-[#ff6ea8] bg-clip-text text-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    >
                      {post.title}
                    </span>
                  </Link>
                </h3>

                <p className="mt-6 max-w-4xl text-lg leading-relaxed text-neutral-400">{post.excerpt}</p>

                <div className="my-8 h-px bg-neutral-900"></div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-[1.05rem] text-neutral-500">
                  <div className="flex items-center gap-4">
                    <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                    <span aria-hidden="true">•</span>
                    <span>{post.readTimeMinutes} min read</span>
                  </div>
                  <Link href={`/blog/${post.slug}`} className="font-semibold text-neutral-100 transition-colors group-hover:text-white">
                    Read Article &nbsp;›
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
