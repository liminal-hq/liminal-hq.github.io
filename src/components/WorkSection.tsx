import Link from "next/link";
import styles from "./WorkSection.module.css";

export default function WorkSection() {
  return (
    <section id="work" className="py-28">
      <h2 className="text-[2rem] font-semibold text-white mb-8">Selected Work</h2>

      {/* Liminal Notes (Flagship) */}
      <article className={`${styles.projectCard} cursor-pointer`}>
        <span className="text-xs uppercase tracking-[0.1em] text-[#ffaa40] font-bold mb-4 inline-block border border-[rgba(255,170,64,0.3)] px-[10px] py-1 rounded">
          Flagship Product
        </span>
        <h3 className="text-[2.5rem] mb-4 text-white">Liminal Notes</h3>
        <p className="max-w-[650px] text-[#9ca3af] mb-10 text-[1.15rem]">
          A graph-based, local-first knowledge management environment.
          Built with Rust and Tauri for speed, designed with Markdown for longevity.
        </p>
        <Link
          href="/liminal-notes-site/index.html"
          className="inline-flex items-center gap-[10px] font-semibold text-white bg-[rgba(255,255,255,0.1)] px-6 py-3 rounded-[30px] transition-all duration-300 hover:bg-[#ffaa40] hover:text-black hover:translate-x-[5px]"
        >
          View Product Site →
        </Link>
      </article>

      {/* Experiments */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8">
        <article className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.1)] p-8 rounded-2xl transition-all duration-300 hover:bg-[rgba(255,255,255,0.05)] hover:border-[#f43f5e]">
          <span className="text-xs uppercase tracking-[0.1em] text-[#a78bfa] font-bold mb-4 inline-block border border-[#a78bfa] px-[10px] py-1 rounded">
            Protocol
          </span>
          <h3 className="mt-2 text-white text-[2rem] mb-4">Echo Sync</h3>
          <p className="mb-6 text-[#9ca3af]">
            A peer-to-peer, end-to-end encrypted synchronization protocol. No central authority required.
          </p>
          <a
            href="#"
            className="text-[0.9rem] text-white border-b border-[#a78bfa] pb-[2px]"
          >
            Read Whitepaper
          </a>
        </article>

        <article className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.1)] p-8 rounded-2xl transition-all duration-300 hover:bg-[rgba(255,255,255,0.05)] hover:border-[#22d3ee]">
          <span className="text-xs uppercase tracking-[0.1em] text-[#22d3ee] font-bold mb-4 inline-block border border-[#22d3ee] px-[10px] py-1 rounded">
            Experiment
          </span>
          <h3 className="mt-2 text-white text-[2rem] mb-4">Project Aether</h3>
          <p className="mb-6 text-[#9ca3af]">
            Ambient computing interfaces for the modern workspace. Exploring digital calmness.
          </p>
          <a
            href="#"
            className="text-[0.9rem] text-white border-b border-[#22d3ee] pb-[2px]"
          >
            View Case Study
          </a>
        </article>
      </div>
    </section>
  );
}
