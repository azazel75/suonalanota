# Il soundcheck: misurare l'ascolto, non imporlo

Un telefono non sente tutti gli 88 tasti allo stesso modo. Sul giro di misura di novembre 2026, con il
microfono di un telefono Android di fascia media nella stanza di casa, il registro sotto Mi2 è
risultato inutilizzabile (14-17% di colpi riconosciuti): le note che stanno lì non arrivano
all'applicazione, e senza una misura arrivano all'allievə come **timeout** — cioè come errori che non
ha commesso. Il ticket 09 chiede di misurare l'estensione dello strumento e la portata udibile, e di
restringere l'intervallo a quello che il dispositivo sente davvero.

## Le parole

Il ticket e la specifica chiamavano «compasso» l'estensione dello strumento e «range» l'intervallo
della prova: la prima è il falso amico dell'inglese *compass* — in italiano il compasso è quello da
disegno, e in musica la battuta — e la seconda è inglese in un prodotto che parla italiano. Qui si
chiamano **estensione**, **portata udibile** e **intervallo dell'esercizio**. Il log, che è un file
per la maestra, dice `intervallo`, `intervallo_misurato` e `intervallo_effettivo`; la `versione` resta
1 perché nessun file è mai uscito dal repository, come per `centrate` → `corrette` (ADR 0014).

## Decisione

**Il soundcheck è un passo a richiesta, non un cancello.** La prima schermata resta la
configurazione; sotto l'intervallo c'è un blocco «Ascolto» che dice se il telefono è stato misurato,
quando, e con quale portata, e apre la schermata. Un parametro dell'URL, `?soundcheck=1`, lo rende
obbligatorio prima della prova: serve a chi prepara un link di classe e vuole ogni telefono misurato
prima di cominciare. «Obbligatorio» vuol dire che la schermata non si scavalca, **non** che il
telefono debba riuscire a misurare: l'unica uscita senza portata è il bottone esplicito «Continua
senza misurare», che dichiara la conseguenza. Un cancello senza uscita sarebbe un divieto.

**Cinque note, e sono tutte.** L'estensione si misura facendo suonare il tasto più basso e il più alto
dello strumento; poi si ripetono i due estremi e si aggiunge il **Do4** come controllo. La tendina
«quanti tasti» resta una scorciatoia della configurazione, non la verità: la verità è quello che il
rilevatore sente. La ricerca del rilevatore copre **tutto il pianoforte** (21–108) e non l'intervallo
della prova, perché l'estensione serve proprio a scoprire quali tasti esistono. Ogni nota ha sei
secondi: cinque note sono i trenta secondi del ticket.

**Quello che le cinque note possono decidere:**

- un estremo **sentito** in una delle due prove conta come sentito; un estremo **non sentito due
  volte** sposta quel bordo al Do4 — mai a un'ottava indovinata. L'intervallo può solo restringersi;
- se i due estremi **si incrociano** — il «più basso» sentito sopra il «più alto» — le note suonate
  non erano quelle chieste, e non c'è misura: prendere il minimo e il massimo fabbricherebbe
  l'intervallo che la misura ha appena rifiutato di dare;
- **tre colpi ambigui consecutivi sullo stesso tasto** tolgono quel tasto dalla portata: è un dato sul
  dispositivo, non sull'allievə (ADR 0008);
- se **il Do4 centrale non si sente**, non c'è misura: le due estremità senza il centro non fanno un
  intervallo, fanno un telefono che non sente quella nota;
- se il livello non è mai salito sopra il rumore di fondo, il messaggio è «controlla il volume dello
  strumento, o togli le cuffie», non quattro timeout di fila — ma dopo **due** inviti consecutivi:
  una mano più lenta di sei secondi non è un telefono muto.

