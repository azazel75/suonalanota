# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — il glossario: bersaglio, colpo, colpo ambiguo, verdetto,
  portata udibile, soundcheck, credibilità.
- **`docs/adr/`** — leggere gli ADR che toccano l'area in cui si sta per lavorare. Qui ce ne sono
  nove, e quattro riguardano il rilevatore: sbagliare l'ordine di lettura significa rifare errori già
  misurati.
- **`docs/spec-esercizio.md`** — cosa fa l'applicazione, con i numeri decisi.
- **`docs/intesa.md`** — la pagina che chiude il colloquio: se il lavoro contraddice quella, va
  segnalato.

Se un file non esiste, **procedi in silenzio**: non segnalarne l'assenza e non proporre di crearlo.
La skill `/domain-modeling` li crea quando un termine o una decisione si stabilizza davvero.

## File structure

Single-context repo (questo):

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   │   ├── 0001-ascolto-solo-microfono.md
│   │   └── … 0009-le-parziali-dispari.md
│   ├── intesa.md
│   ├── spec-esercizio.md
│   └── protocollo-di-misura.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a
test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly
avoids — in particular: **nota** is the written symbol, **tasto** is the key, **colpo** is the
detected attack, **verdetto** is the outcome of a target.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing
language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0006 (leggere dopo l'attacco) — ma vale la pena riaprirlo perché…_
