# La prova si può dettare dall'URL

La schermata di scelta è diventata un passo obbligato, e un link può saltarla. Due decisioni che si
tengono: senza la prima la seconda non avrebbe niente da saltare, senza la seconda ogni prova
ripetuta a mano sarebbe un lavoro da maestra.

## Decisione

**La pagina è un wizard: una schermata alla volta, e la prima è la configurazione.** Il rigo non
esiste finché non si preme «Comincia»: non c'è nessun percorso che porti all'esercizio senza aver
confermato una prova, nemmeno quella coi default. Dalla schermata del rigo si torna indietro con
«Cambia la prova», dal riepilogo con «Torna all'inizio», e in tutti i casi le scelte restano quelle.
Le schermate entrano con una salita breve — 240 ms, opacità e dieci pixel — che chi ha chiesto al
sistema meno movimento non vede affatto.

**Un URL può dettare la prova: `range` (`base`/`advanced`), `lowest` e `highest` (MIDI), `duration` e
`timeout` (secondi), `cap` (colpi errati), `mode` (`random`/`preset`/`list`), `preset`.** Quello che
il link non dice resta al default. Se il link dice almeno uno di questi parametri, la schermata di
configurazione **non compare**: la domanda a cui serviva ha già la risposta, e chiederla di nuovo è
chiederla due volte. Un valore che non si capisce viene ignorato, ma la sua presenza basta comunque a
saltare la conferma: chi ha scritto il link voleva una prova sua.

**Il microfono continua a volere un gesto.** Nessun link fa partire una sessione da solo: si atterra
sul rigo con «Inizia» davanti. `?autostart=1` resta l'eccezione, ed è una scorciatoia di misura — con
un microfono finto in un browser senza testa — non un modo di aprire l'applicazione.

**Contraddice ADR 0010 (il feedback e il silenzio)**, là dove dice che `?autostart=1` e `?duration=`
restano scorciatoie di misura e non fanno parte del flusso. `?autostart=1` resta quello che era;
`?duration=` no: la durata ora si sceglie, e un link deve poterla dire come dice le altre. La frase
del 0010 valeva quando non c'era una schermata che la durata la mostrasse.

## Conseguenze

- Una maestra può consegnare un link invece di dettare le impostazioni, e due ragazzi della stessa
  classe giocano esattamente la stessa prova.
- Il link non è un'autorizzazione: la sessione comincia quando qualcuno preme «Inizia», quindi il
  permesso del microfono arriva sempre da un gesto vero.
- Un ricaricamento della pagina dimentica la prova e torna ai default o a ciò che dice l'URL: finché
  non c'è un profilo, la prova vive nel link. Quando arriverà la lista della maestra (ticket 07) la
  lista avrà una sua memoria, non le altre impostazioni.
- Le schermate sono sezioni della stessa pagina, non indirizzi: il pacchetto è una cartella statica e
  il wizard non ha bisogno di routing. Se un giorno servisse un indirizzo per schermata, il costo è
  nell'URL, non nelle schermate.
- Il ticket 09 (soundcheck) userà lo stesso schema: un passo che l'URL può saltare, con il resto
  della prova che resta quello del link.

## Alternative scartate

**Mostrare sempre la configurazione, anche con i parametri nell'URL.** Sarebbe chiedere conferma di
una scelta già fatta, e un link che si ferma a metà non serve a nessuno.

**Far partire la sessione dal link.** Il browser rifiuta il microfono senza un gesto: la pagina
mostrerebbe un errore invece di un esercizio, e sembrerebbe rotta.

**Ricordare la prova in `localStorage` invece che nell'URL.** Non si può passare a un altro telefono,
e la prova di ieri comparirebbe davanti al ragazzo di oggi senza che nessuno l'abbia scelta.

**Una rotta per schermata (`#scelta`, `#gioco`).** Più macchinario di quanto quattro sezioni nascoste
richiedano, e la pagina deve funzionare anche aperta come file dentro una cartella statica.
