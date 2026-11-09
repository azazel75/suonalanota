# Il tema è quello del sistema

L'applicazione aveva una sola faccia: fondo quasi nero, testo chiaro. In classe, alle undici di mattina,
con il telefono al sole o con lo schermo già impostato in chiaro per tutto il resto, era l'unico
rettangolo scuro della giornata: una cosa che si legge peggio e che sembra rotta, non scelta.

## Decisione

**Il tema lo decide il sistema operativo, e basta.** Nessun interruttore, nessuna scelta da fare la prima
volta, niente da ricordare. Chi usa il telefono ha già risposto a quella domanda nelle impostazioni, e
quella risposta è l'unica che serve a un ragazzə che apre l'app per suonare.

**È CSS, non JavaScript.** La palette è fatta di variabili in `:root`; il tema chiaro è una media query
che riassegna le stesse variabili:

```css
:root { color-scheme: dark light; /* i colori scuri */ }
@media (prefers-color-scheme: light) { :root { /* gli stessi nomi, valori chiari */ } }
```

Tutto ciò che sta sotto legge le variabili, quindi la pagina intera segue senza che nessun selettore
venga toccato. Non c'è `matchMedia`, non c'è un ascoltatore da installare, e **il primo disegno è già
giusto**: una scelta fatta in JavaScript sarebbe arrivata un fotogramma dopo, con un lampo bianco o nero.

**`color-scheme: dark light`**, oltre alla media query, è ciò che fa seguire il tema anche alle cose che
non dipingiamo noi: barre di scorrimento, caselle di scelta, `select` nativi, sfondo dell'autocompletamento.
Senza, una pagina chiara si porta dietro una barra di scorrimento scura.

**Due `<meta name="theme-color">`**, uno con `media="(prefers-color-scheme: dark)"` e uno con `light`:
così anche la barra di stato del telefono diventa chiara quando la pagina è chiara. Nessuno script.

**La palette chiara, con i contrasti calcolati** (AA per il testo normale è 4,5:1):

| token | scuro | chiaro | contrasto nel chiaro |
| --- | --- | --- | --- |
| `--bg` / `--card` | `#0b0f14` / `#131a22` | `#f4f2ec` / `#ffffff` | testo 15,6 / 17,4 |
| `--text` / `--dim` | `#e8eef5` / `#8fa3b8` | `#1a1a18` / `#5c5750` | 17,4 / 7,2 |
| `--accent` | `#6cb6ff` | `#1f6feb` | 4,63 sulla card, bianco su di esso 4,63 |
| `--warn` | `#ffd166` | `#8a5a00` | 5,93 |

`--warn` è un colore di **testo** (`.hint`, `#list-message.bad`): il giallo notturno su bianco sta a
circa 1,4:1, quindi nel chiaro diventa un ambra scuro, non la stessa tinta. L'accento fa due mestieri —
superficie (i pulsanti, con `--on-accent` sopra) e testo sulla card — e il suo valore chiaro deve passare
4,5:1 contro la card **e** contro `--on-accent`: si sceglie calcolando entrambi, non a occhio.

## Cosa non cambia con il tema

**Il rigo.** VexFlow disegna inchiostro scuro su `--paper`, 17,15:1, e il foglio resta chiaro anche di
notte: è uno spartito, e uno spartito nero non è uno spartito. La carta non entra nella palette.

**I tasti del pianoforte.** Sono neri e bianchi in ogni stanza: non sono una superficie dell'interfaccia,
sono lo strumento. I loro cinque valori (`--key-white`, `--key-black`, `--key-line`, `--on-key-white`,
`--on-key-black`) hanno lo stesso valore nei due temi.

Questo ha scoperto un difetto vero: le etichette dei tasti neri usavano `color: var(--text)`, quindi in
tema chiaro sarebbero diventate testo scuro su tasto nero — illeggibili. Un colore preso dalla palette
sbagliata non si vede finché non esiste la seconda palette.

**Il bordo del foglio.** `--paper` contro la card chiara sta a 1,02:1: il rettangolo del rigo sparisce.
Nel chiaro il foglio prende `outline: 1px solid var(--line)`, che non occupa spazio nel layout e non
disturba le ombre interne dei lampi `flash-good`/`flash-bad` (un bordo o una seconda `box-shadow`
avrebbero litigato con quelle).

## Perché non le alternative

**Un interruttore manuale.** È una impostazione in più da spiegare a un ragazzə, uno stato da salvare, un
secondo posto dove la verità può divergere dall'altro. E la domanda è già stata posta dal telefono.

**JavaScript con `matchMedia`.** Rifarebbe in un fotogramma quello che il CSS fa prima del primo disegno,
con un lampo in mezzo e un secondo elenco di colori da tenere allineato.

**Una palette sola, neutra per tutti e due.** Il grigio medio che va bene ovunque non va bene da nessuna
parte: perde il contrasto alto che serve a leggere il rigo e le note.

**Il rigo scuro nel tema scuro.** Sarebbe coerente e peggiore: l'inchiostro andrebbe rigirato, il foglio
non sarebbe più carta, e si perderebbe il contrasto che oggi è gratis.

## Conseguenze

- Ogni colore nuovo deve essere una variabile. Un valore scritto a mano è un difetto che si vede solo
  nell'altro tema — è successo con le etichette dei tasti.
- Un browser che ignora `media` sul `theme-color` prende il primo: la barra resta scura anche in chiaro.
  È un ripiego, non un errore.
- La palette deve continuare a passare i contrasti: i controlli del browser li ricalcolano a ogni giro,
  quindi un ritocco sbagliato diventa rosso, non un giudizio.
- **Il manifest non può seguire il tema.** `theme_color` e `background_color` sono statici, uno per
  pagina, e il browser li legge all'installazione: la schermata di avvio dell'app installata resterà
  scura in tutti e due i temi. Resta scura come l'icona, ed è dichiarato qui invece di essere una
  sorpresa.

## Verifica

`Emulation.setEmulatedMedia` con `prefers-color-scheme` e lettura di `getComputedStyle`: nel giro del 9
novembre sono **135 controlli**, due volte, e fra questi:

- nello scuro: pagina scura, testo chiaro 16,5:1, barra di stato scura, foglio senza contorno;
- nel chiaro: pagina chiara **senza ricaricare e senza script**, testo 15,6:1, card bianca, accento con
  bianco sopra 4,63:1, `--dim` 7,2:1, ambra 5,9:1, barra di stato chiara, foglio col contorno da 1 px,
  carta ancora chiara, etichette dei tasti neri ancora chiare;
- un **caricamento a freddo** in tema chiaro disegna subito chiaro: è CSS, non uno script in ritardo.

I contrasti sono calcolati nello script (luminanza relativa sui canali linearizzati) e verificati come
relazione fra due colori, non come numero esadecimale: un ritocco alla palette non deve far fallire il
controllo per il motivo sbagliato.
