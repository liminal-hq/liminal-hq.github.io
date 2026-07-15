import type { CSSProperties } from "react";
import styles from "./WorkSection.module.css";
import {
  getPrimaryProjectUrl,
  getProjectAccentStyles,
  getProjectCardCssVariables,
  type ProjectCard,
} from "./work-section-data";

interface FeaturedProjectCardProps {
  project: ProjectCard;
  headingLevel: "h3" | "h4";
}

export default function FeaturedProjectCard({ project, headingLevel: Heading }: FeaturedProjectCardProps) {
  const accent = getProjectAccentStyles(project.accentColour);
  const primaryUrl = getPrimaryProjectUrl(project);
  const ctaLabel = project.primaryCta ?? (project.siteUrl ? "Visit Site" : "View Source");

  return (
    <article
      className={`${styles.projectCard} group relative cursor-pointer`}
      style={getProjectCardCssVariables(project.accentColour) as CSSProperties}
    >
      <a
        href={primaryUrl}
        className="absolute inset-0 z-10 rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--project-accent)] focus-visible:outline-offset-[-3px]"
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
        <Heading className="mb-4 text-[2rem] text-white md:text-[2.5rem]">{project.title}</Heading>
        <p className="mb-10 max-w-[650px] text-base text-[var(--text-muted)] md:text-[1.15rem]">
          {project.description}
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-[10px] rounded-[30px] bg-[rgba(255,255,255,0.1)] px-6 py-3 font-semibold text-white transition-all duration-300 group-hover:translate-x-[5px] group-hover:bg-[var(--project-accent)] group-hover:text-black">
            {ctaLabel}
          </span>
          {project.siteUrl ? (
            <a
              href={project.repositoryUrl}
              className="relative z-20 border-b border-[var(--project-accent)] pb-[2px] text-[0.9rem] text-white"
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
}
