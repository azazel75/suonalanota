# Il guscio si aggiorna quando l'utente dice sì

Il guscio offline di ADR 0016 apre l'applicazione senza rete, e la tiene ferma: le navigazioni le
serve la cache del worker. Dopo una build nuova, sul telefono restava la versione precedente, e
l'unico modo per uscirne era aprire i developer tools e disregistrare il worker. Non è un modo di
distribuire un'applicazione a un'insegnante.

La causa non è il worker, è il **controllo**: la pagina non chiedeva mai se c'era una versione nuova,
e il browser lo fa per conto suo al massimo una volta ogni ventiquattro ore. Per un'app che si apre e
si chiude in classe, «una volta al giorno, quando capita» è «mai».

## Decisione

Tre pezzi, ognuno con il suo perché.

**La pagina chiede.** `registration.update()` al caricamento e ogni volta che la pagina torna in primo
piano (`visibilitychange`). È il momento in cui qualcuno riapre l'app: se c'è una versione nuova, lo si
scopre lì, non il giorno dopo. Il freno delle ventiquattro ore vale per il controllo implicito del
browser, non per una richiesta esplicita.

**Il worker nuovo aspetta.** `skipWaiting()` solo al primo insediamento, quando `registration.active`
è `null`: il primo worker deve prendere il controllo subito, è quello che rende l'app offline. Un
worker successivo resta in `waiting`, e la pagina può dirlo. Il worker ascolta anche il messaggio
`SKIP_WAITING`: quando arriva, prende il controllo.

**La barra, e il tocco.** Sotto il titolo, fuori dalle schermate (quindi su ogni schermata), una barra:
«C'è una versione nuova» e un pulsante «Aggiorna». Al tocco la pagina manda `SKIP_WAITING` al worker in
attesa e, al `controllerchange`, si ricarica **una volta sola**. Se la barra viene ignorata,
l'aggiornamento si applica alla prossima apertura da freddo: il browser attiva il worker in attesa
quando non c'è più nessuna pagina aperta.

La ricarica è **una decisione di chi legge**, mai un effetto collaterale: una sessione in corso — un
ragazzə davanti al rigo, con il microfono acceso — non si interrompe per un aggiornamento.

## Perché non le alternative

**`skipWaiting` sempre** (quello che faceva prima): il worker prende il controllo, ma la pagina già
aperta tiene il guscio che ha caricato, e nessuno le dice di ricaricare. Sembra aggiornato e non lo è.

**Ricarica automatica al `controllerchange`**: aggiornerebbe senza chiedere, e butterebbe via la
sessione in corso. Il `controllerchange` scatta anche al primo insediamento, quindi servirebbe comunque
una guardia — e la guardia giusta è «solo se l'ha chiesto l'utente».

**Un dialogo modale**: più forte della barra per un bambino, e più difficile da chiudere senza capire.
La barra non blocca niente e non ha parole tecniche: «C'è una versione nuova», «Aggiorna».

**Aggiornare a ogni avvio senza dire niente**: l'utente vedrebbe la versione cambiare sotto le mani, e
se l'avesse a metà esercizio perderebbe la sessione senza sapere perché.

## Conseguenze

- Un worker può restare in attesa per giorni, se nessuno tocca la barra: è spazio in cache (una copia
  del guscio), non un errore.
- La barra compare su qualunque schermata, anche durante l'esercizio; non tocca il fuoco e non muove i
  personaggi del rigo: è un figlio in più del guscio, `flex: 0 0 auto`, sopra le card.
- La versione mostrata è quella del **guscio** (i byte dei file, ADR 0016): se cambia un documento e
  non i file serviti, la barra non compare, ed è giusto così.

## Verifica

- `tests/pwa.test.ts`: il worker salta l'attesa solo se non c'è un worker attivo; aspetta se c'è, e
  prende il controllo solo sul messaggio `SKIP_WAITING`; ignora qualunque altro messaggio.
- Prova **end-to-end** con due build sullo stesso indirizzo (una copia scrivibile del pacchetto, la
  seconda build con un'altra versione di cache e un titolo diverso): la prima visita installa il
  guscio e non mostra niente; la seconda build arriva, `update()` la trova, il worker aspetta, la
  barra compare, il tocco ricarica la pagina **sulla seconda versione**, la cache vecchia sparisce.
  Otto controlli, tutti verdi.
- `verify.mjs`: la barra è nell'HTML, nascosta, con le parole giuste; 119 controlli a 390×844, due
  volte.
