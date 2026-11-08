# Le schermate come moduli

`src/main.ts` era arrivato a 796 righe: il DOM, il microfono, l'orologio, le tre schermate e la lista
della maestra nello stesso file. Non era un errore di stile: era la forma che il lavoro aveva preso
un ticket alla volta, e finché le schermate erano tre si poteva ancora leggere. Il ticket 09 ne
aggiunge una quarta — l'avvio con il soundcheck — e con quella forma l'avrebbe aggiunta dentro lo
stesso punto in cui ogni lavoro futuro si scontra con ogni altro. Che le schermate siano quattro è
già deciso nel piano che si esegue (`.scratch/suona-la-nota/spec.md`, «Le schermate»): il taglio andava
fatto prima, non dopo.

## Decisione

**Una schermata, un modulo in `src/screens/`.** `setup.ts` (la prova, con la tastiera e la lista della
maestra), `exercise.ts` (il rigo e la sessione), `summary.ts` (i conteggi, il log, il ritorno). Ogni
modulo cerca i propri elementi, registra i propri gestori e non legge gli id di un'altra schermata.

**Ogni schermata è una funzione che riceve le sue dipendenze e restituisce i suoi comandi.** Niente
classi, niente ciclo di vita generico: `enter()`, `start()`, `backToSetup()`, `trialChanged()`,
`busy()` per l'esercizio, `settings()`, `apply()`, `refresh()` per la scelta, `show()`, `clear()` per
il riepilogo. Chi ne ha bisogno sa cosa chiedere, e il tipo lo dice.

**Quello che le schermate si scambiano passa da porte esplicite**: «una sessione è in corso o si sta
costruendo» (`busy`), «la prova è cambiata» (`changed`), «torna all'inizio» (`restart`), «la prova in
forza» (`settings`). Nessuna variabile di modulo letta da due file.

**`src/main.ts` è composizione**: legge l'URL, costruisce le schermate, mostra la prima. Sotto le 120
righe, e resta l'unico posto dove il ciclo scelta ↔ esercizio esiste: la schermata dell'esercizio
legge la prova che i controlli descrivono, la scelta chiede se una sessione è in mezzo, e le due
closure si risolvono al primo clic, così l'ordine di costruzione non conta. Il ciclo è dichiarato in
un commento invece di essere nascosto in un terzo modulo che lo gestisce.

**Il wizard è generico sull'elenco delle schermate.** `createWizard` prende
`Record<Name extends string, HTMLElement>`, e i nomi stanno in `src/screens/screen-name.ts`: aggiungere
il soundcheck significa aggiungere `'avvio'` a quel tipo, l'elemento in `index.html`, un modulo accanto
agli altri e una riga di composizione. Il wizard, che è la logica, non si tocca.

**Le regole pure restano fuori dal DOM, e si testano.** La geometria della tastiera
(`src/score/keyboard.ts`: righe per ottava, larghezze, il tasto nero che apre un range) e le frasi
della schermata di scelta (`src/screens/setup-text.ts`) sono funzioni senza browser, coperte da test;
`src/ui/text.ts` porta l'accordo singolare/plurale che serve al riepilogo e alle frasi della lista.

## Conseguenze

- Il ticket 09 è **additivo**: `screens/soundcheck.ts`, `'avvio'` in `ScreenName`
  (`screen-name.ts`), una `<section>` in `index.html`, una riga in `main.ts`. È il criterio con cui si
  riconosce se il taglio è buono, ed è il motivo per cui è stato fatto adesso.
- Il refactor non cambia il prodotto: stesse stringhe, stessi id, stesso CSS, stesso flusso. La
  verifica nel browser del giro 7 (41 controlli, 390×844, microfono finto, sull'artefatto Nix) è la
  prova, e i 148 test esistenti restano verdi perché nessuno di loro nominava `main.ts`.
- Le schermate non si possono testare senza un browser, e non si finge di farlo: si verificano con
  CDP come il resto del flusso. Quello che si può testare senza DOM — geometria, frasi, accordo — è
  testato.
- Quattro moduli nuovi (`wizard`, `setup`, `exercise`, `summary`) hanno reso possibile leggere una
  schermata senza leggere le altre; il prezzo è un passaggio di parametri in più in `main.ts`, che è
  esattamente il punto in cui quel passaggio va visto.
- **Un difetto noto, già corretto**: il contatore dello schermo dell'esercizio diceva «1 centrate».
  La parola è cambiata in «corretta» per decisione di Alberto, insieme ai valori del log: `docs/adr/0014`.

## Alternative scartate

**Quattro indirizzi invece di quattro sezioni (`/prova`, `/esercizio`, `/riepilogo`, …).** Il 0011 ha
già deciso la pagina sola con le sezioni, e per una ragione che vale ancora: il microfono vuole un
gesto e il wizard non deve ricaricare la pagina fra una schermata e l'altra.

**Un'interfaccia di schermata con un ciclo di vita comune (`mount`, `unmount`, `update`).** Sarebbe un
framework di tre metodi per quattro schermate che non hanno niente in comune tranne il fatto di essere
visibili una per volta. Il wizard sa solo mostrare; il resto lo sa la schermata.

**Classi, una per schermata.** Lo stato di una schermata è chiuso nella sua closure, e le porte sono
gli unici ingressi: una classe aggiungerebbe `this` e una superficie pubblica senza aggiungere niente.

**Un unico oggetto di stato condiviso, passato a tutti.** Sarebbe stato il ciclo scelta ↔ esercizio
spostato in un terzo posto, con la differenza che il terzo posto non avrebbe detto chi scrive cosa.

**Un contenitore di dipendenze (`container`, un `get()` per dipendenza).** Con quattro schermate e
cinque porte, il contenitore sarebbe stato più lungo delle dipendenze che contiene.
