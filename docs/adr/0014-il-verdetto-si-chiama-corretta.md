# Il verdetto si chiama «corretta»

Il contatore dello schermo dell'esercizio diceva «1 centrate». La revisione del ticket 13 l'ha trovato
leggendo il codice, e la correzione ovvia era grammaticale: passare la parola a `count()`, come fa già
il riepilogo. Alberto ha fermato lì la correzione e ha chiesto di più: **«corretta, corrette» invece di
«centrata, centrate»**.

La ragione di prodotto è la terna. «Corretta / sbagliata / saltata» è una cosa sola, raccontata con tre
parole della stessa famiglia. «Centrata / sbagliata» mescola il gergo del tiro al bersaglio con la
scuola, e chi legge il riepilogo ad alta voce lo sente subito. Il glossario aveva addirittura
`_Avoid_: giusta, corretta, ok` sotto la voce vecchia: la parola che serve era quella che il glossario
proibiva.

## Decisione

**Il verdetto si chiama «corretta», e la parola cambia ovunque parla il prodotto.** Non solo dove si
vede l'accordo: schermo dell'esercizio, riepilogo, glossario, specifica, intesa, README, e **i valori
del log** — `"verdetto": "corretta"` e `"punteggio": { "corrette": … }`. Due nomi per la stessa cosa
sono il modo più rapido di perdere la fiducia della maestra che apre il file.

**Il glossario si rovescia di proposito.** La voce è **Corretta**, con `_Avoid_: giusta, ok, centrata`:
le vecchie parole restano lì come parole da non usare, che è il loro posto.

**Gli ADR 0003, 0007, 0008 e 0010 non si riscrivono.** Registrano quello che si è deciso allora con le
parole di allora; questo documento dice perché da oggi si dice altrimenti. Chi legge di fila trova le
due versioni e la data del cambio, che è più utile di un testo riscritto.

**Il log resta alla versione 1.** Il formato non era mai uscito dal repository — nessun file
dell'applicazione è stato consegnato a nessuno — quindi la promessa di `docs/adr/0012` non è ancora
partita: il primo file che qualcuno conserverà è già scritto con i nomi definitivi. Se alzassimo la
versione a 2, diremmo che esiste un lettore di file versione 1, e non è vero.

## Conseguenze

- Il cambio tocca il codice, sei documenti e i test; nessun id, nessun CSS, nessun flusso.
- **Il controllo nel browser andava riscritto**: quello del giro 6 accettava `/^\d+ s · \d+ centrate$/`,
  cioè la forma e non l'accordo, ed è per questo che «1 centrate» è sopravvissuto a quattro giri. Ora
  il controllo verifica che un solo bersaglio si dica «1 corretta».
- `count()` resta l'unico posto dove l'accordo vive, e adesso lo usano tutte e due le schermate che
  contano — l'esercizio e il riepilogo — invece di una sola.
- La parola «centrare» come verbo sopravvive fuori dal prodotto? No: anche la voce **Ottava** del
  glossario è stata riscritta («non è una risposta corretta»), perché un termine bandito che resta in
  una definizione torna sempre.

## Alternative scartate

**Correggere solo l'accordo, tenendo «centrata».** È la correzione minima, ed è quella che avevo
proposto: lascia in piedi la terna zoppa e la parola del tiro al bersaglio.

**«Giusta», che è la parola di un ragazzo.** Più corta e più vera in bocca a chi suona, ma «giusta»
detta da un'insegnante suona come un giudizio morale; «corretta» è la parola della scuola.

**Cambiare lo schermo e lasciare il log com'era.** La maestra legge «corrette» sul telefono e
«centrate» nel file che le è stato dato da conservare: due nomi, una cosa.

**Alzare la versione del log a 2.** Formalmente ineccepibile, sostanzialmente falso: non esiste un
lettore della versione 1.
