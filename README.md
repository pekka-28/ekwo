<!-- README.md -->

# Ekwo — Lustre web interface

[Open the application](https://pekka-28.github.io/ekwo/).

This repository contains only the static browser interface for Lustre scenario planning against an existing Ekwo installation. It is a separate companion interface maintained by pekka-28; the upstream Ekwo UI is unchanged.

The left menu adds Cases under Practitioner before CFO. Company selection queries the same authorised company fields as Ekwo Cloud, without embedded company identifiers or an exemplar allowlist. Cases and scenarios support creation, editing, copying, status editing in the scenario dialog and private selection. Status labels have no lifecycle constraints or accounting side effects. The accounting menu opens native Ekwo in another tab; Events provides an expandable scenario batch journal and T-account stream, plus draft capture and assignment for the active capture scenario; it has no date filters. Database schema routing applies saved scenario selections to native trial balance, general ledger and financial statements. Direct table readers remain on actuals; native Ekwo has no Lustre batch filter. API-key-only connections cannot own a planning session; use accounting-only keys for authoritative access. Accounting-only users receive authoritative live accounting and can open completed historical Reports; they cannot run or rebuild reports.

GitHub Pages serves the checked-in files directly from `main`. Serving requires no Node server, administrative key or database password. Sign in with your existing project account. The browser calls Supabase under that user's permissions; `config.js` contains only public connection configuration.

## Shared data-access client

`src/data-client.ts` uses `@supabase/supabase-js` 2.116.0, the version recorded by the inspected Ekwo OS 0.13.0 checkout. Ekwo's `packages/core/src/client.ts` explicitly delegates table CRUD to Supabase; `EkwoClient` wraps accounting operations such as posting and reconciliation. The current companion workflow uses Lustre RPCs instead of those accounting methods, so it needs the shared Supabase layer, without an unused Ekwo core bundle. If native posting is added, use the matching EkwoClient method over this same authenticated connection.

The SDK now owns password sign-in, session persistence, refresh, local-session sign-out, company/account queries, RPC transport and Edge Function invocation. The small adapter retains Lustre RPC names and report error messages. It uses the existing `ekwo-lustre-session` sessionStorage key and public project configuration; database permissions and planning-session checks still govern every request. The Ekwo Cloud application bundle is not loaded.

Journal capture now uses Ekwo's native `entries` and `entry_lines` table interface through `src/journal.ts`, rather than `lustre_event_create`. The inspected EkwoClient has no manual draft-creation method; `postEntry` is for posting and is deliberately not called during capture. The header omits Batch identity: the database capture trigger supplies it. The optional `x-lustre-scenario` assertion is checked against current capture settings, permissions and session ownership by migration **027-native-journal-capture.sql**, which must be installed before publishing this client. The readiness check refuses writes on older installations. Cases, Scenarios and related private operations continue to use their Lustre RPCs; reporting is unchanged.

Capture validates exact decimal strings using the company currency precision from Ekwo rounding_of, rather than assuming two decimal places. Migration 027 also checks ledger storage precision before inserting a header. The current installation stores ledger amounts and totals as numeric(16,2), so a three-decimal currency such as TND is explicitly refused until the native schema can retain it. It is never silently rounded to two places.

A native save inserts the draft header, then inserts all lines in one bulk request. It is not one transaction across both requests: a failed line request can leave an empty draft. The entry and line identities and original form values are retained in sessionStorage so reopening Add event can resume the same save. Lost responses are reconciled by reading those identities. Retry does not post, duplicate or automatically delete the journal. If capture selection changes, restore the original capture context before retrying. Keep the tab/session storage until recovery is complete; server-side drafts remain if browser storage is cleared. Inspect the draft identified in an error before starting another. Original values are restored on reopening; changing a pending save is refused rather than silently replacing already committed content.

After changing the strict TypeScript adapter, run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test` and `npm run build:data`. Commit the generated `data-client.js` with its source and dependency lockfile so Pages can serve it directly. Dependency versions are pinned; update and test them deliberately against the target Ekwo deployment. `THIRD-PARTY-NOTICES.txt` contains the bundled dependency licences. Local mocked tests cover scoping, RPC errors, session compatibility and token refresh; they do not establish compatibility with a live deployment.

Application records, database migrations, business documents and evaluation material are maintained separately. None is bundled here. The interface needs the Lustre RPC extension already installed on its configured database.

The visual treatment follows Ekwo Cloud's cobalt/gold palette, Inter text, Fraunces headings and rounded controls. The bundled fonts retain their SIL Open Font Licences in `fonts/`. The application supports light and dark themes.

## Lustre visual identity and native differences

The current trial uses the captured native Ekwo grouped editor for **New case** and **Case details**, through the adapter in `src/case-view.ts`. It retains the existing dialog size, long description area, workspace tables and Scenario actions. Create, read and update use existing Lustre operations; deletion is unavailable because there is no Case-delete contract. Native validation and save errors appear inside the editor; a changed planning context refuses the write and retains entered text.

Planning is now a native expanding menu group. Its entries are registered as a sub-application in the captured route/group data and rendered with the native expansion and capability filtering functions. The surrounding companion sidebar is retained. Accounting-only users receive Reports in that group. This does not modify the hosted Ekwo Cloud site. The pinned build, exposed internal functions and current limitations are described in [the runtime notes](vendor/ekwo/README.md).

Lustre pages use the **Lustre** logotype in Fraunces, with a blue poppy leaf. The maintained vector `lustre-leaf.svg` has an upright stem, irregular paired lobes, a pointed terminal lobe, a dark blue midrib and pale blue lateral veins. It is a stylised leaf rather than the native Ekwo leaf outline. The sign-in page displays the larger 96 × 112 logo; navigation uses a 28 × 32 mark and the browser tab uses the same SVG. The logo stays blue in both appearance palettes and day/night themes.

The extended sidebar groups Lustre functions under **Planning**, replacing the former **Practitioner** heading. Cases and Forecast remain its two planning destinations; accounting-only access presents Reports in the same group. Case, Scenario, event-capture and document actions remain within those destinations. Day to day, Accounting and CFO retain their existing links to native destinations. The current live Cloud menu is capability-dependent and differs from the older companion snapshot: it places Products under Day to day and collapses Accounting and CFO. Those native-menu differences remain review findings, not claims of complete visual parity.

The graphical differences from the native presentation are:

- Cases uses the blue poppy-flower icon (`poppy.svg`); Forecast uses the blue seedpod (`poppy-seedpod.svg`). These identify the two planning workspaces and are distinct from the leaf identity mark.
- Scenario selection, capture controls, status and health indications, and the Summary–Detail and Journal–T-accounts switches belong to Lustre. The orange partial-view boundary identifies an incomplete transaction view; it is not native navigation or a posting status.
- The Lustre logotype, leaf and Planning heading identify the extension. Inter body text, Fraunces headings, native colour tokens, rounded controls, sidebar folding, mobile drawer and appearance controls retain the shared Ekwo treatment.

`ui/build.json` supplies the identity through template slots; `lustre-brand.css` contains the application-specific identity styling. The native stylesheet remains the captured reference. Generated pages must be rebuilt with `node tools/build-ui.mjs` and checked with `--check` so template regeneration preserves these differences. The shared template's metadata lists the identity slots.

## Reusable interface template

`templates/ekwo` contains the shared landing page and application shell, native stylesheet, fonts, icon definitions, sidebar behaviour and account-menu controls. `template.json` records its source, slots and integration contract. It contains no Supabase project, credentials, companies, Cases or Scenarios. The published native page supplied the landing markup and styling; the authenticated shell follows its published component structure. This is a companion template, not the unpublished Ekwo Cloud source project. Asset licence notices are retained beside the template.

To reuse it, copy `templates/ekwo` and `tools/build-ui.mjs`, then supply `ui/build.json` and the content files it names. The current configuration demonstrates the slots. Authentication, company loading, permissions and navigation destinations remain the application's responsibility. Native Cloud account, agent and project-management services are not bundled.

Run `node tools/build-ui.mjs` to generate the public pages and shared assets. Run `node tools/build-ui.mjs --check` to detect changes made directly to generated files. Edit the templates and `ui` inputs instead of `index.html`, `sign-in.html`, `native.css`, `shell.css`, `theme.js`, `navigation.js` or `icons.js`. Cases-specific styling remains in `cases.css`; accounting behaviour remains in `app.js`.

The generated shell places the logo in the folding sidebar, uses country-name badges and the native route icons, and puts appearance and sign-out controls in the account menu. On mobile, Menu opens the sidebar drawer. All companies stays in this application. Accounting links retain the requested separate native Ekwo tab.

Report requests the Supabase report-run Edge Function, then downloads its stored HTML from Reports. The separate reporting CSCI applies Mustache; no report renderer or accounting aggregation is shipped to the browser. Templates and partials resolve from Lustre to User to CoA; only administrators configure them. No selection means no summary calculation. The workspace and Events RPCs supply ordered accounting results and permitted actions.

Planning requires the login session recorded in user_preferences.planning_session. Use planning here explicitly takes ownership; other logins are refused live planning. API-key-only connections cannot own planning. Accounting access and completed historical reports retain their existing scope.

Tabs within the owning login intentionally share settings. Before planning actions the UI checks Case/Forecast selection, capture Case and Case presentation. A stale view refreshes and displays an error without executing the action. Review the settings and retry. Open editors retain text but require reopening before saving. There is no polling or per-tab isolation.
