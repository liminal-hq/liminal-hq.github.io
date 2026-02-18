import Image from "next/image";

export default function Footer() {
  return (
    <footer className="py-20 mt-20 border-t border-[rgba(255,255,255,0.1)] text-[#9ca3af] text-sm flex justify-between items-center">
      <div>
        <span className="mb-2 flex items-center gap-2 font-bold tracking-[0.05em] text-white [font-feature-settings:smcp] [font-variant:small-caps]">
          <Image src="/liminalhq-mark-v1.svg" alt="Liminal HQ" width={20} height={20} className="h-5 w-5" />
          liminal hq
        </span>
        <p>Designed & Coded in Canada 🍁</p>
      </div>

      <div className="text-right">
        <p>&copy; 2026 Liminal HQ Inc.</p>
        <p className="mt-2">
          <a href="https://github.com/liminal-hq" className="hover:text-white transition-colors">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
