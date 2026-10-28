<!-- README.md -->
# Experimental Ekwo view runtime

This directory contains the public Cloud client captured on 28 October 2026, identified by URL and SHA-256 in `manifest.json`. It contains no authenticated page captures, credentials or company data. Preserve the captured bytes and embedded notices. The original remains separate from the generated runtime.

`npm run build:view` verifies the hash and generates `ekwo-view-runtime.js`. The build removes the Cloud bootstrap and its original exports, then appends `src/ekwo-bridge.js`. It retains the original field renderer and menu functions. An exact source-signature mismatch stops the build. It never fetches a newer bundle automatically.

The bridge exposes the native grouped editor (`cG`), route registry (`ES`), menu groups (`DS`), group builder (`QF`), capability filter (`rI`), expansion state (`gR`) and links (`TR`). The menu section expression is lifted verbatim from `ER`; account controls, company loading and the Cloud application provider are not mounted. The minimal editor provider has no authenticated client: the caller supplies the save callback. UI permission filtering supplements server permissions.

`registerApplication` replaces a named application's route contribution without duplicates and reconstructs native group data. `mountMenu` renders that application's group at a caller-selected slot in the existing sidebar. Lustre inserts Planning before CFO. This is local composition in the companion application, not injection into the live cloud.ekwo.ai site. Another sub-application can register its own group through the same interface.

The first entity adapter is `src/case-view.ts`. Its field descriptions are data; existing Lustre RPCs retain persistence, company scoping, planning-session ownership and business behaviour. Create and update use `lustre_case_save`; read uses the existing workspace. There is no Case-delete RPC, so deletion is unavailable. Forecast fields and other entities are not migrated by this experiment.

This depends on undocumented internal identifiers. A supported replacement would export field/group types, the editor, navigation registration and minimal provider contracts. Unminified source alone does not stabilise those contracts. The experiment does not establish a generic list renderer, automatic relation editors, complete typed value conversion or lifecycle generation.

Validate with `npm run build:view`, `node --experimental-strip-types tools/build-ekwo-view.ts --check`, `npm run typecheck` and `npm test`. The private Lustre project also runs `node --experimental-strip-types --test tools/ekwo-entity-ui.test.ts` against the real companion pages with synthetic backend responses, including stale-context refusal, error recovery, group expansion and mobile/folded navigation.
