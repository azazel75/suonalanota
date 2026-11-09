# La prima nota è quella che vedi

Sulla schermata dell'esercizio, prima di premere **Inizia**, il rigo mostrava una nota **a caso**
dentro l'intervallo scelto — il commento nel codice diceva *«Something on the paper before the allievə
presses anything»* — e la riga sotto diceva «Premi Inizia, poi suona la nota che vedi». Premendo
Inizia, la sessione costruiva la sua sequenza e disegnava la prima nota vera: la nota **cambiava**.

Per un ragazzə che impara a leggere il rigo è la lezione sbagliata: la nota che hai letto non era quella
da suonare, e non c'era modo di sapere quale sarebbe stata. Al primo avvio c'è anche il dialogo del
permesso del microfono in mezzo, quindi si poteva suonare la nota dell'esempio mentre l'applicazione non
stava ancora ascoltando.

## Decisione

**La nota sul rigo prima di Inizia è la prima nota della sessione.** La sequenza si costruisce quando si
entra nella schermata (`sequenceFor(trial)`), si tiene da parte, e `start()` la usa: premere Inizia apre
il microfono, non un'altra nota. Il disegno dell'anteprima usa la stessa funzione della sessione
(`nearestPlacement` sulla prima chiave, senza la chiave precedente che ancora non esiste), quindi è lo
stesso inchiostro nello stesso posto — non un disegno "simile".

**La prima nota ha tempo di lettura illimitato; le altre no.** Il tempo della sessione parte al tocco,
non quando la nota appare. È una regola diversa per la prima nota, ed è voluta: è il momento in cui si
decide il dito. Un'insegnante fa così — «questa è la prima, quando sei pronto suonala» — e non c'è
motivo di far correre l'orologio su una nota che l'allievə sta ancora leggendo.

**Niente si può cambiare mentre quella schermata è davanti.** La configurazione è nascosta, e la
sequenza in attesa viene buttata via tornando indietro (`backToSetup`); se `start()` la trova assente
— una schermata futura che dimenticasse di chiamare `enter()` prima — ne costruisce una nuova, e in quel
caso la nota cambierebbe come prima. La via difensiva esiste, ma non è quella che si percorre.

## Perché non le alternative

**Un messaggio al posto della nota** («Sei pronto? Premi Inizia»): toglie la bugia, ma toglie anche
l'unica cosa utile che c'era sul rigo — la nota da leggere — e la fa comparire solo a microfono aperto,
quando il tempo è già partito.

**Un disegno chiaramente "di esempio"** (più chiaro, o grigio): resta una nota che non è quella da
suonare. Il problema non è che sembri vera, è che è un'altra.

**Una nota qualsiasi, ma dichiarata** («ecco un esempio di rigo»): più onesto, e inutile. Il rigo si
impara leggendolo, non guardando un rigo vuoto.

## Conseguenze

- La schermata dell'esercizio costruisce la sequenza un passo prima di prima: `enter()` costa una
  generazione in più quando si torna indietro e si rientra. Nulla di misurabile.
- La frase «Premi Inizia, poi suona la nota che vedi» adesso è vera. Resta com'era.
- Il controllo del browser che diceva `the staff has a note before Inizia` — cioè il difetto scritto nel
  test — è diventato `Inizia does not change the note on the paper`: misura la testa della nota e la
  chiave in unità del rigo, prima e dopo il tocco, e le confronta. In unità del rigo perché al tocco la
  card si muove di un paio di pixel (sparisce Inizia, compare Pausa) e in pixel CSS la stessa nota
  sembrerebbe essersi spostata.
- La specifica lo dice: `docs/spec-esercizio.md`, sezione «Durata».

## Verifica

`tsc` pulito, 262 test verdi, `nix flake check` e `nix build .#` verdi, **137 controlli** nel browser a
390×844 due volte. Fra questi: la nota prima di Inizia è una nota vera (una testa, una chiave), il tocco
non la sposta di un'unità, e dietro la sessione sta girando (la riga mostra `N s · …`).

Per essere sicura che la misura discrimini davvero, la geometria è stata provata su due liste
predefinite che cominciano su note diverse: testa a −18 unità in chiave di violino, −87 in chiave di
basso. Una nota spostata di un gradino cambia di mezza unità di spazio, molto più di un pixel.
