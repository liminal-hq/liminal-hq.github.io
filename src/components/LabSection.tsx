import Link from "next/link";
import { getAllPostsMeta } from "@/lib/blog";

function formatLabDate(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export default async function LabSection() {
  const posts = await getAllPostsMeta();
  const latestPosts = posts.slice(0, 3);

  return (
    <section id="lab" className="py-16 md:py-20">
      <h2 className="mb-3 text-[1.75rem] font-semibold text-white md:text-[2rem]">From the Blog</h2>
      <p className="mb-8 max-w-3xl text-[var(--text-muted)]">
        Recent writing on local-first software, tooling, and design decisions from current studio work.
      </p>
      <ul className="list-none">
        {latestPosts.map((post, index) => (
          <li
            key={post.slug}
            className={`grid grid-cols-1 items-start gap-2 border-b border-[rgba(255,255,255,0.1)] py-6 transition-all duration-300 md:grid-cols-[120px_1fr] md:items-center md:gap-4 md:py-8 md:hover:border-l-[3px] md:hover:border-l-[#22d3ee] md:hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent)] md:hover:pl-4 ${
              index === 0 ? "border-t" : ""
            }`}
          >
            <span className="font-[var(--font-space-grotesk)] text-[0.8rem] font-semibold text-[#22d3ee] md:text-[0.9rem]">
              {formatLabDate(post.date)}
            </span>
            <Link
              href={`/blog/${post.slug}`}
              className="text-[1.1rem] font-medium text-[#e0e0e0] hover:text-white md:text-[1.25rem]"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
