# Ekwo — Lustre web interface

[Open the application](https://pekka-28.github.io/ekwo/).

This repository contains only the static browser interface for Lustre scenario planning against an existing Ekwo installation. It is a separate companion interface maintained by pekka-28; the upstream Ekwo UI is unchanged.

The left menu adds Cases. Company selection queries the same authorised company fields as Ekwo Cloud, without embedded company identifiers or an exemplar allowlist. Cases and scenarios support creation, editing, copying, a simple status selector and private selection. Status labels have no lifecycle constraints or accounting side effects. All accounting navigation opens native Ekwo in another tab; this shell contains no account reporting or date filters. Native accounting still reads the ordinary ledger and has no Lustre batch filter.

GitHub Pages serves the files directly from `main`. No build, Node server, administrative key or database password is required. Sign in with your existing project account. The browser calls Supabase under that user's permissions; `config.js` contains only public connection configuration.

Application records, database migrations, business documents and evaluation material are maintained separately. None is bundled here. The interface needs the Lustre RPC extension already installed on its configured database.

The visual treatment follows Ekwo Cloud's cobalt/gold palette, Inter text, Fraunces headings and rounded controls. The bundled fonts retain their SIL Open Font Licences in `fonts/`. The application supports light and dark themes.
