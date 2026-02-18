import Image from "next/image";

export default function Footer() {
  return (
    <footer className="mt-14 flex flex-col gap-6 border-t border-[rgba(255,255,255,0.14)] py-10 text-sm text-[var(--text-muted)] md:flex-row md:items-center md:justify-between md:py-16">
      <div>
        <span className="mb-2 flex items-center gap-2 font-bold tracking-[0.05em] text-white [font-feature-settings:smcp] [font-variant:small-caps]">
          <Image src="/liminalhq-mark-v1.svg" alt="" width={20} height={20} className="h-5 w-5" />
          liminal hq
        </span>
        <p>Designed & Coded in Canada 🍁</p>
      </div>

      <div className="text-left md:text-right">
        <p>&copy; 2026 Liminal HQ</p>
        <p className="mt-2">
          <a href="https://github.com/liminal-hq" className="hover:text-white transition-colors">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
