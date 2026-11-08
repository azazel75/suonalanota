# Il colpo ambiguo: quando il rilevatore non sa, chiede di ripetere

Emilia ha respinto l'idea di perdonare l'ottava, e ha ragione: se il ragazzo suona il Do sbagliato di
ottava e l'applicazione lo conta giusto, l'esercizio perde il suo scopo. Ma il rilevatore, su un
pianoforte acustico con il microfono di un telefono, l'ottava non sa deciderla in circa un colpo su
dieci: nel quarto giro 30 colpi su 264, tutti con un margine fra la nota e la sua ottava fra 0,5 e
3,3 dB. In quella zona non c'è una risposta giusta da dare, e sia indovinare sia perdonare sono
sbagliati.

## Decisione

Un colpo in cui il margine fra la nota vincente e la sua ottava è **≤ 3 dB** è **ambiguo**:

- non produce un verdetto e **non costa un tentativo**;
- l'applicazione invita a ripetere la nota, senza lampeggio verde né rosso;
- se il bersaglio si chiude (tempo scaduto) con soli colpi ambigui, il verdetto è **saltata**: non è
  una prova che l'allievo abbia sbagliato;
- il log registra ogni colpo ambiguo, così la maestra vede quanto il dispositivo è insicuro su quella
  nota.

La soglia dei 3 dB non è un numero tondo scelto a piacere: è dove sono finiti **tutti** gli errori di
ottava misurati. Sopra i 3 dB il rilevatore sceglie, e la scelta è stata giusta in tutti i colpi
misurati tranne quelli già contati.

## Conseguenze

- L'esercizio non punisce mai una risposta corretta: nel caso peggiore chiede di ripetere.
- Il costo è il tempo: una ripetizione occupa secondi di una sessione da un minuto. Con l'8% di colpi
  ambigui misurato, su una sessione media di 15-20 note sono una o due ripetizioni.
- Un allievo che sbaglia davvero l'ottava continua a essere corretto: suonando la nota sbagliata il
  colpo è limpido — il margine è ampio — e il verdetto è sbagliata. L'ambiguità nasce solo quando la
  nota giusta c'è e il rilevatore non sa dire in quale ottava.
- Se il dispositivo è insicuro su una nota in modo sistematico, il soundcheck la esclude: tre colpi
  ambigui consecutivi sullo stesso tasto sono un dato sulla portata udibile, non sull'allievo.

## Alternative scartate

**Perdonare l'ottava** (contare centrata una nota suonata nell'ottava sbagliata): perde la cosa che
l'esercizio vuole insegnare, come ha fatto notare Emilia.
**Indovinare**: con 0,5-3,3 dB di margine la scelta è casuale, e una scelta casuale che accusa un
bambino è peggio di una domanda in più.
