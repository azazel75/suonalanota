# Protocollo di misura dello spike

Un giro di misura vale solo se è ripetibile. Queste sono le condizioni del **primo giro** (7 novembre
2026); il secondo giro si fa cambiando una cosa sola — il codice del rilevatore — e tenendo fermo
tutto il resto.

## Condizioni

| voce | primo giro |
| --- | --- |
| strumento | pianoforte a mezza coda Yamaha |
| coperchio | **chiuso** |
| telefono | Android 15 di fascia media, **in verticale sul leggio** |
| microfono | quello del telefono, `echoCancellation`/`noiseSuppression`/`autoGainControl` tutti off |
| browser | Firefox 160 mobile |
| campionamento | 48 kHz, finestra di analisi 16384 campioni (341 ms) |
| pedale | **mai usato** |
| stanza | silenziosa: mediana del rumore −100 dBFS, ronzio di rete a 100 Hz a −84,9 dB |

## Come si suona

Per ogni nota di riferimento: **tre pressioni staccate**, con il dito sollevato fra una e l'altra,
circa 2 secondi di suono per pressione. Il suono **non** si estingue completamente fra una pressione
e la successiva, e va bene così: è la condizione reale di chi studia a casa, ed è quella in cui il
rilevatore degli attacchi deve funzionare.

Ordine del primo giro: cromatico da Do4 a Fa6, poi La3, Do3, La2, Sol1. 66 note, 265 colpi registrati.

## Cosa non si tocca fra un giro e l'altro

Posizione e orientamento del telefono, apertura del coperchio, stanza, numero di pressioni per nota,
modo di suonare. Se cambia una di queste cose, il confronto con il giro precedente non è più un
confronto fra due versioni del codice: è un confronto fra due esperimenti.

## I giri di misura

| giro | codice | range cercato | soglia | colpi | esito |
| --- | --- | --- | --- | --- | --- |
| **1** · 7 nov | prima versione | tutti gli 88 tasti | 0,0178 (a fine sessione) | 265 | 72% complessivo |
| **2** · 8 nov | le cinque correzioni | Si1–Re6 (35–86) | **0,0002** (minimo dello slider, rumore mai misurato) | 243 | 59% grezzo, 75% scartando i colpi sotto 0,002 |
| **3** · da fare | parabola limitata | Si1–Re6 | misurata dal rumore, **prima** di suonare | | |

Il secondo giro non è confrontabile col primo: cambiavano insieme il codice, il range e la soglia.
Un giro che cambia tre cose misura la confusione. Il terzo cambia **solo il codice**.

## Cosa si conserva

Il log JSON di ogni giro, con la data nel nome, fuori dal repository (contiene il `deviceId` del
telefono) e una copia in `.scratch/`.

## Perché il coperchio conta

Con il coperchio chiuso il suono esce soprattutto da sotto: i medi e i bassi passano, gli acuti
arrivano attenuati. Nel primo giro i punteggi del registro acuto sono risultati **5-10 volte più
piccoli** di quelli del registro centrale, ed è una delle due spiegazioni possibili insieme alla
soglia alzata (ADR 0004). Il secondo giro va fatto a coperchio chiuso per restare comparabile: la
domanda "gli acuti si perdono" è aperta finché non si misura due volte.
