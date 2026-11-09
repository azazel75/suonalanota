# Suona la nota

Esercizi di lettura del pentagramma per ragazzə di 10-13 anni: una nota alla volta, mentre
l'applicazione ascolta il pianoforte dal microfono del dispositivo.

## Language

### Il compito

**Bersaglio**:
La nota scritta sul pentagramma che la sessione chiede di eseguire, nella chiave in cui è scritta.
_Avoid_: domanda, nota da suonare, esercizio

**Nota**:
Il segno scritto sul rigo: una posizione più una chiave. Non è il suono, e non è il tasto.
_Avoid_: usare "nota" per il suono prodotto o per il tasto premuto

**Tasto**:
Il tasto fisico del pianoforte, identificato dal suo numero MIDI. È ciò che il ragazzə preme, ed
è ciò che il bersaglio indica.
_Avoid_: nota, chiave

**Chiave**:
Il segno che fissa la posizione delle note sul rigo: di violino (sol) o di basso (fa).
_Avoid_: usare "chiave" per il tasto del pianoforte

### L'ascolto

**Colpo**:
Un evento sonoro che il microfono ha riconosciuto come un attacco, con le altezze che contiene.
Un colpo può essere giusto, sbagliato o contenere note in più.
_Avoid_: nota, tentativo, risposta

**Attacco**:
L'inizio di un suono. Un tasto tenuto premuto non è un attacco, e non risolve il bersaglio
successivo.
_Avoid_: nota, colpo

**Colpo ambiguo**:
Un colpo in cui la nota vincente e la sua ottava sono troppo vicine perché il rilevatore possa
scegliere. Non si giudica e non costa un tentativo: l'applicazione chiede di ripetere la nota.
_Avoid_: errore incerto, dubbio, timeout

**Credibilità**:
Quanto la nota vincente di un colpo si stacca dalla mediana di tutti i candidati. È un numero puro,
non un livello: sotto 4 il colpo è rumore e non entra.
_Avoid_: soglia, punteggio, volume

**Portata udibile**:
L'insieme delle note che quel dispositivo, in quella stanza, riesce davvero a sentire. Si misura,
non si assume. Non è l'estensione dello strumento: è quello che il dispositivo ne sente.
_Avoid_: estensione, intervallo, range

**Estensione**:
L'intervallo fra il tasto più basso e il più alto che lo strumento ha. Il soundcheck lo misura
facendo suonare i due estremi; quello che il dispositivo sente di quell'estensione è la **portata
udibile**. È dello strumento, non del telefono.
_Avoid_: compasso, intervallo, range, portata

Il ticket e la specifica la chiamavano «compasso»: è il falso amico dell'inglese *compass*, e in
italiano il compasso è quello da disegno — in musica, la battuta.

**Soundcheck**:
La prova di ascolto che misura l'estensione dello strumento e la portata udibile, e verifica che il
segnale arrivi. Si fa a richiesta dalla configurazione — `?soundcheck=1` la impone — e la misura
resta sul telefono finché non si rifà; senza di essa i bersagli restano quelli dell'**Intervallo
dell'esercizio**.
_Avoid_: calibrazione, taratura, prova

### La sessione

**Sessione**:
Un esercizio con un inizio, una durata e un punteggio. Finisce quando scade il tempo o quando la
lista dei bersagli è esaurita.
_Avoid_: partita, test, round, esercizio

**Verdetto**:
L'esito di un singolo bersaglio. Ha tre valori e non due, e non è la stessa cosa del giudizio su un
colpo: un colpo ambiguo non produce nessun verdetto, produce una richiesta di ripetere.
_Avoid_: risultato, esito, punteggio

**Ottava**:
L'intervallo fra una nota e la successiva con lo stesso nome. Fa parte della risposta: suonare il Do
un'ottava sotto non è una risposta corretta.
_Avoid_: registro, altezza

**Intervallo dell'esercizio**:
L'intervallo fra la nota minima e la massima che una sessione può chiedere. Limita sia la sequenza
sia la ricerca del rilevatore: fuori da lì non esiste candidato.
_Avoid_: range, estensione, portata

**Corretta**:
Il verdetto di un bersaglio risolto da un colpo che contiene l'altezza esatta richiesta. Si chiamava
«centrata» fino al ticket 14: il gergo del tiro al bersaglio è rimasto fuori, perché accanto a
«sbagliata» faceva due mestieri diversi.
_Avoid_: giusta, ok, centrata

**Sbagliata**:
Il verdetto di un bersaglio chiuso da un numero di colpi errati, o dal tempo scaduto dopo almeno
un tentativo. Il ragazzə ha provato e non ci è riuscito.
_Avoid_: errata, fallita, sbagliato

**Saltata**:
Il verdetto di un bersaglio chiuso dal tempo scaduto senza nessun colpo. Il ragazzə non ha
provato: non è un errore, ed è per questo che non si chiama "sbagliata".
_Avoid_: mancata, non risolta, timeout

**Punteggio**:
I conteggi dei verdetti di una sessione, più le note al minuto. Non è un numero unico.
_Avoid_: voto, risultato, score

**Classifica**:
Le prove migliori di un telefono, una riga per ragazzə, per la prova in forza. Non è un elenco di
tentativi, non è il punteggio di una sessione, e non esce dal dispositivo.
_Avoid_: ranking, high score, tabellone

### Il pubblico

**Allievə**:
Chi suona, fra i 10 e i 13 anni.
_Avoid_: bambino, utente, studente

**Maestra**:
Chi prepara gli esercizi e legge i punteggi. In famiglia è anche chi apre l'applicazione.
_Avoid_: insegnante, docente, admin

### La lingua

Le parole per le persone si scrivono con la **schwa**, che non è né maschile né femminile: *allievə*,
*ragazzə*, e *ragazzə* vale anche al plurale. Il prodotto la usa nel testo che mostra, i documenti
vivi e i commenti del codice la usano; gli ADR storici (0001–0014) restano come sono stati scritti.
**Maestra** fa eccezione: è la persona che il prodotto racconta, e il suo nome è anche quello del
file che compone (`lista-della-maestra.json`, ADR 0012).
