// src/treasury-preview.ts
import { renderCaseTimeline } from "./case-timeline.js";
var host = document.getElementById("analysis");
try {
  const response = await fetch("./examples/naledi-treasury.json");
  if (!response.ok) throw Error("The Treasury example could not be loaded.");
  renderCaseTimeline(host, await response.json());
} catch (error) {
  host.textContent = error instanceof Error ? error.message : "The Treasury example could not be loaded.";
}
