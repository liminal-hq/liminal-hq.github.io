import type { CSSProperties } from "react";
import styles from "./WorkSection.module.css";
import {
  experiments,
  getProjectAccentStyles,
  getProjectCardCssVariables,
  selectedWork,
} from "./work-section-data";

export default function WorkSection() {
  const [flagship, ...supportingSelectedWork] = selectedWork;
  const flagshipAccent = getProjectAccentStyles(flagship.accentColour);

  return (
    <section id="work" className="py-28">
      <h2 className="mb-8 text-[2rem] font-semibold text-white">Selected Work</h2>

      <article className={`${styles.projectCard} cursor-pointer`}>
        <span
          className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
          style={flagshipAccent.badge}
        >
          {flagship.label}
        </span>
        <h3 className="mb-4 text-[2.5rem] text-white">{flagship.title}</h3>
        <p className="mb-10 max-w-[650px] text-[1.15rem] text-[#9ca3af]">{flagship.description}</p>
        <a
          href={flagship.href}
          className="inline-flex items-center gap-[10px] rounded-[30px] bg-[rgba(255,255,255,0.1)] px-6 py-3 font-semibold text-white transition-all duration-300 hover:translate-x-[5px] hover:bg-[var(--accent-orange)] hover:text-black"
          target="_blank"
          rel="noreferrer"
        >
          {flagship.cta}
        </a>
      </article>

      <div className="mb-12 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8">
        {supportingSelectedWork.map((project) => {
          const accent = getProjectAccentStyles(project.accentColour);

          return (
            <article
              key={project.title}
              className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-8 transition-all duration-300 hover:border-[var(--project-accent)] hover:bg-[rgba(255,255,255,0.05)]"
              style={getProjectCardCssVariables(project.accentColour) as CSSProperties}
            >
              <span
                className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
                style={accent.badge}
              >
                {project.label}
              </span>
              <h3 className="mb-4 mt-2 text-[2rem] text-white">{project.title}</h3>
              <p className="mb-6 text-[#9ca3af]">{project.description}</p>
              <a
                href={project.href}
                className="border-b pb-[2px] text-[0.9rem] text-white"
                style={{ borderColor: project.accentColour }}
                target="_blank"
                rel="noreferrer"
              >
                {project.cta}
              </a>
            </article>
          );
        })}
      </div>

      <h3 className="mb-6 text-[1.35rem] font-semibold text-white">Experiments &amp; Tools</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8">
        {experiments.map((project) => {
          const accent = getProjectAccentStyles(project.accentColour);

          return (
            <article
              key={project.title}
              className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-8 transition-all duration-300 hover:border-[var(--project-accent)] hover:bg-[rgba(255,255,255,0.05)]"
              style={getProjectCardCssVariables(project.accentColour) as CSSProperties}
            >
              <span
                className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
                style={accent.badge}
              >
                {project.label}
              </span>
              <h4 className="mb-4 mt-2 text-[2rem] text-white">{project.title}</h4>
              <p className="mb-6 text-[#9ca3af]">{project.description}</p>
              <a
                href={project.href}
                className="border-b pb-[2px] text-[0.9rem] text-white"
                style={{ borderColor: project.accentColour }}
                target="_blank"
                rel="noreferrer"
              >
                View Source
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}
