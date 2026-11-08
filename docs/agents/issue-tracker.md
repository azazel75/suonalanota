# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`. Il repo non ha un remote: non
c'è un GitHub né un GitLab su cui appoggiarsi, quindi il tracker è il filesystem.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Implementation issues are one file per ticket at
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined
  tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see
  `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Eccezione di questo repo: dove vivono gli spec

`.scratch/` è fuori da git per scelta dell'autore, quindi **non** è il posto in cui tenere ciò che
deve sopravvivere: la specifica di prodotto vive in `docs/spec-esercizio.md` (versionata), insieme a
`docs/intesa.md`, `docs/protocollo-di-misura.md` e `docs/adr/`.

Lo spec tecnico che `/to-spec` produce va in `.scratch/suona-la-nota/spec.md` e cita
`docs/spec-esercizio.md` come fonte: quello è il documento che si legge, questo è il piano che si
esegue.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/suona-la-nota/issues/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number
directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in
  the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a
  `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it
  lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed;
  first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a
  context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
