import styles from "./HeroSection.module.css";

export default function HeroSection() {
  return (
    <section className="py-16 pb-24">
      <div className={styles.heroBanner}>
        <div className="relative z-10 p-16 flex flex-col justify-center">
          <span className={styles.taglineBadge}>
            EST. 2025 • Kitchener, ON
          </span>
          <h1 
            className="text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.05] font-bold mb-6 font-[family-name:var(--font-space-grotesk)] text-transparent bg-clip-text" 
            style={{ 
              backgroundImage: "linear-gradient(to right, #fff 20%, #ffaa40, #f43f5e)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text"
            }}
          >
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
