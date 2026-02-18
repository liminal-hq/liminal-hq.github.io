import assert from "node:assert/strict";
import test from "node:test";
import {
  experiments,
  getProjectAccentStyles,
  getProjectCardCssVariables,
  selectedWork,
} from "../src/components/work-section-data";

const allProjects = [...selectedWork, ...experiments];

test("project card outline accent always matches badge accent", () => {
  for (const project of allProjects) {
    const accent = getProjectAccentStyles(project.accentColour);
    const cssVars = getProjectCardCssVariables(project.accentColour);

    assert.equal(
      accent.badge.borderColor,
      cssVars["--project-accent"],
      `Outline colour must match badge colour for ${project.title}`
    );
  }
});
