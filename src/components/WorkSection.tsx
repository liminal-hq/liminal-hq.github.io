import type { CSSProperties } from "react";
import FeaturedProjectCard from "./FeaturedProjectCard";
import {
  experiments,
  getPrimaryProjectUrl,
  getProjectAccentStyles,
  getProjectCardCssVariables,
  selectedWork,
} from "./work-section-data";

export default function WorkSection() {
  const [flagship, ...supportingSelectedWork] = selectedWork;
  const [leadExperiment, ...supportingExperiments] = experiments;

  return (
    <section id="work" className="py-16 md:py-20">
      <h2 className="mb-8 text-[1.75rem] font-semibold text-white md:text-[2rem]">Selected Work</h2>

      <FeaturedProjectCard project={flagship} headingLevel="h3" />

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
      <FeaturedProjectCard project={leadExperiment} headingLevel="h4" />

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
