# L'evidenza della fondamentale è in prova: su un pianoforte l'ottava sotto risuona

Il secondo giro di misura (243 colpi, stesso pianoforte, stesso telefono, coperchio chiuso) doveva
dire se la regola dell'ottava funzionava. Ha detto due cose, e la prima era un bug mio.

## Il bug: la parabola non era limitata

`peakAt` cercava il massimo in una finestra attorno alla parziale e poi lo raffinava con una
parabola sui tre bin vicini. La formula vale solo su un massimo *concavo* e con uno scostamento
entro mezzo bin; senza quei due controlli, in una zona piatta di rumore il denominatore va a zero,
lo scostamento arriva a decine di bin e il risultato è **sia una frequenza assurda** (182 Hz letti
per un La♯2 da 116 Hz) **sia un'ampiezza gonfiata**. Il punteggio gonfiato è il danno vero: il rumore
superava la soglia e diventava un colpo, poi la regola dell'ottava lo spostava di un'ottava in giù.
Il 45% dei colpi del secondo giro ha un punteggio sotto 0,002, che è il valore mediano dei colpi
sbagliati contro 0,007 di quelli giusti.

Ora la parabola si applica solo a un massimo locale concavo, con scostamento entro mezzo bin, e
l'ampiezza non può scendere sotto quella del bin. Due test lo tengono fermo: uno spettro piatto non
può inventare una frequenza fuori dalla propria finestra né un'ampiezza gonfiata.

## La scoperta: l'ottava sotto risuona

Il secondo giro ha anche mostrato che l'ipotesi su cui la regola è costruita — *se l'ottava sotto ha
energia sulla propria fondamentale, allora è stata suonata* — **è falsa su un pianoforte acustico**.
Le corde dell'ottava sotto risuonano per simpatia: suonando Si5 si trova energia a ~500 Hz, dove sta
il Si4, e la regola tira giù una nota che era giusta. Fra i colpi "credibili" (punteggio ≥ 0,002) la
regola ha spostato 53 volte: **25 giuste, 26 sbagliate**. Una monetina.

## La decisione

La regola resta accesa, ma **in prova**, e non si tocca la soglia a naso:

- il log registra ora le **due ampiezze che decidono l'ottava** (fondamentale del vincitore e
  fondamentale dell'ottava sotto), così la soglia si calibra sui dati del giro successivo invece di
  essere indovinata;
- ogni colpo porta già il confronto: `top[0]` è il vincitore *prima* della regola, quindi un solo
  giro misura entrambe le ipotesi e l'ablazione si fa sul log, senza rifare la prova;
- se al terzo giro la regola resta una monetina sulle ampiezze registrate, si spegne di default e
  gli errori di ottava tornano: sono meno dannosi di una correzione che sbaglia una volta su due.

## Il resto del secondo giro

- **I colpi duplicati si sono diradati, non sono provati spariti.** Nel primo giro le coppie entro
  300 ms erano 30 su 264, e **28 stavano a 150 ms esatti** — cooldown più passo, il segnale inconfondibile
  di un attacco contato più volte — con la stessa nota in 22 casi. Nel secondo sono 29 su 242, sparse
  fra 150 e 250 ms, con la stessa nota solo 13 volte: il pattern stretto è sparito, ma questa misura
  non basta a dichiarare chiuso il difetto, perché i punteggi di questo giro erano gonfiati dal bug.
  Lo dirà il terzo.
- **La ricerca limitata al range ha funzionato**: zero note inventate fuori da Si1–Re6; nel primo
  giro erano comparse Do1, Mi1, Fa#1.
- **Il secondo giro non è confrontabile col primo**: cambiavano tre cose insieme (codice, range
  21–108 → 35–86, soglia ≥ 0,0178 → 0,0002). Un giro che cambia tre cose misura la confusione. Il
  terzo cambia **solo il codice**.
