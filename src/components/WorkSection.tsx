import type { CSSProperties } from "react";
import styles from "./WorkSection.module.css";
import {
  experiments,
  getPrimaryProjectUrl,
  getProjectAccentStyles,
  getProjectCardCssVariables,
  selectedWork,
} from "./work-section-data";

export default function WorkSection() {
  const [flagship, ...supportingSelectedWork] = selectedWork;
  const flagshipAccent = getProjectAccentStyles(flagship.accentColour);
  const flagshipPrimaryUrl = getPrimaryProjectUrl(flagship);
  const [leadExperiment, ...supportingExperiments] = experiments;
  const leadExperimentAccent = getProjectAccentStyles(leadExperiment.accentColour);
  const leadExperimentPrimaryUrl = getPrimaryProjectUrl(leadExperiment);

  return (
    <section id="work" className="py-16 md:py-20">
      <h2 className="mb-8 text-[1.75rem] font-semibold text-white md:text-[2rem]">Selected Work</h2>

      <article className={`${styles.projectCard} group relative cursor-pointer`}>
        <a
          href={flagshipPrimaryUrl}
          className="absolute inset-0 z-10 rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-orange)] focus-visible:outline-offset-[-3px]"
          aria-label={`Open ${flagship.title}`}
          target="_blank"
          rel="noreferrer"
        ></a>

        <div className="relative z-0">
          <span
            className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
            style={flagshipAccent.badge}
          >
            {flagship.label}
          </span>
          <h3 className="mb-4 text-[2rem] text-white md:text-[2.5rem]">{flagship.title}</h3>
          <p className="mb-10 max-w-[650px] text-base text-[var(--text-muted)] md:text-[1.15rem]">
            {flagship.description}
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-[10px] rounded-[30px] bg-[rgba(255,255,255,0.1)] px-6 py-3 font-semibold text-white transition-all duration-300 group-hover:translate-x-[5px] group-hover:bg-[var(--accent-orange)] group-hover:text-black">
              {flagship.primaryCta ?? "View Project"}
            </span>
            {flagship.siteUrl ? (
              <a
                href={flagship.repositoryUrl}
                className="relative z-20 border-b border-[var(--accent-orange)] pb-[2px] text-[0.9rem] text-white"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            ) : null}
          </div>
        </div>
      </article>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-8">
        {supportingSelectedWork.map((project) => {
          const accent = getProjectAccentStyles(project.accentColour);
          const primaryUrl = getPrimaryProjectUrl(project);

          return (
            <article
              key={project.title}
              className="group relative rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-8 transition-all duration-300 hover:border-[var(--project-accent)] hover:bg-[rgba(255,255,255,0.05)]"
              style={getProjectCardCssVariables(project.accentColour) as CSSProperties}
            >
              <a
                href={primaryUrl}
                className="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--project-accent)] focus-visible:outline-offset-[-3px]"
                aria-label={`Open ${project.title}`}
                target="_blank"
                rel="noreferrer"
              ></a>

              <div className="relative z-0">
                <span
                  className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
                  style={accent.badge}
                >
                  {project.label}
                </span>
                <h3 className="mb-4 mt-2 text-[1.6rem] text-white md:text-[2rem]">{project.title}</h3>
                <p className="mb-6 text-sm text-[var(--text-muted)] md:text-base">{project.description}</p>

                <div className="flex items-center gap-4">
                  <span className="border-b pb-[2px] text-[0.9rem] text-white" style={{ borderColor: project.accentColour }}>
                    {project.primaryCta ?? "View Project"}
                  </span>
                  {project.siteUrl ? (
                    <a
                      href={project.repositoryUrl}
                      className="relative z-20 border-b border-[rgba(255,255,255,0.45)] pb-[2px] text-[0.9rem] text-[#e2e8f0]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <h3 className="mb-6 text-[1.15rem] font-semibold text-white md:text-[1.35rem]">Experiments &amp; Tools</h3>
      <article className={`${styles.projectCard} group relative cursor-pointer`}>
        <a
          href={leadExperimentPrimaryUrl}
          className="absolute inset-0 z-10 rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-purple)] focus-visible:outline-offset-[-3px]"
          aria-label={`Open ${leadExperiment.title}`}
          target="_blank"
          rel="noreferrer"
        ></a>

        <div className="relative z-0">
          <span
            className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
            style={leadExperimentAccent.badge}
          >
            {leadExperiment.label}
          </span>
          <h4 className="mb-4 text-[2rem] text-white md:text-[2.5rem]">{leadExperiment.title}</h4>
          <p className="mb-10 max-w-[650px] text-base text-[var(--text-muted)] md:text-[1.15rem]">
            {leadExperiment.description}
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-[10px] rounded-[30px] bg-[rgba(255,255,255,0.1)] px-6 py-3 font-semibold text-white transition-all duration-300 group-hover:translate-x-[5px] group-hover:bg-[var(--accent-purple)] group-hover:text-black">
              {leadExperiment.siteUrl ? "Visit Site" : "View Source"}
            </span>
            {leadExperiment.siteUrl ? (
              <a
                href={leadExperiment.repositoryUrl}
                className="relative z-20 border-b border-[var(--accent-purple)] pb-[2px] text-[0.9rem] text-white"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            ) : null}
          </div>
        </div>
      </article>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] md:gap-8">
        {supportingExperiments.map((project) => {
          const accent = getProjectAccentStyles(project.accentColour);
          const primaryUrl = getPrimaryProjectUrl(project);

          return (
            <article
              key={project.title}
              className="group relative rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-8 transition-all duration-300 hover:border-[var(--project-accent)] hover:bg-[rgba(255,255,255,0.05)]"
              style={getProjectCardCssVariables(project.accentColour) as CSSProperties}
            >
              <a
                href={primaryUrl}
                className="absolute inset-0 z-10 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--project-accent)] focus-visible:outline-offset-[-3px]"
                aria-label={`Open ${project.title}`}
                target="_blank"
                rel="noreferrer"
              ></a>

              <div className="relative z-0">
                <span
                  className="mb-4 inline-block rounded border px-[10px] py-1 text-xs font-bold uppercase tracking-[0.1em]"
                  style={accent.badge}
                >
                  {project.label}
                </span>
                <h4 className="mb-4 mt-2 text-[1.6rem] text-white md:text-[2rem]">{project.title}</h4>
                <p className="mb-6 text-sm text-[var(--text-muted)] md:text-base">{project.description}</p>
                <div className="flex items-center gap-4">
                  <span className="border-b pb-[2px] text-[0.9rem] text-white" style={{ borderColor: project.accentColour }}>
                    {project.siteUrl ? "Visit Site" : "View Source"}
                  </span>
                  {project.siteUrl ? (
                    <a
                      href={project.repositoryUrl}
                      className="relative z-20 border-b border-[rgba(255,255,255,0.45)] pb-[2px] text-[0.9rem] text-[#e2e8f0]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
