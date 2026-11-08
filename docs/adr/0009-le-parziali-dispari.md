# Le parziali dispari decidono l'ottava; il tempo di salita no

Due sonde dedicate, 64 e 59 colpi, stesso pianoforte e stesso telefono, sulle sedici note del
protocollo. La prima ha funzionato, la seconda no, e la differenza è fisica.

## Sonda 1 · le parziali dispari: funziona

L'ipotesi: una corda che risuona per simpatia, eccitata dall'ottava sopra, vibra nel suo **modo pari**
e produce le parziali 2, 4, 6 del tasto grave, non la 3, 5, 7. Una corda davvero premuta le ha tutte.

Misurato, come rapporto fra la media delle parziali dispari dell'ottava sotto e la fondamentale della
nota letta:

| classe | n | rapporto |
| --- | --- | --- |
| la corda grave **era premuta** (il rilevatore diceva l'ottava sopra) | 7 casi solidi | **0,32 – 0,60** |
| la corda grave **non era premuta** (il rilevatore era giusto) | 35 colpi forti | **≤ 0,21** |

Con una soglia a **0,3** il test prende 7 casi su 8 e non sbaglia nessuno dei 35. Le due eccezioni
della classe "premuta" (0,006 e 0,18) sono colpi a −44 e −66 dBFS, cioè fotogrammi in cui non c'era
niente da misurare.

**Decisione: la regola dell'ottava usa le parziali dispari, ed è accesa di default.** Fra 0,2 e 0,4 —
la banda fra il massimo delle risonanze e il minimo delle corde premute — non si decide: il
rilevatore sceglie comunque (deve pur nominare una nota), ma l'esercizio **non giudica**: chiede di
ripetere. È lì che il colpo ambiguo vive, non più su tutta la zona dei 3 dB.

## Sonda 2 · il tempo di salita: non funziona

L'ipotesi: una corda percossa parte in pochi millisecondi, una risonanza si costruisce in qualche
decina. Misurato il ritardo fra la salita della banda grave e quella acuta:

| classe | n | ritardo mediano | intervallo |
| --- | --- | --- | --- |
| grave premuta | 10 | **0 ms** | −20 … +20 |
| grave non premuta | 37 | **0 ms** | −60 … +40 |

Nessuna separazione: le due distribuzioni si sovrappongono per intero. Il motivo è che il punto di
mezza salita si misura rispetto al massimo **della banda stessa**, e una banda che contiene solo
rumore ha comunque un massimo e una "salita". A 20 ms di risoluzione, poi, la differenza fisica
(qualche decina di ms al massimo) sta dentro un fotogramma.

Non la propongo di aggiustare: servirebbe una soglia assoluta per banda, cioè di nuovo un numero che
dipende dal guadagno, e la sonda 1 ha già risolto il problema con un criterio che non ne ha bisogno.
La pagina resta nel repository come negativo documentato.

## Cosa cambia nel prodotto

- L'ottava si decide con le parziali dispari: i sette errori di ottava del grave misurati nella sonda
  diventano centrate, e nessuno dei 35 casi corretti viene toccato.
- Il colpo ambiguo resta, ma si stringe alla banda 0,2–0,4 di evidenza: molto meno frequente di
  prima, e per un motivo misurato invece che per un margine in dB.
- Se la regola è spenta, o l'evidenza non è calcolabile (nota altissima, fotogramma silenzioso), il
  comportamento torna quello di prima: ambiguo su un pareggio entro 3 dB.
