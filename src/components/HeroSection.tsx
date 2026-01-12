import styles from "./HeroSection.module.css";

export default function HeroSection() {
  return (
    <section className="py-16 pb-24">
      <div className={styles.heroBanner}>
        <div className="relative z-10 p-16 flex flex-col justify-center">
          <span className={styles.taglineBadge}>
            EST. 2025 • Kitchener, ON
          </span>
          <h1 className={styles.heroTitle}>
            Digital tools for the<br />
            spaces in between.
          </h1>
          <p className="text-xl max-w-[90%] text-[#9ca3af] mb-10 font-light">
            We are <strong>Liminal HQ</strong>, an independent software studio building local-first applications.
            We prioritize user agency, privacy, and calm computing.
          </p>
        </div>

        {/* Abstract Threshold Visual */}
        <div className="relative h-full min-h-[300px] flex items-center justify-center z-[1] hidden md:flex">
          <div className={styles.thresholdGate}>
            <div className={styles.gateFrame}></div>
            <div className={styles.gateLight}></div>
          </div>
        </div>
      </div>
    </section>
  );
}
