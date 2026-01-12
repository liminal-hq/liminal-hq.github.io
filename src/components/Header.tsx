import Link from "next/link";

export default function Header() {
  return (
    <header className="flex justify-between items-center py-8">
      <Link href="#" className="flex items-center gap-3 text-white font-bold text-xl tracking-[0.08em] [font-variant:small-caps] [font-feature-settings:smcp]">
        <div className="w-7 h-7 rounded-lg shadow-[0_0_15px_rgba(244,63,94,0.3)] bg-[linear-gradient(135deg,#ffaa40,#f43f5e,#a78bfa)]"></div>
        liminal hq
      </Link>
      <nav>
        <ul className="flex list-none gap-10">
          {["Work", "Philosophy", "Lab"].map((item) => (
            <li key={item}>
              <Link
                href={`#${item.toLowerCase()}`}
                className="text-[0.95rem] font-medium text-[#9ca3af] relative transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                {item}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="mailto:hello@liminalhq.ca"
              className="text-[0.95rem] font-medium text-[#9ca3af] relative transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
