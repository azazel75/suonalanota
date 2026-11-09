# Suona la nota

Esercizi di lettura del pentagramma per ragazzə di 10-13 anni: una nota alla volta, mentre
l'applicazione ascolta il pianoforte dal microfono del dispositivo.

## Language

### Il compito

**Nota**:
Il segno scritto sul rigo: una posizione più una chiave. Non è il suono, e non è il tasto. La
sessione ne chiede una alla volta: è **la nota in corso**, e il verdetto è suo.
_Avoid_: bersaglio, domanda, nota da suonare

**Tasto**:
Il tasto fisico del pianoforte, identificato dal suo numero MIDI. È ciò che il ragazzə preme, ed
è ciò che la nota indica.
_Avoid_: nota, chiave

**Chiave**:
Il segno che fissa la posizione delle note sul rigo: di violino (sol) o di basso (fa).
_Avoid_: usare "chiave" per il tasto del pianoforte

### Il microfono e lo strumento

**Pressione**:
Ciò che il microfono riconosce quando si preme un tasto: un attacco, con le altezze che contiene.
Può contenere la nota chiesta, non contenerla, essere ambigua, o contenere note in più.
_Avoid_: colpo, nota, risposta

**Attacco**:
L'inizio di un suono. Un tasto tenuto premuto non è un attacco, e non risolve la nota successiva.
_Avoid_: nota, pressione

**Pressione ambigua**:
Una pressione in cui la nota vincente e la sua ottava sono troppo vicine perché il rilevatore possa
scegliere. Non si giudica e non costa un tentativo: l'applicazione chiede di ripetere la nota.
_Avoid_: errore incerto, dubbio, timeout

**Credibilità**:
Quanto la nota vincente di una pressione si stacca dalla mediana di tutti i candidati. È un numero
puro, non un livello: sotto 4 la pressione è rumore e non entra.
_Avoid_: soglia, punteggio, volume

**Portata udibile**:
L'insieme delle note che quel dispositivo, in quella stanza, riesce davvero a sentire. Si misura,
non si assume. Non è l'estensione dello strumento: è quello che il dispositivo ne sente.
In configurazione la misura si chiama **Sensibilità del dispositivo**.
_Avoid_: estensione, intervallo, range, ascolto

**Estensione**:
L'intervallo fra il tasto più basso e il più alto che lo strumento ha. Il soundcheck lo misura
facendo suonare i due estremi; quello che il dispositivo sente di quell'estensione è la **portata
udibile**. È dello strumento, non del telefono.
_Avoid_: compasso, intervallo, range, portata

Il ticket e la specifica la chiamavano «compasso»: è il falso amico dell'inglese *compass*, e in
italiano il compasso è quello da disegno — in musica, la battuta.

**Soundcheck**:
La misura che rileva l'estensione dello strumento e la portata udibile, e verifica che il
segnale arrivi. Si fa a richiesta dalla configurazione — `?soundcheck=1` la impone — e la misura
resta sul telefono finché non si rifà; senza di essa le note restano quelle dell'**Intervallo
dell'esercizio**.
_Avoid_: calibrazione, taratura, prova, ascolto

### La sessione

**Sessione**:
Un esercizio con un inizio, una durata e un punteggio. Finisce quando scade il tempo o quando la
lista delle note è esaurita.
_Avoid_: partita, test, round, esercizio

**Verdetto**:
L'esito di una singola nota. Ha tre valori e non due, e non è la stessa cosa del giudizio su una
pressione: una pressione ambigua non produce nessun verdetto, produce una richiesta di ripetere.
_Avoid_: risultato, esito, punteggio

**Tentativo**:
Una pressione che non contiene la nota chiesta. Il **numero massimo di tentativi** chiude la nota
come sbagliata; una pressione ambigua non è un tentativo.
_Avoid_: colpo, prova

**Ottava**:
L'intervallo fra una nota e la successiva con lo stesso nome. Fa parte della risposta: suonare il Do
un'ottava sotto non è una risposta corretta.
_Avoid_: registro, altezza

**Intervallo dell'esercizio**:
L'intervallo fra la nota minima e la massima che una sessione può chiedere. Limita sia la sequenza
sia la ricerca del rilevatore: fuori da lì non esiste candidato.
_Avoid_: range, estensione, portata

**Lista predefinita**:
Una delle liste di note che l'applicazione porta con sé, in ordine di difficoltà: le prime note in
violino, il rigo di basso, le due chiavi. Si sceglie prima della sessione, come la lista
dell'insegnante.
_Avoid_: preset, progressione

**Corretta**:
Il verdetto di una nota risolta da una pressione che contiene l'altezza esatta richiesta. Si chiamava
«centrata» fino al ticket 14: il gergo del tiro a segno è rimasto fuori, perché accanto a
«sbagliata» faceva due mestieri diversi.
_Avoid_: giusta, ok, centrata

**Sbagliata**:
Il verdetto di una nota chiusa dal numero massimo di tentativi, o dal tempo scaduto dopo almeno
un tentativo. Il ragazzə ha provato e non ci è riuscito.
_Avoid_: errata, fallita, sbagliato

**Saltata**:
Il verdetto di una nota chiusa dal tempo scaduto senza nessuna pressione. Il ragazzə non ha
provato: non è un errore, ed è per questo che non si chiama "sbagliata".
_Avoid_: mancata, non risolta, timeout

**Punteggio**:
I conteggi dei verdetti di una sessione, più le note al minuto. Non è un numero unico.
_Avoid_: voto, risultato, score

**Classifica**:
Le prove migliori di un telefono, una riga per ragazzə, per la prova in forza. Non è la cronaca
delle sessioni giocate, non è il punteggio di una sessione, e non esce dal dispositivo.
_Avoid_: ranking, high score, tabellone

### Il pubblico

**Allievə**:
Chi suona, fra i 10 e i 13 anni.
_Avoid_: bambino, utente, studente

**Insegnante**:
Chi prepara gli esercizi e legge i punteggi. In famiglia è anche chi apre l'applicazione.
_Avoid_: maestra, docente, admin

### Il programma

**App shell**:
I file che il service worker mette in cache perché l'applicazione parta senza rete — `index.html`,
i chunk, il manifest — e che il build sa versionare. È il termine del mondo PWA, e il codice lo dice
già così (`appShell`, `shell.ts`); in informatica «shell» da sola è l'interprete dei comandi, quindi
qui si dice sempre **app shell**.
_Avoid_: guscio, involucro, cornice

### La lingua

Le parole per le persone si scrivono con la **schwa**, che non è né maschile né femminile: *allievə*,
*ragazzə*, e *ragazzə* vale anche al plurale. Il prodotto la usa nel testo che mostra, i documenti
vivi e i commenti del codice la usano; gli ADR storici (0001–0017) restano come sono stati scritti.
**Insegnante** non ha bisogno della schwa: è già né maschile né femminile, e il file che compone si
chiama `lista-dell-insegnante.json`.

Le parole dell'esercizio sono quelle di chi insegna — **nota**, **pressione**, **tentativo**, **lista
predefinita** — e non quelle del tiro a segno: «bersaglio» e «colpo» restano fuori (ADR 0018). Anche
«ascolto» resta fuori: l'atto di ascoltare non dice cosa si misura, e la misura si chiama **Sensibilità
del dispositivo**.

Gli ADR **0016** e **0020** sono stati rititolati con «app shell»: quella parola era nostra e non del
prodotto, e in italiano non dice niente. Tutti gli altri ADR restano come sono stati scritti.
