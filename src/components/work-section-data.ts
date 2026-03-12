export interface ProjectCard {
  label: string;
  accentColour: string;
  title: string;
  description: string;
  repositoryUrl: string;
  siteUrl?: string;
  primaryCta?: string;
}

export const selectedWork: ProjectCard[] = [
  {
    label: "Flagship",
    accentColour: "var(--accent-orange)",
    title: "Threshold",
    description: "About, not at: Threshold uses flexible time windows so alarms fit your life, not the other way around.",
    repositoryUrl: "https://github.com/liminal-hq/threshold",
    siteUrl: "https://threshold.liminalhq.ca/",
    primaryCta: "Visit Site →",
  },
  {
    label: "Working Memory",
    accentColour: "var(--accent-blue)",
    title: "Flow",
    description:
      "Local-first, terminal-native working memory for the shell. Track active threads, branch tangents, and keep context close while you work.",
    repositoryUrl: "https://github.com/liminal-hq/flow",
    primaryCta: "GitHub",
  },
  {
    label: "Knowledge Base",
    accentColour: "var(--accent-purple)",
    title: "Liminal Notes",
    description:
      "Local-first, Markdown-based note-taking that treats your data as the source of truth. Built with Tauri, React, and Rust.",
    repositoryUrl: "https://github.com/ScottMorris/liminal-notes",
    siteUrl: "https://notes.liminalhq.ca/",
    primaryCta: "Visit Site",
  },
  {
    label: "Simulation",
    accentColour: "var(--accent-cyan)",
    title: "City Sim 1000",
    description:
      "Offline-ready city builder in TypeScript/Vite with PixiJS. Lay roads, power a skyline, and manage budget and demand.",
    repositoryUrl: "https://github.com/ScottMorris/city-sim-1000",
    siteUrl: "https://scottmorris.github.io/city-sim-1000/",
    primaryCta: "Play Now",
  },
];

export const experiments: ProjectCard[] = [
  {
    label: "CLI Utility",
    accentColour: "var(--accent-purple)",
    title: "SMDU",
    description:
      "A modern, terminal-based disk usage analyser inspired by ncdu, built with TypeScript and Ink.",
    repositoryUrl: "https://github.com/ScottMorris/smdu",
    siteUrl: "https://smdu.liminalhq.ca/",
  },
  {
    label: "Knowledge Tooling",
    accentColour: "var(--accent-orange)",
    title: "Coherence Chat Exporter",
    description:
      "A CLI for archiving AI conversations into organised, tagged Markdown across providers.",
    repositoryUrl: "https://github.com/liminal-hq/coherence-chat-exporter",
  },
  {
    label: "PWA Utility",
    accentColour: "var(--accent-cyan)",
    title: "Keep Note Converter",
    description:
      "Installable Next.js PWA that converts pasted rich text into Google Keep-compatible markup.",
    repositoryUrl: "https://github.com/ScottMorris/keep-note-converter",
  },
];

export interface ProjectAccentStyles {
  badge: {
    color: string;
    borderColor: string;
  };
  outline: {
    borderColor: string;
  };
}

// Product requirement: card outline accent must always match badge accent.
export function getProjectAccentStyles(accentColour: string): ProjectAccentStyles {
  return {
    badge: {
      color: accentColour,
      borderColor: accentColour,
    },
    outline: {
      borderColor: accentColour,
    },
  };
}

export function getProjectCardCssVariables(accentColour: string): {
  "--project-accent": string;
} {
  return {
    "--project-accent": getProjectAccentStyles(accentColour).outline.borderColor,
  };
}

export function getPrimaryProjectUrl(project: ProjectCard): string {
  return project.siteUrl ?? project.repositoryUrl;
}
