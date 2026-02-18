"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_Y = 500;

export default function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > SHOW_AFTER_Y);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`back-to-top ${isVisible ? "back-to-top--visible" : "back-to-top--hidden"}`}
    >
      <span className="back-to-top__arrow">↑</span>
      <span className="back-to-top__label">Top</span>
    </button>
  );
}
