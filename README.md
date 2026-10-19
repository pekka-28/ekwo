# Ekwo — Lustre web interface

[Open the application](https://pekka-28.github.io/ekwo/).

This repository contains only the static browser interface for Lustre scenario planning against an existing Ekwo installation. It is a separate companion interface maintained by pekka-28; the upstream Ekwo UI is unchanged.

The left menu adds Cases under Practitioner before CFO. Company selection queries the same authorised company fields as Ekwo Cloud, without embedded company identifiers or an exemplar allowlist. Cases and scenarios support creation, editing, copying, status editing in the scenario dialog and private selection. Status labels have no lifecycle constraints or accounting side effects. The accounting menu opens native Ekwo in another tab; Events provides an expandable scenario batch journal and T-account stream, plus draft capture and assignment for the active capture scenario; it has no date filters. Database schema routing applies saved scenario selections to native trial balance, general ledger and financial statements. Direct table readers remain on actuals; native Ekwo has no Lustre batch filter. Linked-project API keys follow their creator's selections.

GitHub Pages serves the files directly from `main`. No build, Node server, administrative key or database password is required. Sign in with your existing project account. The browser calls Supabase under that user's permissions; `config.js` contains only public connection configuration.

Application records, database migrations, business documents and evaluation material are maintained separately. None is bundled here. The interface needs the Lustre RPC extension already installed on its configured database.

The visual treatment follows Ekwo Cloud's cobalt/gold palette, Inter text, Fraunces headings and rounded controls. The bundled fonts retain their SIL Open Font Licences in `fonts/`. The application supports light and dark themes.

## Reusable interface template

`templates/ekwo` contains the shared landing page and application shell, native stylesheet, fonts, icon definitions, sidebar behaviour and account-menu controls. `template.json` records its source, slots and integration contract. It contains no Supabase project, credentials, companies, Cases or Scenarios. The published native page supplied the landing markup and styling; the authenticated shell follows its published component structure. This is a companion template, not the unpublished Ekwo Cloud source project. Asset licence notices are retained beside the template.

To reuse it, copy `templates/ekwo` and `tools/build-ui.mjs`, then supply `ui/build.json` and the content files it names. The current configuration demonstrates the slots. Authentication, company loading, permissions and navigation destinations remain the application's responsibility. Native Cloud account, agent and project-management services are not bundled.

Run `node tools/build-ui.mjs` to generate the public pages and shared assets. Run `node tools/build-ui.mjs --check` to detect changes made directly to generated files. Edit the templates and `ui` inputs instead of `index.html`, `sign-in.html`, `native.css`, `shell.css`, `theme.js`, `navigation.js` or `icons.js`. Cases-specific styling remains in `cases.css`; accounting behaviour remains in `app.js`.

The generated shell places the logo in the folding sidebar, uses country-name badges and the native route icons, and puts appearance and sign-out controls in the account menu. On mobile, Menu opens the sidebar drawer. All companies stays in this application. Accounting links retain the requested separate native Ekwo tab.

Report requests the Supabase report-run Edge Function, then downloads its stored HTML from Reports. The separate reporting CSCI applies Mustache; no report renderer or accounting aggregation is shipped to the browser. Templates and partials resolve from Lustre to User to CoA; only administrators configure them. No selection means no summary calculation. The workspace and Events RPCs supply ordered accounting results and permitted actions.
