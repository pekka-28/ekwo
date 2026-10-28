// src/case-view.ts
import { mountEditor, unmount } from "../ekwo-view-runtime.js";
var caseFields = [{
  key: "identity",
  fields: [
    { column: "name", label: "Name", required: true },
    {
      column: "planning_purpose",
      label: "Case type",
      required: true,
      options: ["Tax", "Treasury", "Investments", "Project", "Other"]
    },
    { column: "notes", label: "Case description", multiline: true }
  ]
}];
function openCaseEditor(options) {
  const dialog = document.getElementById("case-editor");
  const host = document.getElementById("case-editor-fields");
  const close = document.getElementById("case-editor-close");
  let saving = false;
  const record = {
    name: options.record.name ?? "",
    notes: options.record.notes ?? "",
    planning_purpose: options.record.planning_purpose ?? "Tax"
  };
  document.getElementById("case-editor-title").textContent = options.record.id ? "Case details" : "New case";
  const cancel = () => {
    if (!saving) dialog.close();
  };
  close.onclick = cancel;
  dialog.oncancel = (event) => {
    if (saving) event.preventDefault();
  };
  dialog.onclose = () => unmount(host);
  mountEditor(host, {
    record,
    groups: caseFields,
    save: async (patch) => {
      saving = true;
      close.disabled = true;
      try {
        await options.save({
          name: patch.name ?? record.name,
          notes: "notes" in patch ? patch.notes ?? "" : record.notes,
          planning_purpose: patch.planning_purpose ?? record.planning_purpose
        });
      } finally {
        saving = false;
        close.disabled = false;
      }
    },
    // A successful mutation closes before refresh. A refresh failure must not offer
    // another Save that could duplicate a newly-created Case.
    onSaved: async () => {
      dialog.close();
      await options.afterSave();
    },
    onDone: cancel
  });
  dialog.showModal();
}
export {
  caseFields,
  openCaseEditor
};
