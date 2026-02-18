import Link from "next/link";

const navItems = [
  { label: "Work", href: "/#work" },
  { label: "Philosophy", href: "/#philosophy" },
  { label: "Lab", href: "/#lab" },
  { label: "Blog", href: "/blog" },
];

export default function Header() {
  return (
    <header className="flex items-center justify-between py-8">
      <Link
        href="/"
        className="flex items-center gap-3 text-xl font-bold tracking-[0.08em] text-white [font-feature-settings:smcp] [font-variant:small-caps]"
      >
        <div className="h-7 w-7 rounded-lg bg-[linear-gradient(135deg,#ffaa40,#f43f5e,#a78bfa)] shadow-[0_0_15px_rgba(244,63,94,0.3)]"></div>
        liminal hq
      </Link>
      <nav>
        <ul className="flex list-none gap-10">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="relative text-[0.95rem] font-medium text-[#9ca3af] transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="mailto:hello@liminalhq.ca"
              className="relative text-[0.95rem] font-medium text-[#9ca3af] transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            >
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
