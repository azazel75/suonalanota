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
| **3** · 8 nov | parabola limitata | Si1–Re6 | 0,0002 (il rumore misurato dà comunque il minimo) | 245 | **86% senza la regola dell'ottava**, 74% con |
| **4** · 8 nov | lettura 150 ms dopo l'attacco, regola spenta | Si1–Re6 | 0,00024 | 264 | 76% grezzo, **82% con credibilità ≥ 4**, **91% perdonando l'ottava** |
| **5** · quando si potrà | credibilità ≥ 4, riferimento visibile | Si1–Re6 | criterio sulla credibilità | | |

Il secondo giro non è confrontabile col primo: cambiavano insieme il codice, il range e la soglia. Il
terzo è confrontabile col secondo per protocollo, ma il codice è cambiato; il quarto è il primo che
misura il comportamento che l'applicazione avrà davvero.

## Accordatura dello strumento

Dal terzo giro, con la frequenza **misurata** e non quella nominale: la mediana degli scarti è
**+6 cent** (il pianoforte è un filo crescente, praticamente a 440). Nel registro grave la misura non
può dire nulla: a 48 kHz e 16384 campioni un bin vale 2,93 Hz, che a 65 Hz sono **78 cent** — più di
mezzo semitono. Il sospetto di Emilia sul Do2 (+56 cent misurati, un solo colpo) è compatibile con
l'accordatura, ma questo log non lo può né confermare né smentire: servirebbe una finestra dieci
volte più lunga.


## Le due sonde dell'ottava

Quando il pianoforte è disponibile, due pagine separate, ognuna col suo file JSON distinguibile dal
campo `probe`:

| pagina | file | domanda |
| --- | --- | --- |
| `/spike/dispari.html` | `"probe": "dispari"` | l'ottava sotto ha le parziali dispari (corda premuta) o solo le pari (corda che risuona)? |
| `/spike/salita.html` | `"probe": "salita"` | la banda dell'ottava sotto sale dopo quella della nota letta? |

Protocollo: stesso telefono nella stessa posizione, coperchio chiuso, **tre pressioni staccate per
nota**, sulle note dove il margine d'ottava è piccolo: **Do4, Fa4, Sol4, Sol#4** e il grave
**Si1, Do2, Re2**. Scaricare i due JSON separatamente: si leggono l'uno senza l'altro.

Cosa si guarda: nel primo il rapporto dispari/pari dell'ottava sotto (vicino a zero = risonanza);
nel secondo il ritardo in ms fra la salita della banda grave e quella acuta (positivo = risonanza,
vicino a zero = corda premuta). Entrambi i file contengono i valori grezzi, non solo il verdetto.

## Cosa si conserva

Il log JSON di ogni giro, con la data nel nome, fuori dal repository (contiene il `deviceId` del
telefono) e una copia in `.scratch/`.

## Perché il coperchio conta

Con il coperchio chiuso il suono esce soprattutto da sotto: i medi e i bassi passano, gli acuti
arrivano attenuati. Nel primo giro i punteggi del registro acuto sono risultati **5-10 volte più
piccoli** di quelli del registro centrale, ed è una delle due spiegazioni possibili insieme alla
soglia alzata (ADR 0004). Il secondo giro va fatto a coperchio chiuso per restare comparabile: la
domanda "gli acuti si perdono" è aperta finché non si misura due volte.
