import styles from "./HeroSection.module.css";

export default function HeroSection() {
  return (
    <section className="py-10 pb-16 md:py-14 md:pb-20">
      <div className={styles.heroBanner}>
        <div className="relative z-10 flex flex-col justify-center px-8 py-10 md:px-16 md:py-12">
          <span className={styles.taglineBadge}>
            EST. 2025 • Kitchener, ON
          </span>
          <h1 className={styles.heroTitle}>
            Digital tools for the{" "}
            <span className="hidden md:inline">
              <br />
            </span>
            spaces in between.
          </h1>
          <p className="mb-8 max-w-[90%] text-base font-light text-[var(--text-muted)] md:text-lg">
            We are <strong>Liminal HQ</strong>, an independent software studio building local-first applications.
            We prioritize user agency, privacy, and calm computing.
          </p>
        </div>

        {/* Abstract Threshold Visual */}
        <div className="relative h-full min-h-[300px] flex items-center justify-center z-[1] hidden md:flex">
          <div className={styles.thresholdGate}>
            <div className={styles.gateFrame}></div>
            <div className={styles.thresholdSlit}></div>
          </div>
        </div>
      </div>
    </section>
  );
}
