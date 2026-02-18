"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const navItems = [
  { label: "Home", href: "/#home" },
  { label: "Work", href: "/#work" },
  { label: "Philosophy", href: "/#philosophy" },
  { label: "Lab", href: "/#lab" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "mailto:contact@liminalhq.ca", external: true },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen((current) => !current);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="py-6 md:py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-bold tracking-[0.08em] text-white [font-feature-settings:smcp] [font-variant:small-caps] md:text-xl"
          onClick={closeMenu}
        >
          <Image src="/liminalhq-mark-v1.svg" alt="" width={28} height={28} className="h-7 w-7" />
          liminal hq
        </Link>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.2)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-[rgba(255,255,255,0.4)] md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="site-nav"
          onClick={toggleMenu}
        >
          {isMenuOpen ? "Close" : "Menu"}
        </button>

        <nav className="hidden md:block">
          <ul className="flex list-none gap-8">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.external ? (
                  <a
                    href={item.href}
                    className="relative text-[0.95rem] font-medium text-[#9ca3af] transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="relative text-[0.95rem] font-medium text-[#9ca3af] transition-all duration-200 hover:text-white hover:shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {isMenuOpen ? (
        <nav
          id="site-nav"
          className="mt-5 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(12,12,18,0.9)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
        >
          <ul className="flex list-none flex-col gap-4">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.external ? (
                  <a
                    href={item.href}
                    className="text-base font-medium text-[#e2e8f0] transition-colors hover:text-white"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="text-base font-medium text-[#e2e8f0] transition-colors hover:text-white"
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
