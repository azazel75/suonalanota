# La lettura si fa dopo l'attacco, e la regola dell'ottava si spegne

Il terzo giro (245 colpi, 619 s, range Si1–Re6, coperchio chiuso, telefono sul leggio) ha dato il
numero peggiore di tutti — **74%** — e nel farlo ha spiegato il perché. Le due scoperte si tengono.

## Prima scoperta: si leggeva il pitch nel momento sbagliato

La finestra di analisi è di 341 ms. Al fotogramma dell'attacco contiene ancora il silenzio che c'era
prima: la nota c'è dentro per un decimo. Il log registra la stabilità del vincitore, cioè da quanti
fotogrammi consecutivi la stessa nota vince, e la tabella è netta:

| stabilità | colpi | giusti |
| --- | --- | --- |
| 1 (appena cambiato) | 72 | **46%** |
| 5 (assestato) | 152 | **93%** |

Tutti e 43 gli errori di ottava stanno nei primi fotogrammi. Non era un problema di armoniche: era
un problema di *tempo*. Si leggeva una finestra vuota.

**Decisione: dopo un attacco si aspetta 150 ms e poi si legge.** Quattro fotogrammi, dentro il
criterio di accettazione di 400 ms fra attacco e verdetto.

## Seconda scoperta: la regola dell'ottava non paga

Con la lettura assestata, la regola è **neutra in media e dannosa nel dettaglio**:

| | regola accesa | regola spenta |
| --- | --- | --- |
| tutti i colpi | 74% | **86%** |
| solo stabilità ≥ 2 | 86% | 86% |

Per registro, sui colpi assestati e con la regola spenta: **Si1–Re#2 14%**, Mi2–Si2 85%, Do3–Do5 91%,
Do#5–Re6 **100%**. La regola ripara il grave (dove la fondamentale non si sente e la somma armonica
pende verso l'alto) e rompe l'acuto (dove la corda dell'ottava sotto risuona): i due effetti si
annullano.

Tre calibrazioni provate e scartate, tutte sul log:

- **ampiezza assoluta** della fondamentale dell'ottava scelta: separa benissimo (0,0022 di mediana per
  i casi giusti, 0,0002 per gli sbagliati) ma **non è trasferibile**: cambia col guadagno del
  microfono;
- **quota dell'RMS della finestra**: trasferibile, ma nel grave fa crollare l'accuratezza dal 79% al
  37%, perché lì la fondamentale è debole per costruzione;
- **rapporto con il punteggio del vincitore**: nessuna separazione (mediania 0,35 contro 0,16).

## Decisione

1. **La regola dell'ottava è spenta** (`octaveEvidence` esiste ancora, default `false`). Le due
   ampiezze restano nel log, quindi la decisione si può riprendere sui dati.
2. **Il grave non è compito della regola, è compito del soundcheck**: sotto la portata udibile
   l'esercizio non chiede quelle note. Un 14% nel registro che non verrà mai proposto non è un
   difetto del prodotto.
3. **La soglia non può venire dal silenzio.** Anche misurato, in una stanza a −100 dBFS il rumore
   produce un punteggio così basso che la soglia derivata finisce al minimo dello slider (0,0002):
   cioè non filtra niente. Il log registra ora `credibility` (quanto il vincitore spicca sulla
   mediana dei candidati), che è adimensionale, e la soglia si calibrerà su quello al giro
   successivo.

## Cosa ci si aspetta dal quarto giro

Con la lettura ritardata e la regola spenta: Mi2–Si2 ~85%, Do3–Do5 ~91%, Do#5–Re6 ~100%, e il grave
fuori portata. Se il numero complessivo non arriva almeno all'85%, il problema non è più nel
rilevatore e va cercato altrove — nell'attacco, o nella stanza.
