# Il feedback e il silenzio

L'esercizio risponde con un lampeggio, un tono e — quando non sente niente — con un messaggio. Tre
cose che la specifica chiede ma non misura, e che senza una decisione scritta verrebbero riscritte
diverse a ogni ticket.

## Decisione

**Un solo tono, uguale per la centrata e per l'errore.** Il verde e il rosso dicono la risposta; il
suono dice soltanto *ho giudicato*. Sessanta millisecondi a 660 Hz, circa −26 dBFS: si sente in una
stanza, non è una nota da riconoscere.

**Per 300 ms dopo il tono i colpi non si credono.** Il telefono che suona è lo stesso che ascolta, e
il suo tono rientra dal microfono: 660 Hz è un Mi, cioè il tasto 76, che nel range avanzato esiste.
Senza questa finestra l'applicazione giudicherebbe sé stessa, e un allievo perfetto vedrebbe rossi
che non ha prodotto.

**Cinque secondi sotto −55 dBFS sono un problema di dispositivo, non di lettura.** Il messaggio —
"controlla il volume dello strumento, o togli le cuffie" — prende il posto del contatore e sparisce
al primo colpo. Una stanza tranquilla sta intorno a −70 dBFS su un telefono, una nota suonata a un
braccio di distanza sta sopra −40: −55 è il vuoto fra i due. È un numero di questa applicazione, non
del rilevatore, e va rimisurato se un giorno i telefoni cambiano.

**La scheda che non si guarda è una sessione che non si sta suonando.** Quando la pagina va in
secondo piano la sessione si mette in pausa da sola; si riprende con il bottone, non da sola. Il
tempo dell'esercizio è il tempo in cui qualcuno è davanti al rigo.

**`?autostart=1` e `?duration=` restano scorciatoie di misura.** Servono a far partire una sessione
in un browser senza testa con un microfono finto, e non fanno parte del flusso: senza parametri la
pagina chiede il gesto, come deve.

## Conseguenze

- Il tono non può essere usato come indizio: chi ha l'orecchio buono non impara niente dal suono che
  non gli dica già il colore.
- La finestra muta non toglie tempo alla sessione: i frame continuano ad arrivare e il contatore
  scorre, semplicemente i loro colpi non entrano.
- Un allievo che tiene il volume a zero vede il messaggio invece di collezionare bersagli saltati,
  che è la diagnosi giusta del problema sbagliato.
- La pausa automatica rende il punteggio confrontabile: nessuno guadagna note al minuto lasciando la
  pagina aperta mentre fa altro.

## Alternative scartate

**Il tono solo sulla centrata.** Sarebbe un indizio sonoro della risposta, e l'esercizio diventerebbe
un gioco di orecchio: la cosa che deve imparare è la lettura del rigo.

**Nessun tono.** La specifica lo chiede, e senza il suono un ragazzo che guarda il rigo e non lo
schermo non sa di essere stato giudicato.

**Tenere la cancellazione dell'eco del browser.** È tarata sulla voce: su un pianoforte toglie
proprio le armoniche che servono al rilevatore. Meglio il tono corto e la finestra muta.

**Una soglia di silenzio in percentuale sul rumore misurato all'avvio.** Il rumore della stanza
cambia con la finestra aperta e con il riscaldamento, e una soglia relativa al primo secondo
avrebbe bisogno di un altro stato da tenere allineato: un livello assoluto basta, e si spiega.
