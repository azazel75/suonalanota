# Il quarto giro: la selezione, il silenzio, e la soglia che si può trasferire

Quarto giro, 264 colpi, 580 s. Misurato: **76%**. Con la regola dell'ottava spenta e la lettura a
150 ms, cioè esattamente il comportamento nuovo. Meno di quanto mi aspettassi, e la colpa
dell'aspettativa è mia.

## L'errore di metodo: il 93% era una selezione, non un risultato

Nel terzo giro avevo misurato 93% sui colpi con stabilità 5 e ne avevo concluso che leggere tardi
fosse la cura. Sbagliato: quei colpi erano quelli in cui l'attacco era scattato **tardi**, cioè le
note già in suono, che sono le facili. Leggere tardi *tutti* i colpi non estende quella precisione
agli altri, perché gli altri sono difficili per un'altra ragione — l'ambiguità dell'ottava — non per
il momento della lettura. Ora la stabilità 5 copre il 70% dei colpi e vale l'88%: il numero è
plausibile, ma non è più un risultato selezionato.

Lezione per il protocollo: **un'accuratezza misurata su un sottoinsieme scelto da una condizione non
si estende al resto**. Si estende solo se la condizione è imposta, e allora va misurata di nuovo.

## I tre errori che restano

| tipo | colpi | cosa sono |
| --- | --- | --- |
| ottava sopra | 30 | il grave (C2, D2, B1) e quattro note del centro (Do4, Fa4, Sol4, Sol#4) dove l'ottava sotto risuona |
| fotogrammi quasi silenziosi | 26 | livello −45…−58 dBFS, punteggio ~0,0004: colpi registrati **fra** una pressione e l'altra |
| coda della nota precedente | 9 | la nota sentita è quella del riferimento precedente |

I secondi sono la parte che si può eliminare senza perdere niente: la loro mediana di livello è
−47 dBFS contro −34 dei colpi giusti.

## La soglia: quella assoluta non si trasferisce, quella relativa sì

Tre criteri provati sul log, in ordine di dignità:

- **assoluto** (livello ≥ −45 dBFS): 87% di accuratezza ma perde il 16% dei colpi giusti — quelli
  suonati piano — ed è tarato sul guadagno di *questo* telefono;
- **credibilità ≥ 4** (quanto la nota vince sulla mediana dei candidati, numero puro): **82% di
  accuratezza tenendo il 94% dei colpi giusti**;
- credibilità ≥ 6: 89% ma tiene solo il 72% dei giusti. Troppo cara.

**Decisione: la credibilità ≥ 4 è il criterio con cui un colpo viene accettato.** Il cursore che
prima era "soglia silenzio" ora è quella, e non è più un numero che si muove a caso: è calibrato, è
adimensionale e non dipende dal volume del telefono.

## Cosa fare dell'ottava

Con la credibilità a 4 e **perdonando l'ottava** — cioè contando centrata una nota giusta suonata
nell'ottava sbagliata quando il rilevatore è incerto — si ottiene:

| | severo | ottava perdonata |
| --- | --- | --- |
| tutti i colpi | 82% | **91%** |
| escluso il registro sotto Mi2 | 86% | **92%** |
| range base Do3–Do5 | 84% | **92%** |

Perdonare l'ottava è una decisione **didattica**, non tecnica: il rilevatore non sa distinguere un
errore suo da un errore dell'allievo, e non lo saprà senza un secondo microfono o il MIDI. Contare
come sbagliata una nota che l'allievo ha suonato giusta è il difetto peggiore che l'applicazione
possa avere. La proposta è di perdonarla, e di scrivere nel log che è stata perdonata.

## Il caso Re#4

Emilia ha ragione: cinque colpi su Re#4 giusti, poi tre Re4 con il riferimento ancora su Re#4, e il
riferimento è cambiato undici secondi dopo. Nella pagina il riferimento era una riga piccola sotto
due pulsanti, mentre l'occhio sta sulla nota grande: un cambio non preso era invisibile. Ora il
riferimento è scritto in grande accanto alla nota letta e lampeggia quando cambia.