**La portata è del telefono, non della prova.** Vive in `localStorage`, chiave
`suona-la-nota.portata`, `{ "versione": 1, "quando": …, "sente": { "minimo", "massimo" },
"esclusi": […] }` — i nomi italiani dei due file JSON (ADR 0012), e una versione che non si conosce
viene rifiutata invece di essere interpretata a metà. **L'estensione non è un campo a parte**: i due
estremi misurati sono già i bordi di `sente`, e un'estensione scritta accanto dovrebbe dire 21 e 108 —
il pianoforte supposto, non lo strumento sentito — dentro un valore con una data. Una misura serve
l'intervallo base e quello avanzato: **l'intersezione si calcola quando la sessione parte**, non quando
si misura. Se l'intersezione è vuota — o se una lista o un preset restano senza tasti dentro di essa
— la prova non parte e la configurazione dice perché, invece di aprire il microfono su una sessione
senza bersagli.

**Il log scrive ciò che è stato usato.** `intervallo_misurato` è `true` e `intervallo_effettivo` porta
l'intersezione quando la misura c'è; `false` e `null` quando non c'è, con la frase che lo dice
(ADR 0012). La `versione` del log resta 1: il campo esisteva già e il suo senso non cambia.

**La classifica resta quella della prova nominale.** La chiave (`trialKey`) non cambia: la portata è
una proprietà del telefono, e rifare la misura non deve spezzare in due la classifica di una
lezione.

## Conseguenze

- Chi apre l'applicazione per suonare non attraversa niente: una schermata in meno è la differenza fra
  un'applicazione che si usa e una che si spiega.
- Una misura sbagliata per difetto — il rilevatore che nomina l'ottava sbagliata, un estremo suonato
  piano — restringe più del necessario. È il verso sicuro dell'errore: la riga nella configurazione e
  il log dicono qual è la portata in vigore, e rifare la misura la corregge.
- Senza misura l'intervallo è quello nominale, e il log lo dichiara: la maestra sa che un timeout può
  essere del telefono.
- Il controllo «sei in cuffia o a volume zero» **durante un esercizio** non è di questo passo: è già
  nell'esercizio (`src/exercise/controller.ts`, cinque secondi sotto −55 dBFS, con il suo messaggio),
  e questa modifica non lo tocca. Il ticket 09 aggiunge il controllo **dentro il soundcheck**, dove
  il silenzio vuol dire che la misura non si può fare.
- Le pagine spike non entrano nel flusso: restano strumenti di misura, e il soundcheck non le
  riusa.

## Alternative scartate

**Il soundcheck alla prima apertura, con «Salta» in evidenza.** Era la formulazione iniziale del
ticket. Mette una schermata davanti a chi ha aperto l'applicazione per suonare, e la mette una volta
sola — cioè quando meno si sa cosa sia. Il passo è per chi lo cerca.

**Misurare a ogni prova, o per ogni intervallo.** Lo stesso telefono nella stessa stanza non cambia udito
fra il base e l'avanzato: due misure sarebbero due occasioni di non andare d'accordo, e la seconda
potrebbe smentire la prima senza che niente sia cambiato.

**Salvare l'intervallo effettivo invece della portata.** L'effettivo dipende dalla prova; salvarlo
significherebbe congelare in un telefono l'intersezione di una lezione, e riusarla su un'altra.

**Mettere la portata nella chiave della classifica.** Rifare la misura sposterebbe i punteggi di una
lezione in un'altra classifica, per un fatto che riguarda il telefono e non il ragazzə.

**Scandire la tastiera tasto per tasto.** Sarebbe la misura perfetta e costerebbe 88 note: il
soundcheck non sarebbe più «trenta secondi», e nessuno lo farebbe.

**La tendina «quanti tasti» come misura.** Una scorciatoia che dichiara l'estensione senza averla
sentita: il ticket la ammette per non proporre tasti che non esistono, non per decidere la portata.

**Un cancello senza uscita quando il link lo impone.** Un telefono che non sente il registro grave
bloccherebbe il ragazzə fuori dall'esercizio, e l'obbligo diventerebbe un divieto.
